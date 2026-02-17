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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">교회 계간지</h1>
          <p className="text-gray-500 text-lg">원고 제출 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-lg font-medium text-gray-700 mb-2">
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
              className="w-full h-14 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-lg font-medium text-gray-700 mb-2">
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
              className="w-full h-14 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none tracking-[0.5em] text-center"
            />
          </div>

          {error && (
            <p className="text-red-600 text-lg font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || name.length === 0 || password.length < 4}
            className="w-full h-14 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
