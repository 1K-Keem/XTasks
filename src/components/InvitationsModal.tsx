'use client'

import { useCallback, useEffect, useState } from 'react'

type Invite = {
  id: string
  projectId: string
  projectName: string
  role: string
  invitedBy: string
  createdAt: string
}

type Props = {
  darkMode: boolean
  onClose: () => void
  onAccepted: (project: { id: string; name: string; role: string }) => void
  onCountChanged: (count: number) => void
}

export default function InvitationsModal({ darkMode, onClose, onAccepted, onCountChanged }: Props) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shell = darkMode ? 'border-amber-500/30 bg-slate-900 text-slate-50' : 'border-amber-200 bg-white text-slate-900'

  const loadInvites = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/invitations')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load invitations.')
        return
      }
      const rows = (data.invites ?? []) as Invite[]
      setInvites(rows)
      onCountChanged(rows.length)
    } finally {
      setLoading(false)
    }
  }, [onCountChanged])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  const handleAction = async (inviteId: string, action: 'accept' | 'decline') => {
    setError(null)
    setBusyId(inviteId)
    try {
      const res = await fetch(`/api/invitations/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to update invitation.')
        return
      }

      const next = invites.filter((invite) => invite.id !== inviteId)
      setInvites(next)
      onCountChanged(next.length)

      if (action === 'accept' && data.project) {
        onAccepted(data.project as { id: string; name: string; role: string })
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-xl rounded-3xl border-2 p-6 shadow-2xl ${shell}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">Invitations</p>
            <h2 className="text-2xl font-black tracking-tight">Project inbox</h2>
            <p className="mt-1 text-sm opacity-70">Accept to join instantly, or decline to clear the request.</p>
          </div>
          <button type="button" className="rounded-2xl border border-black/10 px-3 py-1 text-sm font-semibold" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <p className="mb-3 text-sm font-semibold text-rose-500">{error}</p>}

        {loading ? (
          <p className="py-6 text-center text-sm opacity-70">Loading invitations…</p>
        ) : invites.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-70">No pending invitations.</p>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
            {invites.map((invite) => (
              <article key={invite.id} className="rounded-2xl border border-black/10 p-4">
                <p className="text-sm font-black">{invite.projectName}</p>
                <p className="mt-1 text-xs opacity-70">
                  Invited by {invite.invitedBy} · Role: <span className="font-semibold capitalize">{invite.role}</span>
                </p>
                <p className="mt-1 text-[11px] opacity-50">Project ID: {invite.projectId}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === invite.id}
                    onClick={() => void handleAction(invite.id, 'accept')}
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyId === invite.id}
                    onClick={() => void handleAction(invite.id, 'decline')}
                    className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black transition hover:bg-black/5 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
