'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Status = 'loading' | 'success' | 'needs_login' | 'link_sent' | 'expired' | 'already_member' | 'error';

export default function InvitacionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<Status>('loading');
  const [orgName, setOrgName] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const done = useRef(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  useEffect(() => {
    if (!token) return;

    // ── 1. Detect Supabase error in URL hash (OTP expired, access denied, etc.) ─
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const p = new URLSearchParams(hash.slice(1));
      if (p.get('error_code') === 'otp_expired') {
        setStatus('expired');
        return;
      }
      setStatus('needs_login');
      return;
    }

    // ── 2. Process invitation once we have an authenticated user ───────────────
    async function onAuthenticated() {
      if (done.current) return;
      done.current = true;

      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });

      if (error || !data) {
        setStatus('error');
        setMessage('Error al procesar la invitación.');
        return;
      }

      // Already a member — just send them to the right place
      if (data.error === 'already_accepted' || data.error === 'not_found') {
        const { data: ctx } = await supabase.rpc('get_my_context');
        const hasPassword = (await supabase.auth.getUser()).data.user?.user_metadata?.has_password;
        if (ctx?.org_name) {
          setOrgName(ctx.org_name);
          setStatus('already_member');
          setTimeout(() => router.push(hasPassword ? '/dashboard' : '/setup'), 2000);
        } else {
          setStatus('needs_login');
        }
        return;
      }

      if (data.error === 'expired') {
        setStatus('error');
        setMessage('Esta invitación expiró. Solicita una nueva al administrador.');
        return;
      }

      if (data.error === 'email_mismatch') {
        setStatus('error');
        setMessage('Este enlace no corresponde al correo con el que iniciaste sesión.');
        return;
      }

      if (data.error) {
        setStatus('error');
        setMessage('No se pudo procesar la invitación.');
        return;
      }

      setOrgName(data.org_name ?? '');
      setStatus('success');
      setTimeout(() => router.push('/setup'), 2500);
    }

    // ── 3. Check immediately for an existing session (fast path) ──────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !done.current) {
        onAuthenticated();
      }
    });

    // ── 4. Also listen for new auth events ────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        subscription.unsubscribe();
        onAuthenticated();
      }
    });

    // ── 5. Fallback: no session after 4s → show login options ─────────────────
    const fallback = setTimeout(() => {
      if (!done.current) setStatus('needs_login');
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [token, router]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSendingLink(true);
    setLinkError('');
    const redirectTo = `${appUrl}/auth/callback?next=/invitacion/${token}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setSendingLink(false);
    if (error) {
      setLinkError('No se pudo enviar el enlace. Verifica que el correo sea el correcto.');
    } else {
      setStatus('link_sent');
    }
  };

  // ── SCREENS ────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 dark:text-[#787774]">Procesando invitación…</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <Screen icon="clock" color="amber" title="Enlace expirado">
        <p className="text-sm text-gray-500 dark:text-[#787774]">El enlace del correo venció. Ingresa tu correo para recibir uno nuevo.</p>
        <SendLinkForm
          email={email}
          setEmail={setEmail}
          onSubmit={handleSendLink}
          loading={sendingLink}
          error={linkError}
        />
        <div className="w-full border-t border-gray-100 dark:border-[#3A3A3A]" />
        <Link
          href={`/login?next=/invitacion/${token}`}
          className="block w-full py-2.5 px-4 rounded-lg border border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors text-center"
        >
          Ya tengo contraseña — Iniciar sesión
        </Link>
      </Screen>
    );
  }

  if (status === 'needs_login') {
    return (
      <Screen icon="mail" color="emerald" title="Configura tu acceso">
        <p className="text-sm text-gray-500 dark:text-[#787774]">
          Ingresa el correo al que llegó la invitación y te enviaremos un enlace para acceder.
        </p>
        <SendLinkForm
          email={email}
          setEmail={setEmail}
          onSubmit={handleSendLink}
          loading={sendingLink}
          error={linkError}
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100 dark:bg-[#3A3A3A]" />
          <span className="text-xs text-gray-400 dark:text-[#555]">o</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-[#3A3A3A]" />
        </div>
        <Link
          href={`/login?next=/invitacion/${token}`}
          className="block w-full py-2.5 px-4 rounded-lg border border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors text-center"
        >
          Ya tengo contraseña — Iniciar sesión
        </Link>
      </Screen>
    );
  }

  if (status === 'link_sent') {
    return (
      <Screen icon="mail" color="emerald" title="Revisa tu correo">
        <p className="text-sm text-gray-500 dark:text-[#787774]">
          Enviamos un enlace de acceso a <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">{email}</span>. Haz clic en él para continuar.
        </p>
        <p className="text-xs text-gray-400 dark:text-[#555]">Puede tardar unos segundos. Revisa también spam.</p>
      </Screen>
    );
  }

  if (status === 'success') {
    return (
      <Screen icon="check" color="emerald" title="¡Bienvenido!">
        {orgName && (
          <p className="text-sm text-gray-500 dark:text-[#787774]">
            Te uniste a <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">{orgName}</span>.
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-[#555]">Configurando tu cuenta…</p>
      </Screen>
    );
  }

  if (status === 'already_member') {
    return (
      <Screen icon="check" color="emerald" title="Ya eres miembro">
        {orgName && (
          <p className="text-sm text-gray-500 dark:text-[#787774]">
            Ya formas parte de <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">{orgName}</span>.
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-[#555]">Redirigiendo…</p>
      </Screen>
    );
  }

  // error
  return (
    <Screen icon="x" color="red" title="Invitación no válida">
      <p className="text-sm text-gray-500 dark:text-[#787774]">{message}</p>
      <Link
        href={`/login?next=/invitacion/${token}`}
        className="block w-full py-2.5 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors text-center"
      >
        Ir al login
      </Link>
    </Screen>
  );
}

// ── Send link form ─────────────────────────────────────────────────────────
function SendLinkForm({
  email, setEmail, onSubmit, loading, error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2 w-full">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        required
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#1D1D1D] text-sm text-gray-900 dark:text-[#E8E8E6] placeholder:text-gray-400 dark:placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading ? 'Enviando…' : 'Enviarme enlace de acceso'}
      </button>
    </form>
  );
}

// ── Shared layout shell ────────────────────────────────────────────────────
function Screen({
  icon,
  color,
  title,
  children,
}: {
  icon: 'check' | 'mail' | 'clock' | 'x';
  color: 'emerald' | 'amber' | 'red';
  title: string;
  children: React.ReactNode;
}) {
  const bg: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30',
    amber: 'bg-amber-100 dark:bg-amber-900/30',
    red: 'bg-red-100 dark:bg-red-900/30',
  };
  const fg: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };
  const icons: Record<string, React.ReactNode> = {
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    x: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#242424] shadow-sm p-8 text-center space-y-4">
        <div className={`w-12 h-12 rounded-xl ${bg[color]} flex items-center justify-center mx-auto`}>
          <svg className={`w-6 h-6 ${fg[color]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[icon]}
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{title}</h1>
        {children}
      </div>
    </div>
  );
}
