'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-fuchsia-50 via-cyan-50 to-violet-100 p-4">
      <form
        className="w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur"
        onSubmit={async (event) => {
          event.preventDefault()
          setLoading(true)
          setError('')
          const result = await signIn('credentials', { email, password, redirect: false })
          setLoading(false)
          if (result?.error) {
            setError('Invalid email or password.')
            return
          }
          router.push('/dashboard')
        }}
      >
        <h1 className="text-2xl font-black">Welcome back</h1>
        <p className="mb-4 text-sm text-slate-600">Sign in to your XTASKS workspace.</p>
        <div className="space-y-3">
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          New here? <Link href="/signup" className="font-semibold text-cyan-700 underline">Create account</Link>
        </p>
      </form>
    </main>
  )
}
