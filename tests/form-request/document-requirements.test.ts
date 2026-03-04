/**
 * Tests: Document Requirements Validation
 * Validates that required documents are enforced and optional ones are not.
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
      const cedula = REQUIRED_DOCUMENTS.find(d => d.id === 'cedula');
      expect(cedula).toBeDefined();
      expect(cedula!.always).toBe(true);
    });

    it('should include REDAM as always required', () => {
      const redam = REQUIRED_DOCUMENTS.find(d => d.id === 'redam');
      expect(redam).toBeDefined();
      expect(redam!.always).toBe(true);
    });

    it('should include Certificado de ingresos as always required', () => {
      const cert = REQUIRED_DOCUMENTS.find(d => d.id === 'cert_ingresos');
      expect(cert).toBeDefined();
      expect(cert!.always).toBe(true);
    });

    it('should include Certificado de tradición y libertad as always required', () => {
      const tradicion = REQUIRED_DOCUMENTS.find(d => d.id === 'tradicion_libertad');
      expect(tradicion).toBeDefined();
      expect(tradicion!.always).toBe(true);
    });

    it('should include Poder as always required', () => {
      const poder = REQUIRED_DOCUMENTS.find(d => d.id === 'poder');
      expect(poder).toBeDefined();
      expect(poder!.always).toBe(true);
    });

    it('should have exactly 5 always-required documents', () => {
      expect(REQUIRED_DOCUMENTS).toHaveLength(5);
    });
  });

  describe('CONDITIONAL_DOCUMENTS', () => {
    it('should require matrícula mercantil for small merchants', () => {
      const matricula = CONDITIONAL_DOCUMENTS.find(d => d.id === 'matricula');
      expect(matricula).toBeDefined();
      expect(matricula!.condition).toBe('isSmallMerchant');
    });
  });

  describe('OPTIONAL_DOCUMENTS', () => {
    it('should include extractos bancarios', () => {
      expect(OPTIONAL_DOCUMENTS.find(d => d.id === 'extractos')).toBeDefined();
    });

    it('should include gastos de manutención', () => {
      expect(OPTIONAL_DOCUMENTS.find(d => d.id === 'gastos_manutencion')).toBeDefined();
    });

    it('should include mandamientos de pago', () => {
      expect(OPTIONAL_DOCUMENTS.find(d => d.id === 'mandamientos_pago')).toBeDefined();
    });

    it('should include certificados de deuda', () => {
      expect(OPTIONAL_DOCUMENTS.find(d => d.id === 'certificados_deuda')).toBeDefined();
    });

    it('should include copias de títulos valores', () => {
      expect(OPTIONAL_DOCUMENTS.find(d => d.id === 'copias_titulos')).toBeDefined();
    });

    it('should have all optional documents marked as multiple', () => {
      OPTIONAL_DOCUMENTS.forEach(doc => {
        expect(doc.multiple).toBe(true);
      });
    });
  });

  describe('getRequiredDocuments', () => {
    it('should return 5 base required docs for non-merchant', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(required).toHaveLength(5);
      expect(required).toContain('cedula');
      expect(required).toContain('redam');
      expect(required).toContain('cert_ingresos');
      expect(required).toContain('tradicion_libertad');
      expect(required).toContain('poder');
    });

    it('should add matrícula mercantil for small merchant', () => {
      const required = getRequiredDocuments({
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(required).toHaveLength(6);
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
      expect(required).toHaveLength(5);
    });
  });

  describe('validateDocumentsComplete', () => {
    it('should fail when no documents are uploaded', () => {
      const result = validateDocumentsComplete([], {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments).toHaveLength(5);
    });

    it('should fail when only some required documents are uploaded', () => {
      const result = validateDocumentsComplete(['cedula', 'redam'], {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments.length).toBeGreaterThan(0);
      expect(result.missingDocuments.map(d => d.id)).toContain('cert_ingresos');
    });

    it('should pass when all required documents are uploaded (non-merchant)', () => {
      const allRequired = ['cedula', 'redam', 'cert_ingresos', 'tradicion_libertad', 'poder'];
      const result = validateDocumentsComplete(allRequired, {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
      expect(result.missingDocuments).toHaveLength(0);
    });

    it('should fail for merchant without matrícula', () => {
      const allBase = ['cedula', 'redam', 'cert_ingresos', 'tradicion_libertad', 'poder'];
      const result = validateDocumentsComplete(allBase, {
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(result.isValid).toBe(false);
      expect(result.missingDocuments.map(d => d.id)).toContain('matricula');
    });

    it('should pass for merchant with all docs including matrícula', () => {
      const allDocs = ['cedula', 'redam', 'cert_ingresos', 'tradicion_libertad', 'poder', 'matricula'];
      const result = validateDocumentsComplete(allDocs, {
        applicantScope: ['PERSONA_NATURAL_PEQUENA_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should not require optional documents', () => {
      const allRequired = ['cedula', 'redam', 'cert_ingresos', 'tradicion_libertad', 'poder'];
      // No extractos, no gastos, etc. — should still be valid
      const result = validateDocumentsComplete(allRequired, {
        applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should return correct names for missing documents', () => {
      const result = validateDocumentsComplete([], {});
      const names = result.missingDocuments.map(d => d.name);
      expect(names).toContain('Cédula de ciudadanía');
      expect(names).toContain('Certificado REDAM');
    });
  });
});
