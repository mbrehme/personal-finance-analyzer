/**
 * @file CategoryModal.tsx
 * @description Modaler Dialog zum Erstellen und Bearbeiten hierarchischer Kategorien
 * inkl. Regex-Muster, Soll-Budgets und visueller Attribute (Farbe, Icon).
 * @module components/modals/CategoryModal
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Category, PeriodGranularity } from '@/types/finance';
import { normalizeBudgetToGranularity } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '../IconRenderer';
import { EntityVisualFields } from '../EntityVisualFields';
import { MoneyInput } from '../MoneyInput';
import { X, AlertCircle, Trash2 } from 'lucide-react';

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryData: Omit<Category, 'id'> | Category) => Promise<void>;
  onDelete?: (categoryId: string) => Promise<void>;
  category?: Category | null;
  existingCategories?: Category[];
  /** Vorausgewählte übergeordnete Kategorie beim Neuanlegen */
  initialParentId?: string | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  category: currentCategory,
  existingCategories = [],
  initialParentId = null,
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
    if (currentCategory) {
      setName(currentCategory.name);
      setDescription(currentCategory.description || '');
      setParentId(currentCategory.parentId);
      setRegexPattern(currentCategory.regexPattern || '');
      setColor(currentCategory.color || '#3b82f6');
      setIcon(currentCategory.icon || 'Folder');
      if (currentCategory.targetBudget) {
        setHasBudget(true);
        setBudgetAmount(currentCategory.targetBudget.amount);
        setBudgetPeriod(currentCategory.targetBudget.period);
      } else {
        setHasBudget(false);
      }
    } else {
      setName('');
      setDescription('');
      setParentId(initialParentId ?? null);
      setRegexPattern('');
      setColor('#3b82f6');
      setIcon('Folder');
      setHasBudget(false);
      setBudgetAmount(100);
      setBudgetPeriod('monthly');
    }
    setRegexError(null);
  }, [currentCategory, isOpen, initialParentId]);

  // Prüfen, ob die aktuelle Kategorie Kinder hat (dann darf sie selbst kein Regex haben)
  const isParentWithChildren = currentCategory
    ? existingCategories.some((c) => c.parentId === currentCategory.id)
    : false;

  // Rekursive Ermittlung des Rollup-Wertes aller Kinder-Budgets
  const rollupMonthlyBudget = useMemo(() => {
    if (!currentCategory) return 0;

    const childrenMap = new Map<string, Category[]>();
    existingCategories.forEach((c) => {
      if (c.parentId) {
        const list = childrenMap.get(c.parentId) || [];
        list.push(c);
        childrenMap.set(c.parentId, list);
      }
    });

    const getChildrenBudget = (cId: string): number => {
      const children = childrenMap.get(cId) || [];
      if (children.length === 0) {
        const c = existingCategories.find((item) => item.id === cId);
        if (!c?.targetBudget) return 0;
        return normalizeBudgetToGranularity(
          c.targetBudget.amount,
          c.targetBudget.period,
          'monthly'
        );
      }
      return children.reduce((sum, child) => sum + getChildrenBudget(child.id), 0);
    };

    const directChildren = childrenMap.get(currentCategory.id) || [];
    return directChildren.reduce((sum, child) => sum + getChildrenBudget(child.id), 0);
  }, [currentCategory, existingCategories]);

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
        ...(currentCategory
          ? { id: currentCategory.id, manualTransactionIds: currentCategory.manualTransactionIds }
          : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || null,
        regexPattern: isParentWithChildren ? undefined : regexPattern.trim() || undefined,
        color,
        icon,
        targetBudget:
          !isParentWithChildren && hasBudget
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
    if (!currentCategory || !onDelete) return;
    if (confirm(`Kategorie "${currentCategory.name}" wirklich löschen?`)) {
      try {
        setDeleting(true);
        await onDelete(currentCategory.id);
        onClose();
      } finally {
        setDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  // Verfügbare Parents filtern (keine Zyklen erlauben)
  const availableParents = existingCategories.filter(
    (c) => !currentCategory || (c.id !== currentCategory.id && c.parentId !== currentCategory.id)
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
            {currentCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie anlegen'}
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
            nameLabel="Kategorie-Name *"
            namePlaceholder="z. B. Miete, Lebensmittel, Gehalt"
          />

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Übergeordnete Kategorie (Parent)
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Keine (Top-Level Kategorie)</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Regex-Regel (nur für Leaf-Kategorien) */}
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
              Diese Kategorie besitzt untergeordnete Kinder. Regex-Regeln werden ausschließlich auf
              Kinder-Kategorien angewendet.
            </div>
          )}

          {/* Soll-Budget */}
          <div className="space-y-2 border-t border-slate-100 pt-2">
            {isParentWithChildren ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                  Automatisches Rollup aktiv
                </div>
                <p className="mt-1 text-[11px] text-blue-700">
                  Diese Kategorie besitzt Unterkategorien. Das Budget und die Werte berechnen sich
                  automatisch aus den ausgewählten Unterkategorien (Rollup). Es kann kein eigenes
                  manuelles Budget vergeben werden.
                </p>
                {rollupMonthlyBudget > 0 && (
                  <div className="mt-2 text-xs font-bold text-blue-900">
                    Aktuelle Summe aller Unterkategorien: {formatMoney(rollupMonthlyBudget)} / Monat
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Soll-Budget festlegen
                    </label>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasBudget}
                    onChange={(e) => setHasBudget(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {hasBudget && (
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
                  </div>
                )}
              </>
            )}
          </div>

          {currentCategory?.manualTransactionIds &&
            currentCategory.manualTransactionIds.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-800">
                <strong>{currentCategory.manualTransactionIds.length}</strong> Buchung(en) wurden
                dieser Kategorie manuell zugewiesen.
              </div>
            )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            {currentCategory && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Lösche...' : 'Kategorie löschen'}
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
                {saving
                  ? 'Speichert...'
                  : currentCategory
                    ? 'Änderungen speichern'
                    : 'Kategorie anlegen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Re-Export für Abwärtskompatibilität
export const BucketModal = CategoryModal;
