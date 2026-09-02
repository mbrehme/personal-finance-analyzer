/**
 * @file Configuration.tsx
 * @description Konfigurationsansicht zur Verwaltung von hierarchischen Buckets
 * (Regex, Budgets, Icons), Konten mit Stichtags-Salden und JSON Import/Export.
 * @module pages/Configuration
 */

import React, { useState } from 'react';
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
} from 'lucide-react';

export const Configuration: React.FC = () => {
  const {
    buckets,
    accounts,
    addBucket,
    updateBucket,
    deleteBucket,
    addAccount,
    updateAccount,
    deleteAccount,
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

  // Bucket Baumstruktur aufbauen
  const childrenMap = new Map<string | null, Bucket[]>();
  buckets.forEach((b) => {
    const list = childrenMap.get(b.parentId) || [];
    list.push(b);
    childrenMap.set(b.parentId, list);
  });

  const renderBucketRow = (bucket: Bucket, depth: number): React.ReactNode => {
    const children = childrenMap.get(bucket.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedBuckets.has(bucket.id);

    return (
      <React.Fragment key={bucket.id}>
        <tr
          onClick={() => {
            setEditingBucket(bucket);
            setIsBucketModalOpen(true);
          }}
          className="hover:bg-blue-50/60 cursor-pointer transition-colors border-b border-slate-100 group"
          title="Klicken zum Bearbeiten"
        >
          <td className="py-3 px-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
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
              <span className="text-slate-400 italic">Roll-Up aus Unterkategorien</span>
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
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
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
            Verwalte hierarchische Buckets, Regex-Muster, Soll-Budgets und Konten.
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
          Buckets & Kategorien ({buckets.length})
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Kategorien-Baumtabelle
            </h2>
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
        </div>
      )}

      {/* TAB 2: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Verwaltete Konten ({accounts.length})
            </h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: acc.color || '#3b82f6' }}
                    >
                      <IconRenderer name={acc.icon} className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{acc.name}</h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {acc.iban || 'Keine IBAN angegeben'} ({acc.currency})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(acc);
                        setIsAccountModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Bearbeiten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Konto "${acc.name}" wirklich löschen?`)) {
                          deleteAccount(acc.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Verknüpfte Buckets */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Zugeordnete Buckets ({acc.bucketIds.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
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

                {/* Stichtags-Salden Übersicht */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    {acc.balanceEntries.length} Stichtags-Saldo/Salden hinterlegt
                  </span>
                  {acc.balanceEntries.length > 0 && (
                    <span className="font-bold text-slate-800">
                      Letzter Stand:{' '}
                      {acc.balanceEntries[acc.balanceEntries.length - 1].amount.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: acc.currency,
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
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
