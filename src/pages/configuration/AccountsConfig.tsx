/**
 * @file AccountsConfig.tsx
 * @description Unterseite zur Verwaltung von Konten, Stichtags-Salden und Konten-Reihenfolge per Drag-and-Drop.
 * @module pages/configuration/AccountsConfig
 */

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/services/storage/FinanceContext';
import { Account } from '@/types/finance';
import { formatDate } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/components/IconRenderer';
import { AccountModal } from '@/components/modals/AccountModal';
import {
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  GripVertical,
  Landmark,
  FolderTree,
  CornerDownRight,
} from 'lucide-react';

export const AccountsConfig: React.FC = () => {
  const { categories, accounts, addAccount, updateAccount, deleteAccount, reorderAccounts } =
    useFinance();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [initialParentAccountId, setInitialParentAccountId] = useState<string | undefined>(
    undefined
  );

  // Drag & Drop State
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [accounts]);

  // Gruppierung in Hauptkonten (real) und deren Unterkonten (virtual)
  const accountHierarchy = useMemo(() => {
    const realAccounts = sortedAccounts.filter((a) => a.accountType !== 'virtual');
    const virtualAccounts = sortedAccounts.filter((a) => a.accountType === 'virtual');

    const groups: { real: Account; subAccounts: Account[] }[] = realAccounts.map((real) => ({
      real,
      subAccounts: virtualAccounts.filter((v) => v.parentAccountId === real.id),
    }));

    const assignedSubIds = new Set(groups.flatMap((g) => g.subAccounts.map((s) => s.id)));
    const orphanedSubAccounts = virtualAccounts.filter((v) => !assignedSubIds.has(v.id));

    return { groups, orphanedSubAccounts };
  }, [sortedAccounts]);

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

  const renderAccountCard = (acc: Account, isSubAccount: boolean = false) => {
    const isDraggingThis = draggedAccountId === acc.id;
    const isTarget = dropTargetAccountId === acc.id;
    const accountCatIds = acc.categoryIds || acc.bucketIds || [];

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
          setInitialParentAccountId(undefined);
          setIsAccountModalOpen(true);
        }}
        className={`group cursor-pointer rounded-2xl border p-4 shadow-sm transition-all sm:p-5 ${
          isSubAccount ? 'bg-slate-50/70' : 'bg-white'
        } ${
          isDraggingThis
            ? 'scale-[0.99] border-slate-200 opacity-40'
            : 'hover:border-blue-400 hover:shadow-md'
        } ${
          isTarget
            ? 'border-t-4 border-slate-200 border-t-blue-600 bg-blue-50/40'
            : 'border-slate-200'
        }`}
        title="Klicken zum Bearbeiten &bull; Ziehen zum Umsortieren"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          {/* Linker Bereich: Drag Handle + Icon + Name + Typ Badge */}
          <div className="flex min-w-[240px] items-center gap-3">
            <div
              className="-ml-1 cursor-grab rounded p-1 text-slate-400 transition-colors hover:text-slate-700 active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              title="Ziehen zum Umsortieren"
            >
              <GripVertical className="h-5 w-5" />
            </div>

            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: acc.color || '#3b82f6' }}
            >
              <IconRenderer name={acc.icon} className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                  {acc.name}
                </h3>
                {acc.accountType === 'virtual' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                    <FolderTree className="h-3 w-3" />
                    Virtuell
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    <Landmark className="h-3 w-3" />
                    Bankkonto
                  </span>
                )}
              </div>
              {acc.accountType !== 'virtual' && acc.iban && (
                <div className="mt-0.5 font-mono text-xs text-slate-500">IBAN: {acc.iban}</div>
              )}
            </div>
          </div>

          {/* Mittlerer Bereich: Verknüpfte Kategorien oder IBAN-Info & Unterkonto-Button */}
          <div className="min-w-[200px] flex-1">
            {acc.accountType === 'virtual' ? (
              <>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Filter-Kategorien ({accountCatIds.length})
                </div>
                <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                  {accountCatIds.length > 0 ? (
                    accountCatIds.map((cId) => {
                      const c = categories.find((item) => item.id === cId);
                      if (!c) return null;
                      return (
                        <span
                          key={c.id}
                          className="shadow-2xs inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          <IconRenderer
                            name={c.icon}
                            style={{ color: c.color }}
                            className="h-3 w-3"
                          />
                          {c.name}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs italic text-slate-400">
                      Alle Buchungen des Bankkontos
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAccount(null);
                    setInitialParentAccountId(acc.id);
                    setIsAccountModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800"
                  title="Virtuelles Unterkonto zu diesem Bankkonto erstellen"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Unterkonto anlegen</span>
                </button>
              </div>
            )}
          </div>

          {/* Rechter Bereich: Saldo mit Stichtag & Aktionen */}
          <div className="flex min-w-[230px] items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
            <div className="text-left sm:text-right">
              {acc.balanceEntries.length > 0 ? (
                <>
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:justify-end">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      Stichtag: {formatDate(acc.balanceEntries[acc.balanceEntries.length - 1].date)}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {formatMoney(acc.balanceEntries[acc.balanceEntries.length - 1].amount)}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:justify-end">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-300" />
                    <span>Kein Stichtag</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-400">0,00 €</div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingAccount(acc);
                  setInitialParentAccountId(undefined);
                  setIsAccountModalOpen(true);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title="Bearbeiten"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Konto "${acc.name}" wirklich löschen?`)) {
                    deleteAccount(acc.id);
                  }
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Verwaltete Konten ({accounts.length})
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Ziehe Konten-Karten per Drag & Drop, um deren Reihenfolge anzupassen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingAccount(null);
            setInitialParentAccountId(undefined);
            setIsAccountModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Neues Konto
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {accountHierarchy.groups.map(({ real, subAccounts }) => (
          <div key={real.id} className="space-y-2">
            {renderAccountCard(real, false)}

            {subAccounts.length > 0 && (
              <div className="ml-4 space-y-2 border-l-2 border-blue-200 pl-3 sm:ml-8 sm:pl-4">
                {subAccounts.map((sub) => (
                  <div key={sub.id} className="relative">
                    <div className="absolute -left-3 top-6 text-blue-300 sm:-left-4">
                      <CornerDownRight className="h-3.5 w-3.5" />
                    </div>
                    {renderAccountCard(sub, true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {accountHierarchy.orphanedSubAccounts.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Unzugeordnete Unterkonten
            </h3>
            {accountHierarchy.orphanedSubAccounts.map((sub) => renderAccountCard(sub, true))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setInitialParentAccountId(undefined);
        }}
        account={editingAccount}
        existingAccounts={accounts}
        initialParentAccountId={initialParentAccountId}
        existingCategories={categories}
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
