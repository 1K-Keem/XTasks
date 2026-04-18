'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
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
          const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          })
          if (!response.ok) {
            setError('Unable to create account.')
            setLoading(false)
            return
          }
          await signIn('credentials', { email, password, redirect: false })
          setLoading(false)
          router.push('/dashboard')
        }}
      >
        <h1 className="text-2xl font-black">Create account</h1>
        <p className="mb-4 text-sm text-slate-600">Start collaborating in XTASKS.</p>
        <div className="space-y-3">
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
            {loading ? 'Creating...' : 'Sign up'}
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account? <Link href="/login" className="font-semibold text-cyan-700 underline">Login</Link>
        </p>
      </form>
    </main>
  )
}
