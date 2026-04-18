'use client'

import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useReducer, useState } from 'react'

type Role = 'owner' | 'lead' | 'member'
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

type TeamUser = {
  id: string
  name: string
  role: Role
}

type Subtask = {
  id: string
  title: string
  done: boolean
}

type TaskNode = {
  id: string
  title: string
  duration: number
  assigneeId: string
  status: TaskStatus
  dependencyIds: string[]
  subtasks: Subtask[]
  notes: string
  comments: string[]
  createdAt: number
}

type AppState = {
  projects: { id: string; name: string; role: string }[]
  activeProjectId: string
  users: TeamUser[]
  currentUserId: string
  tasks: TaskNode[]
  selectedTaskId: string | null
  darkMode: boolean
}

type AppAction =
  | { type: 'switchUser'; userId: string }
  | { type: 'switchProject'; projectId: string }
  | { type: 'addProject'; project: { id: string; name: string; role: string } }
  | { type: 'loadTasks'; tasks: TaskNode[] }
  | { type: 'loadUsers'; users: TeamUser[] }
  | { type: 'toggleTheme' }
  | { type: 'openTask'; taskId: string | null }
  | { type: 'createTask' }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'updateTask'; taskId: string; patch: Partial<TaskNode> }
  | { type: 'toggleTaskDone'; taskId: string }
  | { type: 'addSubtask'; taskId: string; title: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskId: string }
  | { type: 'renameSubtask'; taskId: string; subtaskId: string; title: string }
  | { type: 'deleteSubtask'; taskId: string; subtaskId: string }
  | { type: 'addComment'; taskId: string; text: string }
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const isDone = (task: TaskNode) => task.status === 'done'

function taskLocked(task: TaskNode, tasks: TaskNode[]) {
  if (task.dependencyIds.length === 0) return false
  return task.dependencyIds.some((depId) => {
    const dep = tasks.find((t) => t.id === depId)
    return !dep || !isDone(dep)
  })
}

function wouldCreateCycle(tasks: TaskNode[], taskId: string, dependsOnTaskId: string): boolean {
  if (taskId === dependsOnTaskId) return true
  const edges = new Map<string, string[]>()
  for (const task of tasks) edges.set(task.id, [...task.dependencyIds])
  edges.set(taskId, [...(edges.get(taskId) ?? []), dependsOnTaskId])
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const next = edges.get(id) ?? []
    for (const n of next) {
      if (dfs(n)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return tasks.some((task) => dfs(task.id))
}

function longestPath(tasks: TaskNode[]) {
  const memo: Record<string, number> = {}
  const parent: Record<string, string | null> = {}
  const stack = new Set<string>()

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const score = (id: string): number => {
    if (memo[id] !== undefined) return memo[id]
    if (stack.has(id)) return 0
    const task = byId.get(id)
    if (!task) return 0
    stack.add(id)
    if (task.dependencyIds.length === 0) {
      parent[id] = null
      memo[id] = task.duration
      stack.delete(id)
      return memo[id]
    }
    let bestParent: string | null = null
    let best = 0
    for (const depId of task.dependencyIds) {
      const depScore = score(depId)
      if (depScore > best) {
        best = depScore
        bestParent = depId
      }
    }
    parent[id] = bestParent
    memo[id] = best + task.duration
    stack.delete(id)
    return memo[id]
  }

  let endTaskId: string | null = null
  let max = 0
  for (const task of tasks) {
    const value = score(task.id)
    if (value > max) {
      max = value
      endTaskId = task.id
    }
  }

  const chain: string[] = []
  let ptr = endTaskId
  while (ptr) {
    chain.unshift(ptr)
    ptr = parent[ptr] ?? null
  }
  return { totalDuration: max, chain }
}

function computeLevels(tasks: TaskNode[]) {
  const memo: Record<string, number> = {}
  const getLevel = (task: TaskNode, visiting = new Set<string>()): number => {
    if (memo[task.id] !== undefined) return memo[task.id]
    if (visiting.has(task.id)) {
      memo[task.id] = 0
      return 0
    }
    visiting.add(task.id)
    if (task.dependencyIds.length === 0) {
      memo[task.id] = 0
      visiting.delete(task.id)
      return 0
    }
    const maxDep = Math.max(
      ...task.dependencyIds.map((depId) => {
        const dep = tasks.find((t) => t.id === depId)
        return dep ? getLevel(dep, visiting) : 0
      }),
    )
    memo[task.id] = maxDep + 1
    visiting.delete(task.id)
    return memo[task.id]
  }
  tasks.forEach((task) => getLevel(task))
  return memo
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'switchUser':
      return { ...state, currentUserId: action.userId }
    case 'switchProject':
      return { ...state, activeProjectId: action.projectId, tasks: [], selectedTaskId: null }
    case 'addProject':
      return { ...state, projects: [...state.projects, action.project] }
    case 'loadTasks':
      return { ...state, tasks: action.tasks }
    case 'loadUsers':
      return { ...state, users: action.users }
    case 'toggleTheme':
      return { ...state, darkMode: !state.darkMode }
    case 'openTask':
      return { ...state, selectedTaskId: action.taskId }
    case 'createTask': {
      const newTask: TaskNode = {
        id: `temp-${createId()}`,
        title: 'New CPM Node',
        duration: 1,
        assigneeId: state.currentUserId,
        status: 'todo',
        dependencyIds: [],
        subtasks: [],
        notes: '',
        comments: [],
        createdAt: Date.now(),
      }
      return { ...state, tasks: [...state.tasks, newTask], selectedTaskId: newTask.id }
    }
    case 'deleteTask': {
      const tasks = state.tasks
        .filter((task) => task.id !== action.taskId)
        .map((task) => ({ ...task, dependencyIds: task.dependencyIds.filter((depId) => depId !== action.taskId) }))
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
          task.id === action.taskId ? { ...task, subtasks: [...task.subtasks, { id: createId(), title: action.title, done: false }] } : task,
        ),
      }
    case 'toggleSubtask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) => (subtask.id === action.subtaskId ? { ...subtask, done: !subtask.done } : subtask)),
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
                subtasks: task.subtasks.map((subtask) => (subtask.id === action.subtaskId ? { ...subtask, title: action.title } : subtask)),
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
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, comments: [...task.comments, action.text] } : task)),
      }
    default:
      return state
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 3v18h2v-6h7l-1.5-4L16 7H9V3z" fill="currentColor" />
    </svg>
  )
}

function TaskModal({
  state,
  task,
  canEdit,
  onClose,
  dispatch,
  onPatchTask,
}: {
  state: AppState
  task: TaskNode
  canEdit: boolean
  onClose: () => void
  dispatch: React.Dispatch<AppAction>
  onPatchTask: (taskId: string, patch: Partial<TaskNode>) => void
}) {
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [dependencySearch, setDependencySearch] = useState('')
  const currentUser = state.users.find((u) => u.id === state.currentUserId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-3xl border p-5 shadow-2xl ${state.darkMode ? 'border-violet-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">Task Detail: {task.title}</h2>
          <button className="rounded-xl border px-3 py-1 text-sm transition hover:scale-105" onClick={onClose} type="button">Close</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold">Title</span>
            <input
              className="w-full rounded-xl border bg-transparent px-3 py-2"
              value={task.title}
              disabled={!canEdit}
              onChange={(event) => dispatch({ type: 'updateTask', taskId: task.id, patch: { title: event.target.value } })}
              onBlur={() => onPatchTask(task.id, { title: task.title })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold">Duration (days)</span>
            <input
              className="w-full rounded-xl border bg-transparent px-3 py-2"
              type="number"
              min={1}
              value={task.duration}
              disabled={!canEdit}
              onChange={(event) => dispatch({ type: 'updateTask', taskId: task.id, patch: { duration: Math.max(1, Number(event.target.value) || 1) } })}
              onBlur={() => onPatchTask(task.id, { duration: task.duration })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold">Assignee</span>
            <select
              className="w-full rounded-xl border bg-transparent px-3 py-2"
              value={task.assigneeId}
              disabled={!canEdit}
              onChange={(event) => dispatch({ type: 'updateTask', taskId: task.id, patch: { assigneeId: event.target.value } })}
              onBlur={() => onPatchTask(task.id, { assigneeId: task.assigneeId })}
            >
              {state.users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold">Status</span>
            <select
              className="w-full rounded-xl border bg-transparent px-3 py-2"
              value={task.status}
              disabled={!canEdit}
              onChange={(event) => dispatch({ type: 'updateTask', taskId: task.id, patch: { status: event.target.value as TaskStatus } })}
              onBlur={() => onPatchTask(task.id, { status: task.status })}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-3">
            <h3 className="mb-2 font-bold">Subtasks Checklist</h3>
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={subtask.done} disabled={!canEdit} onChange={() => dispatch({ type: 'toggleSubtask', taskId: task.id, subtaskId: subtask.id })} />
                  <input
                    className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm"
                    value={subtask.title}
                    disabled={!canEdit}
                    onChange={(event) => dispatch({ type: 'renameSubtask', taskId: task.id, subtaskId: subtask.id, title: event.target.value })}
                  />
                  {canEdit && (
                    <button className="text-xs text-red-500" type="button" onClick={() => dispatch({ type: 'deleteSubtask', taskId: task.id, subtaskId: subtask.id })}>Delete</button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm" value={subtaskDraft} onChange={(event) => setSubtaskDraft(event.target.value)} placeholder="Add subtask..." />
                <button
                  type="button"
                  className="rounded-lg bg-cyan-600 px-3 py-1 text-sm font-semibold text-white"
                  onClick={() => {
                    const title = subtaskDraft.trim()
                    if (!title) return
                    dispatch({ type: 'addSubtask', taskId: task.id, title })
                    setSubtaskDraft('')
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-3">
            <h3 className="mb-2 font-bold">Notes & Comments</h3>
            <textarea
              className="h-24 w-full rounded-xl border bg-transparent p-2 text-sm"
              value={task.notes}
              disabled={!canEdit}
              placeholder="Capture decisions, context, and team notes..."
              onChange={(event) => dispatch({ type: 'updateTask', taskId: task.id, patch: { notes: event.target.value } })}
              onBlur={() => onPatchTask(task.id, { notes: task.notes })}
            />
            <div className="mt-2 space-y-1 text-sm">
              {task.comments.map((comment, idx) => (
                <p key={`${comment}-${idx}`} className="rounded-lg bg-black/5 px-2 py-1">{comment}</p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add team comment..." />
              <button
                className="rounded-lg border px-3 py-1 text-sm"
                type="button"
                onClick={() => {
                  const text = commentDraft.trim()
                  if (!text) return
                  dispatch({ type: 'addComment', taskId: task.id, text: `${currentUser?.name ?? 'User'}: ${text}` })
                  setCommentDraft('')
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border p-3">
          <h3 className="mb-2 font-bold">Dependencies (Lead editable)</h3>
          <input
            className="mb-2 w-full rounded-lg border bg-transparent px-2 py-1 text-sm"
            placeholder="Search dependency nodes..."
            value={dependencySearch}
            onChange={(event) => setDependencySearch(event.target.value)}
          />
          <div className="grid gap-1 sm:grid-cols-2">
            {state.tasks
              .filter((candidate) => candidate.id !== task.id && candidate.title.toLowerCase().includes(dependencySearch.toLowerCase()))
              .map((candidate) => (
              <label key={candidate.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={task.dependencyIds.includes(candidate.id)}
                  onChange={(event) => {
                    const set = new Set(task.dependencyIds)
                    if (event.target.checked) {
                      if (wouldCreateCycle(state.tasks, task.id, candidate.id)) return
                      set.add(candidate.id)
                    } else {
                      set.delete(candidate.id)
                    }
                    const dependencyIds = Array.from(set)
                    dispatch({ type: 'updateTask', taskId: task.id, patch: { dependencyIds } })
                    onPatchTask(task.id, { dependencyIds })
                  }}
                />
                {candidate.title}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function XTasksApp({
  initialProjects,
  initialActiveProjectId,
  initialUsers,
  initialCurrentUserId,
  initialTasks,
}: {
  initialProjects: { id: string; name: string; role: string }[]
  initialActiveProjectId: string
  initialUsers: TeamUser[]
  initialCurrentUserId: string
  initialTasks: TaskNode[]
}): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, {
    projects: initialProjects,
    activeProjectId: initialActiveProjectId,
    users: initialUsers,
    currentUserId: initialCurrentUserId,
    tasks: initialTasks,
    selectedTaskId: null,
    darkMode: false,
  })
  const currentUser = state.users.find((u) => u.id === state.currentUserId)
  useEffect(() => {
    if (state.activeProjectId) {
      // Fetch tasks for the active project
      fetch(`/api/projects/${state.activeProjectId}/tasks`)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`)
          return res.json()
        })
        .then((data) => {
          const tasks = (data?.tasks ?? []).map((task: any) => ({
            id: task.id,
            title: task.title,
            duration: task.durationDays,
            assigneeId: task.assigneeId ?? state.currentUserId,
            status: task.status as TaskStatus,
            dependencyIds: (task.dependencies ?? []).map((dep: any) => dep.dependsOnTaskId),
            subtasks: (() => { try { return JSON.parse(task.subtasksJson || '[]') } catch { return [] } })(),
            notes: task.description ?? '',
            comments: (() => { try { return JSON.parse(task.commentsJson || '[]') } catch { return [] } })(),
            createdAt: new Date(task.createdAt).getTime(),
          }))
          dispatch({ type: 'loadTasks', tasks })
        })
        .catch((err) => console.error(err))
      // Fetch members for the active project
      fetch(`/api/projects/${state.activeProjectId}/members`)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`)
          return res.json()
        })
        .then((data) => {
          const incoming = (data?.users ?? []).map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
          })).filter((u: any) => u.id)
          if (incoming.length > 0) {
            dispatch({ type: 'loadUsers', users: incoming })
          }
        })
        .catch((err) => console.error(err))
    }
  }, [state.activeProjectId, state.currentUserId])

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0]

  // Derive role from the projects list (always available, no async dependency)
  const activeProjectRole = activeProject?.role
  const canManageProject =
    activeProjectRole === 'owner' ||
    activeProjectRole === 'lead' ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'lead'
  const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId) ?? null

  const levelByTaskId = useMemo(() => computeLevels(state.tasks), [state.tasks])
  const criticalPath = useMemo(() => longestPath(state.tasks), [state.tasks])

  const tasksByLevel = useMemo(() => {
    const grouped: Record<number, TaskNode[]> = {}
    for (const task of state.tasks) {
      const level = levelByTaskId[task.id] ?? 0
      grouped[level] = [...(grouped[level] ?? []), task]
    }
    return grouped
  }, [levelByTaskId, state.tasks])

  const graphNodes = useMemo(() => {
    const levelGapX = 290
    const rowGapY = 170
    const layout: Record<string, { x: number; y: number }> = {}
    Object.entries(tasksByLevel).forEach(([rawLevel, levelTasks]) => {
      const level = Number(rawLevel)
      levelTasks.forEach((task, idx) => {
        layout[task.id] = { x: 80 + level * levelGapX, y: 100 + idx * rowGapY }
      })
    })
    return layout
  }, [tasksByLevel])

  const totalDuration = state.tasks.reduce((sum, task) => sum + task.duration, 0)
  const completedDuration = state.tasks.filter((task) => task.status === 'done').reduce((sum, task) => sum + task.duration, 0)
  const completionRate = totalDuration === 0 ? 0 : Math.round((completedDuration / totalDuration) * 100)

  const baseClass = state.darkMode
    ? 'min-h-screen bg-slate-950 text-slate-100'
    : 'min-h-screen bg-gradient-to-br from-fuchsia-50 via-cyan-50 to-violet-100 text-slate-900'

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
      }),
    })
    if (!res.ok) console.error(`Failed to persist task ${taskId}: ${res.status}`)
  }

  const createTaskRemote = async () => {
    const response = await fetch(`/api/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New CPM Node',
        description: '',
        status: 'todo',
        durationDays: 1,
        assigneeId: state.currentUserId,
      }),
    })
    if (response.ok) {
      const data = await response.json()
      dispatch({
        type: 'updateTask',
        taskId: data.task.id,
        patch: {},
      })
      window.location.reload()
    } else {
      console.error(`Failed to create task: ${response.status}`)
    }
  }

  const createProjectRemote = async () => {
    const name = prompt('Enter project name:')
    if (!name) return
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (response.ok) {
      const data = await response.json()
      dispatch({ type: 'addProject', project: data.project })
      dispatch({ type: 'switchProject', projectId: data.project.id })
    } else {
      console.error(`Failed to create project: ${response.status}`)
    }
  }

  return (
    <main className={state.darkMode ? 'min-h-screen bg-slate-900 text-slate-100' : 'min-h-screen bg-slate-50 text-slate-900'}>
      <header className={state.darkMode ? 'rounded-3xl border border-violet-700/40 bg-slate-900/80 p-5 shadow-xl backdrop-blur' : 'rounded-3xl border border-white/60 bg-white/70 p-5 shadow-xl backdrop-blur'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">XTASKS</h1>
            <p className="text-sm opacity-80">Shared critical-path project cockpit for high-velocity teams.</p>
          </div>
          <div className="flex flex-row items-center gap-3">
            <select
              value={state.activeProjectId}
              onChange={(event) => dispatch({ type: 'switchProject', projectId: event.target.value })}
              className="h-9 rounded-xl border bg-transparent px-3 text-sm font-semibold"
            >
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <button className="h-9 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition hover:scale-105" type="button" onClick={createProjectRemote}>
              New Project
            </button>
            {canManageProject && (
              <button className="flex h-9 flex-row items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition hover:scale-105" type="button" onClick={createTaskRemote}>
                <PlusIcon />
                Create Task
              </button>
            )}
            <select
              value={state.currentUserId}
              onChange={(event) => dispatch({ type: 'switchUser', userId: event.target.value })}
              className="h-9 rounded-xl border bg-transparent px-3 text-sm font-semibold"
            >
              {state.users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
              ))}
            </select>
            <button className="h-9 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition hover:scale-105" type="button" onClick={() => dispatch({ type: 'toggleTheme' })}>
              {state.darkMode ? 'Light' : 'Dark'} Mode
            </button>
            <button className="h-9 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition hover:scale-105" type="button" onClick={() => signOut({ callbackUrl: '/login' })}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={state.darkMode ? 'rounded-2xl border border-emerald-600/30 bg-emerald-950/30 p-4 shadow-lg' : 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-lg'}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-75">Project Timeline</p>
          <p className="mt-1 text-3xl font-black">{criticalPath.totalDuration} days</p>
          <p className="mt-1 text-sm opacity-80">Critical chain: {criticalPath.chain.map((id) => state.tasks.find((task) => task.id === id)?.title ?? id).join(' -> ') || 'N/A'}</p>
        </article>
        <article className={state.darkMode ? 'rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 shadow-lg' : 'rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 shadow-lg'}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-75">Shared Progress</p>
          <p className="mt-1 text-3xl font-black">{completionRate}%</p>
          <div className="h-2 rounded-full bg-black/10">
            <div className="h-2 rounded-full bg-cyan-500 transition-all duration-500" style={{ width: `${completionRate}%` }} />
          </div>
        </article>
        <article className={state.darkMode ? 'rounded-2xl border border-violet-500/30 bg-violet-950/30 p-4 shadow-lg' : 'rounded-2xl border border-violet-200 bg-violet-50/80 p-4 shadow-lg'}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-75">Current Role</p>
          <p className="mt-1 text-2xl font-black">{currentUser?.role === 'owner' ? 'Project Owner' : currentUser?.role === 'lead' ? 'Team Lead Controls' : 'Member Task Focus'}</p>
          <p className="mt-1 text-sm opacity-80">{currentUser?.role === 'owner' ? 'Full project control, manage members and settings.' : currentUser?.role === 'lead' ? 'Create nodes, wire dependencies, assign ownership.' : 'Edit assigned tasks, update progress, flag blockers.'}</p>
        </article>
      </section>

      <section className={state.darkMode ? 'overflow-auto rounded-3xl border border-violet-700/40 bg-slate-900/70 p-4 shadow-xl' : 'overflow-auto rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl'}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wider opacity-70">CPM Dependency Graph</p>
          <p className="text-xs opacity-70">Start -&gt; Sequence -&gt; End</p>
        </div>
        <div className="relative min-h-[620px] min-w-[980px] rounded-2xl border border-dashed border-cyan-300/50 bg-gradient-to-br from-transparent via-cyan-500/5 to-violet-500/10 p-2">
          <div className="absolute left-4 top-4 rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-white">START</div>
          <div className="absolute right-4 top-4 rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white">END</div>
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <marker id="arrow-cpm" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0 0 L7 3 L0 6z" fill={state.darkMode ? '#22d3ee' : '#0e7490'} />
              </marker>
            </defs>
            {state.tasks.flatMap((task) =>
              task.dependencyIds.map((depId) => {
                const from = graphNodes[depId]
                const to = graphNodes[task.id]
                if (!from || !to) return null
                const sx = from.x + 220
                const sy = from.y + 60
                const ex = to.x
                const ey = to.y + 60
                return (
                  <path
                    key={`${depId}-${task.id}`}
                    d={`M ${sx} ${sy} C ${sx + 80} ${sy}, ${ex - 80} ${ey}, ${ex} ${ey}`}
                    stroke={state.darkMode ? '#22d3ee' : '#06b6d4'}
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow-cpm)"
                  />
                )
              }),
            )}
          </svg>

          {state.tasks.map((task) => {
            const userCanEditTask = canManageProject || task.assigneeId === currentUser?.id
            const locked = taskLocked(task, state.tasks)
            const isCritical = criticalPath.chain.includes(task.id)

            const nodeStateClass = task.status === 'done'
              ? 'border-emerald-300 bg-emerald-100 text-emerald-900 shadow-emerald-200 animate-pulse'
              : task.status === 'blocked'
              ? 'border-red-300 bg-red-100 text-red-900'
              : locked
              ? 'border-slate-300 bg-slate-200 text-slate-500'
              : 'border-cyan-300 bg-white/90 text-slate-900'

            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => dispatch({ type: 'openTask', taskId: task.id })}
                onKeyDown={(e) => e.key === 'Enter' && dispatch({ type: 'openTask', taskId: task.id })}
                className={`absolute w-[220px] cursor-pointer rounded-2xl border-2 p-3 text-left shadow-lg backdrop-blur transition duration-200 hover:-translate-y-1 hover:scale-[1.01] ${nodeStateClass} ${isCritical ? 'ring-2 ring-fuchsia-400' : ''}`}
                style={{ left: graphNodes[task.id]?.x ?? 100, top: graphNodes[task.id]?.y ?? 100 }}
              >
                <div className="mb-1 flex items-start justify-between gap-1">
                  <p className="line-clamp-2 text-sm font-extrabold">{task.title}</p>
                  {task.status === 'blocked' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      <FlagIcon />
                      Blocked
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-80">Owner: {state.users.find((u) => u.id === task.assigneeId)?.name ?? 'Unassigned'}</p>
                <p className="text-xs opacity-80">Duration: {task.duration}d</p>
                <p className="text-xs opacity-80">Depends on: {task.dependencyIds.length}</p>
                <div className="mt-2 flex flex-col gap-1">
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase w-fit">{task.status.replace('_', ' ')}</span>
                  {locked ? (
                    <span className="text-xs font-semibold opacity-60">🔒 Locked — complete dependencies first</span>
                  ) : (
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.status === 'in_progress'}
                          disabled={!userCanEditTask || task.status === 'done'}
                          onChange={() => {
                            const next: TaskStatus = task.status === 'in_progress' ? 'todo' : 'in_progress'
                            dispatch({ type: 'updateTask', taskId: task.id, patch: { status: next } })
                            void persistTask(task.id, { status: next })
                          }}
                        />
                        In Progress
                      </label>
                      <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          disabled={!userCanEditTask}
                          onChange={() => {
                            const next: TaskStatus = task.status === 'done' ? 'in_progress' : 'done'
                            dispatch({ type: 'updateTask', taskId: task.id, patch: { status: next } })
                            void persistTask(task.id, { status: next })
                          }}
                        />
                        Done
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {selectedTask && (
        <TaskModal
          state={state}
          task={selectedTask}
          canEdit={canManageProject || selectedTask.assigneeId === currentUser?.id}
          onClose={() => dispatch({ type: 'openTask', taskId: null })}
          dispatch={dispatch}
          onPatchTask={(taskId, patch) => {
            void persistTask(taskId, patch)
          }}
        />
      )}
    </main>
  )
}