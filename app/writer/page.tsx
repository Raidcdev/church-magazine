/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'
import Timeline from '@/app/components/Timeline'
import ProgressOverview from '@/app/components/ProgressOverview'
import type { ChapterSummary } from '@/app/components/ProgressOverview'

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

  writer_id: string | null
  status: 'draft' | 'submitted' | 'editing' | 'reviewed' | 'confirmed'
  original_body: string | null
  edited_body: string | null
  updated_at: string | null
  submitted_at: string | null
  files: FileRow[]
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '작성중', cls: 'bg-gray-200 text-gray-700 shadow-sm' },
  submitted: { label: '제출완료', cls: 'bg-blue-100 text-blue-700 shadow-sm' },
  editing: { label: '교정중', cls: 'bg-yellow-100 text-yellow-700 shadow-sm' },
  reviewed: { label: '교정완료', cls: 'bg-purple-100 text-purple-700 shadow-sm' },
  confirmed: { label: '확정', cls: 'bg-green-100 text-green-700 shadow-sm' },
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif'])

function isImageFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.has(ext)
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function WriterPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [loading, setLoading] = useState(true)
  const [allChapters, setAllChapters] = useState<ChapterSummary[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/'); return }
      const { session: sess } = await res.json()
      if (!sess) { router.push('/'); return }
      setSession(sess)

      const supabase = createBrowserClient()

      // 전체 목차 진행도 조회
      const { data: allChData } = await (supabase
        .from('chapters') as any)
        .select('order_number, chapter_code, title, writer_id, status')
        .order('order_number', { ascending: true }) as { data: { order_number: number; chapter_code: string; title: string; writer_id: string | null; status: string }[] | null }

      const { data: usersData } = await (supabase
        .from('users') as any)
        .select('id, name') as { data: { id: string; name: string }[] | null }

      const nameMap = new Map((usersData || []).map(u => [u.id, u.name]))

      setAllChapters((allChData || []).map(ch => ({
        ...ch,
        writer_name: ch.writer_id ? nameMap.get(ch.writer_id) || null : null,
      })))

      // 내 chapters 조회
      const { data: rawChapters, error: chaptersError } = await (supabase
        .from('chapters') as any)
        .select('*')
        .eq('writer_id', sess.userId)
        .order('order_number', { ascending: true })

      if (chaptersError) throw chaptersError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chaptersData = (rawChapters ?? []) as Record<string, any>[]

      // files 조회
      const chapterIds = chaptersData.map((c) => c.id as string)
      let filesMap: Record<string, FileRow[]> = {}

      if (chapterIds.length > 0) {
        const { data: rawFiles } = await (supabase
          .from('files') as any)
          .select('*')
          .in('chapter_id', chapterIds)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filesData = (rawFiles ?? []) as Record<string, any>[]
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
      }

      const result: ChapterRow[] = chaptersData.map((c) => ({
        id: c.id,
        order_number: c.order_number,
        chapter_code: c.chapter_code,
        title: c.title,

        writer_id: c.writer_id,
        status: c.status as ChapterRow['status'],
        original_body: c.original_body,
        edited_body: c.edited_body,
        updated_at: c.updated_at,
        submitted_at: c.submitted_at,
        files: filesMap[c.id] ?? [],
      }))

      setChapters(result)

      // bodies 초기화
      const newBodies: Record<string, string> = {}
      for (const ch of result) {
        newBodies[ch.id] = ch.original_body ?? ''
      }
      setBodies((prev) => {
        const merged = { ...newBodies }
        // 이미 편집 중인 내용은 유지
        for (const id of Object.keys(prev)) {
          if (merged[id] !== undefined && prev[id] !== undefined) {
            // draft/submitted 상태인 경우 기존 편집 유지
            const ch = result.find((c) => c.id === id)
            if (ch && (ch.status === 'draft' || ch.status === 'submitted') && prev[id] !== '') {
              merged[id] = prev[id]
            }
          }
        }
        return merged
      })
    } catch {
      showToast('데이터를 불러오는 중 오류가 발생했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [router, showToast])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 임시 저장
  async function handleSave(chapterId: string) {
    if (!session) return
    setSaving(chapterId)
    try {
      const supabase = createBrowserClient()
      const chapter = chapters.find(c => c.id === chapterId)
      const updateData: Record<string, string> = {
        original_body: bodies[chapterId] ?? '',
        updated_at: new Date().toISOString(),
      }
      // submitted 상태에서 저장하면 draft로 되돌림
      if (chapter?.status === 'submitted') {
        updateData.status = 'draft'
      }
      const { error } = await (supabase
        .from('chapters') as any)
        .update(updateData)
        .eq('id', chapterId)
        .eq('writer_id', session.userId)

      if (error) throw error

      showToast('저장되었습니다', 'success')
      const savedAt = new Date().toISOString()
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? {
            ...c,
            original_body: bodies[chapterId] ?? '',
            updated_at: savedAt,
            ...(c.status === 'submitted' ? { status: 'draft' as const } : {}),
          } : c
        )
      )
    } catch {
      showToast('저장 중 오류가 발생했습니다', 'error')
    } finally {
      setSaving(null)
    }
  }

  // 제출
  async function handleSubmit(chapterId: string) {
    if (!session) return
    const body = bodies[chapterId] ?? ''
    if (!body.trim()) return

    const chapter = chapters.find(c => c.id === chapterId)
    const confirmMsg = chapter?.status === 'submitted'
      ? '원고를 다시 제출하시겠습니까?'
      : '원고를 제출하시겠습니까? (교정 시작 전까지 수정 가능합니다)'
    const ok = window.confirm(confirmMsg)
    if (!ok) return

    setSubmitting(chapterId)
    try {
      const supabase = createBrowserClient()
      const now = new Date().toISOString()
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          original_body: body,
          status: 'submitted',
          updated_at: now,
          submitted_at: now,
        })
        .eq('id', chapterId)
        .eq('writer_id', session.userId)

      if (error) throw error

      showToast('제출되었습니다', 'success')
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId
            ? { ...c, original_body: body, status: 'submitted' as const, updated_at: now, submitted_at: now }
            : c
        )
      )
    } catch {
      showToast('제출 중 오류가 발생했습니다', 'error')
    } finally {
      setSubmitting(null)
    }
  }

  // 사진 업로드
  async function handleFileUpload(chapterId: string, fileList: FileList) {
    if (!session) return
    setUploading(chapterId)
    try {
      const supabase = createBrowserClient()
      const newFiles: FileRow[] = []

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const filePath = `${chapterId}/${Date.now()}_${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath)

        const { data: insertData, error: insertError } = await (supabase
          .from('files') as any)
          .insert({
            chapter_id: chapterId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = insertData as Record<string, any>
        newFiles.push({
          id: row.id,
          chapter_id: row.chapter_id,
          file_url: row.file_url,
          file_name: row.file_name,
          file_size: row.file_size,
          uploaded_at: row.uploaded_at,
        })
      }

      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? { ...c, files: [...c.files, ...newFiles] } : c
        )
      )
      showToast('파일이 업로드되었습니다', 'success')
    } catch {
      showToast('파일 업로드 중 오류가 발생했습니다', 'error')
    } finally {
      setUploading(null)
    }
  }

  // 사진 삭제
  async function handleFileDelete(chapterId: string, file: FileRow) {
    try {
      const supabase = createBrowserClient()

      // Storage에서 삭제 - publicUrl에서 경로 추출
      const url = new URL(file.file_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/photos/')
      if (pathParts.length > 1) {
        await supabase.storage.from('photos').remove([pathParts[1]])
      }

      // DB에서 삭제
      const { error } = await (supabase
        .from('files') as any)
        .delete()
        .eq('id', file.id)

      if (error) throw error

      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId
            ? { ...c, files: c.files.filter((f) => f.id !== file.id) }
            : c
        )
      )
      showToast('파일이 삭제되었습니다', 'success')
    } catch {
      showToast('파일 삭제 중 오류가 발생했습니다', 'error')
    }
  }

  // 로그아웃
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <p className="text-base text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  const isLocked = (status: string) =>
    status === 'editing' || status === 'confirmed'

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-xl ${
            toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">교회 계간지</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-200">{session?.name}님</span>
            <button
              onClick={handleLogout}
              className="h-10 px-4 text-sm font-semibold text-slate-300 border border-slate-500 rounded-xl hover:bg-slate-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 타임라인 */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <Timeline />
      </div>

      {/* 전체 진행도 */}
      {allChapters.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <ProgressOverview chapters={allChapters} highlightUserId={session?.userId} />
        </div>
      )}

      {/* 메인 */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {chapters.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 p-8 text-center">
            <p className="text-sm text-slate-500">배정된 원고가 없습니다.</p>
          </div>
        )}

        {chapters.map((ch) => (
          <ChapterCard
            key={ch.id}
            chapter={ch}
            expanded={expandedId === ch.id}
            body={bodies[ch.id] ?? ''}
            locked={isLocked(ch.status)}
            saving={saving === ch.id}
            submitting={submitting === ch.id}
            uploading={uploading === ch.id}
            onToggle={() => setExpandedId(expandedId === ch.id ? null : ch.id)}
            onBodyChange={(val) => setBodies((prev) => ({ ...prev, [ch.id]: val }))}
            onSave={() => handleSave(ch.id)}
            onSubmit={() => handleSubmit(ch.id)}
            onFileUpload={(files) => handleFileUpload(ch.id, files)}
            onFileDelete={(file) => handleFileDelete(ch.id, file)}
          />
        ))}

      </main>
    </div>
  )
}

// ─── Chapter Card ────────────────────────────────────────

function ChapterCard({
  chapter,
  expanded,
  body,
  locked,
  saving,
  submitting,
  uploading,
  onToggle,
  onBodyChange,
  onSave,
  onSubmit,
  onFileUpload,
  onFileDelete,
}: {
  chapter: ChapterRow
  expanded: boolean
  body: string
  locked: boolean
  saving: boolean
  submitting: boolean
  uploading: boolean
  onToggle: () => void
  onBodyChange: (val: string) => void
  onSave: () => void
  onSubmit: () => void
  onFileUpload: (files: FileList) => void
  onFileDelete: (file: FileRow) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const statusInfo = STATUS_MAP[chapter.status] ?? STATUS_MAP.draft

  // textarea 자동 높이 조절 (뷰포트 70%까지, 초과 시 내부 스크롤)
  useEffect(() => {
    if (textareaRef.current && expanded) {
      textareaRef.current.style.height = 'auto'
      const maxH = Math.floor(window.innerHeight * 0.7)
      const scrollH = textareaRef.current.scrollHeight
      textareaRef.current.style.height = Math.min(scrollH, maxH) + 'px'
      textareaRef.current.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
    }
  }, [body, expanded])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 overflow-hidden">
      {/* 카드 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-slate-400">{expanded ? '▼' : '▶'}</span>
          <span className="text-base font-medium text-slate-800 truncate">
            <span className="inline-flex items-center justify-center w-8 h-5 text-xs font-semibold text-slate-500 bg-slate-100 rounded mr-1.5">{chapter.chapter_code}</span>
            {chapter.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.cls}`}
          >
            {statusInfo.label}
          </span>
        </div>
      </button>

      {/* 워크플로우 스텝 */}
      <div className="px-4 pb-1">
        <WorkflowSteps status={chapter.status} />
      </div>

      {/* 타임스탬프 */}
      {(chapter.updated_at || chapter.submitted_at) && (
        <div className="px-4 pb-1 flex items-center gap-3 text-xs text-slate-400">
          {chapter.updated_at && (
            <span>저장 {fmtTime(chapter.updated_at)}</span>
          )}
          {chapter.submitted_at && chapter.status === 'submitted' && (
            <span className="text-blue-400">제출 {fmtTime(chapter.submitted_at)}</span>
          )}
        </div>
      )}

      {/* 카드 본문 */}
      {expanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {/* textarea */}
          <div>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              readOnly={locked}
              placeholder="여기에 원고를 작성하세요. 임시저장으로 중간 저장이 가능하고, 제출하기를 누르면 교정팀에 전달됩니다."
              className={`w-full text-base leading-relaxed rounded-xl border p-3 focus:outline-none resize-none transition-all ${
                locked
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-default'
                  : 'bg-slate-50 border-slate-200 focus:border-indigo-400 focus:bg-white'
              }`}
              style={{ minHeight: '160px' }}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{body.length}자</p>
          </div>

          {/* 파일 영역 */}
          <div className="space-y-3">
            {/* 파일 추가 버튼 (locked이면 숨김) */}
            {!locked && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={docInputRef}
                  type="file"
                  multiple
                  accept=".hwp,.doc,.docx,.pdf,.txt,.xlsx,.xls,.pptx,.ppt,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-9 px-4 text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? '업로드 중...' : '사진 추가'}
                  </button>
                  <button
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploading}
                    className="h-9 px-4 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? '업로드 중...' : '참고파일 첨부'}
                  </button>
                </div>
              </>
            )}

            {/* 사진 썸네일 */}
            {(() => {
              const imageFiles = chapter.files.filter(f => isImageFile(f.file_name))
              return imageFiles.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500 mb-2">사진 ({imageFiles.length})</p>
                  <div className="flex flex-wrap gap-3">
                    {imageFiles.map((f) => (
                      <div key={f.id} className="relative group">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={f.file_url}
                            alt={f.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {!locked && (
                          <button
                            onClick={() => onFileDelete(f)}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full text-sm font-bold flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            })()}

            {/* 참고파일 목록 */}
            {(() => {
              const docFiles = chapter.files.filter(f => !isImageFile(f.file_name))
              return docFiles.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500 mb-2">참고파일 ({docFiles.length})</p>
                  <div className="space-y-1.5">
                    {docFiles.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-sm shrink-0">📄</span>
                        <a
                          href={f.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 truncate flex-1"
                        >
                          {f.file_name}
                        </a>
                        {!locked && (
                          <button
                            onClick={() => onFileDelete(f)}
                            className="text-sm text-red-400 hover:text-red-600 shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            })()}
          </div>

          {/* 버튼 영역 (locked이면 숨김) */}
          {!locked && (
            <div className="space-y-3 pt-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full h-10 bg-slate-600 text-white text-base font-semibold rounded-xl hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting || !body.trim()}
                className="w-full h-10 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-base font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-600 shadow-sm disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all"
              >
                {submitting ? '제출 중...' : (chapter.status === 'submitted' ? '다시 제출' : '제출하기')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Workflow Steps ──────────────────────────────────────

const STEPS = [
  { key: 'draft', label: '작성' },
  { key: 'submitted', label: '제출' },
  { key: 'editing', label: '교정' },
  { key: 'reviewed', label: '교정완료' },
  { key: 'confirmed', label: '확정' },
] as const

function stepIndex(status: string): number {
  const idx = STEPS.findIndex(s => s.key === status)
  return idx >= 0 ? idx : 0
}

function WorkflowSteps({ status }: { status: string }) {
  const current = stepIndex(status)

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-4 h-0.5 mx-0.5 rounded ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
              done ? 'text-emerald-600' : active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300'
            }`}>
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : active ? (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              )}
              {step.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

