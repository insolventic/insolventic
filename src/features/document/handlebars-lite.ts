/**
 * Handlebars-Lite — Minimal template engine for document generation.
 *
 * Supports:
 *   - {{VARIABLE}}               — simple substitution (identical to legacy)
 *   - {{#if FLAG}}...{{/if}}     — conditional block
 *   - {{#unless FLAG}}...{{/unless}}
 *   - {{#each LIST}}...{{/each}} — iteration (per-item context merged with parent)
 *
 * Design goals:
 *   1. Zero runtime dependencies.
 *   2. Fast-path for templates without control flow → equivalent to legacy
 *      simple replace. This keeps the 50+ insolvency templates untouched
 *      and unaffected.
 *   3. HTML-comment-aware: templates may wrap tags in comments so the raw
 *      HTML is still valid without a rendering pass, e.g.
 *        <!-- {{#if HAS_FOO}} -->
 *   4. Closing tags may carry an optional identifier ({{/if HAS_FOO}}) —
 *      it's stripped during normalization.
 *   5. Pure functions, no I/O, easy to unit-test.
 *
 * NOT supported (intentionally — YAGNI):
 *   - Partials, helpers, else branches, nested path expressions, escaping.
 *   - Current templates do not need any of these.
 */

export type TemplateContext = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Normalization: strip HTML comments around control tokens + unify close tags
// ---------------------------------------------------------------------------

const WRAPPER_RE = /<!--\s*(\{\{[#/](?:if|unless|each)[^{}]*?\}\})\s*-->/g;

const CLOSE_WITH_ID_RE = /\{\{\/(if|unless|each)\s+[A-Za-z0-9_]+\s*\}\}/g;

function normalize(html: string): string {
  return html.replace(WRAPPER_RE, '$1').replace(CLOSE_WITH_ID_RE, '{{/$1}}');
}

// ---------------------------------------------------------------------------
// Truthiness rules (mirrors Handlebars semantics)
// ---------------------------------------------------------------------------

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ---------------------------------------------------------------------------
// Simple variable substitution (fast path)
// ---------------------------------------------------------------------------

const VAR_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function substituteVars(src: string, ctx: TemplateContext): string {
  return src.replace(VAR_RE, (_, key) => {
    const v = ctx[key];
    if (v === null || v === undefined) return '';
    return String(v);
  });
}

// ---------------------------------------------------------------------------
// Block resolver (innermost-first, iterative until stable)
// ---------------------------------------------------------------------------

// Innermost = a block whose body contains NO further {{#...}} openers.
// Negative lookahead `(?!\{\{#)` enforces that inside the non-greedy body.
const EACH_BLOCK_RE =
  /\{\{#each\s+([A-Za-z0-9_]+)\s*\}\}((?:(?!\{\{#(?:each|if|unless)\b)[\s\S])*?)\{\{\/each\}\}/g;
const IF_BLOCK_RE =
  /\{\{#if\s+([A-Za-z0-9_]+)\s*\}\}((?:(?!\{\{#(?:each|if|unless)\b)[\s\S])*?)\{\{\/if\}\}/g;
const UNLESS_BLOCK_RE =
  /\{\{#unless\s+([A-Za-z0-9_]+)\s*\}\}((?:(?!\{\{#(?:each|if|unless)\b)[\s\S])*?)\{\{\/unless\}\}/g;

function resolveBlocks(src: string, ctx: TemplateContext): string {
  let current = src;
  // Safety cap prevents runaway loops on malformed templates.
  for (let pass = 0; pass < 32; pass++) {
    const before = current;

    current = current.replace(EACH_BLOCK_RE, (_, key: string, body: string) => {
      const list = ctx[key];
      if (!Array.isArray(list) || list.length === 0) return '';
      return list
        .map((item) => {
          const itemCtx: TemplateContext =
            item && typeof item === 'object'
              ? { ...ctx, ...(item as TemplateContext) }
              : { ...ctx, this: item };
          // Inner body cannot contain further blocks (that's why this is
          // innermost), so a single var-substitute pass is sufficient.
          return substituteVars(body, itemCtx);
        })
        .join('');
    });

    current = current.replace(
      UNLESS_BLOCK_RE,
      (_, key: string, body: string) => (isTruthy(ctx[key]) ? '' : body),
    );

    current = current.replace(IF_BLOCK_RE, (_, key: string, body: string) =>
      isTruthy(ctx[key]) ? body : '',
    );

    if (current === before) break; // stable
  }
  return current;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an HTML template against a context.
 *
 * Fast path: if the template has no `{{#` control tokens, skip parsing and
 * delegate to plain variable substitution. Legacy insolvency templates all
 * take this path so their output is byte-identical to `replacePlaceholders`.
 */
export function renderTemplate(html: string, ctx: TemplateContext): string {
  if (!html.includes('{{#')) {
    // Fast path — no control flow present anywhere.
    return substituteVars(html, ctx);
  }

  const normalized = normalize(html);
  const withBlocks = resolveBlocks(normalized, ctx);
  return substituteVars(withBlocks, ctx);
}
