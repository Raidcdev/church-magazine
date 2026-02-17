/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'
import Timeline from '@/app/components/Timeline'
import ProgressOverview from '@/app/components/ProgressOverview'
import DiffView from '@/app/components/DiffView'

// ─── Types ───────────────────────────────────────────────
type Chapter = {
  id: string
  order_number: number
  chapter_code: string
  title: string
  writer_id: string | null
  status: string
  original_body: string | null
  edited_body: string | null
  edited_by: string | null
  edited_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

type Writer = { id: string; name: string }

type ChapterWithDetails = Chapter & {
  writer_name: string | null
  file_count: number
}

type FileRow = {
  id: string
  chapter_id: string
  file_url: string
  file_name: string
  file_size: number | null
  uploaded_at: string
}

type Schedule = {
  id: string
  title: string
  due_date: string
  order_number: number
}

type Toast = { message: string; type: 'success' | 'error' }
type FilterKey = 'all' | 'unassigned' | 'draft' | 'submitted' | 'editing' | 'reviewed' | 'confirmed'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif'])

function isImageFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.has(ext)
}

// ─── Toast ───────────────────────────────────────────────
function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-xl text-sm font-medium ${
      toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white' : 'bg-gradient-to-r from-red-500 to-red-400 text-white'
    }`}>
      {toast.message}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function EditorPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [session, setSession] = useState<{ userId: string; role: string; name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [chapters, setChapters] = useState<ChapterWithDetails[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [editingFiles, setEditingFiles] = useState<FileRow[]>([])
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Chapter management state (admin-like)
  const [writers, setWriters] = useState<Writer[]>([])
  const [assigningWriterId, setAssigningWriterId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ order_number: 1, chapter_code: '', title: '', writer_id: '' as string })
  const [chapterInfoEditingId, setChapterInfoEditingId] = useState<string | null>(null)
  const [editInfoForm, setEditInfoForm] = useState({ order_number: 1, chapter_code: '', title: '', writer_id: '' as string })

  // ─── Auth ──────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) { router.push('/'); return }
        const { session: sess } = await res.json()
        if (!sess) { router.push('/'); return }
        setSession(sess)
        setAuthChecked(true)
      } catch {
        router.push('/')
      }
    }
    checkAuth()
  }, [router])

  // ─── Data Loading ──────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!authChecked) return
    setLoading(true)
    try {
      const { data: chaptersData } = await (supabase
        .from('chapters') as any)
        .select('*')
        .order('order_number', { ascending: true }) as { data: Chapter[] | null }

      const { data: writersData } = await (supabase
        .from('users') as any)
        .select('id, name') as { data: Writer[] | null }

      const { data: filesData } = await (supabase
        .from('files') as any)
        .select('chapter_id') as { data: { chapter_id: string }[] | null }

      const { data: schedulesData } = await (supabase
        .from('schedules') as any)
        .select('id, title, due_date, order_number')
        .order('order_number', { ascending: true }) as { data: Schedule[] | null }

      setSchedules(schedulesData || [])

      const allUsers = writersData || []
      const writerMap = new Map(allUsers.map(w => [w.id, w.name]))
      setUserMap(writerMap)

      // Fetch writers for assignment dropdown
      const { data: writersList } = await (supabase
        .from('users') as any)
        .select('id, name')
        .eq('role', 'writer') as { data: Writer[] | null }
      setWriters(writersList || [])

      const fileCountMap = new Map<string, number>()
      if (filesData) {
        for (const f of filesData) {
          fileCountMap.set(f.chapter_id, (fileCountMap.get(f.chapter_id) || 0) + 1)
        }
      }

      setChapters((chaptersData || []).map((ch: Chapter) => ({
        ...ch,
        writer_name: ch.writer_id ? (writerMap.get(ch.writer_id) || null) : null,
        file_count: fileCountMap.get(ch.id) || 0,
      })))
    } catch {
      showToast('데이터를 불러오는데 실패했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [authChecked, supabase])

  useEffect(() => { loadData() }, [loadData])

  // ─── Helpers ───────────────────────────────────────────
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  const statusConfig: Record<string, { emoji: string; label: string; badgeCls: string }> = {
    draft: { emoji: '⚪', label: '미제출', badgeCls: 'bg-slate-100 text-slate-600' },
    submitted: { emoji: '🔵', label: '제출완료', badgeCls: 'bg-indigo-50 text-indigo-600' },
    editing: { emoji: '🟡', label: '교정중', badgeCls: 'bg-amber-50 text-amber-600' },
    reviewed: { emoji: '🟣', label: '교정완료', badgeCls: 'bg-purple-50 text-purple-600' },
    confirmed: { emoji: '🟢', label: '확정', badgeCls: 'bg-emerald-50 text-emerald-600' },
  }

  function fmtTime(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  // ─── Filtering ─────────────────────────────────────────
  const counts = {
    all: chapters.length,
    unassigned: chapters.filter(ch => !ch.writer_id).length,
    draft: chapters.filter(ch => ch.status === 'draft').length,
    submitted: chapters.filter(ch => ch.status === 'submitted').length,
    editing: chapters.filter(ch => ch.status === 'editing').length,
    reviewed: chapters.filter(ch => ch.status === 'reviewed').length,
    confirmed: chapters.filter(ch => ch.status === 'confirmed').length,
  }

  const filteredChapters = chapters.filter(ch => {
    if (filter === 'all') return true
    if (filter === 'unassigned') return !ch.writer_id
    return ch.status === filter
  })

  const filterTabs: { key: FilterKey; label: string; color: string }[] = [
    { key: 'all', label: '전체', color: 'bg-slate-800 text-white' },
    { key: 'unassigned', label: '미배정', color: 'bg-purple-500 text-white' },
    { key: 'draft', label: '미제출', color: 'bg-slate-500 text-white' },
    { key: 'submitted', label: '제출완료', color: 'bg-indigo-500 text-white' },
    { key: 'editing', label: '교정중', color: 'bg-amber-500 text-white' },
    { key: 'reviewed', label: '교정완료', color: 'bg-purple-500 text-white' },
    { key: 'confirmed', label: '확정', color: 'bg-emerald-500 text-white' },
  ]

  // ─── Actions ───────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  function openDetail(chapter: ChapterWithDetails) {
    setViewingId(chapter.id)
  }

  async function openEditing(chapter: ChapterWithDetails) {
    setViewingId(null)
    setEditingId(chapter.id)
    setEditedBody(chapter.edited_body ?? chapter.original_body ?? '')
    try {
      const { data: files } = await (supabase
        .from('files') as any)
        .select('*')
        .eq('chapter_id', chapter.id) as { data: FileRow[] | null }
      setEditingFiles(files || [])
    } catch {
      setEditingFiles([])
    }
  }

  async function handleSave() {
    const chapter = editingId ? chapters.find(c => c.id === editingId) : null
    if (!chapter || !session || chapter.status === 'confirmed' || chapter.status === 'reviewed') return

    setSaving(true)
    try {
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          edited_body: editedBody,
          status: 'editing',
          edited_by: session.userId,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .in('status', ['submitted', 'editing'])

      if (error) throw error

      showToast('저장되었습니다', 'success')
      setChapters(prev =>
        prev.map(c =>
          c.id === editingId
            ? { ...c, edited_body: editedBody, status: 'editing', edited_by: session.userId, edited_at: new Date().toISOString() }
            : c
        )
      )
    } catch {
      showToast('저장 중 오류가 발생했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReview() {
    if (!editingId || !session || !editedBody.trim()) return
    if (!window.confirm('교정을 완료하시겠습니까? 관리자 확정 후에는 수정이 불가합니다.')) return

    setConfirming(true)
    try {
      const now = new Date().toISOString()
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          edited_body: editedBody,
          status: 'reviewed',
          edited_by: session.userId,
          edited_at: now,
          reviewed_by: session.userId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', editingId)
        .in('status', ['submitted', 'editing'])

      if (error) throw error

      showToast('교정완료 처리되었습니다', 'success')
      setChapters(prev =>
        prev.map(c =>
          c.id === editingId
            ? { ...c, edited_body: editedBody, status: 'reviewed', reviewed_by: session.userId, reviewed_at: now, edited_by: session.userId, edited_at: now }
            : c
        )
      )
      setEditingId(null)
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err)
      console.error('handleReview error:', err)
      showToast(`교정완료 오류: ${msg}`, 'error')
    } finally {
      setConfirming(false)
    }
  }

  // ─── Chapter Management (admin-like) ──────────────────
  async function handleAssignWriter(e: React.MouseEvent, chapterId: string, writerId: string) {
    e.stopPropagation()
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        writer_id: writerId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chapterId)

    if (error) {
      showToast('필자 배정에 실패했습니다', 'error')
    } else {
      showToast('필자가 배정되었습니다', 'success')
      await loadData()
    }
    setAssigningWriterId(null)
  }

  function openAddForm() {
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_number)) + 1 : 1
    setAddForm({ order_number: nextOrder, chapter_code: '', title: '', writer_id: '' })
    setShowAddForm(true)
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
      writer_id: addForm.writer_id || null,
    })

    if (error) {
      showToast('항목 추가에 실패했습니다', 'error')
    } else {
      showToast('항목이 추가되었습니다', 'success')
      setShowAddForm(false)
      await loadData()
    }
  }

  function openChapterInfoEdit(chapter: ChapterWithDetails) {
    setViewingId(null)
    setChapterInfoEditingId(chapter.id)
    setEditInfoForm({
      order_number: chapter.order_number,
      chapter_code: chapter.chapter_code,
      title: chapter.title,
      writer_id: chapter.writer_id || '',
    })
  }

  async function handleUpdateChapter(chapterId: string) {
    if (!editInfoForm.chapter_code.trim() || !editInfoForm.title.trim()) {
      showToast('코드와 제목을 입력해주세요', 'error')
      return
    }
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        order_number: editInfoForm.order_number,
        chapter_code: editInfoForm.chapter_code.trim(),
        title: editInfoForm.title.trim(),
        writer_id: editInfoForm.writer_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chapterId)

    if (error) {
      showToast('수정에 실패했습니다', 'error')
    } else {
      showToast('수정되었습니다', 'success')
      setChapterInfoEditingId(null)
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
      setViewingId(null)
      await loadData()
    }
  }

  // ─── Auth gate ─────────────────────────────────────────
  if (!authChecked || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <p className="text-sm text-slate-400">로딩 중...</p>
      </div>
    )
  }

  const viewingChapter = viewingId ? chapters.find(c => c.id === viewingId) : null
  const editingChapter = editingId ? chapters.find(c => c.id === editingId) : null

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}

      <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-white shrink-0">교정 작업</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 hidden md:inline">{session.name}님</span>
            <a
              href="/guide/editor"
              className="h-8 w-8 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-500 rounded-lg hover:bg-slate-600 transition-colors"
              title="사용설명서"
            >
              ?
            </a>
            <button
              onClick={handleLogout}
              className="h-8 px-3 text-xs font-medium text-slate-300 border border-slate-500 rounded-lg hover:bg-slate-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Timeline schedules={schedules} />

            <ProgressOverview
              chapters={chapters.map(ch => ({
                order_number: ch.order_number,
                chapter_code: ch.chapter_code,
                title: ch.title,
                writer_id: ch.writer_id,
                writer_name: ch.writer_name,
                status: ch.status,
              }))}
            />

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {filterTabs.map(tab => {
                const isActive = filter === tab.key
                const count = counts[tab.key]
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? tab.color + ' shadow-sm'
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tab.label} {count}
                  </button>
                )
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm shadow-slate-200/50 overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-3 py-3 text-left font-semibold text-slate-600" style={{width:'40px'}}>순번</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600" style={{width:'60px'}}>목차</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600">제목</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600" style={{width:'110px'}}>필자</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600" style={{width:'90px'}}>상태</th>
                    <th className="px-3 py-3 text-center font-semibold text-slate-600" style={{width:'50px'}}>파일</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600" style={{width:'80px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChapters.map((ch, idx) => {
                    const cfg = statusConfig[ch.status] || statusConfig.draft
                    const canEdit = ch.status === 'submitted' || ch.status === 'editing'
                    return (
                      <tr
                        key={ch.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => openDetail(ch)}
                      >
                        <td className="px-3 py-3 text-slate-400">{ch.order_number}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{ch.chapter_code}</td>
                        <td className="px-3 py-3 text-slate-800 truncate">{ch.title}</td>
                        <td className="px-3 py-3 text-slate-600 truncate">
                          {ch.writer_name ? (
                            ch.writer_name
                          ) : assigningWriterId === ch.id ? (
                            <select
                              autoFocus
                              className="w-full text-sm bg-white border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              defaultValue=""
                              onClick={e => e.stopPropagation()}
                              onChange={e => handleAssignWriter(e as any, ch.id, e.target.value)}
                              onBlur={() => setAssigningWriterId(null)}
                            >
                              <option value="" disabled>필자 선택</option>
                              {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setAssigningWriterId(ch.id) }}
                              className="text-purple-500 hover:text-purple-700 hover:underline text-sm font-medium transition-colors"
                            >
                              미배정
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${cfg.badgeCls}`}>
                            {cfg.emoji}{cfg.label}
                          </span>
                          {ch.status !== 'draft' && (ch.submitted_at || ch.updated_at) && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {ch.submitted_at ? fmtTime(ch.submitted_at) : fmtTime(ch.updated_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600">{ch.file_count}</td>
                        <td className="px-3 py-3 text-right">
                          {canEdit ? (
                            <span className="text-xs text-indigo-500 font-medium">교정가능</span>
                          ) : (
                            <span className="text-xs text-slate-400">상세보기</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredChapters.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                        해당하는 항목이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filteredChapters.map(ch => {
                const cfg = statusConfig[ch.status] || statusConfig.draft
                return (
                  <div
                    key={ch.id}
                    className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 p-4 active:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openDetail(ch)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-slate-800 truncate">
                          <span className="text-slate-400 font-normal mr-1">{ch.chapter_code}.</span>
                          {ch.title}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {ch.writer_name ? (
                            <span className="text-sm text-indigo-600 font-medium">{ch.writer_name}</span>
                          ) : assigningWriterId === ch.id ? (
                            <select
                              autoFocus
                              className="text-sm bg-white border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              defaultValue=""
                              onClick={e => e.stopPropagation()}
                              onChange={e => handleAssignWriter(e as any, ch.id, e.target.value)}
                              onBlur={() => setAssigningWriterId(null)}
                            >
                              <option value="" disabled>필자 선택</option>
                              {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setAssigningWriterId(ch.id) }}
                              className="text-sm text-purple-500 hover:text-purple-700 font-medium transition-colors"
                            >
                              미배정
                            </button>
                          )}
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${cfg.badgeCls}`}>
                            {cfg.emoji}{cfg.label}
                          </span>
                          {ch.file_count > 0 && (
                            <span className="text-xs text-slate-400">파일 {ch.file_count}</span>
                          )}
                        </div>
                        {ch.status !== 'draft' && (ch.submitted_at || ch.updated_at) && (
                          <div className="text-[11px] text-slate-400 mt-1">
                            {ch.submitted_at ? `제출 ${fmtTime(ch.submitted_at)}` : `저장 ${fmtTime(ch.updated_at)}`}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 text-slate-300 shrink-0 mt-1">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredChapters.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">해당하는 항목이 없습니다</div>
              )}
            </div>
            {/* Add Chapter Button */}
            <button
              onClick={openAddForm}
              className="h-12 w-full text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              + 항목 추가
            </button>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {viewingId && viewingChapter && (
        <DetailModal
          chapter={viewingChapter}
          statusConfig={statusConfig}
          fmtTime={fmtTime}
          userMap={userMap}
          onClose={() => setViewingId(null)}
          onEdit={
            (viewingChapter.status === 'submitted' || viewingChapter.status === 'editing')
              ? () => openEditing(viewingChapter)
              : undefined
          }
          onEditInfo={() => openChapterInfoEdit(viewingChapter)}
          onDelete={viewingChapter.status === 'draft' ? () => handleDeleteChapter(viewingChapter) : undefined}
          showDiff={!!viewingChapter.edited_body && !!viewingChapter.original_body}
        />
      )}

      {/* Editing Modal */}
      {editingId && editingChapter && (
        <EditingModal
          chapter={editingChapter}
          editedBody={editedBody}
          files={editingFiles}
          saving={saving}
          confirming={confirming}
          userMap={userMap}
          onEditedBodyChange={setEditedBody}
          onSave={handleSave}
          onReview={handleReview}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Chapter Info Edit Modal */}
      {chapterInfoEditingId && (() => {
        const ch = chapters.find(c => c.id === chapterInfoEditingId)
        return ch ? (
          <ChapterModal
            mode="edit"
            form={editInfoForm}
            setForm={setEditInfoForm}
            writers={writers}
            onSave={() => handleUpdateChapter(chapterInfoEditingId)}
            onClose={() => setChapterInfoEditingId(null)}
            onDelete={ch.status === 'draft' ? () => handleDeleteChapter(ch) : undefined}
          />
        ) : null
      })()}

      {/* Chapter Add Modal */}
      {showAddForm && (
        <ChapterModal
          mode="add"
          form={addForm}
          setForm={setAddForm}
          writers={writers}
          onSave={handleAddChapter}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

// ─── Detail Modal ────────────────────────────────────────
function DetailModal({
  chapter,
  statusConfig,
  fmtTime,
  userMap,
  onClose,
  onEdit,
  onEditInfo,
  onDelete,
  showDiff,
}: {
  chapter: ChapterWithDetails
  statusConfig: Record<string, { emoji: string; label: string; badgeCls: string }>
  fmtTime: (iso: string | null) => string
  userMap: Map<string, string>
  onClose: () => void
  onEdit?: () => void
  onEditInfo?: () => void
  onDelete?: () => void
  showDiff?: boolean
}) {
  const [tab, setTab] = useState<'original' | 'edited'>('original')
  const cfg = statusConfig[chapter.status] || statusConfig.draft
  const editorName = chapter.edited_by ? userMap.get(chapter.edited_by) : null
  const confirmerName = chapter.confirmed_by ? userMap.get(chapter.confirmed_by) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl md:max-w-5xl md:h-[85vh] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${cfg.badgeCls}`}>
                  {cfg.emoji}{cfg.label}
                </span>
                {chapter.file_count > 0 && (
                  <span className="text-xs text-slate-400">파일 {chapter.file_count}개</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {chapter.chapter_code}. {chapter.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                <span className={chapter.writer_name ? 'text-indigo-600 font-medium' : 'text-slate-400'}>
                  필자: {chapter.writer_name || '미배정'}
                </span>
                {chapter.submitted_at && (
                  <span className="text-slate-400 text-xs">제출 {fmtTime(chapter.submitted_at)}</span>
                )}
                {editorName && (
                  <span className="text-amber-600 text-xs">교정: {editorName} {chapter.edited_at ? fmtTime(chapter.edited_at) : ''}</span>
                )}
                {confirmerName && chapter.confirmed_at && (
                  <span className="text-emerald-500 text-xs">확정: {confirmerName} {fmtTime(chapter.confirmed_at)}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 ml-3">
              ✕
            </button>
          </div>
        </div>

        {/* Mobile: tab toggle */}
        <div className="flex md:hidden border-b border-slate-100 shrink-0">
          <button
            onClick={() => setTab('original')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              tab === 'original' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            원본
          </button>
          <button
            onClick={() => setTab('edited')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              tab === 'edited' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            교정본
          </button>
        </div>

        {/* Desktop: side-by-side / Mobile: tab content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {/* Desktop 2-panel */}
          <div className="hidden md:grid md:grid-cols-2 md:divide-x md:divide-slate-100 h-full">
            <div className="flex flex-col min-h-0">
              <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
                <span className="text-sm font-semibold text-slate-600">원본</span>
                <span className="text-xs text-slate-400 ml-2">{(chapter.original_body ?? '').length}자</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                  {chapter.original_body || <span className="text-slate-400">(내용 없음)</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col min-h-0">
              <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
                <span className="text-sm font-semibold text-slate-600">교정본</span>
                <span className="text-xs text-slate-400 ml-2">{(chapter.edited_body ?? '').length}자</span>
                {showDiff && <span className="text-xs text-purple-500 ml-2">변경사항 표시</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {showDiff ? (
                  <DiffView original={chapter.original_body ?? ''} edited={chapter.edited_body ?? ''} />
                ) : (
                  <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                    {chapter.edited_body || <span className="text-slate-400">(교정본 없음)</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile single panel */}
          <div className="md:hidden flex-1 overflow-y-auto p-5">
            {tab === 'original' ? (
              <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 min-h-[120px]">
                {chapter.original_body || <span className="text-slate-400">(내용 없음)</span>}
              </div>
            ) : showDiff ? (
              <div className="min-h-[120px]">
                <DiffView original={chapter.original_body ?? ''} edited={chapter.edited_body ?? ''} />
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 min-h-[120px]">
                {chapter.edited_body || <span className="text-slate-400">(교정본 없음)</span>}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex flex-wrap gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="h-10 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              교정하기
            </button>
          )}
          {onEditInfo && (
            <button
              onClick={onEditInfo}
              className="h-10 px-4 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              정보 수정
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 px-4 text-sm font-medium text-red-400 hover:text-red-600 transition-colors ml-auto"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 px-4 text-sm font-medium text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Editing Modal ───────────────────────────────────────
function EditingModal({
  chapter,
  editedBody,
  files,
  saving,
  confirming,
  userMap,
  onEditedBodyChange,
  onSave,
  onReview,
  onClose,
}: {
  chapter: ChapterWithDetails
  editedBody: string
  files: FileRow[]
  saving: boolean
  confirming: boolean
  userMap: Map<string, string>
  onEditedBodyChange: (val: string) => void
  onSave: () => void
  onReview: () => void
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'original' | 'edit'>('edit')
  const imageFiles = files.filter(f => isImageFile(f.file_name))
  const docFiles = files.filter(f => !isImageFile(f.file_name))
  const editorName = chapter.edited_by ? userMap.get(chapter.edited_by) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] md:h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-slate-800 truncate">
                {chapter.chapter_code}. {chapter.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-sm">
                <span className={chapter.writer_name ? 'text-indigo-600 font-medium' : 'text-slate-400'}>
                  필자: {chapter.writer_name || '미배정'}
                </span>
                {editorName && (
                  <span className="text-amber-600 text-xs">
                    교정: {editorName} {chapter.edited_at ? `(${new Date(chapter.edited_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})` : ''}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  원본 {(chapter.original_body ?? '').length}자 / 교정 {editedBody.length}자
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 ml-3">
              ✕
            </button>
          </div>
        </div>

        {/* Mobile tab toggle */}
        <div className="flex md:hidden gap-2 px-5 py-2 border-b border-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('original')}
            className={`flex-1 h-9 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'original' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            원본
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 h-9 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'edit' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            교정
          </button>
        </div>

        {/* Content: 2-panel desktop, tabs mobile — fixed equal height */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-100 min-h-0">
          {/* Original Panel */}
          <div className={`flex flex-col min-h-0 ${activeTab !== 'original' ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0 hidden md:block">
              <span className="text-sm font-semibold text-slate-600">원본</span>
              <span className="text-xs text-slate-400 ml-2">{(chapter.original_body ?? '').length}자</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                {chapter.original_body || <span className="text-slate-400">(내용 없음)</span>}
              </div>

              {imageFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">사진 ({imageFiles.length})</p>
                  <div className="flex flex-wrap gap-3">
                    {imageFiles.map(f => (
                      <button
                        key={f.id}
                        onClick={() => window.open(f.file_url, '_blank')}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition-colors"
                      >
                        <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {docFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">참고파일 ({docFiles.length})</p>
                  <div className="space-y-1.5">
                    {docFiles.map(f => (
                      <a
                        key={f.id}
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                      >
                        <span className="text-sm shrink-0">📄</span>
                        <span className="text-sm text-indigo-600 truncate">{f.file_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edit Panel — textarea fills full height */}
          <div className={`flex flex-col min-h-0 ${activeTab !== 'edit' ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0 hidden md:block">
              <span className="text-sm font-semibold text-slate-600">교정</span>
              <span className="text-xs text-slate-400 ml-2">{editedBody.length}자</span>
            </div>
            <div className="flex-1 flex flex-col p-4 min-h-0">
              <textarea
                value={editedBody}
                onChange={(e) => onEditedBodyChange(e.target.value)}
                className="flex-1 w-full min-h-0 bg-white border border-slate-200 rounded-xl p-3 text-base leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none resize-none transition-all"
                placeholder="교정 내용을 입력하세요"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 h-10 bg-slate-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : '임시저장'}
          </button>
          <button
            onClick={onReview}
            disabled={confirming || !editedBody.trim()}
            className="flex-1 h-10 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:from-purple-600 hover:to-purple-700 disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {confirming ? '교정완료 처리 중...' : '교정완료'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Chapter Modal (Add / Edit Info) ────────────────────
function ChapterModal({
  mode,
  form,
  setForm,
  writers,
  onSave,
  onClose,
  onDelete,
}: {
  mode: 'edit' | 'add'
  form: { order_number: number; chapter_code: string; title: string; writer_id: string }
  setForm: (f: { order_number: number; chapter_code: string; title: string; writer_id: string }) => void
  writers: Writer[]
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
}) {
  const inputCls = 'h-11 px-4 text-base bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all w-full'
  const selectCls = 'h-11 px-4 text-base bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {mode === 'edit' ? '항목 수정' : '새 항목 추가'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            ✕
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">순번</label>
              <p className="text-xs text-slate-400 mb-1.5">정렬 순서 (작을수록 위에 표시)</p>
              <input
                type="number"
                value={form.order_number}
                onChange={e => setForm({ ...form, order_number: parseInt(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">목차 번호</label>
              <p className="text-xs text-slate-400 mb-1.5">인쇄본에 표시될 번호</p>
              <input
                type="text"
                value={form.chapter_code}
                onChange={e => setForm({ ...form, chapter_code: e.target.value })}
                placeholder="예: 1, 3-1, 6-2"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">제목</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="제목을 입력하세요"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">필자 배정</label>
            <select
              value={form.writer_id}
              onChange={e => setForm({ ...form, writer_id: e.target.value })}
              className={selectCls}
            >
              <option value="">미배정</option>
              {writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 space-y-2">
          <button
            onClick={onSave}
            className="h-12 w-full text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
          >
            {mode === 'edit' ? '수정 완료' : '추가하기'}
          </button>
          <button
            onClick={onClose}
            className="h-12 w-full text-base font-medium text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            취소
          </button>
          {mode === 'edit' && onDelete && (
            <button
              onClick={onDelete}
              className="h-10 w-full text-sm font-medium text-red-400 hover:text-red-600 transition-colors mt-1"
            >
              이 항목 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
