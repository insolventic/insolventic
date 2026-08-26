import { redirect } from 'next/navigation';

/**
 * Registro autoservicio DESHABILITADO (hallazgo C-2, auditoría 2026-08-25).
 *
 * Sin verificación de email, el registro público permitía suplantar a un
 * deudor real (la identidad del modo cliente se resuelve por email). Los
 * usuarios los crea un administrador del centro desde /users (flujo
 * createUser + mustChangePassword). La reapertura con verificación de
 * email + vínculo explícito Debtor↔User queda condicionada a que el modo
 * cliente se vaya a usar realmente.
 *
 * El formulario original se conserva en ./components/register-form.tsx.
 */
export default function RegisterPage() {
  redirect('/login');
}
