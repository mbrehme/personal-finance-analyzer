/**
 * @file BucketsConfig.test.tsx
 * @description Unit-Tests für den BucketsConfig Alias.
 * @module pages/configuration/BucketsConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BucketsConfig } from './BucketsConfig';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('BucketsConfig Alias', () => {
  it('renders category tree table via alias', async () => {
    render(
      <FinanceProvider>
        <BucketsConfig />
      </FinanceProvider>
    );

    const title = await screen.findByText('Kategorie-Baumtabelle');
    expect(title).toBeInTheDocument();
  });
});
