'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import ThemeRegistry from '@/components/ThemeRegistry';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeRegistry>
        <SnackbarProvider 
          maxSnack={3} 
          autoHideDuration={3000}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
        >
          {children}
        </SnackbarProvider>
      </ThemeRegistry>
    </SessionProvider>
  );
} 