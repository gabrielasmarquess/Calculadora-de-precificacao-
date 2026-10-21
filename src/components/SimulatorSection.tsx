import React, { useState } from 'react';
import { Sliders, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { PricingState } from '../types';
import {
  calculateSaleForPrice,
  formatCurrency,
  formatPercent,
  formatPoints,
} from '../utils/pricing';
import { CurrencyInput } from './common/CurrencyInput';

interface SimulatorSectionProps {
  state: PricingState;
}

export const SimulatorSection: React.FC<SimulatorSectionProps> = ({ state }) => {
  const [testPrice, setTestPrice] = useState<number>(50.0);

  const sale = calculateSaleForPrice(testPrice, state);

  // Status badge styling
  const getStatusBadge = () => {
    switch (sale.status) {
      case 'success':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          label: '✓ Dentro da meta',
        };
      case 'warning':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          label: '⚠️ Abaixo da meta',
        };
      case 'neutral':
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          label: '⚠️ Sem lucro',
        };
      case 'danger':
      default:
        return {
          bg: 'bg-red-100 text-red-900 border-red-300',
          label: '🔴 Prejuízo',
        };
    }
  };

  const statusBadge = getStatusBadge();
  const diffPoints = sale.netMarginPct - state.minAcceptableMarginPct;

  return (
    <section
      id="secao-simulador"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
              Se eu vender por…
            </h2>
            <p className="text-xs text-slate-500">
              Teste qualquer valor e veja lucro, taxas e margem instantaneamente.
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge.bg}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Input do preço teste */}
      <div className="mb-5 max-w-sm">
        <label
          htmlFor="input-simulador-preco"
          className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5"
        >
          Digite o Preço de Venda
        </label>
        <div className="relative flex items-center rounded-xl border border-emerald-400/90 bg-emerald-50/20 shadow-xs focus-within:ring-2 focus-within:ring-emerald-600">
          <CurrencyInput
            id="input-simulador-preco"
            prefix="R$"
            value={testPrice}
            onChange={setTestPrice}
            placeholder="0,00"
            className="w-full py-3 px-2 text-xl font-extrabold text-emerald-950 bg-transparent rounded-xl focus:outline-none"
          />
        </div>

        {/* Sugestões rápidas de clique */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[11px] text-slate-500 font-semibold mr-1">
            Testar:
          </span>
          {[15, 20, 30, 50, 100, 150].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTestPrice(p)}
              className={`text-xs px-2.5 py-0.5 rounded-md font-medium border transition-colors cursor-pointer ${
                testPrice === p
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              R$ {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de resultados do simulador */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Preço de venda
          </span>
          <span className="text-base font-bold text-slate-900 mt-0.5 block">
            {formatCurrency(testPrice)}
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Custos
          </span>
          <span className="text-base font-bold text-slate-800 mt-0.5 block">
            {formatCurrency(sale.totalCost)}
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Taxas
          </span>
          <span className="text-base font-bold text-amber-900 mt-0.5 block">
            {formatCurrency(sale.totalFees)}
          </span>
        </div>

        <div
          className={`p-3 rounded-xl border ${
            sale.netProfit < 0
              ? 'bg-red-50 border-red-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <span
            className={`text-[11px] font-bold block ${
              sale.netProfit < 0 ? 'text-red-900' : 'text-emerald-950'
            }`}
          >
            Lucro
          </span>
          <span
            className={`text-base font-extrabold mt-0.5 block ${
              sale.netProfit < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(sale.netProfit)}
          </span>
        </div>

        <div
          className={`p-3 rounded-xl border ${
            sale.netMarginPct < state.minAcceptableMarginPct
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <span
            className={`text-[11px] font-bold block ${
              sale.netMarginPct < state.minAcceptableMarginPct
                ? 'text-amber-950'
                : 'text-emerald-950'
            }`}
          >
            Margem
          </span>
          <span
            className={`text-base font-extrabold mt-0.5 block ${
              sale.netMarginPct < state.minAcceptableMarginPct
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            {formatPercent(sale.netMarginPct)}
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Diferença p/ Meta
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            {diffPoints > 0.001 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : diffPoints < -0.001 ? (
              <ArrowDownRight className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Minus className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`text-sm font-bold ${
                diffPoints >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatPoints(diffPoints)} p.p.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
