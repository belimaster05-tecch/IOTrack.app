import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, role, organizationId, invitedBy } = await request.json();

    if (!email || !organizationId) {
      return NextResponse.json({ error: 'Email y organización son requeridos.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Map UI role names to DB constraint values
    const dbRole = role === 'employee' ? 'member' : (role || 'member');

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectTo = `${appUrl}/auth/callback?next=/invitacion/${token}`;

    // Insert invitation record
    const { error: insertError } = await supabaseAdmin.from('invitations').insert({
      organization_id: organizationId,
      email: email.toLowerCase().trim(),
      role: dbRole,
      token,
      expires_at: expiresAt,
      invited_by: invitedBy || null,
    });

    if (insertError) {
      // Duplicate pending invitation
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una invitación pendiente para este correo.' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Try to send invite email via Supabase Auth admin
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      { redirectTo }
    );

    if (inviteError) {
      const alreadyExists =
        inviteError.message.toLowerCase().includes('already') ||
        inviteError.message.toLowerCase().includes('registered');

      if (alreadyExists) {
        // User already has an account — return the acceptance link for manual sharing
        return NextResponse.json({
          success: true,
          existingUser: true,
          inviteLink: `${appUrl}/invitacion/${token}`,
          message: 'El usuario ya tiene cuenta. Comparte el enlace de invitación manualmente.',
        });
      }

      // Unexpected error — clean up the inserted invitation
      await supabaseAdmin.from('invitations').delete().eq('token', token);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
