/**
 * @file AccountsConfig.tsx
 * @description Unterseite zur Verwaltung von Konten, Stichtags-Salden und Konten-Reihenfolge per Drag-and-Drop.
 * @module pages/configuration/AccountsConfig
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { Account } from '@/types/finance';
import { IconRenderer } from '@/components/IconRenderer';
import { AccountModal } from '@/components/modals/AccountModal';
import {
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  GripVertical,
} from 'lucide-react';

export const AccountsConfig: React.FC = () => {
  const {
    buckets,
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
  } = useFinance();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Drag & Drop State
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null);

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

  return (
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

      {/* Modal */}
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

