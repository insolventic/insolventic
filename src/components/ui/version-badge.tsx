'use client';

import { APP_NAME, APP_VERSION, getAppEnvironment } from '@/config/version';

const ENV_STYLES: Record<string, string> = {
  production: 'text-muted-foreground/50',
  staging: 'text-amber-500/60',
  development: 'text-blue-500/60',
};

const ENV_SUFFIX: Record<string, string> = {
  production: '',
  staging: '-staging',
  development: '-dev',
};

/**
 * Subtle version indicator displayed in the bottom-left corner of the app.
 * Reads version from the centralized config (package.json).
 */
export function VersionBadge() {
  const env = getAppEnvironment();
  const suffix = ENV_SUFFIX[env] ?? '';
  const colorClass = ENV_STYLES[env] ?? ENV_STYLES.development;

  return (
    <div
      className={`fixed bottom-2 left-3 z-50 text-[10px] font-medium tracking-wide select-none ${colorClass}`}
      aria-label={`${APP_NAME} versión ${APP_VERSION}${suffix}`}
    >
      {APP_NAME} v{APP_VERSION}
      {suffix}
    </div>
  );
}
