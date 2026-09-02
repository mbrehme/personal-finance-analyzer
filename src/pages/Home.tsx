/**
 * @file Home.tsx
 * @description Startseite der Personal Finance Analyzer Anwendung mit Modul-Übersicht
 * und Schnellzugriff auf Konfiguration, Buchungen, Cashflow und Salden.
 * @module pages/Home
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Layers,
  Receipt,
  TrendingUp,
  Wallet,
  ArrowRight,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/Button';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-12 py-8 sm:py-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-600/10 via-slate-50 to-transparent p-8 sm:p-14 border border-blue-100">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-semibold text-blue-800">
            <Lock className="h-3.5 w-3.5 text-blue-700" />
            100% Local-First & Datenschutzkonform
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
            Deine Finanzen analysieren. <br />
            <span className="text-blue-600">Ohne Cloud. Sicher im Browser.</span>
          </h1>

          <p className="text-lg text-slate-600 sm:text-xl leading-relaxed">
            Importiere Bankumsätze, erstelle intelligente Regex-Kategorien mit Soll-Budgets
            und verfolge deine Cashflows und Kontostände in Echtzeit – vollständig lokal.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/cashflow')}
              icon={<ArrowRight className="h-5 w-5" />}
            >
              Zur Cashflow-Matrix
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/configuration')}
            >
              Konfiguration öffnen
            </Button>
          </div>
        </div>
      </section>

      {/* Die 4 Kern-Module */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Die Kernbereiche des Analyzers
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
            Vier aufeinander abgestimmte Ansichten für die vollständige Kontrolle deiner Finanzen.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Modul 1: Configuration */}
          <div
            onClick={() => navigate('/configuration')}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4 group-hover:scale-110 transition-transform">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Konfiguration</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Verwalte hierarchische Buckets mit Regex-Regeln, Soll-Budgets und verknüpften Konten.
            </p>
          </div>

          {/* Modul 2: Transactions */}
          <div
            onClick={() => navigate('/transactions')}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
              <Receipt className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Buchungen & CSV</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              CSV-Upload mit Spalten-Mapping, automatisches Regex-Matching und manuelle Zuweisung.
            </p>
          </div>

          {/* Modul 3: Cashflow */}
          <div
            onClick={() => navigate('/cashflow')}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Cashflow-Matrix</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Hierarchische Matrix über Monate, Quartale & Jahre mit direktem Soll-Ist-Abgleich.
            </p>
          </div>

          {/* Modul 4: Balances */}
          <div
            onClick={() => navigate('/balances')}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 mb-4 group-hover:scale-110 transition-transform">
              <Wallet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">4. Saldenverlauf</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Historische Kontostand-Rekonstruktion aus Stichtags-Salden und Transaktions-Cashflows.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Architecture Highlights */}
      <section className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">Datenschutz & Architektur</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span><strong>100% Client-Side:</strong> Keine Daten verlassen jemals deinen Rechner.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span><strong>IndexedDB Speicher:</strong> Lokale Persistenz für tausende Buchungen.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span><strong>JSON Backup & Sync:</strong> Portabler Export deiner gesamten Konfiguration.</span>
          </div>
        </div>
      </section>
    </div>
  );
};
