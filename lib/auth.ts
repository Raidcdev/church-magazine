import { cookies } from 'next/headers'
import { createServerClient } from './supabase-server'

export type Session = {
  userId: string
  role: 'admin' | 'editor' | 'writer'
  name: string
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')
  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value) as Session
  } catch {
    return null
  }
}

export async function login(name: string, password: string): Promise<{ success: boolean; role?: string; error?: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('name', name)
    .eq('password', password)
    .single()

  if (error || !data) {
    return { success: false, error: '이름 또는 비밀번호가 맞지 않습니다' }
  }

  const session: Session = {
    userId: data.id,
    role: data.role as Session['role'],
    name: data.name,
  }

  const cookieStore = await cookies()
  cookieStore.set('session', JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: '/',
  })

  return { success: true, role: data.role }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
