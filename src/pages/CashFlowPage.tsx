import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  TrendingUp,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Settings,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  ordersRepo,
  purchasesRepo,
  expensesRepo,
  cashBalanceRepo,
  computeFinancialSummary,
  logsRepo,
} from '../services/db';
import { formatCurrency } from '../utils/pricing';

interface CashFlowPageProps {
  userId: string;
}

export const CashFlowPage: React.FC<CashFlowPageProps> = ({ userId }) => {
  const [initialCash, setInitialCash] = useState(() => cashBalanceRepo.get(userId));
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(false);
  const [newInitialAmount, setNewInitialAmount] = useState<number>(initialCash.amount);
  const [newInitialDate, setNewInitialDate] = useState<string>(initialCash.startDate);
  const [viewInterval, setViewInterval] = useState<'day' | 'week' | 'month'>('day');

  const orders = useMemo(() => ordersRepo.list(userId), [userId]);
  const purchases = useMemo(() => purchasesRepo.list(userId), [userId]);
  const expenses = useMemo(() => expensesRepo.list(userId), [userId]);
  const summary = useMemo(() => computeFinancialSummary(userId), [userId]);

  const handleSaveInitialCash = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      userId,
      amount: Math.max(0, newInitialAmount),
      startDate: newInitialDate,
      updatedAt: new Date().toISOString(),
    };
    cashBalanceRepo.set(updated);
    setInitialCash(updated);
    logsRepo.addLog(
      userId,
      'login',
      `Saldo inicial de caixa configurado para: ${formatCurrency(updated.amount)}`
    );
    setIsInitialModalOpen(false);
  };

  // Build daily timeline of entries and exits (Past and Future)
  const timelineEvents = useMemo(() => {
    interface TimelineEntry {
      id: string;
      date: string;
      description: string;
      type: 'inflow' | 'outflow';
      status: 'efetivo' | 'previsto';
      amount: number;
      category: string;
    }

    const events: TimelineEntry[] = [];

    // 1. Entradas de Repasses
    orders.forEach((ord) => {
      // Repasse efetivo já creditado
      if (ord.actualTransferAmount > 0 && ord.actualTransferDate) {
        events.push({
          id: `in_eff_${ord.id}`,
          date: ord.actualTransferDate,
          description: `Repasse Recebido · ${ord.orderNumber} (${ord.marketplace})`,
          type: 'inflow',
          status: 'efetivo',
          amount: ord.actualTransferAmount,
          category: 'Repasse Marketplace',
        });
      }

      // Repasse previsto pendente (sem duplicar se já recebeu parcial)
      if (ord.transferStatus === 'pendente') {
        events.push({
          id: `in_prev_${ord.id}`,
          date: ord.expectedTransferDate,
          description: `Repasse Previsto · ${ord.orderNumber} (${ord.marketplace})`,
          type: 'inflow',
          status: 'previsto',
          amount: ord.estimatedTransferAmount,
          category: 'Previsão Marketplace',
        });
      } else if (ord.transferStatus === 'recebido_parcial') {
        const remaining = Math.max(0, ord.estimatedTransferAmount - ord.actualTransferAmount);
        if (remaining > 0) {
          events.push({
            id: `in_prev_parc_${ord.id}`,
            date: ord.expectedTransferDate,
            description: `Repasse Pendente (Saldo Parcial) · ${ord.orderNumber}`,
            type: 'inflow',
            status: 'previsto',
            amount: remaining,
            category: 'Previsão Marketplace',
          });
        }
      }
    });

    // 2. Saídas de Compras de Mercadorias
    purchases.forEach((pur) => {
      pur.installments.forEach((inst) => {
        if (inst.status === 'pago') {
          events.push({
            id: `out_pur_eff_${inst.id}`,
            date: inst.paidDate || pur.purchaseDate,
            description: `Compra Mercadorias · ${pur.supplierName} (${pur.productDescription})`,
            type: 'outflow',
            status: 'efetivo',
            amount: inst.amount,
            category: 'Fornecedor',
          });
        } else {
          events.push({
            id: `out_pur_prev_${inst.id}`,
            date: inst.dueDate,
            description: `Vencimento Fornecedor · ${pur.supplierName} (Parc ${inst.installmentNumber}/${inst.totalInstallments})`,
            type: 'outflow',
            status: 'previsto',
            amount: inst.amount,
            category: 'Contas a Pagar',
          });
        }
      });
    });

    // 3. Saídas de Despesas Operacionais
    expenses.forEach((exp) => {
      if (exp.isExternalCreditCardItem) return;
      exp.installments.forEach((inst) => {
        if (inst.status === 'pago') {
          events.push({
            id: `out_exp_eff_${inst.id}`,
            date: inst.paidDate || exp.expenseDate,
            description: `Despesa Paga · ${exp.description} (${exp.category})`,
            type: 'outflow',
            status: 'efetivo',
            amount: inst.amount,
            category: exp.category,
          });
        } else {
          events.push({
            id: `out_exp_prev_${inst.id}`,
            date: inst.dueDate,
            description: `Despesa a Vencer · ${exp.description} (${exp.category})`,
            type: 'outflow',
            status: 'previsto',
            amount: inst.amount,
            category: 'Contas a Pagar',
          });
        }
      });
    });

    // Sort chronologically
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [orders, purchases, expenses]);

  // Daily running balance calculation to find exact dates of liquidity deficit
  const cashProjection = useMemo(() => {
    let runningBalance = initialCash.amount;
    const dailyMap: Record<
      string,
      {
        date: string;
        inflowsEffective: number;
        inflowsProjected: number;
        outflowsEffective: number;
        outflowsProjected: number;
        closingBalance: number;
      }
    > = {};

    timelineEvents.forEach((ev) => {
      if (!dailyMap[ev.date]) {
        dailyMap[ev.date] = {
          date: ev.date,
          inflowsEffective: 0,
          inflowsProjected: 0,
          outflowsEffective: 0,
          outflowsProjected: 0,
          closingBalance: 0,
        };
      }

      if (ev.type === 'inflow') {
        if (ev.status === 'efetivo') dailyMap[ev.date].inflowsEffective += ev.amount;
        else dailyMap[ev.date].inflowsProjected += ev.amount;
        runningBalance += ev.amount;
      } else {
        if (ev.status === 'efetivo') dailyMap[ev.date].outflowsEffective += ev.amount;
        else dailyMap[ev.date].outflowsProjected += ev.amount;
        runningBalance -= ev.amount;
      }

      dailyMap[ev.date].closingBalance = runningBalance;
    });

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [timelineEvents, initialCash]);

  // Detect first date of deficit
  const firstDeficitDay = useMemo(() => {
    return cashProjection.find((d) => d.closingBalance < 0);
  }, [cashProjection]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Initial Cash Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Fluxo de Caixa & Projeção Financeira
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Acompanhe com precisão matemática entradas e saídas efetivas vs compromissos futuros.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewInitialAmount(initialCash.amount);
            setNewInitialDate(initialCash.startDate);
            setIsInitialModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Configurar Saldo Inicial ({formatCurrency(initialCash.amount)})</span>
        </button>
      </div>

      {/* Liquidity Alert if Deficit is Found */}
      {firstDeficitDay ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-950">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-rose-900">
              Alerta de Faltante de Caixa em {firstDeficitDay.date}
            </h4>
            <p className="text-rose-800 mt-1">
              Na data {firstDeficitDay.date}, as obrigações a pagar acumuladas ultrapassam o saldo em caixa e as entradas previstas, resultando em um saldo projetado negativo de{' '}
              <strong>{formatCurrency(firstDeficitDay.closingBalance)}</strong>.
            </p>
            <p className="text-rose-700 text-[11px] mt-1">
              Recomendação: negocie o prazo de pagamento dos fornecedores ou antecipe o recebimento de repasses de marketplaces para evitar falta de liquidez.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>Fluxo de caixa saudável:</strong> O saldo projetado permanece positivo em todas as datas de vencimento previstas.
          </span>
        </div>
      )}

      {/* 4 Pillars Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Entradas Efetivamente Recebidas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(summary.confirmedTransfersAmount)}
          </p>
          <span className="text-[11px] text-slate-400">Repasses confirmados na conta</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Entradas Previstas (Futuras)</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-700 mt-1">
            {formatCurrency(summary.pendingTransfersAmount)}
          </p>
          <span className="text-[11px] text-slate-400">Repasses pendentes de liberação</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Saídas Efetivamente Pagas</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-bold font-mono text-rose-700 mt-1">
            {formatCurrency(
              summary.currentAvailableCash - initialCash.amount > 0
                ? summary.confirmedTransfersAmount - (summary.currentAvailableCash - initialCash.amount)
                : 0
            )}
          </p>
          <span className="text-[11px] text-slate-400">Mercadorias e despesas já debitadas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Saídas Previstas (A Pagar)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(summary.accountsPayableAmount)}
          </p>
          <span className="text-[11px] text-slate-400">Vencimentos e boletos cadastrados</span>
        </div>
      </div>

      {/* Projection Evolution Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Evolução Diária & Projeção do Saldo de Caixa
            </h3>
            <p className="text-xs text-slate-500">
              Posição consolidada dia a dia considerando saldo inicial de {formatCurrency(initialCash.amount)}.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Data</th>
                <th className="py-2.5 px-4 text-right">Entradas Efetivas</th>
                <th className="py-2.5 px-4 text-right">Entradas Previstas</th>
                <th className="py-2.5 px-4 text-right">Saídas Efetivas</th>
                <th className="py-2.5 px-4 text-right">Saídas Previstas</th>
                <th className="py-2.5 px-4 text-right">Saldo Final Projetado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {cashProjection.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    Nenhuma movimentação registrada no fluxo de caixa.
                  </td>
                </tr>
              ) : (
                cashProjection.map((day) => (
                  <tr
                    key={day.date}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      day.closingBalance < 0 ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {day.date}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {day.inflowsEffective > 0 ? `+${formatCurrency(day.inflowsEffective)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-700">
                      {day.inflowsProjected > 0 ? `+${formatCurrency(day.inflowsProjected)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700">
                      {day.outflowsEffective > 0 ? `-${formatCurrency(day.outflowsEffective)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-700">
                      {day.outflowsProjected > 0 ? `-${formatCurrency(day.outflowsProjected)}` : '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold text-sm ${
                        day.closingBalance < 0 ? 'text-rose-700 font-extrabold' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(day.closingBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Chronological Movements Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Linha do Tempo de Lançamentos & Vencimentos
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Todas as entradas e saídas detalhadas por evento e situação contábil.
        </p>

        <div className="divide-y divide-slate-100">
          {timelineEvents.map((ev) => (
            <div
              key={ev.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    ev.type === 'inflow'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {ev.type === 'inflow' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{ev.description}</p>
                  <p className="text-[11px] text-slate-500">
                    {ev.date} · {ev.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center sm:justify-end gap-3 font-mono">
                <span
                  className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                    ev.status === 'efetivo'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {ev.status === 'efetivo' ? 'Realizado' : 'Previsto'}
                </span>
                <span
                  className={`font-bold text-sm tabular-nums ${
                    ev.type === 'inflow' ? 'text-emerald-700' : 'text-slate-800'
                  }`}
                >
                  {ev.type === 'inflow' ? '+' : '-'}
                  {formatCurrency(ev.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Configurar Saldo Inicial */}
      {isInitialModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Configurar Saldo Inicial de Caixa
              </h3>
              <button
                type="button"
                onClick={() => setIsInitialModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInitialCash} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Saldo em Conta / Caixa Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newInitialAmount}
                  onChange={(e) => setNewInitialAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Informe o dinheiro que você já possui disponível na conta da sua empresa antes dos novos registros.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data de Início da Contabilização
                </label>
                <input
                  type="date"
                  required
                  value={newInitialDate}
                  onChange={(e) => setNewInitialDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInitialModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl font-semibold shadow-xs"
                >
                  Salvar Saldo Inicial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
