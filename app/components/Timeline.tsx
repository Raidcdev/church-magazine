'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

type Schedule = {
  id: string
  title: string
  due_date: string
  order_number: number
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function getDDay(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`
}

function ddayLabel(dday: number): string {
  if (dday === 0) return 'D-Day'
  if (dday > 0) return `D-${dday}`
  return `D+${Math.abs(dday)}`
}

function ddayColor(dday: number): string {
  if (dday < 0) return 'text-red-500 font-bold'
  if (dday <= 3) return 'text-red-500 font-bold'
  if (dday <= 7) return 'text-amber-500 font-bold'
  return 'text-slate-400'
}

export default function Timeline({
  schedules: propSchedules,
  onEdit,
}: {
  schedules?: Schedule[]
  onEdit?: () => void
}) {
  const [fetched, setFetched] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(!propSchedules)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (propSchedules) return
    async function load() {
      const { data } = await (supabase
        .from('schedules') as any)
        .select('id, title, due_date, order_number')
        .order('order_number', { ascending: true }) as { data: Schedule[] | null }
      setFetched(data || [])
      setLoading(false)
    }
    load()
  }, [supabase, propSchedules])

  const schedules = propSchedules || fetched
  if (loading || schedules.length === 0) return null

  const manuscript = schedules.find(s => s.order_number === 1)
  const printer = schedules.find(s => s.order_number === 2)
  const publish = schedules.find(s => s.order_number === 3)

  // Closest upcoming deadline
  const upcoming = schedules
    .filter(s => getDDay(s.due_date) >= 0)
    .sort((a, b) => getDDay(a.due_date) - getDDay(b.due_date))[0]
  const highlightDDay = upcoming ? getDDay(upcoming.due_date) : null

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/50 p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-700">제작 일정</span>
          {upcoming && highlightDDay !== null && (
            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
              highlightDDay <= 3 ? 'bg-red-50 text-red-600'
                : highlightDDay <= 7 ? 'bg-amber-50 text-amber-600'
                : 'bg-indigo-50 text-indigo-600'
            }`}>
              {upcoming.title} {ddayLabel(highlightDDay)}
            </span>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            수정
          </button>
        )}
      </div>

      {/* Schedule rows */}
      <div className="space-y-1.5">
        {manuscript && (
          <Row label="원고 마감" date={fmtDate(manuscript.due_date)} dday={getDDay(manuscript.due_date)} />
        )}
        {manuscript && printer && (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-slate-500">교정·편집</span>
            <span className="text-sm text-slate-600">
              {fmtDate(manuscript.due_date)} ~ {fmtDate(printer.due_date)}
            </span>
          </div>
        )}
        {printer && (
          <Row label="인쇄소 전달" date={fmtDate(printer.due_date)} dday={getDDay(printer.due_date)} />
        )}
        {publish && (
          <Row label="출간 목표" date={fmtDate(publish.due_date)} dday={getDDay(publish.due_date)} />
        )}
      </div>
    </div>
  )
}

function Row({ label, date, dday }: { label: string; date: string; dday: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{date}</span>
        <span className={`text-xs min-w-[3rem] text-right ${ddayColor(dday)}`}>
          {ddayLabel(dday)}
        </span>
      </div>
    </div>
  )
}
