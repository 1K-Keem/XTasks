import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { wouldCreateCycle } from '../../../../../lib/dag'

const taskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  durationDays: z.number().int().min(1).max(365).default(1),
  assigneeId: z.string().nullable().optional(),
  subtasksJson: z.string().optional(),
  commentsJson: z.string().optional(),
  dependencyIds: z.array(z.string()).default([]),
})

async function canAccess(projectId: string, userId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  })
  return !!member
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccess(params.projectId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId },
    include: { dependencies: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    tasks: tasks.map((task) => ({
      ...task,
      dependencyIds: task.dependencies.map((dep) => dep.dependsOnTaskId),
    })),
  })
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccess(params.projectId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = taskSchema.parse(await request.json())
    const created = await prisma.task.create({
      data: {
        projectId: params.projectId,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        durationDays: payload.durationDays,
        assigneeId: payload.assigneeId ?? undefined,
        subtasksJson: payload.subtasksJson ?? '[]',
        commentsJson: payload.commentsJson ?? '[]',
      },
    })

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

    return NextResponse.json({ task: created })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
