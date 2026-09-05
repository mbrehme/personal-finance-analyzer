/**
 * @file categoryRepository.ts
 * @description Abstraktes Vertrags-Interface (Port) für die Kategorien-Persistenz.
 * @module repository/contracts/categoryRepository
 */

import { Category } from '@/types';

/**
 * Repository-Schnittstelle für Kategorien, Hierarchien und Match-Regeln.
 * Alle Methoden sind asynchron und geben ein Promise zurück.
 */
export interface CategoryRepository {
  /**
   * Lädt alle gespeicherten Kategorien.
   * @returns {Promise<Category[]>} Liste aller Kategorien
   */
  findAll(): Promise<Category[]>;

  /**
   * Sucht eine Kategorie anhand ihrer ID.
   * @param {string} id - Die Kategorie-ID
   * @returns {Promise<Category | null>} Gefundene Kategorie oder null
   */
  findById(id: string): Promise<Category | null>;

  /**
   * Speichert eine einzelne Kategorie (Erstellen oder Aktualisieren).
   * @param {Category} category - Die zu speichernde Kategorie
   * @returns {Promise<void>}
   */
  save(category: Category): Promise<void>;

  /**
   * Speichert eine Liste von Kategorien en bloc (z. B. nach Reordering oder Bereinigung).
   * @param {Category[]} categories - Die Kategorienliste
   * @returns {Promise<void>}
   */
  saveAll(categories: Category[]): Promise<void>;

  /**
   * Löscht eine Kategorie anhand ihrer ID.
   * @param {string} id - Die ID der zu löschenden Kategorie
   * @returns {Promise<void>}
   */
  delete(id: string): Promise<void>;

  /**
   * Löscht alle Kategorien restlos.
   * @returns {Promise<void>}
   */
  clearAll(): Promise<void>;
}
