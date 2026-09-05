/**
 * @file useCategories.ts
 * @description State-Management Hook für Kategorien und Hierarchien.
 * Konsumiert ausschließlich die CategoryRepository-Schnittstelle.
 * @module domain/modules/categories/useCategories
 */

import { useState } from 'react';
import { Category } from '@/types';
import { CategoryRepository } from '@/repository';
import { sanitizeParentCategoryRules } from './categoryService';

export interface UseCategoriesResult {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  addCategory: (categoryData: Omit<Category, 'id'> | Category) => Promise<Category>;
  updateCategory: (updatedCategory: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (reorderedCategories: Category[]) => Promise<void>;
  updateCategoryRules: (categoryId: string, rules: { regexPattern?: string }) => Promise<void>;
}

export function useCategories(
  categoryRepo: CategoryRepository,
  onHierarchyOrRuleChange?: () => void
): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);

  const addCategory = async (categoryData: Omit<Category, 'id'> | Category): Promise<Category> => {
    const id =
      'id' in categoryData && categoryData.id
        ? categoryData.id
        : `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newCategory: Category = {
      ...categoryData,
      id,
    };

    let updatedList = [...categories, newCategory];
    const { categories: sanitizedList, hasChanges } = sanitizeParentCategoryRules(
      updatedList,
      newCategory.parentId
    );

    if (hasChanges) {
      await categoryRepo.saveAll(sanitizedList);
      setCategories(sanitizedList);
    } else {
      await categoryRepo.save(newCategory);
      setCategories(updatedList);
    }

    if (newCategory.regexPattern && onHierarchyOrRuleChange) {
      onHierarchyOrRuleChange();
    }

    return newCategory;
  };

  const updateCategory = async (updatedCategory: Category): Promise<void> => {
    let updatedList = categories.map((c) => (c.id === updatedCategory.id ? updatedCategory : c));

    const { categories: sanitizedList, hasChanges } = sanitizeParentCategoryRules(
      updatedList,
      updatedCategory.parentId
    );

    if (hasChanges) {
      await categoryRepo.saveAll(sanitizedList);
      setCategories(sanitizedList);
    } else {
      await categoryRepo.save(updatedCategory);
      setCategories(updatedList);
    }

    if (onHierarchyOrRuleChange) {
      onHierarchyOrRuleChange();
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    await categoryRepo.delete(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (onHierarchyOrRuleChange) {
      onHierarchyOrRuleChange();
    }
  };

  const reorderCategories = async (reorderedCategories: Category[]): Promise<void> => {
    const indexed = reorderedCategories.map((cat, index) => ({
      ...cat,
      order: index,
    }));
    await categoryRepo.saveAll(indexed);
    setCategories(indexed);
  };

  const updateCategoryRules = async (
    categoryId: string,
    rules: { regexPattern?: string }
  ): Promise<void> => {
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;

    const updatedCategory: Category = {
      ...target,
      regexPattern: rules.regexPattern !== undefined ? rules.regexPattern : target.regexPattern,
    };

    await updateCategory(updatedCategory);
  };

  return {
    categories,
    setCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    updateCategoryRules,
  };
}
