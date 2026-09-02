/**
 * @file App.test.tsx
 * @description Unit-Tests für App.
 * @module App.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders application navigation and home view without errors', async () => {
    render(<App />);

    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Konfiguration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Buchungen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cashflow/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Salden/i })).toBeInTheDocument();
  });
});
