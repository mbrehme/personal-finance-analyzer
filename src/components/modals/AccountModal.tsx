/**
 * @file AccountModal.tsx
 * @description Modaler Dialog zum Anlegen und Bearbeiten von Konten,
 * Verknüpfen von Buckets und Erfassen von historischen Stichtags-Salden (Balance Entries).
 * @module components/modals/AccountModal
 */

import React, { useState, useEffect } from 'react';
import { Account, BalanceEntry, Bucket, ISODateString } from '@/types/finance';
import { AVAILABLE_ICONS, IconRenderer } from '../IconRenderer';
import { X, Plus, Trash2, Calendar } from 'lucide-react';
import { toISODateString } from '@/utils/dateUtils';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accountData: Omit<Account, 'id'> | Account) => Promise<void>;
  account?: Account | null;
  existingBuckets: Bucket[];
}

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#64748b', '#14b8a6', '#6366f1', '#0ea5e9',
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  account,
  existingBuckets,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState('Landmark');
  const [bucketIds, setBucketIds] = useState<string[]>([]);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);

  // Neuer Salden-Eintrag Input-State
  const [newEntryDate, setNewEntryDate] = useState<ISODateString>(toISODateString(new Date()));
  const [newEntryAmount, setNewEntryAmount] = useState<number>(0);
  const [newEntryNote, setNewEntryNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setColor(account.color || COLOR_PALETTE[0]);
      setIcon(account.icon || 'Landmark');
      setBucketIds(account.bucketIds || []);
      setBalanceEntries(account.balanceEntries || []);
    } else {
      setName('');
      setColor(COLOR_PALETTE[0]);
      setIcon('Landmark');
      setBucketIds([]);
      setBalanceEntries([]);
    }
  }, [account, isOpen]);

  const handleToggleBucket = (bId: string) => {
    setBucketIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  const handleAddBalanceEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryDate) return;

    const entry: BalanceEntry = {
      id: `be-${Date.now()}`,
      date: newEntryDate,
      amount: newEntryAmount,
      note: newEntryNote.trim() || undefined,
    };

    setBalanceEntries((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setNewEntryAmount(0);
    setNewEntryNote('');
  };

  const handleRemoveBalanceEntry = (entryId: string) => {
    setBalanceEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const payload = {
        ...(account ? { id: account.id } : {}),
        name: name.trim(),
        color,
        icon,
        bucketIds,
        balanceEntries,
      };

      await onSave(payload as any);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <IconRenderer name={icon} style={{ color }} className="w-6 h-6" />
            {account ? 'Konto bearbeiten' : 'Neues Konto anlegen'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Basis-Informationen */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Kontoname *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Girokonto ING, Tagesgeld DKB, Depot"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Farbe & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Farbe
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-offset-1 ring-blue-500' : 'hover:opacity-80'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Icon
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50 max-h-24 overflow-y-auto">
                {AVAILABLE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`p-1.5 rounded-md transition-colors ${
                      icon === ic ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <IconRenderer name={ic} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zugeordnete Buckets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Zugeordnete Buckets ({bucketIds.length} ausgewählt)
            </label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-36 overflow-y-auto text-xs">
              {existingBuckets.map((b) => {
                const isSelected = bucketIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleBucket(b.id)}
                      className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <IconRenderer name={b.icon} style={{ color: b.color }} className="w-3.5 h-3.5" />
                    <span className="truncate">{b.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Stichtags-Salden (Balance Entries) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Stichtags-Salden (Stand zu Datum X)
            </label>

            {balanceEntries.length > 0 && (
              <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
                {balanceEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800">{entry.date}:</span>
                      <span className="text-slate-900 font-bold">
                        {entry.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                      {entry.note && <span className="text-slate-500 italic">({entry.note})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBalanceEntry(entry.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Saldo-Hinzufügen Zeile */}
            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="col-span-4">
                <input
                  type="date"
                  value={newEntryDate}
                  onChange={(e) => setNewEntryDate(e.target.value as ISODateString)}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  value={newEntryAmount}
                  onChange={(e) => setNewEntryAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Betrag"
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="col-span-4">
                <input
                  type="text"
                  value={newEntryNote}
                  onChange={(e) => setNewEntryNote(e.target.value)}
                  placeholder="Notiz (z. B. Start)"
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddBalanceEntry}
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {saving ? 'Speichert...' : account ? 'Änderungen speichern' : 'Konto anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
