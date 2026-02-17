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

type Schedule = {
  id: string
  title: string
  due_date: string
  order_number: number
  completed: boolean
  completed_at: string | null
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

type FilterKey = 'all' | 'unassigned' | 'draft' | 'submitted' | 'editing' | 'reviewed' | 'confirmed'

// ─── Toast Component ─────────────────────────────────────
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
export default function AdminPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  // Auth
  const [session, setSession] = useState<{ userId: string; role: string; name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Data
  const [chapters, setChapters] = useState<ChapterWithDetails[]>([])
  const [writers, setWriters] = useState<Writer[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // UI
  const [toast, setToast] = useState<Toast | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')

  // Chapter editing / viewing
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [assigningWriterId, setAssigningWriterId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({
    order_number: 1,
    chapter_code: '',
    title: '',
    writer_id: '' as string,
  })
  const [editForm, setEditForm] = useState({
    order_number: 1,
    chapter_code: '',
    title: '',
    writer_id: '' as string,
  })

  // Schedule editing
  const [editingSchedule, setEditingSchedule] = useState(false)

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
      const { data: chaptersData } = await (supabase
        .from('chapters') as any)
        .select('*')
        .order('order_number', { ascending: true }) as { data: Chapter[] | null }

      const { data: writersData } = await (supabase
        .from('users') as any)
        .select('id, name')
        .eq('role', 'writer') as { data: Writer[] | null }

      const { data: filesData } = await (supabase
        .from('files') as any)
        .select('chapter_id') as { data: { chapter_id: string }[] | null }

      const { data: schedulesData } = await (supabase
        .from('schedules') as any)
        .select('*')
        .order('order_number', { ascending: true }) as { data: Schedule[] | null }

      setSchedules(schedulesData || [])

      const writersList = (writersData || []) as Writer[]
      setWriters(writersList)

      const writerMap = new Map(writersList.map(w => [w.id, w.name]))

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

  // ─── Chapter Actions ───────────────────────────────────
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  async function handleConfirm(e: React.MouseEvent, chapterId: string) {
    e.stopPropagation()
    if (!session) return
    if (!confirm('이 원고를 확정하시겠습니까?')) return
    const now = new Date().toISOString()
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        status: 'confirmed',
        confirmed_by: session.userId,
        confirmed_at: now,
        updated_at: now,
      })
      .eq('id', chapterId)
      .eq('status', 'reviewed')

    if (error) {
      showToast('확정에 실패했습니다', 'error')
    } else {
      showToast('확정되었습니다', 'success')
      await loadData()
    }
  }

  async function handleUnconfirm(e: React.MouseEvent, chapterId: string) {
    e.stopPropagation()
    if (!confirm('확정을 해제하시겠습니까? 교정완료 상태로 되돌아갑니다.')) return
    const { error } = await (supabase
      .from('chapters') as any)
      .update({
        status: 'reviewed',
        confirmed_by: null,
        confirmed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chapterId)
      .eq('status', 'confirmed')

    if (error) {
      showToast('확정 해제에 실패했습니다', 'error')
    } else {
      showToast('교정완료 상태로 되돌렸습니다', 'success')
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

  async function handleDownload(e: React.MouseEvent, chapter: ChapterWithDetails) {
    e.stopPropagation()
    if (chapter.edited_body) {
      downloadText(`${chapter.chapter_code}_${chapter.title}.txt`, chapter.edited_body)
    }
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
      writer_id: addForm.writer_id || null,
    })

    if (error) {
      showToast('항목 추가에 실패했습니다', 'error')
    } else {
      showToast('항목이 추가되었습니다', 'success')
      setShowAddForm(false)
      setAddForm({ order_number: chapters.length + 2, chapter_code: '', title: '', writer_id: '' })
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
      setViewingId(null)
      await loadData()
    }
  }

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

  function openDetail(chapter: ChapterWithDetails) {
    setViewingId(chapter.id)
  }

  function openEditFromDetail(chapter: ChapterWithDetails) {
    setViewingId(null)
    setEditingId(chapter.id)
    setEditForm({
      order_number: chapter.order_number,
      chapter_code: chapter.chapter_code,
      title: chapter.title,
      writer_id: chapter.writer_id || '',
    })
  }

  function openAddForm() {
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_number)) + 1 : 1
    setAddForm({ order_number: nextOrder, chapter_code: '', title: '', writer_id: '' })
    setShowAddForm(true)
  }

  // ─── Schedule Actions ──────────────────────────────────
  async function handleSaveSchedules(dates: { d1: string; d2: string; d3: string }) {
    const updates = [
      { order: 1, date: dates.d1 },
      { order: 2, date: dates.d2 },
      { order: 3, date: dates.d3 },
    ]

    for (const u of updates) {
      const s = schedules.find(s => s.order_number === u.order)
      if (s) {
        await (supabase.from('schedules') as any)
          .update({ due_date: u.date })
          .eq('id', s.id)
      }
    }

    showToast('일정이 수정되었습니다', 'success')
    setEditingSchedule(false)
    await loadData()
  }

  // ─── Auth gate ───────────────────────────────────────
  if (!authChecked || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <p className="text-sm text-slate-400">로딩 중...</p>
      </div>
    )
  }

  const viewingChapter = viewingId ? chapters.find(c => c.id === viewingId) : null
  const editingChapter = editingId ? chapters.find(c => c.id === editingId) : null

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-white shrink-0">관리자</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 hidden md:inline">{session.name}님</span>
            <button
              onClick={() => router.push('/admin/users')}
              className="h-8 px-3 text-xs font-medium text-slate-300 border border-slate-500 rounded-lg hover:bg-slate-600 transition-colors"
            >
              회원관리
            </button>
            <button
              onClick={handleLogout}
              className="h-8 px-3 text-xs font-medium text-slate-300 border border-slate-500 rounded-lg hover:bg-slate-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Schedule Notice */}
            <Timeline
              schedules={schedules}
              onEdit={() => setEditingSchedule(true)}
            />

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
                    <th className="px-3 py-3 text-right font-semibold text-slate-600" style={{width:'140px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChapters.map((ch, idx) => {
                    const cfg = statusConfig[ch.status] || statusConfig.draft
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
                          {ch.status === 'reviewed' ? (
                            <button
                              onClick={(e) => handleConfirm(e, ch.id)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 whitespace-nowrap transition-colors"
                            >
                              확정하기
                            </button>
                          ) : ch.status === 'confirmed' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => handleDownload(e, ch)}
                                className="px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 whitespace-nowrap transition-colors"
                              >
                                다운로드
                              </button>
                              <button
                                onClick={(e) => handleUnconfirm(e, ch.id)}
                                className="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 whitespace-nowrap transition-colors"
                              >
                                확정해제
                              </button>
                            </div>
                          ) : null}
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

            {/* Add Button */}
            <button
              onClick={openAddForm}
              className="h-12 w-full text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              + 항목 추가
            </button>
          </div>
        )}
      </main>

      {/* Chapter Detail Modal */}
      {viewingId && viewingChapter && (
        <ChapterDetailModal
          chapter={viewingChapter}
          statusConfig={statusConfig}
          fmtTime={fmtTime}
          onClose={() => setViewingId(null)}
          onEdit={() => openEditFromDetail(viewingChapter)}
          onDownload={(e) => handleDownload(e, viewingChapter)}
          onConfirm={viewingChapter.status === 'reviewed' ? (e) => handleConfirm(e, viewingChapter.id) : undefined}
          onUnconfirm={(e) => handleUnconfirm(e, viewingChapter.id)}
          onDelete={viewingChapter.status === 'draft' ? () => handleDeleteChapter(viewingChapter) : undefined}
          showDiff={!!viewingChapter.edited_body && !!viewingChapter.original_body}
        />
      )}

      {/* Chapter Edit Modal */}
      {editingId && editingChapter && (
        <ChapterModal
          mode="edit"
          form={editForm}
          setForm={setEditForm}
          writers={writers}
          onSave={() => handleUpdateChapter(editingId)}
          onClose={() => setEditingId(null)}
          onDelete={editingChapter.status === 'draft' ? () => handleDeleteChapter(editingChapter) : undefined}
        />
      )}

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

      {/* Schedule Edit Modal */}
      {editingSchedule && (
        <ScheduleEditModal
          schedules={schedules}
          onSave={handleSaveSchedules}
          onClose={() => setEditingSchedule(false)}
        />
      )}
    </div>
  )
}

// ─── Chapter Detail Modal ────────────────────────────────
function ChapterDetailModal({
  chapter,
  statusConfig,
  fmtTime,
  onClose,
  onEdit,
  onDownload,
  onConfirm,
  onUnconfirm,
  onDelete,
  showDiff,
}: {
  chapter: ChapterWithDetails
  statusConfig: Record<string, { emoji: string; label: string; badgeCls: string }>
  fmtTime: (iso: string | null) => string
  onClose: () => void
  onEdit: () => void
  onDownload: (e: React.MouseEvent) => void
  onConfirm?: (e: React.MouseEvent) => void
  onUnconfirm: (e: React.MouseEvent) => void
  onDelete?: () => void
  showDiff?: boolean
}) {
  const [tab, setTab] = useState<'original' | 'edited'>('original')
  const cfg = statusConfig[chapter.status] || statusConfig.draft

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl md:max-w-5xl md:h-[85vh] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
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
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className={chapter.writer_name ? 'text-indigo-600 font-medium' : 'text-slate-400'}>
                  {chapter.writer_name || '미배정'}
                </span>
                {chapter.submitted_at && (
                  <span className="text-slate-400 text-xs">제출 {fmtTime(chapter.submitted_at)}</span>
                )}
                {chapter.confirmed_at && (
                  <span className="text-emerald-500 text-xs">확정 {fmtTime(chapter.confirmed_at)}</span>
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

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="h-10 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
          >
            정보 수정
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="h-10 px-5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              확정하기
            </button>
          )}
          {chapter.status === 'confirmed' && (
            <>
              <button
                onClick={onDownload}
                className="h-10 px-4 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                다운로드
              </button>
              <button
                onClick={onUnconfirm}
                className="h-10 px-4 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
              >
                확정해제
              </button>
            </>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 px-4 text-sm font-medium text-red-400 hover:text-red-600 transition-colors ml-auto"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chapter Modal ───────────────────────────────────────
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

// ─── Schedule Edit Modal ─────────────────────────────────
function ScheduleEditModal({
  schedules,
  onSave,
  onClose,
}: {
  schedules: Schedule[]
  onSave: (dates: { d1: string; d2: string; d3: string }) => void
  onClose: () => void
}) {
  const s1 = schedules.find(s => s.order_number === 1)
  const s2 = schedules.find(s => s.order_number === 2)
  const s3 = schedules.find(s => s.order_number === 3)

  const [d1, setD1] = useState(s1?.due_date || '')
  const [d2, setD2] = useState(s2?.due_date || '')
  const [d3, setD3] = useState(s3?.due_date || '')

  const inputCls = 'h-11 px-4 text-base bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">일정 수정</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            ✕
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">원고 마감</label>
            <input type="date" value={d1} onChange={e => setD1(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">인쇄소 전달</label>
            <input type="date" value={d2} onChange={e => setD2(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">출간 목표</label>
            <input type="date" value={d3} onChange={e => setD3(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 space-y-2">
          <button
            onClick={() => onSave({ d1, d2, d3 })}
            className="h-12 w-full text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
          >
            수정 완료
          </button>
          <button
            onClick={onClose}
            className="h-12 w-full text-base font-medium text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
