'use client'

import { signOut } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { computeCPM } from '../lib/cpm'
import EmptyProjectState from './EmptyProjectState'
import JoinProjectModal from './JoinProjectModal'
import ProjectFlowCanvas from './flow/ProjectFlowCanvas'
import ProjectSettingsModal from './ProjectSettingsModal'
import ShareProjectModal from './ShareProjectModal'
import TaskDetailDrawer, { type WorkspaceMember } from './TaskDetailDrawer'
import type { TaskNode, TaskStatus } from './task-types'

type AppState = {
  projects: { id: string; name: string; role: string }[]
  activeProjectId: string
  users: WorkspaceMember[]
  currentUserId: string
  currentUserName: string
  tasks: TaskNode[]
  selectedTaskId: string | null
  darkMode: boolean
}

type AppAction =
  | { type: 'loadProjects'; projects: { id: string; name: string; role: string }[] }
  | { type: 'switchProject'; projectId: string }
  | { type: 'addProject'; project: { id: string; name: string; role: string } }
  | { type: 'removeProject'; projectId: string }
  | { type: 'loadTasks'; tasks: TaskNode[] }
  | { type: 'loadUsers'; users: WorkspaceMember[] }
  | { type: 'toggleTheme' }
  | { type: 'openTask'; taskId: string | null }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'updateTask'; taskId: string; patch: Partial<TaskNode> }
  | { type: 'toggleTaskDone'; taskId: string }
  | { type: 'addSubtask'; taskId: string; title: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskId: string }
  | { type: 'renameSubtask'; taskId: string; subtaskId: string; title: string }
  | { type: 'deleteSubtask'; taskId: string; subtaskId: string }
  | { type: 'addComment'; taskId: string; text: string }

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'loadProjects': {
      let nextActive = state.activeProjectId
      if (!action.projects.some((p) => p.id === nextActive)) {
        nextActive = action.projects[0]?.id ?? ''
      }
      return {
        ...state,
        projects: action.projects,
        activeProjectId: nextActive,
        tasks: nextActive === state.activeProjectId ? state.tasks : [],
        selectedTaskId: nextActive === state.activeProjectId ? state.selectedTaskId : null,
      }
    }
    case 'switchProject':
      return { ...state, activeProjectId: action.projectId, tasks: [], selectedTaskId: null }
    case 'addProject':
      return { ...state, projects: [...state.projects, action.project] }
    case 'removeProject': {
      const projects = state.projects.filter((p) => p.id !== action.projectId)
      const activeProjectId =
        state.activeProjectId === action.projectId ? projects[0]?.id ?? '' : state.activeProjectId
      return {
        ...state,
        projects,
        activeProjectId,
        tasks: state.activeProjectId === action.projectId ? [] : state.tasks,
        selectedTaskId: state.activeProjectId === action.projectId ? null : state.selectedTaskId,
      }
    }
    case 'loadTasks':
      return { ...state, tasks: action.tasks }
    case 'loadUsers':
      return { ...state, users: action.users }
    case 'toggleTheme':
      return { ...state, darkMode: !state.darkMode }
    case 'openTask':
      return { ...state, selectedTaskId: action.taskId }
    case 'deleteTask': {
      const tasks = state.tasks
        .filter((task) => task.id !== action.taskId)
        .map((task) => ({
          ...task,
          dependencyIds: task.dependencyIds.filter((depId) => depId !== action.taskId),
        }))
      const selectedTaskId = state.selectedTaskId === action.taskId ? null : state.selectedTaskId
      return { ...state, tasks, selectedTaskId }
    }
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, ...action.patch } : task)),
      }
    case 'toggleTaskDone':
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task
          return { ...task, status: task.status === 'done' ? 'in_progress' : 'done' }
        }),
      }
    case 'addSubtask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, subtasks: [...task.subtasks, { id: createId(), title: action.title, done: false }] }
            : task,
        ),
      }
    case 'toggleSubtask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === action.subtaskId ? { ...subtask, done: !subtask.done } : subtask,
                ),
              }
            : task,
        ),
      }
    case 'renameSubtask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === action.subtaskId ? { ...subtask, title: action.title } : subtask,
                ),
              }
            : task,
        ),
      }
    case 'deleteSubtask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId ? { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== action.subtaskId) } : task,
        ),
      }
    case 'addComment':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId ? { ...task, comments: [...task.comments, action.text] } : task,
        ),
      }
    default:
      return state
  }
}

function mapTaskFromApi(task: Record<string, unknown>, fallbackUserId: string): TaskNode {
  return {
    id: String(task.id),
    title: String(task.title),
    duration: Number(task.durationDays ?? 1),
    assigneeId: (task.assigneeId as string | null) ?? fallbackUserId,
    status: task.status as TaskStatus,
    dependencyIds: Array.isArray(task.dependencies)
      ? (task.dependencies as { dependsOnTaskId: string }[]).map((d) => d.dependsOnTaskId)
      : ((task.dependencyIds as string[]) ?? []),
    subtasks: (() => {
      try {
        return JSON.parse(String(task.subtasksJson || '[]')) as TaskNode['subtasks']
      } catch {
        return []
      }
    })(),
    notes: task.description != null ? String(task.description) : '',
    comments: (() => {
      try {
        return JSON.parse(String(task.commentsJson || '[]')) as string[]
      } catch {
        return []
      }
    })(),
    createdAt: task.createdAt ? new Date(task.createdAt as string).getTime() : Date.now(),
    positionX: task.positionX != null ? Number(task.positionX) : null,
    positionY: task.positionY != null ? Number(task.positionY) : null,
  }
}

export default function XTasksApp({
  initialProjects,
  initialActiveProjectId,
  initialUsers,
  initialCurrentUserId,
  initialCurrentUserName,
  initialTasks,
}: {
  initialProjects: { id: string; name: string; role: string }[]
  initialActiveProjectId: string
  initialUsers: WorkspaceMember[]
  initialCurrentUserId: string
  initialCurrentUserName: string
  initialTasks: TaskNode[]
}): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, {
    projects: initialProjects,
    activeProjectId: initialActiveProjectId,
    users: initialUsers,
    currentUserId: initialCurrentUserId,
    currentUserName: initialCurrentUserName,
    tasks: initialTasks,
    selectedTaskId: null,
    darkMode: false,
  })

  const [shareOpen, setShareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const refreshProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (!res.ok) return
    const data = await res.json()
    const projects = (data?.projects ?? []) as { id: string; name: string; role: string }[]
    dispatch({ type: 'loadProjects', projects })
  }, [])

  const refreshTasks = useCallback(async () => {
    if (!state.activeProjectId) return
    const res = await fetch(`/api/projects/${state.activeProjectId}/tasks`)
    if (!res.ok) return
    const data = await res.json()
    const tasks = (data?.tasks ?? []).map((task: Record<string, unknown>) => mapTaskFromApi(task, state.currentUserId))
    dispatch({ type: 'loadTasks', tasks })
  }, [state.activeProjectId, state.currentUserId])

  const refreshMembers = useCallback(async () => {
    if (!state.activeProjectId) return
    const res = await fetch(`/api/projects/${state.activeProjectId}/members`)
    if (!res.ok) return
    const data = await res.json()
    const users = (data?.users ?? []) as WorkspaceMember[]
    if (users.length) dispatch({ type: 'loadUsers', users })
  }, [state.activeProjectId])

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

  useEffect(() => {
    void refreshMembers()
  }, [refreshMembers])

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const activeProjectRole = activeProject?.role ?? 'member'
  const canManageProject = activeProjectRole === 'owner' || activeProjectRole === 'lead'

  const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId) ?? null

  const completedIds = useMemo(
    () => new Set(state.tasks.filter((t) => t.status === 'done').map((t) => t.id)),
    [state.tasks],
  )

  const cpm = useMemo(() => {
    return computeCPM(
      state.tasks.map((t) => ({ id: t.id, duration: t.duration, dependencyIds: t.dependencyIds })),
      completedIds,
    )
  }, [state.tasks, completedIds])

  const assigneeName = useCallback(
    (id: string) => state.users.find((u) => u.id === id)?.name ?? 'Unassigned',
    [state.users],
  )

  const persistTask = async (taskId: string, patch: Partial<TaskNode>) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: patch.title,
        description: patch.notes,
        status: patch.status,
        durationDays: patch.duration,
        assigneeId: patch.assigneeId,
        subtasksJson: patch.subtasks ? JSON.stringify(patch.subtasks) : undefined,
        commentsJson: patch.comments ? JSON.stringify(patch.comments) : undefined,
        dependencyIds: patch.dependencyIds,
        positionX: patch.positionX ?? undefined,
        positionY: patch.positionY ?? undefined,
      }),
    })
    if (!res.ok) console.error(`Failed to persist task ${taskId}`)
  }

  const persistPosition = (taskId: string, x: number, y: number) => {
    dispatch({ type: 'updateTask', taskId, patch: { positionX: x, positionY: y } })
    void persistTask(taskId, { positionX: x, positionY: y })
  }

  const deleteTaskRemote = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      dispatch({ type: 'deleteTask', taskId })
    }
  }

  const onDependencyChange = useCallback(
    (taskId: string, nextDependencyIds: string[]) => {
      dispatch({ type: 'updateTask', taskId, patch: { dependencyIds: nextDependencyIds } })
      void persistTask(taskId, { dependencyIds: nextDependencyIds })
    },
    [],
  )

  const createRootTask = async () => {
    if (!activeProject) return
    const res = await fetch(`/api/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New task',
        description: '',
        status: 'todo',
        durationDays: 1,
        assigneeId: state.currentUserId,
      }),
    })
    if (res.ok) void refreshTasks()
  }

  const onQuickAddChild = async (parentId: string) => {
    if (!activeProject) return
    const parent = state.tasks.find((t) => t.id === parentId)
    const px = (parent?.positionX ?? 200) + 100
    const py = (parent?.positionY ?? 120) + 40
    const res = await fetch(`/api/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New task',
        description: '',
        status: 'todo',
        durationDays: 1,
        assigneeId: state.currentUserId,
        dependencyIds: [parentId],
        positionX: px,
        positionY: py,
      }),
    })
    if (res.ok) void refreshTasks()
  }

  const onToggleDone = (taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return
    const next: TaskStatus = task.status === 'done' ? 'in_progress' : 'done'
    dispatch({ type: 'updateTask', taskId, patch: { status: next } })
    void persistTask(taskId, { status: next })
  }

  const createProjectRemote = async () => {
    const name = typeof window !== 'undefined' ? window.prompt('Name your project') : null
    if (!name?.trim()) return
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      dispatch({ type: 'addProject', project: data.project })
      dispatch({ type: 'switchProject', projectId: data.project.id })
      await refreshProjects()
    }
  }

  const emptyDashboard = state.projects.length === 0 || !state.activeProjectId

  if (emptyDashboard) {
    return (
      <>
        <EmptyProjectState
          darkMode={state.darkMode}
          userLabel={state.currentUserName}
          onCreateProject={() => void createProjectRemote()}
          onJoinProject={() => setJoinOpen(true)}
          onToggleTheme={() => dispatch({ type: 'toggleTheme' })}
        />
        {joinOpen && (
          <JoinProjectModal
            darkMode={state.darkMode}
            onClose={() => setJoinOpen(false)}
            onJoined={(project) => {
              dispatch({ type: 'addProject', project })
              dispatch({ type: 'switchProject', projectId: project.id })
              setJoinOpen(false)
              void refreshProjects()
            }}
          />
        )}
      </>
    )
  }

  const shell = state.darkMode ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-cyan-50 text-slate-900'

  return (
    <main className={shell}>
      <header
        className={
          state.darkMode
            ? 'border-b border-violet-800/50 bg-slate-900/90 p-5 shadow-lg backdrop-blur'
            : 'border-b border-fuchsia-100/80 bg-white/80 p-5 shadow-sm backdrop-blur'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-fuchsia-500">XTasks</p>
            <h1 className="text-3xl font-black tracking-tight">CPM command center</h1>
            <p className="text-sm opacity-75">
              Logged in as <span className="font-semibold">{state.currentUserName}</span>
              {activeProject ? (
                <>
                  {' '}
                  · Project role: <span className="font-semibold capitalize">{activeProjectRole}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={state.activeProjectId}
              onChange={(e) => dispatch({ type: 'switchProject', projectId: e.target.value })}
              className="h-10 rounded-2xl border border-black/10 bg-transparent px-3 text-sm font-bold"
            >
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-10 rounded-2xl border border-black/10 px-3 text-sm font-bold transition hover:scale-[1.02]"
              onClick={() => void createProjectRemote()}
            >
              New project
            </button>
            {canManageProject && (
              <button
                type="button"
                className="h-10 rounded-2xl border border-cyan-300/80 bg-cyan-50 px-3 text-sm font-bold text-cyan-900 dark:border-cyan-500/40 dark:bg-slate-800 dark:text-cyan-100"
                onClick={() => void createRootTask()}
              >
                + Task
              </button>
            )}
            {activeProject && (
              <>
                <button
                  type="button"
                  className="h-10 rounded-2xl border border-fuchsia-300/80 px-3 text-sm font-bold"
                  onClick={() => setShareOpen(true)}
                >
                  Share
                </button>
                {activeProjectRole === 'owner' && (
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-violet-300/80 px-3 text-sm font-bold"
                    onClick={() => setSettingsOpen(true)}
                  >
                    Settings
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="h-10 rounded-2xl border border-black/10 px-3 text-sm font-bold"
              onClick={() => dispatch({ type: 'toggleTheme' })}
            >
              {state.darkMode ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              className="h-10 rounded-2xl border border-black/10 px-3 text-sm font-bold"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-5 py-5 lg:grid-cols-3">
        <article
          className={
            state.darkMode
              ? 'rounded-3xl border border-fuchsia-500/30 bg-fuchsia-950/40 p-4 shadow-lg'
              : 'rounded-3xl border border-fuchsia-100 bg-fuchsia-50/90 p-4 shadow-md'
          }
        >
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Critical path length</p>
          <p className="mt-1 text-3xl font-black">{cpm.projectDuration} days</p>
          <p className="mt-2 text-xs opacity-75">
            Timeline updates as durations and dependencies change. Highlighted nodes and edges follow the longest zero-slack chain.
          </p>
        </article>
        <article
          className={
            state.darkMode
              ? 'rounded-3xl border border-cyan-500/30 bg-cyan-950/40 p-4 shadow-lg'
              : 'rounded-3xl border border-cyan-100 bg-cyan-50/90 p-4 shadow-md'
          }
        >
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Duration-weighted progress</p>
          <p className="mt-1 text-3xl font-black">{cpm.progressByDurationPercent}%</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all duration-700"
              style={{ width: `${cpm.progressByDurationPercent}%` }}
            />
          </div>
        </article>
        <article
          className={
            state.darkMode
              ? 'rounded-3xl border border-violet-500/30 bg-violet-950/40 p-4 shadow-lg'
              : 'rounded-3xl border border-violet-100 bg-violet-50/90 p-4 shadow-md'
          }
        >
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">How roles work here</p>
          <p className="mt-2 text-sm opacity-85">
            You are a <span className="font-bold capitalize">{activeProjectRole}</span> on this board. Global accounts stay neutral — ownership
            only applies per project.
          </p>
        </article>
      </section>

      <section className="px-5 pb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Interactive graph</p>
            <p className="text-xs opacity-70">Drag nodes, connect handles, or tap + to spawn a dependent task.</p>
          </div>
        </div>
        <ProjectFlowCanvas
          tasks={state.tasks}
          darkMode={state.darkMode}
          criticalIds={cpm.criticalTaskIds}
          canManageProject={canManageProject}
          currentUserId={state.currentUserId}
          assigneeName={assigneeName}
          onSelectTask={(id) => dispatch({ type: 'openTask', taskId: id })}
          onPersistPosition={persistPosition}
          onQuickAddChild={(parentId) => void onQuickAddChild(parentId)}
          onToggleDone={onToggleDone}
          onDeleteTask={(taskId) => void deleteTaskRemote(taskId)}
          onDependencyChange={onDependencyChange}
        />
      </section>

      {selectedTask && activeProject && (
        <TaskDetailDrawer
          darkMode={state.darkMode}
          task={selectedTask}
          members={state.users}
          tasks={state.tasks}
          canEdit={canManageProject || selectedTask.assigneeId === state.currentUserId}
          onClose={() => dispatch({ type: 'openTask', taskId: null })}
          onPatch={(taskId, patch) => dispatch({ type: 'updateTask', taskId, patch })}
          onPersist={(taskId, patch) => void persistTask(taskId, patch)}
          onDelete={(taskId) => {
            void deleteTaskRemote(taskId)
            dispatch({ type: 'openTask', taskId: null })
          }}
        />
      )}

      {shareOpen && activeProject && (
        <ShareProjectModal
          darkMode={state.darkMode}
          projectName={activeProject.name}
          projectId={activeProject.id}
          onClose={() => setShareOpen(false)}
          onInvited={() => void refreshMembers()}
        />
      )}

      {settingsOpen && activeProject && activeProjectRole === 'owner' && (
        <ProjectSettingsModal
          darkMode={state.darkMode}
          projectName={activeProject.name}
          projectId={activeProject.id}
          onClose={() => setSettingsOpen(false)}
          onDeleted={async () => {
            setSettingsOpen(false)
            dispatch({ type: 'removeProject', projectId: activeProject.id })
            await refreshProjects()
          }}
        />
      )}
    </main>
  )
}
