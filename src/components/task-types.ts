export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

export type Subtask = {
  id: string
  title: string
  done: boolean
}

export type TaskNode = {
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
  positionX?: number | null
  positionY?: number | null
}
