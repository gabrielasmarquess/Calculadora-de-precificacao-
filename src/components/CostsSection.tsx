import React from 'react';
import { Package } from 'lucide-react';
import { FormField } from './FormField';

interface CostsSectionProps {
  productCost: number;
  otherCosts: number;
  onChangeProductCost: (val: number) => void;
  onChangeOtherCosts: (val: number) => void;
}

export const CostsSection: React.FC<CostsSectionProps> = ({
  productCost,
  otherCosts,
  onChangeProductCost,
  onChangeOtherCosts,
}) => {
  return (
    <section
      id="secao-custos"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
          <Package className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
            Quanto esse produto me custa?
          </h2>
          <p className="text-xs text-slate-500">
            Informe os valores de aquisição e insumos unitários.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id="input-custo-produto"
          label="Custo do produto"
          value={productCost}
          onChange={onChangeProductCost}
          prefix="R$"
          step={0.5}
          min={0}
          tooltipTitle="Custo do produto"
          tooltipText="É quanto você pagou para comprar o produto."
          placeholder="0,00"
        />

        <FormField
          id="input-outros-custos"
          label="Outros custos por unidade"
          value={otherCosts}
          onChange={onChangeOtherCosts}
          prefix="R$"
          step={0.5}
          min={0}
          tooltipTitle="Outros custos por unidade"
          tooltipText="São outros gastos relacionados a cada unidade, como embalagem ou outros custos."
          placeholder="0,00"
        />
      </div>
    </section>
  );
};
