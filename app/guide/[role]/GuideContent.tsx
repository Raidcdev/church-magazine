'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'

const ROLE_COLORS: Record<string, string> = {
  writer: 'from-indigo-600 to-indigo-500',
  editor: 'from-amber-600 to-amber-500',
  admin: 'from-emerald-600 to-emerald-500',
}

const ROLE_BACK: Record<string, string> = {
  writer: '/writer',
  editor: '/editor',
  admin: '/admin',
}

export default function GuideContent({
  markdown,
  role,
  roleLabel,
}: {
  markdown: string
  role: string
  roleLabel: string
}) {
  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* 헤더 */}
      <header className={`bg-gradient-to-r ${ROLE_COLORS[role] || 'from-slate-700 to-slate-600'} shadow-sm sticky top-0 z-40`}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">{roleLabel} 사용설명서</h1>
          <div className="flex items-center gap-2">
            <Link
              href={ROLE_BACK[role] || '/'}
              className="h-8 px-3 text-xs font-medium text-white/80 border border-white/30 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center"
            >
              돌아가기
            </Link>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-8">
          <article className="guide-article">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-slate-800 mb-6 pb-3 border-b-2 border-slate-200">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-slate-700 mt-10 mb-4 pb-2 border-b border-slate-100">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-3">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-base text-slate-600 leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside ml-5 space-y-1.5 mb-4 text-slate-600">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside ml-5 space-y-1.5 mb-4 text-slate-600">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-base leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-slate-800">{children}</strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-indigo-300 bg-indigo-50/50 pl-4 py-2 my-4 rounded-r-lg text-slate-600 [&>p]:mb-0">{children}</blockquote>
                ),
                pre: ({ children }) => (
                  <pre className="bg-stone-50 border border-stone-200 rounded-xl p-4 my-4 text-sm overflow-x-auto text-slate-700">{children}</pre>
                ),
                code: ({ children, className }) => {
                  // 코드블록 안의 code (pre > code)
                  if (className?.includes('language-') || (typeof children === 'string' && children.includes('\n'))) {
                    return (
                      <code className="font-mono text-sm whitespace-pre">{children}</code>
                    )
                  }
                  // 인라인 코드
                  return (
                    <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                  )
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-50">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-700 border-b border-slate-200">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2.5 text-slate-600 border-b border-slate-100">{children}</td>
                ),
                hr: () => <hr className="my-8 border-slate-200" />,
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </div>

        {/* 하단 네비게이션 */}
        <div className="flex justify-center gap-3 mt-6 mb-10">
          {['writer', 'editor', 'admin'].map((r) => (
            <Link
              key={r}
              href={`/guide/${r}`}
              className={`h-9 px-4 text-sm font-medium rounded-lg inline-flex items-center transition-colors ${
                r === role
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {{ writer: '필자', editor: '교정자', admin: '관리자' }[r]} 설명서
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
