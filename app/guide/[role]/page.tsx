import fs from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import GuideContent from './GuideContent'

const VALID_ROLES = ['writer', 'editor', 'admin'] as const
const ROLE_LABELS: Record<string, string> = {
  writer: '필자',
  editor: '교정자',
  admin: '관리자',
}

type Params = { role: string }

export function generateStaticParams() {
  return VALID_ROLES.map((role) => ({ role }))
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { role } = await params
  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    notFound()
  }

  const filePath = path.join(process.cwd(), 'docs', `guide-${role}.md`)
  const markdown = fs.readFileSync(filePath, 'utf-8')

  return <GuideContent markdown={markdown} role={role} roleLabel={ROLE_LABELS[role]} />
}
