'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })
      const data = await res.json()

      if (data.success) {
        const redirectMap: Record<string, string> = {
          admin: '/admin',
          editor: '/editor',
          writer: '/writer',
        }
        router.push(redirectMap[data.role] || '/')
        router.refresh()
      } else {
        setError(data.error || '로그인에 실패했습니다')
      }
    } catch {
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50/30">
      <div className="w-full max-w-sm">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <span className="text-2xl text-white">&#x271A;</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">교회 계간지</h1>
          <p className="text-slate-400 text-sm mt-1">원고 제출 시스템</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-500 mb-1.5">
                이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
                autoComplete="name"
                className="w-full h-11 px-3.5 text-base bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-500 mb-1.5">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="숫자 4자리"
                required
                className="w-full h-11 px-3.5 text-base bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none tracking-[0.5em] text-center transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-400 text-sm">!</span>
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || name.length === 0 || password.length < 4}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md disabled:shadow-none"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  로그인 중...
                </span>
              ) : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">비밀번호를 잊으셨나요? 관리자에게 문의하세요</p>
      </div>
    </div>
  )
}
