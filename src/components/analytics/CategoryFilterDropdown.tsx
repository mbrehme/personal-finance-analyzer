/**
 * @file CategoryFilterDropdown.tsx
 * @description Wiederverwendbare Multi-Select-Dropdown-Komponente zur Filterung von
 * Kategorien (inkl. Nicht-kategorisiert) für die Cashflow-Analyse und Matrix-Tabelle.
 * Unterstützt hierarchische Darstellung (sortiert wie auf der Config-Page),
 * Schnellauswahl über Elternkategorien (Tri-State) sowie "Alle" und "Keine".
 * @module components/analytics/CategoryFilterDropdown
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Category } from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { Filter, ChevronDown, ChevronRight, Check, Minus } from 'lucide-react';

export const UNCATEGORIZED_CATEGORY_ID = '__uncategorized__';
export const UNCATEGORIZED_COLOR = '#94a3b8'; // slate-400

export interface CategoryFilterDropdownProps {
  /** Liste aller Kategorien */
  categories: Category[];
  /** Gibt an, ob unkategorisierte Buchungen als Option verfügbar sein sollen (Standard: true) */
  hasUncategorized?: boolean;
  /** Aktuell ausgewählte Kategorie-IDs (null = alle ausgewählt) */
  selectedCategoryIds: string[] | null;
  /** Callback bei Änderung der Auswahl */
  onChange: (selectedIds: string[] | null) => void;
  /** Optionale zusätzliche CSS-Klassen für den Button */
  className?: string;
}

export const CategoryFilterDropdown: React.FC<CategoryFilterDropdownProps> = ({
  categories,
  hasUncategorized = true,
  selectedCategoryIds,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Klick außerhalb schließt das Menü
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Baumstruktur aufbauen – genau wie auf der Config-Page nach 'order' sortiert
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    categories.forEach((c) => {
      const list = map.get(c.parentId) || [];
      list.push(c);
      map.set(c.parentId, list);
    });

    // Jede Liste nach order sortieren
    map.forEach((list) => {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return map;
  }, [categories]);

  // Alle relevanten IDs ermitteln
  const allCategoryIds = useMemo(() => {
    const ids = categories.map((c) => c.id);
    if (hasUncategorized) {
      ids.push(UNCATEGORIZED_CATEGORY_ID);
    }
    return ids;
  }, [categories, hasUncategorized]);

  // Effektiver Set ausgewählter IDs (null = alle ausgewählt)
  const activeSelectedSet = useMemo(() => {
    if (selectedCategoryIds === null) {
      return new Set(allCategoryIds);
    }
    return new Set(selectedCategoryIds);
  }, [selectedCategoryIds, allCategoryIds]);

  const allSelected =
    selectedCategoryIds === null || activeSelectedSet.size === allCategoryIds.length;
  const noneSelected = activeSelectedSet.size === 0;

  // Rekursiv alle Kategorie-IDs eines Teilbaums ermitteln (Kategorie selbst + alle Nachkommen)
  const getSubtreeCategoryIds = useCallback(
    (categoryId: string): string[] => {
      const ids: string[] = [categoryId];
      const children = childrenMap.get(categoryId) || [];
      for (const child of children) {
        ids.push(...getSubtreeCategoryIds(child.id));
      }
      return ids;
    },
    [childrenMap]
  );

  // Elternkategorie ein-/ausklappen
  const toggleCollapsed = (categoryId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Elternkategorie umschalten (wählt alle Kinder mit aus oder ab)
  const toggleParentCategory = (categoryId: string) => {
    const subtreeIds = getSubtreeCategoryIds(categoryId);
    const isAllSelected = subtreeIds.every((id) => activeSelectedSet.has(id));
    const nextSet = new Set(activeSelectedSet);

    if (isAllSelected) {
      subtreeIds.forEach((id) => nextSet.delete(id));
    } else {
      subtreeIds.forEach((id) => nextSet.add(id));
    }

    if (nextSet.size === allCategoryIds.length) {
      onChange(null);
    } else {
      onChange(Array.from(nextSet));
    }
  };

  // Einzelne Blatt-Kategorie umschalten
  const toggleLeafCategory = (categoryId: string) => {
    const nextSet = new Set(activeSelectedSet);
    if (nextSet.has(categoryId)) {
      nextSet.delete(categoryId);
      // Wenn der Parent jetzt nicht mehr vollständig ist, parentId abwählen
      const parentId = categories.find((c) => c.id === categoryId)?.parentId;
      if (parentId) {
        nextSet.delete(parentId);
      }
    } else {
      nextSet.add(categoryId);
      // Wenn alle Geschwister ausgewählt sind, auch den Parent auswählen
      const cat = categories.find((c) => c.id === categoryId);
      if (cat?.parentId) {
        const siblings = childrenMap.get(cat.parentId) || [];
        const allSiblingsSelected = siblings.every((s) => s.id === categoryId || nextSet.has(s.id));
        if (allSiblingsSelected) {
          nextSet.add(cat.parentId);
        }
      }
    }

    if (nextSet.size === allCategoryIds.length) {
      onChange(null);
    } else {
      onChange(Array.from(nextSet));
    }
  };

  // Nicht kategorisiert umschalten
  const toggleUncategorized = () => {
    const nextSet = new Set(activeSelectedSet);
    if (nextSet.has(UNCATEGORIZED_CATEGORY_ID)) {
      nextSet.delete(UNCATEGORIZED_CATEGORY_ID);
    } else {
      nextSet.add(UNCATEGORIZED_CATEGORY_ID);
    }

    if (nextSet.size === allCategoryIds.length) {
      onChange(null);
    } else {
      onChange(Array.from(nextSet));
    }
  };

  const handleSelectAll = () => {
    onChange(null);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  // Rekursives Rendern eines Baumknotens
  const renderCategoryItem = (category: Category, depth = 0): React.ReactNode => {
    const children = childrenMap.get(category.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedIds.has(category.id);

    if (hasChildren) {
      const subtreeIds = getSubtreeCategoryIds(category.id);
      const childCount = children.length;
      const selectedChildCount = children.filter((child) => activeSelectedSet.has(child.id)).length;
      const isAllSelected = subtreeIds.every((id) => activeSelectedSet.has(id));
      const isSomeSelected = !isAllSelected && subtreeIds.some((id) => activeSelectedSet.has(id));

      return (
        <div key={category.id} className="space-y-0.5">
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {/* Auf-/Zuklappen */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed(category.id);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title={isCollapsed ? 'Unterkategorien aufklappen' : 'Unterkategorien einklappen'}
              aria-label={isCollapsed ? 'Aufklappen' : 'Einklappen'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Parent-Checkbox + Name: Klick schaltet alle Kinder um */}
            <button
              type="button"
              onClick={() => toggleParentCategory(category.id)}
              className="flex flex-1 items-center gap-2 text-left"
              title={`Alle ${category.name}-Kategorien umschalten`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  isAllSelected || isSomeSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isAllSelected && <Check className="h-3 w-3 stroke-[3]" />}
                {isSomeSelected && <Minus className="h-3 w-3 stroke-[3]" />}
              </div>

              <div
                className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: category.color || '#3b82f6' }}
              >
                <IconRenderer name={category.icon} className="h-3 w-3" />
              </div>

              <span className="truncate text-xs font-semibold text-slate-800">{category.name}</span>

              <span className="ml-auto font-mono text-[10px] text-slate-400">
                ({selectedChildCount}/{childCount})
              </span>
            </button>
          </div>

          {/* Kinder-Liste */}
          {!isCollapsed && (
            <div className="space-y-0.5">
              {children.map((child) => renderCategoryItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Einzelne Blatt-Kategorie
    const isChecked = activeSelectedSet.has(category.id);
    return (
      <div
        key={category.id}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 16 + (depth > 0 ? 24 : 8)}px` }}
      >
        <button
          type="button"
          onClick={() => toggleLeafCategory(category.id)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <div
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
            }`}
          >
            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
          </div>

          <div
            className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: category.color || '#3b82f6' }}
          >
            <IconRenderer name={category.icon} className="h-3 w-3" />
          </div>

          <span className="truncate text-xs text-slate-700">{category.name}</span>
        </button>
      </div>
    );
  };

  const rootCategories = childrenMap.get(null) || [];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`shadow-xs flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
          !allSelected
            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100/70'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        title="Kategorien filtern"
        data-testid="category-filter-dropdown-btn"
      >
        <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="truncate">
          {allSelected
            ? `Alle Kategorien (${allCategoryIds.length})`
            : noneSelected
              ? `Keine Kategorien (0/${allCategoryIds.length})`
              : `Kategorien (${activeSelectedSet.size}/${allCategoryIds.length})`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className="w-84 absolute left-0 top-full z-40 mt-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5"
          data-testid="category-filter-dropdown-panel"
        >
          {/* Header mit "Alle" und "Keine" */}
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] font-semibold text-slate-500">
            <span>Kategorien auswählen</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 hover:underline"
              >
                Alle
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-slate-500 hover:underline"
              >
                Keine
              </button>
            </div>
          </div>

          {/* Baumansicht der Kategorien */}
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {rootCategories.map((rootCategory) => renderCategoryItem(rootCategory, 0))}

            {/* Unkategorisiert */}
            {hasUncategorized && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={toggleUncategorized}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        activeSelectedSet.has(UNCATEGORIZED_CATEGORY_ID)
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {activeSelectedSet.has(UNCATEGORIZED_CATEGORY_ID) && (
                        <Check className="h-3 w-3 stroke-[3]" />
                      )}
                    </div>

                    <div
                      className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: UNCATEGORIZED_COLOR }}
                    >
                      <IconRenderer name="HelpCircle" className="h-3 w-3" />
                    </div>

                    <span className="truncate text-xs font-medium text-slate-700">
                      Nicht kategorisiert
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
