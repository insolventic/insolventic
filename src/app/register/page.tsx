import { Suspense } from 'react';

import { RegisterForm } from './components/register-form';

export default function RegisterPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
