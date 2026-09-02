import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShieldCheck,
  PieChart,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/Button';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-16 py-8 sm:py-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-500/10 via-slate-50 to-transparent p-8 sm:p-14 border border-emerald-100">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-semibold text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" />
            Modernes Finanz-Dashboard
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
            Behalte deine Finanzen stets <span className="text-emerald-600">im Überblick</span>.
          </h1>

          <p className="text-lg text-slate-600 sm:text-xl leading-relaxed">
            Ein schlankes, modulares React- und TypeScript-Frontend zur Analyse deiner Einnahmen,
            Ausgaben und Sparziele. Ohne unnötigen Ballast, sofort einsatzbereit.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/dashboard')}
              icon={<ArrowRight className="h-5 w-5" />}
            >
              Zum Dashboard
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open('https://tailwindcss.com', '_blank')}
            >
              Tailwind CSS Docs
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Vollständig modular aufgebaut
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
            Klare Trennung zwischen UI-Komponenten, Seiten und API-Services mit TypeScript Typisierung.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-4">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Echtzeit-Übersicht</h3>
            <p className="mt-2 text-sm text-slate-600">
              Visualisiere deine Kontostände, monatlichen Einnahmen und Ausgaben auf einen Blick.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <PieChart className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Kategorisierte Budgets</h3>
            <p className="mt-2 text-sm text-slate-600">
              Strukturierte Zuordnung von Transaktionen nach Wohnen, Lebensmittel, Investitionen und mehr.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Typensicher & Schnell</h3>
            <p className="mt-2 text-sm text-slate-600">
              Blitzschnelle Vite HMR Entwicklungsumgebung mit vollständiger TypeScript-Absicherung.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack Summary */}
      <section className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Setup-Konfiguration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span><strong>Vite + React 18</strong> mit TypeScript</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span><strong>Tailwind CSS</strong> inkl. PostCSS & Autoprefixer</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span><strong>react-router-dom</strong> Client-Side Routing</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span><strong>@/* Path Alias</strong> konfiguriert für saubere Imports</span>
          </div>
        </div>
      </section>
    </div>
  );
};

