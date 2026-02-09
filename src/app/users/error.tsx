'use client';

import { AuthErrorBoundary } from '@/components/auth/auth-error-boundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UsersError({ error, reset }: ErrorProps) {
  return <AuthErrorBoundary error={error} reset={reset} />;
}
