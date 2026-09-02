/**
 * @file Configuration.test.tsx
 * @description Unit-Tests für die Configuration Page.
 * @module pages/Configuration.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Configuration } from './Configuration';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('Configuration Page', () => {
  it('renders configuration tabs and bucket table', async () => {
    render(
      <FinanceProvider>
        <Configuration />
      </FinanceProvider>
    );

    expect(await screen.findByText('Konfiguration')).toBeInTheDocument();
    expect(screen.getByText(/Buckets & Kategorien/i)).toBeInTheDocument();
    expect(screen.getByText(/Konten & Salden/i)).toBeInTheDocument();
  });
});
