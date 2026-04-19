'use client'

import { useState } from 'react'

type Props = {
  darkMode: boolean
  onClose: () => void
  onJoined: (project: { id: string; name: string; role: string }) => void
}

export default function JoinProjectModal({ darkMode, onClose, onJoined }: Props) {
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const shell = darkMode ? 'border-cyan-500/40 bg-slate-900 text-slate-50' : 'border-cyan-200 bg-white text-slate-900'

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/projects/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not join.')
        return
      }
      if (data.project) onJoined(data.project)
      setProjectId('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-3xl border-2 p-6 shadow-2xl ${shell}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-500">Join</p>
            <h2 className="text-2xl font-black tracking-tight">Enter project ID</h2>
            <p className="mt-1 text-sm opacity-70">Paste the ID your teammate shared.</p>
          </div>
          <button type="button" className="rounded-2xl border border-black/10 px-3 py-1 text-sm font-semibold" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Project ID</span>
          <input
            className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2 font-mono text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="clx…"
          />
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}

        <button
          type="button"
          disabled={loading || !projectId.trim()}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-2xl border-2 border-cyan-400 bg-cyan-500 py-3 text-sm font-black text-white shadow-lg transition hover:bg-cyan-600 disabled:opacity-50"
        >
          {loading ? 'Joining…' : 'Join project'}
        </button>
      </div>
    </div>
  )
}
