/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

type Session = {
  userId: string
  role: 'admin' | 'editor' | 'writer'
  name: string
}

type FileRow = {
  id: string
  chapter_id: string
  file_url: string
  file_name: string
  file_size: number | null
  uploaded_at: string
}

type ChapterRow = {
  id: string
  order_number: number
  chapter_code: string
  title: string
  category: string | null
  writer_id: string | null
  status: 'submitted' | 'editing' | 'confirmed'
  original_body: string | null
  edited_body: string | null
  edited_by: string | null
  edited_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  writer_name: string | null
  files: FileRow[]
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

export default function EditorPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [activeTab, setActiveTab] = useState<'original' | 'edit'>('original')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [loading, setLoading] = useState(true)

  const selected = chapters.find((c) => c.id === selectedId) ?? null

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // 세션 및 데이터 로딩
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/'); return }
      const { session: sess } = await res.json()
      if (!sess) { router.push('/'); return }
      setSession(sess)

      const supabase = createBrowserClient()

      // chapters 조회 (submitted, editing, confirmed)
      const { data: rawChapters, error: chaptersError } = await (supabase
        .from('chapters') as any)
        .select('*')
        .in('status', ['submitted', 'editing', 'confirmed'])
        .order('order_number', { ascending: true })

      if (chaptersError) throw chaptersError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chaptersData = (rawChapters ?? []) as Record<string, any>[]

      if (chaptersData.length === 0) {
        setChapters([])
        setLoading(false)
        return
      }

      // 필자 이름 조회
      const writerIds = Array.from(new Set(chaptersData.filter((c) => c.writer_id).map((c) => c.writer_id as string)))
      let writerMap: Record<string, string> = {}
      if (writerIds.length > 0) {
        const { data: rawWriters } = await (supabase
          .from('users') as any)
          .select('id, name')
          .in('id', writerIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const writers = (rawWriters ?? []) as Record<string, any>[]
        writerMap = Object.fromEntries(writers.map((w) => [w.id, w.name]))
      }

      // 파일 조회
      const chapterIds = chaptersData.map((c) => c.id as string)
      const { data: rawFiles } = await (supabase
        .from('files') as any)
        .select('*')
        .in('chapter_id', chapterIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filesData = (rawFiles ?? []) as Record<string, any>[]
      const filesMap: Record<string, FileRow[]> = {}
      for (const f of filesData) {
        const cid = f.chapter_id as string
        if (!filesMap[cid]) filesMap[cid] = []
        filesMap[cid].push({
          id: f.id,
          chapter_id: f.chapter_id,
          file_url: f.file_url,
          file_name: f.file_name,
          file_size: f.file_size,
          uploaded_at: f.uploaded_at,
        })
      }

      const result: ChapterRow[] = chaptersData.map((c) => ({
        id: c.id,
        order_number: c.order_number,
        chapter_code: c.chapter_code,
        title: c.title,
        category: c.category,
        writer_id: c.writer_id,
        status: c.status as ChapterRow['status'],
        original_body: c.original_body,
        edited_body: c.edited_body,
        edited_by: c.edited_by,
        edited_at: c.edited_at,
        confirmed_by: c.confirmed_by,
        confirmed_at: c.confirmed_at,
        writer_name: c.writer_id ? writerMap[c.writer_id] ?? null : null,
        files: filesMap[c.id] ?? [],
      }))

      setChapters(result)

      // 첫 항목 자동 선택
      if (result.length > 0 && !selectedId) {
        setSelectedId(result[0].id)
        const first = result[0]
        setEditedBody(first.edited_body ?? first.original_body ?? '')
      }
    } catch {
      showToast('데이터를 불러오는 중 오류가 발생했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [router, selectedId, showToast])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 항목 선택 시 editedBody 갱신
  function handleSelect(chapter: ChapterRow) {
    setSelectedId(chapter.id)
    // 첫 교정 자동 복사: edited_body가 null이면 original_body로 채움
    setEditedBody(chapter.edited_body ?? chapter.original_body ?? '')
    setActiveTab('original')
  }

  // 저장
  async function handleSave() {
    if (!selected || !session || selected.status === 'confirmed') return
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          edited_body: editedBody,
          status: 'editing',
          edited_by: session.userId,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
        .in('status', ['submitted', 'editing'])

      if (error) throw error

      showToast('저장되었습니다', 'success')
      // 로컬 상태 업데이트
      setChapters((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, edited_body: editedBody, status: 'editing' as const, edited_by: session.userId, edited_at: new Date().toISOString() }
            : c
        )
      )
    } catch {
      showToast('저장 중 오류가 발생했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 확정
  async function handleConfirm() {
    if (!selected || !session || selected.status === 'confirmed') return
    if (!editedBody.trim()) return

    const ok = window.confirm('확정하면 교정이 완료됩니다. 확정하시겠습니까?')
    if (!ok) return

    setConfirming(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          edited_body: editedBody,
          status: 'confirmed',
          edited_by: session.userId,
          edited_at: new Date().toISOString(),
          confirmed_by: session.userId,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
        .in('status', ['submitted', 'editing'])

      if (error) throw error

      showToast('확정되었습니다', 'success')
      setChapters((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                edited_body: editedBody,
                status: 'confirmed' as const,
                confirmed_by: session.userId,
                confirmed_at: new Date().toISOString(),
              }
            : c
        )
      )
    } catch {
      showToast('확정 중 오류가 발생했습니다', 'error')
    } finally {
      setConfirming(false)
    }
  }

  // 로그아웃
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  // 상태 배지
  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
      submitted: { label: '제출완료', cls: 'bg-indigo-50 text-indigo-600' },
      editing: { label: '교정중', cls: 'bg-amber-50 text-amber-600' },
      confirmed: { label: '확정', cls: 'bg-emerald-50 text-emerald-600' },
    }
    const info = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
    return (
      <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${info.cls}`}>
        {info.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <p className="text-lg text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white text-lg font-semibold shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">교정 작업</h1>
          <div className="flex items-center gap-3">
            <span className="text-lg text-slate-200">{session?.name}님</span>
            <button
              onClick={handleLogout}
              className="h-12 px-4 text-lg font-semibold text-slate-300 border border-slate-500 rounded-xl hover:bg-slate-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {chapters.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 p-8 text-center">
            <p className="text-lg text-slate-400">제출된 원고가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 항목 목록 */}
            <div className="space-y-2">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelect(ch)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between gap-3 ${
                    selectedId === ch.id
                      ? 'bg-white rounded-2xl shadow-sm border-2 border-indigo-400'
                      : 'bg-white/70 rounded-2xl hover:bg-white hover:shadow-sm border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg font-semibold text-slate-800 truncate">
                      {ch.chapter_code}. {ch.title}
                    </span>
                    {ch.writer_name && (
                      <span className="text-base text-slate-400 shrink-0">({ch.writer_name})</span>
                    )}
                  </div>
                  <StatusBadge status={ch.status} />
                </button>
              ))}
            </div>

            {/* 선택된 항목 상세 */}
            {selected && (
              <div className="space-y-5">
                {/* 확정 배지 */}
                {selected.status === 'confirmed' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-1">
                    <p className="text-2xl font-bold text-emerald-700">확정됨</p>
                    {selected.confirmed_at && (
                      <p className="text-base text-emerald-600">
                        {new Date(selected.confirmed_at).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </div>
                )}

                {/* 모바일 탭 전환 */}
                <div className="flex md:hidden gap-2">
                  <button
                    onClick={() => setActiveTab('original')}
                    className={`flex-1 h-12 text-lg font-semibold rounded-xl transition-colors ${
                      activeTab === 'original'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-500 border border-slate-200'
                    }`}
                  >
                    원본 보기
                  </button>
                  <button
                    onClick={() => setActiveTab('edit')}
                    className={`flex-1 h-12 text-lg font-semibold rounded-xl transition-colors ${
                      activeTab === 'edit'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-500 border border-slate-200'
                    }`}
                  >
                    교정하기
                  </button>
                </div>

                {/* 데스크톱: 2단 / 모바일: 탭 전환 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 원본 */}
                  <div className={`space-y-3 ${activeTab !== 'original' ? 'hidden md:block' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-800">원본</span>
                      <span className="text-base text-slate-400">
                        {(selected.original_body ?? '').length}자
                      </span>
                    </div>
                    <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 min-h-[200px] whitespace-pre-wrap text-lg leading-relaxed text-slate-800">
                      {selected.original_body || '(내용 없음)'}
                    </div>

                    {/* 첨부 사진 */}
                    {selected.files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-slate-800">
                          첨부 사진 ({selected.files.length}장)
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {selected.files.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => window.open(f.file_url, '_blank')}
                              className="group flex flex-col items-center gap-1"
                            >
                              <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group-hover:border-indigo-300 transition-colors">
                                <img
                                  src={f.file_url}
                                  alt={f.file_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="text-xs text-slate-400 max-w-[80px] truncate">
                                {f.file_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 교정본 */}
                  <div className={`space-y-3 ${activeTab !== 'edit' ? 'hidden md:block' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-800">교정본</span>
                      <span className="text-base text-slate-400">{editedBody.length}자</span>
                    </div>
                    {selected.status === 'confirmed' ? (
                      <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 min-h-[200px] whitespace-pre-wrap text-lg leading-relaxed text-slate-800">
                        {editedBody || '(내용 없음)'}
                      </div>
                    ) : (
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="w-full min-h-[200px] bg-white border border-slate-200 rounded-2xl p-4 text-lg leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none resize-y transition-all"
                        placeholder="교정 내용을 입력하세요"
                      />
                    )}

                    {/* 저장 / 확정 버튼 */}
                    {selected.status !== 'confirmed' && (
                      <div className="flex gap-3">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 h-14 bg-slate-600 text-white text-lg font-semibold rounded-xl shadow-sm hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? '저장 중...' : '저장'}
                        </button>
                        <button
                          onClick={handleConfirm}
                          disabled={confirming || !editedBody.trim()}
                          className="flex-1 h-14 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl shadow-sm hover:from-red-600 hover:to-red-700 disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {confirming ? '확정 중...' : '확정하기'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
