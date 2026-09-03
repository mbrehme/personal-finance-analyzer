/**
 * @file BucketModal.tsx
 * @description Modaler Dialog zum Erstellen und Bearbeiten hierarchischer Buckets
 * inkl. Regex-Muster, Soll-Budgets und visueller Attribute (Farbe, Icon).
 * @module components/modals/BucketModal
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Bucket, PeriodGranularity } from '@/types/finance';
import { normalizeBudgetToGranularity } from '@/utils/dateUtils';
import { formatMoney, roundToTwoDecimals } from '@/utils/moneyUtils';
import { IconRenderer } from '../IconRenderer';
import { EntityVisualFields } from '../EntityVisualFields';
import { MoneyInput } from '../MoneyInput';
import { X, AlertCircle, Trash2 } from 'lucide-react';

export interface BucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bucketData: Omit<Bucket, 'id'> | Bucket) => Promise<void>;
  onDelete?: (bucketId: string) => Promise<void>;
  bucket?: Bucket | null;
  existingBuckets: Bucket[];
}

export const BucketModal: React.FC<BucketModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  bucket,
  existingBuckets,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [regexPattern, setRegexPattern] = useState('');
  const [color, setColor] = useState('#3b82f6');
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
      setDescription(bucket.description || '');
      setParentId(bucket.parentId);
      setRegexPattern(bucket.regexPattern || '');
      setColor(bucket.color || '#3b82f6');
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
      setDescription('');
      setParentId(null);
      setRegexPattern('');
      setColor('#3b82f6');
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

  // Rekursive Ermittlung des Rollup-Wertes aller Kinder-Budgets
  const rollupMonthlyBudget = useMemo(() => {
    if (!bucket) return 0;

    const childrenMap = new Map<string, Bucket[]>();
    existingBuckets.forEach((b) => {
      if (b.parentId) {
        const list = childrenMap.get(b.parentId) || [];
        list.push(b);
        childrenMap.set(b.parentId, list);
      }
    });

    const getChildrenBudget = (bId: string): number => {
      const children = childrenMap.get(bId) || [];
      if (children.length === 0) {
        const b = existingBuckets.find((item) => item.id === bId);
        if (!b?.targetBudget) return 0;
        return normalizeBudgetToGranularity(
          b.targetBudget.amount,
          b.targetBudget.period,
          'monthly'
        );
      }
      return children.reduce((sum, child) => sum + getChildrenBudget(child.id), 0);
    };

    const directChildren = childrenMap.get(bucket.id) || [];
    return directChildren.reduce((sum, child) => sum + getChildrenBudget(child.id), 0);
  }, [bucket, existingBuckets]);

  const rollupForSelectedPeriod = useMemo(() => {
    return normalizeBudgetToGranularity(rollupMonthlyBudget, 'monthly', budgetPeriod);
  }, [rollupMonthlyBudget, budgetPeriod]);

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
        description: description.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: color || '#3b82f6' }}
            >
              <IconRenderer name={icon} className="h-4 w-4" />
            </div>
            {bucket ? 'Bucket bearbeiten' : 'Neuen Bucket anlegen'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
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
            nameLabel="Bucket-Name *"
            namePlaceholder="z. B. Miete, Lebensmittel, Gehalt"
          />

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Übergeordneter Bucket (Parent)
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Regex
              </label>
              <input
                type="text"
                value={regexPattern}
                onChange={(e) => handleRegexChange(e.target.value)}
                placeholder="z. B. Rewe|Edeka|Aldi|Lidl"
                className={`h-10 w-full rounded-xl border px-3.5 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 ${
                  regexError
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {regexError ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {regexError}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Wird gegen das Compound-Feld (Konto, Sender, Empfänger, Text, Betrag) geprüft.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Dieser Bucket besitzt untergeordnete Kinder. Regex-Regeln werden ausschließlich auf
              Kinder-Buckets angewendet.
            </div>
          )}

          {/* Soll-Budget */}
          <div className="space-y-2 border-t border-slate-100 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Soll-Budget festlegen
                </label>
                {isParentWithChildren && (
                  <span className="text-[11px] text-slate-500">
                    Manuelles Budget für diesen übergeordneten Bucket
                  </span>
                )}
              </div>
              <input
                type="checkbox"
                checked={hasBudget}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasBudget(checked);
                  if (
                    checked &&
                    isParentWithChildren &&
                    rollupForSelectedPeriod > 0 &&
                    budgetAmount === 100
                  ) {
                    setBudgetAmount(roundToTwoDecimals(rollupForSelectedPeriod));
                  }
                }}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            {hasBudget ? (
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                      Zielbetrag
                    </label>
                    <MoneyInput
                      value={budgetAmount}
                      onChange={setBudgetAmount}
                      min={0}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                      Zyklus
                    </label>
                    <select
                      value={budgetPeriod}
                      onChange={(e) => setBudgetPeriod(e.target.value as PeriodGranularity)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monthly">Monatlich</option>
                      <option value="quarterly">Quartal</option>
                      <option value="halfYearly">Halbjahr</option>
                      <option value="yearly">Jährlich</option>
                    </select>
                  </div>
                </div>

                {/* Hint für Rollup-Wert bei Elternbuckets */}
                {isParentWithChildren && rollupForSelectedPeriod > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Rollup der Kinder:</span>{' '}
                      {formatMoney(rollupForSelectedPeriod)} /{' '}
                      {budgetPeriod === 'monthly'
                        ? 'Monat'
                        : budgetPeriod === 'quarterly'
                          ? 'Quartal'
                          : budgetPeriod === 'halfYearly'
                            ? 'Halbjahr'
                            : 'Jahr'}
                    </span>
                    {budgetAmount !== roundToTwoDecimals(rollupForSelectedPeriod) && (
                      <button
                        type="button"
                        onClick={() => setBudgetAmount(roundToTwoDecimals(rollupForSelectedPeriod))}
                        className="cursor-pointer font-semibold text-blue-600 underline transition-colors hover:text-blue-700 hover:no-underline"
                      >
                        Als Wert übernehmen
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              isParentWithChildren &&
              rollupMonthlyBudget > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 text-[11px] text-blue-900">
                  <span>
                    <strong>Automatisches Rollup aktiv:</strong> {formatMoney(rollupMonthlyBudget)}{' '}
                    / Monat aus untergeordneten Buckets.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHasBudget(true);
                      setBudgetAmount(roundToTwoDecimals(rollupMonthlyBudget));
                    }}
                    className="ml-2 shrink-0 cursor-pointer font-bold text-blue-700 underline hover:text-blue-800"
                  >
                    Manuell überschreiben
                  </button>
                </div>
              )
            )}
          </div>

          {bucket?.manualTransactionIds && bucket.manualTransactionIds.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-800">
              <strong>{bucket.manualTransactionIds.length}</strong> Buchung(en) wurden diesem Bucket
              manuell zugewiesen.
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            {bucket && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Lösche...' : 'Bucket löschen'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !!regexError}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
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
