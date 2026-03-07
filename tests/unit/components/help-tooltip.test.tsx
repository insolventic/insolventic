/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

import { HelpTooltip } from '@/components/ui/help-tooltip';

// Mock ResizeObserver for Radix UI
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe('HelpTooltip', () => {
  it('renders the help icon button', () => {
    render(<HelpTooltip text="Texto de ayuda" />);
    const button = screen.getByRole('button', { name: /ayuda/i });
    expect(button).toBeInTheDocument();
  });

  it('applies the correct aria-label', () => {
    render(
      <HelpTooltip text="Info del módulo" ariaLabel="Ayuda: Gestión de Casos" />,
    );
    const button = screen.getByRole('button', {
      name: 'Ayuda: Gestión de Casos',
    });
    expect(button).toBeInTheDocument();
  });

  it('uses default aria-label when not provided', () => {
    render(<HelpTooltip text="Info" />);
    const button = screen.getByRole('button', { name: 'Ayuda' });
    expect(button).toBeInTheDocument();
  });

  it('does not navigate when clicked (stopPropagation)', () => {
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <HelpTooltip text="No debe navegar" />
      </div>,
    );
    const button = screen.getByRole('button', { name: /ayuda/i });
    fireEvent.click(button);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('renders with custom className', () => {
    render(<HelpTooltip text="Test" className="custom-class" />);
    const button = screen.getByRole('button', { name: /ayuda/i });
    expect(button).toHaveClass('custom-class');
  });

  it('renders the CircleHelp icon (svg element)', () => {
    render(<HelpTooltip text="Test" />);
    const button = screen.getByRole('button', { name: /ayuda/i });
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
