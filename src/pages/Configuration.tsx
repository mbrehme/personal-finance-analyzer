/**
 * @file Configuration.tsx
 * @description Konfigurationsansicht zur Verwaltung von hierarchischen Buckets
 * (Regex, Budgets, Icons), Konten mit Stichtags-Salden und JSON Import/Export.
 * Unterstützt Drag-and-Drop zur Anpassung der Reihenfolge und der Eltern-Kind-Hierarchie.
 * @module pages/Configuration
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { Bucket, Account } from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { BucketModal } from '@/components/modals/BucketModal';
import { AccountModal } from '@/components/modals/AccountModal';
import {
  FolderPlus,
  Plus,
  Download,
  Upload,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  Landmark,
  ShieldCheck,
  RotateCcw,
  GripVertical,
  CornerDownRight,
} from 'lucide-react';

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

export const Configuration: React.FC = () => {
  const {
    buckets,
    accounts,
    addBucket,
    updateBucket,
    deleteBucket,
    reorderBuckets,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    exportConfiguration,
    importConfiguration,
    resetWorkspace,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'buckets' | 'accounts'>('buckets');
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  // Modal State
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Bucket Drag & Drop State
  const [draggedBucketId, setDraggedBucketId] = useState<string | null>(null);
  const [dropTargetBucketId, setDropTargetBucketId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const [isOverRootDropzone, setIsOverRootDropzone] = useState(false);

  // Account Drag & Drop State
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null);

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

  // Export JSON
  const handleExport = async () => {
    const jsonStr = await exportConfiguration();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-configuration-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importConfiguration(text);
        alert('Konfiguration erfolgreich importiert!');
      } catch {
        alert('Fehler beim Importieren der JSON-Datei.');
      }
    };
    reader.readAsText(file);
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

  /* ================== BUCKET DRAG & DROP HANDLERS ================== */
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
      // Nur zurücksetzen, wenn wirklich aus dem Element herausgefahren
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
      const siblings = (childrenMap.get(targetBucket.id) || []).filter(
        (b) => b.id !== dragged.id
      );
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
      const currentSiblings = (childrenMap.get(parentId) || []).filter(
        (b) => b.id !== dragged.id
      );
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

  /* ================== ACCOUNT DRAG & DROP HANDLERS ================== */
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [accounts]);

  const handleAccountDragStart = (e: React.DragEvent, accountId: string) => {
    setDraggedAccountId(accountId);
    e.dataTransfer.setData('text/plain', accountId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAccountDragOver = (e: React.DragEvent, targetAccountId: string) => {
    if (!draggedAccountId || draggedAccountId === targetAccountId) return;
    e.preventDefault();
    setDropTargetAccountId(targetAccountId);
  };

  const handleAccountDrop = async (e: React.DragEvent, targetAccount: Account) => {
    e.preventDefault();
    if (!draggedAccountId || draggedAccountId === targetAccount.id) {
      handleAccountDragEnd();
      return;
    }

    const draggedIndex = sortedAccounts.findIndex((a) => a.id === draggedAccountId);
    const targetIndex = sortedAccounts.findIndex((a) => a.id === targetAccount.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleAccountDragEnd();
      return;
    }

    const reordered = [...sortedAccounts];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((acc, index) => ({
      ...acc,
      order: index,
    }));

    await reorderAccounts(updated);
    handleAccountDragEnd();
  };

  const handleAccountDragEnd = () => {
    setDraggedAccountId(null);
    setDropTargetAccountId(null);
  };

  /* ================== RENDER BUCKET ROW ================== */
  const renderBucketRow = (bucket: Bucket, depth: number): React.ReactNode => {
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
          className={`hover:bg-blue-50/60 cursor-pointer transition-all border-b border-slate-100 group ${
            isDraggingThis ? 'opacity-40 bg-slate-100' : ''
          } ${dropHighlightClass}`}
          title="Klicken zum Bearbeiten &bull; Ziehen zum Umsortieren / Unterordnen"
        >
          <td className="py-3 px-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
              {/* Drag Handle */}
              <div
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-0.5 -ml-1 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Ziehen zum Umsortieren / Unterordnen"
              >
                <GripVertical className="w-4 h-4" />
              </div>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(bucket.id);
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform"
                style={{ backgroundColor: bucket.color || '#64748b' }}
              >
                <IconRenderer name={bucket.icon} className="w-4 h-4" />
              </div>
              <span className="font-semibold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                {bucket.name}
              </span>
            </div>
          </td>

          {/* Regex Spalte */}
          <td className="py-3 px-4 text-xs font-mono text-slate-600">
            {bucket.regexPattern ? (
              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                {bucket.regexPattern}
              </span>
            ) : hasChildren ? (
              <span className="text-slate-400 italic">Roll-Up aus Unter-Buckets</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>

          {/* Soll-Budget */}
          <td className="py-3 px-4 text-xs text-slate-700">
            {bucket.targetBudget ? (
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                {bucket.targetBudget.amount.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                })}{' '}
                / {bucket.targetBudget.period === 'monthly' ? 'Monat' : bucket.targetBudget.period}
              </span>
            ) : (
              <span className="text-slate-400">Kein Budget</span>
            )}
          </td>

          {/* Manuelle Overrides */}
          <td className="py-3 px-4 text-xs text-slate-600">
            {bucket.manualTransactionIds && bucket.manualTransactionIds.length > 0 ? (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                {bucket.manualTransactionIds.length} Buchung(en)
              </span>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </td>
        </tr>

        {!isCollapsed &&
          children.map((child) => renderBucketRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const rootBuckets = childrenMap.get(null) || [];

  return (
    <div className="space-y-6">
      {/* Header & Aktionen */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-blue-600" />
            Konfiguration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Verwalte hierarchische Buckets, Regex-Muster, Soll-Budgets und Konten. Klicke auf eine Zeile zum Bearbeiten oder nutze Drag & Drop zum Sortieren & Unterordnen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Download className="w-4 h-4" />
            JSON Export
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            JSON Import
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (confirm('Möchtest du wirklich alle Daten zurücksetzen?')) {
                resetWorkspace();
              }
            }}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Zurücksetzen"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('buckets')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'buckets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Buckets ({buckets.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Konten & Salden ({accounts.length})
        </button>
      </div>

      {/* TAB 1: BUCKETS */}
      {activeTab === 'buckets' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Bucket-Baumtabelle
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ziehe Zeilen per Drag & Drop oben/unten zum Sortieren oder in die Mitte, um sie unterzuordnen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingBucket(null);
                setIsBucketModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Neuer Bucket
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Bucket Name</th>
                  <th className="py-3 px-4">Regex-Muster (Leafs)</th>
                  <th className="py-3 px-4">Soll-Budget</th>
                  <th className="py-3 px-4">Manuelle Overrides</th>
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

          {/* Root Level Dropzone (um Kind-Buckets wieder zu Top-Level zu machen) */}
          {draggedBucketId && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsOverRootDropzone(true);
              }}
              onDragLeave={() => setIsOverRootDropzone(false)}
              onDrop={handleRootDrop}
              className={`m-4 p-4 rounded-xl border-2 border-dashed text-center transition-all flex items-center justify-center gap-2 text-xs font-semibold ${
                isOverRootDropzone
                  ? 'border-blue-500 bg-blue-50 text-blue-700 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50/60 text-slate-500'
              }`}
            >
              <CornerDownRight className="w-4 h-4" />
              Hier ablegen, um Bucket auf die oberste Ebene (Top-Level) zu verschieben
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Verwaltete Konten ({accounts.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ziehe Konten-Karten per Drag & Drop, um deren Reihenfolge anzupassen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neues Konto
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {sortedAccounts.map((acc) => {
              const isDraggingThis = draggedAccountId === acc.id;
              const isTarget = dropTargetAccountId === acc.id;

              return (
                <div
                  key={acc.id}
                  draggable
                  onDragStart={(e) => handleAccountDragStart(e, acc.id)}
                  onDragOver={(e) => handleAccountDragOver(e, acc.id)}
                  onDragLeave={() => {
                    if (dropTargetAccountId === acc.id) setDropTargetAccountId(null);
                  }}
                  onDrop={(e) => handleAccountDrop(e, acc)}
                  onDragEnd={handleAccountDragEnd}
                  onClick={() => {
                    setEditingAccount(acc);
                    setIsAccountModalOpen(true);
                  }}
                  className={`bg-white p-4 sm:p-5 rounded-2xl shadow-sm border transition-all cursor-pointer group ${
                    isDraggingThis ? 'opacity-40 scale-[0.99] border-slate-200' : 'hover:border-blue-400 hover:shadow-md'
                  } ${
                    isTarget ? 'border-t-4 border-t-blue-600 bg-blue-50/40 border-slate-200' : 'border-slate-200'
                  }`}
                  title="Klicken zum Bearbeiten &bull; Ziehen zum Umsortieren"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Linker Bereich: Drag Handle + Icon + Name + IBAN */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-1 rounded transition-colors -ml-1"
                        onClick={(e) => e.stopPropagation()}
                        title="Ziehen zum Umsortieren"
                      >
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: acc.color || '#3b82f6' }}
                      >
                        <IconRenderer name={acc.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {acc.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          {acc.iban || 'Keine IBAN angegeben'} ({acc.currency})
                        </p>
                      </div>
                    </div>

                    {/* Mittlerer Bereich: Verknüpfte Buckets */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Zugeordnete Buckets ({acc.bucketIds.length})
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {acc.bucketIds.length > 0 ? (
                          acc.bucketIds.map((bId) => {
                            const b = buckets.find((item) => item.id === bId);
                            if (!b) return null;
                            return (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                <IconRenderer name={b.icon} style={{ color: b.color }} className="w-3 h-3" />
                                {b.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">Alle Buckets zugelassen</span>
                        )}
                      </div>
                    </div>

                    {/* Rechter Bereich: Saldo & Aktionen */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 min-w-[220px]">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center sm:justify-end gap-1 mb-0.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {acc.balanceEntries.length} Salden
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {acc.balanceEntries.length > 0
                            ? acc.balanceEntries[acc.balanceEntries.length - 1].amount.toLocaleString('de-DE', {
                                style: 'currency',
                                currency: acc.currency,
                              })
                            : '0,00 €'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAccount(acc);
                            setIsAccountModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Konto "${acc.name}" wirklich löschen?`)) {
                              deleteAccount(acc.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
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

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={editingAccount}
        existingBuckets={buckets}
        onSave={async (accountData) => {
          if (editingAccount) {
            await updateAccount(accountData as Account);
          } else {
            await addAccount(accountData);
          }
        }}
      />
    </div>
  );
};
