/**
 * @file AccountModal.tsx
 * @description Modaler Dialog zum Anlegen und Bearbeiten von Konten (Echte Bankkonten mit IBAN
 * sowie Virtuelle Unterkonten mit Elternkonto-Verknüpfung und Filter-Kategorien)
 * inklusive Erfassung von historischen Stichtags-Salden (Balance Entries).
 * @module components/modals/AccountModal
 */

import React, { useState, useEffect } from 'react';
import {
  Account,
  AccountType,
  BalanceEntry,
  Category,
  ISODateString,
  normalizeIban,
} from '@/types/finance';
import { IconRenderer } from '../IconRenderer';
import { EntityVisualFields } from '../EntityVisualFields';
import { MoneyInput } from '../MoneyInput';
import { CategoryFilterDropdown } from '@/ui/components/analytics/CategoryFilterDropdown';
import { X, Save, Trash2, Calendar, Landmark, FolderTree, Info } from 'lucide-react';
import { toISODateString } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accountData: Omit<Account, 'id'> | Account) => Promise<void>;
  account?: Account | null;
  existingCategories?: Category[];
  existingAccounts?: Account[];
  initialParentAccountId?: string | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  account,
  existingCategories = [],
  existingAccounts = [],
  initialParentAccountId,
}) => {
  const [accountType, setAccountType] = useState<AccountType>('real');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('Landmark');
  const [iban, setIban] = useState('');
  const [parentAccountId, setParentAccountId] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);

  // Neuer Salden-Eintrag Input-State
  const [newEntryDate, setNewEntryDate] = useState<ISODateString>(toISODateString(new Date()));
  const [newEntryAmount, setNewEntryAmount] = useState<number>(0);
  const [newEntryNote, setNewEntryNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (account) {
      setAccountType(account.accountType || (account.parentAccountId ? 'virtual' : 'real'));
      setName(account.name);
      setDescription(account.description || '');
      setColor(account.color || '#3b82f6');
      setIcon(account.icon || 'Landmark');
      setIban(account.iban || '');
      setParentAccountId(account.parentAccountId || null);
      const cats = account.categoryIds || [];
      setCategoryIds(cats);
      setBalanceEntries(account.balanceEntries || []);
    } else {
      setAccountType(initialParentAccountId ? 'virtual' : 'real');
      setName('');
      setDescription('');
      setColor('#3b82f6');
      setIcon('Landmark');
      setIban('');
      setParentAccountId(initialParentAccountId || null);
      setCategoryIds([]);
      setBalanceEntries([]);
    }
  }, [account, isOpen, initialParentAccountId]);

  const realAccounts = existingAccounts.filter(
    (a) => a.accountType !== 'virtual' && a.id !== account?.id
  );

  const handleAddBalanceEntry = () => {
    if (!newEntryDate) return;

    const newEntry: BalanceEntry = {
      id: `be-${Date.now()}`,
      date: newEntryDate,
      amount: newEntryAmount,
      note: newEntryNote.trim() || undefined,
    };

    setBalanceEntries((prev) => [...prev, newEntry].sort((a, b) => a.date.localeCompare(b.date)));
    setNewEntryAmount(0);
    setNewEntryNote('');
  };

  const handleDeleteBalanceEntry = (entryId: string) => {
    setBalanceEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Bitte gib einen Kontonamen ein.');
      return;
    }

    if (accountType === 'virtual' && !parentAccountId) {
      setError('Bitte wähle ein übergeordnetes echtes Konto für das virtuelle Unterkonto aus.');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        ...(account ? { id: account.id } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        accountType,
        iban: accountType === 'real' ? normalizeIban(iban) || undefined : undefined,
        parentAccountId: accountType === 'virtual' ? parentAccountId : null,
        categoryIds: accountType === 'virtual' ? categoryIds : [],
        balanceEntries,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern des Kontos.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: color || '#3b82f6' }}
            >
              <IconRenderer name={icon} className="h-4 w-4" />
            </div>
            {account
              ? accountType === 'virtual'
                ? 'Virtuelles Unterkonto bearbeiten'
                : 'Echtes Bankkonto bearbeiten'
              : accountType === 'virtual'
                ? 'Neues virtuelles Unterkonto anlegen'
                : 'Neues Bankkonto anlegen'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            {/* Kontoart-Auswahl: Echtes Bankkonto vs. Virtuelles Unterkonto */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kontoart
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('real')}
                  className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                    accountType === 'real'
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Landmark
                      className={`h-4 w-4 ${accountType === 'real' ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                    <span
                      className={`text-xs font-bold ${accountType === 'real' ? 'text-blue-900' : 'text-slate-700'}`}
                    >
                      Echtes Bankkonto
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Giro, Tagesgeld, Depot mit eigener IBAN
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('virtual')}
                  className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                    accountType === 'virtual'
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FolderTree
                      className={`h-4 w-4 ${accountType === 'virtual' ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                    <span
                      className={`text-xs font-bold ${accountType === 'virtual' ? 'text-blue-900' : 'text-slate-700'}`}
                    >
                      Virtuelles Unterkonto
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Ordnet Transaktionen per Filter-Kategorie zu
                  </span>
                </button>
              </div>
            </div>

            {/* Einheitliche EntityVisualMetadata Felder: Color, Icon, Title & Description */}
            <EntityVisualFields
              name={name}
              setName={setName}
              color={color}
              setColor={setColor}
              icon={icon}
              setIcon={setIcon}
              description={description}
              setDescription={setDescription}
              nameLabel={accountType === 'virtual' ? 'Name des Unterkontos *' : 'Kontoname *'}
              namePlaceholder={
                accountType === 'virtual'
                  ? 'z. B. Urlaubstopf, Notgroschen, Steuerrücklage'
                  : 'z. B. Girokonto ING, Tagesgeld DKB, Depot'
              }
            />

            {/* SPEZIFISCHE FELDER FÜR ECHTES KONTO: IBAN */}
            {accountType === 'real' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  IBAN
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="z. B. DE89 3704 0044 0532 0130 00"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm uppercase text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span>
                    Transaktionen und Bank-Imports werden anhand dieser IBAN zugeordnet. Auf echten
                    Konten werden keine Kategorien manuell verknüpft.
                  </span>
                </div>
              </div>
            )}

            {/* SPEZIFISCHE FELDER FÜR VIRTUELLES UNTERKONTO: ELTERNKONTO & FILTER-PICKER */}
            {accountType === 'virtual' && (
              <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
                {/* Übergeordnetes echtes Konto */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Übergeordnetes echtes Bankkonto *
                  </label>
                  <select
                    value={parentAccountId || ''}
                    onChange={(e) => setParentAccountId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(Bitte echtes Konto auswählen)</option>
                    {realAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.iban ? `(${a.iban})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter-Picker für Kategorien */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Filter-Picker: Zugeordnete Kategorien ({categoryIds.length})
                    </label>
                    {categoryIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryIds([])}
                        className="text-[11px] text-blue-600 hover:text-blue-800"
                      >
                        Alle abwählen
                      </button>
                    )}
                  </div>
                  <CategoryFilterDropdown
                    categories={existingCategories}
                    selectedCategoryIds={categoryIds.length === 0 ? [] : categoryIds}
                    onChange={(ids) => setCategoryIds(ids ?? [])}
                    hasUncategorized={false}
                    className="w-full"
                  />
                  <div className="mt-1.5 text-[11px] text-slate-500">
                    Buchungen auf dem übergeordneten Konto, die diesen Kategorien angehören,
                    verändern die Balance dieses virtuellen Unterkontos.
                  </div>
                </div>
              </div>
            )}

            {/* Stichtags-Salden (Balance Entries) für BEIDE Kontenarten */}
            <div className="border-t border-slate-100 pt-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Stichtags-Salden (Stand zu Datum X)
              </label>

              {balanceEntries.length > 0 && (
                <div className="mb-3 max-h-32 space-y-1.5 overflow-y-auto">
                  {balanceEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{entry.date}:</span>
                        <span className="font-bold text-slate-900">
                          {formatMoney(entry.amount)}
                        </span>
                        {entry.note && (
                          <span className="italic text-slate-500">({entry.note})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBalanceEntry(entry.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Neuer Eintrag Formular */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Neuen Salden-Stichtag hinzufügen
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    type="date"
                    value={newEntryDate}
                    onChange={(e) => setNewEntryDate(e.target.value as ISODateString)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                  />
                  <MoneyInput
                    value={newEntryAmount}
                    onChange={setNewEntryAmount}
                    placeholder="0,00 €"
                    className="h-8 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Notiz (optional)"
                    value={newEntryNote}
                    onChange={(e) => setNewEntryNote(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddBalanceEntry}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <Save className="h-3.5 w-3.5 text-blue-600" />
                  Stichtag speichern
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichert...' : account ? 'Änderungen speichern' : 'Konto anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
