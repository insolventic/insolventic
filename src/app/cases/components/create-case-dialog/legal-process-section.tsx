'use client';

import { LegalProcessesSection } from './legal-processes-section';

export function LegalProcessSection({
  confirmarAlQuitar = false,
}: {
  /** Ver LegalProcessesSection. */
  confirmarAlQuitar?: boolean;
} = {}) {
  return (
    <div className="space-y-6">
      {/* Dynamic Legal Processes - added via button */}
      <LegalProcessesSection confirmarAlQuitar={confirmarAlQuitar} />
    </div>
  );
}
