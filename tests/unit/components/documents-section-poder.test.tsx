/**
 * @jest-environment jsdom
 */

/**
 * Página 7 (Documentos) — el documento "poder" aparece/desaparece según
 * `existePoderOtorgado` de la Sección XI, sin tocar cédula/tarjeta.
 *
 * `DocumentsSection` deriva su lista de obligatorios con
 * `getRequiredDocuments` (src/features/case/validation-rules.ts), que ya
 * tiene cobertura de reglas exhaustiva (tests/unit/cases/apoderado-unico-
 * documentos.test.ts, tests/form-request/document-requirements.test.ts).
 * Este test cubre la otra mitad: que el COMPONENTE de verdad re-renderiza
 * la lista cuando cambia el prop `apoderados` — la `apoderadosKey` del
 * `useMemo` es la pieza nueva que esos tests de reglas no pueden ver.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DocumentsSection } from '@/app/cases/components/create-case-dialog/documents-section';

describe('DocumentsSection — el documento "poder"', () => {
  it('con apoderado SIN poder otorgado: exige cédula y tarjeta, no el poder', () => {
    render(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: false },
        ]}
      />,
    );

    expect(
      screen.getByText(/Cédula de ciudadanía del apoderado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tarjeta profesional del apoderado/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /^Poder \(notariado o prueba de envío desde correo del deudor\)$/i,
      ),
    ).not.toBeInTheDocument();
  });

  it('con apoderado CON poder otorgado: exige los tres, incluido el poder', () => {
    render(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: true },
        ]}
      />,
    );

    expect(
      screen.getByText(/Cédula de ciudadanía del apoderado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tarjeta profesional del apoderado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Poder \(notariado o prueba de envío desde correo del deudor\)/i,
      ),
    ).toBeInTheDocument();
  });

  it('REGRESIÓN: desmarcar "poder otorgado" lo quita de la lista al re-renderizar, sin tocar cédula/tarjeta', () => {
    const { rerender } = render(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: true },
        ]}
      />,
    );

    expect(
      screen.getByText(
        /Poder \(notariado o prueba de envío desde correo del deudor\)/i,
      ),
    ).toBeInTheDocument();

    rerender(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: false },
        ]}
      />,
    );

    expect(
      screen.queryByText(
        /^Poder \(notariado o prueba de envío desde correo del deudor\)$/i,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Cédula de ciudadanía del apoderado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tarjeta profesional del apoderado/i),
    ).toBeInTheDocument();
  });

  it('el aviso indigo distingue "hay apoderado" de "poder ya otorgado"', () => {
    const { rerender } = render(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: false },
        ]}
      />,
    );
    expect(
      screen.getByText(/El poder solo se exige cuando se marca/i),
    ).toBeInTheDocument();

    rerender(
      <DocumentsSection
        hasAttorney
        apoderados={[
          { nombreCompleto: 'Ana Torres', existePoderOtorgado: true },
        ]}
      />,
    );
    expect(
      screen.getByText(/El caso tiene apoderado con poder otorgado/i),
    ).toBeInTheDocument();
  });

  it('sin apoderado: no exige ninguno de los tres documentos del apoderado', () => {
    render(<DocumentsSection />);

    expect(
      screen.queryByText(/Cédula de ciudadanía del apoderado/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Tarjeta profesional del apoderado/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Poder \(notariado o prueba de envío desde correo del deudor\)/i,
      ),
    ).not.toBeInTheDocument();
  });
});
