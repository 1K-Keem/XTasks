import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { canAccessProject, canManageMembers, getProjectRole } from '../../../../../lib/project-access'
import { publishProjectEvent } from '../../../../../lib/realtime'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'lead']).default('member'),
})

const removeMemberSchema = z.object({
  userId: z.string().min(1),
})

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['member', 'lead']),
})

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessProject(params.projectId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: { user: true },
  })

  const rows: { id: string; name: string; email: string; role: string }[] = []
  const seen = new Set<string>()
  for (const m of members) {
    seen.add(m.userId)
    rows.push({
      id: m.user.id,
      name: m.user.name ?? m.user.email ?? 'User',
      email: m.user.email,
      role: m.role,
    })
  }
  if (!seen.has(project.ownerId)) {
    const owner = await prisma.user.findUnique({ where: { id: project.ownerId } })
    if (owner) {
      rows.unshift({
        id: owner.id,
        name: owner.name ?? owner.email ?? 'Owner',
        email: owner.email,
        role: 'owner',
      })
    }
  }

  return NextResponse.json({ users: rows })
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (!canManageMembers(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = inviteSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const email = payload.email.trim().toLowerCase()
    const invitee = await prisma.user.findUnique({ where: { email } })
    if (!invitee) {
      return NextResponse.json({ error: 'No account exists for that email yet. Ask them to sign up first.' }, { status: 404 })
    }
    if (invitee.id === project.ownerId) {
      return NextResponse.json({ error: 'Owner is already on this project.' }, { status: 400 })
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId: params.projectId, userId: invitee.id },
    })
    if (existing) {
      return NextResponse.json({
        user: {
          id: invitee.id,
          name: invitee.name ?? invitee.email,
          email: invitee.email,
          role: existing.role,
        },
        alreadyMember: true,
      })
    }

    const invite = await prisma.projectInvite.upsert({
      where: {
        projectId_inviteeId: {
          projectId: params.projectId,
          inviteeId: invitee.id,
        },
      },
      create: {
        projectId: params.projectId,
        inviteeId: invitee.id,
        invitedById: session.user.id,
        role: payload.role,
        status: 'pending',
      },
      update: {
        invitedById: session.user.id,
        role: payload.role,
        status: 'pending',
        respondedAt: null,
      },
      include: { invitee: true },
    })

    return NextResponse.json({
      invited: {
        id: invite.invitee.id,
        name: invite.invitee.name ?? invite.invitee.email,
        email: invite.invitee.email,
        role: invite.role,
      },
      pending: true,
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (!canManageMembers(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = removeMemberSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (payload.userId === project.ownerId) {
      return NextResponse.json({ error: 'Cannot remove the project owner.' }, { status: 400 })
    }

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.projectId, userId: payload.userId },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    }

    await prisma.projectMember.delete({ where: { id: membership.id } })
    await prisma.taskAssignment.deleteMany({
      where: {
        userId: payload.userId,
        task: { projectId: params.projectId },
      },
    })
    await prisma.task.updateMany({
      where: { projectId: params.projectId, assigneeId: payload.userId },
      data: { assigneeId: null },
    })

    publishProjectEvent(params.projectId, {
      type: 'member_removed',
      taskId: '',
      removedUserId: payload.userId,
      at: Date.now(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = updateRoleSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (payload.userId === project.ownerId) {
      return NextResponse.json({ error: 'Cannot change the project owner role.' }, { status: 400 })
    }

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.projectId, userId: payload.userId },
      include: { user: true },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    }

    const updated = await prisma.projectMember.update({
      where: { id: membership.id },
      data: { role: payload.role },
      include: { user: true },
    })

    publishProjectEvent(params.projectId, {
      type: 'member_role_updated',
      taskId: '',
      at: Date.now(),
    })

    return NextResponse.json({
      user: {
        id: updated.user.id,
        name: updated.user.name ?? updated.user.email ?? 'User',
        email: updated.user.email,
        role: updated.role,
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
