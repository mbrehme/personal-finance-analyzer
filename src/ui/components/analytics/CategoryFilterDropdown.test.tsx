/**
 * @file CategoryFilterDropdown.test.tsx
 * @description Unit-Tests für die CategoryFilterDropdown Komponente.
 * @module components/analytics/CategoryFilterDropdown.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryFilterDropdown } from './CategoryFilterDropdown';
import { Category } from '@/types/finance';

const mockCategories: Category[] = [
  {
    id: 'parent-exp',
    name: 'Ausgaben',
    parentId: null,
    order: 1,
    color: '#ef4444',
    icon: 'TrendingDown',
  },
  {
    id: 'parent-inc',
    name: 'Einnahmen',
    parentId: null,
    order: 0,
    color: '#10b981',
    icon: 'TrendingUp',
  },
  {
    id: 'cat-salary',
    name: 'Gehalt',
    parentId: 'parent-inc',
    order: 0,
    color: '#10b981',
    icon: 'Wallet',
  },
  {
    id: 'cat-food',
    name: 'Lebensmittel',
    parentId: 'parent-exp',
    order: 1,
    color: '#f59e0b',
    icon: 'Utensils',
  },
  {
    id: 'cat-rent',
    name: 'Miete',
    parentId: 'parent-exp',
    order: 0,
    color: '#6366f1',
    icon: 'Home',
  },
];

describe('CategoryFilterDropdown', () => {
  it('renders button with all categories count when selectedCategoryIds is null', () => {
    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={null}
        onChange={vi.fn()}
      />
    );

    // 5 mock categories + 1 unkategorisiert = 6
    expect(screen.getByText('Alle Kategorien (6)')).toBeInTheDocument();
  });

  it('renders filtered count when specific categories are selected', () => {
    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={['cat-salary']}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Kategorien (1/6)')).toBeInTheDocument();
  });

  it('sorts root categories and children by order exactly as on config page', async () => {
    const user = userEvent.setup();
    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={null}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('category-filter-dropdown-btn'));

    const panel = screen.getByTestId('category-filter-dropdown-panel');
    const textContent = panel.textContent || '';

    // Einnahmen (order: 0) sollte VOR Ausgaben (order: 1) kommen
    const incIndex = textContent.indexOf('Einnahmen');
    const expIndex = textContent.indexOf('Ausgaben');
    expect(incIndex).toBeGreaterThan(-1);
    expect(expIndex).toBeGreaterThan(incIndex);

    // Unter Ausgaben: Miete (order: 0) sollte VOR Lebensmittel (order: 1) kommen
    const rentIndex = textContent.indexOf('Miete');
    const foodIndex = textContent.indexOf('Lebensmittel');
    expect(rentIndex).toBeGreaterThan(-1);
    expect(foodIndex).toBeGreaterThan(rentIndex);
  });

  it('toggles parent category and selects or deselects all children with one click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={null}
        onChange={handleChange}
      />
    );

    await user.click(screen.getByTestId('category-filter-dropdown-btn'));

    // Klick auf "Ausgaben" (Elternkategorie): Deselektiert Ausgaben, Miete und Lebensmittel!
    const ausgabenBtn = screen.getByRole('button', {
      name: /Ausgaben/i,
    });
    await user.click(ausgabenBtn);

    // Ausgaben (parent-exp, cat-rent, cat-food) entfernt -> verbleiben: parent-inc, cat-salary, __uncategorized__
    expect(handleChange).toHaveBeenCalledWith(['parent-inc', 'cat-salary', '__uncategorized__']);
  });

  it('handles Keine and Alle buttons', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={['cat-salary']}
        onChange={handleChange}
      />
    );

    await user.click(screen.getByTestId('category-filter-dropdown-btn'));

    // Alle anklicken
    await user.click(screen.getByText('Alle'));
    expect(handleChange).toHaveBeenCalledWith(null);

    // Keine anklicken
    await user.click(screen.getByText('Keine'));
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('renders Keine Kategorien (0/6) when empty array is passed', () => {
    render(
      <CategoryFilterDropdown
        categories={mockCategories}
        selectedCategoryIds={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Keine Kategorien (0/6)')).toBeInTheDocument();
  });
});
