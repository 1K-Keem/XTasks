import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { getProjectRole, isProjectOwner } from '../../../../../lib/project-access'
import { publishProjectEvent } from '../../../../../lib/realtime'

export async function POST(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (isProjectOwner(role)) {
    return NextResponse.json({ error: 'Owner cannot leave this project.' }, { status: 400 })
  }

  const membership = await prisma.projectMember.findFirst({
    where: { projectId: params.projectId, userId: session.user.id },
  })
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.projectMember.delete({ where: { id: membership.id } })
  await prisma.taskAssignment.deleteMany({
    where: {
      userId: session.user.id,
      task: { projectId: params.projectId },
    },
  })
  await prisma.task.updateMany({
    where: { projectId: params.projectId, assigneeId: session.user.id },
    data: { assigneeId: null },
  })

  publishProjectEvent(params.projectId, {
    type: 'member_removed',
    taskId: '',
    removedUserId: session.user.id,
    at: Date.now(),
  })

  return NextResponse.json({ ok: true })
}
