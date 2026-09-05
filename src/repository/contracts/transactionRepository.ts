/**
 * @file transactionRepository.ts
 * @description Abstraktes Vertrags-Interface (Port) für die Transaktions- und Papierkorb-Persistenz.
 * @module repository/contracts/transactionRepository
 */

import { Transaction } from '@/types';

/**
 * Repository-Schnittstelle für Transaktionen (aktiv & gelöscht/Papierkorb).
 * Alle Methoden sind asynchron und geben ein Promise zurück.
 */
export interface TransactionRepository {
  /**
   * Lädt alle aktiven (nicht gelöschten) Transaktionen.
   * @returns {Promise<Transaction[]>} Liste aller aktiven Buchungen
   */
  findAll(): Promise<Transaction[]>;

  /**
   * Sucht eine Transaktion anhand ihrer ID.
   * @param {string} id - Transaktions-ID
   * @returns {Promise<Transaction | null>} Gefundene Buchung oder null
   */
  findById(id: string): Promise<Transaction | null>;

  /**
   * Speichert eine einzelne Transaktion (Erstellen oder Aktualisieren).
   * @param {Transaction} transaction - Die zu speichernde Buchung
   * @returns {Promise<void>}
   */
  save(transaction: Transaction): Promise<void>;

  /**
   * Speichert mehrere Transaktionen en bloc (z. B. nach CSV-Import oder Split-Berechnung).
   * @param {Transaction[]} transactions - Die Buchungsliste
   * @returns {Promise<void>}
   */
  saveAll(transactions: Transaction[]): Promise<void>;

  /**
   * Löscht eine Transaktion dauerhaft aus dem aktiven Bestand.
   * @param {string} id - ID der zu löschenden Buchung
   * @returns {Promise<void>}
   */
  delete(id: string): Promise<void>;

  /**
   * Leert alle aktiven Transaktionen.
   * @returns {Promise<void>}
   */
  clearAll(): Promise<void>;

  /**
   * Lädt alle Transaktionen aus dem Papierkorb.
   * @returns {Promise<Transaction[]>} Gelöschte Buchungen
   */
  findDeleted(): Promise<Transaction[]>;

  /**
   * Speichert eine oder mehrere Buchungen im Papierkorb.
   * @param {Transaction[]} transactions - Die gelöschten Buchungen
   * @returns {Promise<void>}
   */
  saveDeleted(transactions: Transaction[]): Promise<void>;

  /**
   * Entfernt eine Buchung dauerhaft aus dem Papierkorb.
   * @param {string} id - ID der gelöschten Buchung
   * @returns {Promise<void>}
   */
  deleteFromTrash(id: string): Promise<void>;

  /**
   * Leert den Papierkorb vollständig.
   * @returns {Promise<void>}
   */
  clearDeleted(): Promise<void>;
}
