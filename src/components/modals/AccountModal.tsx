/**
 * @file AccountModal.tsx
 * @description Modaler Dialog zum Anlegen und Bearbeiten von Konten,
 * Verknüpfen von Kategorien und Erfassen von historischen Stichtags-Salden (Balance Entries).
 * @module components/modals/AccountModal
 */

import React, { useState, useEffect } from 'react';
import { Account, BalanceEntry, Category, ISODateString } from '@/types/finance';
import { IconRenderer } from '../IconRenderer';
import { EntityVisualFields } from '../EntityVisualFields';
import { MoneyInput } from '../MoneyInput';
import { X, Plus, Trash2, Calendar } from 'lucide-react';
import { toISODateString } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accountData: Omit<Account, 'id'> | Account) => Promise<void>;
  account?: Account | null;
  existingCategories?: Category[];
  /** @deprecated Verwende existingCategories */
  existingBuckets?: Category[];
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  account,
  existingCategories: propExistingCategories,
  existingBuckets: propExistingBuckets,
}) => {
  const existingCategories = propExistingCategories ?? propExistingBuckets ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('Landmark');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);

  // Neuer Salden-Eintrag Input-State
  const [newEntryDate, setNewEntryDate] = useState<ISODateString>(toISODateString(new Date()));
  const [newEntryAmount, setNewEntryAmount] = useState<number>(0);
  const [newEntryNote, setNewEntryNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setDescription(account.description || '');
      setColor(account.color || '#3b82f6');
      setIcon(account.icon || 'Landmark');
      const cats = account.categoryIds || account.bucketIds || [];
      setCategoryIds(cats);
      setBalanceEntries(account.balanceEntries || []);
    } else {
      setName('');
      setDescription('');
      setColor('#3b82f6');
      setIcon('Landmark');
      setCategoryIds([]);
      setBalanceEntries([]);
    }
  }, [account, isOpen]);

  const handleToggleCategory = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

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
    if (!name.trim()) return;

    try {
      setSaving(true);
      await onSave({
        ...(account ? { id: account.id } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        categoryIds,
        bucketIds: categoryIds,
        balanceEntries,
      });
      onClose();
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
            {account ? 'Konto bearbeiten' : 'Neues Konto anlegen'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
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
            nameLabel="Kontoname *"
            namePlaceholder="z. B. Girokonto ING, Tagesgeld DKB, Depot"
          />

          {/* Zugeordnete Kategorien */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Zugeordnete Kategorien ({categoryIds.length} ausgewählt)
            </label>
            <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              {existingCategories.map((c) => {
                const isSelected = categoryIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors ${
                      isSelected
                        ? 'bg-blue-50 font-medium text-blue-900'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCategory(c.id)}
                      className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <IconRenderer
                      name={c.icon}
                      style={{ color: c.color }}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Stichtags-Salden (Balance Entries) */}
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
                      <span className="font-bold text-slate-900">{formatMoney(entry.amount)}</span>
                      {entry.note && <span className="italic text-slate-500">({entry.note})</span>}
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
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Stichtag hinzufügen
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
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Speichert...' : account ? 'Änderungen speichern' : 'Konto anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
};
