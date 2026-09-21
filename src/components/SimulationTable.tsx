import React, { useState } from 'react';
import { Table, Plus, Trash2, RotateCcw } from 'lucide-react';
import { PricingState } from '../types';
import {
  DEFAULT_SIMULATION_PRICES,
  generateSimulationRows,
  formatCurrency,
  formatPercent,
} from '../utils/pricing';

interface SimulationTableProps {
  state: PricingState;
}

export const SimulationTable: React.FC<SimulationTableProps> = ({ state }) => {
  const [pricesList, setPricesList] = useState<number[]>(DEFAULT_SIMULATION_PRICES);
  const [newPriceInput, setNewPriceInput] = useState<string>('');
  const [showAddInput, setShowAddInput] = useState<boolean>(false);

  const handleAddPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(newPriceInput.replace(',', '.'));
    if (!isNaN(val) && val > 0 && !pricesList.includes(val)) {
      const updated = [...pricesList, val].sort((a, b) => a - b);
      setPricesList(updated);
      setNewPriceInput('');
      setShowAddInput(false);
    }
  };

  const handleRemovePrice = (priceToRemove: number) => {
    setPricesList(pricesList.filter((p) => p !== priceToRemove));
  };

  const handleResetPrices = () => {
    setPricesList(DEFAULT_SIMULATION_PRICES);
  };

  const rows = generateSimulationRows(pricesList, state);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            ✓ Dentro da meta
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            ⚠️ Abaixo da meta
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            ⚠️ Sem lucro
          </span>
        );
      case 'danger':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            🔴 Prejuízo
          </span>
        );
    }
  };

  return (
    <section
      id="secao-tabela-simulacao"
      className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#064E3B] tracking-tight">
              Tabela de Simulação de Preços
            </h2>
            <p className="text-xs text-slate-500">
              Compare a viabilidade de diferentes faixas de preço para o seu produto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showAddInput ? (
            <button
              id="btn-adicionar-preco"
              type="button"
              onClick={() => setShowAddInput(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar preço</span>
            </button>
          ) : (
            <form onSubmit={handleAddPrice} className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  id="input-novo-preco-tabela"
                  type="number"
                  step={0.5}
                  min={1}
                  placeholder="Valor"
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(e.target.value)}
                  className="w-24 pl-7 pr-2 py-1 text-xs font-bold border border-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowAddInput(false)}
                className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
            </form>
          )}

          {pricesList.length !== DEFAULT_SIMULATION_PRICES.length && (
            <button
              type="button"
              onClick={handleResetPrices}
              title="Restaurar preços originais"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabela Responsiva */}
      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
              <th className="py-3 px-4 font-bold text-slate-700">Preço</th>
              <th className="py-3 px-3 font-semibold text-slate-600">Taxas</th>
              <th className="py-3 px-3 font-semibold text-slate-600">Custo</th>
              <th className="py-3 px-3 font-semibold text-slate-600">Lucro</th>
              <th className="py-3 px-3 font-semibold text-slate-600">Margem</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Situação</th>
              <th className="py-3 px-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isProfit = row.profit > 0;
              const isLoss = row.profit < 0;

              return (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  <td className="py-2.5 px-4 font-bold text-slate-900 font-mono">
                    {formatCurrency(row.price)}
                  </td>
                  <td className="py-2.5 px-3 text-amber-900 font-medium">
                    {formatCurrency(row.fees)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {formatCurrency(row.cost)}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-bold font-mono ${
                      isLoss
                        ? 'text-red-600'
                        : isProfit
                        ? 'text-emerald-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {formatCurrency(row.profit)}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-bold ${
                      row.marginPct < state.minAcceptableMarginPct
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {formatPercent(row.marginPct)}
                  </td>
                  <td className="py-2.5 px-4">{getStatusBadge(row.status)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemovePrice(row.price)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-1"
                      title="Remover linha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Mostrando {rows.length} faixas de preço calculadas</span>
        <span className="text-[11px] text-emerald-800 font-medium">
          Margem de segurança configurada: {formatPercent(state.minAcceptableMarginPct)}
        </span>
      </div>
    </section>
  );
};
