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
      className={`inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-sm font-medium ${className}`}
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
            className={`px-3 py-1.5 rounded-md transition-all ${
              isActive
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
