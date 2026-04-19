import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const member = await prisma.projectMember.findFirst({
    where: { projectId: params.projectId, userId: session.user.id },
  })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: { user: true },
  })
  const users = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email ?? 'User',
    role: m.role as 'owner' | 'lead' | 'member',
  }))
  return NextResponse.json({ users })
}