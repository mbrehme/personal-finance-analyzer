/**
 * @file CategoryFilterDropdown.tsx
 * @description Wiederverwendbare Dropdown-Komponente zur Auswahl und Filterung von
 * Kategorien (inkl. Nicht-kategorisiert). Unterstützt hierarchische Baumdarstellung,
 * ein integriertes Suchfeld, Multi-Select-Modus (für Filter mit Tri-State Checkboxen)
 * und Single-Select-Modus (für direkte Zuweisungen z. B. in Tabellenzeilen).
 * @module components/analytics/CategoryFilterDropdown
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Category } from '@/types/finance';
import { IconRenderer } from '@/ui/components/IconRenderer';
import { Filter, ChevronDown, ChevronRight, Check, Minus, Search, X, Tag } from 'lucide-react';

export const UNCATEGORIZED_CATEGORY_ID = '__uncategorized__';
export const UNCATEGORIZED_COLOR = '#94a3b8'; // slate-400

export interface CategoryFilterDropdownProps {
  /** Liste aller Kategorien */
  categories: Category[];
  /** Gibt an, ob unkategorisierte Buchungen / Keine Kategorie als Option verfügbar sein soll (Standard: true) */
  hasUncategorized?: boolean;
  /** Beschriftung für den unkategorisierten Eintrag (Standard: im Multi-Modus "Nicht kategorisiert", im Single-Modus "(Keine Kategorie)") */
  uncategorizedLabel?: string;
  /** Auswahlmodus: 'multi' für Filter/Mehrfachauswahl (Standard), 'single' für Zuweisung einer einzelnen Kategorie */
  mode?: 'multi' | 'single';
  /** Aktuell ausgewählte Kategorie-IDs (im Multi-Modus; null = alle ausgewählt) */
  selectedCategoryIds?: string[] | null;
  /** Callback bei Änderung der Auswahl im Multi-Modus */
  onChange?: (selectedIds: string[] | null) => void;
  /** Aktuell ausgewählte Kategorie-ID (im Single-Modus; null = keine Kategorie) */
  selectedCategoryId?: string | null;
  /** Callback bei Auswahl einer Kategorie im Single-Modus */
  onSelectCategory?: (categoryId: string | null) => void;
  /** Optionale zusätzliche CSS-Klassen für den Button/Container */
  className?: string;
  /** Platzhaltertext für den Button */
  placeholder?: string;
  /** Kompaktes Styling für Tabellenzellen */
  compact?: boolean;
  /** Ausrichtung des Popover-Panels ('left' oder 'right', Standard: 'left') */
  align?: 'left' | 'right';
  /** Platzierungsrichtung des Dropdowns ('bottom', 'top' oder 'auto', Standard: 'auto') */
  placement?: 'bottom' | 'top' | 'auto';
  /** Deaktiviert das Dropdown */
  disabled?: boolean;
  /** Test-ID für automatisierte Tests */
  dataTestId?: string;
}

export const CategoryFilterDropdown: React.FC<CategoryFilterDropdownProps> = ({
  categories,
  hasUncategorized = true,
  uncategorizedLabel,
  mode = 'multi',
  selectedCategoryIds,
  onChange,
  selectedCategoryId,
  onSelectCategory,
  className = '',
  placeholder,
  compact = false,
  align = 'left',
  placement = 'auto',
  disabled = false,
  dataTestId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [effectivePlacement, setEffectivePlacement] = useState<'bottom' | 'top'>(
    placement === 'top' ? 'top' : 'bottom'
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const btnTestId =
    dataTestId ?? (mode === 'single' ? 'category-picker-btn' : 'category-filter-dropdown-btn');
  const panelTestId = dataTestId
    ? `${dataTestId}-panel`
    : mode === 'single'
      ? 'category-picker-panel'
      : 'category-filter-dropdown-panel';

  const effectiveUncategorizedLabel =
    uncategorizedLabel ?? (mode === 'single' ? '(Keine Kategorie)' : 'Nicht kategorisiert');

  // Klick außerhalb schließt das Menü und leert den Suchfilter
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bei Öffnen Suchfeld fokussieren
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Platzierungsrichtung bestimmen (top / bottom)
  useEffect(() => {
    if (!isOpen) return;

    if (placement === 'top') {
      setEffectivePlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setEffectivePlacement('bottom');
      return;
    }

    // Auto-Modus: Prüfen, ob nach unten genug Platz ist (~320px Panel-Höhe)
    if (dropdownRef.current && typeof window !== 'undefined') {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 320 && spaceAbove > spaceBelow) {
        setEffectivePlacement('top');
      } else {
        setEffectivePlacement('bottom');
      }
    }
  }, [isOpen, placement]);

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

  // Map von Kategorie-ID zu Kategorie für schnelle Lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
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

  // Effektiver Set ausgewählter IDs im Multi-Modus (null = alle ausgewählt)
  const activeSelectedSet = useMemo(() => {
    if (mode === 'single') {
      return new Set(
        selectedCategoryId
          ? [selectedCategoryId]
          : hasUncategorized
            ? [UNCATEGORIZED_CATEGORY_ID]
            : []
      );
    }
    if (selectedCategoryIds === null || selectedCategoryIds === undefined) {
      return new Set(allCategoryIds);
    }
    return new Set(selectedCategoryIds);
  }, [mode, selectedCategoryId, selectedCategoryIds, allCategoryIds, hasUncategorized]);

  const allSelected =
    selectedCategoryIds === null ||
    selectedCategoryIds === undefined ||
    activeSelectedSet.size === allCategoryIds.length;
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

  // Suche / Filterung: Relevante IDs basierend auf Suchbegriff berechnen
  const { matchingCategoryIds, isSearching } = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return { matchingCategoryIds: new Set<string>(), isSearching: false };
    }

    const matched = new Set<string>();

    categories.forEach((c) => {
      if (c.name.toLowerCase().includes(term)) {
        matched.add(c.id);

        // Elternkategorien ebenfalls sichtbar machen
        let currentParentId = c.parentId;
        while (currentParentId) {
          matched.add(currentParentId);
          const parent = categoryMap.get(currentParentId);
          currentParentId = parent?.parentId ?? null;
        }

        // Auch alle Kinder einer passenden Kategorie mit aufnehmen
        const subtree = getSubtreeCategoryIds(c.id);
        subtree.forEach((id) => matched.add(id));
      }
    });

    return { matchingCategoryIds: matched, isSearching: true };
  }, [searchQuery, categories, categoryMap, getSubtreeCategoryIds]);

  // Prüfen, ob die unkategorisiert-Option der Suche entspricht
  const uncategorizedMatchesSearch = useMemo(() => {
    if (!isSearching) return true;
    const term = searchQuery.trim().toLowerCase();
    return (
      effectiveUncategorizedLabel.toLowerCase().includes(term) ||
      'unkategorisiert'.includes(term) ||
      'ohne'.includes(term)
    );
  }, [isSearching, searchQuery, effectiveUncategorizedLabel]);

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

  // Elternkategorie umschalten (Multi-Modus)
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
      onChange?.(null);
    } else {
      onChange?.(Array.from(nextSet));
    }
  };

  // Einzelne Blatt-Kategorie umschalten (Multi-Modus)
  const toggleLeafCategory = (categoryId: string) => {
    const nextSet = new Set(activeSelectedSet);
    if (nextSet.has(categoryId)) {
      nextSet.delete(categoryId);
      const parentId = categories.find((c) => c.id === categoryId)?.parentId;
      if (parentId) {
        nextSet.delete(parentId);
      }
    } else {
      nextSet.add(categoryId);
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
      onChange?.(null);
    } else {
      onChange?.(Array.from(nextSet));
    }
  };

  // Nicht kategorisiert umschalten (Multi-Modus)
  const toggleUncategorized = () => {
    const nextSet = new Set(activeSelectedSet);
    if (nextSet.has(UNCATEGORIZED_CATEGORY_ID)) {
      nextSet.delete(UNCATEGORIZED_CATEGORY_ID);
    } else {
      nextSet.add(UNCATEGORIZED_CATEGORY_ID);
    }

    if (nextSet.size === allCategoryIds.length) {
      onChange?.(null);
    } else {
      onChange?.(Array.from(nextSet));
    }
  };

  // Einzelauswahl durchführen und Menü schließen (Single-Modus)
  const handleSelectSingle = (catId: string | null) => {
    if (onSelectCategory) {
      onSelectCategory(catId);
    } else if (onChange) {
      onChange(catId ? [catId] : []);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectAll = () => {
    onChange?.(null);
  };

  const handleDeselectAll = () => {
    onChange?.([]);
  };

  // Ausgewählte Kategorie im Single-Modus ermitteln
  const currentSelectedCategory = useMemo(() => {
    if (mode !== 'single' || !selectedCategoryId) return null;
    return categoryMap.get(selectedCategoryId) ?? null;
  }, [mode, selectedCategoryId, categoryMap]);

  // Rekursives Rendern eines Baumknotens
  const renderCategoryItem = (category: Category, depth = 0): React.ReactNode => {
    // Falls Suchmodus aktiv ist und dieser Knoten nicht relevant ist: ausblenden
    if (isSearching && !matchingCategoryIds.has(category.id)) {
      return null;
    }

    const children = childrenMap.get(category.id) || [];
    const hasChildren = children.length > 0;
    // Während der Suche immer aufklappen, damit Treffer sofort sichtbar sind
    const isCollapsed = !isSearching && collapsedIds.has(category.id);

    // SINGLE-MODUS RENDERING
    if (mode === 'single') {
      const isSelected = selectedCategoryId === category.id;

      return (
        <div key={category.id} className="space-y-0.5">
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
              isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {/* Auf-/Zuklappen falls Unterkategorien existieren */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapsed(category.id);
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                title={isCollapsed ? 'Unterkategorien aufklappen' : 'Unterkategorien einklappen'}
                aria-label={isCollapsed ? 'Aufklappen' : 'Einklappen'}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            {/* Auswahl-Button */}
            <button
              type="button"
              onClick={() => handleSelectSingle(category.id)}
              className="flex flex-1 items-center gap-2 truncate text-left"
              title={`Kategorie "${category.name}" auswählen`}
            >
              <div
                className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: category.color || '#3b82f6' }}
              >
                <IconRenderer name={category.icon} className="h-3 w-3" />
              </div>

              <span
                className={`truncate text-xs ${
                  isSelected
                    ? 'font-semibold text-blue-700'
                    : hasChildren
                      ? 'font-medium text-slate-800'
                      : 'text-slate-700'
                }`}
              >
                {category.name}
              </span>

              {isSelected && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 stroke-[2.5] text-blue-600" />
              )}
            </button>
          </div>

          {/* Kinder-Liste */}
          {hasChildren && !isCollapsed && (
            <div className="space-y-0.5">
              {children.map((child) => renderCategoryItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // MULTI-MODUS RENDERING (bestehendes Verhalten)
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

    // Einzelne Blatt-Kategorie im Multi-Modus
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

  const hasAnyVisibleMatch =
    !isSearching ||
    matchingCategoryIds.size > 0 ||
    (hasUncategorized && uncategorizedMatchesSearch);

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={dropdownRef}>
      {/* TRIGGER BUTTON: SINGLE-MODUS */}
      {mode === 'single' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`shadow-xs flex w-full items-center justify-between gap-1.5 border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
            compact
              ? 'h-8 rounded-lg border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50'
              : 'h-9 rounded-xl border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50'
          }`}
          title={
            currentSelectedCategory ? currentSelectedCategory.name : effectiveUncategorizedLabel
          }
          data-testid={btnTestId}
        >
          <div className="flex min-w-0 items-center gap-1.5 truncate">
            {currentSelectedCategory ? (
              <>
                <div
                  className="shadow-xs flex h-4 w-4 shrink-0 items-center justify-center rounded text-white"
                  style={{ backgroundColor: currentSelectedCategory.color || '#3b82f6' }}
                >
                  <IconRenderer name={currentSelectedCategory.icon} className="h-2.5 w-2.5" />
                </div>
                <span className="truncate font-medium text-slate-700">
                  {currentSelectedCategory.name}
                </span>
              </>
            ) : (
              <>
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-500">
                  <Tag className="h-2.5 w-2.5" />
                </div>
                <span className="truncate italic text-slate-500">
                  {placeholder || effectiveUncategorizedLabel}
                </span>
              </>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      ) : (
        /* TRIGGER BUTTON: MULTI-MODUS */
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`shadow-xs flex w-full items-center justify-between gap-1.5 border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? 'h-8 rounded-lg px-2 py-1' : 'h-9 rounded-xl px-3'
          } ${
            !allSelected
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100/70'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          title="Kategorien filtern"
          data-testid={btnTestId}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">
              {allSelected
                ? `Alle Kategorien (${allCategoryIds.length})`
                : noneSelected
                  ? `Keine Kategorien (0/${allCategoryIds.length})`
                  : `Kategorien (${activeSelectedSet.size}/${allCategoryIds.length})`}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      )}

      {/* DROPDOWN POPOVER PANEL */}
      {isOpen && (
        <div
          className={`absolute z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 sm:w-80 ${
            effectivePlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
          data-testid={panelTestId}
        >
          {/* MULTI-MODUS HEADER MIT "ALLE" / "KEINE" */}
          {mode === 'multi' && (
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
          )}

          {/* INTEGRIERTES SUCHFELD */}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kategorie suchen..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                aria-label="Suche zurücksetzen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* BAUMANSICHT DER KATEGORIEN */}
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {!hasAnyVisibleMatch ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Keine Kategorien gefunden
              </div>
            ) : (
              <>
                {/* SINGLE-MODUS: OPTION FÜR "(KEINE KATEGORIE)" GANZ OBEN ODER UNTEN */}
                {mode === 'single' && hasUncategorized && uncategorizedMatchesSearch && (
                  <div
                    className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
                      selectedCategoryId === null
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSingle(null)}
                      className="flex flex-1 items-center gap-2 truncate text-left"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-500">
                        <Tag className="h-3 w-3" />
                      </div>
                      <span
                        className={`truncate text-xs ${
                          selectedCategoryId === null
                            ? 'font-semibold text-blue-700'
                            : 'italic text-slate-600'
                        }`}
                      >
                        {effectiveUncategorizedLabel}
                      </span>
                      {selectedCategoryId === null && (
                        <Check className="ml-auto h-3.5 w-3.5 shrink-0 stroke-[2.5] text-blue-600" />
                      )}
                    </button>
                  </div>
                )}

                {/* Kategorien-Baum */}
                {rootCategories.map((rootCategory) => renderCategoryItem(rootCategory, 0))}

                {/* MULTI-MODUS: UNKATEGORISIERT AM ENDE */}
                {mode === 'multi' && hasUncategorized && uncategorizedMatchesSearch && (
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
                          {effectiveUncategorizedLabel}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
