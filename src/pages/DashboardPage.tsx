import React, { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Receipt,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import {
  ordersRepo,
  purchasesRepo,
  expensesRepo,
  computeFinancialSummary,
} from '../services/db';
import { formatCurrency, formatPercent } from '../utils/pricing';
import { Marketplace } from '../types/finance';
import { RevenueChartPanel } from '../components/dashboard/RevenueChartPanel';
import { TrajectoryCarouselPanel } from '../components/dashboard/TrajectoryCarouselPanel';

interface DashboardPageProps {
  userId: string;
  onNavigate: (section: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ userId, onNavigate }) => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('todos');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d');

  // Load live data from repositories
  const orders = useMemo(() => ordersRepo.list(userId), [userId]);
  const purchases = useMemo(() => purchasesRepo.list(userId), [userId]);
  const expenses = useMemo(() => expensesRepo.list(userId), [userId]);
  const summary = useMemo(() => computeFinancialSummary(userId), [userId]);

  // Filtered orders for visual breakdown
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (selectedMarketplace !== 'todos' && ord.marketplace !== selectedMarketplace) {
        return false;
      }
      return true;
    });
  }, [orders, selectedMarketplace]);

  // Marketplace distribution
  const marketplaceDistribution = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {
      'Mercado Livre': { count: 0, total: 0 },
      Shopee: { count: 0, total: 0 },
      'TikTok Shop': { count: 0, total: 0 },
      Outro: { count: 0, total: 0 },
    };

    orders.forEach((ord) => {
      const m = ord.marketplace in map ? ord.marketplace : 'Outro';
      map[m].count += 1;
      map[m].total += ord.grossAmount;
    });

    const grandTotal = orders.reduce((acc, curr) => acc + curr.grossAmount, 0) || 1;
    return Object.entries(map).map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total,
      percentage: (data.total / grandTotal) * 100,
    }));
  }, [orders]);

  // Action lists
  // 1. Pedidos aguardando compra do fornecedor (operação sem estoque próprio)
  const ordersNeedingPurchase = useMemo(() => {
    return orders.filter(
      (ord) =>
        ord.logisticStatus !== 'pedido_cancelado' &&
        ord.items.some((i) => !i.isPurchased)
    );
  }, [orders]);

  // 2. Repasses aguardando recebimento
  const pendingTransfers = useMemo(() => {
    return orders.filter(
      (ord) => ord.transferStatus === 'pendente' || ord.transferStatus === 'recebido_parcial'
    );
  }, [orders]);

  // 3. Pedidos com divergências entre repasse estimado e recebido
  const divergentTransfers = useMemo(() => {
    return orders.filter(
      (ord) =>
        ord.transferStatus === 'recebido_divergente' ||
        (ord.actualTransferAmount > 0 && Math.abs(ord.transferDivergence) > 0.05)
    );
  }, [orders]);

  // 4. Contas a pagar com vencimento próximo (compras e despesas pendentes)
  const upcomingBills = useMemo(() => {
    const bills: {
      id: string;
      title: string;
      type: 'Compra' | 'Despesa';
      dueDate: string;
      amount: number;
    }[] = [];

    purchases.forEach((p) => {
      p.installments.forEach((inst) => {
        if (inst.status === 'pendente') {
          bills.push({
            id: `pur_${inst.id}`,
            title: `${p.supplierName} - ${p.productDescription}`,
            type: 'Compra',
            dueDate: inst.dueDate,
            amount: inst.amount,
          });
        }
      });
    });

    expenses.forEach((e) => {
      if (e.isExternalCreditCardItem) return;
      e.installments.forEach((inst) => {
        if (inst.status === 'pendente') {
          bills.push({
            id: `exp_${inst.id}`,
            title: e.description,
            type: 'Despesa',
            dueDate: inst.dueDate,
            amount: inst.amount,
          });
        }
      });
    });

    return bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  }, [purchases, expenses]);

  // Alerta de liquidez futura: Se o saldo projetado for menor que zero
  const isLiquidityRisk = summary.projectedCash < 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Quick Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Dashboard Financeiro & Operacional
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Visão consolidada da saúde de caixa, compras a fazer, repasses e lucro.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Marketplace filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos Marketplaces</option>
              <option value="Mercado Livre">Mercado Livre</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok Shop">TikTok Shop</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incomplete data banner if exists */}
      {summary.hasIncompleteData && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Atenção:</strong> Existem pedidos com custo de produto não preenchido. O cálculo do lucro real e estimado pode estar incompleto.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-amber-800 font-bold hover:underline shrink-0"
          >
            Revisar Vendas →
          </button>
        </div>
      )}

      {/* Liquidity Risk Alert Banner */}
      {isLiquidityRisk && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-rose-800">
              Alerta de Risco de Caixa Futuro
            </h4>
            <p className="mt-0.5 text-rose-700">
              As saídas previstas ({formatCurrency(summary.accountsPayableAmount)}) superam o saldo disponível somado aos repasses a receber ({formatCurrency(summary.currentAvailableCash + summary.pendingTransfersAmount)}). O saldo projetado ficaria negativo em {formatCurrency(Math.abs(summary.projectedCash))}.
            </p>
          </div>
        </div>
      )}

      {/* 3 Core Conceptual Pillars: Saldo Atual vs Saldo Projetado vs Lucro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pilar 1: Saldo Atual Disponível */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Dinheiro Disponível Hoje</span>
              <Wallet className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
              {formatCurrency(summary.currentAvailableCash)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Dinheiro real em conta (repasses já caídos + saldo inicial − pagamentos efetuados).
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Repasses caídos:</span>
            <span className="font-mono font-semibold text-emerald-700">
              +{formatCurrency(summary.confirmedTransfersAmount)}
            </span>
          </div>
        </div>

        {/* Pilar 2: Saldo Projetado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Saldo Projetado Futuro</span>
              <TrendingUp className="w-4 h-4 text-blue-700" />
            </div>
            <p className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-2 ${summary.projectedCash >= 0 ? 'text-blue-900' : 'text-rose-600'}`}>
              {formatCurrency(summary.projectedCash)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Disponível + repasses a receber ({formatCurrency(summary.pendingTransfersAmount)}) − compromissos a pagar ({formatCurrency(summary.accountsPayableAmount)}).
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Contas a pagar:</span>
            <span className="font-mono font-semibold text-rose-600">
              -{formatCurrency(summary.accountsPayableAmount)}
            </span>
          </div>
        </div>

        {/* Pilar 3: Lucro Efetivo vs Lucro Estimado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Resultado Operacional (Lucro)</span>
              <DollarSign className="w-4 h-4 text-[#064E3B]" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#064E3B] mt-2">
              {formatCurrency(summary.estimatedProfit)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Lucro estimado sobre vendas totais menos taxas, custo de mercadoria e despesas.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Lucro com dados confirmados:</span>
            <span className="font-mono font-semibold text-emerald-800">
              {formatCurrency(summary.realizedProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL DO DASHBOARD: GRÁFICO DE FATURAMENTO E CARROSSEL 'MINHA TRAJETÓRIA' LADO A LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Painel esquerdo — Gráfico de faturamento (aprox. 60% a 65% da largura disponível em telas maiores) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <RevenueChartPanel
            orders={orders}
            onNavigateToOrders={() => onNavigate('orders')}
            selectedMarketplace={selectedMarketplace}
          />
        </div>

        {/* Painel direito — Carrossel 'Minha trajetória' (aprox. 35% a 40% da largura disponível em telas maiores) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <TrajectoryCarouselPanel userId={userId} />
        </div>
      </div>

      {/* Operational KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Vendas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total de Vendas</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatCurrency(summary.totalSalesGross)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {orders.length} pedidos registrados
          </p>
        </div>

        {/* Repasses Pendentes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Repasses Pendentes</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1.5">
            {formatCurrency(summary.pendingTransfersAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {pendingTransfers.length} aguardando liberação
          </p>
        </div>

        {/* Produtos a Comprar Pós-Venda (Sem Estoque Próprio) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>A Comprar do Fornecedor</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-orange-700 mt-1.5">
            {summary.pendingProductsToBuyCount} un.
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Precisa de {formatCurrency(summary.moneyNeededToBuyProducts)}
          </p>
        </div>

        {/* Despesas Pagas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Despesas Pagas</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatCurrency(summary.expensesPaidAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {expenses.length} lançamentos operacionais
          </p>
        </div>
      </div>

      {/* Middle Section: Marketplace Breakdown & Action Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marketplace Distribution Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Vendas por Marketplace
          </h3>
          <div className="space-y-3.5">
            {marketplaceDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {formatCurrency(item.total)} ({item.count} un)
                  </span>
                </div>
                {/* Visual bar */}
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.name === 'Mercado Livre'
                        ? 'bg-amber-400'
                        : item.name === 'Shopee'
                        ? 'bg-orange-500'
                        : item.name === 'TikTok Shop'
                        ? 'bg-rose-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(item.percentage, 4))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="w-full py-2 text-xs font-semibold text-[#064E3B] hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Ver todos os pedidos detalhados</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Priority 1: Pedidos aguardando compra do fornecedor (Sem estoque próprio) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Produtos a Comprar pós-venda</span>
                <span className="text-[11px] font-mono bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
                  {ordersNeedingPurchase.length}
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Pedidos vendidos que ainda dependem da compra com seu fornecedor:
            </p>

            {ordersNeedingPurchase.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                Nenhum produto aguardando compra no momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {ordersNeedingPurchase.slice(0, 3).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {ord.orderNumber} ({ord.marketplace})
                      </p>
                      <p className="text-slate-500 text-[11px] truncate max-w-[180px]">
                        {ord.items.map((i) => i.productName).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-800">
                        {formatCurrency(
                          ord.items.reduce((acc, curr) => acc + curr.totalCost, 0)
                        )}
                      </p>
                      <span className="text-[10px] text-orange-700 font-semibold">
                        A comprar
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('purchases')}
              className="w-full py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Gerenciar compras e fornecedores</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Priority 2: Repasses aguardando confirmação e divergências */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Controle de Repasses
              </h3>
              <span className="text-[11px] font-mono bg-emerald-100 text-[#064E3B] px-2 py-0.5 rounded-full font-bold">
                {pendingTransfers.length} pendentes
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Monitore o que já caiu e o que os marketplaces ainda devem:
            </p>

            <div className="space-y-2.5">
              {pendingTransfers.slice(0, 3).map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {ord.orderNumber}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Previsto: {ord.expectedTransferDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-800">
                      {formatCurrency(ord.estimatedTransferAmount)}
                    </p>
                    <span className="text-[10px] text-amber-700 font-medium">
                      Pendente
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Alerta de Divergências se houver */}
            {divergentTransfers.length > 0 && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-center justify-between">
                <span>{divergentTransfers.length} repasse(s) com divergência de valor</span>
                <span className="font-bold">Verificar</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('transfers')}
              className="w-full py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Confirmar recebimento de repasses</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Bills & Payables */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Próximos Vencimentos de Contas & Fornecedores
            </h3>
            <p className="text-xs text-slate-500">
              Obrigações e parcelas que vencem nos próximos dias.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('cashflow')}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            Ver Fluxo de Caixa Completo →
          </button>
        </div>

        {upcomingBills.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">
            Nenhuma conta a pagar pendente cadastrada no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {upcomingBills.map((bill) => (
              <div
                key={bill.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {bill.type} · Vence {bill.dueDate}
                  </span>
                  <p className="font-semibold text-slate-900 truncate max-w-[180px] mt-0.5">
                    {bill.title}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-700">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
