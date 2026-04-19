import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { canAccessProject, canManageMembers, getProjectRole } from '../../../../../lib/project-access'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'lead']).default('member'),
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

    const created = await prisma.projectMember.create({
      data: {
        projectId: params.projectId,
        userId: invitee.id,
        role: payload.role,
      },
      include: { user: true },
    })

    return NextResponse.json({
      user: {
        id: created.user.id,
        name: created.user.name ?? created.user.email,
        email: created.user.email,
        role: created.role,
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
