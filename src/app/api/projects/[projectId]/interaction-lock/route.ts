import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { canAccessProject, canManageMembers, getProjectRole } from '../../../../../lib/project-access'
import { publishProjectEvent } from '../../../../../lib/realtime'

const updateLockSchema = z.object({
  locked: z.boolean(),
})

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canAccessProject(params.projectId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { interactionLocked: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ locked: project.interactionLocked })
}

export async function PATCH(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (!canManageMembers(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = updateLockSchema.parse(await request.json())

    const project = await prisma.project.update({
      where: { id: params.projectId },
      data: { interactionLocked: payload.locked },
      select: { interactionLocked: true },
    })

    publishProjectEvent(params.projectId, {
      type: 'interaction_lock_updated',
      taskId: '',
      interactionLocked: project.interactionLocked,
      at: Date.now(),
    })

    return NextResponse.json({ locked: project.interactionLocked })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
