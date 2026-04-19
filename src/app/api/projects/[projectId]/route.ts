import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { getProjectRole, isProjectOwner } from '../../../../lib/project-access'

const deleteSchema = z.object({
  confirmName: z.string().min(1).max(120),
})

export async function DELETE(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(params.projectId, session.user.id)
  if (!isProjectOwner(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const payload = deleteSchema.parse(await request.json())
    const project = await prisma.project.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (payload.confirmName.trim() !== project.name) {
      return NextResponse.json({ error: 'Project name does not match.' }, { status: 400 })
    }
    await prisma.project.delete({ where: { id: params.projectId } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
