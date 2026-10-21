import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  X,
  Tag,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { expensesRepo, logsRepo } from '../services/db';
import {
  Expense,
  ExpenseCategory,
  Installment,
  Marketplace,
  PaymentMethod,
  PaymentStatus,
} from '../types/finance';
import { formatCurrency } from '../utils/pricing';
import { CurrencyInput } from '../components/common/CurrencyInput';

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  'Embalagens e Caixas',
  'Etiquetas e Fita Adesiva',
  'Papel e Impressão',
  'Materiais de Envio',
  'Transporte e Uber',
  'Combustível',
  'Publicidade e Anúncios',
  'Tarifas e Serviços',
  'Software e Assinaturas',
  'Compras Diversas Operacionais',
  'Outras Despesas',
];

interface ExpensesPageProps {
  userId: string;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ userId }) => {
  const [expenses, setExpenses] = useState<Expense[]>(() => expensesRepo.list(userId));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterMarketplace, setFilterMarketplace] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form Fields
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [relatedMarketplace, setRelatedMarketplace] = useState<
    Marketplace | 'Operação Geral'
  >('Operação Geral');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pago');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isExternalCreditCardItem, setIsExternalCreditCardItem] = useState(false);

  // Installments state
  const [numInstallments, setNumInstallments] = useState<number>(1);
  const [installments, setInstallments] = useState<Installment[]>([]);

  const refreshData = () => {
    setExpenses(expensesRepo.list(userId));
  };

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
        id: 'exp_inst_' + Date.now() + '_' + i,
        installmentNumber: i,
        totalInstallments: count,
        amount: amt,
        dueDate: dueStr,
        status: isPaid ? 'pago' : 'pendente',
        paidDate: isPaid ? expenseDate : undefined,
        paymentMethod: method,
      });
    }

    return list;
  };

  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setDescription('');
    setCategory(DEFAULT_CATEGORIES[0]);
    setIsCustomCategory(false);
    setCustomCategory('');
    setAmount(0);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date().toISOString().split('T')[0]);
    setRelatedMarketplace('Operação Geral');
    setPaymentMethod('Pix');
    setPaymentStatus('pago');
    setNotes('');
    setReceiptUrl('');
    setIsExternalCreditCardItem(false);
    setNumInstallments(1);
    setInstallments([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setDescription(exp.description);
    if (DEFAULT_CATEGORIES.includes(exp.category as any)) {
      setCategory(exp.category);
      setIsCustomCategory(false);
    } else {
      setIsCustomCategory(true);
      setCustomCategory(exp.category);
    }
    setAmount(exp.amount);
    setExpenseDate(exp.expenseDate);
    setDueDate(exp.dueDate || exp.expenseDate);
    setRelatedMarketplace(exp.relatedMarketplace);
    setPaymentMethod(exp.paymentMethod);
    setPaymentStatus(exp.paymentStatus);
    setNotes(exp.notes || '');
    setReceiptUrl(exp.receiptUrl || '');
    setIsExternalCreditCardItem(!!exp.isExternalCreditCardItem);
    setNumInstallments(exp.installments.length || 1);
    setInstallments(exp.installments || []);
    setIsModalOpen(true);
  };

  const handleToggleInstallmentStatus = (exp: Expense, installmentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = exp.installments.map((inst) => {
      if (inst.id === installmentId) {
        const next: 'pago' | 'pendente' = inst.status === 'pago' ? 'pendente' : 'pago';
        return {
          ...inst,
          status: next,
          paidDate: next === 'pago' ? today : undefined,
        };
      }
      return inst;
    });

    const allPaid = updated.every((i) => i.status === 'pago');
    const somePaid = updated.some((i) => i.status === 'pago');

    let overall: PaymentStatus = 'nao_pago';
    if (allPaid) overall = 'pago';
    else if (somePaid) overall = 'parcialmente_pago';
    else if (updated.length > 1) overall = 'parcelado';

    const saved: Expense = {
      ...exp,
      paymentStatus: overall,
      installments: updated,
      updatedAt: new Date().toISOString(),
    };

    expensesRepo.save(saved);
    logsRepo.addLog(userId, 'login', `Alteração de parcela na despesa: ${exp.description}`);
    refreshData();
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      alert('Informe a descrição do gasto.');
      return;
    }

    const finalCategory = isCustomCategory
      ? customCategory.trim() || 'Outras Despesas'
      : category;

    let finalInstallments = installments;
    if (finalInstallments.length === 0 || finalInstallments.length !== numInstallments) {
      finalInstallments = generateInstallments(
        amount,
        numInstallments,
        paymentStatus,
        dueDate,
        paymentMethod
      );
    }

    const saved: Expense = {
      id: editingExpense ? editingExpense.id : 'exp_' + Date.now(),
      userId,
      description: description.trim(),
      category: finalCategory,
      amount: Math.max(0, amount),
      expenseDate,
      dueDate,
      relatedMarketplace,
      paymentMethod,
      paymentStatus,
      installments: finalInstallments,
      notes: notes.trim(),
      receiptUrl: receiptUrl.trim() || undefined,
      isExternalCreditCardItem,
      createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expensesRepo.save(saved);
    refreshData();
    setIsModalOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      expensesRepo.delete(userId, id);
      refreshData();
    }
  };

  // Aggregate Metrics
  const totalOperationalExpenses = useMemo(() => {
    return expenses
      .filter((e) => !e.isExternalCreditCardItem)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const totalPaidExpenses = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => {
      if (e.isExternalCreditCardItem) return;
      e.installments.forEach((inst) => {
        if (inst.status === 'pago') sum += inst.amount;
      });
    });
    return sum;
  }, [expenses]);

  const totalPendingExpenses = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => {
      if (e.isExternalCreditCardItem) return;
      e.installments.forEach((inst) => {
        if (inst.status === 'pendente') sum += inst.amount;
      });
    });
    return sum;
  }, [expenses]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory !== 'todos' && e.category !== filterCategory) return false;
      if (filterStatus !== 'todos' && e.paymentStatus !== filterStatus) return false;
      if (filterMarketplace !== 'todos' && e.relatedMarketplace !== filterMarketplace) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (
          !e.description.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, filterCategory, filterStatus, filterMarketplace, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Despesas Operacionais & Gastos por Fora
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Embalagens, caixas, etiquetas térmicas, Uber, anúncios, combustível e despesas gerais do negócio.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Nova Despesa</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total de Gastos Operacionais</span>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(totalOperationalExpenses)}
          </p>
          <span className="text-[11px] text-slate-400">{expenses.length} lançamentos efetuados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Despesas Pagas (Saída de Caixa Hoje)</span>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(totalPaidExpenses)}
          </p>
          <span className="text-[11px] text-slate-400">Deduzido do saldo em caixa</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Contas a Pagar (Pendentes)</span>
          <p className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(totalPendingExpenses)}
          </p>
          <span className="text-[11px] text-slate-400">Na projeção de saídas futuras</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição da despesa ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Categoria */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todas as Categorias</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todas Situações</option>
            <option value="pago">Paga</option>
            <option value="nao_pago">Pendente</option>
            <option value="parcialmente_pago">Parcial</option>
          </select>

          {/* Marketplace */}
          <select
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="todos">Todos os Canais</option>
            <option value="Operação Geral">Operação Geral</option>
            <option value="Mercado Livre">Mercado Livre</option>
            <option value="Shopee">Shopee</option>
            <option value="TikTok Shop">TikTok Shop</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Descrição & Categoria</th>
                <th className="py-3 px-4">Canal / Escopo</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4">Data & Vencimento</th>
                <th className="py-3 px-4">Forma</th>
                <th className="py-3 px-4 text-center">Situação</th>
                <th className="py-3 px-4">Parcelas</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Nenhuma despesa operacional encontrada.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      exp.isExternalCreditCardItem ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{exp.description}</span>
                        {exp.isExternalCreditCardItem && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                            Gasto Pessoal Fatura (Ignorado)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {exp.category}
                        {exp.notes && ` · 📝 ${exp.notes}`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {exp.relatedMarketplace}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {formatCurrency(exp.amount)}
                    </td>

                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                      <div>Data: {exp.expenseDate}</div>
                      {exp.dueDate && (
                        <div className="text-[11px] text-slate-400">Venc: {exp.dueDate}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {exp.paymentMethod}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          exp.paymentStatus === 'pago'
                            ? 'bg-emerald-100 text-[#064E3B]'
                            : exp.paymentStatus === 'parcialmente_pago'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {exp.paymentStatus === 'pago' && 'Paga'}
                        {exp.paymentStatus === 'nao_pago' && 'Pendente'}
                        {exp.paymentStatus === 'parcialmente_pago' && 'Parcial'}
                        {exp.paymentStatus === 'parcelado' && 'Parcelada'}
                      </span>
                    </td>

                    {/* Parcelas */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {exp.installments.map((inst) => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => handleToggleInstallmentStatus(exp, inst.id)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-colors text-left ${
                              inst.status === 'pago'
                                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                            title="Alternar entre Pago e Pendente"
                          >
                            <span>
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

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançar / Editar Despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingExpense ? 'Editar Despesa' : 'Lançar Nova Despesa Operacional'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição do Gasto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 50 Caixas de papelão 20x20x15, Bobina etiquetas, Uber correios..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Categoria</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[10px] text-emerald-700 hover:underline font-bold"
                    >
                      {isCustomCategory ? 'Usar padrão' : '+ Criar nova'}
                    </button>
                  </div>
                  {isCustomCategory ? (
                    <input
                      type="text"
                      placeholder="Nome da nova categoria"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    />
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Valor */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor (R$)
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600">
                    <CurrencyInput
                      value={amount}
                      onChange={(val) => {
                        setAmount(val);
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data do Gasto
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vencimento
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Marketplace / Canal
                  </label>
                  <select
                    value={relatedMarketplace}
                    onChange={(e) => setRelatedMarketplace(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Operação Geral">Operação Geral</option>
                    <option value="Mercado Livre">Mercado Livre</option>
                    <option value="Shopee">Shopee</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Pix">Pix (À vista)</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Débito">Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Outro">Outro</option>
                  </select>
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
                        generateInstallments(amount, count, paymentStatus, dueDate, paymentMethod)
                      );
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x {n > 1 ? `de ${formatCurrency(amount / n)}` : '(À vista)'}
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
                    Paga (Saída hoje)
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
                    Pendente (A pagar)
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
                    Parcelada
                  </button>
                </div>
              </div>

              {/* Regra de Fatura de Cartão: Permitir marcar se for despesa pessoal/externa */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isExternalCreditCardItem}
                    onChange={(e) => setIsExternalCreditCardItem(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>
                    Item pessoal / externo à operação (não contabilizar no lucro da LucraiBR)
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 pl-6">
                  Útil para conferir a fatura do cartão de crédito sem misturar compras pessoais com os custos do marketplace.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações / Link do Comprovante (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Observação ou link do anexo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
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
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
