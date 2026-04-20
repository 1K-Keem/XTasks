'use client'

import { signOut } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { computeCPM } from '../lib/cpm'
import EmptyProjectState from './EmptyProjectState'
import InvitationsModal from './InvitationsModal'
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

function mapTaskFromApi(task: Record<string, unknown>): TaskNode {
  const assigneeIds = Array.isArray(task.assigneeIds)
    ? (task.assigneeIds as string[])
    : task.assigneeId
      ? [String(task.assigneeId)]
      : []

  return {
    id: String(task.id),
    title: String(task.title),
    duration: Number(task.durationDays ?? 1),
    assigneeIds,
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
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [rolePanelOpen, setRolePanelOpen] = useState(false)
  const [inviteCount, setInviteCount] = useState(0)
  const [interactionLocked, setInteractionLocked] = useState(false)
  const rolePanelRef = useRef<HTMLDivElement | null>(null)
  const suppressTaskRefreshRef = useRef(false)

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
    const tasks = (data?.tasks ?? []).map((task: Record<string, unknown>) => mapTaskFromApi(task))
    dispatch({ type: 'loadTasks', tasks })
  }, [state.activeProjectId])

  const refreshMembers = useCallback(async () => {
    if (!state.activeProjectId) return
    const res = await fetch(`/api/projects/${state.activeProjectId}/members`)
    if (!res.ok) return
    const data = await res.json()
    const users = (data?.users ?? []) as WorkspaceMember[]
    if (users.length) dispatch({ type: 'loadUsers', users })
  }, [state.activeProjectId])

  const refreshInviteCount = useCallback(async () => {
    const res = await fetch('/api/invitations')
    if (!res.ok) return
    const data = await res.json()
    setInviteCount(Array.isArray(data?.invites) ? data.invites.length : 0)
  }, [])

  const refreshInteractionLock = useCallback(async () => {
    if (!state.activeProjectId) return
    const res = await fetch(`/api/projects/${state.activeProjectId}/interaction-lock`)
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    setInteractionLocked(Boolean(data?.locked))
  }, [state.activeProjectId])

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

  useEffect(() => {
    void refreshMembers()
  }, [refreshMembers])

  useEffect(() => {
    void refreshInviteCount()
  }, [refreshInviteCount])

  useEffect(() => {
    void refreshInteractionLock()
  }, [refreshInteractionLock])

  useEffect(() => {
    const onFocus = () => {
      void refreshInviteCount()
    }

    const interval = setInterval(() => {
      void refreshInviteCount()
    }, 10000)

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshInviteCount])

  useEffect(() => {
    if (!rolePanelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRolePanelOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rolePanelOpen])

  useEffect(() => {
    if (!rolePanelOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rolePanelRef.current) return
      const target = event.target
      if (target instanceof Node && !rolePanelRef.current.contains(target)) {
        setRolePanelOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [rolePanelOpen])

  useEffect(() => {
    if (!state.activeProjectId) return

    const source = new EventSource(`/api/projects/${state.activeProjectId}/events`)
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (suppressTaskRefreshRef.current) return
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        if (suppressTaskRefreshRef.current) {
          refreshTimer = null
          return
        }
        refreshTimer = null
        void refreshTasks()
      }, 120)
    }

    source.addEventListener('project_event', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          type?: string
          removedUserId?: string
          interactionLocked?: boolean
        }

        if (payload.type === 'member_removed') {
          void refreshMembers()
          if (payload.removedUserId === state.currentUserId) {
            dispatch({ type: 'removeProject', projectId: state.activeProjectId })
            void refreshProjects()
            return
          }
        }

        if (payload.type === 'member_role_updated') {
          void refreshMembers()
          void refreshProjects()
        }

        if (payload.type === 'interaction_lock_updated') {
          if (typeof payload.interactionLocked === 'boolean') {
            setInteractionLocked(payload.interactionLocked)
          } else {
            void refreshInteractionLock()
          }
        }
      } catch {
        // Ignore parse errors for non-data keepalive messages.
      }
      scheduleRefresh()
    })

    return () => {
      source.close()
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [state.activeProjectId, state.currentUserId, refreshInteractionLock, refreshMembers, refreshProjects, refreshTasks])

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const activeProjectRole = activeProject?.role ?? 'member'
  const canManageProject = activeProjectRole === 'owner' || activeProjectRole === 'lead'

  const toggleInteractionLock = useCallback(
    async (locked: boolean) => {
      if (!state.activeProjectId || !canManageProject) return
      const previous = interactionLocked
      setInteractionLocked(locked)
      const res = await fetch(`/api/projects/${state.activeProjectId}/interaction-lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      })
      if (!res.ok) {
        setInteractionLocked(previous)
      }
    },
    [canManageProject, interactionLocked, state.activeProjectId],
  )

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

  const assigneeNames = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return 'Unassigned'
      const labels = ids
        .map((id) => state.users.find((u) => u.id === id)?.name)
        .filter((name): name is string => Boolean(name))
      return labels.length > 0 ? labels.join(', ') : 'Unassigned'
    },
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
        assigneeIds: patch.assigneeIds,
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
    if (interactionLocked) return
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      dispatch({ type: 'deleteTask', taskId })
    }
  }

  const onDependencyChange = useCallback(
    (taskId: string, nextDependencyIds: string[]) => {
      if (interactionLocked) return
      dispatch({ type: 'updateTask', taskId, patch: { dependencyIds: nextDependencyIds } })
      void persistTask(taskId, { dependencyIds: nextDependencyIds })
    },
    [interactionLocked],
  )

  const createRootTask = async (position?: { x: number; y: number }) => {
    if (interactionLocked) return
    if (!activeProject) return
    const positioned = state.tasks.filter((task) => task.positionX != null && task.positionY != null)
    const maxX = positioned.length > 0 ? Math.max(...positioned.map((task) => Number(task.positionX))) : 40
    const minY = positioned.length > 0 ? Math.min(...positioned.map((task) => Number(task.positionY))) : 40

    const res = await fetch(`/api/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New task',
        description: '',
        status: 'todo',
        durationDays: 1,
        assigneeIds: [state.currentUserId],
        positionX: position?.x ?? maxX + 300,
        positionY: position?.y ?? minY,
      }),
    })
    if (res.ok) void refreshTasks()
  }

  const autoLayoutTasks = (positions: Record<string, { x: number; y: number }>) => {
    const tasks = state.tasks.map((task) => {
      const nextPos = positions[task.id]
      if (!nextPos) return task
      return { ...task, positionX: nextPos.x, positionY: nextPos.y }
    })

    dispatch({ type: 'loadTasks', tasks })

    const entries = Object.entries(positions)
    if (entries.length === 0) return

    suppressTaskRefreshRef.current = true
    void (async () => {
      try {
        await Promise.all(entries.map(([taskId, pos]) => persistTask(taskId, { positionX: pos.x, positionY: pos.y })))
      } finally {
        suppressTaskRefreshRef.current = false
        void refreshTasks()
      }
    })()
  }

  const clearAllTasksRemote = async () => {
    if (interactionLocked) return
    if (state.tasks.length === 0) return
    const confirmed = typeof window === 'undefined' ? false : window.confirm('Delete all tasks in this project?')
    if (!confirmed) return

    const ids = state.tasks.map((task) => task.id)
    const responses = await Promise.all(ids.map((taskId) => fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })))
    if (responses.some((res) => !res.ok)) {
      if (typeof window !== 'undefined') {
        window.alert('Some tasks could not be deleted. Please try again.')
      }
      void refreshTasks()
      return
    }

    dispatch({ type: 'loadTasks', tasks: [] })
  }

  const onQuickAddChild = async (parentId: string) => {
    if (interactionLocked) return
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
        assigneeIds: [state.currentUserId],
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

  const leaveProjectRemote = async () => {
    if (!activeProject || activeProjectRole === 'owner') return
    const confirmed = typeof window === 'undefined' ? false : window.confirm(`Leave project \"${activeProject.name}\"?`)
    if (!confirmed) return

    const res = await fetch(`/api/projects/${activeProject.id}/leave`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (typeof window !== 'undefined') {
        window.alert(typeof data.error === 'string' ? data.error : 'Could not leave this project.')
      }
      return
    }

    dispatch({ type: 'removeProject', projectId: activeProject.id })
    await refreshProjects()
  }

  const emptyDashboard = state.projects.length === 0 || !state.activeProjectId

  if (emptyDashboard) {
    return (
      <>
        <EmptyProjectState
          darkMode={state.darkMode}
          userLabel={state.currentUserName}
          inviteCount={inviteCount}
          onCreateProject={() => void createProjectRemote()}
          onJoinProject={() => setJoinOpen(true)}
          onOpenInvites={() => setInvitesOpen(true)}
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
        {invitesOpen && (
          <InvitationsModal
            darkMode={state.darkMode}
            onClose={() => setInvitesOpen(false)}
            onAccepted={(project) => {
              dispatch({ type: 'addProject', project })
              dispatch({ type: 'switchProject', projectId: project.id })
              setInvitesOpen(false)
              void refreshProjects()
            }}
            onCountChanged={setInviteCount}
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
            <h1 className="text-3xl font-black tracking-tight">Task Flow Workspace</h1>
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
            <div className="relative">
              <select
                value={state.activeProjectId}
                onChange={(e) => dispatch({ type: 'switchProject', projectId: e.target.value })}
                className={
                  state.darkMode
                    ? 'h-9 min-w-[120px] max-w-[156px] appearance-none rounded-xl border border-cyan-500/40 bg-slate-900 px-2.5 pr-7 text-xs font-bold text-slate-100 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30'
                    : 'h-9 min-w-[120px] max-w-[156px] appearance-none rounded-xl border border-cyan-300 bg-white px-2.5 pr-7 text-xs font-bold text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/35'
                }
              >
                {state.projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                    className={state.darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}
                  >
                    {project.name}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className={
                  state.darkMode
                    ? 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-200'
                    : 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-600'
                }
              >
                ▾
              </span>
            </div>
            <button
              type="button"
              className="h-10 rounded-2xl border border-black/10 px-3 text-sm font-bold transition hover:scale-[1.02]"
              onClick={() => void createProjectRemote()}
            >
              New project
            </button>
            {activeProject && (
              <>
                <button
                  type="button"
                  className={`h-10 rounded-2xl px-3 text-sm font-bold transition ${
                    inviteCount > 0
                      ? 'border border-rose-400 bg-rose-50 text-rose-700 shadow-sm shadow-rose-500/20 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-200'
                      : 'border border-amber-300/80'
                  }`}
                  onClick={() => setInvitesOpen(true)}
                >
                  <span className="inline-flex items-center gap-2">
                    Invitations
                    {inviteCount > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black leading-none text-white">
                        {inviteCount > 99 ? '99+' : inviteCount}
                      </span>
                    )}
                  </span>
                </button>
                {canManageProject && (
                  <button
                    type="button"
                    className="h-10 rounded-2xl border border-fuchsia-300/80 px-3 text-sm font-bold"
                    onClick={() => setShareOpen(true)}
                  >
                    Share
                  </button>
                )}
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
              onClick={() => setRolePanelOpen((open) => !open)}
            >
              Role
            </button>
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
            Highlighted nodes and edges follow the longest zero-slack chain.
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
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Role quick view</p>
          <p className="mt-2 text-sm opacity-85">
            You are a <span className="font-bold capitalize">{activeProjectRole}</span> on this project.
          </p>
          <button
            type="button"
            className="mt-3 h-9 rounded-2xl border border-violet-300/80 px-3 text-sm font-bold"
            onClick={() => setRolePanelOpen(true)}
          >
            Role guide
          </button>
        </article>
      </section>

      <section className="px-5 pb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Interactive graph</p>
            <p className="text-xs opacity-70">Drag nodes, connect handles, or tap + to spawn a dependent task.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeProjectRole !== 'owner' && (
              <button
                type="button"
                className="h-9 rounded-2xl border border-rose-300/80 px-3 text-sm font-bold text-rose-700 dark:text-rose-300"
                onClick={() => void leaveProjectRemote()}
              >
                Leave project
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          {canManageProject && (
            <button
              type="button"
              disabled={interactionLocked}
              className="absolute left-3 top-3 z-20 h-9 rounded-2xl border border-cyan-300/80 bg-cyan-50 px-3 text-sm font-bold text-cyan-900 shadow-md dark:border-cyan-500/40 dark:bg-slate-800 dark:text-cyan-100"
              onClick={() => void createRootTask()}
            >
              {interactionLocked ? 'Locked' : '+ Task'}
            </button>
          )}
          <ProjectFlowCanvas
            tasks={state.tasks}
            darkMode={state.darkMode}
            criticalIds={cpm.criticalTaskIds}
            canManageProject={canManageProject}
            interactionLocked={interactionLocked}
            canToggleInteractionLock={canManageProject}
            onToggleInteractionLock={(locked) => void toggleInteractionLock(locked)}
            currentUserId={state.currentUserId}
            assigneeNames={assigneeNames}
            onSelectTask={(id) => dispatch({ type: 'openTask', taskId: id })}
            onPersistPosition={persistPosition}
            onQuickAddChild={(parentId) => void onQuickAddChild(parentId)}
            onCreateTaskAt={(x, y) => void createRootTask({ x, y })}
            onAutoLayout={autoLayoutTasks}
            onClearAll={() => void clearAllTasksRemote()}
            onToggleDone={onToggleDone}
            onDeleteTask={(taskId) => void deleteTaskRemote(taskId)}
            onDependencyChange={onDependencyChange}
          />
        </div>
      </section>

      {selectedTask && activeProject && (
        <TaskDetailDrawer
          darkMode={state.darkMode}
          task={selectedTask}
          members={state.users}
          tasks={state.tasks}
          canEdit={!interactionLocked && (canManageProject || selectedTask.assigneeIds.includes(state.currentUserId))}
          currentUserName={state.currentUserName}
          onClose={() => dispatch({ type: 'openTask', taskId: null })}
          onPatch={(taskId, patch) => dispatch({ type: 'updateTask', taskId, patch })}
          onPersist={(taskId, patch) => void persistTask(taskId, patch)}
          onDelete={(taskId) => {
            if (interactionLocked) return
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
          currentUserId={state.currentUserId}
          onClose={() => setSettingsOpen(false)}
          onMembersChanged={() => {
            void refreshMembers()
            void refreshTasks()
          }}
          onDeleted={async () => {
            setSettingsOpen(false)
            dispatch({ type: 'removeProject', projectId: activeProject.id })
            await refreshProjects()
          }}
        />
      )}

      {invitesOpen && (
        <InvitationsModal
          darkMode={state.darkMode}
          onClose={() => setInvitesOpen(false)}
          onAccepted={(project) => {
            if (!state.projects.some((p) => p.id === project.id)) {
              dispatch({ type: 'addProject', project })
            }
            dispatch({ type: 'switchProject', projectId: project.id })
            setInvitesOpen(false)
            void refreshProjects()
          }}
          onCountChanged={setInviteCount}
        />
      )}

      {rolePanelOpen && (
        <div
          ref={rolePanelRef}
          className={
            state.darkMode
              ? 'fixed right-5 top-24 z-40 w-[360px] rounded-3xl border border-violet-700/60 bg-slate-900/95 p-4 shadow-2xl backdrop-blur'
              : 'fixed right-5 top-24 z-40 w-[360px] rounded-3xl border border-violet-200 bg-white/95 p-4 shadow-2xl backdrop-blur'
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-500">Role Guide</p>
          </div>
          <p className="mt-2 text-sm opacity-85">
            You are currently <span className="font-bold capitalize">{activeProjectRole}</span>.
          </p>
          <div className="mt-3 space-y-2 text-sm opacity-90">
            <p>
              <span className="font-bold">Owner:</span> manage members, remove members, invite teammates, create/delete tasks, and control project settings.
            </p>
            <p>
              <span className="font-bold">Lead:</span> invite and remove members, create/delete tasks, and manage day-to-day board operations.
            </p>
            <p>
              <span className="font-bold">Member:</span> view all tasks, and edit only tasks assigned to you.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
