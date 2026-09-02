import { describe, it, expect } from 'vitest';
import { financeService } from './api';

describe('financeService', () => {
  it('should return financial summary with positive balance', async () => {
    const summary = await financeService.getSummary();
    expect(summary).toBeDefined();
    expect(summary.totalBalance).toBeGreaterThan(0);
    expect(summary.savingsRate).toBe(36.9);
  });

  it('should return transaction list with items', async () => {
    const transactions = await financeService.getTransactions();
    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]).toHaveProperty('id');
    expect(transactions[0]).toHaveProperty('description');
    expect(transactions[0]).toHaveProperty('amount');
    expect(transactions[0]).toHaveProperty('type');
  });
});

