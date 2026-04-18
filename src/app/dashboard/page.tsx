import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import XTasksApp from '../../components/XTasksApp'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let session
  try {
    session = await getServerSession(authOptions)
  } catch (error) {
    console.error('Failed to get server session:', error)
    redirect('/login')
  }
  if (!session?.user?.id) redirect('/login')

  console.log('session.user.id:', session.user.id)

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect('/login')

  // Get all projects the user is a member of
  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { project: { createdAt: 'asc' } },
  })

  const projects = memberships.map((m) => ({ id: m.project.id, name: m.project.name, role: m.role }))

  let activeProject = memberships[0]?.project
  if (!activeProject) {
    // If no membership, create a new project and connect it to the existing user.
    activeProject = await prisma.project.create({
      data: {
        name: 'My Project',
        owner: { connect: { id: session.user.id } },
      },
    })
    // Add as owner
    await prisma.projectMember.create({
      data: {
        userId: session.user.id,
        projectId: activeProject.id,
        role: 'owner',
      },
    })
    projects.push({ id: activeProject.id, name: activeProject.name, role: 'owner' })
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: activeProject.id },
    include: { dependencies: true },
    orderBy: { createdAt: 'asc' },
  })

  // Get all members of the project
  const members = await prisma.projectMember.findMany({
    where: { projectId: activeProject.id },
    include: { user: true },
  })

  const users = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email ?? 'User',
    role: m.role as 'owner' | 'lead' | 'member',
  }))

  // Find current user's role
  const currentUserMember = members.find((m) => m.userId === session.user.id)
  const currentUserRole = currentUserMember?.role ?? 'member'

  return (
    <XTasksApp
      initialProjects={projects}
      initialActiveProjectId={activeProject.id}
      initialUsers={users}
      initialCurrentUserId={session.user.id}
      initialTasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        duration: task.durationDays,
        assigneeId: task.assigneeId ?? session.user.id,
        status: task.status as 'todo' | 'in_progress' | 'done' | 'blocked',
        dependencyIds: task.dependencies.map((dep) => dep.dependsOnTaskId),
        subtasks: (() => { try { return JSON.parse(task.subtasksJson || '[]') as { id: string; title: string; done: boolean }[] } catch { return [] } })(),
        notes: task.description ?? '',
        comments: (() => { try { return JSON.parse(task.commentsJson || '[]') as string[] } catch { return [] } })(),
        createdAt: task.createdAt.getTime(),
      }))}
    />
  )
}
