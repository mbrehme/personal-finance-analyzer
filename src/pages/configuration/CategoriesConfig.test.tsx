/**
 * @file CategoriesConfig.test.tsx
 * @description Unit-Tests für die CategoriesConfig Subpage.
 * @module pages/configuration/CategoriesConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoriesConfig } from './CategoriesConfig';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('CategoriesConfig Subpage', () => {
  it('renders category tree table and drag handles', async () => {
    render(
      <FinanceProvider>
        <CategoriesConfig />
      </FinanceProvider>
    );

    const title = await screen.findByText('Kategorie-Baumtabelle');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Neue Kategorie')).toBeInTheDocument();

    const dragHandles = await screen.findAllByTitle('Ziehen zum Umsortieren / Unterordnen');
    expect(dragHandles.length).toBeGreaterThan(0);
  });
});
