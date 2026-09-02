/**
 * @file Header.test.tsx
 * @description Unit-Tests für die Header-Komponente inkl. Umgebungs-Badge.
 * @module components/Header.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Header } from './Header';

describe('Header', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders navigation links and brand title without env badge in default mode', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    expect(screen.getByText('FinanceFlow')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.queryByTestId('env-badge')).not.toBeInTheDocument();
  });

  it('renders stage badge when VITE_APP_ENV is set to stage', () => {
    vi.stubEnv('VITE_APP_ENV', 'stage');

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const badge = screen.getByTestId('env-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('stage');
    expect(badge).toHaveClass('bg-amber-100');
  });

  it('renders PR Preview badge when VITE_APP_ENV is set to preview', () => {
    vi.stubEnv('VITE_APP_ENV', 'preview');

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const badge = screen.getByTestId('env-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('PR Preview');
    expect(badge).toHaveClass('bg-purple-100');
  });

  it('does not render badge when VITE_APP_ENV is set to production', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    expect(screen.queryByTestId('env-badge')).not.toBeInTheDocument();
  });
});

