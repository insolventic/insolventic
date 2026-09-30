/**
 * Tests: Document Requirements Validation
 * Validates that required documents are enforced and optional ones are not.
 *
 * NOTE: Document requirements were refactored so that Certificado de tradición
 * y libertad and Poder are CONDITIONAL (not always required). This file tests
 * the current ("always = 3") rule set.
 */

import {
  REQUIRED_DOCUMENTS,
  CONDITIONAL_DOCUMENTS,
  OPTIONAL_DOCUMENTS,
  getRequiredDocuments,
  validateDocumentsComplete,
} from '@/features/case/validation-rules';

describe('Document Requirements — validation-rules.ts', () => {
  describe('REQUIRED_DOCUMENTS', () => {
    it('should include Cédula as always required', () => {
      const cedula = REQUIRED_DOCUMENTS.find((d) => d.id === 'cedula');
      expect(cedula).toBeDefined();
      expect(cedula!.always).toBe(true);
    });

    it('should include REDAM as always required', () => {
      const redam = REQUIRED_DOCUMENTS.find((d) => d.id === 'redam');
      expect(redam).toBeDefined();
      expect(redam!.always).toBe(true);
    });

    it('should include Certificado de ingresos as always required', () => {
      const cert = REQUIRED_DOCUMENTS.find((d) => d.id === 'cert_ingresos');
      expect(cert).toBeDefined();
      expect(cert!.always).toBe(true);
    });

    it('should expose Certificado de tradición y libertad as CONDITIONAL (hasRealEstate)', () => {
      const tradicion = CONDITIONAL_DOCUMENTS.find(
        (d) => d.id === 'tradicion_libertad',
      );
      expect(tradicion).toBeDefined();
      expect(tradicion!.condition).toBe('hasRealEstate');
    });

    it('should expose Poder as CONDITIONAL (hasAttorney)', () => {
      const poder = CONDITIONAL_DOCUMENTS.find((d) => d.id === 'poder');
      expect(poder).toBeDefined();
      expect(poder!.condition).toBe('hasAttorney');
    });

    it('should expose the apoderado ID and bar-card as CONDITIONAL (hasAttorney)', () => {
      for (const id of ['cedula_apoderado', 'tarjeta_profesional_apoderado']) {
        const doc = CONDITIONAL_DOCUMENTS.find((d) => d.id === id);
        expect(doc).toBeDefined();
        expect(doc!.condition).toBe('hasAttorney');
      }
    });

    it('should have exactly 3 always-required documents', () => {
      expect(REQUIRED_DOCUMENTS).toHaveLength(3);
    });
  });

  describe('CONDITIONAL_DOCUMENTS', () => {
    it('should require matrícula mercantil for small merchants', () => {
      const matricula = CONDITIONAL_DOCUMENTS.find((d) => d.id === 'matricula');
      expect(matricula).toBeDefined();
      expect(matricula!.condition).toBe('isSmallMerchant');
    });
  });

  describe('OPTIONAL_DOCUMENTS', () => {
    it('should include extractos bancarios', () => {
      expect(
        OPTIONAL_DOCUMENTS.find((d) => d.id === 'extractos'),
      ).toBeDefined();
    });

    it('should include gastos de manutención', () => {
      expect(
        OPTIONAL_DOCUMENTS.find((d) => d.id === 'gastos_manutencion'),
      ).toBeDefined();
    });

    it('should include mandamientos de pago', () => {
      expect(
        OPTIONAL_DOCUMENTS.find((d) => d.id === 'mandamientos_pago'),
      ).toBeDefined();
    });

    it('should include certificados de deuda', () => {
      expect(
        OPTIONAL_DOCUMENTS.find((d) => d.id === 'certificados_deuda'),
      ).toBeDefined();
    });

    it('should include copias de títulos valores', () => {
      expect(
        OPTIONAL_DOCUMENTS.find((d) => d.id === 'copias_titulos'),
      ).toBeDefined();
    });

    it('should have all optional documents marked as multiple', () => {
      OPTIONAL_DOCUMENTS.forEach((doc) => {
        expect(doc.multiple).toBe(true);
      });
    });
  });

  describe('getRequiredDocuments', () => {
    it('should return 3 base required docs for non-merchant', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(required).toHaveLength(3);
      expect(required).toContain('cedula');
      expect(required).toContain('redam');
      expect(required).toContain('cert_ingresos');
    });

    it('should add matrícula mercantil for small merchant', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(required).toHaveLength(4);
      expect(required).toContain('matricula');
    });

    it('should NOT require matrícula for non-merchant', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(required).not.toContain('matricula');
    });

    it('should return base docs when no applicantScope provided', () => {
      const required = getRequiredDocuments({});
      expect(required).toHaveLength(3);
    });
  });

  /**
   * Los 3 documentos del apoderado y el bug que los hacía inexigibles.
   *
   * `getRequiredDocuments` leía `caseData.hasAttorney`, que NO es un campo de
   * `CreateCaseFormInput`. `handleSubmit` le pasa el form data crudo, así que
   * daba siempre `undefined` y el poder no se exigía nunca: la pantalla lo
   * pintaba en rojo (el diálogo le inyecta un `hasAttorney` derivado a
   * `DocumentsSection`) pero el envío pasaba igual.
   *
   * Por eso estos casos van sobre las claves que el formulario manda de verdad.
   */
  describe('getRequiredDocuments — apoderado', () => {
    const APODERADO_DOCS = [
      'poder',
      'cedula_apoderado',
      'tarjeta_profesional_apoderado',
    ];

    it('derives the attorney from apoderados[] (what the wizard actually sends)', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
        apoderados: [{ nombreCompleto: 'Ana Torres' }],
      } as Parameters<typeof getRequiredDocuments>[0]);

      for (const id of APODERADO_DOCS) expect(required).toContain(id);
      expect(required).toHaveLength(6);
    });

    it('derives the attorney from the legacy apoderadoNombreCompleto field', () => {
      const required = getRequiredDocuments({
        apoderadoNombreCompleto: 'Ana Torres',
      } as Parameters<typeof getRequiredDocuments>[0]);

      for (const id of APODERADO_DOCS) expect(required).toContain(id);
    });

    it('derives the attorney from the free-text attorney field of page 1', () => {
      const required = getRequiredDocuments({
        attorney: 'Dr. Juan Pérez',
      } as Parameters<typeof getRequiredDocuments>[0]);

      for (const id of APODERADO_DOCS) expect(required).toContain(id);
    });

    it('still honours an explicit hasAttorney flag (how the UI asks)', () => {
      const required = getRequiredDocuments({
        hasAttorney: true,
      } as Parameters<typeof getRequiredDocuments>[0]);

      for (const id of APODERADO_DOCS) expect(required).toContain(id);
    });

    it('ignores empty or whitespace-only attorney names', () => {
      const required = getRequiredDocuments({
        attorney: '   ',
        apoderadoNombreCompleto: '',
        apoderados: [{ nombreCompleto: '  ' }],
      } as Parameters<typeof getRequiredDocuments>[0]);

      for (const id of APODERADO_DOCS) expect(required).not.toContain(id);
      expect(required).toHaveLength(3);
    });

    it('requires none of the three when the case has no attorney', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });

      for (const id of APODERADO_DOCS) expect(required).not.toContain(id);
    });

    it('validateDocumentsComplete names the three as missing', () => {
      const result = validateDocumentsComplete(
        ['cedula', 'redam', 'cert_ingresos'],
        {
          apoderados: [{ nombreCompleto: 'Ana Torres' }],
        } as Parameters<typeof validateDocumentsComplete>[1],
      );

      expect(result.isValid).toBe(false);
      expect(result.missingDocuments.map((d) => d.id).sort()).toEqual(
        [...APODERADO_DOCS].sort(),
      );
      // Los nombres se resuelven contra CONDITIONAL_DOCUMENTS, no caen al id.
      for (const doc of result.missingDocuments) {
        expect(doc.name).not.toBe(doc.id);
      }
    });

    it('passes once the three apoderado documents are uploaded', () => {
      const result = validateDocumentsComplete(
        ['cedula', 'redam', 'cert_ingresos', ...APODERADO_DOCS],
        {
          apoderados: [{ nombreCompleto: 'Ana Torres' }],
        } as Parameters<typeof validateDocumentsComplete>[1],
      );

      expect(result.isValid).toBe(true);
      expect(result.missingDocuments).toHaveLength(0);
    });
  });

  describe('validateDocumentsComplete', () => {
    it('should fail when no documents are uploaded', () => {
      const result = validateDocumentsComplete([], {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments).toHaveLength(3);
    });

    it('should fail when only some required documents are uploaded', () => {
      const result = validateDocumentsComplete(['cedula', 'redam'], {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments.length).toBeGreaterThan(0);
      expect(result.missingDocuments.map((d) => d.id)).toContain(
        'cert_ingresos',
      );
    });

    it('should pass when all required documents are uploaded (non-merchant)', () => {
      const allRequired = ['cedula', 'redam', 'cert_ingresos'];
      const result = validateDocumentsComplete(allRequired, {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
      expect(result.missingDocuments).toHaveLength(0);
    });

    it('should fail for merchant without matrícula', () => {
      const allBase = ['cedula', 'redam', 'cert_ingresos'];
      const result = validateDocumentsComplete(allBase, {
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments.map((d) => d.id)).toContain('matricula');
    });

    it('should pass for merchant with all docs including matrícula', () => {
      const allDocs = ['cedula', 'redam', 'cert_ingresos', 'matricula'];
      const result = validateDocumentsComplete(allDocs, {
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should not require optional documents', () => {
      const allRequired = ['cedula', 'redam', 'cert_ingresos'];
      const result = validateDocumentsComplete(allRequired, {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should return correct names for missing documents', () => {
      const result = validateDocumentsComplete([], {});
      const names = result.missingDocuments.map((d) => d.name);
      expect(names).toContain('Cédula de ciudadanía');
      expect(names).toContain('Certificado REDAM');
    });
  });
});
