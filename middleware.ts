import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')
  const { pathname } = request.nextUrl

  // 로그인 페이지는 통과
  if (pathname === '/') {
    if (session) {
      try {
        const { role } = JSON.parse(session.value)
        const redirectMap: Record<string, string> = {
          admin: '/admin',
          editor: '/editor',
          writer: '/writer',
        }
        if (redirectMap[role]) {
          return NextResponse.redirect(new URL(redirectMap[role], request.url))
        }
      } catch {
        // 잘못된 세션 → 로그인 페이지 유지
      }
    }
    return NextResponse.next()
  }

  // 보호된 경로 체크
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const { role } = JSON.parse(session.value)
    const roleRouteMap: Record<string, string> = {
      '/admin': 'admin',
      '/editor': 'editor',
      '/writer': 'writer',
    }

    const requiredRole = roleRouteMap[pathname] || roleRouteMap['/' + pathname.split('/')[1]]
    if (requiredRole && role !== requiredRole) {
      const redirectMap: Record<string, string> = {
        admin: '/admin',
        editor: '/editor',
        writer: '/writer',
      }
      return NextResponse.redirect(new URL(redirectMap[role] || '/', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/editor/:path*', '/writer/:path*'],
}
