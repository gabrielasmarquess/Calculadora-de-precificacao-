import React from 'react';
import { Calculator, RotateCcw, TrendingUp } from 'lucide-react';

interface HeaderProps {
  onCalculate: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onCalculate, onReset }) => {
  return (
    <header className="w-full pb-2 border-b border-emerald-900/10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-semibold tracking-wide mb-2.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ferramenta Financeira para Marketplaces</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Calculadora de Precificação
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
            Descubra quanto cobrar e veja quanto realmente sobra para você.
          </p>
          <p className="text-xs sm:text-sm text-emerald-800/90 mt-1.5 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Preencha os custos e taxas. A calculadora faz o resto automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-1 sm:pt-0">
          <button
            id="btn-calculate"
            type="button"
            onClick={onCalculate}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold rounded-xl text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Calcular</span>
          </button>
          <button
            id="btn-reset"
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            title="Restaurar valores padrão"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Limpar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
