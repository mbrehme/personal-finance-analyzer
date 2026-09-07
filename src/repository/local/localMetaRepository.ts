/**
 * @file localMetaRepository.ts
 * @description Konkrete LocalStorage-Implementierung des MetaRepository (Export, Import, Reset).
 * @module repository/local/localMetaRepository
 */

import {
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  FinanceConfigExport,
  ResetOptions,
  DEFAULT_RESET_OPTIONS,
} from '@/types';
import { MetaRepository } from '../contracts/metaRepository';
import { LocalAccountRepository } from './localAccountRepository';
import { LocalCategoryRepository } from './localCategoryRepository';
import { LocalTransactionRepository } from './localTransactionRepository';
import seedConfiguration from '@/data/seedConfiguration.json';
import { SEED_TRANSACTIONS } from '@/data/seedTransactions';

export class LocalMetaRepository implements MetaRepository {
  constructor(
    private accountRepo = new LocalAccountRepository(),
    private categoryRepo = new LocalCategoryRepository(),
    private transactionRepo = new LocalTransactionRepository()
  ) {}

  async exportData(options: ExportOptions = DEFAULT_EXPORT_OPTIONS): Promise<FinanceConfigExport> {
    const result: FinanceConfigExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
    };

    if (options.includeAccounts) {
      result.accounts = await this.accountRepo.findAll();
    }
    if (options.includeCategories) {
      result.categories = await this.categoryRepo.findAll();
    }
    if (options.includeTransactions) {
      result.transactions = await this.transactionRepo.findAll();
    }
    if (options.includeDeletedTransactions) {
      result.deletedTransactions = await this.transactionRepo.findDeleted();
    }

    return result;
  }

  async importData(config: FinanceConfigExport): Promise<void> {
    if (config.accounts) {
      await this.accountRepo.saveAll(config.accounts);
    }
    if (config.categories) {
      await this.categoryRepo.saveAll(config.categories);
    }
    if (config.transactions) {
      await this.transactionRepo.saveAll(config.transactions);
    }
    if (config.deletedTransactions) {
      await this.transactionRepo.saveDeleted(config.deletedTransactions);
    }
  }

  async resetWorkspace(options: ResetOptions = DEFAULT_RESET_OPTIONS): Promise<void> {
    const isSeed = options.target !== 'empty';

    if (options.resetAccounts) {
      if (isSeed) {
        await this.accountRepo.saveAll(seedConfiguration.accounts as any);
      } else {
        await this.accountRepo.clearAll();
      }
    }

    if (options.resetCategories) {
      if (isSeed) {
        await this.categoryRepo.saveAll(seedConfiguration.categories as any);
      } else {
        await this.categoryRepo.clearAll();
      }
    }

    if (options.resetTransactions) {
      if (isSeed && options.includeSampleTransactions) {
        await this.transactionRepo.saveAll(SEED_TRANSACTIONS);
      } else {
        await this.transactionRepo.clearAll();
      }
    }

    if (options.resetDeletedTransactions) {
      await this.transactionRepo.clearDeleted();
    }
  }
}
