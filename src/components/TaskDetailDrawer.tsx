'use client'

import { useMemo, useState } from 'react'
import { dependencyGraphIsAcyclic } from '../lib/cpm'
import type { TaskNode, TaskStatus } from './task-types'

export type WorkspaceMember = {
  id: string
  name: string
  email?: string
  role: string
}

type Props = {
  darkMode: boolean
  task: TaskNode
  members: WorkspaceMember[]
  tasks: TaskNode[]
  canEdit: boolean
  currentUserName: string
  onClose: () => void
  onPatch: (taskId: string, patch: Partial<TaskNode>) => void
  onPersist: (taskId: string, patch: Partial<TaskNode>) => void
  onDelete: (taskId: string) => void
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function TaskDetailDrawer({
  darkMode,
  task,
  members,
  tasks,
  canEdit,
  currentUserName,
  onClose,
  onPatch,
  onPersist,
  onDelete,
}: Props) {
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [dependencySearch, setDependencySearch] = useState('')

  const panel = darkMode
    ? 'border-violet-600/40 bg-slate-900/95 text-slate-50 shadow-[0_0_60px_rgba(139,92,246,0.15)]'
    : 'border-fuchsia-200/80 bg-white/95 text-slate-900 shadow-2xl'

  const assigneeSet = useMemo(() => new Set(task.assigneeIds), [task.assigneeIds])

  const toggleBlocker = () => {
    const next: TaskStatus = task.status === 'blocked' ? 'todo' : 'blocked'
    onPatch(task.id, { status: next })
    void onPersist(task.id, { status: next })
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-slate-950/40 backdrop-blur-[2px]" aria-label="Close drawer" onClick={onClose} />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l ${panel} transition-transform duration-300`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/5 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-500">Task detail</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Edit node</h2>
          </div>
          <button
            type="button"
            className="rounded-2xl border border-black/10 px-3 py-1 text-sm font-semibold transition hover:scale-105"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Title</span>
              <input
                className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2"
                value={task.title}
                disabled={!canEdit}
                onChange={(e) => onPatch(task.id, { title: e.target.value })}
                onBlur={() => onPersist(task.id, { title: task.title })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Duration (days)</span>
              <input
                className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2"
                type="number"
                min={1}
                value={task.duration}
                disabled={!canEdit}
                onChange={(e) => onPatch(task.id, { duration: Math.max(1, Number(e.target.value) || 1) })}
                onBlur={() => onPersist(task.id, { duration: task.duration })}
              />
            </label>
            <div className="block space-y-2 text-sm">
              <p className="font-semibold">Assignees</p>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-black/10 p-3">
                {members.map((user) => {
                  const checked = assigneeSet.has(user.id)
                  return (
                    <label key={user.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = new Set(task.assigneeIds)
                          if (e.target.checked) next.add(user.id)
                          else next.delete(user.id)
                          const assigneeIds = Array.from(next)
                          onPatch(task.id, { assigneeIds })
                          void onPersist(task.id, { assigneeIds })
                        }}
                      />
                      <span>
                        {user.name}
                        {user.role ? ` (${user.role})` : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs opacity-70">Pick one or many users to collaborate on this task.</p>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Status</span>
              <select
                className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2"
                value={task.status}
                disabled={!canEdit}
                onChange={(e) => {
                  const v = e.target.value as TaskStatus
                  onPatch(task.id, { status: v })
                  void onPersist(task.id, { status: v })
                }}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>

            <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/40">
              <div>
                <p className="text-sm font-bold">Blocker flag</p>
                <p className="text-xs opacity-70">Surface risks without hiding the task.</p>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={toggleBlocker}
                className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                  task.status === 'blocked'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-white/80 text-amber-900 dark:bg-slate-800 dark:text-amber-100'
                }`}
              >
                {task.status === 'blocked' ? 'Blocked' : 'Mark'}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/5 p-4">
            <h3 className="mb-3 font-bold">Subtasks</h3>
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    disabled={!canEdit}
                    onChange={() => {
                      const subtasks = task.subtasks.map((s) =>
                        s.id === subtask.id ? { ...s, done: !s.done } : s,
                      )
                      onPatch(task.id, { subtasks })
                      void onPersist(task.id, { subtasks })
                    }}
                  />
                  <input
                    className="flex-1 rounded-xl border border-black/10 bg-transparent px-2 py-1 text-sm"
                    value={subtask.title}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const subtasks = task.subtasks.map((s) =>
                        s.id === subtask.id ? { ...s, title: e.target.value } : s,
                      )
                      onPatch(task.id, { subtasks })
                    }}
                    onBlur={() => onPersist(task.id, { subtasks: task.subtasks })}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      className="text-xs text-rose-500"
                      onClick={() => {
                        const subtasks = task.subtasks.filter((s) => s.id !== subtask.id)
                        onPatch(task.id, { subtasks })
                        void onPersist(task.id, { subtasks })
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-black/10 bg-transparent px-2 py-1 text-sm"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder="Add subtask..."
                />
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1 text-sm font-bold text-white shadow-md"
                  onClick={() => {
                    const title = subtaskDraft.trim()
                    if (!title) return
                    const subtasks = [...task.subtasks, { id: createId(), title, done: false }]
                    onPatch(task.id, { subtasks })
                    void onPersist(task.id, { subtasks })
                    setSubtaskDraft('')
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-black/5 p-4">
            <h3 className="mb-2 font-bold">Notes</h3>
            <textarea
              className="h-28 w-full rounded-2xl border border-black/10 bg-transparent p-3 text-sm"
              value={task.notes}
              disabled={!canEdit}
              placeholder="Decisions, links, context..."
              onChange={(e) => onPatch(task.id, { notes: e.target.value })}
              onBlur={() => onPersist(task.id, { notes: task.notes })}
            />
            <h3 className="mb-2 mt-4 font-bold">Comments</h3>
            <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
              {task.comments.map((comment, idx) => (
                <p key={`${idx}-${comment.slice(0, 12)}`} className="rounded-xl bg-black/5 px-3 py-2">
                  {comment}
                </p>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-black/10 bg-transparent px-2 py-1 text-sm"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Drop a comment..."
                />
                <button
                  type="button"
                  className="rounded-xl border border-black/10 px-3 py-1 text-sm font-semibold"
                  onClick={() => {
                    const text = commentDraft.trim()
                    if (!text) return
                    const label = currentUserName || 'Teammate'
                    const comments = [...task.comments, `${label}: ${text}`]
                    onPatch(task.id, { comments })
                    void onPersist(task.id, { comments })
                    setCommentDraft('')
                  }}
                >
                  Send
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-black/5 p-4">
            <h3 className="mb-2 font-bold">Dependencies</h3>
            <input
              className="mb-2 w-full rounded-xl border border-black/10 bg-transparent px-2 py-1 text-sm"
              placeholder="Filter tasks..."
              value={dependencySearch}
              onChange={(e) => setDependencySearch(e.target.value)}
            />
            <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-1">
              {tasks
                .filter(
                  (c) =>
                    c.id !== task.id && c.title.toLowerCase().includes(dependencySearch.toLowerCase()),
                )
                .map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={task.dependencyIds.includes(candidate.id)}
                      onChange={(e) => {
                        const set = new Set(task.dependencyIds)
                        if (e.target.checked) set.add(candidate.id)
                        else set.delete(candidate.id)
                        const dependencyIds = Array.from(set)
                        const trial = tasks.map((t) =>
                          t.id === task.id ? { ...t, dependencyIds } : t,
                        )
                        if (!dependencyGraphIsAcyclic(trial.map((t) => ({ id: t.id, dependencyIds: t.dependencyIds })))) {
                          return
                        }
                        onPatch(task.id, { dependencyIds })
                        void onPersist(task.id, { dependencyIds })
                      }}
                    />
                    {candidate.title}
                  </label>
                ))}
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              className="mt-8 w-full rounded-2xl border-2 border-rose-400/80 bg-rose-50 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200"
              onClick={() => onDelete(task.id)}
            >
              Delete task
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
