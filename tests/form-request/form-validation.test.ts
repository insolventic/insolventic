/**
 * Tests: Form Validation Rules
 * Validates form-level validation: required fields, format checks, coherence.
 */

import {
  validateCaseComplete,
  validateIncomeExpenses,
  validatePaymentProposal,
  validateSpouseData,
  validateLegalProcesses,
} from '@/features/case/validation-rules';

describe('Form Validation — validation-rules.ts', () => {
  describe('validateCaseComplete — required fields', () => {
    it('should fail when debtorId is missing', () => {
      const result = validateCaseComplete({});
      const debtorError = result.issues.find(i => i.field === 'debtorId');
      expect(debtorError).toBeDefined();
      expect(result.isValid).toBe(false);
    });

    it('should fail when causes are empty', () => {
      const result = validateCaseComplete({ causes: [] });
      const causeError = result.issues.find(i => i.field === 'causes');
      expect(causeError).toBeDefined();
    });

    it('should fail when applicantScope is empty', () => {
      const result = validateCaseComplete({ applicantScope: [] });
      const scopeError = result.issues.find(i => i.field === 'applicantScope');
      expect(scopeError).toBeDefined();
    });

    it('should fail when no debts are provided', () => {
      const result = validateCaseComplete({ debts: [] });
      const debtError = result.issues.find(i => i.field === 'debts');
      expect(debtError).toBeDefined();
    });

    it('should fail when notificationEmail is missing', () => {
      const result = validateCaseComplete({});
      const emailError = result.issues.find(i => i.field === 'notificationEmail');
      expect(emailError).toBeDefined();
    });

    it('should fail when notificationAddress is missing', () => {
      const result = validateCaseComplete({});
      const addrError = result.issues.find(i => i.field === 'notificationAddress');
      expect(addrError).toBeDefined();
    });

    it('should fail when notificationPhone is missing', () => {
      const result = validateCaseComplete({});
      const phoneError = result.issues.find(i => i.field === 'notificationPhone');
      expect(phoneError).toBeDefined();
    });
  });

  describe('validateCaseComplete — document validation integration', () => {
    const minValidData = {
      debtorId: 'debtor-1',
      causes: ['Sobreendeudamiento'],
      applicantScope: ['PERSONA_NATURAL_NO_COMERCIANTE'],
      debts: [{ creditor: 'Bank', type: 'LOAN', interestRate: '10', capitalAmount: '1000000', interestAmount: '100000' }],
      notificationEmail: 'test@test.com',
      notificationAddress: 'Calle 1',
      notificationPhone: '3001234567',
    };

    it('should include document errors when uploadedDocKeys is empty', () => {
      const result = validateCaseComplete(minValidData, []);
      const docErrors = result.issues.filter(i => i.field.startsWith('document_'));
      expect(docErrors.length).toBeGreaterThan(0);
    });

    it('should pass when all required documents are provided', () => {
      const allDocs = ['cedula', 'redam', 'cert_ingresos', 'tradicion_libertad', 'poder'];
      const result = validateCaseComplete(minValidData, allDocs);
      const docErrors = result.issues.filter(i => i.field.startsWith('document_'));
      expect(docErrors).toHaveLength(0);
    });
  });

  describe('validateIncomeExpenses', () => {
    it('should warn when expenses exceed income', () => {
      const issues = validateIncomeExpenses(1000000, 2000000);
      expect(issues.some(i => i.type === 'warning' && i.field === 'monthlyExpenses')).toBe(true);
    });

    it('should warn when income > 0 but expenses = 0', () => {
      const issues = validateIncomeExpenses(3000000, 0);
      expect(issues.some(i => i.type === 'warning')).toBe(true);
    });

    it('should return no issues when income > expenses', () => {
      const issues = validateIncomeExpenses(3000000, 2000000);
      expect(issues).toHaveLength(0);
    });
  });

  describe('validatePaymentProposal', () => {
    it('should error when grace period requested but no months specified', () => {
      const issues = validatePaymentProposal({ gracePeriodRequested: true });
      expect(issues.some(i => i.field === 'gracePeriodMonths' && i.type === 'error')).toBe(true);
    });

    it('should error when grace period exceeds 24 months', () => {
      const issues = validatePaymentProposal({ gracePeriodRequested: true, gracePeriodMonths: 36 });
      expect(issues.some(i => i.field === 'gracePeriodMonths')).toBe(true);
    });

    it('should error when payment term exceeds 120 months', () => {
      const issues = validatePaymentProposal({ paymentTermMonths: 150 });
      expect(issues.some(i => i.field === 'paymentTermMonths')).toBe(true);
    });

    it('should error when capital reduction > 100%', () => {
      const issues = validatePaymentProposal({ capitalReduction: true, capitalReductionPercent: 150 });
      expect(issues.some(i => i.field === 'capitalReductionPercent')).toBe(true);
    });

    it('should return no errors for valid proposal', () => {
      const issues = validatePaymentProposal({
        gracePeriodRequested: true,
        gracePeriodMonths: 12,
        paymentTermMonths: 60,
      });
      expect(issues.filter(i => i.type === 'error')).toHaveLength(0);
    });
  });

  describe('validateSpouseData', () => {
    it('should error when married but no spouse name', () => {
      const issues = validateSpouseData('CASADO', {});
      expect(issues.some(i => i.field === 'spouseName')).toBe(true);
    });

    it('should error when married but no spouse ID', () => {
      const issues = validateSpouseData('CASADO', { spouseName: 'Test' });
      expect(issues.some(i => i.field === 'spouseIdNumber')).toBe(true);
    });

    it('should not error for single person', () => {
      const issues = validateSpouseData('SOLTERO', {});
      expect(issues).toHaveLength(0);
    });

    it('should require spouse data for unión libre', () => {
      const issues = validateSpouseData('UNION_LIBRE', {});
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('validateLegalProcesses', () => {
    it('should error when hasLegalProcesses is true but no processes added', () => {
      const issues = validateLegalProcesses(true, 0);
      expect(issues.some(i => i.field === 'legalProcesses' && i.type === 'error')).toBe(true);
    });

    it('should warn when hasLegalProcesses is false but processes exist', () => {
      const issues = validateLegalProcesses(false, 2);
      expect(issues.some(i => i.type === 'warning')).toBe(true);
    });

    it('should return no issues when consistent (true + count > 0)', () => {
      const issues = validateLegalProcesses(true, 3);
      expect(issues).toHaveLength(0);
    });
  });
});
