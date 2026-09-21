import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { PricingState } from '../types';
import { calculateMinRequiredPrice, formatCurrency, formatPercent } from '../utils/pricing';
import { InfoTooltip } from './InfoTooltip';

interface MinPriceCardProps {
  state: PricingState;
}

export const MinPriceCard: React.FC<MinPriceCardProps> = ({ state }) => {
  const result = calculateMinRequiredPrice(state);

  return (
    <section
      id="card-preco-minimo"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-emerald-200/90 shadow-xs relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

      <div className="relative">
        <div className="flex items-center gap-2 text-emerald-900 mb-1">
          <ShieldAlert className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Preço Mínimo de Segurança
          </span>
          <InfoTooltip
            id="tooltip-preco-minimo-card"
            title="Preço mínimo"
            text="É o menor preço que você pode cobrar para atingir a margem mínima escolhida."
          />
        </div>

        <h3 className="text-base sm:text-lg font-extrabold text-[#064E3B] tracking-tight">
          Para atingir sua margem mínima de {formatPercent(state.minAcceptableMarginPct)}
        </h3>

        {result.isValid ? (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium text-slate-600">
              Você precisa vender por aproximadamente:
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
              {formatCurrency(result.minPrice)}
            </span>
          </div>
        ) : (
          <p className="text-xs font-semibold text-red-600 mt-2">
            {result.errorMessage || 'Valores de taxas impedem o cálculo.'}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
          <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            Vendendo abaixo desse valor, sua margem ficará abaixo da meta definida.
          </span>
        </div>
      </div>
    </section>
  );
};
