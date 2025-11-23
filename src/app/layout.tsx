import './globals.css';
import { Inter } from 'next/font/google';

import { ThemeProvider } from '@/components/theme-provider';
import { SessionTimeoutProvider } from '@/components/auth/session-timeout-provider';
import { Toaster } from '@/components/ui/sonner';

import type { Metadata } from 'next';
import type React from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Insolventic',
  description: 'Insolventic',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light">
          {/* 
            SessionTimeoutProvider: Auto-logout tras inactividad
            - timeoutMinutes: 15 = logout después de 15 minutos de inactividad
            - warningMinutes: 2 = advertencia 2 minutos antes del logout
            Para testing, cambiar a: timeoutMinutes={0.5} warningMinutes={0.17}
          */}
          <SessionTimeoutProvider timeoutMinutes={15} warningMinutes={2}>
            {children}
          </SessionTimeoutProvider>
          <Toaster closeButton richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
