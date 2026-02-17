import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createServerClient()

    // Test exact login query
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('name', '관리자')
      .eq('password', '0000')
      .single()

    return NextResponse.json({
      data,
      error: error ? { message: error.message, code: error.code, details: error.details } : null,
    })
  } catch (e: unknown) {
    return NextResponse.json({
      exception: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, password } = body

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('name', name)
      .eq('password', password)
      .single()

    return NextResponse.json({
      receivedName: name,
      receivedPassword: password,
      nameType: typeof name,
      passwordType: typeof password,
      data,
      error: error ? { message: error.message, code: error.code } : null,
    })
  } catch (e: unknown) {
    return NextResponse.json({
      exception: e instanceof Error ? e.message : String(e),
    })
  }
}
