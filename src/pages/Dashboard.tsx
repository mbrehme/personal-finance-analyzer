import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Plus,
  Download,
  Receipt,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { financeService, FinancialSummary, Transaction } from '@/services/api';

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sum, txs] = await Promise.all([
          financeService.getSummary(),
          financeService.getTransactions(),
        ]);
        setSummary(sum);
        setTransactions(txs);
      } catch (error) {
        console.error('Fehler beim Laden der Finanzdaten:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const categories = [
    'all',
    ...Array.from(new Set(transactions.map((t) => t.category))),
  ];

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 py-8 sm:py-10">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Finanz-Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Aktuelle Übersicht über deine Kontobewegungen und Sparziele
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
          >
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
          >
            Transaktion hinzufügen
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Gesamtvermögen
              </span>
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-slate-900">
                {formatCurrency(summary.totalBalance)}
              </span>
              <span className="ml-2 text-xs font-medium text-emerald-600">
                +4.2% Vormonat
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Einnahmen (Monat)
              </span>
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-slate-900">
                {formatCurrency(summary.monthlyIncome)}
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500">
                Reguläres Gehalt
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Ausgaben (Monat)
              </span>
              <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-slate-900">
                {formatCurrency(summary.monthlyExpenses)}
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500">
                63.1% der Einnahmen
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Sparquote
              </span>
              <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                <PiggyBank className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-slate-900">
                {summary.savingsRate}%
              </span>
              <span className="ml-2 text-xs font-medium text-purple-600">
                Ziel: 30% erreicht
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Transactions Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Letzte Transaktionen
            </h2>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Transaktion suchen..."
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 capitalize bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'Alle Kategorien' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="py-3 px-4">Beschreibung</th>
                <th className="py-3 px-4">Kategorie</th>
                <th className="py-3 px-4">Datum</th>
                <th className="py-3 px-4 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Keine Transaktionen gefunden.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {tx.description}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs sm:text-sm">
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-semibold ${
                        tx.type === 'income'
                          ? 'text-emerald-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

