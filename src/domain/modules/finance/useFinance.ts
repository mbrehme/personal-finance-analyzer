/**
 * @file useFinance.ts
 * @description Hook zum Konsumieren des FinanceContext in UI-Komponenten.
 * @module domain/modules/finance/useFinance
 */

import { useContext } from 'react';
import { FinanceContext, FinanceContextType } from './FinanceProvider';

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
