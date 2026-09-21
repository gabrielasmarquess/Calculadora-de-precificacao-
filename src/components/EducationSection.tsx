import React from 'react';
import { BookOpen, Lightbulb, HelpCircle, ArrowRight } from 'lucide-react';

export const EducationSection: React.FC = () => {
  return (
    <section
      id="secao-explicacoes"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-6"
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
            Entenda sua precificação
          </h2>
          <p className="text-xs text-slate-500">
            Conceitos fundamentais para dominar suas vendas e lucrar de verdade.
          </p>
        </div>
      </div>

      {/* 4 Blocos didáticos principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Custo
            </span>
            <p className="text-sm font-medium text-slate-800 leading-snug">
              “Quanto você gastou para ter o produto.”
            </p>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">
            Preço de compra + embalagem + insumos
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Taxas
            </span>
            <p className="text-sm font-medium text-slate-800 leading-snug">
              “Quanto sai da sua venda para a plataforma e outros custos.”
            </p>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">
            Comissão % + taxa fixa + impostos
          </span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block mb-1">
              Lucro
            </span>
            <p className="text-sm font-semibold text-emerald-950 leading-snug">
              “O dinheiro que realmente sobra depois de tudo.”
            </p>
          </div>
          <span className="text-[11px] text-emerald-700/80 mt-2">
            Valor em R$ que vai pro seu bolso
          </span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block mb-1">
              Margem
            </span>
            <p className="text-sm font-semibold text-emerald-950 leading-snug">
              “O percentual desse lucro em relação ao preço de venda.”
            </p>
          </div>
          <span className="text-[11px] text-emerald-700/80 mt-2">
            (Lucro líquido ÷ Preço de venda) × 100
          </span>
        </div>
      </div>

      {/* Dica de ouro destacada */}
      <div
        id="dica-lucro-margem"
        className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/90 flex items-start gap-3.5"
      >
        <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
            💡 Lucro e margem não são a mesma coisa
          </h4>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
            “Lucro é o valor em reais que sobra. Margem é esse lucro representado em porcentagem do preço de venda.”
          </p>
          <div className="mt-2 pt-2 border-t border-amber-200/60 text-xs text-amber-950/90 font-medium">
            <span className="font-bold">Exemplo prático:</span> Se você vende por{' '}
            <strong className="text-slate-900 font-bold">R$ 100</strong> e ganha{' '}
            <strong className="text-emerald-800 font-bold">R$ 25</strong> depois dos custos, seu lucro é{' '}
            <strong className="text-emerald-800 font-bold">R$ 25</strong> e sua margem é{' '}
            <strong className="text-emerald-800 font-bold">25%</strong>.
          </div>
        </div>
      </div>

      {/* Glossário Rápido com termos */}
      <div className="pt-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Termos importantes da calculadora
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
            <span className="font-bold text-slate-900 block mb-1">Preço ideal</span>
            <p className="text-slate-600 leading-relaxed">
              É o preço calculado para atingir a meta de lucro ou margem que você definiu.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
            <span className="font-bold text-slate-900 block mb-1">Preço mínimo</span>
            <p className="text-slate-600 leading-relaxed">
              É o menor preço que você pode cobrar para atingir a margem mínima escolhida.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
            <span className="font-bold text-slate-900 block mb-1">Taxas da plataforma</span>
            <p className="text-slate-600 leading-relaxed">
              São os valores que a plataforma ou outros serviços descontam da sua venda (comissão + taxa fixa).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
