type ProjectEvent = {
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'member_removed' | 'member_role_updated' | 'interaction_lock_updated'
  taskId: string
  removedUserId?: string
  interactionLocked?: boolean
  at: number
}

type Listener = (event: ProjectEvent) => void

type RealtimeState = {
  listenersByProjectId: Map<string, Set<Listener>>
}

const globalState = globalThis as unknown as {
  xtasksRealtime?: RealtimeState
}

function state(): RealtimeState {
  if (!globalState.xtasksRealtime) {
    globalState.xtasksRealtime = {
      listenersByProjectId: new Map(),
    }
  }
  return globalState.xtasksRealtime
}

export function subscribeProjectEvents(projectId: string, listener: Listener) {
  const listeners = state().listenersByProjectId.get(projectId) ?? new Set<Listener>()
  listeners.add(listener)
  state().listenersByProjectId.set(projectId, listeners)

  return () => {
    const rows = state().listenersByProjectId.get(projectId)
    if (!rows) return
    rows.delete(listener)
    if (rows.size === 0) {
      state().listenersByProjectId.delete(projectId)
    }
  }
}

export function publishProjectEvent(projectId: string, event: ProjectEvent) {
  const listeners = state().listenersByProjectId.get(projectId)
  if (!listeners || listeners.size === 0) return
  for (const listener of listeners) {
    listener(event)
  }
}
