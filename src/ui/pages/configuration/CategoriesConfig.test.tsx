/**
 * @file CategoriesConfig.test.tsx
 * @description Unit-Tests für die CategoriesConfig Subpage.
 * @module pages/configuration/CategoriesConfig.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoriesConfig } from './CategoriesConfig';
import { FinanceProvider } from '@/domain';

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

  it('renders action column with subcategory button instead of manual overrides', async () => {
    const user = userEvent.setup();
    render(
      <FinanceProvider>
        <CategoriesConfig />
      </FinanceProvider>
    );

    expect(await screen.findByText('Kategorie-Baumtabelle')).toBeInTheDocument();
    expect(screen.getByText('Aktionen')).toBeInTheDocument();
    expect(screen.queryByText('Manuelle Overrides')).not.toBeInTheDocument();

    const subcategoryBtns = screen.getAllByRole('button', {
      name: /Neue Unterkategorie anlegen/i,
    });
    expect(subcategoryBtns.length).toBeGreaterThan(0);

    await user.click(subcategoryBtns[0]);
    expect(screen.getByText('Neue Kategorie anlegen')).toBeInTheDocument();
  });
});
