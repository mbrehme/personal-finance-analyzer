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

  describe('search functionality', () => {
    it('filters categories by search query and shows matching nodes', async () => {
      const user = userEvent.setup();
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          selectedCategoryIds={null}
          onChange={vi.fn()}
        />
      );

      await user.click(screen.getByTestId('category-filter-dropdown-btn'));
      const searchInput = screen.getByPlaceholderText('Kategorie suchen...');
      expect(searchInput).toBeInTheDocument();

      await user.type(searchInput, 'Miete');

      // Miete sollte sichtbar sein, Ausgaben (Parent) ebenfalls
      expect(screen.getByText('Miete')).toBeInTheDocument();
      expect(screen.getByText('Ausgaben')).toBeInTheDocument();
      // Unbeteiligte Kategorien wie Gehalt oder Einnahmen sollten nicht sichtbar sein
      expect(screen.queryByText('Gehalt')).not.toBeInTheDocument();
    });

    it('shows "Keine Kategorien gefunden" when search yields no matches', async () => {
      const user = userEvent.setup();
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          selectedCategoryIds={null}
          onChange={vi.fn()}
        />
      );

      await user.click(screen.getByTestId('category-filter-dropdown-btn'));
      const searchInput = screen.getByPlaceholderText('Kategorie suchen...');

      await user.type(searchInput, 'XYZGibtsNicht');
      expect(screen.getByText('Keine Kategorien gefunden')).toBeInTheDocument();

      // Clear search button
      const clearBtn = screen.getByLabelText('Suche zurücksetzen');
      await user.click(clearBtn);
      expect(screen.queryByText('Keine Kategorien gefunden')).not.toBeInTheDocument();
      expect(screen.getByText('Miete')).toBeInTheDocument();
    });
  });

  describe('single-select mode', () => {
    it('renders selected category name and icon on the trigger button', () => {
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          selectedCategoryId="cat-rent"
          onSelectCategory={vi.fn()}
        />
      );

      expect(screen.getByText('Miete')).toBeInTheDocument();
    });

    it('renders uncategorized label when selectedCategoryId is null', () => {
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          selectedCategoryId={null}
          uncategorizedLabel="(Keine Kategorie)"
          onSelectCategory={vi.fn()}
        />
      );

      expect(screen.getByText('(Keine Kategorie)')).toBeInTheDocument();
    });

    it('calls onSelectCategory and closes dropdown when a category is clicked', async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();

      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          selectedCategoryId={null}
          onSelectCategory={handleSelect}
        />
      );

      await user.click(screen.getByTestId('category-picker-btn'));
      expect(screen.getByTestId('category-picker-panel')).toBeInTheDocument();

      // Wähle "Gehalt"
      const salaryBtn = screen.getByTitle('Kategorie "Gehalt" auswählen');
      await user.click(salaryBtn);

      expect(handleSelect).toHaveBeenCalledWith('cat-salary');
      // Dropdown schließt sich nach Auswahl
      expect(screen.queryByTestId('category-picker-panel')).not.toBeInTheDocument();
    });

    it('calls onSelectCategory with null when "(Keine Kategorie)" is clicked', async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();

      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          selectedCategoryId="cat-rent"
          uncategorizedLabel="(Keine Kategorie)"
          onSelectCategory={handleSelect}
        />
      );

      await user.click(screen.getByTestId('category-picker-btn'));

      // Klick auf (Keine Kategorie)
      const noneBtn = screen.getByText('(Keine Kategorie)');
      await user.click(noneBtn);

      expect(handleSelect).toHaveBeenCalledWith(null);
      expect(screen.queryByTestId('category-picker-panel')).not.toBeInTheDocument();
    });

    it('positions panel upwards when placement="top"', async () => {
      const user = userEvent.setup();
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          placement="top"
          selectedCategoryId={null}
          onSelectCategory={vi.fn()}
        />
      );

      await user.click(screen.getByTestId('category-picker-btn'));
      const panel = screen.getByTestId('category-picker-panel');
      expect(panel.className).toContain('bottom-full');
      expect(panel.className).toContain('mb-1.5');
    });

    it('positions panel downwards when placement="bottom"', async () => {
      const user = userEvent.setup();
      render(
        <CategoryFilterDropdown
          categories={mockCategories}
          mode="single"
          placement="bottom"
          selectedCategoryId={null}
          onSelectCategory={vi.fn()}
        />
      );

      await user.click(screen.getByTestId('category-picker-btn'));
      const panel = screen.getByTestId('category-picker-panel');
      expect(panel.className).toContain('top-full');
      expect(panel.className).toContain('mt-1.5');
    });
  });
});
