import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { wouldCreateCycle } from '../../../../lib/dag'
import { canAccessProject, canEditTask, getProjectRole } from '../../../../lib/project-access'

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  assigneeId: z.string().nullable().optional(),
  subtasksJson: z.string().optional(),
  commentsJson: z.string().optional(),
  dependencyIds: z.array(z.string()).optional(),
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
})

async function getTaskForUser(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  })
  if (!task) return null
  const ok = await canAccessProject(task.projectId, userId)
  if (!ok) return null
  const role = await getProjectRole(task.projectId, userId)
  return { task, role }
}

export async function PATCH(request: Request, { params }: { params: { taskId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const found = await getTaskForUser(params.taskId, session.user.id)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { task, role } = found
  if (!canEditTask(role, task.assigneeId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const payload = updateSchema.parse(await request.json())
    const { dependencyIds, ...patch } = payload

    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data: {
        ...patch,
        assigneeId: payload.assigneeId === null ? null : payload.assigneeId,
        positionX: payload.positionX === undefined ? undefined : payload.positionX,
        positionY: payload.positionY === undefined ? undefined : payload.positionY,
      },
    })

    if (dependencyIds) {
      const tasks = await prisma.task.findMany({
        where: { projectId: task.projectId },
        select: { id: true },
      })
      const deps = await prisma.dependency.findMany({
        where: { task: { projectId: task.projectId }, NOT: { taskId: params.taskId } },
        select: { taskId: true, dependsOnTaskId: true },
      })
      const testEdges = dependencyIds.map((id) => ({ taskId: params.taskId, dependsOnTaskId: id }))
      const allEdges = [...deps, ...testEdges]
      if (dependencyIds.some((id) => wouldCreateCycle(tasks, allEdges, params.taskId, id))) {
        return NextResponse.json({ error: 'Dependency introduces a cycle.' }, { status: 400 })
      }

      await prisma.dependency.deleteMany({ where: { taskId: params.taskId } })
      if (dependencyIds.length > 0) {
        await prisma.dependency.createMany({
          data: dependencyIds.map((dependsOnTaskId) => ({ taskId: params.taskId, dependsOnTaskId })),
        })
      }
    }

    return NextResponse.json({ task: updated })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { taskId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const found = await getTaskForUser(params.taskId, session.user.id)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { task, role } = found
  if (!canEditTask(role, task.assigneeId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id: params.taskId } })
  return NextResponse.json({ ok: true })
}
