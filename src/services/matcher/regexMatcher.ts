/**
 * @file regexMatcher.ts
 * @description Intelligente Matching-Engine zur automatischen Zuordnung von Transaktionen
 * zu Buckets basierend auf manuellen Overrides und regulären Ausdrücken gegen das Compound Search Field.
 * @module services/matcher/regexMatcher
 */

import { Bucket, Transaction, buildCompoundSearchField, BucketAssignmentSource } from '@/types/finance';

export interface MatchResult {
  bucketId: string | null;
  assignmentSource: BucketAssignmentSource;
}

/**
 * Ermittelt alle Blatt-Buckets (Leaf Buckets), die keine untergeordneten Kinder haben.
 * Nur Blatt-Buckets dürfen Transaktionen matchen.
 */
export function getLeafBuckets(buckets: Bucket[]): Bucket[] {
  const parentIds = new Set<string>();
  buckets.forEach((b) => {
    if (b.parentId) {
      parentIds.add(b.parentId);
    }
  });

  return buckets.filter((b) => !parentIds.has(b.id));
}

/**
 * Matcht eine einzelne Transaktion gegen die definierten Buckets.
 *
 * Prioritäten:
 * 1. Manuelle Zuweisung über `bucket.manualTransactionIds`
 * 2. Bestehende manuelle Sperre (`tx.assignmentSource === 'manual'`)
 * 3. Regex-Matching des `compoundSearchField` gegen `bucket.regexPattern`
 *
 * @param {Transaction} tx - Die zu kategorisierende Transaktion
 * @param {Bucket[]} buckets - Liste aller verfügbaren Buckets
 * @returns {MatchResult} Zugeordnete Bucket-ID und Zuweisungs-Herkunft
 */
export function matchTransaction(tx: Transaction, buckets: Bucket[]): MatchResult {
  // 1. Manuelle Zuordnungen auf Bucket-Ebene prüfen
  for (const bucket of buckets) {
    if (bucket.manualTransactionIds && bucket.manualTransactionIds.includes(tx.id)) {
      return {
        bucketId: bucket.id,
        assignmentSource: 'manual',
      };
    }
  }

  // 2. Wenn Transaktion bereits manuell fixiert ist und noch ein gültiger Bucket existiert, beibehalten
  if (tx.assignmentSource === 'manual' && tx.bucketId) {
    const bucketExists = buckets.some((b) => b.id === tx.bucketId);
    if (bucketExists) {
      return {
        bucketId: tx.bucketId,
        assignmentSource: 'manual',
      };
    }
  }

  // 3. Regex-Matching nur gegen Blatt-Buckets ausführen
  const leafBuckets = getLeafBuckets(buckets);
  const compoundField = buildCompoundSearchField(tx);

  for (const bucket of leafBuckets) {
    if (!bucket.regexPattern || bucket.regexPattern.trim() === '') {
      continue;
    }

    try {
      const regex = new RegExp(bucket.regexPattern.trim(), 'i');
      if (regex.test(compoundField)) {
        return {
          bucketId: bucket.id,
          assignmentSource: 'auto_regex',
        };
      }
    } catch {
      // Ungültiges Regex-Muster ignorieren
      console.warn(`Ungültiges Regex-Pattern im Bucket ${bucket.name}: ${bucket.regexPattern}`);
    }
  }

  return {
    bucketId: null,
    assignmentSource: 'unassigned',
  };
}

/**
 * Führt ein Re-Matching für eine Liste von Transaktionen durch.
 * Aktualisiert nur automatische Zuweisungen; manuelle Zuweisungen bleiben unverändert.
 *
 * @param {Transaction[]} transactions - Vorhandene Transaktionen
 * @param {Bucket[]} buckets - Aktuelle Bucket-Konfiguration
 * @returns {Transaction[]} Transaktionen mit aktualisierten Bucket-Zuweisungen
 */
export function reMatchAllTransactions(
  transactions: Transaction[],
  buckets: Bucket[]
): Transaction[] {
  return transactions.map((tx) => {
    const match = matchTransaction(tx, buckets);
    return {
      ...tx,
      bucketId: match.bucketId,
      assignmentSource: match.assignmentSource,
    };
  });
}
