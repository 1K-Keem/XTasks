'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TaskStatus } from '../task-types'

export type TaskFlowData = {
  title: string
  duration: number
  status: TaskStatus
  assigneeLabel: string
  locked: boolean
  isCritical: boolean
  canEdit: boolean
  canQuickAdd: boolean
  darkMode: boolean
  onOpen: () => void
  onAddChild: () => void
  onToggleDone: () => void
  onDelete: () => void
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path d="M7 3v18h2v-6h7l-1.5-4L16 7H9V3z" fill="currentColor" />
    </svg>
  )
}

export function TaskFlowNode({ data }: NodeProps) {
  const d = data as TaskFlowData
  const done = d.status === 'done'
  const blocked = d.status === 'blocked'

  const shell = [
    'relative w-[240px] rounded-2xl border-2 p-3 text-left shadow-lg backdrop-blur-md transition-all duration-300',
    d.isCritical ? 'ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-transparent' : '',
    done
      ? 'border-emerald-400 bg-gradient-to-br from-emerald-100 to-lime-50 text-emerald-950 animate-[pulse_2.4s_ease-in-out_infinite]'
      : blocked
        ? 'border-rose-400 bg-rose-50 text-rose-950'
        : d.locked
          ? 'border-slate-300 bg-slate-100/90 text-slate-500'
          : d.darkMode
            ? 'border-cyan-500/40 bg-slate-900/90 text-slate-50'
            : 'border-cyan-200 bg-white/95 text-slate-900',
  ].join(' ')

  return (
    <div className={shell} onDoubleClick={(e) => e.stopPropagation()}>
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-cyan-500 !bg-white" />
      <button type="button" className="w-full text-left" onClick={() => d.onOpen()}>
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-extrabold tracking-tight">{d.title}</p>
          {blocked && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              <FlagIcon />
              Blocker
            </span>
          )}
        </div>
        <p className="text-xs opacity-75">Owner: {d.assigneeLabel}</p>
        <p className="text-xs opacity-75">Duration: {d.duration}d</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase">{d.status.replace('_', ' ')}</span>
          {d.locked && !done && <span className="text-[10px] font-semibold opacity-70">Locked</span>}
        </div>
      </button>

      {d.canEdit && (
        <div className="mt-2 flex items-center gap-2 border-t border-black/5 pt-2" onClick={(e) => e.stopPropagation()}>
          <label className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold">
            <input
              type="checkbox"
              checked={done}
              disabled={d.locked && !done}
              onChange={() => d.onToggleDone()}
              className="accent-emerald-500"
            />
            Done
          </label>
          <button
            type="button"
            className="ml-auto rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
            onClick={() => d.onDelete()}
          >
            Delete
          </button>
        </div>
      )}

      {d.canQuickAdd && (
        <button
          type="button"
          title="Add dependent task"
          className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-cyan-400 bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-lg font-black text-white shadow-md transition hover:scale-110 active:scale-95"
          onClick={(e) => {
            e.stopPropagation()
            d.onAddChild()
          }}
        >
          +
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!h-2 !w-2 !opacity-0"
        style={{ right: -1 }}
      />
    </div>
  )
}
