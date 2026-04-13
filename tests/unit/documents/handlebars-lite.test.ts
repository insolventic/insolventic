import { renderTemplate } from '@/features/document/handlebars-lite';

// ---------------------------------------------------------------------------
// Fast path — simple variable substitution (insolvency templates)
// ---------------------------------------------------------------------------

describe('renderTemplate — fast path (no control flow)', () => {
  it('replaces simple variables', () => {
    const html = '<p>{{NOMBRE}} - {{CEDULA}}</p>';
    const result = renderTemplate(html, { NOMBRE: 'Juan', CEDULA: '123' });
    expect(result).toBe('<p>Juan - 123</p>');
  });

  it('removes unreplaced variables', () => {
    const result = renderTemplate('{{A}} and {{B}}', { A: 'yes' });
    expect(result).toBe('yes and ');
  });

  it('handles null/undefined values as empty string', () => {
    const result = renderTemplate('{{X}}|{{Y}}', { X: null, Y: undefined });
    expect(result).toBe('|');
  });

  it('returns empty-ish string for no-op template', () => {
    expect(renderTemplate('plain text', {})).toBe('plain text');
  });
});

// ---------------------------------------------------------------------------
// {{#if}} / {{#unless}} blocks
// ---------------------------------------------------------------------------

describe('renderTemplate — conditional blocks', () => {
  it('renders {{#if}} block when flag is true', () => {
    const html = '{{#if HAS_FOO}}visible{{/if}}';
    expect(renderTemplate(html, { HAS_FOO: true })).toBe('visible');
  });

  it('hides {{#if}} block when flag is false', () => {
    const html = '{{#if HAS_FOO}}hidden{{/if}}';
    expect(renderTemplate(html, { HAS_FOO: false })).toBe('');
  });

  it('hides {{#if}} block when flag is empty string', () => {
    const html = '{{#if HAS_FOO}}hidden{{/if}}';
    expect(renderTemplate(html, { HAS_FOO: '' })).toBe('');
  });

  it('hides {{#if}} block when flag is empty array', () => {
    const html = '{{#if HAS_FOO}}hidden{{/if}}';
    expect(renderTemplate(html, { HAS_FOO: [] })).toBe('');
  });

  it('renders {{#unless}} block when flag is falsy', () => {
    const html = '{{#unless HAS_FOO}}visible{{/unless}}';
    expect(renderTemplate(html, { HAS_FOO: false })).toBe('visible');
  });

  it('hides {{#unless}} block when flag is truthy', () => {
    const html = '{{#unless HAS_FOO}}hidden{{/unless}}';
    expect(renderTemplate(html, { HAS_FOO: true })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// {{#each}} blocks
// ---------------------------------------------------------------------------

describe('renderTemplate — each blocks', () => {
  it('iterates over array of objects', () => {
    const html = '{{#each ITEMS}}<li>{{NAME}}</li>{{/each}}';
    const ctx = { ITEMS: [{ NAME: 'A' }, { NAME: 'B' }] };
    expect(renderTemplate(html, ctx)).toBe('<li>A</li><li>B</li>');
  });

  it('returns empty string for empty array', () => {
    const html = '{{#each ITEMS}}<li>{{NAME}}</li>{{/each}}';
    expect(renderTemplate(html, { ITEMS: [] })).toBe('');
  });

  it('returns empty string for missing array', () => {
    const html = '{{#each ITEMS}}<li>{{NAME}}</li>{{/each}}';
    expect(renderTemplate(html, {})).toBe('');
  });

  it('merges parent context into each item', () => {
    const html = '{{#each ITEMS}}{{PARENT_VAR}}-{{CHILD_VAR}} {{/each}}';
    const ctx = {
      PARENT_VAR: 'P',
      ITEMS: [{ CHILD_VAR: 'C1' }, { CHILD_VAR: 'C2' }],
    };
    expect(renderTemplate(html, ctx)).toBe('P-C1 P-C2 ');
  });
});

// ---------------------------------------------------------------------------
// HTML comment wrappers
// ---------------------------------------------------------------------------

describe('renderTemplate — HTML comment normalization', () => {
  it('strips HTML comment wrappers around control tokens', () => {
    const html = '<!-- {{#if HAS_X}} --><p>content</p><!-- {{/if HAS_X}} -->';
    expect(renderTemplate(html, { HAS_X: true })).toBe('<p>content</p>');
  });

  it('normalizes closing tags with identifiers', () => {
    const html = '{{#if A}}yes{{/if A}}';
    expect(renderTemplate(html, { A: true })).toBe('yes');
  });
});

// ---------------------------------------------------------------------------
// Nested blocks
// ---------------------------------------------------------------------------

describe('renderTemplate — nested blocks', () => {
  it('resolves nested if-inside-if', () => {
    const html = '{{#if A}}outer{{#if B}}inner{{/if}}{{/if}}';
    expect(renderTemplate(html, { A: true, B: true })).toBe('outerinner');
    expect(renderTemplate(html, { A: true, B: false })).toBe('outer');
    expect(renderTemplate(html, { A: false, B: true })).toBe('');
  });

  it('resolves each inside if', () => {
    const html = '{{#if SHOW}}{{#each ITEMS}}{{N}} {{/each}}{{/if}}';
    const ctx = { SHOW: true, ITEMS: [{ N: '1' }, { N: '2' }] };
    expect(renderTemplate(html, ctx)).toBe('1 2 ');
  });
});

// ---------------------------------------------------------------------------
// Real-world conciliation template pattern
// ---------------------------------------------------------------------------

describe('renderTemplate — conciliation patterns', () => {
  it('handles MENORES_ALIMENTOS each block', () => {
    const html =
      '<!-- {{#if HAS_MENORES}} -->' +
      '{{#each MENORES_ALIMENTOS}}<p>{{NOMBRE_MENOR}}</p>{{/each}}' +
      '<!-- {{/if HAS_MENORES}} -->';
    const ctx = {
      HAS_MENORES: true,
      MENORES_ALIMENTOS: [{ NOMBRE_MENOR: 'Ana' }, { NOMBRE_MENOR: 'Pedro' }],
    };
    expect(renderTemplate(html, ctx)).toBe('<p>Ana</p><p>Pedro</p>');
  });

  it('hides conditional section when flag is false', () => {
    const html =
      'before<!-- {{#if HAS_APODERADO_CONVOCANTE}} -->HIDDEN<!-- {{/if HAS_APODERADO_CONVOCANTE}} -->after';
    expect(renderTemplate(html, { HAS_APODERADO_CONVOCANTE: false })).toBe(
      'beforeafter',
    );
  });
});
