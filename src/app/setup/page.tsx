'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// Clear auth cache so middleware reads fresh has_password on next load
function clearAuthCache() {
  try { sessionStorage.removeItem('iotrack_auth_v1'); } catch {}
}

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verify user is authenticated before showing form
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      // Pre-fill name if already set (e.g. from Google or previous attempt)
      if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('El nombre es requerido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('La contraseña debe incluir al menos un número.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      // updateUser sets the password AND stores has_password flag so middleware
      // knows this user has completed setup and can access the app normally.
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

      // Clear cache + full reload so middleware reads the refreshed session (updated has_password)
      clearAuthCache();
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A]">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1A1A1A] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#242424] shadow-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Configura tu cuenta</h1>
          <p className="text-sm text-gray-500 dark:text-[#787774]">
            Establece tu nombre y contraseña para acceder en el futuro.
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
              Contraseña
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

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando…' : 'Continuar al panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
