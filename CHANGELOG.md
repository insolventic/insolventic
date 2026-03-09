# Changelog

All notable changes to INSOLVENTIC will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-08

### Added

- **Authentication module**: Login, register, forgot/reset password with JWT sessions, RBAC (6 roles, 30+ permissions), session timeout with auto-logout.
- **Case management**: Full CRUD for insolvency, conciliation, and support agreement cases. Multi-tenant with `tenantId` isolation. Case creation form with validation rules and document requirements.
- **Debtor management**: Debtor profiles with personal/financial data, linked to cases.
- **Creditor management**: Creditor registry with debt tracking per case.
- **Document generation**: 49 HTML templates organized in 5 packages (Solicitud, Admision, Negociacion, Terminacion, Fracaso). Placeholder mapper with 300+ variables. Batch PDF generation via Puppeteer. Google Drive storage with automatic folder hierarchy.
- **Document upload**: Secure file upload with MIME type validation, filename sanitization, and size limits (10MB).
- **Google Drive integration**: OAuth2 authentication, folder hierarchy management, template sync, document sync.
- **Dashboard**: 6 task modules (Cases, Creditors, Debtors, Documents, Notifications, Users) with help tooltips for onboarding.
- **Drive folder separation**: Separate Google Drive folders per conciliation center (Armonia/Construpaz) with cross-center security validation.
- **Security hardening**: Rate limiting, input sanitization, XSS prevention, CSRF protection, secure headers (CSP, HSTS, X-Frame-Options). 90 security tests.
- **Form validation**: Complete insolvency form validation with document requirements. 75 validation tests.
- **Versioning system**: Semantic versioning with centralized config, UI version badge, environment labeling, CHANGELOG, GitHub release workflow.
- **Test suite**: 384+ automated tests across unit, integration, and component testing.
- **Deployment**: Vercel deployment pipeline with CI/CD.
