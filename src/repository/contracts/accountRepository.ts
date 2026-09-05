/**
 * @file accountRepository.ts
 * @description Abstraktes Vertrags-Interface (Port) für die Konten-Persistenz.
 * @module repository/contracts/accountRepository
 */

import { Account } from '@/types';

/**
 * Repository-Schnittstelle für Konten und deren Salden.
 * Alle Methoden sind asynchron und geben ein Promise zurück.
 */
export interface AccountRepository {
  /**
   * Lädt alle gespeicherten Konten.
   * @returns {Promise<Account[]>} Liste aller Konten
   */
  findAll(): Promise<Account[]>;

  /**
   * Sucht ein Konto anhand seiner eindeutigen ID.
   * @param {string} id - Die Konto-ID
   * @returns {Promise<Account | null>} Gefundenes Konto oder null
   */
  findById(id: string): Promise<Account | null>;

  /**
   * Speichert ein einzelnes Konto (Erstellen oder Aktualisieren).
   * @param {Account} account - Das zu speichernde Konto
   * @returns {Promise<void>}
   */
  save(account: Account): Promise<void>;

  /**
   * Speichert eine Liste von Konten en bloc (z. B. nach Reordering oder Reset).
   * @param {Account[]} accounts - Die Kontenliste
   * @returns {Promise<void>}
   */
  saveAll(accounts: Account[]): Promise<void>;

  /**
   * Löscht ein Konto anhand seiner ID.
   * @param {string} id - Die ID des zu löschenden Kontos
   * @returns {Promise<void>}
   */
  delete(id: string): Promise<void>;

  /**
   * Löscht alle Konten restlos.
   * @returns {Promise<void>}
   */
  clearAll(): Promise<void>;
}
