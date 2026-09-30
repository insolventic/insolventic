/**
 * Handlebars-Lite — Minimal template engine for document generation.
 *
 * Supports:
 *   - {{VARIABLE}}               — simple substitution (identical to legacy)
 *   - {{#if FLAG}}...{{/if}}     — conditional block
 *   - {{#unless FLAG}}...{{/unless}}
 *   - {{#each LIST}}...{{/each}} — iteration (per-item context merged with parent)
 *   - {{#if @last}} / {{#unless @last}} nested inside {{#each}} — per-item
 *     positional flag, true only for the last element of the current list.
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
 *   - @first / @index: no plantilla los usa hoy y no hay otro lugar del motor
 *     que ya los soporte (confirmado con grep sobre las 65 plantillas antes de
 *     agregar @last — ver PR de este fix). Agregarlos es un cambio aparte.
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
//
// EACH_BLOCK_RE makes ONE exception to "no further openers": a nested
// `{{#if @X}}` / `{{#unless @X}}` (an `@`-prefixed per-item flag, e.g. @last)
// is allowed through — resolveBlocks' each-handler resolves it itself, against
// that item's index, before the generic IF/UNLESS passes ever see it. A plain
// (non-`@`) nested if/unless/each is still rejected, same as before.
const EACH_BLOCK_RE =
  /\{\{#each\s+([A-Za-z0-9_]+)\s*\}\}((?:(?!\{\{#each\b)(?!\{\{#(?:if|unless)\s+(?!@))[\s\S])*?)\{\{\/each\}\}/g;
const IF_BLOCK_RE =
  /\{\{#if\s+([A-Za-z0-9_@]+)\s*\}\}((?:(?!\{\{#(?:each|if|unless)\b)[\s\S])*?)\{\{\/if\}\}/g;
const UNLESS_BLOCK_RE =
  /\{\{#unless\s+([A-Za-z0-9_@]+)\s*\}\}((?:(?!\{\{#(?:each|if|unless)\b)[\s\S])*?)\{\{\/unless\}\}/g;

function resolveBlocks(src: string, ctx: TemplateContext): string {
  let current = src;
  // Safety cap prevents runaway loops on malformed templates.
  for (let pass = 0; pass < 32; pass++) {
    const before = current;

    current = current.replace(EACH_BLOCK_RE, (_, key: string, body: string) => {
      const list = ctx[key];
      if (!Array.isArray(list) || list.length === 0) return '';
      return list
        .map((item, idx) => {
          const itemCtx: TemplateContext = {
            ...ctx,
            ...(item && typeof item === 'object'
              ? (item as TemplateContext)
              : { this: item }),
            '@last': idx === list.length - 1,
          };
          // The only nesting EACH_BLOCK_RE lets through is `{{#if @X}}` /
          // `{{#unless @X}}` — resolve those here, against THIS item's index,
          // before the flat var-substitute pass (the generic IF/UNLESS passes
          // below never see them: by the time this runs there's nothing left).
          let itemBody = body.replace(
            UNLESS_BLOCK_RE,
            (_m, k: string, b: string) => (isTruthy(itemCtx[k]) ? '' : b),
          );
          itemBody = itemBody.replace(
            IF_BLOCK_RE,
            (_m, k: string, b: string) => (isTruthy(itemCtx[k]) ? b : ''),
          );
          return substituteVars(itemBody, itemCtx);
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
