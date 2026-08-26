import { requirePageAuth } from '@/lib/auth';
import { DocumentsPageContent } from './components/documents-page-content';

export default async function DocumentsPage() {
  // Verify authentication server-side before rendering (M-9). La página era
  // un client component, así que el contenido vive en documents-page-content
  // y este wrapper server hace el guard.
  await requirePageAuth('/documents');

  return <DocumentsPageContent />;
}
