import React from 'react';
import { Target, DollarSign, Percent, ShieldCheck } from 'lucide-react';
import { TargetType } from '../types';
import { FormField } from './FormField';
import { InfoTooltip } from './InfoTooltip';
import { CurrencyInput } from './common/CurrencyInput';

interface TargetSectionProps {
  targetType: TargetType;
  desiredProfit: number;
  desiredMarginPct: number;
  minAcceptableMarginPct: number;
  onChangeTargetType: (type: TargetType) => void;
  onChangeDesiredProfit: (val: number) => void;
  onChangeDesiredMarginPct: (val: number) => void;
  onChangeMinAcceptableMarginPct: (val: number) => void;
}

const PRESET_MIN_MARGINS = [10, 15, 20, 25, 30, 40, 50];

export const TargetSection: React.FC<TargetSectionProps> = ({
  targetType,
  desiredProfit,
  desiredMarginPct,
  minAcceptableMarginPct,
  onChangeTargetType,
  onChangeDesiredProfit,
  onChangeDesiredMarginPct,
  onChangeMinAcceptableMarginPct,
}) => {
  return (
    <section
      id="secao-meta"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
            Quanto você quer ganhar?
          </h2>
          <p className="text-xs text-slate-500">
            Defina sua meta por valor monetário em reais ou por margem percentual.
          </p>
        </div>
      </div>

      {/* Seletor de Opção 1 vs Opção 2 */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
        <button
          id="btn-opcao-lucro"
          type="button"
          onClick={() => onChangeTargetType('profit')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            targetType === 'profit'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-700" />
          <span>Quero ganhar R$ X por venda</span>
        </button>

        <button
          id="btn-opcao-margem"
          type="button"
          onClick={() => onChangeTargetType('margin')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            targetType === 'margin'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-4 h-4 text-emerald-700" />
          <span>Quero uma margem de X%</span>
        </button>
      </div>

      <div className="mb-6">
        {targetType === 'profit' ? (
          <div className="max-w-md">
            <FormField
              id="input-lucro-desejado"
              label="Lucro desejado em R$"
              value={desiredProfit}
              onChange={onChangeDesiredProfit}
              prefix="R$"
              step={1}
              min={0}
              placeholder="10,00"
              helperText="Valor líquido que sobra no seu bolso por item"
            />
          </div>
        ) : (
          <div className="max-w-md">
            <FormField
              id="input-margem-desejada"
              label="Margem desejada"
              value={desiredMarginPct}
              onChange={onChangeDesiredMarginPct}
              suffix="%"
              step={1}
              min={0}
              max={95}
              placeholder="20"
              helperText="Porcentagem do preço de venda destinada ao lucro"
            />
          </div>
        )}
      </div>

      {/* 8. MARGEM MÍNIMA EDITÁVEL - Muito visível e separada */}
      <div
        id="bloco-margem-minima"
        className="p-4 sm:p-5 rounded-xl bg-emerald-50/70 border border-emerald-200/80"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                Margem mínima aceitável
                <InfoTooltip
                  id="tooltip-margem-minima"
                  title="Margem mínima aceitável"
                  text="É a menor porcentagem de lucro que você aceita ter em uma venda."
                />
              </span>
              <p className="text-xs text-emerald-800/80">
                Seu limite de segurança para nunca vender no prejuízo ou abaixo da meta.
              </p>
            </div>
          </div>

          {/* Campo numérico editável */}
          <div className="w-32">
            <div className="relative flex items-center rounded-lg border border-emerald-300 bg-white shadow-xs focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600">
              <CurrencyInput
                id="input-margem-minima"
                value={minAcceptableMarginPct}
                onChange={onChangeMinAcceptableMarginPct}
                suffix="%"
                min={0}
                max={95}
                placeholder="0"
                className="w-full py-2 pl-3 pr-1 text-sm font-bold text-emerald-950 text-right bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Atalhos rápidos para seleção imediata */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-emerald-900 mr-1 select-none">
            Atalhos:
          </span>
          {PRESET_MIN_MARGINS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onChangeMinAcceptableMarginPct(pct)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                minAcceptableMarginPct === pct
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100/70'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
