import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import XTasksApp from '../../components/XTasksApp'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

export const dynamic = 'force-dynamic'

function mergeProjects(memberships: { projectId: string; role: string; project: { id: string; name: string } }[], owned: { id: string; name: string }[]) {
  const byId = new Map<string, { id: string; name: string; role: string }>()
  for (const m of memberships) {
    byId.set(m.project.id, { id: m.project.id, name: m.project.name, role: m.role })
  }
  for (const p of owned) {
    if (!byId.has(p.id)) {
      byId.set(p.id, { id: p.id, name: p.name, role: 'owner' })
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default async function DashboardPage() {
  let session
  try {
    session = await getServerSession(authOptions)
  } catch {
    redirect('/login')
  }
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect('/login')

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

  const projects = mergeProjects(
    memberships.map((m) => ({ projectId: m.projectId, role: m.role, project: m.project })),
    ownedProjects,
  )

  const activeProjectId = projects[0]?.id ?? ''

  const tasks = activeProjectId
    ? await prisma.task.findMany({
        where: { projectId: activeProjectId },
        include: { dependencies: true, assignees: true },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const members = activeProjectId
    ? await prisma.projectMember.findMany({
        where: { projectId: activeProjectId },
        include: { user: true },
      })
    : []

  const projectRow = activeProjectId ? await prisma.project.findUnique({ where: { id: activeProjectId } }) : null

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
  if (projectRow && !seen.has(projectRow.ownerId)) {
    const owner = await prisma.user.findUnique({ where: { id: projectRow.ownerId } })
    if (owner) {
      rows.unshift({
        id: owner.id,
        name: owner.name ?? owner.email ?? 'Owner',
        email: owner.email,
        role: 'owner',
      })
    }
  }
  if (rows.length === 0) {
    rows.push({
      id: session.user.id,
      name: user.name ?? user.email ?? 'You',
      email: user.email,
      role: 'member',
    })
  }
  const users = rows

  return (
    <XTasksApp
      initialProjects={projects}
      initialActiveProjectId={activeProjectId}
      initialUsers={users}
      initialCurrentUserId={session.user.id}
      initialCurrentUserName={user.name ?? user.email ?? 'You'}
      initialTasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        duration: task.durationDays,
        assigneeIds: task.assignees.length > 0 ? task.assignees.map((row) => row.userId) : task.assigneeId ? [task.assigneeId] : [],
        status: task.status as 'todo' | 'in_progress' | 'done' | 'blocked',
        dependencyIds: task.dependencies.map((dep) => dep.dependsOnTaskId),
        subtasks: (() => {
          try {
            return JSON.parse(task.subtasksJson || '[]') as { id: string; title: string; done: boolean }[]
          } catch {
            return []
          }
        })(),
        notes: task.description ?? '',
        comments: (() => {
          try {
            return JSON.parse(task.commentsJson || '[]') as string[]
          } catch {
            return []
          }
        })(),
        createdAt: task.createdAt.getTime(),
        positionX: task.positionX,
        positionY: task.positionY,
      }))}
    />
  )
}
