'use client'

import { useState } from 'react'

export type ChapterSummary = {
  order_number: number
  chapter_code: string
  title: string
  writer_id: string | null
  writer_name: string | null
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: '미제출',
  submitted: '제출완료',
  editing: '교정중',
  reviewed: '교정완료',
  confirmed: '확정',
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-slate-300',
  submitted: 'bg-blue-400',
  editing: 'bg-amber-400',
  reviewed: 'bg-purple-400',
  confirmed: 'bg-emerald-400',
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'text-emerald-600 bg-emerald-50',
  reviewed: 'text-purple-600 bg-purple-50',
  editing: 'text-amber-600 bg-amber-50',
  submitted: 'text-blue-600 bg-blue-50',
  draft: 'text-slate-400 bg-slate-50',
}

/**
 * highlightUserId — 해당 유저의 항목을 하이라이트 (Writer: 내 원고, Editor: 내가 교정 중인 것)
 * highlightField — 어떤 필드로 매칭할지 (default: writer_id)
 */
export default function ProgressOverview({
  chapters,
  highlightUserId,
}: {
  chapters: ChapterSummary[]
  highlightUserId?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const total = chapters.length
  const confirmed = chapters.filter(c => c.status === 'confirmed').length
  const submitted = chapters.filter(c => c.status === 'submitted' || c.status === 'editing' || c.status === 'reviewed').length
  const progress = total > 0 ? Math.round((confirmed / total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-700">전체 진행도</span>
          <span className="text-xs text-slate-400">{confirmed}/{total} 확정</span>
          {submitted > 0 && <span className="text-xs text-blue-400">{submitted}건 진행중</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-600">{progress}%</span>
          <span className="text-xs text-slate-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Progress bar */}
      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Expanded: all chapters list */}
      {expanded && (
        <div className="mt-3 space-y-1">
          {chapters.map(ch => {
            const isMine = highlightUserId ? ch.writer_id === highlightUserId : false
            return (
              <div
                key={ch.order_number}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${isMine ? 'bg-indigo-50' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[ch.status] || STATUS_DOT.draft}`} />
                <span className="text-slate-400 text-xs w-8 shrink-0">{ch.chapter_code}</span>
                <span className={`flex-1 truncate ${isMine ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}>
                  {ch.title}
                </span>
                <span className="text-xs text-slate-400 shrink-0">
                  {ch.writer_name || '미배정'}
                </span>
                <span className={`text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded ${STATUS_BADGE[ch.status] || STATUS_BADGE.draft}`}>
                  {STATUS_LABELS[ch.status] || ch.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
