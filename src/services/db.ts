import {
  Order,
  OrderItem,
  Purchase,
  Expense,
  TransferPaymentEntry,
  CashInitialBalance,
  AccessLog,
  UserSession,
  UserProfile,
  Product,
  TrajectoryMemory,
} from '../types/finance';
import { roundCents } from '../utils/currency';

const STORAGE_KEY_PREFIX = 'lucraibr_db_';

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function emitChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error in listener', e);
    }
  });
}

export function subscribeToDB(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export type SyncStatus = 'synced' | 'syncing' | 'error';
let currentSyncStatus: SyncStatus = 'synced';
const syncListeners: Set<(status: SyncStatus) => void> = new Set();

function emitSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  syncListeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {
      console.error('Sync listener error', e);
    }
  });
}

export function subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
  syncListeners.add(callback);
  callback(currentSyncStatus);
  return () => {
    syncListeners.delete(callback);
  };
}

let activeSyncUserId: string = 'usr_owner_default';
try {
  const cachedUser = localStorage.getItem('lucraibr_profile_data') || localStorage.getItem('lucraibr_auth_current_user');
  if (cachedUser) {
    activeSyncUserId = JSON.parse(cachedUser).id || 'usr_owner_default';
  }
} catch {
  activeSyncUserId = 'usr_owner_default';
}

let pushTimeout: any = null;
let currentLocalVersion = 0;

// Safe merge helper: NEVER overwrites non-empty local items with empty server arrays
export function mergeLocalAndRemote<T extends { id?: string; updatedAt?: string }>(
  localItems: T[] = [],
  remoteItems: T[] = []
): T[] {
  if (!remoteItems || remoteItems.length === 0) {
    return localItems || [];
  }
  if (!localItems || localItems.length === 0) {
    return remoteItems || [];
  }

  const map = new Map<string, T>();

  // Add all remote items
  remoteItems.forEach((item, idx) => {
    const key = item.id || `remote_${idx}`;
    map.set(key, item);
  });

  // Preserve local items not on server, or newer locally
  localItems.forEach((localItem, idx) => {
    const key = localItem.id || `local_${idx}`;
    if (!map.has(key)) {
      map.set(key, localItem);
    } else {
      const remoteItem = map.get(key)!;
      const localTime = new Date(localItem.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();
      if (localTime > remoteTime) {
        map.set(key, localItem);
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Scans all keys in localStorage to find any products, orders, purchases, expenses
 * or transfers that might have been saved under older keys or before authentication.
 * Backs them up and merges them safely to targetUserId if provided.
 */
export function detectAndPreserveAllDeviceData(targetUserId?: string): {
  products: Product[];
  orders: Order[];
  purchases: Purchase[];
  expenses: Expense[];
  transfers: TransferPaymentEntry[];
  totalRecordsFound: number;
} {
  const found = {
    products: [] as Product[],
    orders: [] as Order[],
    purchases: [] as Purchase[],
    expenses: [] as Expense[],
    transfers: [] as TransferPaymentEntry[],
    totalRecordsFound: 0,
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return found;
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Skip auth session keys and safety vault itself
      if (key.includes('session_token') || key.includes('device_safety_vault')) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw || (!raw.startsWith('[') && !raw.startsWith('{'))) continue;
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed) && parsed.length > 0) {
          const sample = parsed[0];
          // Detect products
          if (sample && (sample.habitualCost !== undefined || sample.referencePrice !== undefined) && (sample.name || sample.brand)) {
            parsed.forEach((item) => {
              if (item && !found.products.some((p) => p.id === item.id || (p.name === item.name && p.referencePrice === item.referencePrice))) {
                found.products.push(item);
              }
            });
          }
          // Detect orders
          else if (sample && (sample.orderNumber || sample.grossAmount !== undefined) && sample.items) {
            parsed.forEach((item) => {
              if (item && !found.orders.some((o) => o.id === item.id || o.orderNumber === item.orderNumber)) {
                found.orders.push(item);
              }
            });
          }
          // Detect purchases
          else if (sample && (sample.supplierName || sample.productDescription) && sample.totalCost !== undefined) {
            parsed.forEach((item) => {
              if (item && !found.purchases.some((p) => p.id === item.id)) {
                found.purchases.push(item);
              }
            });
          }
          // Detect expenses
          else if (sample && (sample.category || sample.description) && sample.amount !== undefined && sample.expenseDate) {
            parsed.forEach((item) => {
              if (item && !found.expenses.some((e) => e.id === item.id)) {
                found.expenses.push(item);
              }
            });
          }
          // Detect transfers
          else if (sample && (sample.receivedDate || sample.paymentType) && sample.amount !== undefined) {
            parsed.forEach((item) => {
              if (item && !found.transfers.some((t) => t.id === item.id)) {
                found.transfers.push(item);
              }
            });
          }
        }
      } catch {
        // Continue scanning other keys safely
      }
    }

    found.totalRecordsFound =
      found.products.length +
      found.orders.length +
      found.purchases.length +
      found.expenses.length +
      found.transfers.length;

    // Create an immutable safety backup in localStorage if records exist
    if (found.totalRecordsFound > 0) {
      try {
        localStorage.setItem(
          'lucraibr_device_safety_vault',
          JSON.stringify({
            savedAt: new Date().toISOString(),
            ...found,
          })
        );
      } catch {
        // Ignore quota
      }
    }

    // If targetUserId is given, merge rescued records into the target user's storage
    if (targetUserId) {
      if (found.products.length > 0) {
        const cur = getStorage<Product[]>(`products_${targetUserId}`, []);
        const merged = mergeLocalAndRemote(cur, found.products.map(p => ({ ...p, userId: targetUserId })));
        localStorage.setItem(STORAGE_KEY_PREFIX + `products_${targetUserId}`, JSON.stringify(merged));
      }
      if (found.orders.length > 0) {
        const cur = getStorage<Order[]>(`orders_${targetUserId}`, []);
        const merged = mergeLocalAndRemote(cur, found.orders.map(o => ({ ...o, userId: targetUserId })));
        localStorage.setItem(STORAGE_KEY_PREFIX + `orders_${targetUserId}`, JSON.stringify(merged));
      }
      if (found.purchases.length > 0) {
        const cur = getStorage<Purchase[]>(`purchases_${targetUserId}`, []);
        const merged = mergeLocalAndRemote(cur, found.purchases.map(p => ({ ...p, userId: targetUserId })));
        localStorage.setItem(STORAGE_KEY_PREFIX + `purchases_${targetUserId}`, JSON.stringify(merged));
      }
      if (found.expenses.length > 0) {
        const cur = getStorage<Expense[]>(`expenses_${targetUserId}`, []);
        const merged = mergeLocalAndRemote(cur, found.expenses.map(e => ({ ...e, userId: targetUserId })));
        localStorage.setItem(STORAGE_KEY_PREFIX + `expenses_${targetUserId}`, JSON.stringify(merged));
      }
      if (found.transfers.length > 0) {
        const cur = getStorage<TransferPaymentEntry[]>(`transfers_${targetUserId}`, []);
        const merged = mergeLocalAndRemote(cur, found.transfers.map(t => ({ ...t, userId: targetUserId })));
        localStorage.setItem(STORAGE_KEY_PREFIX + `transfers_${targetUserId}`, JSON.stringify(merged));
      }
    }
  } catch (err) {
    console.warn('Device scan notice:', err);
  }

  return found;
}

/**
 * Downloads a complete JSON backup file of all data saved on this phone/browser.
 * Can be triggered directly by the user at any time for total peace of mind.
 */
export function exportDeviceBackupJson(): { success: boolean; totalRecords: number } {
  try {
    const data = detectAndPreserveAllDeviceData();
    const backupPayload = {
      app: 'LucraiBR Vendas Online',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      summary: {
        productsCount: data.products.length,
        ordersCount: data.orders.length,
        purchasesCount: data.purchases.length,
        expensesCount: data.expenses.length,
        transfersCount: data.transfers.length,
        totalRecords: data.totalRecordsFound,
      },
      data,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `lucraibr_backup_dados_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, totalRecords: data.totalRecordsFound };
  } catch (e) {
    console.error('Failed to export backup:', e);
    return { success: false, totalRecords: 0 };
  }
}

export const syncService = {
  getStatus(): SyncStatus {
    return currentSyncStatus;
  },

  setActiveUser(userId: string) {
    activeSyncUserId = userId || 'usr_owner_default';
    this.initSync(activeSyncUserId);
  },

  async initSync(userId: string) {
    const targetUserId = userId || 'usr_owner_default';
    activeSyncUserId = targetUserId;

    try {
      emitSyncStatus('syncing');

      // 1. First, rescue and preserve all data present on this device across any keys
      detectAndPreserveAllDeviceData(targetUserId);

      // 2. Ensure database structures are ready
      initUserDatabase(targetUserId);

      // 3. Read all local data
      const localProducts = getStorage<Product[]>(`products_${targetUserId}`, []);
      const localOrders = getStorage<Order[]>(`orders_${targetUserId}`, []);
      const localPurchases = getStorage<Purchase[]>(`purchases_${targetUserId}`, []);
      const localExpenses = getStorage<Expense[]>(`expenses_${targetUserId}`, []);
      const localTransfers = getStorage<TransferPaymentEntry[]>(`transfers_${targetUserId}`, []);
      const localCash = getStorage<CashInitialBalance>(`cash_initial_${targetUserId}`, {
        userId: targetUserId,
        amount: 0,
        startDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      });
      const localMemories = getStorage<TrajectoryMemory[]>(`trajectory_${targetUserId}`, []);

      // 4. Send all local data to cloud migrate endpoint (server merges with union)
      const migrateRes = await fetch('/api/sync/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: targetUserId,
          products: localProducts,
          orders: localOrders,
          purchases: localPurchases,
          expenses: localExpenses,
          transfers: localTransfers,
          cashBalance: localCash,
          memories: localMemories,
        }),
      }).catch(() => null);

      if (migrateRes && migrateRes.ok) {
        const data = await migrateRes.json().catch(() => null);
        if (data && data.version) {
          currentLocalVersion = data.version;
        }
      }

      // 5. Pull cloud data with non-destructive merge
      await this.pull(targetUserId);
    } catch (err) {
      console.warn('Initial cloud sync notice:', err);
      emitSyncStatus('synced');
    }
  },

  async pull(userId: string) {
    const targetUserId = userId || 'usr_owner_default';

    try {
      emitSyncStatus('syncing');
      const res = await fetch(`/api/sync?userId=${encodeURIComponent(targetUserId)}`).catch(() => null);

      if (!res || !res.ok) {
        emitSyncStatus('synced');
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        emitSyncStatus('synced');
        return;
      }

      if (data.version) {
        currentLocalVersion = data.version;
      }

      let hasLocalPendingPush = false;

      // Smart merge: NEVER wipe non-empty local items if remote is empty
      if (Array.isArray(data.products)) {
        const localProds = getStorage<Product[]>(`products_${targetUserId}`, []);
        const mergedProds = mergeLocalAndRemote(localProds, data.products);
        localStorage.setItem(STORAGE_KEY_PREFIX + `products_${targetUserId}`, JSON.stringify(mergedProds));
        if (mergedProds.length > data.products.length) hasLocalPendingPush = true;
      }

      if (Array.isArray(data.orders)) {
        const localOrders = getStorage<Order[]>(`orders_${targetUserId}`, []);
        const mergedOrders = mergeLocalAndRemote(localOrders, data.orders);
        localStorage.setItem(STORAGE_KEY_PREFIX + `orders_${targetUserId}`, JSON.stringify(mergedOrders));
        if (mergedOrders.length > data.orders.length) hasLocalPendingPush = true;
      }

      if (Array.isArray(data.purchases)) {
        const localPurchases = getStorage<Purchase[]>(`purchases_${targetUserId}`, []);
        const mergedPurchases = mergeLocalAndRemote(localPurchases, data.purchases);
        localStorage.setItem(STORAGE_KEY_PREFIX + `purchases_${targetUserId}`, JSON.stringify(mergedPurchases));
        if (mergedPurchases.length > data.purchases.length) hasLocalPendingPush = true;
      }

      if (Array.isArray(data.expenses)) {
        const localExpenses = getStorage<Expense[]>(`expenses_${targetUserId}`, []);
        const mergedExpenses = mergeLocalAndRemote(localExpenses, data.expenses);
        localStorage.setItem(STORAGE_KEY_PREFIX + `expenses_${targetUserId}`, JSON.stringify(mergedExpenses));
        if (mergedExpenses.length > data.expenses.length) hasLocalPendingPush = true;
      }

      if (Array.isArray(data.transfers)) {
        const localTransfers = getStorage<TransferPaymentEntry[]>(`transfers_${targetUserId}`, []);
        const mergedTransfers = mergeLocalAndRemote(localTransfers, data.transfers);
        localStorage.setItem(STORAGE_KEY_PREFIX + `transfers_${targetUserId}`, JSON.stringify(mergedTransfers));
        if (mergedTransfers.length > data.transfers.length) hasLocalPendingPush = true;
      }

      if (data.cashBalance && data.cashBalance.amount !== undefined) {
        const localCash = getStorage<CashInitialBalance | null>(`cash_initial_${targetUserId}`, null);
        if (!localCash || (data.cashBalance.updatedAt || '') >= (localCash.updatedAt || '')) {
          localStorage.setItem(STORAGE_KEY_PREFIX + `cash_initial_${targetUserId}`, JSON.stringify(data.cashBalance));
        }
      }

      if (Array.isArray(data.memories)) {
        const localMemories = getStorage<TrajectoryMemory[]>(`trajectory_${targetUserId}`, []);
        const mergedMemories = mergeLocalAndRemote(localMemories, data.memories);
        localStorage.setItem(STORAGE_KEY_PREFIX + `trajectory_${targetUserId}`, JSON.stringify(mergedMemories));
      }

      emitChange();
      emitSyncStatus('synced');

      // If device had records not yet registered on server, push them
      if (hasLocalPendingPush) {
        this.push(targetUserId);
      }
    } catch (err) {
      console.warn('Pull sync error:', err);
      emitSyncStatus('synced');
    }
  },

  schedulePush(userId: string) {
    if (pushTimeout) clearTimeout(pushTimeout);
    emitSyncStatus('syncing');
    pushTimeout = setTimeout(() => {
      this.push(userId);
    }, 450);
  },

  async push(userId: string) {
    const targetUserId = userId || 'usr_owner_default';

    try {
      const payload = {
        userId: targetUserId,
        products: getStorage<Product[]>(`products_${targetUserId}`, []),
        orders: getStorage<Order[]>(`orders_${targetUserId}`, []),
        purchases: getStorage<Purchase[]>(`purchases_${targetUserId}`, []),
        expenses: getStorage<Expense[]>(`expenses_${targetUserId}`, []),
        transfers: getStorage<TransferPaymentEntry[]>(`transfers_${targetUserId}`, []),
        cashBalance: getStorage<CashInitialBalance>(`cash_initial_${targetUserId}`, {
          userId: targetUserId,
          amount: 0,
          startDate: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString(),
        }),
        memories: getStorage<TrajectoryMemory[]>(`trajectory_${targetUserId}`, []),
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.version) {
          currentLocalVersion = data.version;
        }
        emitSyncStatus('synced');
      } else {
        emitSyncStatus('synced');
      }
    } catch (err) {
      console.warn('Push sync notice:', err);
      emitSyncStatus('synced');
    }
  },

  async checkRemoteChanges(userId: string) {
    const targetUserId = userId || 'usr_owner_default';

    try {
      const res = await fetch(`/api/sync/version?userId=${encodeURIComponent(targetUserId)}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.version && data.version > currentLocalVersion) {
          await this.pull(targetUserId);
        }
      }
    } catch {
      // Background check silent fail
    }
  },
};

// Periodic polling every 3.5s and on window focus/tab switch for real-time sync between PC & phone
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (activeSyncUserId && document.visibilityState === 'visible') {
      syncService.checkRemoteChanges(activeSyncUserId);
    }
  }, 3500);

  window.addEventListener('visibilitychange', () => {
    if (activeSyncUserId && document.visibilityState === 'visible') {
      syncService.checkRemoteChanges(activeSyncUserId);
    }
  });

  window.addEventListener('focus', () => {
    if (activeSyncUserId) {
      syncService.checkRemoteChanges(activeSyncUserId);
    }
  });
}

// Local storage helper with JSON parsing safety
function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    emitChange();

    // Trigger cloud sync push
    if (activeSyncUserId && !key.startsWith('logs_') && !key.startsWith('sessions_')) {
      syncService.schedulePush(activeSyncUserId);
    }
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

// Initial default seed generator for initial onboarding experience
function getInitialOrders(userId: string): Order[] {
  const today = new Date().toISOString().split('T')[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'ord_1',
      userId,
      orderNumber: 'MLB-2026-98124',
      marketplace: 'Mercado Livre',
      saleDate: fiveDaysAgo,
      items: [
        {
          id: 'item_1_1',
          productName: 'Fone de Ouvido Bluetooth Sem Fio TWS Pro',
          quantity: 2,
          unitCost: 35.0,
          unitPrice: 89.9,
          totalCost: 70.0,
          totalPrice: 179.8,
          isPurchased: true,
          purchaseId: 'pur_1',
        },
      ],
      grossAmount: 179.8,
      estimatedTransferAmount: 142.04,
      knownFeesAmount: 37.76, // 16% comissão + R$ 9 frete/taxa fixa
      expectedTransferDate: threeDaysAgo,
      notes: 'Venda confirmada via Full',
      logisticStatus: 'pedido_concluido',
      transferStatus: 'recebido_integral',
      actualTransferAmount: 142.04,
      actualTransferDate: threeDaysAgo,
      transferDivergence: 0,
      createdAt: fiveDaysAgo,
      updatedAt: threeDaysAgo,
    },
    {
      id: 'ord_2',
      userId,
      orderNumber: 'SHP-2026-44019',
      marketplace: 'Shopee',
      saleDate: threeDaysAgo,
      items: [
        {
          id: 'item_2_1',
          productName: 'Kit 3 Camisetas Básicas Algodão Premium',
          quantity: 1,
          unitCost: 45.0,
          unitPrice: 119.9,
          totalCost: 45.0,
          totalPrice: 119.9,
          isPurchased: false, // Precisa comprar do fornecedor pós-venda
        },
      ],
      grossAmount: 119.9,
      estimatedTransferAmount: 95.92,
      knownFeesAmount: 23.98, // 20% Shopee
      expectedTransferDate: nextWeek,
      notes: 'Cliente solicitou envio rápido. Aguardando compra do fornecedor têxtil.',
      logisticStatus: 'aguardando_compra',
      transferStatus: 'pendente',
      actualTransferAmount: 0,
      transferDivergence: 0,
      createdAt: threeDaysAgo,
      updatedAt: threeDaysAgo,
    },
    {
      id: 'ord_3',
      userId,
      orderNumber: 'TTK-2026-11883',
      marketplace: 'TikTok Shop',
      saleDate: today,
      items: [
        {
          id: 'item_3_1',
          productName: 'Garrafa Térmica 1L Inox Digital com Display LED',
          quantity: 1,
          unitCost: 28.5,
          unitPrice: 69.9,
          totalCost: 28.5,
          totalPrice: 69.9,
          isPurchased: false, // Precisa comprar do fornecedor pós-venda
        },
      ],
      grossAmount: 69.9,
      estimatedTransferAmount: 58.72,
      knownFeesAmount: 11.18,
      expectedTransferDate: nextWeek,
      notes: 'Produto viralizado em vídeo no TikTok.',
      logisticStatus: 'venda_registrada',
      transferStatus: 'pendente',
      actualTransferAmount: 0,
      transferDivergence: 0,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 'ord_4',
      userId,
      orderNumber: 'MLB-2026-99052',
      marketplace: 'Mercado Livre',
      saleDate: fiveDaysAgo,
      items: [
        {
          id: 'item_4_1',
          productName: 'Suporte Articulado para Monitor e Notebook',
          quantity: 1,
          unitCost: 120.0,
          unitPrice: 249.9,
          totalCost: 120.0,
          totalPrice: 249.9,
          isPurchased: true,
          purchaseId: 'pur_1',
        },
      ],
      grossAmount: 249.9,
      estimatedTransferAmount: 204.91,
      knownFeesAmount: 44.99,
      expectedTransferDate: today,
      notes: 'Repasse caiu com desconto de taxa de devolução não prevista.',
      logisticStatus: 'pedido_enviado',
      transferStatus: 'recebido_divergente',
      actualTransferAmount: 194.5,
      actualTransferDate: today,
      transferDivergence: -10.41,
      createdAt: fiveDaysAgo,
      updatedAt: today,
    },
  ];
}

function getInitialPurchases(userId: string): Purchase[] {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'pur_1',
      userId,
      productDescription: 'Lote Suportes articulados e Fones TWS Pro',
      supplierName: 'Distribuidora Tech Import SP',
      relatedOrderIds: ['ord_1', 'ord_4'],
      quantity: 3,
      totalCost: 190.0,
      purchaseDate: fiveDaysAgo,
      dueDate: fiveDaysAgo,
      paymentMethod: 'Pix',
      paymentStatus: 'pago',
      installments: [
        {
          id: 'inst_1_1',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 190.0,
          dueDate: fiveDaysAgo,
          status: 'pago',
          paidDate: fiveDaysAgo,
          paymentMethod: 'Pix',
        },
      ],
      notes: 'Pago à vista via Pix com 5% de desconto de fornecedor.',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
    {
      id: 'pur_2',
      userId,
      productDescription: 'Pedido fornecedor 50 unidades Embalagens reforçadas',
      supplierName: 'Caixas Express Embalagens',
      relatedOrderIds: [],
      quantity: 50,
      totalCost: 160.0,
      purchaseDate: fiveDaysAgo,
      dueDate: nextMonth,
      paymentMethod: 'Boleto',
      paymentStatus: 'nao_pago',
      installments: [
        {
          id: 'inst_2_1',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 160.0,
          dueDate: nextMonth,
          status: 'pendente',
          paymentMethod: 'Boleto',
        },
      ],
      notes: 'Boleto faturado para 30 dias.',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
  ];
}

function getInitialExpenses(userId: string): Expense[] {
  const today = new Date().toISOString().split('T')[0];
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'exp_1',
      userId,
      description: 'Bobina de Etiquetas Térmicas 100x150mm (500 unid)',
      category: 'Etiquetas e Fita Adesiva',
      amount: 48.9,
      expenseDate: fourDaysAgo,
      dueDate: fourDaysAgo,
      relatedMarketplace: 'Operação Geral',
      paymentMethod: 'Pix',
      paymentStatus: 'pago',
      installments: [
        {
          id: 'exp_inst_1',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 48.9,
          dueDate: fourDaysAgo,
          status: 'pago',
          paidDate: fourDaysAgo,
          paymentMethod: 'Pix',
        },
      ],
      notes: 'Compra via Mercado Livre para despachos gerais.',
      createdAt: fourDaysAgo,
      updatedAt: fourDaysAgo,
    },
    {
      id: 'exp_2',
      userId,
      description: 'Uber para ponto de coleta Mercado Envios / Shopee Xpress',
      category: 'Transporte e Uber',
      amount: 22.4,
      expenseDate: today,
      dueDate: today,
      relatedMarketplace: 'Mercado Livre',
      paymentMethod: 'Débito',
      paymentStatus: 'pago',
      installments: [
        {
          id: 'exp_inst_2',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 22.4,
          dueDate: today,
          status: 'pago',
          paidDate: today,
          paymentMethod: 'Débito',
        },
      ],
      notes: 'Envio dos pacotes do dia.',
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 'exp_3',
      userId,
      description: 'Campanha de Anúncios Shopee Ads - Kit Camisetas',
      category: 'Publicidade e Anúncios',
      amount: 50.0,
      expenseDate: today,
      dueDate: nextWeek,
      relatedMarketplace: 'Shopee',
      paymentMethod: 'Boleto',
      paymentStatus: 'nao_pago',
      installments: [
        {
          id: 'exp_inst_3',
          installmentNumber: 1,
          totalInstallments: 1,
          amount: 50.0,
          dueDate: nextWeek,
          status: 'pendente',
          paymentMethod: 'Boleto',
        },
      ],
      notes: 'Crédito de anúncios a pagar na próxima semana.',
      createdAt: today,
      updatedAt: today,
    },
  ];
}

function getInitialProducts(userId: string): Product[] {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
  return [
    {
      id: 'prod_1',
      userId,
      name: 'Fone de Ouvido Bluetooth Sem Fio TWS Pro',
      internalCode: 'FONE-TWS-01',
      category: 'Eletrônicos & Áudio',
      brand: 'SoundPulse',
      modelOrVariation: 'Preto Fosco - Bluetooth 5.3',
      description: 'Fone estéreo sem fio com cancelamento ativo de ruído e estojo recarregável.',
      habitualCost: 35.0,
      referencePrice: 89.9,
      preferredMarketplace: 'Mercado Livre',
      notes: 'Fornecedor Tech Import SP envia no mesmo dia. Margem média saudável.',
      isArchived: false,
      syncStatus: 'sincronizado',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
    {
      id: 'prod_2',
      userId,
      name: 'Kit 3 Camisetas Básicas Algodão Premium',
      internalCode: 'CAM-BASIC-KIT3',
      category: 'Vestuário & Moda',
      brand: 'Algodão Real',
      modelOrVariation: 'Tamanho G - Cores: Preto, Branco, Cinza',
      description: 'Kit com 3 camisetas em meia malha 100% algodão penteado 30.1.',
      habitualCost: 45.0,
      referencePrice: 119.9,
      preferredMarketplace: 'Shopee',
      notes: 'Comprar sob demanda com a tecelagem em Brás. Alta rotatividade.',
      isArchived: false,
      syncStatus: 'sincronizado',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
    {
      id: 'prod_3',
      userId,
      name: 'Garrafa Térmica 1L Inox Digital com Display LED',
      internalCode: 'GAR-TERM-1L',
      category: 'Utilidades & Casa',
      brand: 'TermoMax',
      modelOrVariation: '1000ml - Tampa com Termômetro Touch',
      description: 'Garrafa a vácuo dupla camada inox com sensor de temperatura na tampa.',
      habitualCost: 28.5,
      referencePrice: 69.9,
      preferredMarketplace: 'TikTok Shop',
      notes: 'Sucesso em vídeos de review no TikTok Shop. Embalar com plástico bolha.',
      isArchived: false,
      syncStatus: 'sincronizado',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
    {
      id: 'prod_4',
      userId,
      name: 'Suporte Articulado para Monitor e Notebook',
      internalCode: 'SUP-ARTIC-MON',
      category: 'Informática & Escritório',
      brand: 'ErgoDesk',
      modelOrVariation: 'Pistão a Gás - Telas 17 a 32 polegadas',
      description: 'Braço articulado com mola a gás e fixação por morsa de mesa.',
      habitualCost: 120.0,
      referencePrice: 249.9,
      preferredMarketplace: 'Mercado Livre',
      notes: 'Produto de ticket médio maior. Fornecedor faturado em 30 dias.',
      isArchived: false,
      syncStatus: 'sincronizado',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
    {
      id: 'prod_5',
      userId,
      name: 'Organizador Multiuso Acrílico com Divisórias',
      internalCode: 'ORG-ACRIL-04',
      category: 'Casa & Organização',
      brand: 'ClearHome',
      modelOrVariation: 'Tamanho Médio (25x15x8cm)',
      description: 'Caixa organizadora transparente para maquiagem, acessórios ou gavetas.',
      habitualCost: 18.0,
      referencePrice: 49.9,
      preferredMarketplace: 'Shopee',
      notes: 'Excelente produto para compra em lote e envio rápido.',
      isArchived: false,
      syncStatus: 'sincronizado',
      createdAt: fiveDaysAgo,
      updatedAt: fiveDaysAgo,
    },
  ];
}

// Ensure the user's data exists and is initialized without overwriting existing data
export function initUserDatabase(userId: string): void {
  const isInitialized = getStorage<boolean>(`init_${userId}`, false);
  if (!isInitialized) {
    // Check if user or device already has data before inserting demo data
    const existingProds = getStorage<Product[]>(`products_${userId}`, []);
    const existingOrders = getStorage<Order[]>(`orders_${userId}`, []);
    const existingPurchases = getStorage<Purchase[]>(`purchases_${userId}`, []);
    const existingExpenses = getStorage<Expense[]>(`expenses_${userId}`, []);

    // ONLY insert demo initial data if user has completely zero existing items!
    if (existingProds.length === 0 && existingOrders.length === 0 && existingPurchases.length === 0 && existingExpenses.length === 0) {
      setStorage(`products_${userId}`, getInitialProducts(userId));
      setStorage(`orders_${userId}`, getInitialOrders(userId));
      setStorage(`purchases_${userId}`, getInitialPurchases(userId));
      setStorage(`expenses_${userId}`, getInitialExpenses(userId));
      setStorage<CashInitialBalance>(`cash_initial_${userId}`, {
        userId,
        amount: 500.0, // Saldo inicial parametrizado pelo usuário
        startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      });
      setStorage<TransferPaymentEntry[]>(`transfer_entries_${userId}`, [
        {
          id: 'trans_entry_1',
          orderId: 'ord_1',
          userId,
          amount: 142.04,
          receivedDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          paymentType: 'integral',
          notes: 'Repasse integral confirmado',
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        },
        {
          id: 'trans_entry_2',
          orderId: 'ord_4',
          userId,
          amount: 194.5,
          receivedDate: new Date().toISOString().split('T')[0],
          paymentType: 'divergente',
          notes: 'Recebido com desconto de taxa',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setStorage(`init_${userId}`, true);
  } else {
    // If user was initialized and products key is completely undefined, initialize empty array
    const existingProds = getStorage<Product[] | null>(`products_${userId}`, null);
    if (existingProds === null) {
      setStorage(`products_${userId}`, []);
    }
  }
}

// ORDERS REPOSITORY
export const ordersRepo = {
  list(userId: string): Order[] {
    initUserDatabase(userId);
    return getStorage<Order[]>(`orders_${userId}`, []);
  },
  get(userId: string, id: string): Order | undefined {
    return this.list(userId).find((o) => o.id === id);
  },
  save(order: Order): void {
    const list = this.list(order.userId);
    const idx = list.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      list[idx] = { ...order, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...order, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    setStorage(`orders_${order.userId}`, list);
  },
  delete(userId: string, id: string): void {
    const list = this.list(userId).filter((o) => o.id !== id);
    setStorage(`orders_${userId}`, list);
  },
  findByOrderNumber(userId: string, orderNumber: string): Order | undefined {
    return this.list(userId).find((o) => o.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase());
  },
};

// PRODUCTS REPOSITORY (Catálogo de Produtos Pré-Cadastrados)
export const productsRepo = {
  list(userId: string, includeArchived = false): Product[] {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    if (includeArchived) return all;
    return all.filter((p) => !p.isArchived);
  },
  get(userId: string, id: string): Product | undefined {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    return all.find((p) => p.id === id);
  },
  findByName(userId: string, name: string): Product | undefined {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    return all.find(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
  },
  findByCode(userId: string, code: string): Product | undefined {
    if (!code.trim()) return undefined;
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    return all.find(
      (p) => p.internalCode && p.internalCode.trim().toLowerCase() === code.trim().toLowerCase()
    );
  },
  save(product: Product): Product {
    initUserDatabase(product.userId);
    const all = getStorage<Product[]>(`products_${product.userId}`, []);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const syncStatus = isOnline ? 'sincronizado' : 'pendente_sincronizacao';

    const idx = all.findIndex((p) => p.id === product.id);
    let saved: Product;

    if (idx >= 0) {
      saved = {
        ...product,
        syncStatus,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = saved;
    } else {
      saved = {
        ...product,
        id: product.id || 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        syncStatus,
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      all.unshift(saved);
    }

    setStorage(`products_${product.userId}`, all);
    return saved;
  },
  archive(userId: string, id: string): void {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        isArchived: true,
        updatedAt: new Date().toISOString(),
      };
      setStorage(`products_${userId}`, all);
    }
  },
  unarchive(userId: string, id: string): void {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        isArchived: false,
        updatedAt: new Date().toISOString(),
      };
      setStorage(`products_${userId}`, all);
    }
  },
  delete(userId: string, id: string): void {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []).filter((p) => p.id !== id);
    setStorage(`products_${userId}`, all);
  },
  syncAll(userId: string): void {
    initUserDatabase(userId);
    const all = getStorage<Product[]>(`products_${userId}`, []);
    const updated = all.map((p) => ({
      ...p,
      syncStatus: 'sincronizado' as const,
    }));
    setStorage(`products_${userId}`, updated);
  },
};

// Auto-sync listener when browser reconnects to internet
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emitChange();
  });
}

// PURCHASES REPOSITORY
export const purchasesRepo = {
  list(userId: string): Purchase[] {
    initUserDatabase(userId);
    return getStorage<Purchase[]>(`purchases_${userId}`, []);
  },
  get(userId: string, id: string): Purchase | undefined {
    return this.list(userId).find((p) => p.id === id);
  },
  save(purchase: Purchase): void {
    const list = this.list(purchase.userId);
    const idx = list.findIndex((p) => p.id === purchase.id);
    if (idx >= 0) {
      list[idx] = { ...purchase, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...purchase, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    setStorage(`purchases_${purchase.userId}`, list);
  },
  delete(userId: string, id: string): void {
    const list = this.list(userId).filter((p) => p.id !== id);
    setStorage(`purchases_${userId}`, list);
  },
};

// EXPENSES REPOSITORY
export const expensesRepo = {
  list(userId: string): Expense[] {
    initUserDatabase(userId);
    return getStorage<Expense[]>(`expenses_${userId}`, []);
  },
  get(userId: string, id: string): Expense | undefined {
    return this.list(userId).find((e) => e.id === id);
  },
  save(expense: Expense): void {
    const list = this.list(expense.userId);
    const idx = list.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      list[idx] = { ...expense, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...expense, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    setStorage(`expenses_${expense.userId}`, list);
  },
  delete(userId: string, id: string): void {
    const list = this.list(userId).filter((e) => e.id !== id);
    setStorage(`expenses_${userId}`, list);
  },
};

// TRANSFER ENTRIES REPOSITORY
export const transferEntriesRepo = {
  list(userId: string): TransferPaymentEntry[] {
    initUserDatabase(userId);
    return getStorage<TransferPaymentEntry[]>(`transfer_entries_${userId}`, []);
  },
  getByOrder(userId: string, orderId: string): TransferPaymentEntry[] {
    return this.list(userId).filter((t) => t.orderId === orderId);
  },
  add(entry: TransferPaymentEntry): void {
    const list = this.list(entry.userId);
    list.unshift(entry);
    setStorage(`transfer_entries_${entry.userId}`, list);
  },
  delete(userId: string, id: string): void {
    const list = this.list(userId).filter((t) => t.id !== id);
    setStorage(`transfer_entries_${userId}`, list);
  },
};

// CASH BALANCE REPOSITORY
export const cashBalanceRepo = {
  get(userId: string): CashInitialBalance {
    initUserDatabase(userId);
    return getStorage<CashInitialBalance>(`cash_initial_${userId}`, {
      userId,
      amount: 0,
      startDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    });
  },
  set(balance: CashInitialBalance): void {
    setStorage(`cash_initial_${balance.userId}`, {
      ...balance,
      updatedAt: new Date().toISOString(),
    });
  },
};

// ACCESS LOGS & SESSIONS
export const logsRepo = {
  getLogs(userId: string): AccessLog[] {
    return getStorage<AccessLog[]>(`logs_${userId}`, []);
  },
  addLog(userId: string, action: AccessLog['action'], details: string): void {
    const logs = this.getLogs(userId);
    logs.unshift({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      timestamp: new Date().toISOString(),
      action,
      details,
    });
    setStorage(`logs_${userId}`, logs.slice(0, 50)); // Keep last 50 logs
  },
  getSessions(userId: string): UserSession[] {
    return getStorage<UserSession[]>(`sessions_${userId}`, [
      {
        id: 'sess_current',
        userId,
        loginTime: new Date().toISOString(),
        userAgent: navigator.userAgent,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Smartphone' : 'Computador / Desktop',
        browser: navigator.userAgent.includes('Chrome') ? 'Google Chrome' : 'Navegador Web',
        isCurrentSession: true,
      },
    ]);
  },
  terminateOtherSessions(userId: string): void {
    const current = this.getSessions(userId).filter((s) => s.isCurrentSession);
    setStorage(`sessions_${userId}`, current);
    this.addLog(userId, 'logout', 'Todas as outras sessões ativas foram encerradas');
  },
};

// TRAJECTORY MEMORIES REPOSITORY ("Minha trajetória" - Fotos das encomendas enviadas)
export const trajectoryRepo = {
  list(userId: string): TrajectoryMemory[] {
    initUserDatabase(userId);
    const list = getStorage<TrajectoryMemory[]>(`trajectory_${userId}`, []);
    // Ordenar cronologicamente por data da foto/envio (mais antiga primeiro)
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  },
  get(userId: string, id: string): TrajectoryMemory | undefined {
    return this.list(userId).find((m) => m.id === id);
  },
  save(memory: TrajectoryMemory): TrajectoryMemory {
    initUserDatabase(memory.userId);
    const list = getStorage<TrajectoryMemory[]>(`trajectory_${memory.userId}`, []);
    const idx = list.findIndex((m) => m.id === memory.id);
    let saved: TrajectoryMemory;
    if (idx >= 0) {
      saved = { ...memory };
      list[idx] = saved;
    } else {
      saved = {
        ...memory,
        id: memory.id || 'traj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        createdAt: memory.createdAt || new Date().toISOString(),
      };
      list.push(saved);
    }
    setStorage(`trajectory_${memory.userId}`, list);
    return saved;
  },
  delete(userId: string, id: string): void {
    initUserDatabase(userId);
    const list = getStorage<TrajectoryMemory[]>(`trajectory_${userId}`, []).filter((m) => m.id !== id);
    setStorage(`trajectory_${userId}`, list);
  },
};

// CORE FINANCIAL ENGINE (Accurate, strictly separated concepts)
export interface FinancialSummary {
  currentAvailableCash: number; // Saldo atual disponível (realmente recebido - realmente pago + saldo inicial)
  projectedCash: number; // Saldo projetado futuro
  totalSalesGross: number; // Total de vendas brutas
  pendingTransfersAmount: number; // Total de repasses que marketplaces ainda devem pagar
  confirmedTransfersAmount: number; // Total de repasses já efetivamente recebidos
  
  // Controle de compras
  pendingProductsToBuyCount: number; // Unidades de produtos que ainda precisam ser comprados
  moneyNeededToBuyProducts: number; // R$ necessário para comprar esses produtos
  
  // Contas a pagar e despesas
  accountsPayableAmount: number; // Contas a pagar (compras e despesas pendentes)
  expensesPaidAmount: number; // Despesas operacionais já pagas
  
  // Lucro
  estimatedProfit: number; // Lucro estimado (Vendas brutas - taxas estimadas - custos de produtos - despesas)
  realizedProfit: number; // Lucro calculado com custos e valores efetivamente registrados
  hasIncompleteData: boolean; // Flag se há pedidos com custo zero/desconhecido
}

export function computeFinancialSummary(userId: string): FinancialSummary {
  const orders = ordersRepo.list(userId);
  const purchases = purchasesRepo.list(userId);
  const expenses = expensesRepo.list(userId);
  const initialCash = cashBalanceRepo.get(userId);

  // 1. Entradas de caixa efetivas: Repasses confirmados
  let totalCashInflow = 0;
  let confirmedTransfersAmount = 0;
  let pendingTransfersAmount = 0;
  let totalSalesGross = 0;
  let hasIncompleteData = false;

  orders.forEach((ord) => {
    totalSalesGross += ord.grossAmount;
    
    // Repasse confirmado (total ou parcial)
    if (ord.actualTransferAmount > 0) {
      totalCashInflow += ord.actualTransferAmount;
      confirmedTransfersAmount += ord.actualTransferAmount;
    }

    // Repasse pendente
    if (ord.transferStatus === 'pendente') {
      pendingTransfersAmount += ord.estimatedTransferAmount;
    } else if (ord.transferStatus === 'recebido_parcial') {
      const remaining = Math.max(0, ord.estimatedTransferAmount - ord.actualTransferAmount);
      pendingTransfersAmount += remaining;
    }

    // Checar dados incompletos
    ord.items.forEach((item) => {
      if (item.unitCost <= 0) {
        hasIncompleteData = true;
      }
    });
  });

  // 2. Saídas de caixa efetivas: Compras pagas
  let totalPurchasesCashOutflow = 0;
  let pendingPurchasesCashOutflow = 0;

  purchases.forEach((pur) => {
    pur.installments.forEach((inst) => {
      if (inst.status === 'pago') {
        totalPurchasesCashOutflow += inst.amount;
      } else {
        pendingPurchasesCashOutflow += inst.amount;
      }
    });
  });

  // 3. Saídas de caixa efetivas: Despesas pagas
  let totalExpensesCashOutflow = 0;
  let pendingExpensesCashOutflow = 0;

  expenses.forEach((exp) => {
    // Ignorar itens pessoais externos da fatura
    if (exp.isExternalCreditCardItem) return;

    exp.installments.forEach((inst) => {
      if (inst.status === 'pago') {
        totalExpensesCashOutflow += inst.amount;
      } else {
        pendingExpensesCashOutflow += inst.amount;
      }
    });
  });

  // Saldo Atual Disponível
  const currentAvailableCash = initialCash.amount + totalCashInflow - (totalPurchasesCashOutflow + totalExpensesCashOutflow);

  // Saldo Projetado
  const projectedCash = currentAvailableCash + pendingTransfersAmount - (pendingPurchasesCashOutflow + pendingExpensesCashOutflow);

  // Contas a pagar (compras pendentes + despesas pendentes)
  const accountsPayableAmount = pendingPurchasesCashOutflow + pendingExpensesCashOutflow;

  // Produtos que ainda precisam ser comprados (pedidos onde isPurchased === false e não cancelados)
  let pendingProductsToBuyCount = 0;
  let moneyNeededToBuyProducts = 0;

  orders.forEach((ord) => {
    if (ord.logisticStatus === 'pedido_cancelado') return;
    ord.items.forEach((item) => {
      if (!item.isPurchased) {
        pendingProductsToBuyCount += item.quantity;
        moneyNeededToBuyProducts += item.totalCost;
      }
    });
  });

  // LUCRO ESTIMADO:
  // Receita bruta - taxas conhecidas - custo de todos os produtos vendidos - todas as despesas operacionais
  let totalEstimatedFees = 0;
  let totalProductCost = 0;

  orders.forEach((ord) => {
    if (ord.logisticStatus === 'pedido_cancelado') return;
    totalEstimatedFees += ord.knownFeesAmount;
    ord.items.forEach((item) => {
      totalProductCost += item.totalCost;
    });
  });

  let totalAllExpenses = 0;
  expenses.forEach((exp) => {
    if (exp.isExternalCreditCardItem) return;
    totalAllExpenses += exp.amount;
  });

  const estimatedProfit = totalSalesGross - totalEstimatedFees - totalProductCost - totalAllExpenses;

  // LUCRO CALCULADO COM DADOS EFETIVAMENTE CONFIRMADOS:
  // Repasses efetivamente recebidos - custo dos produtos desses pedidos com repasse recebido - despesas pagas
  let confirmedOrdersProductCost = 0;
  orders.forEach((ord) => {
    if (ord.actualTransferAmount > 0) {
      ord.items.forEach((item) => {
        confirmedOrdersProductCost += item.totalCost;
      });
    }
  });

  const realizedProfit = confirmedTransfersAmount - confirmedOrdersProductCost - totalExpensesCashOutflow;

  return {
    currentAvailableCash: roundCents(currentAvailableCash),
    projectedCash: roundCents(projectedCash),
    totalSalesGross: roundCents(totalSalesGross),
    pendingTransfersAmount: roundCents(pendingTransfersAmount),
    confirmedTransfersAmount: roundCents(confirmedTransfersAmount),
    pendingProductsToBuyCount,
    moneyNeededToBuyProducts: roundCents(moneyNeededToBuyProducts),
    accountsPayableAmount: roundCents(accountsPayableAmount),
    expensesPaidAmount: roundCents(totalExpensesCashOutflow),
    estimatedProfit: roundCents(estimatedProfit),
    realizedProfit: roundCents(realizedProfit),
    hasIncompleteData,
  };
}
