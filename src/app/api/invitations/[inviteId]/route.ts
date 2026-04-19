import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

const actionSchema = z.object({
  action: z.enum(['accept', 'decline']),
})

export async function PATCH(request: Request, { params }: { params: { inviteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = actionSchema.parse(await request.json())

    const invite = await prisma.projectInvite.findUnique({
      where: { id: params.inviteId },
      include: { project: true },
    })

    if (!invite || invite.inviteeId !== session.user.id) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending.' }, { status: 409 })
    }

    if (payload.action === 'decline') {
      await prisma.projectInvite.update({
        where: { id: invite.id },
        data: {
          status: 'declined',
          respondedAt: new Date(),
        },
      })
      return NextResponse.json({ ok: true, status: 'declined' })
    }

    const alreadyMember =
      invite.project.ownerId === session.user.id ||
      (await prisma.projectMember.findFirst({
        where: { projectId: invite.projectId, userId: session.user.id },
      }))

    if (!alreadyMember) {
      await prisma.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId: session.user.id,
          role: invite.role,
        },
      })
    }

    await prisma.projectInvite.update({
      where: { id: invite.id },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
      },
    })

    const role = invite.project.ownerId === session.user.id ? 'owner' : invite.role
    return NextResponse.json({
      ok: true,
      status: 'accepted',
      project: {
        id: invite.project.id,
        name: invite.project.name,
        role,
      },
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
