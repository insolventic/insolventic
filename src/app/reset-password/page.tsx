import { Suspense } from 'react';

import { ResetPasswordForm } from './components/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
