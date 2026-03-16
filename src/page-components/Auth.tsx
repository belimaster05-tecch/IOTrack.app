'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  Package,
  QrCode,
  Shield,
  User,
  BarChart3,
  Loader2,
} from 'lucide-react';

export function Auth({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';
  const isInviteFlow = nextUrl.startsWith('/invitacion/');
  const urlError = searchParams.get('error');
  const { user, membershipRole, organizationId, refreshAuthState } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginOrg, setLoginOrg] = useState<{ name: string; role: string } | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  useEffect(() => {
    if (urlError === 'link_invalid') {
      setError('El enlace ya no es válido. Ingresa tus credenciales para continuar.');
    }
  }, [urlError]);

  useEffect(() => {
    if (!user || provisioning || loginOrg) return;
    if (isLogin || organizationId || membershipRole === 'owner' || membershipRole === 'admin') {
      router.replace(nextUrl);
    }
  }, [isLogin, loginOrg, membershipRole, nextUrl, router, organizationId, provisioning, user]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
    if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
    return null;
  };

  const handleGoogleLogin = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${appUrl}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin) {
      const pwdError = validatePassword(password);
      if (pwdError) { setError(pwdError); return; }
      if (!isInviteFlow && !orgName.trim()) { setError('El nombre de la organización es obligatorio.'); return; }
      if (!fullName.trim()) { setError('El nombre completo es obligatorio.'); return; }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Fetch org info to show confirmation step (use RPC — no FK between profiles and organizations)
        if (signInData.user) {
          const { data: ctx } = await supabase.rpc('get_my_context');
          const orgDisplayName = ctx?.org_name ?? 'tu organización';
          const roleName = ctx?.profile?.role_name ?? ctx?.membership?.role;
          const roleDisplay =
            roleName === 'admin' || roleName === 'owner' ? 'Administrador'
            : roleName === 'approver' ? 'Aprobador'
            : 'Empleado';
          setLoginOrg({ name: orgDisplayName, role: roleDisplay });
          setTimeout(() => {
            setLoginOrg(null);
            router.replace(nextUrl);
          }, 1800);
        }
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, ...(isInviteFlow ? {} : { organization_name: orgName }) } },
        });

        // "User already registered" — account was pre-created by the invite email.
        // In invite flow: try signing in directly with the provided credentials.
        if (error) {
          const alreadyExists =
            error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('already been registered') ||
            error.message.toLowerCase().includes('user already');

          if (alreadyExists && isInviteFlow) {
            // Attempt direct sign-in with the password they just entered
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
              // Wrong password or no password set (invite link flow) — guide them
              setIsLogin(true);
              setError('Ya tienes una cuenta. Ingresa tu contraseña, o usa "¿Olvidaste tu contraseña?" si aún no la has configurado.');
              return;
            }
            if (signInData.session) {
              router.replace(nextUrl);
              return;
            }
          }
          throw error;
        }

        if (data.user && data.session) {
          if (isInviteFlow) {
            // Invited user — no org to create, just redirect to invite page
            router.replace(nextUrl);
          } else {
            setProvisioning(true);
            const { error: rpcError } = await supabase.rpc('provision_organization', {
              p_full_name: fullName.trim(),
              p_org_name: orgName.trim(),
            });
            if (rpcError) throw rpcError;
            await refreshAuthState();
            router.replace(nextUrl);
          }
        } else {
          setError('Registro exitoso. Por favor, revisa tu correo para confirmar tu cuenta.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setProvisioning(false);
      setLoading(false);
    }
  };

  const features = [
    { icon: Package, text: 'Inventario completo con QR y fotos' },
    { icon: CheckCircle2, text: 'Flujos de aprobación configurables' },
    { icon: QrCode, text: 'Check-in/out en segundos' },
    { icon: BarChart3, text: 'Reportes y analíticas en tiempo real' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 flex-col justify-between p-10 xl:p-14 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Recurso<span className="text-emerald-200">Track</span>
          </span>
        </Link>

        {/* Main copy */}
        <div className="relative">
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Gestiona tus recursos<br />
            <span className="text-emerald-200">con precisión.</span>
          </h2>
          <p className="text-emerald-100/80 text-base leading-relaxed mb-10">
            La plataforma completa para escuelas e instituciones. Inventario, préstamos y QR en un solo lugar.
          </p>

          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-emerald-100/90">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust badge */}
        <div className="relative flex items-center gap-3 bg-white/15 rounded-2xl px-4 py-3">
          <Shield className="w-5 h-5 text-white shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white">Datos seguros y aislados</p>
            <p className="text-[11px] text-emerald-100/70">Encriptación en tránsito y en reposo · Row Level Security</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-[#F5F5F3] dark:bg-[#191919]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            {isLogin ? '¿Sin cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
          </button>
        </div>

        {/* Form area — centered */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">

          {/* Tenant confirmation overlay */}
          {loginOrg && (
            <div className="flex flex-col items-center justify-center gap-5 py-12">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold">{loginOrg.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ingresando como</p>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{loginOrg.name}</h2>
                <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  {loginOrg.role}
                </span>
              </div>
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mt-2" />
            </div>
          )}

          {!loginOrg && (<>
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Recurso<span className="text-emerald-600">Track</span>
              </span>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                {isLogin ? 'Bienvenido de nuevo' : isInviteFlow ? 'Crea tu cuenta' : 'Crear organización'}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                {isLogin
                  ? 'Accede a tu panel de inventario y reservas.'
                  : isInviteFlow
                  ? 'Completa tu registro para unirte a la organización.'
                  : 'Crea la cuenta principal para comenzar a operar.'}
              </p>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-[#202020] rounded-2xl border border-black/[0.06] dark:border-white/[0.06] shadow-sm p-7">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {!isLogin && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nombre completo
                      </label>
                      <Input
                        type="text"
                        required
                        icon={<User className="h-4 w-4" />}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    {!isInviteFlow && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Nombre de la organización
                        </label>
                        <Input
                          type="text"
                          required
                          icon={<Building2 className="h-4 w-4" />}
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="Ej. Colegio Makarios"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    required
                    icon={<Mail className="h-4 w-4" />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@organizacion.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Contraseña
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); setError(null); }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    required
                    icon={<Lock className="h-4 w-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                  />
                  {!isLogin && (
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      Mínimo 8 caracteres, una mayúscula y un número.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-900/30 dark:bg-red-950/20">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="mt-1 h-11 w-full bg-gray-900 text-sm text-white hover:bg-gray-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
                  disabled={loading}
                >
                  {loading ? 'Procesando...' : isLogin ? 'Entrar' : isInviteFlow ? 'Crear cuenta' : 'Crear organización'}
                </Button>
              </form>

              {/* Divider */}
              {isLogin && (
                <>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-[#2D2D2D]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-[#202020] px-3 text-gray-400 dark:text-[#555]">o continúa con</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-3 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1D1D1D] text-sm font-medium text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuar con Google
                  </button>
                </>
              )}
            </div>

            {/* Footer switch */}
            <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
              </button>
            </p>
          </>)} {/* end !loginOrg */}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#242424] p-6 shadow-xl">
            {forgotSent ? (
              <div className="text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Revisa tu correo</h3>
                <p className="text-sm text-gray-500 dark:text-[#787774]">
                  Enviamos un enlace para restablecer la contraseña a <span className="font-medium">{forgotEmail}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="mt-2 w-full py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6] mb-1">Restablecer contraseña</h3>
                <p className="text-sm text-gray-500 dark:text-[#787774] mb-4">
                  Recibirás un enlace para crear una nueva contraseña.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <Input
                    type="email"
                    required
                    icon={<Mail className="h-4 w-4" />}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-[#3A3A3A] text-sm text-gray-600 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
