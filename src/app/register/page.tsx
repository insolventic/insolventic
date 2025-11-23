import { Suspense } from 'react';

import { RegisterForm } from './components/register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <Suspense fallback={<div>Cargando...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
