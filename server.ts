import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  passwordHash?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: string;
}

interface TwoFactorPendingToken {
  id: string;
  userId: string;
  code: string;
  expiresAt: number;
  used: boolean;
}

interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  deviceType: 'Computador' | 'Smartphone' | 'Tablet';
  browser: string;
  os: string;
  ip: string;
  approxLocation: string;
  loginTime: string;
  lastActive: string;
  isActive: boolean;
}

interface SecurityLogRecord {
  id: string;
  userId: string;
  timestamp: string;
  action: 'login' | 'logout' | 'password_change' | '2fa_enabled' | '2fa_disabled' | 'session_terminated' | 'all_sessions_terminated' | 'sync';
  details: string;
  ip?: string;
  device?: string;
}

interface CloudDatabase {
  users: UserRecord[];
  sessions: SessionRecord[];
  pending2FACodes: TwoFactorPendingToken[];
  securityLogs: SecurityLogRecord[];
  products: Record<string, any[]>; // userId -> products
  orders: Record<string, any[]>; // userId -> orders
  purchases: Record<string, any[]>; // userId -> purchases
  expenses: Record<string, any[]>; // userId -> expenses
  transfers: Record<string, any[]>; // userId -> transfers
  cashBalances: Record<string, any>; // userId -> initial balance
  memories: Record<string, any[]>; // userId -> memories
  versions: Record<string, number>; // userId -> data version
}

function loadDatabase(): CloudDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading cloud_db.json, initializing empty DB:', err);
  }

  // Initial seed
  const defaultUser: UserRecord = {
    id: 'usr_owner_default',
    email: 'gabrielasousamarquess2@gmail.com',
    name: 'Gabriela Marques',
    companyName: 'LucraiBR Vendas Online',
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };

  const initialDB: CloudDatabase = {
    users: [defaultUser],
    sessions: [],
    pending2FACodes: [],
    securityLogs: [
      {
        id: 'log_seed_1',
        userId: defaultUser.id,
        timestamp: new Date().toISOString(),
        action: 'login',
        details: 'Conta inicial Gabriela Marques pronta para sincronização na nuvem',
        device: 'Servidor Nuvem LucraiBR',
      },
    ],
    products: {},
    orders: {},
    purchases: {},
    expenses: {},
    transfers: {},
    cashBalances: {},
    memories: {},
    versions: {},
  };

  saveDatabase(initialDB);
  return initialDB;
}

function saveDatabase(db: CloudDatabase): void {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving cloud_db.json:', err);
  }
}

let db = loadDatabase();

function parseDeviceInfo(userAgent: string = '', ip: string = '') {
  let deviceType: 'Computador' | 'Smartphone' | 'Tablet' = 'Computador';
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) {
    deviceType = 'Smartphone';
  }

  let browser = 'Navegador Web';
  if (/edg/i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(userAgent)) browser = 'Opera';

  let os = 'Sistema Operacional';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  const approxLocation = 'São Paulo, Brasil (Conexão Segura SSL)';

  return { deviceType, browser, os, approxLocation };
}

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.substring(7).trim();
  const session = db.sessions.find((s) => s.token === token && s.isActive);

  if (!session) {
    return res.status(401).json({ error: 'Sessão inválida ou encerrada pelo servidor' });
  }

  // Update lastActive
  session.lastActive = new Date().toISOString();
  (req as any).user = db.users.find((u) => u.id === session.userId);
  (req as any).session = session;
  next();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '25mb' }));

  // API Health & Status
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1. AUTH ROUTES
  app.post('/api/auth/register', (req, res) => {
    const { name, email, companyName, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const newUser: UserRecord = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      name: name.trim(),
      email: cleanEmail,
      companyName: companyName?.trim() || 'Minha Operação Marketplace',
      passwordHash: password ? crypto.createHash('sha256').update(password).digest('hex') : undefined,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Create session
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const { deviceType, browser, os, approxLocation } = parseDeviceInfo(userAgent, ip);

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: newUser.id,
      token,
      deviceType,
      browser: `${browser} (${os})`,
      os,
      ip,
      approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: newUser.id,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Conta criada e primeiro acesso via ${deviceType} (${browser})`,
      device: `${deviceType} - ${browser}`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        companyName: newUser.companyName,
        createdAt: newUser.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado. Crie uma conta para continuar.' });
    }

    // If password provided and user has password hash, check it
    if (user.passwordHash && password) {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (hash !== user.passwordHash) {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
    }

    // Check if 2FA / Token is enabled
    if (user.twoFactorEnabled) {
      // Generate a single-use 6-digit verification code with 5-minute validity
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const tempToken = 'temp_' + crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      db.pending2FACodes.push({
        id: tempToken,
        userId: user.id,
        code,
        expiresAt,
        used: false,
      });

      saveDatabase(db);

      // Return requirement for 2FA token
      return res.json({
        requires2FA: true,
        tempToken,
        // In local/preview context, return active code so user can input it or view it
        verificationCodeHint: code,
        expiresInMinutes: 5,
        message: 'Código de verificação de 6 dígitos gerado com sucesso.',
      });
    }

    // Direct login without 2FA
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const { deviceType, browser, os, approxLocation } = parseDeviceInfo(userAgent, ip);

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      token,
      deviceType,
      browser: `${browser} (${os})`,
      os,
      ip,
      approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Login efetuado no ${deviceType} (${browser})`,
      device: `${deviceType} - ${browser}`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Verify 2FA code
  app.post('/api/auth/verify-2fa', (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Token temporário e código de verificação são obrigatórios.' });
    }

    const pending = db.pending2FACodes.find((p) => p.id === tempToken);
    if (!pending) {
      return res.status(401).json({ error: 'Requisição de verificação expirada ou inexistente.' });
    }

    if (pending.used) {
      return res.status(401).json({ error: 'Este código de uso único já foi utilizado. Solicite um novo.' });
    }

    if (Date.now() > pending.expiresAt) {
      return res.status(401).json({ error: 'O código de verificação expirou (validade de 5 minutos excedida).' });
    }

    if (pending.code !== code.trim()) {
      return res.status(401).json({ error: 'Código de verificação incorreto.' });
    }

    // Mark code as used immediately to prevent replay
    pending.used = true;

    const user = db.users.find((u) => u.id === pending.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const { deviceType, browser, os, approxLocation } = parseDeviceInfo(userAgent, ip);

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      token,
      deviceType,
      browser: `${browser} (${os})`,
      os,
      ip,
      approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Acesso autenticado com 2FA com sucesso em ${deviceType}`,
      device: `${deviceType} - ${browser}`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Get current user profile & validate session
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const session = (req as any).session as SessionRecord;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        createdAt: user.createdAt,
        twoFactorEnabled: !!user.twoFactorEnabled,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Update profile
  app.put('/api/auth/profile', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { name, companyName } = req.body;

    if (name) user.name = name.trim();
    if (companyName !== undefined) user.companyName = companyName.trim();

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: 'Perfil do vendedor atualizado',
    });

    saveDatabase(db);
    res.json({ success: true, user });
  });

  // Change password
  app.post('/api/auth/password', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    user.passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'password_change',
      details: 'Senha de acesso alterada pelo usuário',
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Senha atualizada com sucesso.' });
  });

  // 2FA / Token Configuration
  app.post('/api/auth/2fa/toggle', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { enabled } = req.body;

    user.twoFactorEnabled = !!enabled;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: user.twoFactorEnabled ? '2fa_enabled' : '2fa_disabled',
      details: user.twoFactorEnabled
        ? 'Autenticação em dois fatores (token adicional) ATIVADA'
        : 'Autenticação em dois fatores (token adicional) DESATIVADA',
    });

    saveDatabase(db);
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  });

  // Generate test / sensitive action 2FA code
  app.post('/api/auth/2fa/generate-code', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tempToken = 'action_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.pending2FACodes.push({
      id: tempToken,
      userId: user.id,
      code,
      expiresAt,
      used: false,
    });

    saveDatabase(db);
    res.json({ success: true, tempToken, code, expiresInMinutes: 5 });
  });

  // Verify code for sensitive actions
  app.post('/api/auth/2fa/verify-action', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { tempToken, code } = req.body;

    const pending = db.pending2FACodes.find((p) => p.id === tempToken && p.userId === user.id);
    if (!pending || pending.used || Date.now() > pending.expiresAt || pending.code !== code.trim()) {
      return res.status(401).json({ error: 'Código de autorização inválido ou expirado.' });
    }

    pending.used = true;
    saveDatabase(db);
    res.json({ success: true });
  });

  // SESSIONS MANAGEMENT (Painel privado de dispositivos conectados)
  app.get('/api/auth/sessions', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const currentSession = (req as any).session as SessionRecord;

    const activeSessions = db.sessions
      .filter((s) => s.userId === user.id && s.isActive)
      .map((s) => ({
        id: s.id,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        loginTime: s.loginTime,
        lastActive: s.lastActive,
        approxLocation: s.approxLocation,
        isCurrentSession: s.id === currentSession.id,
      }))
      .sort((a, b) => (b.isCurrentSession ? 1 : 0) - (a.isCurrentSession ? 1 : 0));

    res.json({ sessions: activeSessions });
  });

  // Terminate a specific session
  app.post('/api/auth/sessions/:sessionId/terminate', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { sessionId } = req.params;

    const sessionToTerminate = db.sessions.find(
      (s) => s.id === sessionId && s.userId === user.id && s.isActive
    );

    if (!sessionToTerminate) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já inativa.' });
    }

    sessionToTerminate.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'session_terminated',
      details: `Sessão encerrada remotamente: ${sessionToTerminate.deviceType} (${sessionToTerminate.browser})`,
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Dispositivo desconectado com sucesso.' });
  });

  // Terminate all other sessions
  app.post('/api/auth/sessions/terminate-others', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const currentSession = (req as any).session as SessionRecord;

    let terminatedCount = 0;
    db.sessions.forEach((s) => {
      if (s.userId === user.id && s.id !== currentSession.id && s.isActive) {
        s.isActive = false;
        terminatedCount++;
      }
    });

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      action: 'all_sessions_terminated',
      details: `Encerradas ${terminatedCount} outras sessões conectadas`,
    });

    saveDatabase(db);
    res.json({ success: true, terminatedCount });
  });

  // Logout
  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const currentSession = (req as any).session as SessionRecord;
    currentSession.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: currentSession.userId,
      timestamp: new Date().toISOString(),
      action: 'logout',
      details: `Logout voluntário efetuado em ${currentSession.deviceType}`,
    });

    saveDatabase(db);
    res.json({ success: true });
  });

  // Security & Audit Logs
  app.get('/api/auth/logs', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userLogs = db.securityLogs
      .filter((l) => l.userId === user.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 50);

    res.json({ logs: userLogs });
  });

  // 2. DATA SYNCHRONIZATION API (PC <-> MOBILE)
  // Pull all data
  app.get('/api/sync', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;

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

  // Version check for fast lightweight polling
  app.get('/api/sync/version', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    res.json({ version: db.versions[userId] || 1 });
  });

  // Push / Batch save from client
  app.post('/api/sync', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    if (products !== undefined) db.products[userId] = products;
    if (orders !== undefined) db.orders[userId] = orders;
    if (purchases !== undefined) db.purchases[userId] = purchases;
    if (expenses !== undefined) db.expenses[userId] = expenses;
    if (transfers !== undefined) db.transfers[userId] = transfers;
    if (cashBalance !== undefined) db.cashBalances[userId] = cashBalance;
    if (memories !== undefined) db.memories[userId] = memories;

    db.versions[userId] = (db.versions[userId] || 1) + 1;
    saveDatabase(db);

    res.json({ success: true, version: db.versions[userId] });
  });

  // Safe migration endpoint: if cloud has no records yet for this user, seed it from client's existing state
  app.post('/api/sync/migrate', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    let hasServerData =
      (db.products[userId] && db.products[userId].length > 0) ||
      (db.orders[userId] && db.orders[userId].length > 0) ||
      (db.expenses[userId] && db.expenses[userId].length > 0);

    if (!hasServerData) {
      if (products && products.length > 0) db.products[userId] = products;
      if (orders && orders.length > 0) db.orders[userId] = orders;
      if (purchases && purchases.length > 0) db.purchases[userId] = purchases;
      if (expenses && expenses.length > 0) db.expenses[userId] = expenses;
      if (transfers && transfers.length > 0) db.transfers[userId] = transfers;
      if (cashBalance) db.cashBalances[userId] = cashBalance;
      if (memories && memories.length > 0) db.memories[userId] = memories;

      db.versions[userId] = (db.versions[userId] || 1) + 1;
      saveDatabase(db);
    }

    res.json({
      success: true,
      migrated: !hasServerData,
      version: db.versions[userId] || 1,
    });
  });

  // Serve Frontend
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Mount Vite dev server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LucraiBR server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
