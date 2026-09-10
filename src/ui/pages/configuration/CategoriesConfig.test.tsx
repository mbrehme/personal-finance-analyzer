/**
 * @file CategoriesConfig.test.tsx
 * @description Unit-Tests für die CategoriesConfig Subpage.
 * @module pages/configuration/CategoriesConfig.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoriesConfig } from './CategoriesConfig';
import { FinanceProvider } from '@/domain';
import * as FinanceContextModule from '@/domain';

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

  it('renders active budget and planned future budgets badge', () => {
    vi.spyOn(FinanceContextModule, 'useFinance').mockReturnValue({
      categories: [
        {
          id: 'cat-plan',
          name: 'Haushalt',
          parentId: null,
          order: 0,
          targetBudgets: [
            { id: 'b1', amount: 200, period: 'monthly' },
            { id: 'b2', amount: 300, period: 'monthly', validFrom: '2099-01-01' },
          ],
        },
      ],
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      reorderCategories: vi.fn(),
    } as any);

    render(<CategoriesConfig />);

    expect(screen.getByText(/200,00.*Monat/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 geplant \(ab 01\.01\.2099\)/i)).toBeInTheDocument();
  });
});
