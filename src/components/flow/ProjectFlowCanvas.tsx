'use client'

import '@xyflow/react/dist/style.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const childrenById = new Map<string, string[]>()
  for (const task of tasks) {
    childrenById.set(task.id, [])
  }
  for (const task of tasks) {
    for (const depId of task.dependencyIds) {
      const children = childrenById.get(depId)
      if (children) children.push(task.id)
    }
  }

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

  const baseLevelById = { ...levelById }

  const longestPathById: Record<string, number> = {}
  const longestVisiting = new Set<string>()
  const getLongestPath = (taskId: string): number => {
    if (longestPathById[taskId] !== undefined) return longestPathById[taskId]
    if (longestVisiting.has(taskId)) {
      longestPathById[taskId] = 1
      return 1
    }
    longestVisiting.add(taskId)
    const children = (childrenById.get(taskId) ?? []).filter((childId) => taskById.has(childId))
    const childLongest = children.length > 0 ? Math.max(...children.map((childId) => getLongestPath(childId))) : 0
    longestPathById[taskId] = childLongest + 1
    longestVisiting.delete(taskId)
    return longestPathById[taskId]
  }
  for (const task of tasks) {
    getLongestPath(task.id)
  }

  // Compact merge inputs: promote shallow dependencies closer to their child level.
  // Example: 1->2->3->4 and 5->4 => move 5 close to 3's column.
  let changed = true
  while (changed) {
    changed = false
    for (const task of tasks) {
      const taskLevel = levelById[task.id] ?? 0
      if (task.dependencyIds.length <= 1) continue
      const desiredDependencyLevel = Math.max(0, taskLevel - 1)
      for (const depId of task.dependencyIds) {
        const dep = tasks.find((t) => t.id === depId)
        if (!dep) continue
        const currentLevel = levelById[dep.id] ?? 0
        if (currentLevel < desiredDependencyLevel) {
          levelById[dep.id] = desiredDependencyLevel
          changed = true
        }
      }
    }

    // Re-validate DAG level constraints after promotion.
    for (const task of tasks) {
      const maxDep = task.dependencyIds.length
        ? Math.max(...task.dependencyIds.map((depId) => levelById[depId] ?? 0))
        : -1
      const required = maxDep + 1
      if ((levelById[task.id] ?? 0) < required) {
        levelById[task.id] = required
        changed = true
      }
    }
  }

  const byLevel: Record<number, TaskNode[]> = {}
  for (const task of tasks) {
    const level = levelById[task.id] ?? 0
    byLevel[level] = [...(byLevel[level] ?? []), task]
  }
  const sortedLevels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b)

  const laneById = new Map<string, number>()
  const usedLaneByLevel = new Map<number, Set<number>>()
  let nextFreeLane = 0
  const reserveLane = (level: number, lane: number): number => {
    const used = usedLaneByLevel.get(level) ?? new Set<number>()
    let finalLane = lane
    while (used.has(finalLane)) finalLane += 1
    used.add(finalLane)
    usedLaneByLevel.set(level, used)
    return finalLane
  }

  const taskSort = (a: TaskNode, b: TaskNode) =>
    (longestPathById[b.id] ?? 1) - (longestPathById[a.id] ?? 1) ||
    (baseLevelById[b.id] ?? 0) - (baseLevelById[a.id] ?? 0) ||
    a.title.localeCompare(b.title)

  for (const level of sortedLevels) {
    const levelTasks = [...(byLevel[level] ?? [])].sort(taskSort)
    for (const task of levelTasks) {
      if (task.dependencyIds.length === 0) {
        const lane = reserveLane(level, nextFreeLane)
        laneById.set(task.id, lane)
        nextFreeLane = Math.max(nextFreeLane, lane + 1)
        continue
      }

      const depLanes = task.dependencyIds
        .map((depId) => laneById.get(depId))
        .filter((lane): lane is number => lane != null)

      let preferredLane = nextFreeLane
      if (depLanes.length === 1) {
        preferredLane = depLanes[0]
      } else if (depLanes.length > 1) {
        const minDepLane = Math.min(...depLanes)
        const maxDepLane = Math.max(...depLanes)
        preferredLane = (minDepLane + maxDepLane) / 2
      }

      const lane = reserveLane(level, preferredLane)
      laneById.set(task.id, lane)
      nextFreeLane = Math.max(nextFreeLane, lane + 1)
    }
    byLevel[level] = levelTasks
  }

  const gapX = 360
  const gapY = 200
  const pos: Record<string, { x: number; y: number }> = {}
  for (const level of sortedLevels) {
    const levelTasks = byLevel[level] ?? []
    for (const task of levelTasks) {
      const lane = laneById.get(task.id) ?? 0
      pos[task.id] = {
        x: 40 + level * gapX,
        y: 40 + lane * gapY,
      }
    }
  }

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
  interactionLocked: boolean
  canToggleInteractionLock: boolean
  onToggleInteractionLock: (locked: boolean) => void
  currentUserId: string
  assigneeNames: (ids: string[]) => string
  onSelectTask: (id: string | null) => void
  onPersistPosition: (taskId: string, x: number, y: number) => void
  onQuickAddChild: (parentId: string) => void
  onCreateTaskAt: (x: number, y: number) => void
  onAutoLayout: (positions: Record<string, { x: number; y: number }>) => void
  onClearAll: () => void
  onToggleDone: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onDependencyChange: (taskId: string, nextDependencyIds: string[]) => void
}

function FlowInner({
  tasks,
  darkMode,
  criticalIds,
  canManageProject,
  interactionLocked,
  canToggleInteractionLock,
  onToggleInteractionLock,
  currentUserId,
  assigneeNames,
  onSelectTask,
  onPersistPosition,
  onQuickAddChild,
  onCreateTaskAt,
  onAutoLayout,
  onClearAll,
  onToggleDone,
  onDeleteTask,
  onDependencyChange,
}: Props) {
  const { screenToFlowPosition } = useReactFlow()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragEnabled = !interactionLocked
  const canUseCanvasContextMenu = canManageProject && !interactionLocked
  const dependencyWriteEnabled = canManageProject && !interactionLocked

  const [menu, setMenu] = useState<{
    x: number
    y: number
    flowX: number
    flowY: number
  } | null>(null)

  const cb = useRef({
    onSelectTask,
    onPersistPosition,
    onQuickAddChild,
    onCreateTaskAt,
    onAutoLayout,
    onClearAll,
    onToggleDone,
    onDeleteTask,
    onDependencyChange,
  })
  useEffect(() => {
    cb.current = {
      onSelectTask,
      onPersistPosition,
      onQuickAddChild,
      onCreateTaskAt,
      onAutoLayout,
      onClearAll,
      onToggleDone,
      onDeleteTask,
      onDependencyChange,
    }
  })

  const fallback = useMemo(() => layoutFallback(tasks), [tasks])

  const initialNodes: Node<TaskFlowData>[] = useMemo(() => {
    return tasks.map((task) => {
      const locked = taskLocked(task, tasks)
      const baseCanEdit = canManageProject || task.assigneeIds.includes(currentUserId)
      const canEdit = !interactionLocked && baseCanEdit
      const canToggleDone = baseCanEdit
      const canDelete = !interactionLocked && baseCanEdit
      const canQuickAdd = canManageProject && !interactionLocked
      const pos =
        task.positionX != null && task.positionY != null
          ? { x: task.positionX, y: task.positionY }
          : fallback[task.id] ?? { x: 40, y: 40 }

      return {
        id: task.id,
        type: 'taskNode',
        position: pos,
        draggable: canEdit,
        data: {
          title: task.title,
          duration: task.duration,
          status: task.status,
          assigneeLabel: assigneeNames(task.assigneeIds),
          locked,
          isCritical: criticalIds.has(task.id),
          canEdit,
          canToggleDone,
          canDelete,
          canQuickAdd,
          darkMode,
          onOpen: () => cb.current.onSelectTask(task.id),
          onAddChild: () => cb.current.onQuickAddChild(task.id),
          onToggleDone: () => cb.current.onToggleDone(task.id),
          onDelete: () => cb.current.onDeleteTask(task.id),
        },
      }
    })
  }, [tasks, fallback, criticalIds, canManageProject, currentUserId, darkMode, assigneeNames, interactionLocked])

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
      if (!dependencyWriteEnabled) return
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
    [dependencyWriteEnabled, tasks],
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

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    cb.current.onSelectTask(node.id)
  }, [])

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      if (!canUseCanvasContextMenu) return
      event.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setMenu({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        flowX: flowPoint.x,
        flowY: flowPoint.y,
      })
    },
    [canUseCanvasContextMenu, screenToFlowPosition],
  )

  return (
    <div
      ref={containerRef}
      className={darkMode ? 'relative h-[72vh] min-h-[520px] rounded-3xl border border-violet-700/40 bg-slate-950' : 'relative h-[72vh] min-h-[520px] rounded-3xl border border-white/60 bg-white/50'}
      onClick={() => setMenu(null)}
      onContextMenuCapture={(event) => {
        if (!canUseCanvasContextMenu) {
          event.preventDefault()
          setMenu(null)
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={dependencyWriteEnabled ? onEdgesDelete : undefined}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setMenu(null)}
        nodeTypes={nodeTypes}
        nodesDraggable={dragEnabled}
        nodesConnectable={dependencyWriteEnabled}
        edgesReconnectable={dependencyWriteEnabled}
        elementsSelectable
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color={darkMode ? '#334155' : '#cbd5e1'} />
        <Controls
          showInteractive={canToggleInteractionLock}
          onInteractiveChange={(interactive) => {
            if (!canToggleInteractionLock) return
            onToggleInteractionLock(!interactive)
          }}
          className={
            darkMode
              ? '!rounded-2xl !border !border-slate-700 !bg-slate-900/95 !shadow-lg [&>button]:!border-slate-700 [&>button]:!bg-slate-900 [&>button]:!text-slate-100 [&>button:hover]:!bg-slate-800'
              : '!rounded-2xl !border !border-cyan-200/60 !bg-white/90 !shadow-lg [&>button]:!border-cyan-200/60 [&>button]:!bg-white [&>button]:!text-slate-800 [&>button:hover]:!bg-cyan-50'
          }
        />
        <MiniMap
          className={
            darkMode
              ? '!rounded-2xl !border !border-slate-700 !bg-slate-900/95'
              : '!rounded-2xl !border !border-fuchsia-200/60 !bg-white/90'
          }
          nodeStrokeWidth={3}
          style={{ backgroundColor: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.92)' }}
          maskColor={darkMode ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.65)'}
        />
      </ReactFlow>
      {menu && canUseCanvasContextMenu && (
        <div
          className={darkMode ? 'absolute z-30 w-48 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl' : 'absolute z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl'}
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={!canUseCanvasContextMenu}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (!canUseCanvasContextMenu) return
              cb.current.onCreateTaskAt(menu.flowX, menu.flowY)
              setMenu(null)
            }}
          >
            Create task here
          </button>
          <button
            type="button"
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-cyan-500/10"
            onClick={() => {
              cb.current.onAutoLayout(layoutFallback(tasks))
              setMenu(null)
            }}
          >
            Auto layout
          </button>
          <button
            type="button"
            disabled={interactionLocked}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
            onClick={() => {
              if (interactionLocked) return
              cb.current.onClearAll()
              setMenu(null)
            }}
          >
            Clear all
          </button>
        </div>
      )}
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
