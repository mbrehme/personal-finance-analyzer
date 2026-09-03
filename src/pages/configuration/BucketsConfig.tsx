/**
 * @file BucketsConfig.tsx
 * @description Unterseite zur Verwaltung von hierarchischen Buckets
 * inkl. Drag-and-Drop zur Anpassung der Reihenfolge und Eltern-Kind-Hierarchie.
 * @module pages/configuration/BucketsConfig
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { Bucket } from '@/types/finance';
import { normalizeBudgetToGranularity } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/components/IconRenderer';
import { BucketModal } from '@/components/modals/BucketModal';
import { FolderPlus, ChevronRight, ChevronDown, GripVertical, CornerDownRight } from 'lucide-react';

/**
 * Rekursive Ermittlung aller Nachkommen (IDs) eines Buckets zur Verhinderung von Zyklen.
 */
function getDescendantBucketIds(bucketId: string, allBuckets: Bucket[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [bucketId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allBuckets.filter((b) => b.parentId === currentId);
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

export const BucketsConfig: React.FC = () => {
  const { buckets, addBucket, updateBucket, deleteBucket, reorderBuckets } = useFinance();

  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  // Modal State
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);

  // Drag & Drop State
  const [draggedBucketId, setDraggedBucketId] = useState<string | null>(null);
  const [dropTargetBucketId, setDropTargetBucketId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const [isOverRootDropzone, setIsOverRootDropzone] = useState(false);

  const toggleCollapse = (bucketId: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  };

  // Sortierte Buckets & Baumstruktur aufbauen
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Bucket[]>();
    buckets.forEach((b) => {
      const list = map.get(b.parentId) || [];
      list.push(b);
      map.set(b.parentId, list);
    });

    // Jede Liste nach 'order' sortieren
    map.forEach((list) => {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return map;
  }, [buckets]);

  // Nachkommen des aktuell gezogenen Buckets (zur Zyklusvermeidung)
  const invalidDropTargets = useMemo(() => {
    if (!draggedBucketId) return new Set<string>();
    const invalid = getDescendantBucketIds(draggedBucketId, buckets);
    invalid.add(draggedBucketId);
    return invalid;
  }, [draggedBucketId, buckets]);

  /* ================== DRAG & DROP HANDLERS ================== */
  const handleBucketDragStart = (e: React.DragEvent, bucketId: string) => {
    setDraggedBucketId(bucketId);
    e.dataTransfer.setData('text/plain', bucketId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBucketDragOver = (e: React.DragEvent, targetBucket: Bucket) => {
    if (!draggedBucketId || invalidDropTargets.has(targetBucket.id)) {
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

    setDropTargetBucketId(targetBucket.id);
    setDropPosition(pos);
  };

  const handleBucketDragLeave = (e: React.DragEvent, targetBucketId: string) => {
    if (dropTargetBucketId === targetBucketId) {
      const related = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(related)) {
        setDropTargetBucketId(null);
        setDropPosition(null);
      }
    }
  };

  const handleBucketDrop = async (e: React.DragEvent, targetBucket: Bucket) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedBucketId || invalidDropTargets.has(targetBucket.id) || !dropPosition) {
      handleBucketDragEnd();
      return;
    }

    const dragged = buckets.find((b) => b.id === draggedBucketId);
    if (!dragged) {
      handleBucketDragEnd();
      return;
    }

    let updatedBuckets: Bucket[] = [];

    if (dropPosition === 'inside') {
      // Bucket wird Kind des Ziel-Buckets
      const siblings = (childrenMap.get(targetBucket.id) || []).filter((b) => b.id !== dragged.id);
      const newOrder = siblings.length;

      updatedBuckets = buckets.map((b) => {
        if (b.id === dragged.id) {
          return {
            ...b,
            parentId: targetBucket.id,
            order: newOrder,
          };
        }
        return b;
      });
    } else {
      // Bucket wird Geschwister vor/nach dem Ziel-Bucket
      const parentId = targetBucket.parentId;
      const currentSiblings = (childrenMap.get(parentId) || []).filter((b) => b.id !== dragged.id);
      const targetIndex = currentSiblings.findIndex((b) => b.id === targetBucket.id);

      const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
      const newSiblings = [...currentSiblings];
      newSiblings.splice(insertIndex, 0, { ...dragged, parentId });

      // Neue Sortierreihenfolge zuweisen
      const siblingOrderMap = new Map<string, number>();
      newSiblings.forEach((b, idx) => siblingOrderMap.set(b.id, idx));

      updatedBuckets = buckets.map((b) => {
        if (siblingOrderMap.has(b.id)) {
          return {
            ...b,
            parentId,
            order: siblingOrderMap.get(b.id)!,
          };
        }
        return b;
      });
    }

    await reorderBuckets(updatedBuckets);
    handleBucketDragEnd();
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedBucketId) {
      handleBucketDragEnd();
      return;
    }

    const dragged = buckets.find((b) => b.id === draggedBucketId);
    if (!dragged) {
      handleBucketDragEnd();
      return;
    }

    // Bucket auf Root-Ebene (parentId: null) ganz ans Ende setzen
    const rootSiblings = (childrenMap.get(null) || []).filter((b) => b.id !== dragged.id);
    const newOrder = rootSiblings.length;

    const updatedBuckets = buckets.map((b) => {
      if (b.id === dragged.id) {
        return {
          ...b,
          parentId: null,
          order: newOrder,
        };
      }
      return b;
    });

    await reorderBuckets(updatedBuckets);
    handleBucketDragEnd();
  };

  const handleBucketDragEnd = () => {
    setDraggedBucketId(null);
    setDropTargetBucketId(null);
    setDropPosition(null);
    setIsOverRootDropzone(false);
  };

  /* ================== RENDER BUCKET ROW ================== */
  const getSubtreeMonthlyBudget = (bucketId: string): number => {
    const children = childrenMap.get(bucketId) || [];
    if (children.length === 0) {
      const b = buckets.find((item) => item.id === bucketId);
      if (!b?.targetBudget) return 0;
      return normalizeBudgetToGranularity(b.targetBudget.amount, b.targetBudget.period, 'monthly');
    }
    return children.reduce((sum, child) => sum + getSubtreeMonthlyBudget(child.id), 0);
  };

  const renderBucketRow = (bucket: Bucket, depth = 0) => {
    const children = childrenMap.get(bucket.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedBuckets.has(bucket.id);
    const isDraggingThis = draggedBucketId === bucket.id;
    const isTarget = dropTargetBucketId === bucket.id;
    const isInvalidTarget = draggedBucketId ? invalidDropTargets.has(bucket.id) : false;

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
      <React.Fragment key={bucket.id}>
        <tr
          draggable
          onDragStart={(e) => handleBucketDragStart(e, bucket.id)}
          onDragOver={(e) => handleBucketDragOver(e, bucket)}
          onDragLeave={(e) => handleBucketDragLeave(e, bucket.id)}
          onDrop={(e) => handleBucketDrop(e, bucket)}
          onDragEnd={handleBucketDragEnd}
          onClick={() => {
            setEditingBucket(bucket);
            setIsBucketModalOpen(true);
          }}
          className={`group cursor-pointer border-b border-slate-100 transition-all hover:bg-blue-50/60 ${
            isDraggingThis ? 'bg-slate-100 opacity-40' : ''
          } ${dropHighlightClass}`}
          title="Klicken zum Bearbeiten &bull; Ziehen zum Umsortieren / Unterordnen"
        >
          {/* Bucket Name */}
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
                    toggleCollapse(bucket.id);
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
                style={{ backgroundColor: bucket.color || '#64748b' }}
              >
                <IconRenderer name={bucket.icon} className="h-4 w-4" />
              </div>
              <span className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-700">
                {bucket.name}
              </span>
            </div>
          </td>

          {/* Regex Spalte - Flexible Spalte mit Word-Break */}
          <td className="px-4 py-3 font-mono text-xs text-slate-600">
            {bucket.regexPattern ? (
              <span className="inline-block max-w-full whitespace-normal break-all rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-[11px] leading-relaxed text-slate-700 shadow-sm">
                {bucket.regexPattern}
              </span>
            ) : hasChildren ? (
              <span className="text-[11px] italic text-slate-400">Roll-Up aus Unter-Buckets</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>

          {/* Soll-Budget */}
          <td className="w-[180px] shrink-0 whitespace-nowrap px-4 py-3 text-xs text-slate-700">
            {bucket.targetBudget ? (
              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                {formatMoney(bucket.targetBudget.amount)} /{' '}
                {bucket.targetBudget.period === 'monthly' ? 'Monat' : bucket.targetBudget.period}
              </span>
            ) : hasChildren ? (
              (() => {
                const subtreeMonthly = getSubtreeMonthlyBudget(bucket.id);
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

          {/* Manuelle Overrides */}
          <td className="w-[160px] shrink-0 whitespace-nowrap px-4 py-3 text-xs text-slate-600">
            {bucket.manualTransactionIds && bucket.manualTransactionIds.length > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">
                {bucket.manualTransactionIds.length} Buchung(en)
              </span>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </td>
        </tr>

        {!isCollapsed && children.map((child) => renderBucketRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const rootBuckets = childrenMap.get(null) || [];

  return (
    <div className="space-y-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Bucket-Baumtabelle
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Ziehe Zeilen per Drag & Drop oben/unten zum Sortieren oder in die Mitte, um sie
            unterzuordnen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingBucket(null);
            setIsBucketModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <FolderPlus className="h-4 w-4" />
          Neuer Bucket
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <th className="w-[280px] px-4 py-3">Bucket Name</th>
              <th className="px-4 py-3">Regex-Muster (Leafs)</th>
              <th className="w-[180px] whitespace-nowrap px-4 py-3">Soll-Budget</th>
              <th className="w-[160px] whitespace-nowrap px-4 py-3">Manuelle Overrides</th>
            </tr>
          </thead>
          <tbody>
            {rootBuckets.length > 0 ? (
              rootBuckets.map((root) => renderBucketRow(root, 0))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  Noch keine Buckets angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Root Level Dropzone */}
      {draggedBucketId && (
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
          Hier ablegen, um Bucket auf die oberste Ebene (Top-Level) zu verschieben
        </div>
      )}

      {/* Modal */}
      <BucketModal
        isOpen={isBucketModalOpen}
        onClose={() => setIsBucketModalOpen(false)}
        bucket={editingBucket}
        existingBuckets={buckets}
        onDelete={deleteBucket}
        onSave={async (bucketData) => {
          if (editingBucket) {
            await updateBucket(bucketData as Bucket);
          } else {
            await addBucket(bucketData);
          }
        }}
      />
    </div>
  );
};
