/**
 * @file localCategoryRepository.ts
 * @description Konkrete LocalStorage-Implementierung des CategoryRepository.
 * @module repository/local/localCategoryRepository
 */

import { Category } from '@/types';
import { CategoryRepository } from '../contracts/categoryRepository';
import { STORAGE_KEYS } from './storageKeys';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storageUtils';

export class LocalCategoryRepository implements CategoryRepository {
  async findAll(): Promise<Category[]> {
    return safeGetItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  }

  async findById(id: string): Promise<Category | null> {
    const list = await this.findAll();
    return list.find((c) => c.id === id) || null;
  }

  async save(category: Category): Promise<void> {
    const list = await this.findAll();
    const idx = list.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      list[idx] = category;
    } else {
      list.push(category);
    }
    safeSetItem(STORAGE_KEYS.CATEGORIES, list);
  }

  async saveAll(categories: Category[]): Promise<void> {
    safeSetItem(STORAGE_KEYS.CATEGORIES, categories);
  }

  async delete(id: string): Promise<void> {
    const list = await this.findAll();
    const filtered = list.filter((c) => c.id !== id);
    safeSetItem(STORAGE_KEYS.CATEGORIES, filtered);
  }

  async clearAll(): Promise<void> {
    safeRemoveItem(STORAGE_KEYS.CATEGORIES);
  }
}
