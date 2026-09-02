/**
 * @file BucketModal.tsx
 * @description Modaler Dialog zum Erstellen und Bearbeiten hierarchischer Buckets
 * inkl. Regex-Muster, Soll-Budgets und visueller Attribute (Farbe, Icon).
 * @module components/modals/BucketModal
 */

import React, { useState, useEffect } from 'react';
import { Bucket, PeriodGranularity } from '@/types/finance';
import { AVAILABLE_ICONS, IconRenderer } from '../IconRenderer';
import { X, AlertCircle, Trash2 } from 'lucide-react';

export interface BucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bucketData: Omit<Bucket, 'id'> | Bucket) => Promise<void>;
  onDelete?: (bucketId: string) => Promise<void>;
  bucket?: Bucket | null;
  existingBuckets: Bucket[];
}

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#64748b', '#d97706', '#14b8a6', '#6366f1',
];

export const BucketModal: React.FC<BucketModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  bucket,
  existingBuckets,
}) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [regexPattern, setRegexPattern] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState('Folder');
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState<number>(100);
  const [budgetPeriod, setBudgetPeriod] = useState<PeriodGranularity>('monthly');
  const [regexError, setRegexError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (bucket) {
      setName(bucket.name);
      setParentId(bucket.parentId);
      setRegexPattern(bucket.regexPattern || '');
      setColor(bucket.color || COLOR_PALETTE[0]);
      setIcon(bucket.icon || 'Folder');
      if (bucket.targetBudget) {
        setHasBudget(true);
        setBudgetAmount(bucket.targetBudget.amount);
        setBudgetPeriod(bucket.targetBudget.period);
      } else {
        setHasBudget(false);
      }
    } else {
      setName('');
      setParentId(null);
      setRegexPattern('');
      setColor(COLOR_PALETTE[0]);
      setIcon('Folder');
      setHasBudget(false);
      setBudgetAmount(100);
      setBudgetPeriod('monthly');
    }
    setRegexError(null);
  }, [bucket, isOpen]);

  // Prüfen, ob der aktuelle Bucket Kinder hat (dann darf er selbst kein Regex haben)
  const isParentWithChildren = bucket
    ? existingBuckets.some((b) => b.parentId === bucket.id)
    : false;

  const handleRegexChange = (pattern: string) => {
    setRegexPattern(pattern);
    if (!pattern.trim()) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(pattern.trim(), 'i');
      setRegexError(null);
    } catch (e) {
      setRegexError(e instanceof Error ? e.message : 'Ungültiger regulärer Ausdruck');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || regexError) return;

    try {
      setSaving(true);
      const payload = {
        ...(bucket ? { id: bucket.id, manualTransactionIds: bucket.manualTransactionIds } : {}),
        name: name.trim(),
        parentId: parentId || null,
        regexPattern: isParentWithChildren ? undefined : regexPattern.trim() || undefined,
        color,
        icon,
        targetBudget: hasBudget
          ? {
              amount: Math.abs(budgetAmount),
              period: budgetPeriod,
            }
          : undefined,
      };

      await onSave(payload as any);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bucket || !onDelete) return;
    if (confirm(`Bucket "${bucket.name}" wirklich löschen?`)) {
      try {
        setDeleting(true);
        await onDelete(bucket.id);
        onClose();
      } finally {
        setDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  // Verfügbare Parents filtern (keine Zyklen erlauben)
  const availableParents = existingBuckets.filter(
    (b) => !bucket || (b.id !== bucket.id && b.parentId !== bucket.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <IconRenderer name={icon} style={{ color }} className="w-6 h-6" />
            {bucket ? 'Bucket bearbeiten' : 'Neuen Bucket anlegen'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Bucket-Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Miete, Lebensmittel, Gehalt"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Übergeordneter Bucket (Parent)
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">Keiner (Top-Level Bucket)</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Regex-Regel (nur für Leaf-Buckets) */}
          {!isParentWithChildren ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Regex
              </label>
              <input
                type="text"
                value={regexPattern}
                onChange={(e) => handleRegexChange(e.target.value)}
                placeholder="z. B. Rewe|Edeka|Aldi|Lidl"
                className={`w-full px-3 py-2 font-mono text-xs border rounded-lg focus:outline-none focus:ring-2 ${
                  regexError
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {regexError ? (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {regexError}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  Wird gegen das Compound-Feld (Konto, Sender, Empfänger, Text, Betrag) geprüft.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
              Dieser Bucket besitzt untergeordnete Kinder. Regex-Regeln werden ausschließlich auf Kinder-Buckets angewendet.
            </div>
          )}

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

          {/* Soll-Budget */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Soll-Budget festlegen
              </label>
              <input
                type="checkbox"
                checked={hasBudget}
                onChange={(e) => setHasBudget(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            {hasBudget && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Zielbetrag (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Zyklus
                  </label>
                  <select
                    value={budgetPeriod}
                    onChange={(e) => setBudgetPeriod(e.target.value as PeriodGranularity)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Quartal</option>
                    <option value="halfYearly">Halbjahr</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {bucket?.manualTransactionIds && bucket.manualTransactionIds.length > 0 && (
            <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200 text-xs text-blue-800">
              <strong>{bucket.manualTransactionIds.length}</strong> Buchung(en) wurden diesem Bucket manuell zugewiesen.
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {bucket && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Lösche...' : 'Bucket löschen'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !!regexError}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {saving ? 'Speichert...' : bucket ? 'Änderungen speichern' : 'Bucket anlegen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
