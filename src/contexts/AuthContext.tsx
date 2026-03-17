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
  signOut: async () => {},
});

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

  const resetUserState = useCallback(() => {
    clearStoreCache();
    setProfile(null);
    setMemberships([]);
    setActiveMembership(null);
    setOrganizationId(null);
    setOrganizationLogoUrl(null);
    setMembershipRole(null);
  }, []);

  const hydrateUserContext = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      resetUserState();
      return;
    }

    try {
      // Use SECURITY DEFINER RPC — bypasses RLS entirely, avoids silent failures
      // when auth.uid() isn't attached to the JWT during brief post-login race conditions.
      let { data: ctx, error: ctxError } = await supabase.rpc('get_my_context');

      // Retry once after 800ms — handles brief post-login JWT propagation delays
      if ((ctxError || !ctx) && mountedRef.current) {
        await new Promise(r => setTimeout(r, 800));
        const retry = await supabase.rpc('get_my_context');
        ctx = retry.data;
        ctxError = retry.error;
      }

      if (!mountedRef.current) return;

      if (ctxError || !ctx) {
        // RPC still not available — fall back to direct queries
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

        const profileWithOrg = profileRow
          ? { ...profileRow, organizations: orgName ? { name: orgName } : null }
          : null;
        const fallbackRole =
          profileRow?.role_name === 'admin' ? 'admin'
          : profileRow?.role_name === 'approver' ? 'approver'
          : profileRow?.role_name ? 'member'
          : null;

        setProfile((profileWithOrg as Profile) ?? null);
        setMemberships(membershipRows);
        setActiveMembership(resolvedMembership);
        setOrganizationId(orgId);
        setOrganizationLogoUrl(orgLogoUrl);
        setMembershipRole((resolvedMembership?.role as MembershipRole | undefined) || (fallbackRole as MembershipRole | null));
        return;
      }

      // RPC succeeded — parse results
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

      const allMemberships = membership ? [membership] : [];

      setProfile((profileWithOrg as Profile) ?? null);
      setMemberships(allMemberships);
      setActiveMembership(membership);
      setOrganizationId(orgId);
      setOrganizationLogoUrl(ctx.org_logo_url ?? null);
      setMembershipRole((membership?.role as MembershipRole | undefined) || (fallbackRole as MembershipRole | null));
    } catch {
      // Don't reset state on transient errors — the session is still valid.
      // The user will see stale data rather than being logged out unexpectedly.
      if (!mountedRef.current) return;
    }
  }, [resetUserState]);

  const refreshAuthState = useCallback(async () => {
    setLoading(true);
    try {
      // Timeout so a hanging getSession() never blocks forever
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

    // Hard fallback: if nothing resolves in 8s, stop showing spinner
    const fallback = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 8000);

    // onAuthStateChange fires INITIAL_SESSION immediately with the current session,
    // and also fires SIGNED_IN after Supabase processes any hash-based auth tokens.
    // We rely on it exclusively so we never call getSession() concurrently with
    // hash processing, which would cause "Lock stolen" AbortErrors.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mountedRef.current) return;
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        clearStoreCache();
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      await hydrateUserContext(currentSession?.user ?? null);
      if (mountedRef.current) setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [hydrateUserContext]);

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
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
