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
 * El formulario y la action `registerUser` se eliminaron el 2026-11-12: el
 * formulario estaba huérfano desde el cierre y la action tomaba el centro del
 * cuerpo de la petición, así que un administrador de un centro podía crear
 * usuarios en otro. Una reapertura se construye de nuevo, con el centro de la
 * sesión o de un enlace de invitación, no desde este punto.
 * Esta página queda solo como redirect para quien tenga la URL vieja.
 */
export default function RegisterPage() {
  redirect('/login');
}
