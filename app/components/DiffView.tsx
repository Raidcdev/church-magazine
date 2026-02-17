'use client'

import { useMemo } from 'react'
import DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch()

export default function DiffView({
  original,
  edited,
}: {
  original: string
  edited: string
}) {
  const parts = useMemo(() => {
    const diffs = dmp.diff_main(original, edited)
    dmp.diff_cleanupSemantic(diffs)
    return diffs
  }, [original, edited])

  if (!original && !edited) {
    return <span className="text-slate-400">(내용 없음)</span>
  }

  return (
    <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
      {parts.map(([op, text], i) => {
        if (op === -1) {
          // 삭제된 부분
          return (
            <span key={i} className="bg-red-100 text-red-700 line-through decoration-red-400">
              {text}
            </span>
          )
        }
        if (op === 1) {
          // 추가된 부분
          return (
            <span key={i} className="bg-emerald-100 text-emerald-700">
              {text}
            </span>
          )
        }
        // 변경 없는 부분
        return <span key={i}>{text}</span>
      })}
    </div>
  )
}
