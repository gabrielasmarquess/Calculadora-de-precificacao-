import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  X,
  CreditCard,
  Layers,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { purchasesRepo, ordersRepo, logsRepo } from '../services/db';
import {
  Purchase,
  Installment,
  PaymentMethod,
  PaymentStatus,
} from '../types/finance';
import { formatCurrency } from '../utils/pricing';
import { CurrencyInput } from '../components/common/CurrencyInput';

interface PurchasesPageProps {
  userId: string;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({ userId }) => {
  const [purchases, setPurchases] = useState<Purchase[]>(() =>
    purchasesRepo.list(userId)
  );
  const [orders, setOrders] = useState(() => ordersRepo.list(userId));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  // Form Fields
  const [productDescription, setProductDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [relatedOrderIds, setRelatedOrderIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pago');
  const [notes, setNotes] = useState('');

  // Installments state
  const [numInstallments, setNumInstallments] = useState<number>(1);
  const [installments, setInstallments] = useState<Installment[]>([]);

  const refreshData = () => {
    setPurchases(purchasesRepo.list(userId));
    setOrders(ordersRepo.list(userId));
  };

  // Generate default installments array when cost or count changes
  const generateInstallments = (
    total: number,
    count: number,
    status: PaymentStatus,
    firstDueDate: string,
    method: PaymentMethod
  ): Installment[] => {
    const list: Installment[] = [];
    const amountPerInstallment = Math.round((total / count) * 100) / 100;
    let accumulated = 0;

    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const amt = isLast ? Math.round((total - accumulated) * 100) / 100 : amountPerInstallment;
      accumulated += amt;

      const dateObj = new Date(firstDueDate);
      dateObj.setMonth(dateObj.getMonth() + (i - 1));
      const dueStr = dateObj.toISOString().split('T')[0];

      const isPaid = status === 'pago';

      list.push({
        id: 'inst_' + Date.now() + '_' + i,
        installmentNumber: i,
        totalInstallments: count,
        amount: amt,
        dueDate: dueStr,
        status: isPaid ? 'pago' : 'pendente',
        paidDate: isPaid ? purchaseDate : undefined,
        paymentMethod: method,
      });
    }

    return list;
  };

  const handleOpenCreateModal = () => {
    setEditingPurchase(null);
    setProductDescription('');
    setSupplierName('');
    setRelatedOrderIds([]);
    setQuantity(1);
    setTotalCost(0);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Pix');
    setPaymentStatus('pago');
    setNotes('');
    setNumInstallments(1);
    setInstallments([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pur: Purchase) => {
    setEditingPurchase(pur);
    setProductDescription(pur.productDescription);
    setSupplierName(pur.supplierName);
    setRelatedOrderIds(pur.relatedOrderIds || []);
    setQuantity(pur.quantity);
    setTotalCost(pur.totalCost);
    setPurchaseDate(pur.purchaseDate);
    setDueDate(pur.dueDate);
    setPaymentMethod(pur.paymentMethod);
    setPaymentStatus(pur.paymentStatus);
    setNotes(pur.notes || '');
    setNumInstallments(pur.installments.length || 1);
    setInstallments(pur.installments || []);
    setIsModalOpen(true);
  };

  // Toggle single installment status (pendente <-> pago)
  const handleToggleInstallmentStatus = (purchase: Purchase, installmentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updatedInstallments = purchase.installments.map((inst) => {
      if (inst.id === installmentId) {
        const nextStatus: 'pago' | 'pendente' = inst.status === 'pago' ? 'pendente' : 'pago';
        return {
          ...inst,
          status: nextStatus,
          paidDate: nextStatus === 'pago' ? today : undefined,
        };
      }
      return inst;
    });

    const allPaid = updatedInstallments.every((i) => i.status === 'pago');
    const somePaid = updatedInstallments.some((i) => i.status === 'pago');

    let overallStatus: PaymentStatus = 'nao_pago';
    if (allPaid) {
      overallStatus = 'pago';
    } else if (somePaid) {
      overallStatus = 'parcialmente_pago';
    } else if (updatedInstallments.length > 1) {
      overallStatus = 'parcelado';
    }

    const updatedPurchase: Purchase = {
      ...purchase,
      paymentStatus: overallStatus,
      installments: updatedInstallments,
      updatedAt: new Date().toISOString(),
    };

    purchasesRepo.save(updatedPurchase);
    logsRepo.addLog(
      userId,
      'login',
      `Atualização de status de parcela da compra: ${purchase.productDescription}`
    );
    refreshData();
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productDescription.trim() || !supplierName.trim()) {
      alert('Preencha a descrição do produto e o nome do fornecedor.');
      return;
    }

    // Prepare installments
    let finalInstallments = installments;
    if (finalInstallments.length === 0 || finalInstallments.length !== numInstallments) {
      finalInstallments = generateInstallments(
        totalCost,
        numInstallments,
        paymentStatus,
        dueDate,
        paymentMethod
      );
    }

    const saved: Purchase = {
      id: editingPurchase ? editingPurchase.id : 'pur_' + Date.now(),
      userId,
      productDescription: productDescription.trim(),
      supplierName: supplierName.trim(),
      relatedOrderIds,
      quantity: Math.max(1, quantity),
      totalCost: Math.max(0, totalCost),
      purchaseDate,
      dueDate,
      paymentMethod,
      paymentStatus,
      installments: finalInstallments,
      notes: notes.trim(),
      createdAt: editingPurchase ? editingPurchase.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    purchasesRepo.save(saved);

    // If related orders were selected, auto-mark items as purchased in orders
    if (relatedOrderIds.length > 0) {
      relatedOrderIds.forEach((ordId) => {
        const order = ordersRepo.get(userId, ordId);
        if (order) {
          const updatedItems = order.items.map((i) => ({ ...i, isPurchased: true }));
          ordersRepo.save({
            ...order,
            items: updatedItems,
            logisticStatus:
              order.logisticStatus === 'aguardando_compra'
                ? 'produto_comprado'
                : order.logisticStatus,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    refreshData();
    setIsModalOpen(false);
  };

  const handleDeletePurchase = (purchaseId: string) => {
    if (confirm('Tem certeza que deseja excluir esta compra?')) {
      purchasesRepo.delete(userId, purchaseId);
      refreshData();
    }
  };

  // Orders that are waiting for purchase
  const pendingOrdersList = useMemo(() => {
    return orders.filter(
      (o) => o.logisticStatus !== 'pedido_cancelado' && o.items.some((i) => !i.isPurchased)
    );
  }, [orders]);

  // Aggregate stats
  const totalPurchasesCost = useMemo(
    () => purchases.reduce((acc, curr) => acc + curr.totalCost, 0),
    [purchases]
  );

  const totalPaidOutflow = useMemo(() => {
    let sum = 0;
    purchases.forEach((p) => {
      p.installments.forEach((inst) => {
        if (inst.status === 'pago') sum += inst.amount;
      });
    });
    return sum;
  }, [purchases]);

  const totalPendingOutflow = useMemo(() => {
    let sum = 0;
    purchases.forEach((p) => {
      p.installments.forEach((inst) => {
        if (inst.status === 'pendente') sum += inst.amount;
      });
    });
    return sum;
  }, [purchases]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (filterStatus !== 'todos' && p.paymentStatus !== filterStatus) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (
          !p.productDescription.toLowerCase().includes(q) &&
          !p.supplierName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [purchases, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Compras & Fornecedores
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Gestão de reposição sob demanda (venda primeiro, compra depois), parcelamentos e fornecedores.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Compra de Fornecedor</span>
        </button>
      </div>

      {/* Pending orders alert (No self-stock model) */}
      {pendingOrdersList.length > 0 && (
        <div className="p-4 bg-orange-50/90 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-orange-950">
          <div>
            <div className="flex items-center gap-2 font-bold text-sm text-orange-900">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>{pendingOrdersList.length} venda(s) realizada(s) aguardando compra do fornecedor</span>
            </div>
            <p className="text-orange-800 mt-0.5">
              Pedidos que você vendeu nos marketplaces e ainda não comprou para despachar ao cliente:
              {' '}{pendingOrdersList.map((o) => o.orderNumber).join(', ')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 bg-orange-700 hover:bg-orange-800 text-white font-semibold rounded-lg shrink-0"
          >
            Comprar Agora
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Comprado em Mercadorias</span>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(totalPurchasesCost)}
          </p>
          <span className="text-[11px] text-slate-400">{purchases.length} compras registradas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Já Pago a Fornecedores (Saída Efetiva)</span>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(totalPaidOutflow)}
          </p>
          <span className="text-[11px] text-slate-400">Descontado do saldo disponível em caixa</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">A Pagar Futuro (Projeção)</span>
          <p className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(totalPendingOutflow)}
          </p>
          <span className="text-[11px] text-slate-400">Parcelas e boletos ainda não debitados</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por produto ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todos os Status de Pagamento</option>
            <option value="pago">Pago</option>
            <option value="nao_pago">Não Pago / Pendente</option>
            <option value="parcialmente_pago">Parcialmente Pago</option>
            <option value="parcelado">Parcelado</option>
          </select>
        </div>
      </div>

      {/* Purchases List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto & Fornecedor</th>
                <th className="py-3 px-4">Qtd</th>
                <th className="py-3 px-4 text-right">Custo Total</th>
                <th className="py-3 px-4">Forma & Vencimento</th>
                <th className="py-3 px-4 text-center">Status Pagamento</th>
                <th className="py-3 px-4">Parcelas / Cronograma</th>
                <th className="py-3 px-4">Pedidos Atendidos</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Nenhuma compra de fornecedor encontrada.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((pur) => {
                  const paidCount = pur.installments.filter((i) => i.status === 'pago').length;

                  return (
                    <tr key={pur.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{pur.productDescription}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {pur.supplierName} · Comprado em {pur.purchaseDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {pur.quantity} un.
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                        {formatCurrency(pur.totalCost)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{pur.paymentMethod}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Venc: {pur.dueDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            pur.paymentStatus === 'pago'
                              ? 'bg-emerald-100 text-[#064E3B]'
                              : pur.paymentStatus === 'parcialmente_pago'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {pur.paymentStatus === 'pago' && 'Pago'}
                          {pur.paymentStatus === 'nao_pago' && 'Não Pago'}
                          {pur.paymentStatus === 'parcialmente_pago' && 'Parcialmente Pago'}
                          {pur.paymentStatus === 'parcelado' && 'Parcelado'}
                        </span>
                      </td>

                      {/* Parcelas interativas */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {pur.installments.map((inst) => (
                            <button
                              key={inst.id}
                              type="button"
                              onClick={() => handleToggleInstallmentStatus(pur, inst.id)}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-colors text-left ${
                                inst.status === 'pago'
                                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                              }`}
                              title="Clique para alternar entre Pendente e Pago"
                            >
                              <span className="font-semibold">
                                {inst.installmentNumber}/{inst.totalInstallments}:
                              </span>
                              <span>{formatCurrency(inst.amount)}</span>
                              <span className="text-[9px] uppercase font-bold">
                                ({inst.status === 'pago' ? '✓ Pago' : 'Pendente'})
                              </span>
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Pedidos relacionados */}
                      <td className="py-3.5 px-4">
                        {pur.relatedOrderIds && pur.relatedOrderIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {pur.relatedOrderIds.map((oId) => {
                              const o = orders.find((x) => x.id === oId);
                              return (
                                <span
                                  key={oId}
                                  className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                                >
                                  {o ? o.orderNumber : oId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Estoque Geral</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(pur)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                            title="Editar compra"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePurchase(pur.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Excluir compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Modal Nova / Editar Compra */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingPurchase ? 'Editar Compra' : 'Registrar Compra de Fornecedor'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Produto / Lote Comprado
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 10 unidades Suporte Articulado..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome da distribuidora ou fornecedor"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantidade Total (unidades)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Custo Total Pago/A Pagar (R$)
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600">
                    <CurrencyInput
                      value={totalCost}
                      onChange={(val) => {
                        setTotalCost(val);
                        if (numInstallments > 1) {
                          setInstallments(
                            generateInstallments(val, numInstallments, paymentStatus, dueDate, paymentMethod)
                          );
                        }
                      }}
                      placeholder="0,00"
                      className="w-full p-2.5 bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="Pix">Pix (À vista)</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data da Compra
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parcelas
                  </label>
                  <select
                    value={numInstallments}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 1;
                      setNumInstallments(count);
                      setInstallments(
                        generateInstallments(totalCost, count, paymentStatus, dueDate, paymentMethod)
                      );
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x {n > 1 ? `de ${formatCurrency(totalCost / n)}` : '(À vista)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Situação do Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pago')}
                    className={`py-2 text-center rounded-xl font-semibold border ${
                      paymentStatus === 'pago'
                        ? 'bg-emerald-100 text-[#064E3B] border-emerald-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Já Pago (Saída hoje)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('nao_pago')}
                    className={`py-2 text-center rounded-xl font-semibold border ${
                      paymentStatus === 'nao_pago'
                        ? 'bg-amber-100 text-amber-900 border-amber-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Não Pago (A pagar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('parcelado')}
                    className={`py-2 text-center rounded-xl font-semibold border ${
                      paymentStatus === 'parcelado'
                        ? 'bg-blue-100 text-blue-900 border-blue-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Parcelado
                  </button>
                </div>
              </div>

              {/* Vínculo com Pedidos específicos (operação sem estoque) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Atende a quais pedidos vendidos? (Opcional - Selecione os pedidos)
                </label>
                <div className="max-h-28 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  {orders.map((ord) => {
                    const isChecked = relatedOrderIds.includes(ord.id);
                    return (
                      <label
                        key={ord.id}
                        className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRelatedOrderIds((prev) => [...prev, ord.id]);
                            } else {
                              setRelatedOrderIds((prev) => prev.filter((id) => id !== ord.id));
                            }
                          }}
                          className="rounded text-emerald-600"
                        />
                        <span className="font-mono font-bold text-slate-800">
                          {ord.orderNumber}
                        </span>
                        <span className="text-slate-500">
                          ({ord.marketplace} · {ord.items.map((i) => i.productName).join(', ')})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl font-semibold shadow-xs"
                >
                  Salvar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
