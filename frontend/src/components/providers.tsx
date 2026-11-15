'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { ApiClient } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const { setUser, setCurrentOrganization, setOrganizations } = useAppStore();

  useEffect(() => {
    // Hydrate theme from localStorage
    const savedTheme = localStorage.getItem('knowledgeai_theme') || 'dark';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    // Hydrate current user & organization if token present
    const token = localStorage.getItem('knowledgeai_token');
    if (token) {
      ApiClient.get('/auth/me')
        .then((res) => {
          if (res) {
            setUser({
              id: res.user.id,
              email: res.user.email,
              full_name: res.user.full_name,
              avatar_url: res.user.avatar_url,
              role: res.activeRole,
            });

            if (res.organizations && res.organizations.length > 0) {
              setOrganizations(res.organizations);
              const activeId = localStorage.getItem('knowledgeai_active_org_id') || res.activeOrganizationId;
              const found = res.organizations.find((o: any) => o.id === activeId) || res.organizations[0];
              setCurrentOrganization(found);
            }
          }
        })
        .catch(() => {
          // Token may be invalid
        });
    }
  }, [setUser, setCurrentOrganization, setOrganizations]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
