import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { SaleCalculation } from '../types';

interface SaleAnalysisProps {
  sale: SaleCalculation;
}

export const SaleAnalysis: React.FC<SaleAnalysisProps> = ({ sale }) => {
  if (!sale.isValid) {
    return null;
  }

  // Configuração visual baseada no status
  const getStatusStyles = () => {
    switch (sale.status) {
      case 'success':
        return {
          container: 'bg-emerald-50/90 border-emerald-300 text-emerald-950',
          badge: 'bg-emerald-700 text-white',
          title: 'text-[#064E3B]',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />,
        };
      case 'warning':
        return {
          container: 'bg-amber-50/90 border-amber-300 text-amber-950',
          badge: 'bg-amber-600 text-white',
          title: 'text-amber-900',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
        };
      case 'neutral':
        return {
          container: 'bg-slate-100 border-slate-300 text-slate-900',
          badge: 'bg-slate-600 text-white',
          title: 'text-slate-800',
          icon: <AlertTriangle className="w-5 h-5 text-slate-600 shrink-0" />,
        };
      case 'danger':
      default:
        return {
          container: 'bg-red-50/90 border-red-300 text-red-950',
          badge: 'bg-red-600 text-white',
          title: 'text-red-900',
          icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <section
      id="secao-analise-venda"
      className={`rounded-2xl p-5 sm:p-6 border ${styles.container} transition-colors shadow-xs`}
    >
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="space-y-1 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className={`text-base font-bold tracking-tight ${styles.title}`}>
              {sale.statusTitle}
            </h3>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${styles.badge}`}
            >
              {sale.status === 'success'
                ? 'Meta Atingida'
                : sale.status === 'warning'
                ? 'Atenção'
                : sale.status === 'neutral'
                ? 'Empate'
                : 'Prejuízo'}
            </span>
          </div>

          <p className="text-sm font-medium leading-relaxed">
            {sale.statusDescription}
          </p>

          {sale.statusDetail && (
            <p className="text-xs font-semibold opacity-90 pt-0.5">
              {sale.statusDetail}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
