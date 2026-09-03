/**
 * @file CategoriesConfig.tsx
 * @description Unterseite zur Verwaltung von hierarchischen Kategorien
 * inkl. Drag-and-Drop zur Anpassung der Reihenfolge und Eltern-Kind-Hierarchie.
 * @module pages/configuration/CategoriesConfig
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { Category } from '@/types/finance';
import { normalizeBudgetToGranularity } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/components/IconRenderer';
import { CategoryModal } from '@/components/modals/CategoryModal';
import { FolderPlus, ChevronRight, ChevronDown, GripVertical, CornerDownRight } from 'lucide-react';

/**
 * Rekursive Ermittlung aller Nachkommen (IDs) einer Kategorie zur Verhinderung von Zyklen.
 */
function getDescendantCategoryIds(categoryId: string, allCategories: Category[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allCategories.filter((c) => c.parentId === currentId);
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

export const CategoriesConfig: React.FC = () => {
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } =
    useFinance();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);

  // Drag & Drop State
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const [isOverRootDropzone, setIsOverRootDropzone] = useState(false);

  const toggleCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Sortierte Kategorien & Baumstruktur aufbauen
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    categories.forEach((c) => {
      const list = map.get(c.parentId) || [];
      list.push(c);
      map.set(c.parentId, list);
    });

    // Jede Liste nach 'order' sortieren
    map.forEach((list) => {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return map;
  }, [categories]);

  // Nachkommen der aktuell gezogenen Kategorie (zur Zyklusvermeidung)
  const invalidDropTargets = useMemo(() => {
    if (!draggedCategoryId) return new Set<string>();
    const invalid = getDescendantCategoryIds(draggedCategoryId, categories);
    invalid.add(draggedCategoryId);
    return invalid;
  }, [draggedCategoryId, categories]);

  /* ================== DRAG & DROP HANDLERS ================== */
  const handleCategoryDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategoryId(categoryId);
    e.dataTransfer.setData('text/plain', categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e: React.DragEvent, targetCategory: Category) => {
    if (!draggedCategoryId || invalidDropTargets.has(targetCategory.id)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;

    let pos: 'before' | 'inside' | 'after' = 'inside';
    if (relativeY < 0.28) {
      pos = 'before';
    } else if (relativeY > 0.72) {
      pos = 'after';
    } else {
      pos = 'inside';
    }

    setDropTargetCategoryId(targetCategory.id);
    setDropPosition(pos);
  };

  const handleCategoryDragLeave = (e: React.DragEvent, targetCategoryId: string) => {
    if (dropTargetCategoryId === targetCategoryId) {
      const related = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(related)) {
        setDropTargetCategoryId(null);
        setDropPosition(null);
      }
    }
  };

  const handleCategoryDrop = async (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedCategoryId || invalidDropTargets.has(targetCategory.id) || !dropPosition) {
      handleCategoryDragEnd();
      return;
    }

    const dragged = categories.find((c) => c.id === draggedCategoryId);
    if (!dragged) {
      handleCategoryDragEnd();
      return;
    }

    let updatedCategories: Category[] = [];

    if (dropPosition === 'inside') {
      // Kategorie wird Kind der Ziel-Kategorie
      const siblings = (childrenMap.get(targetCategory.id) || []).filter(
        (c) => c.id !== dragged.id
      );
      const newOrder = siblings.length;

      updatedCategories = categories.map((c) => {
        if (c.id === dragged.id) {
          return {
            ...c,
            parentId: targetCategory.id,
            order: newOrder,
          };
        }
        return c;
      });
    } else {
      // Kategorie wird Geschwister vor/nach der Ziel-Kategorie
      const parentId = targetCategory.parentId;
      const currentSiblings = (childrenMap.get(parentId) || []).filter((c) => c.id !== dragged.id);
      const targetIndex = currentSiblings.findIndex((c) => c.id === targetCategory.id);

      const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
      const newSiblings = [...currentSiblings];
      newSiblings.splice(insertIndex, 0, { ...dragged, parentId });

      // Neue Sortierreihenfolge zuweisen
      const siblingOrderMap = new Map<string, number>();
      newSiblings.forEach((c, idx) => siblingOrderMap.set(c.id, idx));

      updatedCategories = categories.map((c) => {
        if (siblingOrderMap.has(c.id)) {
          return {
            ...c,
            parentId,
            order: siblingOrderMap.get(c.id)!,
          };
        }
        return c;
      });
    }

    await reorderCategories(updatedCategories);
    handleCategoryDragEnd();
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedCategoryId) {
      handleCategoryDragEnd();
      return;
    }

    const dragged = categories.find((c) => c.id === draggedCategoryId);
    if (!dragged) {
      handleCategoryDragEnd();
      return;
    }

    // Kategorie auf Root-Ebene (parentId: null) ganz ans Ende setzen
    const rootSiblings = (childrenMap.get(null) || []).filter((c) => c.id !== dragged.id);
    const newOrder = rootSiblings.length;

    const updatedCategories = categories.map((c) => {
      if (c.id === dragged.id) {
        return {
          ...c,
          parentId: null,
          order: newOrder,
        };
      }
      return c;
    });

    await reorderCategories(updatedCategories);
    handleCategoryDragEnd();
  };

  const handleCategoryDragEnd = () => {
    setDraggedCategoryId(null);
    setDropTargetCategoryId(null);
    setDropPosition(null);
    setIsOverRootDropzone(false);
  };

  /* ================== RENDER CATEGORY ROW ================== */
  const getSubtreeMonthlyBudget = (categoryId: string): number => {
    const children = childrenMap.get(categoryId) || [];
    if (children.length === 0) {
      const c = categories.find((item) => item.id === categoryId);
      if (!c?.targetBudget) return 0;
      return normalizeBudgetToGranularity(c.targetBudget.amount, c.targetBudget.period, 'monthly');
    }
    return children.reduce((sum, child) => sum + getSubtreeMonthlyBudget(child.id), 0);
  };

  const renderCategoryRow = (category: Category, depth = 0) => {
    const children = childrenMap.get(category.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedCategories.has(category.id);
    const isDraggingThis = draggedCategoryId === category.id;
    const isTarget = dropTargetCategoryId === category.id;
    const isInvalidTarget = draggedCategoryId ? invalidDropTargets.has(category.id) : false;

    // Dynamische Klassen für Drop-Zonen Indikatoren
    let dropHighlightClass = '';
    if (isTarget && !isInvalidTarget) {
      if (dropPosition === 'before') {
        dropHighlightClass = 'border-t-2 border-t-blue-600 bg-blue-50/40';
      } else if (dropPosition === 'after') {
        dropHighlightClass = 'border-b-2 border-b-blue-600 bg-blue-50/40';
      } else if (dropPosition === 'inside') {
        dropHighlightClass = 'bg-blue-100/70 ring-2 ring-blue-500 ring-inset';
      }
    }

    return (
      <React.Fragment key={category.id}>
        <tr
          draggable
          onDragStart={(e) => handleCategoryDragStart(e, category.id)}
          onDragOver={(e) => handleCategoryDragOver(e, category)}
          onDragLeave={(e) => handleCategoryDragLeave(e, category.id)}
          onDrop={(e) => handleCategoryDrop(e, category)}
          onDragEnd={handleCategoryDragEnd}
          onClick={() => {
            setEditingCategory(category);
            setModalParentId(null);
            setIsCategoryModalOpen(true);
          }}
          className={`group cursor-pointer border-b border-slate-100 transition-all hover:bg-blue-50/60 ${
            isDraggingThis ? 'bg-slate-100 opacity-40' : ''
          } ${dropHighlightClass}`}
          title="Klicken zum Bearbeiten &bull; Ziehen zum Umsortieren / Unterordnen"
        >
          {/* Kategorie Name */}
          <td className="w-[280px] shrink-0 px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
              {/* Drag Handle */}
              <div
                className="-ml-1 cursor-grab rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700 active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
                title="Ziehen zum Umsortieren / Unterordnen"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(category.id);
                  }}
                  className="rounded p-1 text-slate-500 hover:bg-slate-200"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-transform group-hover:scale-105"
                style={{ backgroundColor: category.color || '#64748b' }}
              >
                <IconRenderer name={category.icon} className="h-4 w-4" />
              </div>
              <span className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-700">
                {category.name}
              </span>
            </div>
          </td>

          {/* Regex Spalte - Flexible Spalte mit Word-Break */}
          <td className="px-4 py-3 font-mono text-xs text-slate-600">
            {hasChildren ? (
              <span className="text-[11px] italic text-slate-400">
                Roll-Up aus Unter-Kategorien
              </span>
            ) : category.regexPattern ? (
              <span className="inline-block max-w-full whitespace-normal break-all rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-[11px] leading-relaxed text-slate-700 shadow-sm">
                {category.regexPattern}
              </span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>

          {/* Soll-Budget */}
          <td className="w-[180px] shrink-0 whitespace-nowrap px-4 py-3 text-xs text-slate-700">
            {category.targetBudget ? (
              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                {formatMoney(category.targetBudget.amount)} /{' '}
                {category.targetBudget.period === 'monthly'
                  ? 'Monat'
                  : category.targetBudget.period}
              </span>
            ) : hasChildren ? (
              (() => {
                const subtreeMonthly = getSubtreeMonthlyBudget(category.id);
                return subtreeMonthly > 0 ? (
                  <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {formatMoney(subtreeMonthly)} / Monat (Rollup)
                  </span>
                ) : (
                  <span className="text-slate-400">Kein Budget</span>
                );
              })()
            ) : (
              <span className="text-slate-400">Kein Budget</span>
            )}
          </td>

          {/* Aktionen: Neue Unterkategorie anlegen */}
          <td className="w-[140px] shrink-0 whitespace-nowrap px-4 py-3 text-right text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingCategory(null);
                setModalParentId(category.id);
                setIsCategoryModalOpen(true);
              }}
              className="shadow-xs inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              title="Neue Unterkategorie anlegen"
              aria-label="Neue Unterkategorie anlegen"
            >
              <FolderPlus className="h-3.5 w-3.5 text-blue-600" />
              <span>Unterkategorie</span>
            </button>
          </td>
        </tr>

        {!isCollapsed && children.map((child) => renderCategoryRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const rootCategories = childrenMap.get(null) || [];

  return (
    <div className="space-y-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Kategorie-Baumtabelle
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Ziehe Zeilen per Drag & Drop oben/unten zum Sortieren oder in die Mitte, um sie
            unterzuordnen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCategory(null);
            setModalParentId(null);
            setIsCategoryModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <FolderPlus className="h-4 w-4" />
          Neue Kategorie
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <th className="w-[280px] px-4 py-3">Kategorie Name</th>
              <th className="px-4 py-3">Regex-Muster (Leafs)</th>
              <th className="w-[180px] whitespace-nowrap px-4 py-3">Soll-Budget</th>
              <th className="w-[140px] whitespace-nowrap px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rootCategories.length > 0 ? (
              rootCategories.map((root) => renderCategoryRow(root, 0))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  Noch keine Kategorien angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Root Level Dropzone */}
      {draggedCategoryId && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverRootDropzone(true);
          }}
          onDragLeave={() => setIsOverRootDropzone(false)}
          onDrop={handleRootDrop}
          className={`m-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-xs font-semibold transition-all ${
            isOverRootDropzone
              ? 'scale-[1.01] border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-300 bg-slate-50/60 text-slate-500'
          }`}
        >
          <CornerDownRight className="h-4 w-4" />
          Hier ablegen, um Kategorie auf die oberste Ebene (Top-Level) zu verschieben
        </div>
      )}

      {/* Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        category={editingCategory}
        initialParentId={modalParentId}
        existingCategories={categories}
        onDelete={deleteCategory}
        onSave={async (categoryData) => {
          if (editingCategory) {
            await updateCategory(categoryData as Category);
          } else {
            await addCategory(categoryData);
          }
        }}
      />
    </div>
  );
};

// Re-Export für Abwärtskompatibilität
export const BucketsConfig = CategoriesConfig;
