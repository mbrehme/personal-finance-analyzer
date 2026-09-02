/**
 * @file cashflowCalculator.ts
 * @description Analyse- und Aggregations-Engine für Cashflow-Matrizen über konfigurierbare
 * Zeitperioden (Monat, Quartal, Halbjahr, Jahr) mit hierarchischem Roll-Up und Soll-Ist-Vergleich.
 * @module services/analytics/cashflowCalculator
 */

import {
  Bucket,
  PeriodGranularity,
  Transaction,
} from '@/types/finance';
import { getPeriodKey, normalizeBudgetToGranularity } from '@/utils/dateUtils';

export interface BucketPeriodCashflow {
  inbound: number;
  outbound: number;
  net: number;
  budget?: number;
  diffToBudget?: number;
}

export interface BucketCashflowRow {
  bucket: Bucket;
  depth: number;
  hasChildren: boolean;
  periods: Record<string, BucketPeriodCashflow>;
  totalInbound: number;
  totalOutbound: number;
  totalNet: number;
  totalBudget?: number;
}

export interface CashflowAnalysisResult {
  periodKeys: string[];
  rows: BucketCashflowRow[];
  totalRow: {
    periods: Record<string, BucketPeriodCashflow>;
    totalInbound: number;
    totalOutbound: number;
    totalNet: number;
  };
}

/**
 * Ermittelt alle eindeutigen, chronologisch sortierten Periodenschlüssel aus Transaktionen.
 */
export function extractPeriodKeys(
  transactions: Transaction[],
  granularity: PeriodGranularity
): string[] {
  const keys = new Set<string>();
  transactions.forEach((tx) => {
    keys.add(getPeriodKey(tx.valueDate, granularity));
  });

  return Array.from(keys).sort();
}

/**
 * Rekursive Berechnung der Bucket-Hierarchie mit Summierung der Kinderelemente.
 */
export function calculateCashflowMatrix(
  buckets: Bucket[],
  transactions: Transaction[],
  granularity: PeriodGranularity,
  selectedAccountId?: string
): CashflowAnalysisResult {
  // 1. Transaktionen nach Konto filtern (falls angegeben)
  const filteredTx = selectedAccountId
    ? transactions.filter((t) => t.accountId === selectedAccountId)
    : transactions;

  // 2. Perioden extrahieren
  const periodKeys = extractPeriodKeys(filteredTx, granularity);

  // 3. Direkte Transaktions-Summen pro Bucket und Periode berechnen
  const directSums = new Map<string, Record<string, { inbound: number; outbound: number }>>();

  buckets.forEach((b) => {
    const periodMap: Record<string, { inbound: number; outbound: number }> = {};
    periodKeys.forEach((k) => {
      periodMap[k] = { inbound: 0, outbound: 0 };
    });
    directSums.set(b.id, periodMap);
  });

  // Uncategorized Bucket für Buchungen ohne Kategorie
  const uncategorizedBucketId = '__uncategorized__';
  const uncatPeriodMap: Record<string, { inbound: number; outbound: number }> = {};
  periodKeys.forEach((k) => {
    uncatPeriodMap[k] = { inbound: 0, outbound: 0 };
  });
  directSums.set(uncategorizedBucketId, uncatPeriodMap);

  filteredTx.forEach((tx) => {
    const pKey = getPeriodKey(tx.valueDate, granularity);
    const bId = tx.bucketId || uncategorizedBucketId;
    const bucketPeriods = directSums.get(bId);

    if (bucketPeriods && bucketPeriods[pKey]) {
      if (tx.value >= 0) {
        bucketPeriods[pKey].inbound += tx.value;
      } else {
        bucketPeriods[pKey].outbound += tx.value;
      }
    }
  });

  // 4. Baumstruktur aufbauen und Summen von Kindern zu Eltern hochrollen
  const childrenMap = new Map<string | null, Bucket[]>();
  buckets.forEach((b) => {
    const list = childrenMap.get(b.parentId) || [];
    list.push(b);
    childrenMap.set(b.parentId, list);
  });

  const getSubtreeBucketIds = (bucketId: string): string[] => {
    const ids = [bucketId];
    const children = childrenMap.get(bucketId) || [];
    children.forEach((c) => {
      ids.push(...getSubtreeBucketIds(c.id));
    });
    return ids;
  };

  const rows: BucketCashflowRow[] = [];

  const processBucket = (bucket: Bucket, depth: number) => {
    const subtreeIds = getSubtreeBucketIds(bucket.id);
    const hasChildren = (childrenMap.get(bucket.id) || []).length > 0;

    const periods: Record<string, BucketPeriodCashflow> = {};
    let totalInbound = 0;
    let totalOutbound = 0;

    // Normalisiertes Budget für die Granularität berechnen
    const budgetAmount = bucket.targetBudget
      ? normalizeBudgetToGranularity(
          bucket.targetBudget.amount,
          bucket.targetBudget.period,
          granularity
        )
      : undefined;

    periodKeys.forEach((pKey) => {
      let inbound = 0;
      let outbound = 0;

      subtreeIds.forEach((id) => {
        const pData = directSums.get(id)?.[pKey];
        if (pData) {
          inbound += pData.inbound;
          outbound += pData.outbound;
        }
      });

      const net = inbound + outbound;
      totalInbound += inbound;
      totalOutbound += outbound;

      const diffToBudget =
        budgetAmount !== undefined ? Math.abs(outbound) - budgetAmount : undefined;

      periods[pKey] = {
        inbound,
        outbound,
        net,
        budget: budgetAmount,
        diffToBudget,
      };
    });

    const totalNet = totalInbound + totalOutbound;
    const totalBudget =
      budgetAmount !== undefined ? budgetAmount * periodKeys.length : undefined;

    rows.push({
      bucket,
      depth,
      hasChildren,
      periods,
      totalInbound,
      totalOutbound,
      totalNet,
      totalBudget,
    });

    // Kinder verarbeiten
    const children = childrenMap.get(bucket.id) || [];
    children.forEach((child) => processBucket(child, depth + 1));
  };

  // Top-Level Buckets (parentId === null) verarbeiten
  const rootBuckets = childrenMap.get(null) || [];
  rootBuckets.forEach((root) => processBucket(root, 0));

  // Gesamtsummenzeile (Total Row) berechnen
  const totalRowPeriods: Record<string, BucketPeriodCashflow> = {};
  let grandInbound = 0;
  let grandOutbound = 0;

  periodKeys.forEach((pKey) => {
    let inbound = 0;
    let outbound = 0;

    filteredTx.forEach((tx) => {
      if (getPeriodKey(tx.valueDate, granularity) === pKey) {
        if (tx.value >= 0) {
          inbound += tx.value;
        } else {
          outbound += tx.value;
        }
      }
    });

    grandInbound += inbound;
    grandOutbound += outbound;

    totalRowPeriods[pKey] = {
      inbound,
      outbound,
      net: inbound + outbound,
    };
  });

  return {
    periodKeys,
    rows,
    totalRow: {
      periods: totalRowPeriods,
      totalInbound: grandInbound,
      totalOutbound: grandOutbound,
      totalNet: grandInbound + grandOutbound,
    },
  };
}
