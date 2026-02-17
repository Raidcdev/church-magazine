import { NextResponse } from 'next/server'
import { login } from '@/lib/auth'

export async function POST(request: Request) {
  const { name, password } = await request.json()
  const result = await login(name, password)
  return NextResponse.json(result)
}
