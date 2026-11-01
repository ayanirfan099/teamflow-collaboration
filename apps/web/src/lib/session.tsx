'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { apiGet, apiSend } from './api';
import type { MembershipDto, UserDto } from '@teamflow/contracts';

export interface SessionState {
  user: UserDto;
  memberships: MembershipDto[];
}

export interface SessionContextValue {
  session: SessionState | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeOrganizationId: string | null;
  activeMembership: MembershipDto | null;
  setActiveOrganization: (organizationId: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

const ACTIVE_ORGANIZATION_KEY = 'teamflow.activeOrganizationId';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeOrganizationId, setActiveOrganizationId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await apiGet<SessionState>('/auth/me');
      return response.data;
    },
    retry: false,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!data) {
      return;
    }
    const stored = window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
    const valid = data.memberships.some((membership) => membership.organizationId === stored);
    const next = valid ? stored : (data.memberships[0]?.organizationId ?? null);
    setActiveOrganizationId((current) => (current === next ? current : next));
  }, [data]);

  const setActiveOrganization = React.useCallback((organizationId: string) => {
    window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
    setActiveOrganizationId(organizationId);
  }, []);

  const signOut = React.useCallback(async () => {
    await apiSend('/auth/logout', 'POST').catch(() => undefined);
    queryClient.clear();
    setActiveOrganizationId(null);
    window.location.href = '/login';
  }, [queryClient]);

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  }, [queryClient]);

  const value = React.useMemo<SessionContextValue>(() => {
    const memberships = data?.memberships ?? [];
    return {
      session: data ?? null,
      isLoading,
      isAuthenticated: Boolean(data),
      activeOrganizationId,
      activeMembership:
        memberships.find((membership) => membership.organizationId === activeOrganizationId) ??
        null,
      setActiveOrganization,
      signOut,
      refresh,
    };
  }, [data, isLoading, activeOrganizationId, setActiveOrganization, signOut, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return context;
}
