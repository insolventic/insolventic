import packageJson from '../../package.json';

/**
 * Centralized version configuration for INSOLVENTIC.
 *
 * The single source of truth is `package.json → version`.
 * All version references across the app read from here.
 *
 * Versioning follows Semantic Versioning (https://semver.org):
 *   MAJOR.MINOR.PATCH
 *   - MAJOR: breaking changes
 *   - MINOR: new backward-compatible features
 *   - PATCH: bug fixes
 */

export const APP_VERSION: string = packageJson.version;

export const APP_NAME = 'INSOLVENTIC';

export type AppEnvironment = 'production' | 'staging' | 'development';

/**
 * Resolves the current application environment.
 * Priority: NEXT_PUBLIC_APP_ENV → NODE_ENV → 'development'
 */
export function getAppEnvironment(): AppEnvironment {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (
    appEnv === 'production' ||
    appEnv === 'staging' ||
    appEnv === 'development'
  ) {
    return appEnv;
  }

  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'development';
  return 'development';
}

/**
 * Returns the full version string with environment suffix.
 *
 * Examples:
 *   production  → "0.1.0"
 *   staging     → "0.1.0-staging"
 *   development → "0.1.0-dev"
 */
export function getFullVersion(): string {
  const env = getAppEnvironment();
  if (env === 'production') return APP_VERSION;
  if (env === 'staging') return `${APP_VERSION}-staging`;
  return `${APP_VERSION}-dev`;
}

/**
 * Returns the display string shown in the UI.
 *
 * Examples:
 *   "INSOLVENTIC v0.1.0"
 *   "INSOLVENTIC v0.1.0-dev"
 */
export function getVersionDisplay(): string {
  return `${APP_NAME} v${getFullVersion()}`;
}
