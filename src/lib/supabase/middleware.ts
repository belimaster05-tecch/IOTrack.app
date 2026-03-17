import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/setup' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/invitacion') ||
    pathname.startsWith('/auth/')

  // Helper: redirect while preserving the updated auth cookies from supabaseResponse.
  // Without this, Supabase refreshes the token server-side (consuming the old one),
  // but the new token never reaches the browser → "Invalid Refresh Token" on next request.
  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone()
    url.pathname = destination
    url.search = ''
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie as any)
    })
    return res
  }

  // Unauthenticated → login
  if (!user && !isPublicPath) {
    return redirectWithCookies('/login')
  }

  if (user) {
    const hasPassword = user.user_metadata?.has_password === true;
    const wasInvited = !!user.invited_at;
    const needsSetup = wasInvited && !hasPassword;

    // Invited user who hasn't set a password yet → force /setup
    if (needsSetup && !pathname.startsWith('/setup') && !pathname.startsWith('/auth/') && !pathname.startsWith('/invitacion') && pathname !== '/reset-password') {
      return redirectWithCookies('/setup')
    }

    // Already authenticated → skip login/register
    if (pathname === '/login' || pathname === '/register') {
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      const url = request.nextUrl.clone()
      url.pathname = next.startsWith('/') ? next : '/dashboard'
      url.search = ''
      const res = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        res.cookies.set(cookie.name, cookie.value, cookie as any)
      })
      return res
    }

    // Setup complete → don't show setup page again
    if (pathname === '/setup' && !needsSetup) {
      return redirectWithCookies('/dashboard')
    }
  }

  return supabaseResponse
}
