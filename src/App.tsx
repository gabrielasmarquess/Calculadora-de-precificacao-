/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authService, subscribeToAuth } from './services/auth';
import { subscribeToDB, computeFinancialSummary, ordersRepo, purchasesRepo } from './services/db';
import { UserProfile } from './types/finance';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavSection } from './components/layout/Sidebar';
import { AuthModal } from './components/auth/AuthModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { TransfersPage } from './pages/TransfersPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ImportPage } from './pages/ImportPage';
import { AccountPage } from './pages/AccountPage';
import { productsRepo } from './services/db';
import { Product } from './types/finance';

const sectionTitles: Record<NavSection, string> = {
  dashboard: 'Dashboard Geral',
  calculator: 'Calculadora de Precificação',
  products: 'Produtos Cadastrados',
  orders: 'Vendas e Pedidos',
  purchases: 'Compras e Fornecedores',
  transfers: 'Controle de Repasses',
  cashflow: 'Fluxo de Caixa',
  expenses: 'Despesas Operacionais',
  import: 'Importação de Planilhas',
  account: 'Minha Conta & Segurança',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    authService.getCurrentUser()
  );
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbVersion, setDbVersion] = useState(0);
  const [selectedProductForSale, setSelectedProductForSale] = useState<Product | null>(null);

  // Subscribe to auth state
  useEffect(() => {
    return subscribeToAuth((user) => {
      setCurrentUser(user);
    });
  }, []);

  // Subscribe to database changes to refresh counters and summaries
  useEffect(() => {
    return subscribeToDB(() => {
      setDbVersion((v) => v + 1);
    });
  }, []);

  const refreshUser = useCallback(() => {
    setCurrentUser(authService.getCurrentUser());
  }, []);

  // Financial summary computation
  const summary = useMemo(() => {
    if (!currentUser) {
      return { currentAvailableCash: 0, projectedCash: 0 };
    }
    return computeFinancialSummary(currentUser.id);
  }, [currentUser, dbVersion]);

  // Badges for sidebar
  const pendingTransfersCount = useMemo(() => {
    if (!currentUser) return 0;
    const orders = ordersRepo.list(currentUser.id);
    return orders.filter((o) => o.transferStatus === 'pendente' || o.transferStatus === 'recebido_parcial').length;
  }, [currentUser, dbVersion]);

  const pendingPurchasesCount = useMemo(() => {
    if (!currentUser) return 0;
    const orders = ordersRepo.list(currentUser.id);
    return orders.filter((o) => o.logisticStatus !== 'pedido_cancelado' && o.items.some((i) => !i.isPurchased)).length;
  }, [currentUser, dbVersion]);

  const productsCount = useMemo(() => {
    if (!currentUser) return 0;
    return productsRepo.list(currentUser.id, false).length;
  }, [currentUser, dbVersion]);

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  // If user is not authenticated, show Auth modal
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center">
        <AuthModal onSuccess={refreshUser} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex">
      {/* 1. Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={(sec) => setCurrentSection(sec)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pendingTransfersCount={pendingTransfersCount}
        pendingPurchasesCount={pendingPurchasesCount}
        productsCount={productsCount}
      />

      {/* 2. Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Navbar */}
        <Navbar
          currentUser={currentUser}
          currentSectionTitle={sectionTitles[currentSection]}
          availableCash={summary.currentAvailableCash}
          projectedCash={summary.projectedCash}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={handleLogout}
          onNavigateToAccount={() => setCurrentSection('account')}
        />

        {/* Content Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 max-w-7xl w-full mx-auto">
          {currentSection === 'dashboard' && (
            <DashboardPage
              userId={currentUser.id}
              onNavigate={(sec) => setCurrentSection(sec as NavSection)}
            />
          )}

          {currentSection === 'calculator' && (
            <CalculatorPage
              userId={currentUser.id}
              onNavigateToProducts={() => setCurrentSection('products')}
            />
          )}

          {currentSection === 'products' && (
            <ProductsPage
              userId={currentUser.id}
              onNavigateToNewSale={(product) => {
                setSelectedProductForSale(product);
                setCurrentSection('orders');
              }}
            />
          )}

          {currentSection === 'orders' && (
            <OrdersPage
              userId={currentUser.id}
              initialProductToSale={selectedProductForSale}
              onClearInitialProduct={() => setSelectedProductForSale(null)}
              onNavigateToTransfers={() => setCurrentSection('transfers')}
              onNavigateToPurchases={() => setCurrentSection('purchases')}
            />
          )}

          {currentSection === 'purchases' && (
            <PurchasesPage userId={currentUser.id} />
          )}

          {currentSection === 'transfers' && (
            <TransfersPage userId={currentUser.id} />
          )}

          {currentSection === 'cashflow' && (
            <CashFlowPage userId={currentUser.id} />
          )}

          {currentSection === 'expenses' && (
            <ExpensesPage userId={currentUser.id} />
          )}

          {currentSection === 'import' && (
            <ImportPage userId={currentUser.id} />
          )}

          {currentSection === 'account' && (
            <AccountPage
              currentUser={currentUser}
              onLogout={handleLogout}
              onProfileUpdated={refreshUser}
            />
          )}
        </main>
      </div>
    </div>
  );
}
