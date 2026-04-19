'use client'

import { useState } from 'react'

type Props = {
  darkMode: boolean
  projectName: string
  projectId: string
  onClose: () => void
  onInvited: () => void
}

export default function ShareProjectModal({ darkMode, projectName, projectId, onClose, onInvited }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'lead'>('member')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const shell = darkMode ? 'border-violet-600/50 bg-slate-900 text-slate-50' : 'border-fuchsia-200 bg-white text-slate-900'

  const submit = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Invite failed.')
        return
      }
      onInvited()
      if (data?.alreadyMember) {
        setMessage('User is already a member of this project.')
      } else {
        setMessage('Invitation sent. They can accept it from their Invitations inbox.')
      }
      setEmail('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-3xl border-2 p-6 shadow-2xl ${shell}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-500">Share</p>
            <h2 className="text-2xl font-black tracking-tight">{projectName}</h2>
            <p className="mt-1 text-sm opacity-70">Invite by email — they need an XTasks account and can accept in their Invitations inbox.</p>
          </div>
          <button type="button" className="rounded-2xl border border-black/10 px-3 py-1 text-sm font-semibold" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Email</span>
          <input
            type="email"
            className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@school.edu"
          />
        </label>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-semibold">Role</span>
          <select
            className="w-full rounded-2xl border border-black/10 bg-transparent px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'lead')}
          >
            <option value="member">Member</option>
            <option value="lead">Lead</option>
          </select>
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
  {message && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{message}</p>}

        <button
          type="button"
          disabled={loading || !email.trim()}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-500 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send invite'}
        </button>

        <p className="mt-4 break-all text-center text-[11px] opacity-50">Project ID: {projectId}</p>
      </div>
    </div>
  )
}
