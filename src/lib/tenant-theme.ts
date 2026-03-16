/**
 * Centralized tenant visual identity configuration.
 *
 * Each tenant has its own accent colors that adapt to both light and dark modes.
 * Colors are defined as HSL values (without the `hsl()` wrapper) to integrate
 * seamlessly with the CSS custom property system used by shadcn/ui.
 *
 * To add a new tenant, add an entry here — no other files need changing.
 */

export interface TenantTheme {
  id: string;
  name: string;
  icon: string;
  /** HSL value for the accent color in light mode (e.g. "25 95% 53%") */
  accentLight: string;
  /** HSL value for the accent foreground in light mode */
  accentForegroundLight: string;
  /** HSL value for the accent color in dark mode */
  accentDark: string;
  /** HSL value for the accent foreground in dark mode */
  accentForegroundDark: string;
  /** Tailwind text color class for inline usage (light-safe) */
  textClass: string;
  /** Tailwind bg color class for subtle backgrounds */
  bgClass: string;
  /** Tailwind hover bg class */
  bgHoverClass: string;
}

export const TENANT_THEMES: Record<string, TenantTheme> = {
  armonia: {
    id: 'armonia',
    name: 'Armonia',
    icon: '/images/toucan.png',
    accentLight: '25 95% 53%',
    accentForegroundLight: '0 0% 100%',
    accentDark: '25 90% 58%',
    accentForegroundDark: '25 100% 10%',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50 dark:bg-orange-950',
    bgHoverClass: 'hover:bg-orange-100 dark:hover:bg-orange-900',
  },
  'constructores-paz': {
    id: 'constructores-paz',
    name: 'Constructores de Paz',
    icon: '/images/dove-of-peace.png',
    accentLight: '221.2 83.2% 53.3%',
    accentForegroundLight: '210 40% 98%',
    accentDark: '217.2 91.2% 59.8%',
    accentForegroundDark: '222.2 47.4% 11.2%',
    textClass: 'text-blue-600',
    bgClass: 'bg-blue-50 dark:bg-blue-950',
    bgHoverClass: 'hover:bg-blue-100 dark:hover:bg-blue-900',
  },
};

/**
 * Get the tenant theme config by ID. Falls back to constructores-paz (blue) if unknown.
 */
export function getTenantTheme(
  tenantId: string | null | undefined,
): TenantTheme {
  if (tenantId && TENANT_THEMES[tenantId]) {
    return TENANT_THEMES[tenantId];
  }
  return TENANT_THEMES['constructores-paz'];
}
