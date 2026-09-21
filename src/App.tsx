/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { PricingState, TargetType } from './types';
import {
  DEFAULT_PRICING_STATE,
  calculateIdealPrice,
  calculateSaleForPrice,
} from './utils/pricing';

import { Header } from './components/Header';
import { CostsSection } from './components/CostsSection';
import { FeesSection } from './components/FeesSection';
import { TargetSection } from './components/TargetSection';
import { ResultCard } from './components/ResultCard';
import { SaleAnalysis } from './components/SaleAnalysis';
import { MinPriceCard } from './components/MinPriceCard';
import { SimulatorSection } from './components/SimulatorSection';
import { SimulationTable } from './components/SimulationTable';
import { EducationSection } from './components/EducationSection';

export default function App() {
  const [state, setState] = useState<PricingState>(DEFAULT_PRICING_STATE);
  const resultRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 pb-16">
      {/* Toast flutuante de feedback */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Container principal estruturado rigorosamente */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
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
        <div ref={resultRef} className="pt-1">
          {/* 5. Resultado automático (Preço Ideal + Card grande detalhado) */}
          <ResultCard sale={saleResult} state={state} />
        </div>

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
      </main>
    </div>
  );
}
