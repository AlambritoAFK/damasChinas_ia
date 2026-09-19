const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

/**
 * Inicia el servidor `app` en un puerto efímero para pruebas de integración de server.js.
 */
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        baseUrl,
        close: () => new Promise(res => server.close(res))
      });
    });
  });
}

test('1. server.js: Arranque y respuesta de GET /api/game/health', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/game/health`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'ok');
  } finally {
    await close();
  }
});

test('2. server.js: Habilitación de headers CORS', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/game/health`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:8080'
      }
    });

    assert.equal(res.status, 200);
    // CORS debe permitir orígenes con el header Access-Control-Allow-Origin
    const corsHeader = res.headers.get('access-control-allow-origin');
    assert.equal(corsHeader, '*');
  } finally {
    await close();
  }
});

test('3. server.js: Endpoint informativo GET /api', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.endpoints.health);
    assert.ok(data.endpoints.aiMove);
  } finally {
    await close();
  }
});

test('4. server.js: Middleware 404 para rutas inexistentes', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/ruta-inexistente`);
    assert.equal(res.status, 404);

    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Ruta no encontrada'));
  } finally {
    await close();
  }
});

test('5. server.js: Inicialización de partida vía POST /api/game/new montado', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/game/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: 'easy' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.difficulty, 'easy');
    assert.equal(data.board.length, 8);
  } finally {
    await close();
  }
});
