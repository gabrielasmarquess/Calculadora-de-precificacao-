import React from 'react';
import {
  Menu,
  Wallet,
  User,
  LogOut,
  TrendingUp,
} from 'lucide-react';
import { UserProfile } from '../../types/finance';
import { formatCurrency } from '../../utils/pricing';

interface NavbarProps {
  currentUser: UserProfile;
  currentSectionTitle: string;
  availableCash: number;
  projectedCash: number;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onNavigateToAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentSectionTitle,
  availableCash,
  projectedCash,
  onToggleSidebar,
  onLogout,
  onNavigateToAccount,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Zone 1: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[#064E3B] text-base tracking-tight lg:hidden">
            LucraiBR
          </span>
          <span className="hidden lg:inline text-slate-400">Plataforma</span>
          <span className="hidden lg:inline text-slate-300">/</span>
          <h2 className="font-semibold text-slate-800 whitespace-nowrap">
            {currentSectionTitle}
          </h2>
        </div>
      </div>

      {/* Zone 2: Real-time Cash Balance Quick Indicator (Tabular nums) */}
      <div className="hidden md:flex items-center gap-4 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-slate-500 font-medium">Disponível em Caixa:</span>
          <span className={`font-mono font-bold tabular-nums ${availableCash >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatCurrency(availableCash)}
          </span>
        </div>
        <div className="h-3 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500 font-medium">Projetado:</span>
          <span className={`font-mono font-semibold tabular-nums ${projectedCash >= 0 ? 'text-slate-700' : 'text-amber-600'}`}>
            {formatCurrency(projectedCash)}
          </span>
        </div>
      </div>

      {/* Zone 3: User Account & Quick Menu */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNavigateToAccount}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
          title="Minha Conta"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#064E3B] font-bold text-xs flex items-center justify-center">
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[120px]">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[120px]">
              {currentUser.companyName || 'Vendedor'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          title="Sair da conta"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
