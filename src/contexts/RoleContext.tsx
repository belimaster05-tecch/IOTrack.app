'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type Role = 'admin' | 'approver' | 'employee';

interface RoleContextType {
  role: Role | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, membershipRole, profile } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    if (membershipRole === 'owner' || membershipRole === 'admin') {
      setRole('admin');
    } else if (membershipRole === 'approver') {
      setRole('approver');
    } else if (profile?.role_name === 'admin') {
      setRole('admin');
    } else if (profile?.role_name === 'approver') {
      setRole('approver');
    } else {
      setRole('employee');
    }
    setLoading(false);
  }, [membershipRole, profile?.role_name, user]);

  return (
    <RoleContext.Provider value={{ role, loading }}>
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
