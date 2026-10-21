import React, { useState, useEffect } from 'react';
import {
  PackagePlus,
  X,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Building,
  Tag,
  Info,
} from 'lucide-react';
import { productsRepo } from '../../services/db';
import { Product, Marketplace } from '../../types/finance';
import { formatCurrency } from '../../utils/pricing';
import { CurrencyInput } from '../common/CurrencyInput';

interface SaveProductFromCalcModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  habitualCost: number; // Preenchido da calculadora (productCost)
  otherCosts?: number; // Outros custos da calculadora
  referencePrice: number; // Preenchido da calculadora (idealPrice calculado)
  notesFromCalc?: string; // Informações adicionais do cálculo (ex: meta de margem)
  onSuccessSaved: (product: Product) => void;
  onNavigateToCatalog?: () => void;
}

export const SaveProductFromCalcModal: React.FC<SaveProductFromCalcModalProps> = ({
  userId,
  isOpen,
  onClose,
  habitualCost,
  otherCosts,
  referencePrice,
  notesFromCalc,
  onSuccessSaved,
  onNavigateToCatalog,
}) => {
  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [modelOrVariation, setModelOrVariation] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number>(habitualCost);
  const [price, setPrice] = useState<number>(referencePrice);
  const [preferredMarketplace, setPreferredMarketplace] = useState<Marketplace | 'Todos'>('Todos');
  const [notes, setNotes] = useState(notesFromCalc || '');

  // Conflict detection state
  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [userChoice, setUserChoice] = useState<'update' | 'new' | null>(null);

  // Sync state whenever props change
  useEffect(() => {
    if (isOpen) {
      setCost(habitualCost);
      setPrice(referencePrice > 0 ? Math.round(referencePrice * 100) / 100 : 0);
      setNotes(notesFromCalc || '');
      setExistingProduct(null);
      setUserChoice(null);
    }
  }, [isOpen, habitualCost, referencePrice, notesFromCalc]);

  // Check if product already exists when name or internalCode changes
  const checkDuplicate = (nameToCheck: string, codeToCheck: string) => {
    if (nameToCheck.trim().length >= 3) {
      const byName = productsRepo.findByName(userId, nameToCheck);
      if (byName) return byName;
    }
    if (codeToCheck.trim().length >= 2) {
      const byCode = productsRepo.findByCode(userId, codeToCheck);
      if (byCode) return byCode;
    }
    return null;
  };

  const handleNameBlur = () => {
    const found = checkDuplicate(name, internalCode);
    setExistingProduct(found || null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor, informe o nome do produto.');
      return;
    }

    const found = checkDuplicate(name, internalCode);

    // If duplicate detected and user hasn't chosen an action yet, prompt
    if (found && !userChoice) {
      setExistingProduct(found);
      return;
    }

    if (found && userChoice === 'update') {
      // Update existing product
      const updated: Product = {
        ...found,
        name: name.trim(),
        internalCode: internalCode.trim() || undefined,
        category: category.trim() || found.category,
        brand: brand.trim() || found.brand,
        modelOrVariation: modelOrVariation.trim() || found.modelOrVariation,
        description: description.trim() || found.description,
        habitualCost: cost,
        referencePrice: price,
        preferredMarketplace,
        notes: notes.trim() || found.notes,
        updatedAt: new Date().toISOString(),
      };
      productsRepo.save(updated);
      onSuccessSaved(updated);
      onClose();
      return;
    }

    // Save as new product
    const newProduct: Product = {
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      name: name.trim(),
      internalCode: internalCode.trim() || undefined,
      category: category.trim() || 'Geral',
      brand: brand.trim() || undefined,
      modelOrVariation: modelOrVariation.trim() || undefined,
      description: description.trim() || undefined,
      habitualCost: Math.max(0, cost),
      referencePrice: Math.max(0, price),
      preferredMarketplace,
      notes: notes.trim() || undefined,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    productsRepo.save(newProduct);
    onSuccessSaved(newProduct);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center font-bold">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Salvar Produto no Catálogo
              </h3>
              <p className="text-xs text-slate-500">
                Aproveitando custos e preços calculados na calculadora de precificação.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info box: Safe separation confirmation */}
        <div className="my-3 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-950 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            Salvar o produto no catálogo registra seus dados de referência para agilizar futuras vendas.
            <strong> Não cria vendas nem gera lançamentos de caixa.</strong>
          </span>
        </div>

        {/* Duplicate warning & conflict choices */}
        {existingProduct && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Produto similar já cadastrado no seu catálogo!</span>
            </div>
            <p className="text-amber-900">
              Já existe o produto: <strong>"{existingProduct.name}"</strong>
              {existingProduct.internalCode && ` (Código: ${existingProduct.internalCode})`} com custo habitual de {formatCurrency(existingProduct.habitualCost)} e preço ref. de {formatCurrency(existingProduct.referencePrice)}.
            </p>
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUserChoice('update')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  userChoice === 'update'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                ✓ Atualizar este produto existente
              </button>
              <button
                type="button"
                onClick={() => setUserChoice('new')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  userChoice === 'new'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                + Salvar como um novo produto
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nome do Produto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Fone Bluetooth Sem Fio TWS Pro..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Código Interno / SKU (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: SKU-1049"
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                onBlur={handleNameBlur}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Categoria
              </label>
              <input
                type="text"
                placeholder="Ex: Eletrônicos, Casa, Moda..."
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
                placeholder="Ex: Apple, Xiaomi, Genérico..."
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Modelo / Variação / Tamanho
              </label>
              <input
                type="text"
                placeholder="Ex: 1000ml, Tamanho G, Preto..."
                value={modelOrVariation}
                onChange={(e) => setModelOrVariation(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
          </div>

          {/* Dados aproveitados do cálculo da calculadora */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Custo de Compra Habitual (R$)
              </label>
              <div className="w-full bg-white border border-slate-200 rounded-lg">
                <CurrencyInput
                  value={cost}
                  onChange={setCost}
                  placeholder="0,00"
                  className="w-full p-2 bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Vindo do custo do produto na calculadora.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Preço de Venda de Referência (R$)
              </label>
              <div className="w-full bg-white border border-slate-200 rounded-lg">
                <CurrencyInput
                  value={price}
                  onChange={setPrice}
                  placeholder="0,00"
                  className="w-full p-2 bg-transparent font-mono font-bold text-emerald-900 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Vindo do Preço Ideal calculado.
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
                Observações
              </label>
              <input
                type="text"
                placeholder="Fornecedor de confiança, prazos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Salvar no Catálogo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
