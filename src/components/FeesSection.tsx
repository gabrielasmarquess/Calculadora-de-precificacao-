import React from 'react';
import { Receipt } from 'lucide-react';
import { FormField } from './FormField';

interface FeesSectionProps {
  commissionPct: number;
  fixedFee: number;
  otherFeesPct: number;
  otherFixedFees: number;
  taxPct: number;
  onChangeCommissionPct: (val: number) => void;
  onChangeFixedFee: (val: number) => void;
  onChangeOtherFeesPct: (val: number) => void;
  onChangeOtherFixedFees: (val: number) => void;
  onChangeTaxPct: (val: number) => void;
}

export const FeesSection: React.FC<FeesSectionProps> = ({
  commissionPct,
  fixedFee,
  otherFeesPct,
  otherFixedFees,
  taxPct,
  onChangeCommissionPct,
  onChangeFixedFee,
  onChangeOtherFeesPct,
  onChangeOtherFixedFees,
  onChangeTaxPct,
}) => {
  const totalPercent = commissionPct + otherFeesPct + taxPct;
  const isOver100 = totalPercent >= 100;

  return (
    <section
      id="secao-taxas"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
              Quais taxas você paga?
            </h2>
            <p className="text-xs text-slate-500">
              Taxas cobradas pelo marketplace, gateway ou operadora.
            </p>
          </div>
        </div>

        {isOver100 ? (
          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            Taxas ≥ 100%
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline-block">
            Total percentual: {totalPercent.toFixed(1)}%
          </span>
        )}
      </div>

      {isOver100 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          ⚠️ Não é possível calcular. As taxas percentuais precisam ser menores que 100%.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          id="input-comissao"
          label="Comissão"
          value={commissionPct}
          onChange={onChangeCommissionPct}
          suffix="%"
          step={0.5}
          min={0}
          max={99.9}
          tooltipTitle="Comissão"
          tooltipText="É a porcentagem que a plataforma desconta sobre a sua venda."
          placeholder="17"
        />

        <FormField
          id="input-taxa-fixa"
          label="Taxa fixa por item"
          value={fixedFee}
          onChange={onChangeFixedFee}
          prefix="R$"
          step={0.5}
          min={0}
          tooltipTitle="Taxa fixa por item"
          tooltipText="É um valor fixo que a plataforma cobra por cada item vendido."
          placeholder="6,00"
        />

        <FormField
          id="input-outras-taxas-pct"
          label="Outras taxas"
          value={otherFeesPct}
          onChange={onChangeOtherFeesPct}
          suffix="%"
          step={0.5}
          min={0}
          max={99.9}
          tooltipTitle="Outras taxas"
          tooltipText="Outras cobranças percentuais que podem existir na plataforma."
          placeholder="0"
        />

        <FormField
          id="input-outras-taxas-fixas"
          label="Outras taxas fixas"
          value={otherFixedFees}
          onChange={onChangeOtherFixedFees}
          prefix="R$"
          step={0.5}
          min={0}
          tooltipTitle="Outras taxas fixas"
          tooltipText="Outras cobranças fixas que reduzem o valor que sobra."
          placeholder="0,00"
        />

        <FormField
          id="input-imposto"
          label="Imposto"
          value={taxPct}
          onChange={onChangeTaxPct}
          suffix="%"
          step={0.5}
          min={0}
          max={99.9}
          tooltipTitle="Imposto"
          tooltipText="Percentual destinado aos impostos sobre a venda, quando aplicável."
          placeholder="0"
        />
      </div>
    </section>
  );
};
