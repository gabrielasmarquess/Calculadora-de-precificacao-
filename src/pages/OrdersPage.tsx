import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  AlertCircle,
  Truck,
  ExternalLink,
  X,
  PlusCircle,
  Tag,
  Package,
  PackagePlus,
} from 'lucide-react';
import { ordersRepo, purchasesRepo, productsRepo, logsRepo } from '../services/db';
import {
  Order,
  OrderItem,
  Marketplace,
  OrderLogisticStatus,
  TransferStatus,
  Product,
} from '../types/finance';
import { formatCurrency } from '../utils/pricing';

interface OrdersPageProps {
  userId: string;
  onNavigateToTransfers?: (orderId: string) => void;
  onNavigateToPurchases?: () => void;
  initialProductToSale?: Product | null;
  onClearInitialProduct?: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  userId,
  onNavigateToTransfers,
  onNavigateToPurchases,
  initialProductToSale,
  onClearInitialProduct,
}) => {
  const [orders, setOrders] = useState<Order[]>(() => ordersRepo.list(userId));
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(() =>
    productsRepo.list(userId)
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Form fields
  const [orderNumber, setOrderNumber] = useState('');
  const [marketplace, setMarketplace] = useState<Marketplace>('Mercado Livre');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedTransferDate, setExpectedTransferDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [knownFeesAmount, setKnownFeesAmount] = useState<number>(0);
  const [estimatedTransferAmount, setEstimatedTransferAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [logisticStatus, setLogisticStatus] = useState<OrderLogisticStatus>('venda_registrada');

  // Items in order
  const [items, setItems] = useState<
    {
      id: string;
      productId?: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      isPurchased: boolean;
    }[]
  >([
    {
      id: 'item_1',
      productName: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
      unitCost: 0,
      isPurchased: false,
    },
  ]);

  const refreshOrders = () => {
    setOrders(ordersRepo.list(userId));
    setCatalogProducts(productsRepo.list(userId));
  };

  // Effect to open order modal if pre-selected product was passed
  useEffect(() => {
    if (initialProductToSale) {
      handleOpenCreateModalWithProduct(initialProductToSale);
      if (onClearInitialProduct) onClearInitialProduct();
    }
  }, [initialProductToSale]);

  const handleOpenCreateModalWithProduct = (product: Product) => {
    setEditingOrder(null);
    setOrderNumber(`PED-${Date.now().toString().slice(-6)}`);
    setMarketplace(
      product.preferredMarketplace && product.preferredMarketplace !== 'Todos'
        ? product.preferredMarketplace
        : 'Mercado Livre'
    );
    setSaleDate(new Date().toISOString().split('T')[0]);
    setExpectedTransferDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const gross = product.referencePrice || 0;
    const estFees = Math.round(gross * 0.18 * 100) / 100;
    setKnownFeesAmount(estFees);
    setEstimatedTransferAmount(Math.round((gross - estFees) * 100) / 100);
    setNotes(product.notes || '');
    setLogisticStatus('aguardando_compra');
    setItems([
      {
        id: 'item_' + Date.now(),
        productId: product.id,
        productName: product.name + (product.modelOrVariation ? ` - ${product.modelOrVariation}` : ''),
        sku: product.internalCode || '',
        quantity: 1,
        unitPrice: product.referencePrice,
        unitCost: product.habitualCost,
        isPurchased: false,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleSelectCatalogProduct = (itemId: string, selectedProdId: string) => {
    if (!selectedProdId) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, productId: undefined } : it))
      );
      return;
    }

    const prod = catalogProducts.find((p) => p.id === selectedProdId);
    if (!prod) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            productId: prod.id,
            productName: prod.name + (prod.modelOrVariation ? ` - ${prod.modelOrVariation}` : ''),
            sku: prod.internalCode || it.sku || '',
            unitCost: prod.habitualCost,
            unitPrice: prod.referencePrice,
          };
        }
        return it;
      })
    );
  };

  const handleQuickSaveToCatalog = (item: {
    productName: string;
    sku?: string;
    unitPrice: number;
    unitCost: number;
  }) => {
    if (!item.productName.trim()) {
      alert('Informe o nome do produto para salvar no catálogo.');
      return;
    }

    const newProd: Product = {
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      name: item.productName.trim(),
      internalCode: item.sku?.trim() || undefined,
      category: 'Geral',
      habitualCost: Math.max(0, item.unitCost),
      referencePrice: Math.max(0, item.unitPrice),
      preferredMarketplace: marketplace,
      notes: 'Cadastrado a partir do registro de venda.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    productsRepo.save(newProd);
    setCatalogProducts(productsRepo.list(userId));
    setToastMsg(`Produto "${newProd.name}" salvo no catálogo com sucesso!`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Open modal for creating new order
  const handleOpenCreateModal = () => {
    setEditingOrder(null);
    setOrderNumber(`PED-${Date.now().toString().slice(-6)}`);
    setMarketplace('Mercado Livre');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setExpectedTransferDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setKnownFeesAmount(0);
    setEstimatedTransferAmount(0);
    setNotes('');
    setLogisticStatus('aguardando_compra');
    setItems([
      {
        id: 'item_' + Date.now(),
        productName: '',
        sku: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        isPurchased: false,
      },
    ]);
    setIsModalOpen(true);
  };

  // Open modal for editing order
  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
    setOrderNumber(order.orderNumber);
    setMarketplace(order.marketplace);
    setSaleDate(order.saleDate);
    setExpectedTransferDate(order.expectedTransferDate);
    setKnownFeesAmount(order.knownFeesAmount);
    setEstimatedTransferAmount(order.estimatedTransferAmount);
    setNotes(order.notes || '');
    setLogisticStatus(order.logisticStatus);
    setItems(
      order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        sku: i.sku || '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: i.unitCost,
        isPurchased: !!i.isPurchased,
      }))
    );
    setIsModalOpen(true);
  };

  // Auto calculate estimated gross and transfer when prices change
  const calculatedGross = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  }, [items]);

  const calculatedTotalCost = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0);
  }, [items]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        productName: '',
        sku: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        isPurchased: false,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (
    id: string,
    field: 'productName' | 'sku' | 'quantity' | 'unitPrice' | 'unitCost' | 'isPurchased',
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          return updated;
        }
        return item;
      })
    );
  };

  // Automatically adjust estimated transfer when gross or fees change
  const handleAutoEstimateTransfer = () => {
    // Default rule: Gross - Fees (or ~82% if fees are 0)
    if (knownFeesAmount > 0) {
      setEstimatedTransferAmount(Math.max(0, calculatedGross - knownFeesAmount));
    } else {
      // rough 18% marketplace commission estimation
      setEstimatedTransferAmount(Math.round(calculatedGross * 0.82 * 100) / 100);
      setKnownFeesAmount(Math.round(calculatedGross * 0.18 * 100) / 100);
    }
  };

  // Save order
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderNumber.trim()) {
      alert('Por favor, informe o número do pedido.');
      return;
    }

    // Check duplicate order number if new order
    if (!editingOrder) {
      const existing = ordersRepo.findByOrderNumber(userId, orderNumber);
      if (existing) {
        alert(`Atenção: Já existe um pedido cadastrado com o número "${orderNumber}".`);
        return;
      }
    }

    const orderItems: OrderItem[] = items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName.trim() || 'Produto sem identificação',
      sku: i.sku.trim() || undefined,
      quantity: Math.max(1, i.quantity),
      unitPrice: Math.max(0, i.unitPrice),
      unitCost: Math.max(0, i.unitCost),
      totalPrice: Math.max(1, i.quantity) * Math.max(0, i.unitPrice),
      totalCost: Math.max(1, i.quantity) * Math.max(0, i.unitCost),
      isPurchased: i.isPurchased,
    }));

    const finalGross = orderItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

    const savedOrder: Order = {
      id: editingOrder ? editingOrder.id : 'ord_' + Date.now(),
      userId,
      orderNumber: orderNumber.trim(),
      marketplace,
      saleDate,
      items: orderItems,
      grossAmount: finalGross,
      estimatedTransferAmount: Number(estimatedTransferAmount) || 0,
      knownFeesAmount: Number(knownFeesAmount) || 0,
      expectedTransferDate,
      notes: notes.trim(),
      logisticStatus,
      transferStatus: editingOrder ? editingOrder.transferStatus : 'pendente',
      actualTransferAmount: editingOrder ? editingOrder.actualTransferAmount : 0,
      actualTransferDate: editingOrder?.actualTransferDate,
      transferDivergence: editingOrder ? editingOrder.transferDivergence : 0,
      createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ordersRepo.save(savedOrder);
    refreshOrders();
    setIsModalOpen(false);
  };

  // Delete order
  const handleDeleteOrder = (orderId: string) => {
    if (confirm('Tem certeza que deseja excluir este pedido? As movimentações serão recalculadas.')) {
      ordersRepo.delete(userId, orderId);
      refreshOrders();
    }
  };

  // Toggle item purchased status directly from table
  const handleToggleItemPurchased = (order: Order, itemId: string) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return { ...it, isPurchased: !it.isPurchased };
      }
      return it;
    });

    const allPurchased = updatedItems.every((it) => it.isPurchased);
    const newLogisticStatus: OrderLogisticStatus = allPurchased
      ? order.logisticStatus === 'aguardando_compra'
        ? 'produto_comprado'
        : order.logisticStatus
      : 'aguardando_compra';

    const updatedOrder: Order = {
      ...order,
      items: updatedItems,
      logisticStatus: newLogisticStatus,
      updatedAt: new Date().toISOString(),
    };

    ordersRepo.save(updatedOrder);
    refreshOrders();
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Marketplace filter
      if (filterMarketplace !== 'todos' && o.marketplace !== filterMarketplace) {
        return false;
      }
      // Status filter
      if (filterStatus !== 'todos') {
        if (filterStatus === 'aguardando_compra' && o.logisticStatus !== 'aguardando_compra') {
          return false;
        }
        if (filterStatus === 'pendente_repasse' && o.transferStatus !== 'pendente') {
          return false;
        }
        if (filterStatus === 'concluido' && o.logisticStatus !== 'pedido_concluido') {
          return false;
        }
      }
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesNumber = o.orderNumber.toLowerCase().includes(query);
        const matchesProduct = o.items.some((i) => i.productName.toLowerCase().includes(query));
        if (!matchesNumber && !matchesProduct) return false;
      }
      return true;
    });
  }, [orders, filterMarketplace, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast flutuante de feedback */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-in fade-in duration-150">
          {toastMsg}
        </div>
      )}

      {/* Header & New Order Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Vendas e Pedidos
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Registro manual detalhado, controle logístico e acompanhamento de produtos a comprar.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nova Venda</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por número do pedido ou nome do produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Marketplace Filter */}
          <select
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todos os Marketplaces</option>
            <option value="Mercado Livre">Mercado Livre</option>
            <option value="Shopee">Shopee</option>
            <option value="TikTok Shop">TikTok Shop</option>
            <option value="Outro">Outro</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todas as Situações</option>
            <option value="aguardando_compra">Aguardando Compra (Fornecedor)</option>
            <option value="pendente_repasse">Repasse Pendente</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Pedido / Marketplace</th>
                <th className="py-3 px-4">Data Venda</th>
                <th className="py-3 px-4">Produtos & Qtd</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Repasse Est.</th>
                <th className="py-3 px-4 text-center">Status Fornecedor</th>
                <th className="py-3 px-4 text-center">Situação Logística</th>
                <th className="py-3 px-4 text-center">Situação Repasse</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Nenhum pedido encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const hasPurchasedPending = ord.items.some((i) => !i.isPurchased);
                  const hasIncompleteCost = ord.items.some((i) => i.unitCost <= 0);

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Pedido / Canal */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ord.orderNumber}</div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <span>{ord.marketplace}</span>
                          {ord.notes && <span title={ord.notes}>· 📝</span>}
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {ord.saleDate}
                      </td>

                      {/* Produtos & Itens */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {ord.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">
                                {item.quantity}x {item.productName}
                              </span>
                              {item.unitCost <= 0 && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-medium">
                                  Custo pendente
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Valor Bruto */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                        {formatCurrency(ord.grossAmount)}
                      </td>

                      {/* Repasse Estimado */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(ord.estimatedTransferAmount)}
                        </span>
                        {ord.actualTransferAmount > 0 && (
                          <div className="text-[11px] text-emerald-700 font-medium">
                            Recebido: {formatCurrency(ord.actualTransferAmount)}
                          </div>
                        )}
                      </td>

                      {/* Status Fornecedor (Comprar pós-venda) */}
                      <td className="py-3.5 px-4 text-center">
                        {hasPurchasedPending ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleItemPurchased(ord, ord.items.find((i) => !i.isPurchased)?.id || '')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
                            title="Clique para marcar produto como comprado do fornecedor"
                          >
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span>A comprar</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Comprado</span>
                          </span>
                        )}
                      </td>

                      {/* Situação Logística */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium ${
                            ord.logisticStatus === 'pedido_concluido'
                              ? 'bg-slate-100 text-slate-700 font-semibold'
                              : ord.logisticStatus === 'pedido_enviado'
                              ? 'bg-blue-50 text-blue-800'
                              : ord.logisticStatus === 'pedido_cancelado'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {ord.logisticStatus === 'venda_registrada' && 'Venda Registrada'}
                          {ord.logisticStatus === 'aguardando_compra' && 'Aguardando Compra'}
                          {ord.logisticStatus === 'produto_comprado' && 'Produto Comprado'}
                          {ord.logisticStatus === 'pedido_enviado' && 'Pedido Enviado'}
                          {ord.logisticStatus === 'pedido_concluido' && 'Pedido Concluído'}
                          {ord.logisticStatus === 'pedido_cancelado' && 'Cancelado'}
                        </span>
                      </td>

                      {/* Situação Repasse */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            ord.transferStatus === 'recebido_integral'
                              ? 'bg-emerald-100 text-[#064E3B]'
                              : ord.transferStatus === 'recebido_divergente'
                              ? 'bg-amber-100 text-amber-900'
                              : ord.transferStatus === 'recebido_parcial'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ord.transferStatus === 'recebido_integral' && 'Recebido Integral'}
                          {ord.transferStatus === 'recebido_divergente' && 'Divergente'}
                          {ord.transferStatus === 'recebido_parcial' && 'Parcial'}
                          {ord.transferStatus === 'pendente' && 'Pendente'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(ord)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar pedido"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir pedido"
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

      {/* Modal de Cadastro / Edição de Venda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingOrder ? 'Editar Venda' : 'Registrar Nova Venda'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Marketplace */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marketplace
                  </label>
                  <select
                    value={marketplace}
                    onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  >
                    <option value="Mercado Livre">Mercado Livre</option>
                    <option value="Shopee">Shopee</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* Número do pedido */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número do Pedido
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex: MLB-123456"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>

                {/* Data da venda */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data da Venda
                  </label>
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Produtos do Pedido ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-[#064E3B] hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Adicionar outro produto</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                    >
                      {/* Seletor Rápido do Catálogo de Produtos */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <Package className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <select
                            value={item.productId || ''}
                            onChange={(e) => handleSelectCatalogProduct(item.id, e.target.value)}
                            className="w-full text-[11px] p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium truncate"
                          >
                            <option value="">-- Preencher a partir do Catálogo de Produtos --</option>
                            {catalogProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.modelOrVariation ? `(${p.modelOrVariation})` : ''} · Custo Ref: {formatCurrency(p.habitualCost)} · Preço Ref: {formatCurrency(p.referencePrice)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {item.productName.trim() && !item.productId && (
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickSaveToCatalog({
                                productName: item.productName,
                                sku: item.sku,
                                unitPrice: item.unitPrice,
                                unitCost: item.unitCost,
                              })
                            }
                            className="text-[11px] font-semibold text-[#064E3B] hover:underline flex items-center gap-1 shrink-0 py-0.5"
                            title="Salvar este produto no catálogo para agilizar vendas futuras"
                          >
                            <PackagePlus className="w-3 h-3 text-emerald-700" />
                            <span>+ Salvar no Catálogo</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nome / Identificação do produto"
                          value={item.productName}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'productName', e.target.value)
                          }
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                'quantity',
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Preço Venda Unit. (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                'unitPrice',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Custo Unit. Fornecedor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00 se pendente"
                            value={item.unitCost}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                'unitCost',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center pt-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700 font-medium">
                            <input
                              type="checkbox"
                              checked={item.isPurchased}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'isPurchased', e.target.checked)
                              }
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Já comprado?</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Valores Financeiros do Pedido */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor Bruto da Venda
                  </label>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900">
                    {formatCurrency(calculatedGross)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Taxas da Plataforma (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={knownFeesAmount}
                    onChange={(e) => setKnownFeesAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Repasse Estimado (R$)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoEstimateTransfer}
                      className="text-[10px] text-emerald-700 hover:underline font-bold"
                    >
                      Calcular
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={estimatedTransferAmount}
                    onChange={(e) => setEstimatedTransferAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-emerald-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Data prevista e Situação Logística */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Previsão para Receber Repasse
                  </label>
                  <input
                    type="date"
                    value={expectedTransferDate}
                    onChange={(e) => setExpectedTransferDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Situação Logística do Pedido
                  </label>
                  <select
                    value={logisticStatus}
                    onChange={(e) => setLogisticStatus(e.target.value as OrderLogisticStatus)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                  >
                    <option value="venda_registrada">Venda registrada</option>
                    <option value="aguardando_compra">Produto aguardando compra</option>
                    <option value="produto_comprado">Produto comprado</option>
                    <option value="pedido_enviado">Pedido enviado</option>
                    <option value="pedido_concluido">Pedido concluído</option>
                    <option value="pedido_cancelado">Pedido cancelado</option>
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações sobre o frete, rastreio, notas de fornecedor..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs"
                >
                  Salvar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
