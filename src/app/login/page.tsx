import { Suspense } from 'react';

import { LoginForm } from './components/login-form';

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
