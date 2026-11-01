'use client';

import { QueryClient, QueryClientProvider as BaseQueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

export function QueryClientProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <BaseQueryClientProvider client={client}>{children}</BaseQueryClientProvider>;
}
