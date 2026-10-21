// Test suite verifying all 8 requirements on live server
const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function runTests() {
  console.log('=== INICIANDO BATERIA DE TESTES DE INTEGRAÇÃO ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. TESTE: Login de administrador
  console.log('\n--- 1. Login com conta administrativa ---');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'gabrielasousamarquess2@gmail.com',
      password: 'lucraibr2026',
      deviceType: 'computador',
      browser: 'Chrome 128',
      os: 'Linux x86_64',
    }),
  });
  assert(adminLogin.status === 200, 'Login do admin retorna 200');
  assert(adminLogin.body?.user?.role === 'admin', 'Conta do admin possui role = admin');
  const adminToken = adminLogin.body?.token;
  const adminSessionId = adminLogin.body?.session?.id;

  // 2. TESTE: Criação de conta secundária para teste multi-usuário e multi-dispositivo
  console.log('\n--- 2. Criação de Usuário A e múltiplos dispositivos (PC e Celular) ---');
  const userAEmail = `test_user_a_${Date.now()}@example.com`;
  const registerUserA = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Vendedor Alpha',
      email: userAEmail,
      password: 'password12345',
      deviceType: 'computador',
      browser: 'Firefox',
      os: 'Windows 11',
    }),
  });
  assert(registerUserA.status === 200, 'Registro de Usuário A concluído com sucesso');
  const userATokenPC = registerUserA.body?.token;
  const userAId = registerUserA.body?.user?.id;
  const sessionPC = registerUserA.body?.session?.id;

  // Login no segundo dispositivo (Celular) com Usuário A
  const loginUserAMobile = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password: 'password12345',
      deviceType: 'celular',
      browser: 'Safari Mobile',
      os: 'iOS 18',
    }),
  });
  assert(loginUserAMobile.status === 200, 'Login no Celular com mesma conta retorna 200');
  const userATokenMobile = loginUserAMobile.body?.token;
  const sessionMobile = loginUserAMobile.body?.session?.id;
  assert(userATokenPC !== userATokenMobile, 'Sessões de PC e Celular possuem tokens distintos');

  // 3. TESTE: Sincronização entre computador e celular (Gravação no PC, Leitura no Celular)
  console.log('\n--- 3. Sincronização PC ↔ Celular na mesma conta ---');
  const testProduct = {
    id: `prod_${Date.now()}`,
    name: 'Kit Câmera de Segurança HD',
    sku: 'CAM-HD-001',
    category: 'Eletrônicos',
    costPrice: 85.00,
    packagingCost: 4.50,
    markup: 45,
    margin: 25,
    isArchived: false,
    updatedAt: new Date().toISOString(),
  };

  const syncPushPC = await request('/api/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userATokenPC}` },
    body: JSON.stringify({
      products: [testProduct],
      orders: [],
      purchases: [],
      transfers: [],
      expenses: [],
    }),
  });
  assert(syncPushPC.status === 200 && syncPushPC.body?.success, 'PC sincroniza e salva produto na nuvem');

  // Leitura pelo celular
  const syncPullMobile = await request('/api/sync', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userATokenMobile}` },
  });
  assert(syncPullMobile.status === 200, 'Celular consulta rota /api/sync com sucesso');
  const mobileProducts = syncPullMobile.body?.products || syncPullMobile.body?.data?.products || [];
  const foundOnMobile = mobileProducts.find((p) => p.id === testProduct.id);
  assert(!!foundOnMobile && foundOnMobile.name === testProduct.name, 'Produto cadastrado no PC é retornado para o celular');

  // 4. TESTE: Isolamento estrito entre usuários (Usuário B não acessa dados de Usuário A)
  console.log('\n--- 4. Isolamento estrito entre contas ---');
  const userBEmail = `test_user_b_${Date.now()}@example.com`;
  const registerUserB = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Vendedor Beta',
      email: userBEmail,
      password: 'password98765',
    }),
  });
  const userBToken = registerUserB.body?.token;

  // Consulta do Usuário B
  const syncPullUserB = await request('/api/sync', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  const userBProducts = syncPullUserB.body?.products || syncPullUserB.body?.data?.products || [];
  const canUserBSeeUserAProduct = userBProducts.some((p) => p.id === testProduct.id);
  assert(!canUserBSeeUserAProduct, 'Usuário B NÃO tem acesso a nenhum dado ou produto do Usuário A');

  // Tentativa de Usuário B enviar registro forjando userId de Usuário A
  const spoofAttempt = await request('/api/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userBToken}` },
    body: JSON.stringify({
      products: [{ ...testProduct, id: `spoofed_${Date.now()}`, userId: userAId }],
    }),
  });
  assert(spoofAttempt.status === 200, 'Tentativa de spoof processada pelo servidor');
  // Verificar se o servidor reescreveu o userId para o Usuário B (não permitindo gravação em A)
  const syncCheckUserA = await request('/api/sync', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userATokenPC}` },
  });
  const userAProductsAfterSpoof = syncCheckUserA.body?.products || syncCheckUserA.body?.data?.products || [];
  assert(
    !userAProductsAfterSpoof.some((p) => p.id.startsWith('spoofed_')),
    'Servidor impediu gravação forjada no espaço de outro usuário'
  );

  // 5. TESTE: Proteção de rotas administrativas (Usuário comum bloqueado com 403)
  console.log('\n--- 5. Proteção de rotas administrativas ---');
  const userForbiddenAccess = await request('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  assert(
    userForbiddenAccess.status === 403,
    'Usuário comum recebe 403 Forbidden ao tentar acessar rota /api/admin/users'
  );

  const adminAccess = await request('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminAccess.status === 200, 'Administrador autenticado tem acesso a /api/admin/users');
  assert(Array.isArray(adminAccess.body?.users), 'Lista de usuários retornada para o administrador');

  // 6. TESTE: Revogação de sessão e invalidação de token
  console.log('\n--- 6. Revogação de sessão de dispositivo ---');
  // Usuário A encerra a sessão do PC pelo Celular
  const terminateSessionRes = await request(`/api/auth/sessions/${sessionPC}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userATokenMobile}` },
  });
  assert(terminateSessionRes.status === 200, 'Sessão do PC revogada via requisição autenticada do Celular');

  // Testar se o token do PC agora é rejeitado com 401
  const pcAccessAfterRevocation = await request('/api/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userATokenPC}` },
  });
  assert(
    pcAccessAfterRevocation.status === 401,
    'Token da sessão revogada é rejeitado imediatamente com 401 Unauthorized'
  );

  // O Celular continua ativo
  const mobileAccessCheck = await request('/api/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userATokenMobile}` },
  });
  assert(mobileAccessCheck.status === 200, 'Sessão do Celular permanece ativa e válida');

  // 7. TESTE: Proteção contra ataques de força bruta (Lockout após 5 falhas)
  console.log('\n--- 7. Proteção contra força bruta (Lockout após 5 tentativas inválidas) ---');
  const bruteForceEmail = `brute_${Date.now()}@example.com`;
  await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Vítima Força Bruta',
      email: bruteForceEmail,
      password: 'correct_password_123',
    }),
  });

  // Executar 5 tentativas erradas
  for (let i = 1; i <= 5; i++) {
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: bruteForceEmail, password: 'wrong_password' }),
    });
  }

  // A 6ª tentativa deve receber 429 Too Many Requests
  const sixthAttempt = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: bruteForceEmail, password: 'correct_password_123' }),
  });
  assert(
    sixthAttempt.status === 429,
    'Após 5 tentativas falhas, o servidor bloqueia com status 429 (Muitas tentativas)'
  );

  // 8. TESTE: Recuperação de Senha via código do servidor
  console.log('\n--- 8. Recuperação de senha ---');
  const recoveryEmail = `recovery_${Date.now()}@example.com`;
  await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Usuário Recuperação',
      email: recoveryEmail,
      password: 'oldPassword123',
    }),
  });

  const forgotRes = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: recoveryEmail }),
  });
  assert(forgotRes.status === 200, 'Solicitação de recuperação de senha bem-sucedida');
  const resetCode = forgotRes.body?.code;
  assert(typeof resetCode === 'string' && resetCode.length === 6, 'Código gerado com 6 dígitos');

  const resetRes = await request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email: recoveryEmail,
      code: resetCode,
      newPassword: 'newSecretPassword456',
    }),
  });
  assert(resetRes.status === 200, 'Redefinição de senha com código validado no servidor');

  // Login com nova senha
  const newLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: recoveryEmail,
      password: 'newSecretPassword456',
    }),
  });
  assert(newLoginRes.status === 200, 'Login bem-sucedido com a nova senha');

  console.log(`\n========================================`);
  console.log(`RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
