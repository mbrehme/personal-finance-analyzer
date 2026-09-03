/**
 * @file MoneyInput.tsx
 * @description Wiederverwendbares Eingabefeld für Geldbeträge mit Banknoten-Icon
 * und optimierter numerischer Tastatur- und Tastatureingabe.
 * @module components/MoneyInput
 */

import React from 'react';
import { Banknote } from 'lucide-react';

export interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  step = '0.01',
  min,
  max,
  className = '',
  disabled = false,
  required = false,
  autoFocus = false,
  id,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    const parsed = parseFloat(raw);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="pointer-events-none absolute left-2.5 flex items-center text-slate-400">
        <Banknote className="h-4 w-4" />
      </div>
      <input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value === 0 ? '' : value}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 font-mono text-sm font-semibold text-slate-900 shadow-sm transition-all [appearance:textfield] placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
};
