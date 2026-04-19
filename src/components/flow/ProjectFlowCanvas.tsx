'use client'

import '@xyflow/react/dist/style.css'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import { dependencyGraphIsAcyclic } from '../../lib/cpm'
import { TaskFlowNode, type TaskFlowData } from './TaskFlowNode'
import type { TaskNode } from '../task-types'

const nodeTypes = { taskNode: TaskFlowNode }

function layoutFallback(tasks: TaskNode[]) {
  const levelById: Record<string, number> = {}
  const visiting = new Set<string>()
  const getLevel = (task: TaskNode): number => {
    if (levelById[task.id] !== undefined) return levelById[task.id]
    if (visiting.has(task.id)) {
      levelById[task.id] = 0
      return 0
    }
    visiting.add(task.id)
    if (task.dependencyIds.length === 0) {
      levelById[task.id] = 0
      visiting.delete(task.id)
      return 0
    }
    const deps = task.dependencyIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as TaskNode[]
    const maxDep = deps.length ? Math.max(...deps.map((d) => getLevel(d))) : 0
    levelById[task.id] = maxDep + 1
    visiting.delete(task.id)
    return levelById[task.id]
  }
  tasks.forEach((t) => getLevel(t))

  const byLevel: Record<number, TaskNode[]> = {}
  for (const t of tasks) {
    const lv = levelById[t.id] ?? 0
    byLevel[lv] = [...(byLevel[lv] ?? []), t]
  }
  const gapX = 280
  const gapY = 200
  const pos: Record<string, { x: number; y: number }> = {}
  Object.entries(byLevel).forEach(([lv, arr]) => {
    const level = Number(lv)
    arr.forEach((task, idx) => {
      pos[task.id] = { x: 40 + level * gapX, y: 40 + idx * gapY }
    })
  })
  return pos
}

function taskLocked(task: TaskNode, tasks: TaskNode[]) {
  if (task.dependencyIds.length === 0) return false
  return task.dependencyIds.some((depId) => {
    const dep = tasks.find((t) => t.id === depId)
    return !dep || dep.status !== 'done'
  })
}

type Props = {
  tasks: TaskNode[]
  darkMode: boolean
  criticalIds: Set<string>
  canManageProject: boolean
  currentUserId: string
  assigneeName: (id: string) => string
  onSelectTask: (id: string | null) => void
  onPersistPosition: (taskId: string, x: number, y: number) => void
  onQuickAddChild: (parentId: string) => void
  onToggleDone: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onDependencyChange: (taskId: string, nextDependencyIds: string[]) => void
}

function FlowInner({
  tasks,
  darkMode,
  criticalIds,
  canManageProject,
  currentUserId,
  assigneeName,
  onSelectTask,
  onPersistPosition,
  onQuickAddChild,
  onToggleDone,
  onDeleteTask,
  onDependencyChange,
}: Props) {
  const cb = useRef({
    onSelectTask,
    onPersistPosition,
    onQuickAddChild,
    onToggleDone,
    onDeleteTask,
    onDependencyChange,
  })
  useEffect(() => {
    cb.current = {
      onSelectTask,
      onPersistPosition,
      onQuickAddChild,
      onToggleDone,
      onDeleteTask,
      onDependencyChange,
    }
  })

  const fallback = useMemo(() => layoutFallback(tasks), [tasks])

  const initialNodes: Node<TaskFlowData>[] = useMemo(() => {
    return tasks.map((task) => {
      const locked = taskLocked(task, tasks)
      const canEdit = canManageProject || task.assigneeId === currentUserId
      const canQuickAdd = canManageProject
      const pos =
        task.positionX != null && task.positionY != null
          ? { x: task.positionX, y: task.positionY }
          : fallback[task.id] ?? { x: 40, y: 40 }

      return {
        id: task.id,
        type: 'taskNode',
        position: pos,
        data: {
          title: task.title,
          duration: task.duration,
          status: task.status,
          assigneeLabel: assigneeName(task.assigneeId),
          locked,
          isCritical: criticalIds.has(task.id),
          canEdit,
          canQuickAdd,
          darkMode,
          onOpen: () => cb.current.onSelectTask(task.id),
          onAddChild: () => cb.current.onQuickAddChild(task.id),
          onToggleDone: () => cb.current.onToggleDone(task.id),
          onDelete: () => cb.current.onDeleteTask(task.id),
        },
      }
    })
  }, [tasks, fallback, criticalIds, canManageProject, currentUserId, darkMode, assigneeName])

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []
    for (const task of tasks) {
      for (const depId of task.dependencyIds) {
        if (!tasks.some((t) => t.id === depId)) continue
        const crit = criticalIds.has(task.id) && criticalIds.has(depId)
        edges.push({
          id: `${depId}->${task.id}`,
          source: depId,
          target: task.id,
          sourceHandle: 'out',
          animated: crit,
          style: { stroke: crit ? '#d946ef' : '#06b6d4', strokeWidth: crit ? 3 : 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: crit ? '#d946ef' : '#06b6d4' },
        })
      }
    }
    return edges
  }, [tasks, criticalIds])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const childId = connection.target
      const parentId = connection.source
      const child = tasks.find((t) => t.id === childId)
      if (!child || child.id === parentId) return
      const next = Array.from(new Set([...child.dependencyIds, parentId]))
      const trial = tasks.map((t) => (t.id === childId ? { ...t, dependencyIds: next } : t))
      if (!dependencyGraphIsAcyclic(trial.map((t) => ({ id: t.id, dependencyIds: t.dependencyIds })))) return
      cb.current.onDependencyChange(childId, next)
    },
    [tasks],
  )

  const onEdgesDelete = useCallback(
    (toRemove: Edge[]) => {
      for (const edge of toRemove) {
        const childId = edge.target
        const parentId = edge.source
        const child = tasks.find((t) => t.id === childId)
        if (!child) continue
        const next = child.dependencyIds.filter((id) => id !== parentId)
        cb.current.onDependencyChange(childId, next)
      }
    },
    [tasks],
  )

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    cb.current.onPersistPosition(node.id, node.position.x, node.position.y)
  }, [])

  return (
    <div className={darkMode ? 'h-[72vh] min-h-[520px] rounded-3xl border border-violet-700/40 bg-slate-950' : 'h-[72vh] min-h-[520px] rounded-3xl border border-white/60 bg-white/50'}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={canManageProject ? onEdgesDelete : undefined}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        nodesConnectable={canManageProject}
        edgesReconnectable={canManageProject}
        elementsSelectable
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color={darkMode ? '#334155' : '#cbd5e1'} />
        <Controls className="!rounded-2xl !border !border-cyan-200/60 !bg-white/90 !shadow-lg" />
        <MiniMap
          className="!rounded-2xl !border !border-fuchsia-200/60"
          nodeStrokeWidth={3}
          maskColor={darkMode ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.65)'}
        />
      </ReactFlow>
    </div>
  )
}

export default function ProjectFlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  )
}
