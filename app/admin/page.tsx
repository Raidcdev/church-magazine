/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────
type Chapter = {
  id: string
  order_number: number
  chapter_code: string
  title: string
  category: string | null
  writer_id: string | null
  status: string
  original_body: string | null
  edited_body: string | null
  edited_by: string | null
  edited_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

type Writer = {
  id: string
  name: string
}

type ChapterWithDetails = Chapter & {
  writer_name: string | null
  file_count: number
}

type FileRecord = {
  id: string
  file_url: string
  file_name: string
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

// ─── Toast Component ─────────────────────────────────────
function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-lg font-medium ${
      toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {toast.message}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  // Auth
  const [session, setSession] = useState<{ userId: string; role: string; name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Data
  const [chapters, setChapters] = useState<ChapterWithDetails[]>([])
  const [writers, setWriters] = useState<Writer[]>([])

  // UI
  const [activeTab, setActiveTab] = useState<'status' | 'toc'>('status')
  const [toast, setToast] = useState<Toast | null>(null)
  const [loading, setLoading] = useState(true)

  // TOC management
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({
    order_number: 1,
    chapter_code: '',
    title: '',
    category: '' as string,
    writer_id: '' as string,
  })
  const [editForm, setEditForm] = useState({
    order_number: 1,
    chapter_code: '',
    title: '',
    category: '' as string,
    writer_id: '' as string,
  })

  // ─── Auth Check ──────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) { router.push('/'); return }
        const { session: sess } = await res.json()
        if (!sess || sess.role !== 'admin') { router.push('/'); return }
        setSession(sess)
        setAuthChecked(true)
      } catch {
        router.push('/')
      }
    }
    checkAuth()
  }, [router])

  // ─── Data Loading ────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!authChecked) return
    setLoading(true)
    try {
      // Load chapters
      const { data: chaptersData } = await (supabase
        .from('chapters') as any)
        .select('*')
        .order('order_number', { ascending: true }) as { data: Chapter[] | null }

      // Load writers
      const { data: writersData } = await (supabase
        .from('users') as any)
        .select('id, name')
        .eq('role', 'writer') as { data: Writer[] | null }

      // Load file counts
      const { data: filesData } = await (supabase
        .from('files') as any)
        .select('chapter_id') as { data: { chapter_id: string }[] | null }

      const writersList = (writersData || []) as Writer[]
      setWriters(writersList)

      const writerMap = new Map(writersList.map(w => [w.id, w.name]))

      // Count files per chapter
      const fileCountMap = new Map<string, number>()
      if (filesData) {
        for (const f of filesData) {
          const cid = f.chapter_id
          fileCountMap.set(cid, (fileCountMap.get(cid) || 0) + 1)
        }
      }

      const enriched: ChapterWithDetails[] = (chaptersData || []).map((ch: Chapter) => ({
        ...ch,
        writer_name: ch.writer_id ? (writerMap.get(ch.writer_id) || null) : null,
        file_count: fileCountMap.get(ch.id) || 0,
      }))

      setChapters(enriched)
    } catch {
      showToast('데이터를 불러오는데 실패했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [authChecked, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Helpers ─────────────────────────────────────────
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  const statusConfig: Record<string, { emoji: string; label: string; badgeCls: string; cardCls: string }> = {
    draft: { emoji: '⚪', label: '미제출', badgeCls: 'bg-gray-200 text-gray-700', cardCls: 'bg-gray-50 border-gray-300' },
    submitted: { emoji: '🔵', label: '제출완료', badgeCls: 'bg-blue-100 text-blue-700', cardCls: 'bg-blue-50 border-blue-300' },
    editing: { emoji: '🟡', label: '교정중', badgeCls: 'bg-yellow-100 text-yellow-700', cardCls: 'bg-yellow-50 border-yellow-300' },
    confirmed: { emoji: '🟢', label: '확정', badgeCls: 'bg-green-100 text-green-700', cardCls: 'bg-green-50 border-green-300' },
  }

  function getStatusCounts() {
    const counts: Record<string, number> = { draft: 0, submitted: 0, editing: 0, confirmed: 0 }
    for (const ch of chapters) {
      if (counts[ch.status] !== undefined) counts[ch.status]++
    }
    return counts
  }

  // ─── Actions ─────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  async function handleUnconfirm(chapterId: string) {
    if (!confirm('확정을 해제하시겠습니까?')) return
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        status: 'editing',
        confirmed_by: null,
        confirmed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chapterId)
      .eq('status', 'confirmed')

    if (error) {
      showToast('확정 해제에 실패했습니다', 'error')
    } else {
      showToast('확정이 해제되었습니다', 'success')
      await loadData()
    }
  }

  function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownload(chapter: ChapterWithDetails) {
    // Download edited_body as text file
    if (chapter.edited_body) {
      downloadText(`${chapter.chapter_code}_${chapter.title}.txt`, chapter.edited_body)
    }
    // Fetch and open attached files
    const { data: files } = await (supabase
      .from('files') as any)
      .select('id, file_url, file_name')
      .eq('chapter_id', chapter.id)

    if (files && files.length > 0) {
      for (const f of files as FileRecord[]) {
        window.open(f.file_url, '_blank')
      }
    }
  }

  async function handleAddChapter() {
    if (!addForm.chapter_code.trim() || !addForm.title.trim()) {
      showToast('코드와 제목을 입력해주세요', 'error')
      return
    }
    const { error } = await (supabase.from('chapters') as any).insert({
      order_number: addForm.order_number,
      chapter_code: addForm.chapter_code.trim(),
      title: addForm.title.trim(),
      category: addForm.category || null,
      writer_id: addForm.writer_id || null,
    })

    if (error) {
      showToast('항목 추가에 실패했습니다', 'error')
    } else {
      showToast('항목이 추가되었습니다', 'success')
      setShowAddForm(false)
      setAddForm({ order_number: chapters.length + 2, chapter_code: '', title: '', category: '', writer_id: '' })
      await loadData()
    }
  }

  async function handleUpdateChapter(chapterId: string) {
    if (!editForm.chapter_code.trim() || !editForm.title.trim()) {
      showToast('코드와 제목을 입력해주세요', 'error')
      return
    }
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        order_number: editForm.order_number,
        chapter_code: editForm.chapter_code.trim(),
        title: editForm.title.trim(),
        category: editForm.category || null,
        writer_id: editForm.writer_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chapterId)

    if (error) {
      showToast('수정에 실패했습니다', 'error')
    } else {
      showToast('수정되었습니다', 'success')
      setEditingId(null)
      await loadData()
    }
  }

  async function handleDeleteChapter(chapter: ChapterWithDetails) {
    if (chapter.status !== 'draft') {
      showToast('제출된 항목은 삭제할 수 없습니다', 'error')
      return
    }
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    const { error } = await (supabase
      .from('chapters') as any)
      .delete()
      .eq('id', chapter.id)
      .eq('status', 'draft')

    if (error) {
      showToast('삭제에 실패했습니다', 'error')
    } else {
      showToast('삭제되었습니다', 'success')
      await loadData()
    }
  }

  function startEdit(chapter: ChapterWithDetails) {
    setEditingId(chapter.id)
    setEditForm({
      order_number: chapter.order_number,
      chapter_code: chapter.chapter_code,
      title: chapter.title,
      category: chapter.category || '',
      writer_id: chapter.writer_id || '',
    })
  }

  function openAddForm() {
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_number)) + 1 : 1
    setAddForm({ order_number: nextOrder, chapter_code: '', title: '', category: '', writer_id: '' })
    setShowAddForm(true)
  }

  // ─── Auth gate ───────────────────────────────────────
  if (!authChecked || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-500">로딩 중...</p>
      </div>
    )
  }

  const counts = getStatusCounts()

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">⚙️ 관리자 대시보드</h1>
          <div className="flex items-center gap-3">
            <span className="text-lg text-gray-600">{session.name}님</span>
            <button
              onClick={handleLogout}
              className="h-10 px-4 text-base font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-0">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-6 py-3 text-lg font-medium border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            현황
          </button>
          <button
            onClick={() => setActiveTab('toc')}
            className={`px-6 py-3 text-lg font-medium border-b-2 transition-colors ${
              activeTab === 'toc'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            목차관리
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-lg text-gray-500">데이터를 불러오는 중...</p>
          </div>
        ) : activeTab === 'status' ? (
          <StatusTab
            chapters={chapters}
            counts={counts}
            statusConfig={statusConfig}
            onUnconfirm={handleUnconfirm}
            onDownload={handleDownload}
          />
        ) : (
          <TocTab
            chapters={chapters}
            writers={writers}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            showAddForm={showAddForm}
            addForm={addForm}
            setAddForm={setAddForm}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={handleUpdateChapter}
            onDelete={handleDeleteChapter}
            onOpenAddForm={openAddForm}
            onCancelAdd={() => setShowAddForm(false)}
            onSaveAdd={handleAddChapter}
          />
        )}
      </main>
    </div>
  )
}

// ─── Status Tab ──────────────────────────────────────────
function StatusTab({
  chapters,
  counts,
  statusConfig,
  onUnconfirm,
  onDownload,
}: {
  chapters: ChapterWithDetails[]
  counts: Record<string, number>
  statusConfig: Record<string, { emoji: string; label: string; badgeCls: string; cardCls: string }>
  onUnconfirm: (id: string) => void
  onDownload: (ch: ChapterWithDetails) => void
}) {
  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['draft', 'submitted', 'editing', 'confirmed'] as const).map(status => {
          const cfg = statusConfig[status]
          return (
            <div key={status} className={`border rounded-xl p-4 ${cfg.cardCls}`}>
              <div className="text-base text-gray-600">{cfg.emoji} {cfg.label}</div>
              <div className="text-2xl font-bold mt-1">{counts[status]}건</div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-lg">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-20">코드</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">필자</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">상태</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-16">📷</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-48">액션</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch, idx) => {
              const cfg = statusConfig[ch.status] || statusConfig.draft
              return (
                <tr key={ch.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{ch.chapter_code}</td>
                  <td className="px-4 py-3">{ch.title}</td>
                  <td className="px-4 py-3 text-gray-600">{ch.writer_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-lg text-base font-medium ${cfg.badgeCls}`}>
                      {cfg.emoji}{cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{ch.file_count}</td>
                  <td className="px-4 py-3">
                    {ch.status === 'confirmed' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onDownload(ch)}
                          className="px-3 py-1.5 text-base font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          다운로드
                        </button>
                        <button
                          onClick={() => onUnconfirm(ch.id)}
                          className="px-3 py-1.5 text-base font-medium text-red-600 hover:text-red-800 transition-colors"
                        >
                          확정해제
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {chapters.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-lg">
                  등록된 항목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {chapters.map(ch => {
          const cfg = statusConfig[ch.status] || statusConfig.draft
          return (
            <div key={ch.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="text-lg font-semibold">{ch.chapter_code}. {ch.title}</div>
              <div className="text-base text-gray-600">
                필자: {ch.writer_name || '미배정'} &nbsp; 📷 {ch.file_count}장
              </div>
              <div>
                <span className={`inline-block px-2 py-1 rounded-lg text-base font-medium ${cfg.badgeCls}`}>
                  {cfg.emoji} {cfg.label}
                </span>
              </div>
              {ch.status === 'confirmed' && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => onDownload(ch)}
                    className="h-12 px-4 text-base font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    다운로드
                  </button>
                  <button
                    onClick={() => onUnconfirm(ch.id)}
                    className="h-12 px-4 text-base font-medium text-red-600 hover:text-red-800 transition-colors"
                  >
                    확정해제
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {chapters.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-lg">등록된 항목이 없습니다</div>
        )}
      </div>
    </div>
  )
}

// ─── TOC Tab ─────────────────────────────────────────────
function TocTab({
  chapters,
  writers,
  editingId,
  editForm,
  setEditForm,
  showAddForm,
  addForm,
  setAddForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onOpenAddForm,
  onCancelAdd,
  onSaveAdd,
}: {
  chapters: ChapterWithDetails[]
  writers: Writer[]
  editingId: string | null
  editForm: { order_number: number; chapter_code: string; title: string; category: string; writer_id: string }
  setEditForm: (f: { order_number: number; chapter_code: string; title: string; category: string; writer_id: string }) => void
  showAddForm: boolean
  addForm: { order_number: number; chapter_code: string; title: string; category: string; writer_id: string }
  setAddForm: (f: { order_number: number; chapter_code: string; title: string; category: string; writer_id: string }) => void
  onStartEdit: (ch: ChapterWithDetails) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onDelete: (ch: ChapterWithDetails) => void
  onOpenAddForm: () => void
  onCancelAdd: () => void
  onSaveAdd: () => void
}) {
  const categoryOptions = ['봄', '여름', '가을', '겨울']
  const canDelete = (status: string) => status === 'draft'

  const inputCls = 'h-12 px-3 text-lg border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none'
  const selectCls = 'h-12 px-3 text-lg border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white'

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-lg">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-16">순번</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-20">코드</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">분류</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">필자</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-40">액션</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map(ch => (
              <tr key={ch.id} className="border-b border-gray-100">
                {editingId === ch.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editForm.order_number}
                        onChange={e => setEditForm({ ...editForm, order_number: parseInt(e.target.value) || 0 })}
                        className={`${inputCls} w-16`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.chapter_code}
                        onChange={e => setEditForm({ ...editForm, chapter_code: e.target.value })}
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        className={`${selectCls} w-24`}
                      >
                        <option value="">미지정</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.writer_id}
                        onChange={e => setEditForm({ ...editForm, writer_id: e.target.value })}
                        className={`${selectCls} w-28`}
                      >
                        <option value="">미배정</option>
                        {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSaveEdit(ch.id)}
                          className="px-3 py-1.5 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="px-3 py-1.5 text-base font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-gray-500">{ch.order_number}</td>
                    <td className="px-4 py-3 font-medium">{ch.chapter_code}</td>
                    <td className="px-4 py-3">{ch.title}</td>
                    <td className="px-4 py-3 text-gray-600">{ch.category || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{ch.writer_name || '미배정'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onStartEdit(ch)}
                          className="px-3 py-1.5 text-base font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          수정
                        </button>
                        {canDelete(ch.status) && (
                          <button
                            onClick={() => onDelete(ch)}
                            className="px-3 py-1.5 text-base font-medium text-red-600 hover:text-red-800 transition-colors"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {chapters.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-lg">
                  등록된 항목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {chapters.map(ch => (
          <div key={ch.id} className="bg-white rounded-xl border border-gray-200 p-4">
            {editingId === ch.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-base text-gray-600 mb-1">순번</label>
                    <input
                      type="number"
                      value={editForm.order_number}
                      onChange={e => setEditForm({ ...editForm, order_number: parseInt(e.target.value) || 0 })}
                      className={`${inputCls} w-full`}
                    />
                  </div>
                  <div>
                    <label className="block text-base text-gray-600 mb-1">코드</label>
                    <input
                      type="text"
                      value={editForm.chapter_code}
                      onChange={e => setEditForm({ ...editForm, chapter_code: e.target.value })}
                      className={`${inputCls} w-full`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-base text-gray-600 mb-1">제목</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-base text-gray-600 mb-1">분류</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                      className={`${selectCls} w-full`}
                    >
                      <option value="">미지정</option>
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-base text-gray-600 mb-1">필자</label>
                    <select
                      value={editForm.writer_id}
                      onChange={e => setEditForm({ ...editForm, writer_id: e.target.value })}
                      className={`${selectCls} w-full`}
                    >
                      <option value="">미배정</option>
                      {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => onSaveEdit(ch.id)}
                    className="h-12 px-5 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    저장
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="h-12 px-5 text-base font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{ch.chapter_code}. {ch.title}</div>
                    <div className="text-base text-gray-600 mt-1">
                      분류: {ch.category || '-'} · 필자: {ch.writer_name || '미배정'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => onStartEdit(ch)}
                    className="h-12 px-4 text-base font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    수정
                  </button>
                  {canDelete(ch.status) && (
                    <button
                      onClick={() => onDelete(ch)}
                      className="h-12 px-4 text-base font-medium text-red-600 hover:text-red-800 transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {chapters.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-lg">등록된 항목이 없습니다</div>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">새 항목 추가</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-base text-gray-600 mb-1">순번</label>
              <input
                type="number"
                value={addForm.order_number}
                onChange={e => setAddForm({ ...addForm, order_number: parseInt(e.target.value) || 0 })}
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-base text-gray-600 mb-1">코드</label>
              <input
                type="text"
                value={addForm.chapter_code}
                onChange={e => setAddForm({ ...addForm, chapter_code: e.target.value })}
                placeholder="예: 1-2"
                className={`${inputCls} w-full`}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-base text-gray-600 mb-1">제목</label>
              <input
                type="text"
                value={addForm.title}
                onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="제목을 입력하세요"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-base text-gray-600 mb-1">분류</label>
              <select
                value={addForm.category}
                onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                className={`${selectCls} w-full`}
              >
                <option value="">미지정</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-base text-gray-600 mb-1">필자</label>
              <select
                value={addForm.writer_id}
                onChange={e => setAddForm({ ...addForm, writer_id: e.target.value })}
                className={`${selectCls} w-full`}
              >
                <option value="">미배정</option>
                {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSaveAdd}
              className="h-12 px-6 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
            <button
              onClick={onCancelAdd}
              className="h-12 px-6 text-lg font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showAddForm && (
        <button
          onClick={onOpenAddForm}
          className="h-14 w-full text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
        >
          ＋ 항목 추가
        </button>
      )}
    </div>
  )
}
