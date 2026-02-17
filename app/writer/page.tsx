/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  status: 'draft' | 'submitted' | 'editing' | 'confirmed'
  original_body: string | null
  edited_body: string | null
  files: FileRow[]
}

type Toast = {
  message: string
  type: 'success' | 'error'
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '작성중', cls: 'bg-gray-200 text-gray-700' },
  submitted: { label: '제출완료', cls: 'bg-blue-100 text-blue-700' },
  editing: { label: '교정중', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: '확정', cls: 'bg-green-100 text-green-700' },
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

      // chapters 조회
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
        category: c.category,
        writer_id: c.writer_id,
        status: c.status as ChapterRow['status'],
        original_body: c.original_body,
        edited_body: c.edited_body,
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
            // draft 상태인 경우만 기존 편집 유지
            const ch = result.find((c) => c.id === id)
            if (ch && ch.status === 'draft' && prev[id] !== '') {
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
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          original_body: bodies[chapterId] ?? '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', chapterId)
        .eq('writer_id', session.userId)

      if (error) throw error

      showToast('저장되었습니다', 'success')
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? { ...c, original_body: bodies[chapterId] ?? '' } : c
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

    const ok = window.confirm('제출하면 수정할 수 없습니다. 제출하시겠습니까?')
    if (!ok) return

    setSubmitting(chapterId)
    try {
      const supabase = createBrowserClient()
      const { error } = await (supabase
        .from('chapters') as any)
        .update({
          original_body: body,
          status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', chapterId)
        .eq('writer_id', session.userId)
        .eq('status', 'draft')

      if (error) throw error

      showToast('제출되었습니다', 'success')
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId
            ? { ...c, original_body: body, status: 'submitted' as const }
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
      showToast('사진이 업로드되었습니다', 'success')
    } catch {
      showToast('사진 업로드 중 오류가 발생했습니다', 'error')
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
      showToast('사진이 삭제되었습니다', 'success')
    } catch {
      showToast('사진 삭제 중 오류가 발생했습니다', 'error')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-500">불러오는 중...</p>
      </div>
    )
  }

  const isLocked = (status: string) =>
    status === 'submitted' || status === 'editing' || status === 'confirmed'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white text-lg font-semibold shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">📖 교회 계간지</h1>
          <div className="flex items-center gap-3">
            <span className="text-lg text-gray-700">{session?.name}님</span>
            <button
              onClick={handleLogout}
              className="h-12 px-4 text-lg font-semibold text-gray-600 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {chapters.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-lg text-gray-500">배정된 원고가 없습니다.</p>
          </div>
        ) : (
          chapters.map((ch) => (
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
          ))
        )}
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

  const statusInfo = STATUS_MAP[chapter.status] ?? STATUS_MAP.draft

  // textarea 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current && expanded) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [body, expanded])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 카드 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg text-gray-400">{expanded ? '▼' : '▶'}</span>
          <span className="text-lg font-semibold text-gray-900 truncate">
            {chapter.chapter_code}. {chapter.title}
          </span>
        </div>
        <span
          className={`shrink-0 inline-block px-3 py-1 text-sm font-semibold rounded-full ${statusInfo.cls}`}
        >
          {statusInfo.label}
        </span>
      </button>

      {/* 카드 본문 */}
      {expanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* textarea */}
          <div>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              readOnly={locked}
              placeholder="원고를 입력하세요..."
              className={`w-full text-lg leading-relaxed rounded-xl border-2 p-4 focus:outline-none resize-none transition-colors ${
                locked
                  ? 'bg-gray-100 border-gray-200 text-gray-700 cursor-default'
                  : 'bg-white border-gray-300 focus:border-blue-500'
              }`}
              style={{ minHeight: '200px' }}
            />
            <p className="text-base text-gray-500 mt-1 text-right">{body.length}자</p>
          </div>

          {/* 사진 영역 */}
          <div className="space-y-3">
            {/* 사진 추가 버튼 (locked이면 숨김) */}
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-14 px-6 text-lg font-semibold text-gray-700 bg-gray-100 border-2 border-gray-300 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {uploading ? '업로드 중...' : '📷 사진 추가'}
                </button>
              </>
            )}

            {/* 썸네일 목록 */}
            {chapter.files.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {chapter.files.map((f) => (
                  <div key={f.id} className="relative group">
                    <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
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
            )}
          </div>

          {/* 버튼 영역 (locked이면 숨김) */}
          {!locked && (
            <div className="space-y-3 pt-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full h-14 bg-gray-500 text-white text-lg font-semibold rounded-xl hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting || !body.trim()}
                className="w-full h-14 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
