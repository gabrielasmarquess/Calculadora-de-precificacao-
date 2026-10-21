import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  ShoppingBag,
  Truck,
  Receipt,
  ArrowLeftRight,
  CreditCard,
  FileSpreadsheet,
  ShieldCheck,
  X,
  Store,
  Package,
} from 'lucide-react';

export type NavSection =
  | 'dashboard'
  | 'calculator'
  | 'products'
  | 'orders'
  | 'purchases'
  | 'transfers'
  | 'cashflow'
  | 'expenses'
  | 'import'
  | 'account'
  | 'admin';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpen: boolean;
  onClose: () => void;
  pendingTransfersCount: number;
  pendingPurchasesCount: number;
  productsCount?: number;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpen,
  onClose,
  pendingTransfersCount,
  pendingPurchasesCount,
  productsCount,
  isAdmin,
}) => {
  const navItems: { id: NavSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calculator', label: 'Calculadora', icon: Calculator },
    { id: 'products', label: 'Produtos cadastrados', icon: Package, badge: productsCount },
    { id: 'orders', label: 'Vendas e pedidos', icon: ShoppingBag },
    { id: 'purchases', label: 'Compras e fornecedores', icon: Truck, badge: pendingPurchasesCount },
    { id: 'transfers', label: 'Repasses', icon: Receipt, badge: pendingTransfersCount },
    { id: 'cashflow', label: 'Fluxo de caixa', icon: ArrowLeftRight },
    { id: 'expenses', label: 'Despesas e gastos', icon: CreditCard },
    { id: 'import', label: 'Importação de planilhas', icon: FileSpreadsheet },
    { id: 'account', label: 'Minha conta e segurança', icon: ShieldCheck },
    ...(isAdmin ? [{ id: 'admin' as NavSection, label: 'Painel Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#064E3B] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-[#064E3B] tracking-tight">
                LucraiBR
              </span>
              <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider -mt-1">
                Gestão & Precificação
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navegação Principal
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 text-left ${
                  isActive
                    ? 'bg-emerald-50 text-[#064E3B] font-bold border-l-3 border-[#064E3B]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#064E3B]' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-emerald-200 text-[#064E3B]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            LucraiBR · Plataforma Multi-Marketplace
          </p>
        </div>
      </aside>
    </>
  );
};
