import { Task, Dependency } from '@prisma/client'

type GraphTask = Pick<Task, 'id'>
type GraphDep = Pick<Dependency, 'taskId' | 'dependsOnTaskId'>

export function wouldCreateCycle(tasks: GraphTask[], dependencies: GraphDep[], taskId: string, dependsOnTaskId: string): boolean {
  if (taskId === dependsOnTaskId) return true
  const outgoing = new Map<string, string[]>()
  for (const task of tasks) outgoing.set(task.id, [])
  for (const dep of dependencies) {
    const list = outgoing.get(dep.taskId) ?? []
    list.push(dep.dependsOnTaskId)
    outgoing.set(dep.taskId, list)
  }
  const newList = outgoing.get(taskId) ?? []
  newList.push(dependsOnTaskId)
  outgoing.set(taskId, newList)

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const next = outgoing.get(id) ?? []
    for (const n of next) {
      if (dfs(n)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return tasks.some((t) => dfs(t.id))
}
