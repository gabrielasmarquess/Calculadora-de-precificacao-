import React, { useState, useMemo, useRef } from 'react';
import { PricingState, TargetType } from '../types';
import {
  DEFAULT_PRICING_STATE,
  calculateIdealPrice,
  calculateSaleForPrice,
  formatCurrency,
} from '../utils/pricing';

import { Header } from '../components/Header';
import { CostsSection } from '../components/CostsSection';
import { FeesSection } from '../components/FeesSection';
import { TargetSection } from '../components/TargetSection';
import { ResultCard } from '../components/ResultCard';
import { SaleAnalysis } from '../components/SaleAnalysis';
import { MinPriceCard } from '../components/MinPriceCard';
import { SimulatorSection } from '../components/SimulatorSection';
import { SimulationTable } from '../components/SimulationTable';
import { EducationSection } from '../components/EducationSection';
import { PackagePlus } from 'lucide-react';
import { SaveProductFromCalcModal } from '../components/products/SaveProductFromCalcModal';
import { authService } from '../services/auth';

interface CalculatorPageProps {
  userId?: string;
  onNavigateToProducts?: () => void;
}

export const CalculatorPage: React.FC<CalculatorPageProps> = ({
  userId: propUserId,
  onNavigateToProducts,
}) => {
  const effectiveUserId = propUserId || authService.getCurrentUser()?.id || 'usr_owner_default';
  const [state, setState] = useState<PricingState>(DEFAULT_PRICING_STATE);
  const resultRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Manipuladores de estado para Custos
  const setProductCost = (val: number) =>
    setState((prev) => ({ ...prev, productCost: Math.max(0, val) }));
  const setOtherCosts = (val: number) =>
    setState((prev) => ({ ...prev, otherCosts: Math.max(0, val) }));

  // Manipuladores de estado para Taxas
  const setCommissionPct = (val: number) =>
    setState((prev) => ({ ...prev, commissionPct: Math.max(0, val) }));
  const setFixedFee = (val: number) =>
    setState((prev) => ({ ...prev, fixedFee: Math.max(0, val) }));
  const setOtherFeesPct = (val: number) =>
    setState((prev) => ({ ...prev, otherFeesPct: Math.max(0, val) }));
  const setOtherFixedFees = (val: number) =>
    setState((prev) => ({ ...prev, otherFixedFees: Math.max(0, val) }));
  const setTaxPct = (val: number) =>
    setState((prev) => ({ ...prev, taxPct: Math.max(0, val) }));

  // Manipuladores de estado para Meta
  const setTargetType = (type: TargetType) =>
    setState((prev) => ({ ...prev, targetType: type }));
  const setDesiredProfit = (val: number) =>
    setState((prev) => ({ ...prev, desiredProfit: Math.max(0, val) }));
  const setDesiredMarginPct = (val: number) =>
    setState((prev) => ({ ...prev, desiredMarginPct: Math.max(0, val) }));
  const setMinAcceptableMarginPct = (val: number) =>
    setState((prev) => ({ ...prev, minAcceptableMarginPct: Math.max(0, val) }));

  // Cálculo automático em tempo real do preço ideal e da venda
  const idealCalculation = useMemo(() => {
    return calculateIdealPrice(state);
  }, [state]);

  const saleResult = useMemo(() => {
    if (!idealCalculation.isValid) {
      return calculateSaleForPrice(0, state);
    }
    return calculateSaleForPrice(idealCalculation.idealPrice, state);
  }, [idealCalculation, state]);

  // Ação do botão "Calcular"
  const handleCalculate = () => {
    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setToastMessage('Cálculo atualizado com sucesso!');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Ação do botão "Limpar"
  const handleReset = () => {
    setState(DEFAULT_PRICING_STATE);
    setToastMessage('Valores padrão restaurados.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="text-slate-800 pb-16">
      {/* Toast flutuante de feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700">
          {toastMessage}
        </div>
      )}

      {/* Container principal estruturado rigorosamente */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 1. Cabeçalho */}
        <Header onCalculate={handleCalculate} onReset={handleReset} />

        {/* 2. Custos do produto */}
        <CostsSection
          productCost={state.productCost}
          otherCosts={state.otherCosts}
          onChangeProductCost={setProductCost}
          onChangeOtherCosts={setOtherCosts}
        />

        {/* 3. Taxas */}
        <FeesSection
          commissionPct={state.commissionPct}
          fixedFee={state.fixedFee}
          otherFeesPct={state.otherFeesPct}
          otherFixedFees={state.otherFixedFees}
          taxPct={state.taxPct}
          onChangeCommissionPct={setCommissionPct}
          onChangeFixedFee={setFixedFee}
          onChangeOtherFeesPct={setOtherFeesPct}
          onChangeOtherFixedFees={setOtherFixedFees}
          onChangeTaxPct={setTaxPct}
        />

        {/* 4. Meta de lucro/margem (com Margem mínima aceitável editável) */}
        <TargetSection
          targetType={state.targetType}
          desiredProfit={state.desiredProfit}
          desiredMarginPct={state.desiredMarginPct}
          minAcceptableMarginPct={state.minAcceptableMarginPct}
          onChangeTargetType={setTargetType}
          onChangeDesiredProfit={setDesiredProfit}
          onChangeDesiredMarginPct={setDesiredMarginPct}
          onChangeMinAcceptableMarginPct={setMinAcceptableMarginPct}
        />

        {/* Marcador de scroll para o botão Calcular */}
        <div ref={resultRef} className="pt-1 space-y-4">
          {/* 5. Resultado automático (Preço Ideal + Card grande detalhado) */}
          <ResultCard sale={saleResult} state={state} />

          {/* Ação não-invasiva: Salvar Produto no Catálogo */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#064E3B] flex items-center justify-center shrink-0">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Deseja guardar este cálculo no Catálogo de Produtos?
                </h4>
                <p className="text-[11px] text-slate-500">
                  Aproveite o custo ({formatCurrency(state.productCost)}) e o preço ideal ({formatCurrency(idealCalculation.idealPrice)}) para usar em vendas futuras.
                </p>
              </div>
            </div>
            <button
              id="btn-save-product-catalog"
              type="button"
              onClick={() => setIsSaveModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold rounded-xl text-xs shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Salvar produto no catálogo</span>
            </button>
          </div>
        </div>

        {/* Modal de Salvar Produto no Catálogo */}
        <SaveProductFromCalcModal
          userId={effectiveUserId}
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          habitualCost={state.productCost}
          otherCosts={state.otherCosts}
          referencePrice={idealCalculation.idealPrice}
          notesFromCalc={`Calculado na LucraiBR com meta de ${state.targetType === 'profit' ? formatCurrency(state.desiredProfit) + ' de lucro' : state.desiredMarginPct + '% de margem'}.`}
          onSuccessSaved={(prod) => {
            setToastMessage(`Produto "${prod.name}" salvo no catálogo com sucesso!`);
            setTimeout(() => setToastMessage(null), 3000);
          }}
          onNavigateToCatalog={onNavigateToProducts}
        />

        {/* 6. Análise da venda */}
        <SaleAnalysis sale={saleResult} />

        {/* 7. Preço necessário para atingir a meta */}
        <MinPriceCard state={state} />

        {/* 8. Simulador “Se eu vender por…” */}
        <SimulatorSection state={state} />

        {/* 9. Tabela de simulação de preços */}
        <SimulationTable state={state} />

        {/* 10. Explicações rápidas */}
        <EducationSection />
      </div>
    </div>
  );
};
