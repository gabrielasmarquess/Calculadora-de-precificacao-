import React from 'react';
import { Sparkles, DollarSign, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { SaleCalculation, PricingState } from '../types';
import { formatCurrency, formatPercent } from '../utils/pricing';
import { InfoTooltip } from './InfoTooltip';

interface ResultCardProps {
  sale: SaleCalculation;
  state: PricingState;
}

export const ResultCard: React.FC<ResultCardProps> = ({ sale, state }) => {
  if (!sale.isValid) {
    return (
      <section
        id="card-resultado-invalido"
        className="bg-red-50/80 rounded-2xl p-6 border border-red-200 text-center"
      >
        <h3 className="text-base font-bold text-red-800 mb-1">
          Ajuste as taxas para visualizar o preço ideal
        </h3>
        <p className="text-sm text-red-600">
          {sale.errorMessage || 'As taxas percentuais precisam ser menores que 100%.'}
        </p>
      </section>
    );
  }

  const targetDisplay =
    state.targetType === 'profit'
      ? formatCurrency(state.desiredProfit)
      : formatPercent(state.desiredMarginPct);

  return (
    <section id="secao-resultado-automatico" className="space-y-4">
      {/* 9. Card de Destaque: PREÇO IDEAL */}
      <div
        id="card-preco-ideal"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#043327] text-white p-6 sm:p-7 shadow-md border border-emerald-800"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border border-emerald-400/20">
              <Sparkles className="w-3 h-3" />
              Preço Ideal
            </span>
            <InfoTooltip
              id="tooltip-preco-ideal"
              title="Preço ideal"
              text="É o preço calculado para atingir a meta de lucro ou margem que você definiu."
            />
          </div>
          <span className="text-xs text-emerald-200/80 font-medium">
            Meta: {state.targetType === 'profit' ? `Lucro ${targetDisplay}` : `Margem ${targetDisplay}`}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pt-1">
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-mono">
              {formatCurrency(sale.sellingPrice)}
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 font-normal">
              Preço de venda sugerido para atingir sua meta líquida.
            </p>
          </div>

          <div className="mt-3 sm:mt-0 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold bg-white/10 px-3 py-1.5 rounded-lg w-fit backdrop-blur-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cobrirá todos os custos e taxas</span>
          </div>
        </div>
      </div>

      {/* 13. RESULTADO PRINCIPAL - Card Grande Detalhado */}
      <div
        id="card-resultado-detalhado"
        className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs"
      >
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
          <span>Detalhamento da Venda no Preço Ideal</span>
          <span className="text-xs font-semibold text-emerald-700 normal-case flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Tempo Real
          </span>
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Você vende por */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Você vende por</span>
            <span className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(sale.sellingPrice)}
            </span>
          </div>

          {/* Você paga de taxas */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 flex items-center justify-between">
              <span>Você paga de taxas</span>
              <InfoTooltip
                id="tooltip-taxas-detalhe"
                title="Taxas"
                text="São os valores que a plataforma ou outros serviços descontam da sua venda."
              />
            </span>
            <span className="text-lg sm:text-xl font-bold text-amber-900 mt-1">
              {formatCurrency(sale.totalFees)}
            </span>
          </div>

          {/* Seu custo total */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Seu custo total</span>
            <span className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
              {formatCurrency(sale.totalCost)}
            </span>
          </div>

          {/* Você ganha */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col justify-between">
            <span className="text-xs font-bold text-emerald-950 flex items-center justify-between">
              <span>Você ganha (Lucro)</span>
              <InfoTooltip
                id="tooltip-lucro-detalhe"
                title="Lucro Líquido"
                text="É o dinheiro que sobra depois de pagar o produto, as taxas e os outros custos."
              />
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
              {formatCurrency(sale.netProfit)}
            </span>
          </div>

          {/* Sua margem */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col justify-between">
            <span className="text-xs font-bold text-emerald-950 flex items-center justify-between">
              <span>Sua margem</span>
              <InfoTooltip
                id="tooltip-margem-detalhe"
                title="Margem de Lucro"
                text="É o percentual do preço de venda que representa seu lucro."
                example="Se você vende por R$ 100 e ganha R$ 25 depois dos custos, seu lucro é R$ 25 e sua margem é 25%."
              />
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
              {formatPercent(sale.netMarginPct)}
            </span>
          </div>

          {/* Sua meta */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Sua meta</span>
            <span className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
              {state.targetType === 'profit' ? (
                <>
                  {targetDisplay}{' '}
                  <span className="text-xs font-medium text-slate-500 block sm:inline">
                    ({formatPercent(sale.netMarginPct)})
                  </span>
                </>
              ) : (
                targetDisplay
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
