import { prisma } from './prisma'

export type ProjectRole = 'owner' | 'lead' | 'member'

export async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findFirst({
    where: { projectId, userId },
  })
}

export async function canAccessProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  })
  return !!project
}

export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project) return null
  if (project.ownerId === userId) {
    const row = await getMembership(projectId, userId)
    return (row?.role as ProjectRole) ?? 'owner'
  }
  const member = await getMembership(projectId, userId)
  return (member?.role as ProjectRole) ?? null
}

export function canEditTask(role: ProjectRole | null, assigneeId: string | null, userId: string) {
  if (!role) return false
  if (role === 'owner' || role === 'lead') return true
  return assigneeId === userId
}

export function canManageMembers(role: ProjectRole | null) {
  return role === 'owner' || role === 'lead'
}

export function isProjectOwner(role: ProjectRole | null) {
  return role === 'owner'
}
