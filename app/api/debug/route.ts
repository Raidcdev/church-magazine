import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check env vars (mask sensitive data)
  const envCheck = {
    urlSet: !!url,
    urlLength: url?.length,
    urlFirst20: url?.substring(0, 20),
    keySet: !!key,
    keyLength: key?.length,
  }

  // Try a simple Supabase query
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .limit(1)

    return NextResponse.json({
      envCheck,
      queryResult: { data, error: error?.message },
    })
  } catch (e: unknown) {
    return NextResponse.json({
      envCheck,
      exception: e instanceof Error ? e.message : String(e),
    })
  }
}
