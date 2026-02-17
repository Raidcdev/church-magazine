/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

type User = {
  id: string
  name: string
  password: string
  role: string
  created_at: string
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

export default function UsersPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [session, setSession] = useState<{ userId: string; role: string; name: string } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)

  // 추가 폼
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', password: '', role: 'writer' })
  const [adding, setAdding] = useState(false)

  // 비번 변경
  const [changingPwId, setChangingPwId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 세션 확인
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) { router.push('/'); return }
        const { session: sess } = await res.json()
        if (!sess || sess.role !== 'admin') { router.push('/'); return }
        setSession(sess)
      } catch {
        router.push('/')
      }
    }
    checkAuth()
  }, [router])

  // 데이터 로딩
  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const { data: usersData } = await (supabase
        .from('users') as any)
        .select('*')
        .order('role', { ascending: true })
        .order('name', { ascending: true })

      setUsers((usersData ?? []) as User[])

      // chapters에 배정된 writer_id 목록
      const { data: chaptersData } = await (supabase
        .from('chapters') as any)
        .select('writer_id')

      const assigned = new Set<string>()
      for (const ch of (chaptersData ?? []) as { writer_id: string | null }[]) {
        if (ch.writer_id) assigned.add(ch.writer_id)
      }
      setAssignedUserIds(assigned)
    } catch {
      showToast('데이터를 불러오는데 실패했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [session, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 회원 추가
  async function handleAdd() {
    if (!addForm.name.trim()) {
      showToast('이름을 입력해주세요', 'error'); return
    }
    if (!/^\d{4}$/.test(addForm.password)) {
      showToast('비밀번호는 숫자 4자리여야 합니다', 'error'); return
    }
    setAdding(true)
    try {
      // 이름 중복 체크
      const { data: existing } = await (supabase
        .from('users') as any)
        .select('id')
        .eq('name', addForm.name.trim())
        .maybeSingle()

      if (existing) {
        showToast('이미 존재하는 이름입니다', 'error')
        setAdding(false)
        return
      }

      const { error } = await (supabase.from('users') as any).insert({
        name: addForm.name.trim(),
        password: addForm.password,
        role: addForm.role,
      })

      if (error) throw error
      showToast(`${addForm.name} 회원이 추가되었습니다`, 'success')
      setAddForm({ name: '', password: '', role: 'writer' })
      setShowAddForm(false)
      await loadData()
    } catch {
      showToast('회원 추가에 실패했습니다', 'error')
    } finally {
      setAdding(false)
    }
  }

  // 회원 삭제
  async function handleDelete(user: User) {
    if (assignedUserIds.has(user.id)) {
      showToast('배정된 원고가 있는 회원은 삭제할 수 없습니다', 'error')
      return
    }
    if (!confirm(`"${user.name}" 회원을 삭제하시겠습니까?`)) return

    try {
      const { error } = await (supabase
        .from('users') as any)
        .delete()
        .eq('id', user.id)

      if (error) throw error
      showToast('삭제되었습니다', 'success')
      await loadData()
    } catch {
      showToast('삭제에 실패했습니다', 'error')
    }
  }

  // 비밀번호 변경
  async function handleChangePassword(userId: string) {
    if (!/^\d{4}$/.test(newPassword)) {
      showToast('비밀번호는 숫자 4자리여야 합니다', 'error')
      return
    }
    try {
      const { error } = await (supabase
        .from('users') as any)
        .update({ password: newPassword })
        .eq('id', userId)

      if (error) throw error
      showToast('비밀번호가 변경되었습니다', 'success')
      setChangingPwId(null)
      setNewPassword('')
      await loadData()
    } catch {
      showToast('비밀번호 변경에 실패했습니다', 'error')
    }
  }

  const roleLabel: Record<string, string> = {
    admin: '관리자',
    editor: '교정자',
    writer: '필자',
  }

  const roleBadge: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    editor: 'bg-orange-100 text-orange-700',
    writer: 'bg-blue-100 text-blue-700',
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white text-lg font-semibold shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="h-10 px-3 text-base font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ← 대시보드
            </button>
            <h1 className="text-2xl font-bold text-gray-900">👥 회원 관리</h1>
          </div>
          <span className="text-lg text-gray-600">{users.length}명</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-lg text-gray-500">불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* 역할별 요약 */}
            <div className="grid grid-cols-3 gap-3">
              {(['admin', 'editor', 'writer'] as const).map(role => (
                <div key={role} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <div className="text-base text-gray-500">{roleLabel[role]}</div>
                  <div className="text-2xl font-bold mt-1">
                    {users.filter(u => u.role === role).length}명
                  </div>
                </div>
              ))}
            </div>

            {/* 회원 목록 */}
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-900">{user.name}</span>
                      <span className={`px-2 py-0.5 text-sm font-medium rounded-full ${roleBadge[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabel[user.role] || user.role}
                      </span>
                      {assignedUserIds.has(user.id) && (
                        <span className="text-sm text-gray-400">원고배정됨</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setChangingPwId(changingPwId === user.id ? null : user.id)
                          setNewPassword('')
                        }}
                        className="px-3 py-1.5 text-base font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        비번변경
                      </button>
                      {user.role !== 'admin' && !assignedUserIds.has(user.id) && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="px-3 py-1.5 text-base font-medium text-red-600 hover:text-red-800 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 비밀번호 변경 폼 */}
                  {changingPwId === user.id && (
                    <div className="mt-3 flex items-center gap-3 pt-3 border-t border-gray-100">
                      <span className="text-base text-gray-600 shrink-0">새 비번:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="숫자 4자리"
                        className="h-12 w-32 px-3 text-lg text-center tracking-[0.3em] border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleChangePassword(user.id)}
                        disabled={newPassword.length < 4}
                        className="h-12 px-4 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        변경
                      </button>
                      <button
                        onClick={() => { setChangingPwId(null); setNewPassword('') }}
                        className="h-12 px-3 text-base text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 추가 폼 */}
            {showAddForm && (
              <div className="bg-white border-2 border-blue-200 rounded-xl p-5 space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">새 회원 추가</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-base text-gray-600 mb-1">이름</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="이름을 입력하세요"
                      className="w-full h-14 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-base text-gray-600 mb-1">비밀번호 (숫자 4자리)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={addForm.password}
                      onChange={e => setAddForm({ ...addForm, password: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="0000"
                      className="w-full h-14 px-4 text-lg text-center tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-base text-gray-600 mb-1">역할</label>
                    <select
                      value={addForm.role}
                      onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full h-14 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="writer">필자</option>
                      <option value="editor">교정자</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="flex-1 h-14 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {adding ? '추가 중...' : '추가하기'}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setAddForm({ name: '', password: '', role: 'writer' }) }}
                    className="flex-1 h-14 text-lg font-semibold text-gray-600 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 추가 버튼 */}
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full h-14 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                ＋ 회원 추가
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
