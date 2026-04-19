import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

const joinSchema = z.object({
  projectId: z.string().min(1),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = joinSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: payload.projectId } })
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

    if (project.ownerId === session.user.id) {
      return NextResponse.json({ project: { id: project.id, name: project.name, role: 'owner' } })
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: session.user.id },
    })
    if (existing) {
      return NextResponse.json({ project: { id: project.id, name: project.name, role: existing.role } })
    }

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: session.user.id,
        role: 'member',
      },
    })
    return NextResponse.json({ project: { id: project.id, name: project.name, role: 'member' } })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
