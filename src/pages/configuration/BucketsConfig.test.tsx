/**
 * @file BucketsConfig.test.tsx
 * @description Unit-Tests für die BucketsConfig Subpage.
 * @module pages/configuration/BucketsConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BucketsConfig } from './BucketsConfig';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('BucketsConfig Subpage', () => {
  it('renders bucket tree table and drag handles', async () => {
    render(
      <FinanceProvider>
        <BucketsConfig />
      </FinanceProvider>
    );

    const title = await screen.findByText('Bucket-Baumtabelle');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Neuer Bucket')).toBeInTheDocument();

    const dragHandles = await screen.findAllByTitle('Ziehen zum Umsortieren / Unterordnen');
    expect(dragHandles.length).toBeGreaterThan(0);
  });
});

