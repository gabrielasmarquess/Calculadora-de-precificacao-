import React, { useState, useEffect } from 'react';
import {
  User,
  Building,
  Mail,
  ShieldCheck,
  Download,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Package,
  ShoppingBag,
  Truck,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { authService } from '../services/auth';
import {
  exportDeviceBackupJson,
  detectAndPreserveAllDeviceData,
  productsRepo,
  ordersRepo,
  purchasesRepo,
  expensesRepo,
} from '../services/db';
import { UserProfile } from '../types/finance';

interface AccountPageProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onProfileUpdated: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  // Stats for local data transparency
  const [counts, setCounts] = useState({
    products: 0,
    orders: 0,
    purchases: 0,
    expenses: 0,
  });

  const loadStats = () => {
    try {
      const p = productsRepo.list(currentUser.id, true).length;
      const o = ordersRepo.list(currentUser.id).length;
      const pur = purchasesRepo.list(currentUser.id).length;
      const e = expensesRepo.list(currentUser.id).length;
      setCounts({ products: p, orders: o, purchases: pur, expenses: e });
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    setName(currentUser.name);
    setCompanyName(currentUser.companyName || '');
    loadStats();
  }, [currentUser.id, currentUser.name, currentUser.companyName]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    const res = await authService.updateProfile(name, companyName);
    if (res.success) {
      setSuccessMsg('Dados da sua operação atualizados com sucesso!');
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleDownloadBackup = () => {
    const res = exportDeviceBackupJson();
    if (res.success) {
      setBackupMsg(`Arquivo de backup baixado com sucesso contendo ${res.totalRecords} registro(s)!`);
      loadStats();
      setTimeout(() => setBackupMsg(null), 4000);
    }
  };

  const handleRescanDevice = () => {
    detectAndPreserveAllDeviceData(currentUser.id);
    loadStats();
    setBackupMsg('Memória do aparelho verificada e consolidada com sucesso!');
    setTimeout(() => setBackupMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Minha Operação & Configurações
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Gerencie os dados da sua loja, visualize a integridade do seu banco e gere cópias de segurança.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {backupMsg && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{backupMsg}</span>
        </div>
      )}

      {/* Card 1: Dados da Loja / Vendedor */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Dados da Operação</h2>
            <p className="text-[11px] text-slate-500">
              Identificação do vendedor e nome da sua marca nas telas do sistema.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nome do Responsável
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gabriela Marques"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nome da Loja / Operação Marketplace
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: LucraiBR Vendas Online"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              E-mail de Contato
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Identificador associado aos registros da sua conta.
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="py-2.5 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>

      {/* Card 2: Backup & Preservação Integral de Dados */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center font-bold">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Backup & Preservação dos Dados</h2>
              <p className="text-[11px] text-slate-500">
                Seus dados ficam armazenados localmente no aparelho e sincronizados com a nuvem.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRescanDevice}
            title="Reverificar integridade da memória do aparelho"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Verificar Memória</span>
          </button>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <Package className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
            <span className="text-lg font-black text-slate-900 font-mono block">
              {counts.products}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Produtos Salvos</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <ShoppingBag className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
            <span className="text-lg font-black text-slate-900 font-mono block">
              {counts.orders}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Pedidos & Vendas</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <Truck className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
            <span className="text-lg font-black text-slate-900 font-mono block">
              {counts.purchases}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Compras Fornecedor</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <CreditCard className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
            <span className="text-lg font-black text-slate-900 font-mono block">
              {counts.expenses}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Despesas Cadastradas</span>
          </div>
        </div>

        {/* Protection Banner */}
        <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950">
              <span className="font-bold block text-emerald-950">
                Seus registros estão seguros e protegidos
              </span>
              Você pode baixar uma cópia completa de segurança em arquivo JSON a qualquer momento com apenas 1 clique.
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Backup (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-red-100">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-red-900">Zona de Perigo (Reset)</h2>
            <p className="text-[11px] text-red-600">
              Esta ação apagará TODOS os dados cadastrados. Use apenas se necessário.
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            if (confirm('Tem certeza absoluta? Todos os registros serão permanentemente apagados em todos os aparelhos.')) {
              await fetch('/api/reset-data', { method: 'POST' });
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Zerar todos os dados do aplicativo</span>
        </button>
      </div>
    </div>
  );
};
