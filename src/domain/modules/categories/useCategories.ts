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
  onHierarchyOrRuleChange?: (updatedCategories: Category[]) => void | Promise<void>
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
      order: categoryData.order ?? categories.length,
    };

    const updatedList = [...categories, newCategory];
    const { categories: sanitizedList, hasChanges } = sanitizeParentCategoryRules(
      updatedList,
      newCategory.parentId
    );

    const finalList = hasChanges ? sanitizedList : updatedList;
    if (hasChanges) {
      await categoryRepo.saveAll(finalList);
    } else {
      await categoryRepo.save(newCategory);
    }
    setCategories(finalList);

    if (onHierarchyOrRuleChange) {
      await onHierarchyOrRuleChange(finalList);
    }

    return newCategory;
  };

  const updateCategory = async (updatedCategory: Category): Promise<void> => {
    const hasChildren = categories.some((c) => c.parentId === updatedCategory.id);
    const sanitizedUpdated = hasChildren
      ? { ...updatedCategory, regexPattern: undefined }
      : updatedCategory;

    const updatedList = categories.map((c) =>
      c.id === sanitizedUpdated.id ? sanitizedUpdated : c
    );

    const { categories: sanitizedList, hasChanges } = sanitizeParentCategoryRules(
      updatedList,
      sanitizedUpdated.parentId
    );

    const finalList = hasChanges ? sanitizedList : updatedList;
    if (hasChanges) {
      await categoryRepo.saveAll(finalList);
    } else {
      await categoryRepo.save(sanitizedUpdated);
    }
    setCategories(finalList);

    if (onHierarchyOrRuleChange) {
      await onHierarchyOrRuleChange(finalList);
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    await categoryRepo.delete(id);
    const remaining = categories.filter((c) => c.id !== id);
    setCategories(remaining);

    if (onHierarchyOrRuleChange) {
      await onHierarchyOrRuleChange(remaining);
    }
  };

  const reorderCategories = async (reorderedCategories: Category[]): Promise<void> => {
    const parentIdsWithChildren = new Set(
      reorderedCategories.map((c) => c.parentId).filter(Boolean) as string[]
    );
    const sanitized = reorderedCategories.map((cat, index) => ({
      ...cat,
      order: cat.order ?? index,
      ...(parentIdsWithChildren.has(cat.id) && cat.regexPattern ? { regexPattern: undefined } : {}),
    }));
    await categoryRepo.saveAll(sanitized);
    setCategories(sanitized);

    if (onHierarchyOrRuleChange) {
      await onHierarchyOrRuleChange(sanitized);
    }
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
