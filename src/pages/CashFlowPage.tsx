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
  CreditCard,
  Package,
  Receipt,
  Filter,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import {
  ordersRepo,
  purchasesRepo,
  expensesRepo,
  cashBalanceRepo,
  computeFinancialSummary,
  logsRepo,
} from '../services/db';
import { formatCurrency, formatPercent, roundCents } from '../utils/pricing';
import { CurrencyInput } from '../components/common/CurrencyInput';

interface CashFlowPageProps {
  userId: string;
}

type PeriodFilterType = 'hoje' | 'semana' | 'mes' | 'personalizado';

export const CashFlowPage: React.FC<CashFlowPageProps> = ({ userId }) => {
  const [initialCash, setInitialCash] = useState(() => cashBalanceRepo.get(userId));
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(false);
  const [newInitialAmount, setNewInitialAmount] = useState<number>(initialCash.amount);
  const [newInitialDate, setNewInitialDate] = useState<string>(initialCash.startDate);

  // Period filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('mes');
  
  // Custom date range default to current month
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }, []);
  const [customStartDate, setCustomStartDate] = useState<string>(currentMonthStart);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Table filter tabs
  const [tableTypeFilter, setTableTypeFilter] = useState<'all' | 'inflow' | 'outflow' | 'efetivo' | 'previsto'>('all');

  // Repositories data
  const orders = useMemo(() => ordersRepo.list(userId), [userId]);
  const purchases = useMemo(() => purchasesRepo.list(userId), [userId]);
  const expenses = useMemo(() => expensesRepo.list(userId), [userId]);

  // Compute active date range based on selected filter
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (periodFilter === 'hoje') {
      return { startDate: today, endDate: today };
    }

    if (periodFilter === 'semana') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
      return { startDate: monday, endDate: today };
    }

    if (periodFilter === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { startDate: startOfMonth, endDate: endOfMonth };
    }

    // Personalizado
    return {
      startDate: customStartDate || '2000-01-01',
      endDate: customEndDate || '2099-12-31',
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // --- REESTRUTURAÇÃO DOS INDICADORES FINANCEIROS NO PERÍODO ---
  const periodMetrics = useMemo(() => {
    // 1. FATURAMENTO BRUTO: Vendas realizadas no período (excluindo canceladas)
    let faturamentoBruto = 0;
    let cmvPeriodo = 0;
    let repasseLiquidoRecebido = 0;
    let repasseLiquidoPrevisto = 0;

    orders.forEach((ord) => {
      if (ord.logisticStatus === 'pedido_cancelado') return;

      const orderInPeriod = ord.saleDate >= startDate && ord.saleDate <= endDate;

      if (orderInPeriod) {
        faturamentoBruto += ord.grossAmount;
        // Custo das Mercadorias Vendidas (CMV) dos pedidos do período
        ord.items.forEach((item) => {
          cmvPeriodo += item.totalCost;
        });
      }

      // Repasses recebidos (contabilizados pela data efetiva de recebimento se no período)
      if (ord.actualTransferAmount > 0 && ord.actualTransferDate) {
        if (ord.actualTransferDate >= startDate && ord.actualTransferDate <= endDate) {
          repasseLiquidoRecebido += ord.actualTransferAmount;
        }
      } else if (orderInPeriod && ord.actualTransferAmount > 0) {
        // Fallback para pedidos do período com valor creditado
        repasseLiquidoRecebido += ord.actualTransferAmount;
      }

      // Repasses previstos pendentes deste período
      if (orderInPeriod) {
        if (ord.transferStatus === 'pendente') {
          repasseLiquidoPrevisto += ord.estimatedTransferAmount;
        } else if (ord.transferStatus === 'recebido_parcial') {
          repasseLiquidoPrevisto += Math.max(0, ord.estimatedTransferAmount - ord.actualTransferAmount);
        }
      }
    });

    // 2. TOTAL INVESTIDO EM MERCADORIAS (Aquisição de estoque/reposição no período)
    // Diferenciado estritamente do CMV das vendas!
    let totalInvestidoMercadorias = 0;
    let totalInvestidoMercadoriasPago = 0;
    let totalInvestidoMercadoriasPendente = 0;

    purchases.forEach((pur) => {
      const purchaseInPeriod = pur.purchaseDate >= startDate && pur.purchaseDate <= endDate;
      if (purchaseInPeriod) {
        totalInvestidoMercadorias += pur.totalCost;
      }

      pur.installments.forEach((inst) => {
        const instDate = inst.status === 'pago' ? (inst.paidDate || pur.purchaseDate) : inst.dueDate;
        if (instDate >= startDate && instDate <= endDate) {
          if (inst.status === 'pago') {
            totalInvestidoMercadoriasPago += inst.amount;
          } else {
            totalInvestidoMercadoriasPendente += inst.amount;
          }
        }
      });
    });

    // 3. DESPESAS E GASTOS (Consultando a aba existente "Despesas e Gastos")
    // Respeita datas, categorias, valores e status de pagamento existentes sem duplicação
    let despesasTotal = 0;
    let despesasPagas = 0;
    let despesasPendentes = 0;

    expenses.forEach((exp) => {
      // Ignorar itens pessoais de cartão externo
      if (exp.isExternalCreditCardItem) return;

      const expenseInPeriod = exp.expenseDate >= startDate && exp.expenseDate <= endDate;
      if (expenseInPeriod) {
        despesasTotal += exp.amount;
      }

      exp.installments.forEach((inst) => {
        const instDate = inst.status === 'pago' ? (inst.paidDate || exp.expenseDate) : (inst.dueDate || exp.expenseDate);
        if (instDate >= startDate && instDate <= endDate) {
          if (inst.status === 'pago') {
            despesasPagas += inst.amount;
          } else {
            despesasPendentes += inst.amount;
          }
        }
      });
    });

    // 4. LUCRO REAL (Regra estrita):
    // Lucro real = repasse líquido das vendas − custo das mercadorias vendidas − despesas operacionais da aba existente
    // Despesas operacionais consideradas: as pagas/efetivadas no período (ou o total apurado de despesas operacionais)
    const despesasParaLucro = despesasPagas > 0 ? despesasPagas : despesasTotal;
    const lucroReal = repasseLiquidoRecebido - cmvPeriodo - despesasParaLucro;

    // Margem de Lucro Real em %
    const margemLucroReal = faturamentoBruto > 0 ? (lucroReal / faturamentoBruto) * 100 : 0;

    // Lucro Projetado (considerando repasses previstos e todas as despesas)
    const totalRepassesEsperados = repasseLiquidoRecebido + repasseLiquidoPrevisto;
    const lucroProjetado = totalRepassesEsperados - cmvPeriodo - despesasTotal;
    const margemProjetada = faturamentoBruto > 0 ? (lucroProjetado / faturamentoBruto) * 100 : 0;

    return {
      faturamentoBruto: roundCents(faturamentoBruto),
      repasseLiquidoRecebido: roundCents(repasseLiquidoRecebido),
      repasseLiquidoPrevisto: roundCents(repasseLiquidoPrevisto),
      totalInvestidoMercadorias: roundCents(totalInvestidoMercadorias),
      totalInvestidoMercadoriasPago: roundCents(totalInvestidoMercadoriasPago),
      totalInvestidoMercadoriasPendente: roundCents(totalInvestidoMercadoriasPendente),
      cmvPeriodo: roundCents(cmvPeriodo),
      despesasTotal: roundCents(despesasTotal),
      despesasPagas: roundCents(despesasPagas),
      despesasPendentes: roundCents(despesasPendentes),
      lucroReal: roundCents(lucroReal),
      margemLucroReal: Math.round(margemLucroReal * 100) / 100,
      lucroProjetado: roundCents(lucroProjetado),
      margemProjetada: Math.round(margemProjetada * 100) / 100,
    };
  }, [orders, purchases, expenses, startDate, endDate]);

  // Handle Initial Cash Saving
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
  interface TimelineEntry {
    id: string;
    date: string;
    description: string;
    type: 'inflow' | 'outflow';
    status: 'efetivo' | 'previsto';
    amount: number;
    category: string;
    origin: string; // Origem do lançamento
  }

  const timelineEvents = useMemo(() => {
    const events: TimelineEntry[] = [];

    // 1. Entradas de Repasses
    orders.forEach((ord) => {
      if (ord.logisticStatus === 'pedido_cancelado') return;

      // Repasse efetivo já creditado
      if (ord.actualTransferAmount > 0 && ord.actualTransferDate) {
        events.push({
          id: `in_eff_${ord.id}`,
          date: ord.actualTransferDate,
          description: `Repasse Recebido · Pedido ${ord.orderNumber} (${ord.marketplace})`,
          type: 'inflow',
          status: 'efetivo',
          amount: ord.actualTransferAmount,
          category: 'Repasse Marketplace',
          origin: `Pedido ${ord.orderNumber} (${ord.marketplace})`,
        });
      }

      // Repasse previsto pendente
      if (ord.transferStatus === 'pendente') {
        events.push({
          id: `in_prev_${ord.id}`,
          date: ord.expectedTransferDate,
          description: `Repasse Previsto · Pedido ${ord.orderNumber} (${ord.marketplace})`,
          type: 'inflow',
          status: 'previsto',
          amount: ord.estimatedTransferAmount,
          category: 'Previsão Marketplace',
          origin: `Vendas e Pedidos (${ord.orderNumber})`,
        });
      } else if (ord.transferStatus === 'recebido_parcial') {
        const remaining = Math.max(0, ord.estimatedTransferAmount - ord.actualTransferAmount);
        if (remaining > 0) {
          events.push({
            id: `in_prev_parc_${ord.id}`,
            date: ord.expectedTransferDate,
            description: `Repasse Pendente (Saldo Parcial) · Pedido ${ord.orderNumber}`,
            type: 'inflow',
            status: 'previsto',
            amount: remaining,
            category: 'Previsão Marketplace',
            origin: `Vendas e Pedidos (${ord.orderNumber})`,
          });
        }
      }
    });

    // 2. Saídas de Compras de Mercadorias (Investimento em estoque)
    purchases.forEach((pur) => {
      pur.installments.forEach((inst) => {
        if (inst.status === 'pago') {
          events.push({
            id: `out_pur_eff_${inst.id}`,
            date: inst.paidDate || pur.purchaseDate,
            description: `Investimento em Estoque · ${pur.supplierName} (${pur.productDescription})`,
            type: 'outflow',
            status: 'efetivo',
            amount: inst.amount,
            category: 'Compra de Mercadorias',
            origin: `Fornecedor: ${pur.supplierName}`,
          });
        } else {
          events.push({
            id: `out_pur_prev_${inst.id}`,
            date: inst.dueDate,
            description: `Vencimento Fornecedor · ${pur.supplierName} (${inst.installmentNumber}/${inst.totalInstallments})`,
            type: 'outflow',
            status: 'previsto',
            amount: inst.amount,
            category: 'Contas a Pagar Fornecedor',
            origin: `Compras e Fornecedores`,
          });
        }
      });
    });

    // 3. Saídas de Despesas e Gastos (Diretamente da aba existente)
    expenses.forEach((exp) => {
      if (exp.isExternalCreditCardItem) return;
      exp.installments.forEach((inst) => {
        if (inst.status === 'pago') {
          events.push({
            id: `out_exp_eff_${inst.id}`,
            date: inst.paidDate || exp.expenseDate,
            description: `Despesa Operacional Paga · ${exp.description}`,
            type: 'outflow',
            status: 'efetivo',
            amount: inst.amount,
            category: exp.category,
            origin: `Aba Despesas e Gastos`,
          });
        } else {
          events.push({
            id: `out_exp_prev_${inst.id}`,
            date: inst.dueDate || exp.expenseDate,
            description: `Despesa a Vencer · ${exp.description}`,
            type: 'outflow',
            status: 'previsto',
            amount: inst.amount,
            category: exp.category,
            origin: `Aba Despesas e Gastos`,
          });
        }
      });
    });

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [orders, purchases, expenses]);

  // Filtered timeline for table and running balance
  const filteredEventsWithRunningBalance = useMemo(() => {
    let runningBalance = initialCash.amount;

    const withBalance = timelineEvents.map((ev) => {
      if (ev.type === 'inflow') {
        runningBalance += ev.amount;
      } else {
        runningBalance -= ev.amount;
      }
      return {
        ...ev,
        runningBalance: roundCents(runningBalance),
      };
    });

    // Apply period filter
    const periodFiltered = withBalance.filter((ev) => ev.date >= startDate && ev.date <= endDate);

    // Apply table tab filter
    if (tableTypeFilter === 'all') return periodFiltered;
    if (tableTypeFilter === 'inflow') return periodFiltered.filter((e) => e.type === 'inflow');
    if (tableTypeFilter === 'outflow') return periodFiltered.filter((e) => e.type === 'outflow');
    if (tableTypeFilter === 'efetivo') return periodFiltered.filter((e) => e.status === 'efetivo');
    if (tableTypeFilter === 'previsto') return periodFiltered.filter((e) => e.status === 'previsto');
    return periodFiltered;
  }, [timelineEvents, initialCash, startDate, endDate, tableTypeFilter]);

  // Chart data: daily grouping of Faturamento Bruto vs Lucro Real
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { date: string; faturamento: number; repasse: number; cmv: number; despesas: number }> = {};

    orders.forEach((ord) => {
      if (ord.logisticStatus === 'pedido_cancelado') return;
      if (ord.saleDate >= startDate && ord.saleDate <= endDate) {
        if (!dailyMap[ord.saleDate]) {
          dailyMap[ord.saleDate] = { date: ord.saleDate, faturamento: 0, repasse: 0, cmv: 0, despesas: 0 };
        }
        dailyMap[ord.saleDate].faturamento += ord.grossAmount;
        ord.items.forEach((it) => {
          dailyMap[ord.saleDate].cmv += it.totalCost;
        });
        dailyMap[ord.saleDate].repasse += ord.actualTransferAmount > 0 ? ord.actualTransferAmount : ord.estimatedTransferAmount;
      }
    });

    expenses.forEach((exp) => {
      if (exp.isExternalCreditCardItem) return;
      if (exp.expenseDate >= startDate && exp.expenseDate <= endDate) {
        if (!dailyMap[exp.expenseDate]) {
          dailyMap[exp.expenseDate] = { date: exp.expenseDate, faturamento: 0, repasse: 0, cmv: 0, despesas: 0 };
        }
        dailyMap[exp.expenseDate].despesas += exp.amount;
      }
    });

    const list = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return list.map((item) => {
      const lucro = item.repasse - item.cmv - item.despesas;
      return {
        date: item.date,
        faturamento: roundCents(item.faturamento),
        lucroReal: roundCents(lucro),
      };
    });
  }, [orders, expenses, startDate, endDate]);

  const maxChartVal = useMemo(() => {
    if (chartData.length === 0) return 100;
    const maxFat = Math.max(...chartData.map((d) => d.faturamento), 0);
    const maxLucro = Math.max(...chartData.map((d) => Math.abs(d.lucroReal)), 0);
    return Math.max(maxFat, maxLucro, 50);
  }, [chartData]);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Period Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Fluxo de Caixa & Painel Financeiro
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Demonstração financeira integrada: faturamento bruto, investimentos em estoque, repasses líquidos, despesas e lucro real.
          </p>
        </div>

        {/* Action button to configure initial cash */}
        <button
          type="button"
          onClick={() => {
            setNewInitialAmount(initialCash.amount);
            setNewInitialDate(initialCash.startDate);
            setIsInitialModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs shadow-2xs transition-all cursor-pointer self-start md:self-auto"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          <span>Saldo Inicial ({formatCurrency(initialCash.amount)})</span>
        </button>
      </div>

      {/* 2. Period Filter Selector Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-700" />
          <span className="font-bold text-slate-700">Filtrar por Período:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['hoje', 'semana', 'mes', 'personalizado'] as PeriodFilterType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPeriodFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === tab
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'hoje' && 'Dia (Hoje)'}
              {tab === 'semana' && 'Semana'}
              {tab === 'mes' && 'Mês'}
              {tab === 'personalizado' && 'Personalizado'}
            </button>
          ))}
        </div>

        {periodFilter === 'personalizado' && (
          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="text-slate-500 font-medium">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
            />
            <span className="text-slate-500 font-medium">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
            />
          </div>
        )}
      </div>

      {/* 3. OS 7 CARTÕES OBRIGATÓRIOS DO PAINEL FINANCEIRO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Cartão 1: Faturamento Bruto */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">Faturamento Bruto</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-slate-900 tracking-tight block">
              {formatCurrency(periodMetrics.faturamentoBruto)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Total das vendas antes de taxas ou deduções
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            Exclui cancelamentos e devoluções
          </div>
        </div>

        {/* Cartão 2: Repasse Líquido Recebido */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">Repasses Recebidos</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-emerald-700 tracking-tight block">
              {formatCurrency(periodMetrics.repasseLiquidoRecebido)}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-emerald-800 font-semibold">
                Efetivamente creditado
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>Previsto pendente:</span>
            <span className="font-mono font-bold text-blue-700">
              {formatCurrency(periodMetrics.repasseLiquidoPrevisto)}
            </span>
          </div>
        </div>

        {/* Cartão 3: Total Investido em Mercadorias */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">Total Investido em Mercadorias</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-blue-800 tracking-tight block">
              {formatCurrency(periodMetrics.totalInvestidoMercadorias)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Compras e reposição de estoque
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Pago: {formatCurrency(periodMetrics.totalInvestidoMercadoriasPago)}</span>
            <span>A pagar: {formatCurrency(periodMetrics.totalInvestidoMercadoriasPendente)}</span>
          </div>
        </div>

        {/* Cartão 4: Custo das Mercadorias Vendidas (CMV) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">Custo das Mercadorias Vendidas</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-amber-800 tracking-tight block">
              {formatCurrency(periodMetrics.cmvPeriodo)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              CMV estrito dos produtos vendidos
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            Diferenciado de compras de estoque não vendido
          </div>
        </div>

        {/* Cartão 5: Despesas e Gastos (Aba Existente) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">Despesas e Gastos Operacionais</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-rose-700 tracking-tight block">
              {formatCurrency(periodMetrics.despesasTotal)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Integrado da aba "Despesas e Gastos"
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>Pagas: {formatCurrency(periodMetrics.despesasPagas)}</span>
            <span>Pendentes: {formatCurrency(periodMetrics.despesasPendentes)}</span>
          </div>
        </div>

        {/* Cartão 6: Lucro Real */}
        <div
          className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
            periodMetrics.lucroReal >= 0
              ? 'bg-emerald-900 text-white border-emerald-950'
              : 'bg-rose-900 text-white border-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-100">Lucro Real (Líquido)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold uppercase tracking-wider">
              {periodMetrics.lucroReal >= 0 ? 'Lucrativo' : 'Déficit'}
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black font-mono tracking-tight block">
              {formatCurrency(periodMetrics.lucroReal)}
            </span>
            <span className="text-[11px] text-emerald-200/90 mt-0.5 block">
              Repasses recebidos − CMV − Despesas operacionais
            </span>
          </div>
          <div className="pt-2 border-t border-white/20 text-[10px] text-emerald-200">
            Sem duplicidade de tarifas ou estoque estocado
          </div>
        </div>

        {/* Cartão 7: Margem de Lucro Real (%) */}
        <div
          className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
            periodMetrics.margemLucroReal >= 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="font-bold text-slate-800">Margem de Lucro Real</span>
            <span className="font-mono text-xs font-bold text-emerald-700">%</span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black font-mono tracking-tight block">
              {formatPercent(periodMetrics.margemLucroReal)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Percentual líquido sobre faturamento bruto
            </span>
          </div>
          <div className="pt-2 border-t border-emerald-200/60 text-[10px] text-slate-500">
            Margem projetada com repasses futuros: {formatPercent(periodMetrics.margemProjetada)}
          </div>
        </div>
      </div>

      {/* 4. GRÁFICO DE EVOLUÇÃO DO FATURAMENTO E DO LUCRO REAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Evolução do Faturamento Bruto vs Lucro Real
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo cronológico de receita e rentabilidade líquida no período selecionado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
              <span className="text-slate-600 font-medium">Faturamento Bruto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
              <span className="text-slate-600 font-medium">Lucro Real</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-48 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
            Nenhuma venda ou movimentação registrada no período selecionado ({startDate} a {endDate}).
          </div>
        ) : (
          <div className="pt-4 overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="flex items-end gap-3 h-56 pb-6 border-b border-slate-200 px-2">
                {chartData.map((d) => {
                  const fatHeightPct = Math.min(100, Math.max(8, (d.faturamento / maxChartVal) * 100));
                  const lucroHeightPct = Math.min(100, Math.max(6, (Math.abs(d.lucroReal) / maxChartVal) * 100));

                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 z-20 pointer-events-none bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-200 mb-0.5">{d.date}</div>
                        <div>Faturamento: {formatCurrency(d.faturamento)}</div>
                        <div className={d.lucroReal >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          Lucro Real: {formatCurrency(d.lucroReal)}
                        </div>
                      </div>

                      {/* Bar Pair */}
                      <div className="flex items-end gap-1 h-full w-full justify-center">
                        <div
                          style={{ height: `${fatHeightPct}%` }}
                          className="w-1/2 max-w-[24px] bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600"
                        />
                        <div
                          style={{ height: `${lucroHeightPct}%` }}
                          className={`w-1/2 max-w-[24px] rounded-t-md transition-all ${
                            d.lucroReal >= 0
                              ? 'bg-emerald-600 group-hover:bg-emerald-700'
                              : 'bg-rose-500 group-hover:bg-rose-600'
                          }`}
                        />
                      </div>

                      {/* Date label */}
                      <span className="text-[10px] font-mono text-slate-500 transform -rotate-45 sm:rotate-0 mt-2 truncate max-w-[50px]">
                        {d.date.substring(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. TABELA DETALHADA COM ENTRADAS, SAÍDAS, DATAS, CATEGORIAS, ORIGEM E SALDOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Extrato Detalhado de Lançamentos Financeiros
            </h3>
            <p className="text-xs text-slate-500">
              Histórico rastreável com diferenciação visual estrita entre efetivo e previsto.
            </p>
          </div>

          {/* Sub-filter tabs inside table */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTableTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tableTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({filteredEventsWithRunningBalance.length})
            </button>
            <button
              type="button"
              onClick={() => setTableTypeFilter('inflow')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tableTypeFilter === 'inflow' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setTableTypeFilter('outflow')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tableTypeFilter === 'outflow' ? 'bg-white text-rose-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Saídas
            </button>
            <button
              type="button"
              onClick={() => setTableTypeFilter('efetivo')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tableTypeFilter === 'efetivo' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas Efetivos
            </button>
            <button
              type="button"
              onClick={() => setTableTypeFilter('previsto')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tableTypeFilter === 'previsto' ? 'bg-white text-amber-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas Previstos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Descrição & Categoria</th>
                <th className="py-2.5 px-3">Origem do Lançamento</th>
                <th className="py-2.5 px-3">Situação</th>
                <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                <th className="py-2.5 px-3 text-right">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {filteredEventsWithRunningBalance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    Nenhum lançamento corresponde ao período e filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEventsWithRunningBalance.map((ev) => (
                  <tr
                    key={ev.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      ev.status === 'previsto' ? 'bg-slate-50/40 opacity-90' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                      {ev.date}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {ev.type === 'inflow' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-sans text-[11px]">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Entrada</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-sans text-[11px]">
                          <ArrowDownRight className="w-3 h-3" />
                          <span>Saída</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-900 max-w-sm truncate">
                        {ev.description}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                        {ev.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-600 text-[11px] whitespace-nowrap">
                      {ev.origin}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-sans">
                      {ev.status === 'efetivo' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Efetivado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-dashed border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Previsto</span>
                        </span>
                      )}
                    </td>

                    <td
                      className={`py-3 px-3 text-right font-bold text-sm ${
                        ev.type === 'inflow' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {ev.type === 'inflow' ? '+' : '-'}
                      {formatCurrency(ev.amount)}
                    </td>

                    <td
                      className={`py-3 px-3 text-right font-bold text-xs ${
                        ev.runningBalance < 0 ? 'text-rose-700 font-black' : 'text-slate-800'
                      }`}
                    >
                      {formatCurrency(ev.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Initial Cash Balance Modal */}
      {isInitialModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  Configurar Saldo Inicial de Caixa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInitialModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInitialCash} className="space-y-4 text-xs mt-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Saldo Inicial Disponível (R$)
                </label>
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600">
                  <CurrencyInput
                    value={newInitialAmount}
                    onChange={setNewInitialAmount}
                    placeholder="0,00"
                    className="w-full p-2.5 bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Informe o capital de giro ou saldo bancário inicial da sua empresa.
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
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl font-semibold shadow-xs cursor-pointer"
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
