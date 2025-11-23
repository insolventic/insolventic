import { Suspense } from 'react';

import { ForgotPasswordForm } from './components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <Suspense fallback={<div>Cargando...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
