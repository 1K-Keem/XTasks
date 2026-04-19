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

  const [memberships, ownedProjects] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId: session.user.id },
      include: { project: true },
      orderBy: { project: { createdAt: 'asc' } },
    }),
    prisma.project.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const byId = new Map<string, { id: string; name: string; role: string }>()
  for (const m of memberships) {
    byId.set(m.project.id, { id: m.project.id, name: m.project.name, role: m.role })
  }
  for (const p of ownedProjects) {
    if (!byId.has(p.id)) {
      byId.set(p.id, { id: p.id, name: p.name, role: 'owner' })
    }
  }

  const projects = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
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
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
