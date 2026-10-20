import React, { useState, useMemo } from 'react';
import {
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  X,
  History,
  Info,
} from 'lucide-react';
import { ordersRepo, transferEntriesRepo, logsRepo } from '../services/db';
import { Order, TransferPaymentEntry, TransferStatus } from '../types/finance';
import { formatCurrency } from '../utils/pricing';

interface TransfersPageProps {
  userId: string;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({ userId }) => {
  const [orders, setOrders] = useState<Order[]>(() => ordersRepo.list(userId));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterMarketplace, setFilterMarketplace] = useState<string>('todos');

  // Confirmation Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C'>('A');
  const [receiptDate, setReceiptDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [differentAmount, setDifferentAmount] = useState<number>(0);
  const [partialNotes, setPartialNotes] = useState<string>('');
  const [isPartialPayment, setIsPartialPayment] = useState<boolean>(false);

  const refreshData = () => {
    setOrders(ordersRepo.list(userId));
  };

  const handleOpenTransferModal = (order: Order) => {
    setSelectedOrder(order);
    setReceiptDate(order.actualTransferDate || new Date().toISOString().split('T')[0]);
    setDifferentAmount(
      order.actualTransferAmount > 0
        ? order.actualTransferAmount
        : order.estimatedTransferAmount
    );
    setPartialNotes('');
    setIsPartialPayment(order.transferStatus === 'recebido_parcial');

    if (order.transferStatus === 'recebido_integral') {
      setSelectedOption('A');
    } else if (order.transferStatus === 'recebido_divergente') {
      setSelectedOption('C');
    } else {
      setSelectedOption('A');
    }
  };

  // Difference calculated automatically: Efetivamente recebido - Estimado
  const calculatedDivergence = useMemo(() => {
    if (!selectedOrder) return 0;
    if (selectedOption === 'A') {
      return 0;
    }
    if (selectedOption === 'B') {
      return 0;
    }
    return differentAmount - selectedOrder.estimatedTransferAmount;
  }, [selectedOrder, selectedOption, differentAmount]);

  // Submit confirmation handler
  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    let newStatus: TransferStatus = 'pendente';
    let actualAmount = 0;
    let actualDate: string | undefined = undefined;
    let divergence = 0;

    if (selectedOption === 'A') {
      // Opção A: Sim, recebi o valor estimado
      newStatus = 'recebido_integral';
      actualAmount = selectedOrder.estimatedTransferAmount;
      actualDate = receiptDate;
      divergence = 0;

      // Add transfer entry
      transferEntriesRepo.add({
        id: 'trans_' + Date.now(),
        orderId: selectedOrder.id,
        userId,
        amount: actualAmount,
        receivedDate: actualDate,
        paymentType: 'integral',
        notes: 'Repasse integral confirmado conforme valor previsto.',
        createdAt: new Date().toISOString(),
      });

      logsRepo.addLog(
        userId,
        'login',
        `Repasse confirmado para o pedido ${selectedOrder.orderNumber}: ${formatCurrency(actualAmount)}`
      );
    } else if (selectedOption === 'B') {
      // Opção B: Não, ainda não recebi
      newStatus = 'pendente';
      actualAmount = 0;
      actualDate = undefined;
      divergence = 0;

      logsRepo.addLog(
        userId,
        'login',
        `Repasse do pedido ${selectedOrder.orderNumber} mantido como pendente.`
      );
    } else if (selectedOption === 'C') {
      // Opção C: Recebi um valor diferente ou recebimento parcial
      actualAmount = Math.max(0, differentAmount);
      actualDate = receiptDate;
      divergence = actualAmount - selectedOrder.estimatedTransferAmount;

      if (isPartialPayment) {
        newStatus = 'recebido_parcial';
      } else {
        newStatus = 'recebido_divergente';
      }

      // Add transfer entry
      transferEntriesRepo.add({
        id: 'trans_' + Date.now(),
        orderId: selectedOrder.id,
        userId,
        amount: actualAmount,
        receivedDate: actualDate,
        paymentType: isPartialPayment ? 'parcial' : 'divergente',
        notes: partialNotes || (isPartialPayment ? 'Recebimento parcial' : 'Recebimento divergente'),
        createdAt: new Date().toISOString(),
      });

      logsRepo.addLog(
        userId,
        'login',
        `Repasse com valor diferente registrado para o pedido ${selectedOrder.orderNumber}: ${formatCurrency(actualAmount)} (Diferença de ${formatCurrency(divergence)})`
      );
    }

    const updatedOrder: Order = {
      ...selectedOrder,
      transferStatus: newStatus,
      actualTransferAmount: actualAmount,
      actualTransferDate: actualDate,
      transferDivergence: divergence,
      updatedAt: new Date().toISOString(),
    };

    ordersRepo.save(updatedOrder);
    refreshData();
    setSelectedOrder(null);
  };

  // Revert or Reset transfer back to pending
  const handleRevertTransfer = (order: Order) => {
    if (confirm(`Deseja estornar a confirmação de recebimento do pedido ${order.orderNumber}? O dinheiro sairá do saldo disponível e voltará para o saldo projetado futuro.`)) {
      const updated: Order = {
        ...order,
        transferStatus: 'pendente',
        actualTransferAmount: 0,
        actualTransferDate: undefined,
        transferDivergence: 0,
        updatedAt: new Date().toISOString(),
      };
      ordersRepo.save(updated);
      logsRepo.addLog(userId, 'login', `Estorno de repasse do pedido ${order.orderNumber}`);
      refreshData();
    }
  };

  // Aggregate metrics
  const totalEstimatedTransfers = useMemo(
    () => orders.reduce((acc, curr) => acc + curr.estimatedTransferAmount, 0),
    [orders]
  );
  const totalConfirmedTransfers = useMemo(
    () => orders.reduce((acc, curr) => acc + curr.actualTransferAmount, 0),
    [orders]
  );
  const totalPendingTransfers = useMemo(
    () =>
      orders.reduce((acc, curr) => {
        if (curr.transferStatus === 'pendente') return acc + curr.estimatedTransferAmount;
        if (curr.transferStatus === 'recebido_parcial') {
          return acc + Math.max(0, curr.estimatedTransferAmount - curr.actualTransferAmount);
        }
        return acc;
      }, 0),
    [orders]
  );
  const totalDivergencesCount = useMemo(
    () =>
      orders.filter(
        (o) => o.transferStatus === 'recebido_divergente' && Math.abs(o.transferDivergence) > 0.01
      ).length,
    [orders]
  );

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterMarketplace !== 'todos' && o.marketplace !== filterMarketplace) return false;
      if (filterStatus !== 'todos') {
        if (filterStatus === 'pendente' && o.transferStatus !== 'pendente') return false;
        if (filterStatus === 'recebido' && o.actualTransferAmount <= 0) return false;
        if (filterStatus === 'divergente' && o.transferStatus !== 'recebido_divergente') return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        if (
          !o.orderNumber.toLowerCase().includes(query) &&
          !o.marketplace.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, filterMarketplace, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
          Controle & Confirmação de Repasses
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Confirme exatamente o que caiu na sua conta e identifique divergências e taxas cobradas a mais pelos marketplaces.
        </p>
      </div>

      {/* Repasse Rule Card */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Regra Contábil da LucraiBR:</span> Um repasse só se torna{' '}
          <strong>dinheiro disponível hoje</strong> após você confirmar explicitamente o recebimento.
          Enquanto pendente, ele compõe unicamente o <strong>saldo projetado</strong> para a data prevista.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Repasses Efetivamente Recebidos</span>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(totalConfirmedTransfers)}
          </p>
          <span className="text-[11px] text-slate-400">Dinheiro já creditado em caixa</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Repasses Pendentes</span>
          <p className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(totalPendingTransfers)}
          </p>
          <span className="text-[11px] text-slate-400">Aguardando depósito da plataforma</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Previsto das Vendas</span>
          <p className="text-xl font-bold font-mono text-slate-800 mt-1">
            {formatCurrency(totalEstimatedTransfers)}
          </p>
          <span className="text-[11px] text-slate-400">Soma das previsões de todos pedidos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Pedidos com Divergência</span>
          <p className="text-xl font-bold font-mono text-rose-700 mt-1">
            {totalDivergencesCount} pedidos
          </p>
          <span className="text-[11px] text-slate-400">Diferença entre previsto e recebido</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por número do pedido ou marketplace..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todos Marketplaces</option>
            <option value="Mercado Livre">Mercado Livre</option>
            <option value="Shopee">Shopee</option>
            <option value="TikTok Shop">TikTok Shop</option>
            <option value="Outro">Outro</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todas as Situações</option>
            <option value="pendente">Apenas Pendentes</option>
            <option value="recebido">Apenas Recebidos</option>
            <option value="divergente">Apenas com Divergências</option>
          </select>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Pedido</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4 text-right">Repasse Estimado</th>
                <th className="py-3 px-4">Previsão Receb.</th>
                <th className="py-3 px-4 text-right">Valor Efetivo</th>
                <th className="py-3 px-4">Data Efetiva</th>
                <th className="py-3 px-4 text-right">Diferença (Divergência)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Nenhum registro de repasse encontrado.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isDivergent =
                    ord.actualTransferAmount > 0 && Math.abs(ord.transferDivergence) > 0.05;

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {ord.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {ord.marketplace}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-800">
                        {formatCurrency(ord.estimatedTransferAmount)}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                        {ord.expectedTransferDate}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                        {ord.actualTransferAmount > 0 ? (
                          <span className="text-emerald-700">
                            {formatCurrency(ord.actualTransferAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">R$ 0,00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                        {ord.actualTransferDate || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {ord.actualTransferAmount > 0 ? (
                          <span
                            className={`font-semibold ${
                              ord.transferDivergence > 0
                                ? 'text-emerald-700'
                                : ord.transferDivergence < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {ord.transferDivergence > 0 ? '+' : ''}
                            {formatCurrency(ord.transferDivergence)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            ord.transferStatus === 'recebido_integral'
                              ? 'bg-emerald-100 text-[#064E3B]'
                              : ord.transferStatus === 'recebido_divergente'
                              ? 'bg-rose-100 text-rose-800'
                              : ord.transferStatus === 'recebido_parcial'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.transferStatus === 'recebido_integral' && 'Recebido Integral'}
                          {ord.transferStatus === 'recebido_divergente' && 'Divergente'}
                          {ord.transferStatus === 'recebido_parcial' && 'Receb. Parcial'}
                          {ord.transferStatus === 'pendente' && 'Aguardando'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenTransferModal(ord)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs transition-colors"
                          >
                            Conferir
                          </button>
                          {ord.actualTransferAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRevertTransfer(ord)}
                              className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Estornar recebimento para pendente"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONTROLE DE REPASSE (Perguntas A, B, C solicitadas pelo usuário) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Controle de Repasse · Pedido {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedOrder.marketplace} · Venda em {selectedOrder.saleDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo do pedido */}
            <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Valor Bruto da Venda:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatCurrency(selectedOrder.grossAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Repasse Estimado:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {formatCurrency(selectedOrder.estimatedTransferAmount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              {/* PERGUNTA CENTRAL OBRIGATÓRIA */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-2">
                  Você recebeu o valor estimado do repasse?
                </label>

                <div className="space-y-2">
                  {/* Opção A */}
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedOption === 'A'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="transferOption"
                        checked={selectedOption === 'A'}
                        onChange={() => setSelectedOption('A')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Opção A — Sim, recebi o valor estimado ({formatCurrency(selectedOrder.estimatedTransferAmount)})
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Confirma o valor integral e credita no saldo atual disponível de caixa.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Opção B */}
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedOption === 'B'
                        ? 'border-amber-600 bg-amber-50/50 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="transferOption"
                        checked={selectedOption === 'B'}
                        onChange={() => setSelectedOption('B')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Opção B — Não, ainda não recebi
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Mantém o valor como entrada futura prevista. Não soma no saldo disponível hoje.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Opção C */}
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedOption === 'C'
                        ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="transferOption"
                        checked={selectedOption === 'C'}
                        onChange={() => setSelectedOption('C')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Opção C — Recebi um valor diferente (ou parcial)
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Informe o valor exato que entrou na sua conta bancária e compare divergências.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Campos condicionais se Opção A ou C */}
              {(selectedOption === 'A' || selectedOption === 'C') && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data efetiva do recebimento na conta bancária
                    </label>
                    <input
                      type="date"
                      required
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  {selectedOption === 'C' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Valor efetivamente creditado em conta (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={differentAmount}
                          onChange={(e) => setDifferentAmount(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>

                      {/* Diferença automática */}
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                        <span className="text-slate-600">
                          Diferença apurada:
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            calculatedDivergence > 0
                              ? 'text-emerald-700'
                              : calculatedDivergence < 0
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {calculatedDivergence > 0 ? '+' : ''}
                          {formatCurrency(calculatedDivergence)}
                          {calculatedDivergence < 0 && ' (Recebido a menos)'}
                          {calculatedDivergence > 0 && ' (Recebido a mais)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 font-medium">
                          <input
                            type="checkbox"
                            checked={isPartialPayment}
                            onChange={(e) => setIsPartialPayment(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>É um recebimento parcial? (restante continuará pendente)</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Motivo / Observações da divergência
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Cobrança de taxa extra de devolução pelo ML..."
                          value={partialNotes}
                          onChange={(e) => setPartialNotes(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs"
                >
                  Confirmar e Atualizar Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
