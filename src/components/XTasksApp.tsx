'use client'

import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

type TaskNode = {
  id: string
  title: string
  description: string
  completed: boolean
  children: TaskNode[]
}

type TaskLink = {
  id: string
  from: string
  to: string
}

type HoverCardState = {
  taskId: string
  x: number
  y: number
  editable: boolean
}

type Point = {
  x: number
  y: number
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createTask = (title: string): TaskNode => ({
  id: createId(),
  title,
  description: '',
  completed: false,
  children: [],
})

function AddIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="xt-icon">
      <path d="M7 3h2v10H7z" fill="currentColor" />
      <path d="M3 7h10v2H3z" fill="currentColor" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="xt-icon">
      {collapsed ? <path d="M6 3l5 5-5 5V3z" fill="currentColor" /> : <path d="M3 6l5 5 5-5H3z" fill="currentColor" />}
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="xt-icon">
      <path d="M4.2 3.1 3.1 4.2 6.9 8l-3.8 3.8 1.1 1.1L8 9.1l3.8 3.8 1.1-1.1L9.1 8l3.8-3.8-1.1-1.1L8 6.9 4.2 3.1z" fill="currentColor" />
    </svg>
  )
}

function toggleTask(nodes: TaskNode[], id: string): TaskNode[] {
  const setSubtree = (node: TaskNode, completed: boolean): TaskNode => ({
    ...node,
    completed,
    children: node.children.map((child) => setSubtree(child, completed)),
  })

  const walk = (list: TaskNode[], depth: number): TaskNode[] => {
    return list.map((node) => {
      if (node.id === id) {
        const nextCompleted = !node.completed
        return depth === 0 ? setSubtree(node, nextCompleted) : { ...node, completed: nextCompleted }
      }

      if (node.children.length === 0) {
        return node
      }

      return { ...node, children: walk(node.children, depth + 1) }
    })
  }

  return walk(nodes, 0)
}

function removeTask(nodes: TaskNode[], id: string): TaskNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeTask(node.children, id) }))
}

function addRootTaskNode(nodes: TaskNode[], task: TaskNode): TaskNode[] {
  return [...nodes, task]
}

function addChildTaskNode(nodes: TaskNode[], parentId: string, task: TaskNode): TaskNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, task] }
    }

    if (node.children.length === 0) {
      return node
    }

    return { ...node, children: addChildTaskNode(node.children, parentId, task) }
  })
}

function renameTask(nodes: TaskNode[], id: string, title: string): TaskNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, title }
    }

    if (node.children.length === 0) {
      return node
    }

    return { ...node, children: renameTask(node.children, id, title) }
  })
}

function setTaskDescription(nodes: TaskNode[], id: string, description: string): TaskNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, description }
    }

    if (node.children.length === 0) {
      return node
    }

    return { ...node, children: setTaskDescription(node.children, id, description) }
  })
}

function findTaskById(nodes: TaskNode[], id: string): TaskNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }

    const child = findTaskById(node.children, id)
    if (child) {
      return child
    }
  }

  return null
}

function TaskTreeList({
  tasks,
  onToggle,
  onDelete,
  onAddRoot,
  onAddChild,
  onSetDescription,
  onHoverTaskStart,
  onHoverTaskEnd,
}: {
  tasks: TaskNode[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onAddRoot: () => void
  onAddChild: (parentId: string) => void
  onSetDescription: (id: string, description: string) => void
  onHoverTaskStart: (task: TaskNode, element: HTMLElement) => void
  onHoverTaskEnd: () => void
}) {
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({})
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Record<string, boolean>>({})

  const toggleCollapse = (id: string) => {
    setCollapsedRoots((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const openCollapse = (id: string) => {
    setCollapsedRoots((prev) => ({ ...prev, [id]: false }))
  }

  const toggleDescription = (id: string) => {
    setCollapsedDescriptions((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const renderNodes = (nodes: TaskNode[], level = 0): React.ReactNode => {
    return nodes.map((node) => (
      <li key={node.id} className="xt-row xt-sub-row" style={{ marginLeft: `${level * 12}px` }}>
        <div className="xt-row-main">
          <input type="checkbox" checked={node.completed} onChange={() => onToggle(node.id)} className="xt-check" spellCheck={false} />
          <button
            type="button"
            className={node.completed ? 'xt-task-done xt-title-btn' : 'xt-task-title xt-title-btn'}
            onClick={() => toggleCollapse(node.id)}
            onMouseEnter={(event) => onHoverTaskStart(node, event.currentTarget)}
            onMouseLeave={onHoverTaskEnd}
          >
            {node.title}
          </button>
        </div>
        <div className="xt-row-actions">
          <button
            onClick={() => {
              openCollapse(node.id)
              onAddChild(node.id)
            }}
            className="xt-mini-btn"
            type="button"
            title="Add subtask"
          >
            <AddIcon />
          </button>
          <button onClick={() => onDelete(node.id)} className="xt-mini-btn xt-danger xt-delete-btn" type="button" title="Delete">
            <DeleteIcon />
          </button>
          {node.children.length > 0 && (
            <button onClick={() => toggleCollapse(node.id)} className="xt-mini-btn" type="button" title="Collapse subtasks">
              <CollapseIcon collapsed={Boolean(collapsedRoots[node.id])} />
            </button>
          )}
          <button onClick={() => toggleDescription(node.id)} className="xt-mini-btn" type="button" title="Toggle description">
            Desc
          </button>
        </div>
        {!collapsedDescriptions[node.id] && (
          <textarea
            value={node.description}
            onChange={(event) => onSetDescription(node.id, event.target.value)}
            placeholder="Task description..."
            className="xt-desc-input"
            spellCheck={false}
          />
        )}
        {!collapsedRoots[node.id] && node.children.length > 0 && <ul className="xt-tree">{renderNodes(node.children, level + 1)}</ul>}
      </li>
    ))
  }

  return (
    <div className="xt-root-board">
      {tasks.map((root) => {
        const isCollapsed = Boolean(collapsedRoots[root.id])

        return (
          <article key={root.id} className={`xt-root-card ${root.completed ? 'xt-root-card-done' : ''}`}>
            <div className="xt-root-header">
              <div className="xt-row-main">
                <input type="checkbox" checked={root.completed} onChange={() => onToggle(root.id)} className="xt-check" spellCheck={false} />
                <button type="button" className={root.completed ? 'xt-task-done xt-title-btn' : 'xt-task-title xt-title-btn'} onClick={() => toggleCollapse(root.id)}>
                  {root.title}
                </button>
              </div>
              <div className="xt-row-actions">
                <button
                  onClick={() => {
                    openCollapse(root.id)
                    onAddChild(root.id)
                  }}
                  className="xt-mini-btn"
                  type="button"
                  title="Add subtask"
                >
                  <AddIcon />
                </button>
                <button onClick={() => onDelete(root.id)} className="xt-mini-btn xt-danger xt-delete-btn" type="button" title="Delete">
                  <DeleteIcon />
                </button>
                <button onClick={() => toggleCollapse(root.id)} className="xt-mini-btn" type="button" title="Collapse subtasks">
                  <CollapseIcon collapsed={isCollapsed} />
                </button>
                <button onClick={() => toggleDescription(root.id)} className="xt-mini-btn" type="button" title="Toggle description">
                  Desc
                </button>
              </div>
            </div>

            {!collapsedDescriptions[root.id] && (
              <textarea
                value={root.description}
                onChange={(event) => onSetDescription(root.id, event.target.value)}
                placeholder="Task description..."
                className="xt-desc-input"
                spellCheck={false}
              />
            )}

            {!isCollapsed && (
              <div className="xt-root-body">
                {root.children.length > 0 ? <ul className="xt-tree xt-root-children">{renderNodes(root.children, 1)}</ul> : <p className="xt-empty-note">No subtasks yet.</p>}
              </div>
            )}
          </article>
        )
      })}

      <button className="xt-root-add" type="button" onClick={onAddRoot} title="Add new task">
        <AddIcon />
      </button>
    </div>
  )
}

const seedTasks: TaskNode[] = []

export default function XTasksApp() {
  const { data: session } = useSession()
  const router = useRouter()
  const graphRef = useRef<HTMLDivElement | null>(null)
  const hoverHideTimer = useRef<number | null>(null)
  const [tasks, setTasks] = useState<TaskNode[]>(seedTasks)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'list' | 'visualize'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [visualWindowRootId, setVisualWindowRootId] = useState<string | null>(null)
  const [visualCollapsed, setVisualCollapsed] = useState<Record<string, boolean>>({})
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([])
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null)
  const [hoverCardEditMode, setHoverCardEditMode] = useState(false)
  const [tabMenu, setTabMenu] = useState<{ open: boolean; x: number; y: number; graphX: number; graphY: number }>({
    open: false,
    x: 0,
    y: 0,
    graphX: 30,
    graphY: 30,
  })
  const [linkDragging, setLinkDragging] = useState<{ fromId: string; x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const rowHeight = 130
  const colWidth = 260
  const graphHeight = Math.max(760, tasks.length * rowHeight + 160)

  // Load tasks on mount
  useEffect(() => {
    if (session?.user?.id) {
      loadTasks()
    }
  }, [session?.user?.id])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const [tasksResponse, positionsResponse, linksResponse] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/tasks/positions'),
        fetch('/api/tasks/links'),
      ])
      
      if (tasksResponse.ok) {
        const data = await tasksResponse.json()
        // Transform flat database tasks into tree structure
        const rootTasks = data.filter((t: any) => !t.parentId)
        setTasks(buildTaskTree(rootTasks, data))
      }
      
      if (positionsResponse.ok) {
        const positions = await positionsResponse.json()
        setNodePositions(positions)
      }
      
      if (linksResponse.ok) {
        const links = await linksResponse.json()
        setTaskLinks(links.map((link: any) => ({ id: link.id, from: link.fromId, to: link.toId })))
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePositions = async (positions: Record<string, Point>) => {
    try {
      await fetch('/api/tasks/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positions),
      })
    } catch (error) {
      console.error('Failed to save positions:', error)
    }
  }

  const saveLink = async (fromId: string, toId: string) => {
    try {
      await fetch('/api/tasks/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId }),
      })
    } catch (error) {
      console.error('Failed to save link:', error)
    }
  }

  const deleteLink = async (fromId: string, toId: string) => {
    try {
      await fetch('/api/tasks/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId }),
      })
    } catch (error) {
      console.error('Failed to delete link:', error)
    }
  }

  const buildTaskTree = (tasks: any[], allTasks: any[]): TaskNode[] => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      completed: task.completed,
      children: buildTaskTree(
        allTasks.filter((t: any) => t.parentId === task.id),
        allTasks
      ),
    }))
  }

  const handleLogout = async () => {
    await signOut({ redirect: true })
  }

  const defaultPoints = useMemo<Record<string, Point>>(() => {
    const map: Record<string, Point> = {}
    tasks.forEach((node, index) => {
      map[node.id] = {
        x: 70 + (index % 4) * colWidth,
        y: 40 + Math.floor(index / 4) * rowHeight,
      }
    })
    return map
  }, [tasks])

  const rootTasks = useMemo(() => tasks.map((task) => ({ id: task.id, title: task.title })), [tasks])

  const [nodePositions, setNodePositions] = useState<Record<string, Point>>({})

  useEffect(() => {
    setNodePositions((prev) => {
      const next: Record<string, Point> = {}
      tasks.forEach((node) => {
        next[node.id] = prev[node.id] ?? defaultPoints[node.id]
      })
      return next
    })
  }, [defaultPoints, tasks])

  useEffect(() => {
    const taskIdSet = new Set(tasks.map((task) => task.id))
    setTaskLinks((prev) => prev.filter((link) => taskIdSet.has(link.from) && taskIdSet.has(link.to)))
    setVisualWindowRootId((prev) => (prev && taskIdSet.has(prev) ? prev : null))
    setVisualCollapsed((prev) => {
      const next: Record<string, boolean> = {}
      Object.entries(prev).forEach(([id, value]) => {
        if (taskIdSet.has(id)) {
          next[id] = value
        }
      })
      return next
    })
  }, [tasks])

  useEffect(() => {
    return () => {
      if (hoverHideTimer.current) {
        window.clearTimeout(hoverHideTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!dragging) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const graph = graphRef.current
      if (!graph) {
        return
      }

      const rect = graph.getBoundingClientRect()
      const maxX = Math.max(8, graph.clientWidth - 180)
      const maxY = Math.max(8, graph.clientHeight - 90)

      const x = Math.min(maxX, Math.max(8, event.clientX - rect.left - dragging.offsetX))
      const y = Math.min(maxY, Math.max(8, event.clientY - rect.top - dragging.offsetY))

      setNodePositions((prev) => ({
        ...prev,
        [dragging.id]: { x, y },
      }))
    }

    const onPointerUp = () => {
      // Save the position to database
      setNodePositions((prev) => {
        savePositions(prev)
        return prev
      })
      setDragging(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging])

  useEffect(() => {
    if (!linkDragging) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const graph = graphRef.current
      if (!graph) {
        return
      }

      const rect = graph.getBoundingClientRect()
      setLinkDragging((prev) => (prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null))
    }

    const onPointerUp = () => {
      setLinkDragging(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [linkDragging])

  useEffect(() => {
    if (!tabMenu.open) {
      return
    }

    const closeMenu = () => {
      setTabMenu({ open: false, x: 0, y: 0, graphX: 30, graphY: 30 })
    }

    window.addEventListener('click', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
    }
  }, [tabMenu.open])

  const showHoverCard = (task: TaskNode, element: HTMLElement, editable = false) => {
    if (hoverHideTimer.current) {
      window.clearTimeout(hoverHideTimer.current)
      hoverHideTimer.current = null
    }

    const rect = element.getBoundingClientRect()
    const width = 300
    const x = Math.min(window.innerWidth - width - 12, rect.right + 14)

    setHoverCard({
      taskId: task.id,
      x: Math.max(12, x),
      y: Math.max(12, rect.top - 8),
      editable,
    })
    setHoverCardEditMode(false)
  }

  const hideHoverCard = () => {
    if (hoverHideTimer.current) {
      window.clearTimeout(hoverHideTimer.current)
    }

    hoverHideTimer.current = window.setTimeout(() => {
      setHoverCard(null)
      setHoverCardEditMode(false)
      hoverHideTimer.current = null
    }, 120)
  }

  const keepHoverCardOpen = () => {
    if (hoverHideTimer.current) {
      window.clearTimeout(hoverHideTimer.current)
      hoverHideTimer.current = null
    }
  }

  const addRootNew = async () => {
    const task = createTask('New')
    setTasks((prev) => addRootTaskNode(prev, task))
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, description: task.description }),
      })
      if (response.ok) {
        const savedTask = await response.json()
        // Update the local task with the server ID
        setTasks((prev) => {
          const updatedTasks = [...prev]
          updatedTasks[updatedTasks.length - 1].id = savedTask.id
          return updatedTasks
        })
      }
    } catch (error) {
      console.error('Failed to save task:', error)
    }
  }

  const addChildNew = async (parentId: string) => {
    const task = createTask('New')
    setTasks((prev) => addChildTaskNode(prev, parentId, task))
    setVisualCollapsed((prev) => ({ ...prev, [parentId]: false }))
    setVisualWindowRootId(parentId)
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, description: task.description, parentId }),
      })
      if (response.ok) {
        const savedTask = await response.json()
        // Update the local task with the server ID
        setTasks((prev) => {
          const updateIds = (nodes: TaskNode[]): TaskNode[] => {
            return nodes.map((node) => {
              if (node.id === task.id) {
                return { ...node, id: savedTask.id }
              }
              return { ...node, children: updateIds(node.children) }
            })
          }
          return updateIds(prev)
        })
      }
    } catch (error) {
      console.error('Failed to save child task:', error)
    }
  }

  const setDescription = async (id: string, description: string) => {
    setTasks((prev) => setTaskDescription(prev, id, description))
    
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
    } catch (error) {
      console.error('Failed to update description:', error)
    }
  }

  const toggle = async (id: string) => {
    // Get current task state to determine new completion status
    const findTask = (nodes: TaskNode[], targetId: string): TaskNode | null => {
      for (const node of nodes) {
        if (node.id === targetId) return node
        const found = findTask(node.children, targetId)
        if (found) return found
      }
      return null
    }
    const task = findTask(tasks, id)
    setTasks((prev) => toggleTask(prev, id))
    
    if (task) {
      try {
        await fetch(`/api/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !task.completed }),
        })
      } catch (error) {
        console.error('Failed to update task completion:', error)
      }
    }
  }

  const remove = async (id: string) => {
    setTasks((prev) => removeTask(prev, id))
    
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setEditingTitle(title)
  }

  const submitRename = async () => {
    const id = editingId
    const title = editingTitle.trim()

    if (!id) {
      return
    }

    if (!title) {
      setEditingId(null)
      setEditingTitle('')
      setHoverCard(null)
      setHoverCardEditMode(false)
      return
    }

    setTasks((prev) => renameTask(prev, id, title))
    
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    } catch (error) {
      console.error('Failed to rename task:', error)
    }
    
    setEditingId(null)
    setEditingTitle('')
    setHoverCard(null)
    setHoverCardEditMode(false)
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditingTitle('')
    setHoverCard(null)
    setHoverCardEditMode(false)
  }

  const addLinkByDrag = async (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) {
      return
    }

    const exists = taskLinks.some((link) => link.from === fromId && link.to === toId)
    if (exists) {
      return
    }

    setTaskLinks((prev) => [...prev, { id: createId(), from: fromId, to: toId }])
    await saveLink(fromId, toId)
  }

  const removeLink = async (id: string) => {
    const link = taskLinks.find(l => l.id === id)
    setTaskLinks((prev) => prev.filter((link) => link.id !== id))
    
    if (link) {
      await deleteLink(link.from, link.to)
    }
  }

  const toggleVisualCollapse = (id: string) => {
    setVisualCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const openVisualCollapse = (id: string) => {
    setVisualCollapsed((prev) => ({ ...prev, [id]: false }))
  }

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    const target = event.target as HTMLElement
    if (target.closest('button,input,textarea')) {
      return
    }

    const graph = graphRef.current
    if (!graph) {
      return
    }

    const rect = graph.getBoundingClientRect()
    const point = nodePositions[id] ?? defaultPoints[id]
    if (!point) {
      return
    }

    setDragging({
      id,
      offsetX: event.clientX - rect.left - point.x,
      offsetY: event.clientY - rect.top - point.y,
    })
  }

  const beginLinkDrag = (event: React.PointerEvent<HTMLButtonElement>, fromId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const graph = graphRef.current
    if (!graph) {
      return
    }

    const rect = graph.getBoundingClientRect()
    setLinkDragging({ fromId, x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  const onRootPointerUp = (targetId: string) => {
    if (!linkDragging) {
      return
    }

    addLinkByDrag(linkDragging.fromId, targetId)
    setLinkDragging(null)
  }

  const onVisualizeTabContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    const graph = graphRef.current
    if (!graph) {
      return
    }

    const rect = graph.getBoundingClientRect()
    const graphX = event.clientX - rect.left + graph.scrollLeft - 84
    const graphY = event.clientY - rect.top + graph.scrollTop - 26

    setTabMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      graphX: Math.max(8, graphX),
      graphY: Math.max(8, graphY),
    })
  }

  const clearAll = async () => {
    const taskIdsToDelete = tasks.map(task => task.id)
    
    setTasks([])
    setTaskLinks([])
    setNodePositions({})
    cancelRename()
    setTabMenu({ open: false, x: 0, y: 0, graphX: 30, graphY: 30 })
    
    // Delete all root tasks from database (this also deletes all children)
    try {
      for (const taskId of taskIdsToDelete) {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        })
      }
    } catch (error) {
      console.error('Failed to clear tasks from database:', error)
    }
  }

  const askAndAddRootFromMenu = async () => {
    const task = createTask('New')
    setTasks((prev) => [...prev, task])
    setNodePositions((prev) => ({ ...prev, [task.id]: { x: tabMenu.graphX, y: tabMenu.graphY } }))
    setEditingId(task.id)
    setEditingTitle('New')
    setTabMenu({ open: false, x: 0, y: 0, graphX: 30, graphY: 30 })
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, description: task.description }),
      })
      if (response.ok) {
        const savedTask = await response.json()
        // Update the local task with the server ID
        setTasks((prev) => {
          const updatedTasks = [...prev]
          const taskIndex = updatedTasks.findIndex(t => t.id === task.id)
          if (taskIndex >= 0) {
            updatedTasks[taskIndex].id = savedTask.id
          }
          return updatedTasks
        })
        setEditingId(savedTask.id)
      }
    } catch (error) {
      console.error('Failed to save task:', error)
    }
  }

  const renderVisualPanelNodes = (nodes: TaskNode[], level = 0): React.ReactNode => {
    return nodes.map((node) => {
      const collapsed = Boolean(visualCollapsed[node.id])

      return (
        <li key={node.id} className="xt-visual-row" style={{ marginLeft: `${level * 12}px` }}>
          <div className="xt-visual-row-main">
            <input type="checkbox" checked={node.completed} onChange={() => toggle(node.id)} className="xt-check" spellCheck={false} />
            {editingId === node.id ? (
              <input
                className="xt-inline-title-input xt-inline-visual"
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onBlur={submitRename}
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitRename()
                  }
                  if (event.key === 'Escape') {
                    cancelRename()
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                className={node.completed ? 'xt-task-done xt-title-btn' : 'xt-task-title xt-title-btn'}
                type="button"
                onClick={() => startRename(node.id, node.title)}
                onMouseEnter={(event) => showHoverCard(node, event.currentTarget, true)}
                onMouseLeave={hideHoverCard}
              >
                {node.title}
              </button>
            )}
          </div>
          <div className="xt-visual-row-actions">
            <button
              className="xt-mini-btn"
              type="button"
              onClick={() => {
                openVisualCollapse(node.id)
                addChildNew(node.id)
              }}
              title="Add subtask"
            >
              <AddIcon />
            </button>
            <button className="xt-mini-btn xt-danger xt-delete-btn" type="button" onClick={() => remove(node.id)} title="Delete">
              <DeleteIcon />
            </button>
            {node.children.length > 0 && (
              <button className="xt-mini-btn" type="button" onClick={() => toggleVisualCollapse(node.id)} title="Collapse subtasks">
                <CollapseIcon collapsed={collapsed} />
              </button>
            )}
          </div>
          {!collapsed && node.children.length > 0 && <ul className="xt-visual-tree">{renderVisualPanelNodes(node.children, level + 1)}</ul>}
        </li>
      )
    })
  }

  return (
    <main className="xt-page">
      <header className="xt-topbar">
        <button className="xt-logo" type="button">X</button>
        <div className="xt-brand">XTasks</div>
        <nav className="xt-top-actions">
          <button className={`xt-outline-btn ${activeTab === 'list' ? 'xt-tab-active' : ''}`} type="button" onClick={() => setActiveTab('list')}>
            List
          </button>
          <button className={`xt-outline-btn ${activeTab === 'visualize' ? 'xt-tab-active' : ''}`} type="button" onClick={() => setActiveTab('visualize')}>
            Visualize
          </button>
        </nav>
        <div className="xt-user-section">
          {session?.user && (
            <>
              <span className="xt-user-name">{session.user.name || session.user.email}</span>
              <button 
                onClick={handleLogout}
                className="xt-logout-btn"
                type="button"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      <p className="xt-subtitle">Manage your tasks with node visualization</p>

      {loading && <p className="xt-loading">Loading your tasks...</p>}

      {!loading && (
      <section className="xt-content xt-single">
        {activeTab === 'list' && (
          <div className="xt-panel">
            <h2>Task List</h2>
            <div className="xt-list-toolbar">
              <button type="button" className="xt-mini-btn xt-context-danger" onClick={clearAll}>
                Clear all
              </button>
            </div>
            {tasks.length === 0 && <p className="xt-empty-note">No tasks yet. Use the + button to create your first root task.</p>}
            <TaskTreeList
              tasks={tasks}
              onToggle={toggle}
              onDelete={remove}
              onAddRoot={addRootNew}
              onAddChild={addChildNew}
              onSetDescription={setDescription}
              onHoverTaskStart={showHoverCard}
              onHoverTaskEnd={hideHoverCard}
            />
          </div>
        )}

        {activeTab === 'visualize' && (
          <div className="xt-panel xt-panel-visual">
            <h2>Task Visualization</h2>
            <p className="xt-note">Right-click inside the workspace to open actions. Drag from the small circle on a root task to another root task to create a dependency link.</p>
            <div
              ref={graphRef}
              className="xt-graph"
              style={{ height: `${graphHeight}px` }}
              onContextMenu={onVisualizeTabContextMenu}
            >
              <svg className="xt-edges" width="100%" height="100%" aria-hidden>
                <defs>
                  <marker id="xt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 7 3 L 0 6 z" fill="#1e3a8a" />
                  </marker>
                  <marker id="xt-arrow-soft" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#4e75c4" />
                  </marker>
                  <linearGradient id="xt-link-gradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                {taskLinks.map((link) => {
                  const from = nodePositions[link.from] ?? defaultPoints[link.from]
                  const to = nodePositions[link.to] ?? defaultPoints[link.to]
                  if (!from || !to) {
                    return null
                  }

                  const nodeCenterY = 38
                  const startX = from.x + 176
                  const startY = from.y + nodeCenterY
                  const endX = to.x
                  const endY = to.y + nodeCenterY
                  const c1 = startX + 38
                  const c2 = endX - 38

                  if (Math.abs(startY - endY) < 2) {
                    return null
                  }

                  return (
                    <path
                      key={link.id}
                      d={`M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${endY}, ${endX} ${endY}`}
                      stroke="url(#xt-link-gradient)"
                      strokeWidth="1.2"
                      fill="none"
                      markerEnd="url(#xt-arrow)"
                      strokeLinecap="round"
                    />
                  )
                })}

                {linkDragging && (() => {
                  const from = nodePositions[linkDragging.fromId] ?? defaultPoints[linkDragging.fromId]
                  if (!from) {
                    return null
                  }

                  const nodeCenterY = 38
                  const startX = from.x + 176
                  const startY = from.y + nodeCenterY
                  const endX = linkDragging.x
                  const endY = linkDragging.y
                  const c1 = startX + 50
                  const c2 = endX - 50

                  return (
                    <path
                      d={`M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${endY}, ${endX} ${endY}`}
                      stroke="url(#xt-link-gradient)"
                      strokeWidth="1.1"
                      fill="none"
                      strokeLinecap="round"
                    />
                  )
                })()}
              </svg>

              {tasks.map((node) => {
                const point = nodePositions[node.id] ?? defaultPoints[node.id]
                return (
                  <div
                    key={node.id}
                    className={`xt-node ${node.completed ? 'xt-node-done' : ''}`}
                    style={{ left: `${point.x}px`, top: `${point.y}px` }}
                    onPointerDown={(event) => beginDrag(event, node.id)}
                    onPointerUp={() => onRootPointerUp(node.id)}
                  >
                    <div className="xt-node-grip" title="Drag node">::</div>
                    <button className="xt-link-handle" type="button" title="Drag to create dependency" onPointerDown={(event) => beginLinkDrag(event, node.id)} />
                    <div className="xt-node-line">
                      <input type="checkbox" checked={node.completed} onChange={() => toggle(node.id)} className="xt-check" />
                      {editingId === node.id ? (
                        <input
                          className="xt-inline-title-input xt-inline-visual"
                          style={{ width: '100px' }}
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={submitRename}
                          spellCheck={false}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              submitRename()
                            }
                            if (event.key === 'Escape') {
                              cancelRename()
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          className="xt-node-title"
                          type="button"
                          onClick={() => startRename(node.id, node.title)}
                          onMouseEnter={(event) => showHoverCard(node, event.currentTarget, true)}
                          onMouseLeave={hideHoverCard}
                        >
                          {node.title}
                        </button>
                      )}
                    </div>
                    <div className="xt-node-actions">
                      {node.children.length > 0 && (
                        <button className="xt-mini-btn" type="button" onClick={() => setVisualWindowRootId(visualWindowRootId === node.id ? null : node.id)} title="Toggle task details">
                          <CollapseIcon collapsed={visualWindowRootId !== node.id} />
                        </button>
                      )}
                      <button className="xt-mini-btn" type="button" onClick={() => addChildNew(node.id)} title="Add subtask">
                        <AddIcon />
                      </button>
                      <button className="xt-mini-btn xt-danger xt-delete-btn" type="button" onClick={() => remove(node.id)} title="Delete">
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                )
              })}

              {activeTab === 'visualize' && visualWindowRootId && (() => {
                const root = findTaskById(tasks, visualWindowRootId)
                if (!root) {
                  return null
                }

                const point = nodePositions[root.id] ?? defaultPoints[root.id]
                const width = 148
                const estimatedHeight = Math.min(240, 80 + root.children.length * 38)
                const belowY = point.y + 72
                const top = belowY
                const left = Math.max(8, point.x + Math.floor((176 - width) / 2))

                return (
                  <section className="xt-visual-drawer xt-visual-drawer-floating" style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}>
                    {root.children.length === 0 && <p className="xt-empty-note">No subtasks yet.</p>}
                    {root.children.length > 0 && <ul className="xt-visual-tree xt-window-list">{renderVisualPanelNodes(root.children)}</ul>}
                  </section>
                )
              })()}

              {tasks.length === 0 && <div className="xt-visual-empty">No tasks yet. Right-click the workspace and choose Add new task.</div>}
            </div>

            <div className="xt-link-list">
              {taskLinks.map((link) => {
                const fromName = rootTasks.find((task) => task.id === link.from)?.title ?? 'Unknown'
                const toName = rootTasks.find((task) => task.id === link.to)?.title ?? 'Unknown'

                return (
                  <div key={link.id} className="xt-link-chip">
                    <span>
                      {fromName}
                      {' -> '}
                      {toName}
                    </span>
                    <button type="button" className="xt-mini-btn xt-danger" onClick={() => removeLink(link.id)}>
                      x
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="xt-note">Hover a task to edit or view its description in a floating card. Click a subtask name to rename it. Checking a root task also marks all of its subtasks as done.</p>
          </div>
        )}
      </section>
      )}

      {hoverCard && (() => {
        const task = findTaskById(tasks, hoverCard.taskId)
        if (!task) {
          return null
        }

        return (
          <div className="xt-hover-card" style={{ left: `${hoverCard.x}px`, top: `${hoverCard.y}px` }} onMouseEnter={keepHoverCardOpen} onMouseLeave={hideHoverCard}>
            <div className="xt-hover-title">{task.title}</div>
            {hoverCard.editable && hoverCardEditMode ? (
              <textarea
                className="xt-hover-edit"
                value={task.description}
                onChange={(event) => setDescription(task.id, event.target.value)}
                placeholder="Click to edit description..."
                spellCheck={false}
                 onMouseEnter={keepHoverCardOpen}
                 autoFocus
              />
            ) : (
              <div className="xt-hover-body" onClick={() => {
                if (hoverCard.editable) {
                  keepHoverCardOpen()
                  setHoverCardEditMode(true)
                }
              }} style={{ cursor: hoverCard.editable ? 'pointer' : 'default' }}>
                {task.description || (hoverCard.editable ? 'Click to add description...' : 'No description')}
              </div>
            )}
          </div>
        )
      })()}

      {tabMenu.open && (
        <div className="xt-context-menu" style={{ left: `${tabMenu.x}px`, top: `${tabMenu.y}px` }}>
          <button type="button" className="xt-context-item" onClick={askAndAddRootFromMenu}>
            Add new task
          </button>
          <button type="button" className="xt-context-item xt-context-danger" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </main>
  )
}
