import './globals.css';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { ThemeProvider } from '@/components/theme-provider';
import { TenantProvider } from '@/components/tenant-provider';
import { SessionTimeoutProvider } from '@/components/auth/session-timeout-provider';
import { Toaster } from '@/components/ui/sonner';
import { VersionBadge } from '@/components/ui/version-badge';
import { AppFooter } from '@/components/ui/app-footer';

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
      <head>
        {/*
          Inline script to apply tenant colors BEFORE React hydrates.
          Reads the selected tenant from localStorage and sets --primary,
          --primary-foreground, --ring on <html> immediately, preventing
          a flash of the default blue theme while React loads.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('selectedDatabase');if(!t)return;var c={armonia:{l:'25 95% 53%',fl:'0 0% 100%',d:'25 90% 58%',fd:'25 100% 10%'},'constructores-paz':{l:'221.2 83.2% 53.3%',fl:'210 40% 98%',d:'217.2 91.2% 59.8%',fd:'222.2 47.4% 11.2%'}};var v=c[t];if(!v)return;var dk=document.documentElement.classList.contains('dark');var a=dk?v.d:v.l;var f=dk?v.fd:v.fl;var s=document.documentElement.style;s.setProperty('--primary',a);s.setProperty('--primary-foreground',f);s.setProperty('--ring',a);s.setProperty('--tenant-accent',a);s.setProperty('--tenant-accent-foreground',f)}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light">
          {/* 
            SessionTimeoutProvider: Auto-logout tras inactividad
            - timeoutMinutes: 15 = logout después de 15 minutos de inactividad
            - warningMinutes: 2 = advertencia 2 minutos antes del logout
            Para testing, cambiar a: timeoutMinutes={0.5} warningMinutes={0.17}
          */}
          <SessionTimeoutProvider timeoutMinutes={15} warningMinutes={2}>
            <TenantProvider>{children}</TenantProvider>
          </SessionTimeoutProvider>
          <Toaster closeButton richColors />
          <VersionBadge />
          <AppFooter />
        </ThemeProvider>
        {/*
          Vercel Analytics (page views) + Speed Insights (Core Web Vitals).
          They only emit telemetry when deployed on Vercel; local dev is inert.
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
