'use client'

import { useState } from 'react'

type Props = {
  darkMode: boolean
  projectName: string
  projectId: string
  onClose: () => void
  onDeleted: () => void
}

export default function ProjectSettingsModal({ darkMode, projectName, projectId, onClose, onDeleted }: Props) {
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const shell = darkMode ? 'border-rose-500/30 bg-slate-900 text-slate-50' : 'border-rose-200 bg-white text-slate-900'

  const deleteProject = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not delete project.')
        return
      }
      onDeleted()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-3xl border-2 p-6 shadow-2xl ${shell}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Danger zone</p>
            <h2 className="text-2xl font-black tracking-tight">Project settings</h2>
            <p className="mt-1 text-sm opacity-70">Owner-only · deleting removes tasks, members, and graph data.</p>
          </div>
          <button type="button" className="rounded-2xl border border-black/10 px-3 py-1 text-sm font-semibold" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
          <p>
            <span className="font-semibold opacity-70">Project:</span> {projectName}
          </p>
          <p className="mt-1 break-all text-xs opacity-50">{projectId}</p>
        </div>

        <label className="mt-6 block space-y-1 text-sm">
          <span className="font-semibold">Type the project name to confirm deletion</span>
          <input
            className="w-full rounded-2xl border border-rose-200 bg-transparent px-3 py-2 dark:border-rose-500/40"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={projectName}
            autoComplete="off"
          />
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}

        <button
          type="button"
          disabled={loading || confirmName.trim() !== projectName}
          onClick={() => void deleteProject()}
          className="mt-6 w-full rounded-2xl border-2 border-rose-500 bg-rose-600 py-3 text-sm font-black text-white shadow-lg transition hover:bg-rose-700 disabled:opacity-40"
        >
          {loading ? 'Deleting…' : 'Delete project forever'}
        </button>
      </div>
    </div>
  )
}
