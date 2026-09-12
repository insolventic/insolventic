import { requirePageAuth } from '@/lib/auth';
import { DocumentsPageContent } from './components/documents-page-content';

/**
 * C-4: presupuesto de ejecución para las server actions de generación.
 *
 * Sin esto rige el default de Vercel (10 s en Hobby). `batchGenerateDocuments`
 * lanza Chromium y puede procesar decenas de plantillas: el timeout era el
 * modo de fallo más probable en producción, y además invisible (la función se
 * cortaba sin dejar rastro para el usuario).
 *
 * 60 s es el máximo del plan Hobby. Si el proyecto pasa a Pro, puede subirse
 * hasta 300. Los lotes que no quepan en el presupuesto deben trocearse: ver
 * docs/IMPLEMENTACION_SEMANA_3.md.
 */
export const maxDuration = 60;

export default async function DocumentsPage() {
  // Verify authentication server-side before rendering (M-9). La página era
  // un client component, así que el contenido vive en documents-page-content
  // y este wrapper server hace el guard.
  await requirePageAuth('/documents');

  return <DocumentsPageContent />;
}
