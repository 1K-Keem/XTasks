/**
 * Critical Path Method (CPM) for tasks with finish-to-start dependencies.
 * Edge: successor depends on predecessor => predecessor must finish before successor starts.
 */

export type CpmTaskInput = {
  id: string
  duration: number
  /** Task IDs this task depends on (predecessors). */
  dependencyIds: string[]
}

export type CpmResult = {
  /** Sum of durations of completed tasks / sum of all task durations (0–100). */
  progressByDurationPercent: number
  /** Calendar length of the critical path (max EF). */
  projectDuration: number
  /** Task IDs on the critical path (zero slack). */
  criticalTaskIds: Set<string>
  /** Early finish per task. */
  earlyFinish: Record<string, number>
  /** Late start per task. */
  lateStart: Record<string, number>
  /** Slack per task (LS - ES, same as LF - EF). */
  slack: Record<string, number>
}

export function dependencyGraphIsAcyclic(tasks: { id: string; dependencyIds: string[] }[]): boolean {
  const ids = new Set(tasks.map((t) => t.id))
  const preds = new Map<string, string[]>()
  for (const t of tasks) {
    preds.set(t.id, (t.dependencyIds ?? []).filter((p) => ids.has(p) && p !== t.id))
  }
  return topologicalOrder(ids, preds) !== null
}

function topologicalOrder(ids: Set<string>, preds: Map<string, string[]>): string[] | null {
  const indeg = new Map<string, number>()
  for (const id of ids) indeg.set(id, 0)
  for (const id of ids) {
    for (const p of preds.get(id) ?? []) {
      if (!ids.has(p)) return null
      indeg.set(id, (indeg.get(id) ?? 0) + 1)
    }
  }
  const q: string[] = []
  for (const [id, d] of indeg) if (d === 0) q.push(id)
  const out: string[] = []
  while (q.length) {
    const n = q.shift()!
    out.push(n)
    for (const m of ids) {
      if ((preds.get(m) ?? []).includes(n)) {
        const next = (indeg.get(m) ?? 0) - 1
        indeg.set(m, next)
        if (next === 0) q.push(m)
      }
    }
  }
  if (out.length !== ids.size) return null
  return out
}

export function computeCPM(tasks: CpmTaskInput[], completedTaskIds: Set<string>): CpmResult {
  const ids = new Set(tasks.map((t) => t.id))
  const duration = new Map(tasks.map((t) => [t.id, Math.max(0, t.duration)]))
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const id of ids) {
    preds.set(id, [])
    succs.set(id, [])
  }
  for (const t of tasks) {
    const list = (t.dependencyIds ?? []).filter((p) => ids.has(p) && p !== t.id)
    preds.set(t.id, list)
    for (const p of list) {
      succs.get(p)!.push(t.id)
    }
  }

  const order = topologicalOrder(ids, preds)
  const earlyStart: Record<string, number> = {}
  const earlyFinish: Record<string, number> = {}

  if (!order) {
    return {
      progressByDurationPercent: 0,
      projectDuration: 0,
      criticalTaskIds: new Set(),
      earlyFinish: {},
      lateStart: {},
      slack: {},
    }
  }

  for (const id of order) {
    const dur = duration.get(id) ?? 0
    const ps = preds.get(id) ?? []
    const es = ps.length === 0 ? 0 : Math.max(...ps.map((p) => earlyFinish[p] ?? 0))
    earlyStart[id] = es
    earlyFinish[id] = es + dur
  }

  let projectEnd = 0
  for (const id of ids) projectEnd = Math.max(projectEnd, earlyFinish[id] ?? 0)

  const lateFinish: Record<string, number> = {}
  const lateStart: Record<string, number> = {}
  for (const id of ids) lateFinish[id] = projectEnd

  for (const id of [...order].reverse()) {
    const dur = duration.get(id) ?? 0
    const sc = succs.get(id) ?? []
    if (sc.length === 0) {
      lateFinish[id] = projectEnd
    } else {
      lateFinish[id] = Math.min(...sc.map((s) => lateStart[s] ?? projectEnd))
    }
    lateStart[id] = lateFinish[id] - dur
  }

  const slack: Record<string, number> = {}
  const critical = new Set<string>()
  for (const id of ids) {
    const es = earlyStart[id] ?? 0
    const ls = lateStart[id] ?? 0
    const sl = ls - es
    slack[id] = sl
    if (Math.abs(sl) < 1e-6) critical.add(id)
  }

  const totalDur = tasks.reduce((s, t) => s + Math.max(0, t.duration), 0)
  const doneDur = tasks.filter((t) => completedTaskIds.has(t.id)).reduce((s, t) => s + Math.max(0, t.duration), 0)
  const progressByDurationPercent = totalDur === 0 ? 0 : Math.round((doneDur / totalDur) * 100)

  return {
    progressByDurationPercent,
    projectDuration: projectEnd,
    criticalTaskIds: critical,
    earlyFinish,
    lateStart,
    slack,
  }
}
