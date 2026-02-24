'use client';

import { LegalProcessesSection } from './legal-processes-section';

export function LegalProcessSection() {
  return (
    <div className="space-y-6">
      {/* Dynamic Legal Processes - added via button */}
      <LegalProcessesSection />
    </div>
  );
}
