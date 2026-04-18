import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { project: { createdAt: 'asc' } },
  })
  const projects = memberships.map((m) => ({ id: m.project.id, name: m.project.name, role: m.role }))
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = createProjectSchema.parse(await request.json())
  const project = await prisma.project.create({
    data: { name: payload.name, ownerId: session.user.id },
  })
  await prisma.projectMember.create({
    data: {
      userId: session.user.id,
      projectId: project.id,
      role: 'owner',
    },
  })
  return NextResponse.json({ project: { id: project.id, name: project.name, role: 'owner' } })
}
