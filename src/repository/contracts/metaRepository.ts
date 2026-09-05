/**
 * @file metaRepository.ts
 * @description Abstraktes Vertrags-Interface (Port) für übergreifende Workspace-Operationen (Export, Reset).
 * @module repository/contracts/metaRepository
 */

import { ExportOptions, FinanceConfigExport, ResetOptions } from '@/types';

/**
 * Repository-Schnittstelle für systemweite Import-/Export- und Reset-Vorgänge.
 */
export interface MetaRepository {
  /**
   * Erzeugt einen Konfigurations- und Daten-Export.
   * @param {ExportOptions} options - Ausgewählte Exportbereiche
   * @returns {Promise<FinanceConfigExport>} Serialisierbares Exportobjekt
   */
  exportData(options?: ExportOptions): Promise<FinanceConfigExport>;

  /**
   * Importiert ein JSON-Backup oder eine Konfigurationsdatei.
   * @param {FinanceConfigExport} config - Das zu importierende Backup
   * @returns {Promise<void>}
   */
  importData(config: FinanceConfigExport): Promise<void>;

  /**
   * Setzt den Workspace selektiv auf Beispieldaten oder einen leeren Zustand zurück.
   * @param {ResetOptions} options - Reset-Optionen
   * @returns {Promise<void>}
   */
  resetWorkspace(options?: ResetOptions): Promise<void>;
}
