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

  // Unauthenticated → login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const hasPassword = user.user_metadata?.has_password === true;
    const wasInvited = !!user.invited_at;
    const needsSetup = wasInvited && !hasPassword;

    // Invited user who hasn't set a password yet → force /setup
    // Allow /invitacion so accept_invitation can run first, then it redirects to /setup
    if (needsSetup && !pathname.startsWith('/setup') && !pathname.startsWith('/auth/') && !pathname.startsWith('/invitacion') && pathname !== '/reset-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }

    // Already authenticated → skip login/register, respect ?next= if present
    if (pathname === '/login' || pathname === '/register') {
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      const url = request.nextUrl.clone()
      url.pathname = next.startsWith('/') ? next : '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Setup complete → don't show setup page again
    if (pathname === '/setup' && !needsSetup) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
