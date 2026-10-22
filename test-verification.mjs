import assert from 'assert';

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
  console.log('=== TESTES DO MODO ACESSO DIRETO (SEM LOGIN) ===\n');
  let passed = 0;
  let failed = 0;

  function testAssert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health check
  console.log('--- 1. Verificação do Servidor & Health Check ---');
  const health = await request('/api/health');
  testAssert(health.status === 200, 'Servidor backend responde 200 OK');
  testAssert(health.body?.accessMode === 'direct', 'Servidor opera em modo direto (direct)');

  // 2. Consulta de Perfil sem autenticação
  console.log('\n--- 2. Consulta de Perfil Direto da Operação ---');
  const profile = await request('/api/profile');
  testAssert(profile.status === 200, 'Rota /api/profile responde 200 OK sem token');
  testAssert(profile.body?.profile?.name === 'Gabriela Marques', 'Identifica nome da proprietária Gabriela Marques');
  testAssert(profile.body?.profile?.id === 'usr_owner_default', 'ID padrão usr_owner_default preservado');

  // 3. Atualização de dados da operação
  console.log('\n--- 3. Atualização do Nome da Operação sem token ---');
  const updateProfile = await request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Gabriela Marques',
      companyName: 'LucraiBR Vendas Online',
    }),
  });
  testAssert(updateProfile.status === 200, 'Atualização de perfil retorna 200 OK');
  testAssert(updateProfile.body?.profile?.companyName === 'LucraiBR Vendas Online', 'Nome da operação atualizado');

  // 4. Sincronização direta PC <-> Celular sem token
  console.log('\n--- 4. Sincronização Direta (/api/sync) sem exigir login ---');
  const syncGet = await request('/api/sync');
  testAssert(syncGet.status === 200, 'Leitura de dados em /api/sync funciona sem token');
  testAssert(Array.isArray(syncGet.body?.products), 'Retorna lista de produtos');

  // 5. Gravação direta de produto no banco de dados
  console.log('\n--- 5. Gravação de Dados na Nuvem sem exigência de token ---');
  const testProduct = {
    id: 'prod_direct_test_' + Date.now(),
    name: 'Produto Teste Direto Preservado',
    habitualCost: 25.0,
    referencePrice: 59.9,
    category: 'Geral',
    updatedAt: new Date().toISOString(),
  };

  const pushRes = await request('/api/sync', {
    method: 'POST',
    body: JSON.stringify({
      products: [testProduct],
      orders: [],
      purchases: [],
      expenses: [],
      transfers: [],
      cashBalance: { amount: 800, startDate: '2026-10-01' },
      memories: [],
    }),
  });
  testAssert(pushRes.status === 200, 'Gravação em /api/sync aceita com sucesso (status 200)');
  testAssert(pushRes.body?.success === true, 'Gravação confirmada com sucesso');

  // 6. Confirmação de persistência dos dados gravados
  console.log('\n--- 6. Leitura e Persistência dos Dados Gravados ---');
  const syncVerify = await request('/api/sync');
  const foundProd = syncVerify.body?.products?.find((p) => p.id === testProduct.id);
  testAssert(!!foundProd, 'Produto gravado foi persistido e retornado na consulta');
  testAssert(foundProd?.name === testProduct.name, 'Nome do produto gravado está intacto');

  // 7. Migração segura (merge de dados do celular sem sobrescrever)
  console.log('\n--- 7. Migração Segura Não-Destrutiva (/api/sync/migrate) ---');
  const phoneProduct = {
    id: 'phone_saved_' + Date.now(),
    name: 'Fone Bluetooth Celular Preservado',
    habitualCost: 35.0,
    referencePrice: 89.9,
    category: 'Eletrônicos',
    updatedAt: new Date().toISOString(),
  };

  const migrateRes = await request('/api/sync/migrate', {
    method: 'POST',
    body: JSON.stringify({
      products: [phoneProduct],
      orders: [],
      purchases: [],
      expenses: [],
      transfers: [],
    }),
  });
  testAssert(migrateRes.status === 200, 'Rota /api/sync/migrate retorna 200');

  const afterMigrate = await request('/api/sync');
  const foundBothOriginalAndPhone =
    afterMigrate.body?.products?.some((p) => p.id === testProduct.id) &&
    afterMigrate.body?.products?.some((p) => p.id === phoneProduct.id);
  testAssert(foundBothOriginalAndPhone, 'União segura preservou tanto os dados anteriores quanto os do celular');

  // 8. Compatibilidade: nenhuma chamada antiga de auth causa erro 404
  console.log('\n--- 8. Compatibilidade de Rotas Legadas (Sem erro 404/401) ---');
  const legacyLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'gabrielasousamarquess2@gmail.com' }),
  });
  testAssert(legacyLogin.status === 200, 'Chamadas legadas a /api/auth/login respondem 200 OK sem bloquear');

  const legacyMe = await request('/api/auth/me');
  testAssert(legacyMe.status === 200, 'Chamadas legadas a /api/auth/me respondem 200 OK sem erro');

  console.log('\n========================================');
  console.log(`RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Falha geral no teste:', err);
  process.exit(1);
});
