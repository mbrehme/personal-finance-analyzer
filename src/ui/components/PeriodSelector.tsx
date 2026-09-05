/**
 * @file PeriodSelector.tsx
 * @description Wiederverwendbare Segment-Control-Komponente zur Auswahl der Zeit-Granularität
 * (Monat, Quartal, Halbjahr, Jahr).
 * @module components/PeriodSelector
 */

import React from 'react';
import { PeriodGranularity } from '@/types/finance';

export interface PeriodSelectorProps {
  value: PeriodGranularity;
  onChange: (value: PeriodGranularity) => void;
  className?: string;
}

const GRANULARITY_OPTIONS: { key: PeriodGranularity; label: string }[] = [
  { key: 'monthly', label: 'Monatlich' },
  { key: 'quarterly', label: 'Quartal' },
  { key: 'halfYearly', label: 'Halbjahr' },
  { key: 'yearly', label: 'Jährlich' },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-sm font-medium ${className}`}
      role="group"
      aria-label="Granularitätsauswahl"
    >
      {GRANULARITY_OPTIONS.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`rounded-md px-3 py-1.5 transition-all ${
              isActive
                ? 'bg-white font-semibold text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
