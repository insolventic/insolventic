import { Suspense } from 'react';

import { ForgotPasswordForm } from './components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
