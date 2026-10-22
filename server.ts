import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud_db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'cloud_db.backup.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface CloudDatabase {
  users: any[];
  sessions: any[];
  pending2FACodes: any[];
  passwordResetCodes: any[];
  securityLogs: any[];
  products: Record<string, any[]>;
  orders: Record<string, any[]>;
  purchases: Record<string, any[]>;
  expenses: Record<string, any[]>;
  transfers: Record<string, any[]>;
  cashBalances: Record<string, any>;
  memories: Record<string, any[]>;
  versions: Record<string, number>;
}

const DEFAULT_USER_ID = 'usr_owner_default';
const DEFAULT_USER = {
  id: DEFAULT_USER_ID,
  email: 'gabrielasousamarquess2@gmail.com',
  name: 'Gabriela Marques',
  companyName: 'LucraiBR Vendas Online',
  role: 'admin',
  status: 'active',
  twoFactorEnabled: false,
  createdAt: '2026-10-21T00:51:29.038Z',
};

// Database persistence with atomic write
let isSaving = false;
let saveQueuePending = false;

function loadDatabase(): CloudDatabase {
  let loadedDB: Partial<CloudDatabase> | null = null;

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      loadedDB = JSON.parse(content);
    } catch (err) {
      console.error('Error reading cloud_db.json, attempting backup recovery:', err);
    }
  }

  if (!loadedDB && fs.existsSync(BACKUP_FILE)) {
    try {
      const content = fs.readFileSync(BACKUP_FILE, 'utf-8');
      loadedDB = JSON.parse(content);
      console.log('Recovered database state from cloud_db.backup.json');
    } catch (backupErr) {
      console.error('Backup recovery failed:', backupErr);
    }
  }

  const initialDB: CloudDatabase = {
    users: loadedDB?.users || [DEFAULT_USER],
    sessions: loadedDB?.sessions || [],
    pending2FACodes: loadedDB?.pending2FACodes || [],
    passwordResetCodes: loadedDB?.passwordResetCodes || [],
    securityLogs: loadedDB?.securityLogs || [],
    products: loadedDB?.products || {},
    orders: loadedDB?.orders || {},
    purchases: loadedDB?.purchases || {},
    expenses: loadedDB?.expenses || {},
    transfers: loadedDB?.transfers || {},
    cashBalances: loadedDB?.cashBalances || {},
    memories: loadedDB?.memories || {},
    versions: loadedDB?.versions || {},
  };

  if (!initialDB.users.some((u) => u.id === DEFAULT_USER_ID)) {
    initialDB.users.unshift(DEFAULT_USER);
  }

  saveDatabase(initialDB);
  return initialDB;
}

function saveDatabase(database: CloudDatabase): void {
  if (isSaving) {
    saveQueuePending = true;
    return;
  }

  isSaving = true;

  try {
    const serialized = JSON.stringify(database, null, 2);
    const tempFile = DB_FILE + '.tmp';

    fs.writeFileSync(tempFile, serialized, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    fs.writeFileSync(BACKUP_FILE, serialized, 'utf-8');
  } catch (err) {
    console.error('Error writing cloud_db.json:', err);
  } finally {
    isSaving = false;
    if (saveQueuePending) {
      saveQueuePending = false;
      saveDatabase(db);
    }
  }
}

let db = loadDatabase();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);

  // CORS Middleware allowing cross-origin calls from mobile or web views
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'LucraiBR Vendas Online',
      accessMode: 'direct',
      timestamp: new Date().toISOString(),
    });
  });

  // Profile endpoints
  app.get('/api/profile', (req, res) => {
    const owner = db.users.find((u) => u.id === DEFAULT_USER_ID) || DEFAULT_USER;
    res.json({ success: true, profile: owner });
  });

  app.put('/api/profile', (req, res) => {
    const { name, companyName } = req.body;
    let owner = db.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!owner) {
      owner = { ...DEFAULT_USER };
      db.users.unshift(owner);
    }
    if (name) owner.name = String(name).trim();
    if (companyName !== undefined) owner.companyName = String(companyName).trim();
    saveDatabase(db);
    res.json({ success: true, profile: owner });
  });

  // ==========================================
  // SYNC & STORAGE API (Direct, Token-Free)
  // ==========================================

  // Pull data from cloud
  app.get('/api/sync', (req, res) => {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;

    res.json({
      version: db.versions[userId] || 1,
      products: db.products[userId] || [],
      orders: db.orders[userId] || [],
      purchases: db.purchases[userId] || [],
      expenses: db.expenses[userId] || [],
      transfers: db.transfers[userId] || [],
      cashBalance: db.cashBalances[userId] || {
        userId,
        amount: 0,
        startDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      },
      memories: db.memories[userId] || [],
    });
  });

  // Version check
  app.get('/api/sync/version', (req, res) => {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    res.json({ version: db.versions[userId] || 1 });
  });

  // Push data from client
  app.post('/api/sync', (req, res) => {
    const userId = req.body.userId || DEFAULT_USER_ID;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    if (Array.isArray(products)) {
      db.products[userId] = products.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(orders)) {
      db.orders[userId] = orders.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(purchases)) {
      db.purchases[userId] = purchases.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(expenses)) {
      db.expenses[userId] = expenses.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(transfers)) {
      db.transfers[userId] = transfers.map((item) => ({ ...item, userId }));
    }
    if (cashBalance) {
      db.cashBalances[userId] = { ...cashBalance, userId };
    }
    if (Array.isArray(memories)) {
      db.memories[userId] = memories.map((item) => ({ ...item, userId }));
    }

    db.versions[userId] = (db.versions[userId] || 1) + 1;
    saveDatabase(db);

    res.json({ success: true, version: db.versions[userId] });
  });

  // Safe migration endpoint: non-destructive merge of device records
  app.post('/api/sync/migrate', (req, res) => {
    const userId = req.body.userId || DEFAULT_USER_ID;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    const mergeServerItems = <T extends { id?: string; updatedAt?: string }>(
      serverList: T[] = [],
      clientList: T[] = []
    ): T[] => {
      const map = new Map<string, T>();
      serverList.forEach((item, i) => map.set(item.id || `s_${i}`, { ...item, userId }));
      clientList.forEach((item, i) => {
        const key = item.id || `c_${i}`;
        if (!map.has(key)) {
          map.set(key, { ...item, userId });
        } else {
          const existing = map.get(key)!;
          const clientTime = new Date(item.updatedAt || 0).getTime();
          const serverTime = new Date(existing.updatedAt || 0).getTime();
          if (clientTime >= serverTime) {
            map.set(key, { ...item, userId });
          }
        }
      });
      return Array.from(map.values());
    };

    let hadChanges = false;
    if (Array.isArray(products) && products.length > 0) {
      db.products[userId] = mergeServerItems(db.products[userId] || [], products);
      hadChanges = true;
    }
    if (Array.isArray(orders) && orders.length > 0) {
      db.orders[userId] = mergeServerItems(db.orders[userId] || [], orders);
      hadChanges = true;
    }
    if (Array.isArray(purchases) && purchases.length > 0) {
      db.purchases[userId] = mergeServerItems(db.purchases[userId] || [], purchases);
      hadChanges = true;
    }
    if (Array.isArray(expenses) && expenses.length > 0) {
      db.expenses[userId] = mergeServerItems(db.expenses[userId] || [], expenses);
      hadChanges = true;
    }
    if (Array.isArray(transfers) && transfers.length > 0) {
      db.transfers[userId] = mergeServerItems(db.transfers[userId] || [], transfers);
      hadChanges = true;
    }
    if (cashBalance && cashBalance.amount > 0) {
      db.cashBalances[userId] = { ...cashBalance, userId };
      hadChanges = true;
    }
    if (Array.isArray(memories) && memories.length > 0) {
      db.memories[userId] = mergeServerItems(db.memories[userId] || [], memories);
      hadChanges = true;
    }

    if (hadChanges) {
      db.versions[userId] = (db.versions[userId] || 1) + 1;
      saveDatabase(db);
    }

    res.json({
      success: true,
      migrated: hadChanges,
      version: db.versions[userId] || 1,
    });
  });

  // ==========================================
  // COMPATIBILITY ENDPOINTS
  // Returns immediate 200 OK for any legacy auth requests from cached tabs
  // ==========================================
  app.all('/api/auth/*', (req, res) => {
    const owner = db.users.find((u) => u.id === DEFAULT_USER_ID) || DEFAULT_USER;
    res.json({
      success: true,
      token: 'direct_access_mode',
      user: owner,
      sessions: [],
      logs: [],
      message: 'Acesso direto liberado sem exigência de autenticação.',
    });
  });

  app.all('/api/admin/*', (req, res) => {
    res.json({
      success: true,
      users: db.users,
      logs: [],
    });
  });

  // ==========================================
  // FRONTEND CLIENT SERVING
  // ==========================================
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));
  const isCloudRun = !!process.env.K_SERVICE || !!process.env.K_REVISION;
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    isCloudRun ||
    (indexHtmlExists && process.env.npm_lifecycle_event !== 'dev');

  if (isProduction && indexHtmlExists) {
    console.log('LucraiBR: Servindo arquivos estáticos de produção a partir de /dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.path}` });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Mount Vite dev server middleware in local development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LucraiBR server listening on port ${PORT} (Direct Access Mode)`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
