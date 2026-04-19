'use client'

import { useCallback, useEffect, useState } from 'react'

type Member = {
  id: string
  name: string
  email: string
  role: 'owner' | 'lead' | 'member'
}

type Props = {
  darkMode: boolean
  projectName: string
  projectId: string
  currentUserId: string
  onClose: () => void
  onDeleted: () => void
  onMembersChanged: () => void
}

export default function ProjectSettingsModal({
  darkMode,
  projectName,
  projectId,
  currentUserId,
  onClose,
  onDeleted,
  onMembersChanged,
}: Props) {
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null)

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

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load members.')
        return
      }
      setMembers((data.users ?? []) as Member[])
    } finally {
      setLoadingMembers(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const removeMember = async (userId: string) => {
    setError(null)
    setRemovingUserId(userId)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not remove member.')
        return
      }
      setMembers((prev) => prev.filter((m) => m.id !== userId))
      onMembersChanged()
    } finally {
      setRemovingUserId(null)
    }
  }

  const updateMemberRole = async (userId: string, role: 'member' | 'lead') => {
    setError(null)
    setChangingRoleUserId(userId)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update role.')
        return
      }

      setMembers((prev) => prev.map((member) => (member.id === userId ? { ...member, role } : member)))
      onMembersChanged()
    } finally {
      setChangingRoleUserId(null)
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

        <section className="mt-5 rounded-2xl border border-black/5 bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <p className="text-sm font-bold">Members</p>
          {loadingMembers ? (
            <p className="mt-2 text-xs opacity-70">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="mt-2 text-xs opacity-70">No members found.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={
                    darkMode
                      ? 'flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-xs'
                      : 'flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs'
                  }
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{member.name}</p>
                    <p className="truncate opacity-70">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role !== 'owner' ? (
                      <>
                        <div className="relative">
                          <select
                            value={member.role}
                            disabled={changingRoleUserId === member.id}
                            onChange={(e) => void updateMemberRole(member.id, e.target.value as 'member' | 'lead')}
                            className={
                              darkMode
                                ? 'h-8 min-w-[82px] appearance-none rounded-xl border border-violet-500/45 bg-slate-900 px-2.5 pr-6 text-[11px] font-bold text-violet-100 shadow-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50'
                                : 'h-8 min-w-[82px] appearance-none rounded-xl border border-violet-300/70 bg-white px-2.5 pr-6 text-[11px] font-bold text-violet-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/40 disabled:opacity-50'
                            }
                          >
                            <option className={darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} value="member">
                              Member
                            </option>
                            <option className={darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} value="lead">
                              Lead
                            </option>
                          </select>
                          <span
                            aria-hidden
                            className={
                              darkMode
                                ? 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-200'
                                : 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-600'
                            }
                          >
                            ▾
                          </span>
                        </div>
                        {member.id !== currentUserId ? (
                          <button
                            type="button"
                            disabled={removingUserId === member.id || changingRoleUserId === member.id}
                            onClick={() => void removeMember(member.id)}
                            className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {removingUserId === member.id ? 'Removing...' : 'Remove'}
                          </button>
                        ) : (
                          <span className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-semibold opacity-70">You</span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-semibold opacity-70">Owner</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
