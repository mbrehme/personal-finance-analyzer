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
    const parsed = parseFloat(e.target.value);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-2.5 flex items-center pointer-events-none text-slate-400">
        <Banknote className="w-4 h-4" />
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
        className="w-full pl-8 pr-3 py-1.5 font-mono text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all placeholder:text-slate-300 placeholder:font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
};
