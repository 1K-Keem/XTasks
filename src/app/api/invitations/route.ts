import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invites = await prisma.projectInvite.findMany({
    where: {
      inviteeId: session.user.id,
      status: 'pending',
    },
    include: {
      project: true,
      invitedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invites: invites.map((invite) => ({
      id: invite.id,
      projectId: invite.projectId,
      projectName: invite.project.name,
      role: invite.role,
      invitedBy: invite.invitedBy.name ?? invite.invitedBy.email,
      createdAt: invite.createdAt,
    })),
  })
}
