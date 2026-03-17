'use client'
import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type Role = 'admin' | 'approver' | 'employee';

interface RoleContextType {
  role: Role | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { membershipRole, profile, loading: authLoading } = useAuth();

  // Derive role synchronously — no separate async step, no double-loading waterfall.
  const role = useMemo<Role | null>(() => {
    if (authLoading) return null;
    if (membershipRole === 'owner' || membershipRole === 'admin') return 'admin';
    if (membershipRole === 'approver') return 'approver';
    if (profile?.role_name === 'admin') return 'admin';
    if (profile?.role_name === 'approver') return 'approver';
    // Authenticated but no membership/role yet — treat as employee
    return 'employee';
  }, [membershipRole, profile?.role_name, authLoading]);

  return (
    <RoleContext.Provider value={{ role, loading: authLoading }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
