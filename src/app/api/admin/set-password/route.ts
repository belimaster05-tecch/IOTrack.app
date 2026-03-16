import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'userId y newPassword son requeridos.' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
    }

    // Verify the caller is an admin of the same org as the target user
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    // Check caller is admin via RPC (bypasses RLS)
    const { data: ctx } = await supabaseUser.rpc('get_my_context')
    const callerRole = ctx?.membership?.role ?? ctx?.profile?.role_name
    if (callerRole !== 'admin' && callerRole !== 'owner') {
      return NextResponse.json({ error: 'Solo los administradores pueden cambiar contraseñas.' }, { status: 403 })
    }

    // Verify target user is in the same org
    const callerOrgId = ctx?.membership?.organization_id ?? ctx?.profile?.organization_id
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (!targetProfile || targetProfile.organization_id !== callerOrgId) {
      return NextResponse.json({ error: 'No puedes modificar usuarios de otra organización.' }, { status: 403 })
    }

    // Set the new password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
