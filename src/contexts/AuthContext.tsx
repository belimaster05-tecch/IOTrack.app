'use client'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { clearStoreCache } from '@/lib/hooks';
import { Session, User } from '@supabase/supabase-js';

type MembershipRole = 'owner' | 'admin' | 'approver' | 'member';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  role_name: string | null;
  job_title: string | null;
  department_id: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  organizations?: { name: string } | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: any[];
  activeMembership: any | null;
  organizationId: string | null;
  organizationLogoUrl: string | null;
  membershipRole: MembershipRole | null;
  loading: boolean;
  refreshAuthState: () => Promise<void>;
  updateProfileAvatar: (url: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  memberships: [],
  activeMembership: null,
  organizationId: null,
  organizationLogoUrl: null,
  membershipRole: null,
  loading: true,
  refreshAuthState: async () => {},
  updateProfileAvatar: () => {},
  signOut: async () => {},
});

// ─── SessionStorage cache ────────────────────────────────────────────────────
// Stores hydrated auth state so subsequent full reloads don't show a spinner.
// Cache is keyed by user ID and expires after 10 minutes.
const CACHE_KEY = 'iotrack_auth_v1';
const CACHE_TTL = 10 * 60 * 1000;

interface CachedAuth {
  uid: string;
  ts: number;
  profile: Profile | null;
  memberships: any[];
  activeMembership: any | null;
  organizationId: string | null;
  organizationLogoUrl: string | null;
  membershipRole: string | null;
}

function readAuthCache(uid: string): CachedAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c: CachedAuth = JSON.parse(raw);
    if (c.uid !== uid || Date.now() - c.ts > CACHE_TTL) return null;
    return c;
  } catch { return null; }
}

function writeAuthCache(uid: string, data: Omit<CachedAuth, 'uid' | 'ts'>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, uid, ts: Date.now() }));
  } catch {}
}

function clearAuthCache() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}
// ────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [activeMembership, setActiveMembership] = useState<any | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<MembershipRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  // Tracks the last known-good profile so re-hydration can't null it out on transient failures
  const validProfileRef = useRef<Profile | null>(null);

  const resetUserState = useCallback(() => {
    clearStoreCache();
    clearAuthCache();
    validProfileRef.current = null;
    setProfile(null);
    setMemberships([]);
    setActiveMembership(null);
    setOrganizationId(null);
    setOrganizationLogoUrl(null);
    setMembershipRole(null);
  }, []);

  const applyState = useCallback((data: Omit<CachedAuth, 'uid' | 'ts'>) => {
    if (data.profile) validProfileRef.current = data.profile;
    setProfile(data.profile);
    setMemberships(data.memberships);
    setActiveMembership(data.activeMembership);
    setOrganizationId(data.organizationId);
    setOrganizationLogoUrl(data.organizationLogoUrl);
    setMembershipRole(data.membershipRole as MembershipRole | null);
  }, []);

  // Returns true if ctx has usable data (non-empty profile or membership)
  const isCtxUsable = (ctx: any) =>
    ctx && (ctx.profile?.id || ctx.membership?.user_id);

  const hydrateUserContext = useCallback(async (currentUser: User | null, { silent = false } = {}) => {
    if (!currentUser) {
      resetUserState();
      return;
    }

    try {
      let { data: ctx, error: ctxError } = await supabase.rpc('get_my_context');

      // Retry after 300ms if RPC failed OR returned empty data
      if ((!isCtxUsable(ctx) || ctxError) && mountedRef.current) {
        await new Promise(r => setTimeout(r, 300));
        const retry = await supabase.rpc('get_my_context');
        ctx = retry.data;
        ctxError = retry.error;
      }

      if (!mountedRef.current) return;

      if (!isCtxUsable(ctx) || ctxError) {
        // Fallback to direct queries
        const [profileResult, membershipsResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', currentUser.id).single(),
          supabase
            .from('organization_memberships')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .order('is_default', { ascending: false })
            .order('joined_at', { ascending: true }),
        ]);

        if (!mountedRef.current) return;

        const profileRow = profileResult.data;
        const membershipRows = membershipsResult?.data || [];
        const resolvedMembership = membershipRows[0] || null;
        const orgId = resolvedMembership?.organization_id || profileRow?.organization_id || null;

        let orgName: string | null = null;
        let orgLogoUrl: string | null = null;
        if (orgId) {
          const { data: orgRow } = await supabase.from('organizations').select('name, logo_url').eq('id', orgId).single();
          orgName = orgRow?.name ?? null;
          orgLogoUrl = orgRow?.logo_url ?? null;
        }

        if (!mountedRef.current) return;

        const fallbackRole =
          profileRow?.role_name === 'admin' ? 'admin'
          : profileRow?.role_name === 'approver' ? 'approver'
          : profileRow?.role_name ? 'member'
          : null;

        const profileWithOrg = profileRow
          ? { ...profileRow, organizations: orgName ? { name: orgName } : null }
          : null;

        const stateData = {
          profile: (profileWithOrg as Profile) ?? null,
          memberships: membershipRows,
          activeMembership: resolvedMembership,
          organizationId: orgId,
          organizationLogoUrl: orgLogoUrl,
          membershipRole: (resolvedMembership?.role ?? fallbackRole) as MembershipRole | null,
        };
        // Guard: never wipe a valid profile with null on a transient DB failure
        if (stateData.profile || !validProfileRef.current) {
          applyState(stateData);
          if (profileRow) writeAuthCache(currentUser.id, stateData);
        }
        return;
      }

      // RPC succeeded
      const profileRow = ctx.profile ?? null;
      const membership = ctx.membership?.user_id ? ctx.membership : null;
      const orgName: string | null = ctx.org_name ?? null;
      const orgId = membership?.organization_id || profileRow?.organization_id || null;

      const profileWithOrg = profileRow
        ? { ...profileRow, organizations: orgName ? { name: orgName } : null }
        : null;

      const fallbackRole =
        profileRow?.role_name === 'admin' ? 'admin'
        : profileRow?.role_name === 'approver' ? 'approver'
        : profileRow?.role_name ? 'member'
        : null;

      const stateData = {
        profile: (profileWithOrg as Profile) ?? null,
        memberships: membership ? [membership] : [],
        activeMembership: membership,
        organizationId: orgId,
        organizationLogoUrl: ctx.org_logo_url ?? null,
        membershipRole: ((membership?.role ?? fallbackRole) as MembershipRole | null),
      };
      // Guard: never wipe a valid profile with null on a transient RPC failure
      if (stateData.profile || !validProfileRef.current) {
        applyState(stateData);
        if (profileRow) writeAuthCache(currentUser.id, stateData);
      }
    } catch {
      if (!mountedRef.current) return;
      // Don't reset state on transient errors — show stale data rather than blank
    }
  }, [resetUserState, applyState]);

  const refreshAuthState = useCallback(async () => {
    setLoading(true);
    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('auth_timeout')), 6000)
        ),
      ]);
      const currentSession = (sessionResult as any).data?.session ?? null;
      if (!mountedRef.current) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      await hydrateUserContext(currentSession?.user ?? null);
    } catch {
      if (!mountedRef.current) return;
      setSession(null);
      setUser(null);
      resetUserState();
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [hydrateUserContext, resetUserState]);

  useEffect(() => {
    mountedRef.current = true;

    // Hard fallback: never spin forever
    const fallback = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        clearStoreCache();
        clearAuthCache();
        setSession(null);
        setUser(null);
        resetUserState();
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        clearStoreCache();
        clearAuthCache();
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      // ── Fast path: serve from cache on INITIAL_SESSION ──────────────────
      // This eliminates the spinner on subsequent full page reloads.
      if (event === 'INITIAL_SESSION' && currentSession?.user) {
        const cached = readAuthCache(currentSession.user.id);
        if (cached) {
          applyState(cached);
          setLoading(false);
          clearTimeout(fallback);
          // Still revalidate in background (don't set loading = true again)
          void hydrateUserContext(currentSession.user, { silent: true });
          return;
        }
      }

      await hydrateUserContext(currentSession?.user ?? null);
      if (mountedRef.current) setLoading(false);
      clearTimeout(fallback);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [hydrateUserContext, resetUserState, applyState]);

  /** Updates avatar_url in profile state + cache without triggering a full reload */
  const updateProfileAvatar = useCallback((url: string) => {
    setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    if (user) {
      const cached = readAuthCache(user.id);
      if (cached) writeAuthCache(user.id, { ...cached, profile: cached.profile ? { ...cached.profile, avatar_url: url } : cached.profile });
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        memberships,
        activeMembership,
        organizationId,
        organizationLogoUrl,
        membershipRole,
        loading,
        refreshAuthState,
        updateProfileAvatar,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
