import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  ShoppingBag,
  Tag,
  ArrowUpDown,
  Building,
  Layers,
  X,
  Info,
} from 'lucide-react';
import { productsRepo, logsRepo } from '../services/db';
import { Product, Marketplace } from '../types/finance';
import { formatCurrency } from '../utils/pricing';
import { CurrencyInput } from '../components/common/CurrencyInput';

interface ProductsPageProps {
  userId: string;
  onNavigateToNewSale?: (product: Product) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  userId,
  onNavigateToNewSale,
}) => {
  const [products, setProducts] = useState<Product[]>(() =>
    productsRepo.list(userId, true)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'arquivados' | 'todos'>('ativos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'name' | 'price_desc' | 'price_asc' | 'cost_asc' | 'recent'>('recent');

  // Network online/offline status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      productsRepo.syncAll(userId);
      setProducts(productsRepo.list(userId, true));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  // Modal State for Manual Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Modal State for Details View
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [modelOrVariation, setModelOrVariation] = useState('');
  const [description, setDescription] = useState('');
  const [habitualCost, setHabitualCost] = useState<number>(0);
  const [referencePrice, setReferencePrice] = useState<number>(0);
  const [preferredMarketplace, setPreferredMarketplace] = useState<Marketplace | 'Todos'>('Todos');
  const [notes, setNotes] = useState('');

  const refreshProducts = () => {
    setProducts(productsRepo.list(userId, true));
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setInternalCode('');
    setCategory('');
    setBrand('');
    setModelOrVariation('');
    setDescription('');
    setHabitualCost(0);
    setReferencePrice(0);
    setPreferredMarketplace('Todos');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setInternalCode(product.internalCode || '');
    setCategory(product.category || '');
    setBrand(product.brand || '');
    setModelOrVariation(product.modelOrVariation || '');
    setDescription(product.description || '');
    setHabitualCost(product.habitualCost);
    setReferencePrice(product.referencePrice);
    setPreferredMarketplace(product.preferredMarketplace || 'Todos');
    setNotes(product.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Informe o nome do produto.');
      return;
    }

    const saved: Product = {
      id: editingProduct ? editingProduct.id : 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      name: name.trim(),
      internalCode: internalCode.trim() || undefined,
      category: category.trim() || 'Geral',
      brand: brand.trim() || undefined,
      modelOrVariation: modelOrVariation.trim() || undefined,
      description: description.trim() || undefined,
      habitualCost: Math.max(0, habitualCost),
      referencePrice: Math.max(0, referencePrice),
      preferredMarketplace,
      notes: notes.trim() || undefined,
      isArchived: editingProduct ? editingProduct.isArchived : false,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    productsRepo.save(saved);
    logsRepo.addLog(
      userId,
      'login',
      `${editingProduct ? 'Atualização' : 'Cadastro'} de produto no catálogo: ${saved.name}`
    );

    refreshProducts();
    setIsModalOpen(false);
  };

  const handleToggleArchive = (product: Product) => {
    if (product.isArchived) {
      productsRepo.unarchive(userId, product.id);
      logsRepo.addLog(userId, 'login', `Reativação de produto no catálogo: ${product.name}`);
    } else {
      productsRepo.archive(userId, product.id);
      logsRepo.addLog(userId, 'login', `Arquivamento de produto no catálogo: ${product.name}`);
    }
    refreshProducts();
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    if (confirm(`Tem certeza que deseja excluir o produto "${productName}" do catálogo? As vendas já registradas NÃO serão alteradas.`)) {
      productsRepo.delete(userId, productId);
      logsRepo.addLog(userId, 'login', `Exclusão de produto do catálogo: ${productName}`);
      refreshProducts();
    }
  };

  // Distinct categories available in user's products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      // Status filter
      if (statusFilter === 'ativos' && p.isArchived) return false;
      if (statusFilter === 'arquivados' && !p.isArchived) return false;

      // Category filter
      if (categoryFilter !== 'todos' && p.category !== categoryFilter) return false;

      // Marketplace filter
      if (
        marketplaceFilter !== 'todos' &&
        p.preferredMarketplace &&
        p.preferredMarketplace !== 'Todos' &&
        p.preferredMarketplace !== marketplaceFilter
      ) {
        return false;
      }

      // Search term (by name, brand, code)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.internalCode ? p.internalCode.toLowerCase().includes(q) : false;
        const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        const matchCat = p.category ? p.category.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchBrand && !matchCat) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price_desc') return b.referencePrice - a.referencePrice;
      if (sortBy === 'price_asc') return a.referencePrice - b.referencePrice;
      if (sortBy === 'cost_asc') return a.habitualCost - b.habitualCost;
      // Default: recent
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [products, statusFilter, categoryFilter, marketplaceFilter, searchTerm, sortBy]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & New Product Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Catálogo de Produtos Cadastrados
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Gerencie itens pré-cadastrados com custo habitual e preço de referência para agilizar o lançamento de vendas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Online/Offline Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
            title={isOnline ? 'Online: Sincronizado' : 'Offline: Salvo localmente no dispositivo'}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{isOnline ? 'Sincronizado' : 'Modo Offline Ativo'}</span>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Philosophy Banner: Sem estoque próprio */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900">Catálogo Desacoplado de Estoque:</span> O cadastro
          de um produto serve como tabela de referência (nome, custo habitual e preço ideal sugerido).
          Ele <strong>não pressupõe estoque físico</strong> nem altera as vendas passadas caso os preços sejam editados.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por nome do produto, código SKU, marca ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status (Ativos / Arquivados) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="ativos">Produtos Ativos</option>
            <option value="arquivados">Arquivados</option>
            <option value="todos">Todos os Produtos</option>
          </select>

          {/* Categoria */}
          {availableCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="todos">Todas Categorias</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Nome (A - Z)</option>
            <option value="price_desc">Maior Preço de Ref.</option>
            <option value="price_asc">Menor Preço de Ref.</option>
            <option value="cost_asc">Menor Custo Habitual</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto & Variação</th>
                <th className="py-3 px-4">Código / SKU</th>
                <th className="py-3 px-4">Categoria & Marca</th>
                <th className="py-3 px-4 text-right">Custo Habitual</th>
                <th className="py-3 px-4 text-right">Preço de Referência</th>
                <th className="py-3 px-4 text-center">Canal Preferencial</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nenhum produto encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const estMargin =
                    prod.referencePrice > 0
                      ? ((prod.referencePrice - prod.habitualCost) / prod.referencePrice) * 100
                      : 0;

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        prod.isArchived ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Nome e Variação */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{prod.name}</div>
                        {prod.modelOrVariation && (
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {prod.modelOrVariation}
                          </div>
                        )}
                      </td>

                      {/* Código SKU */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {prod.internalCode || '—'}
                      </td>

                      {/* Categoria & Marca */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{prod.category || 'Geral'}</div>
                        {prod.brand && (
                          <div className="text-[11px] text-slate-400">{prod.brand}</div>
                        )}
                      </td>

                      {/* Custo Habitual */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-800">
                        {formatCurrency(prod.habitualCost)}
                      </td>

                      {/* Preço de Referência */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-emerald-800">
                        {formatCurrency(prod.referencePrice)}
                      </td>

                      {/* Marketplace Preferencial */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {prod.preferredMarketplace || 'Todos'}
                        </span>
                      </td>

                      {/* Status Ativo/Arquivado */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            prod.isArchived
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-[#064E3B]'
                          }`}
                        >
                          {prod.isArchived ? 'Arquivado' : 'Ativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Registrar Venda com Este Produto */}
                          {onNavigateToNewSale && !prod.isArchived && (
                            <button
                              type="button"
                              onClick={() => onNavigateToNewSale(prod)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#064E3B] font-semibold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                              title="Registrar venda utilizando este produto"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Vender</span>
                            </button>
                          )}

                          {/* Ver Detalhes */}
                          <button
                            type="button"
                            onClick={() => setViewingProduct(prod)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ver ficha detalhada"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(prod)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar cadastro"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Arquivar / Reativar */}
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(prod)}
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title={prod.isArchived ? 'Reativar produto' : 'Arquivar produto'}
                          >
                            {prod.isArchived ? (
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir produto"
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

      {/* MODAL: Cadastrar / Editar Produto Manualmente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Editar Produto do Catálogo' : 'Cadastrar Novo Produto'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do Produto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fone de Ouvido Bluetooth Sem Fio TWS..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Código Interno / SKU (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PROD-9981"
                    value={internalCode}
                    onChange={(e) => setInternalCode(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Eletrônicos, Vestuário, Casa..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Marca (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Marca própria ou fabricante..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Modelo, Volume ou Variação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tamanho M, Preto, 500ml..."
                    value={modelOrVariation}
                    onChange={(e) => setModelOrVariation(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Custo de Compra Habitual (R$)
                  </label>
                  <div className="w-full bg-white border border-slate-200 rounded-lg">
                    <CurrencyInput
                      value={habitualCost}
                      onChange={setHabitualCost}
                      placeholder="0,00"
                      className="w-full p-2 bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Preço médio que você paga ao fornecedor.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Preço de Venda de Referência (R$)
                  </label>
                  <div className="w-full bg-white border border-slate-200 rounded-lg">
                    <CurrencyInput
                      value={referencePrice}
                      onChange={setReferencePrice}
                      placeholder="0,00"
                      className="w-full p-2 bg-transparent font-mono font-bold text-emerald-900 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Preço sugerido para anúncios nos marketplaces.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Marketplace Preferencial
                  </label>
                  <select
                    value={preferredMarketplace}
                    onChange={(e) => setPreferredMarketplace(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Todos">Todos / Sem preferência</option>
                    <option value="Mercado Livre">Mercado Livre</option>
                    <option value="Shopee">Shopee</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Observações do Produto
                  </label>
                  <input
                    type="text"
                    placeholder="Link do fornecedor, prazos, observações..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição Completa (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais, especificações técnicas ou cuidados..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
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
                  {editingProduct ? 'Salvar Alterações' : 'Salvar no Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visualizar Detalhes do Produto */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#064E3B]" />
                <h3 className="text-base font-bold text-slate-900">
                  Ficha do Produto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Nome do Produto</span>
                <p className="font-bold text-slate-900 text-sm">{viewingProduct.name}</p>
                {viewingProduct.modelOrVariation && (
                  <p className="text-slate-600 font-medium">{viewingProduct.modelOrVariation}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Custo Habitual:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatCurrency(viewingProduct.habitualCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Preço de Referência:</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {formatCurrency(viewingProduct.referencePrice)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 text-[10px] block">Código / SKU</span>
                  <span className="font-mono">{viewingProduct.internalCode || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Categoria</span>
                  <span>{viewingProduct.category || 'Geral'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Marca</span>
                  <span>{viewingProduct.brand || 'Não informada'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Marketplace Preferencial</span>
                  <span>{viewingProduct.preferredMarketplace || 'Todos'}</span>
                </div>
              </div>

              {viewingProduct.description && (
                <div>
                  <span className="text-slate-400 text-[10px] block">Descrição</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-lg mt-0.5">{viewingProduct.description}</p>
                </div>
              )}

              {viewingProduct.notes && (
                <div>
                  <span className="text-slate-400 text-[10px] block">Observações</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-lg mt-0.5">{viewingProduct.notes}</p>
                </div>
              )}

              <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 flex justify-between">
                <span>Criado em: {new Date(viewingProduct.createdAt).toLocaleDateString('pt-BR')}</span>
                <span>Atualizado: {new Date(viewingProduct.updatedAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const prod = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEditModal(prod);
                }}
                className="text-xs font-semibold text-slate-700 hover:underline"
              >
                Editar este produto
              </button>

              {onNavigateToNewSale && !viewingProduct.isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    const prod = viewingProduct;
                    setViewingProduct(null);
                    onNavigateToNewSale(prod);
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Registrar Venda com Este Item</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
