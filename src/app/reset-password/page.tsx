'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Status = 'waiting' | 'ready' | 'expired' | 'done' | 'error';

// ── Shared layout shell (same pattern as /invitacion) ──────────────────────
function Screen({
  icon,
  color,
  title,
  children,
}: {
  icon: 'check' | 'lock' | 'clock' | 'x';
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
    lock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('waiting');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const settled = useRef(false);

  useEffect(() => {
    // 1. Detect hash error immediately (e.g. otp_expired)
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      setStatus('expired');
      return;
    }

    // 2. Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && !settled.current) {
        settled.current = true;
        // Pre-fill name if available
        if (session?.user?.user_metadata?.full_name) {
          setFullName(session.user.user_metadata.full_name);
        }
        setStatus('ready');
        subscription.unsubscribe();
        clearTimeout(timer);
      }
    });

    // 3. Fallback: 5s timeout → expired
    const timer = setTimeout(() => {
      if (!settled.current) {
        setStatus('expired');
        subscription.unsubscribe();
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('El nombre es requerido.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setErrorMsg('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setErrorMsg('La contraseña debe incluir al menos un número.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim(), has_password: true },
      });
      if (updateError) throw updateError;

      // Sync name to profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName.trim() })
          .eq('id', user.id);
      }

      setStatus('done');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar.');
      setStatus('error');
      setSaving(false);
    }
  }

  // ── SCREENS ────────────────────────────────────────────────────────────────

  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 dark:text-[#787774]">Verificando enlace…</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <Screen icon="clock" color="amber" title="Enlace expirado">
        <p className="text-sm text-gray-500 dark:text-[#787774]">
          El enlace de restablecimiento venció o ya fue utilizado. Solicita uno nuevo desde la pantalla de inicio de sesión.
        </p>
        <Link
          href="/login"
          className="block w-full py-2.5 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors text-center"
        >
          Volver al inicio de sesión
        </Link>
      </Screen>
    );
  }

  if (status === 'done') {
    return (
      <Screen icon="check" color="emerald" title="Contraseña actualizada">
        <p className="text-sm text-gray-500 dark:text-[#787774]">
          Tu contraseña fue guardada correctamente. Redirigiendo al panel…
        </p>
      </Screen>
    );
  }

  // status === 'ready' or 'error' — show the form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#242424] shadow-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Nueva contraseña</h1>
          <p className="text-sm text-gray-500 dark:text-[#787774]">
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] text-sm placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] text-sm placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-400 dark:text-[#555]">Mínimo 8 caracteres, una mayúscula y un número.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] text-sm placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
