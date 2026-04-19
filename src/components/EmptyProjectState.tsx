'use client'

import { signOut } from 'next-auth/react'

type Props = {
  darkMode: boolean
  userLabel: string
  inviteCount: number
  onCreateProject: () => void
  onJoinProject: () => void
  onOpenInvites: () => void
  onToggleTheme: () => void
}

export default function EmptyProjectState({
  darkMode,
  userLabel,
  inviteCount,
  onCreateProject,
  onJoinProject,
  onOpenInvites,
  onToggleTheme,
}: Props) {
  const bg = darkMode
    ? 'min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/40 to-slate-950 text-slate-50'
    : 'min-h-screen bg-gradient-to-br from-fuchsia-50 via-cyan-50 to-violet-100 text-slate-900'

  return (
    <main className={bg}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-fuchsia-500">XTasks</p>
          <h1 className="text-4xl font-black tracking-tight">Your project runway is clear ✨</h1>
          <p className="mt-2 max-w-xl text-sm opacity-80">
            Spin up a CPM workspace or jump into a shared board. Roles stay scoped per project — you’re always just{' '}
            <span className="font-semibold text-cyan-600 dark:text-cyan-300">you</span> everywhere else.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-bold opacity-80">{userLabel}</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold transition hover:scale-[1.02]"
          >
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-10 text-center">
        <div
          className={`w-full rounded-[2rem] border-2 border-dashed p-10 shadow-xl ${
            darkMode ? 'border-cyan-500/40 bg-slate-900/60' : 'border-fuchsia-300/80 bg-white/70'
          }`}
        >
          <p className="text-lg font-bold opacity-80">No active project</p>
          <p className="mt-2 text-sm opacity-70">Create something new or join a crew that already mapped the critical path.</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onCreateProject}
              className="rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-600 px-8 py-4 text-base font-black text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-[1.03] active:scale-95"
            >
              Create new project
            </button>
            <button
              type="button"
              onClick={onJoinProject}
              className="rounded-2xl border-2 border-cyan-400/80 bg-cyan-50 px-8 py-4 text-base font-black text-cyan-900 transition hover:scale-[1.03] dark:border-cyan-500/50 dark:bg-slate-800 dark:text-cyan-100"
            >
              Join project
            </button>
            <button
              type="button"
              onClick={onOpenInvites}
              className={`rounded-2xl border-2 px-8 py-4 text-base font-black transition hover:scale-[1.03] ${
                inviteCount > 0
                  ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-lg shadow-rose-500/25 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-200'
                  : 'border-amber-400/80 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-slate-800 dark:text-amber-100'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Invitations
                {inviteCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black leading-none text-white">
                    {inviteCount > 99 ? '99+' : inviteCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
