import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { wouldCreateCycle } from '../../../../../lib/dag'
import { canAccessProject } from '../../../../../lib/project-access'
import { publishProjectEvent } from '../../../../../lib/realtime'

const taskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  durationDays: z.number().int().min(1).max(365).default(1),
  assigneeIds: z.array(z.string()).default([]),
  subtasksJson: z.string().optional(),
  commentsJson: z.string().optional(),
  dependencyIds: z.array(z.string()).default([]),
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
})

async function canAccess(projectId: string, userId: string) {
  return canAccessProject(projectId, userId)
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccess(params.projectId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId },
    include: { dependencies: true, assignees: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    tasks: tasks.map((task) => ({
      ...task,
      dependencyIds: task.dependencies.map((dep) => dep.dependsOnTaskId),
      assigneeIds: task.assignees.map((row) => row.userId),
    })),
  })
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccess(params.projectId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = taskSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: params.projectId }, select: { ownerId: true } })
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

    const members = await prisma.projectMember.findMany({ where: { projectId: params.projectId }, select: { userId: true } })
    const allowedAssignees = new Set<string>([project.ownerId, ...members.map((m) => m.userId)])
    const assigneeIds = Array.from(new Set(payload.assigneeIds)).filter((id) => allowedAssignees.has(id))

    const created = await prisma.task.create({
      data: {
        projectId: params.projectId,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        durationDays: payload.durationDays,
        assigneeId: assigneeIds[0] ?? null,
        subtasksJson: payload.subtasksJson ?? '[]',
        commentsJson: payload.commentsJson ?? '[]',
        positionX: payload.positionX ?? undefined,
        positionY: payload.positionY ?? undefined,
      },
    })

    if (assigneeIds.length > 0) {
      await prisma.taskAssignment.createMany({
        data: assigneeIds.map((userId) => ({ taskId: created.id, userId })),
      })
    }

    if (payload.dependencyIds.length > 0) {
      const tasks = await prisma.task.findMany({ where: { projectId: params.projectId }, select: { id: true } })
      const deps = await prisma.dependency.findMany({ where: { task: { projectId: params.projectId } }, select: { taskId: true, dependsOnTaskId: true } })
      for (const depId of payload.dependencyIds) {
        if (wouldCreateCycle(tasks, deps, created.id, depId)) {
          await prisma.task.delete({ where: { id: created.id } })
          return NextResponse.json({ error: 'Dependency introduces a cycle.' }, { status: 400 })
        }
        await prisma.dependency.create({ data: { taskId: created.id, dependsOnTaskId: depId } })
      }
    }

    publishProjectEvent(params.projectId, {
      type: 'task_created',
      taskId: created.id,
      at: Date.now(),
    })

    return NextResponse.json({
      task: {
        ...created,
        assigneeIds,
      },
    })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
