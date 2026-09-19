const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES
} = require('../src/game/constants');

const {
  createInitialBoard
} = require('../src/game/board');

const {
  validateBoard,
  validateCoordinates,
  validatePlayer
} = require('../src/routes/gameController');

const gameRoutes = require('../src/routes/gameRoutes');

/**
 * Función auxiliar para iniciar un servidor Express de prueba en puerto efímero.
 */
function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game', gameRoutes);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}/api/game`;
      resolve({
        baseUrl,
        close: () => new Promise(res => server.close(res))
      });
    });
  });
}

function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. Validadores de entrada (validateBoard, validateCoordinates, validatePlayer)', () => {
  // Tablero válido
  const validBoard = createInitialBoard();
  assert.equal(validateBoard(validBoard).isValid, true);

  // Tablero inválido: no arreglo
  assert.equal(validateBoard(null).isValid, false);
  assert.equal(validateBoard({}).isValid, false);

  // Tablero inválido: dimensiones incorrectas
  assert.equal(validateBoard(new Array(7).fill([])).isValid, false);
  const badRowBoard = createInitialBoard();
  badRowBoard[0] = [0, 0, 0];
  assert.equal(validateBoard(badRowBoard).isValid, false);

  // Tablero inválido: valores de ficha no permitidos
  const badValueBoard = createInitialBoard();
  badValueBoard[0][1] = 99;
  assert.equal(validateBoard(badValueBoard).isValid, false);

  // Coordenadas válidas e inválidas
  assert.equal(validateCoordinates(0, 0).isValid, true);
  assert.equal(validateCoordinates(7, 7).isValid, true);
  assert.equal(validateCoordinates(-1, 0).isValid, false);
  assert.equal(validateCoordinates(8, 2).isValid, false);
  assert.equal(validateCoordinates('a', 2).isValid, false);
  assert.equal(validateCoordinates(undefined, 2).isValid, false);

  // Jugador válido e inválido
  assert.equal(validatePlayer(1).isValid, true);
  assert.equal(validatePlayer(-1).isValid, true);
  assert.equal(validatePlayer(0).isValid, false);
  assert.equal(validatePlayer(2).isValid, false);
  assert.equal(validatePlayer(null).isValid, false);
});

test('2. GET /api/game/health: Diagnóstico y estado del servidor', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'ok');
    assert.ok(data.message.includes('operativo'));
    assert.ok(data.timestamp);
  } finally {
    await close();
  }
});

test('3. POST /api/game/new: Inicialización de partida con tablero 8x8', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const res = await fetch(`${baseUrl}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: 'hard' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.currentTurn, PLAYER_1);
    assert.equal(data.board.length, 8);
    assert.equal(data.board[0].length, 8);
    assert.equal(data.pieceCounts.player1.total, 12);
    assert.equal(data.pieceCounts.player2.total, 12);
    assert.equal(data.difficulty, 'hard');
    assert.equal(data.difficultyName, 'Difícil');
  } finally {
    await close();
  }
});

test('4. POST /api/game/valid-moves: Validación de coordenadas y cálculo de jugadas', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const initialBoard = createInitialBoard();

    // Movimientos de una pieza en la fila 5, columna 2
    const resPiece = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: initialBoard, row: 5, col: 2 })
    });

    assert.equal(resPiece.status, 200);
    const dataPiece = await resPiece.json();
    assert.equal(dataPiece.success, true);
    assert.equal(dataPiece.piece, PIECES.P1_MAN);
    assert.equal(dataPiece.validMoves.length, 2);
    assert.equal(dataPiece.hasCapture, false);

    // Consulta para todo el jugador 1 en tablero inicial
    const resPlayer = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: initialBoard, player: 1 })
    });

    assert.equal(resPlayer.status, 200);
    const dataPlayer = await resPlayer.json();
    assert.equal(dataPlayer.success, true);
    assert.equal(dataPlayer.validMoves.length, 7);

    // Casilla vacía
    const resEmpty = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: initialBoard, row: 4, col: 4 })
    });
    const dataEmpty = await resEmpty.json();
    assert.equal(dataEmpty.validMoves.length, 0);

    // Validación de error 400 por parámetros faltantes o inválidos
    const resBad = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: initialBoard })
    });
    assert.equal(resBad.status, 400);

    const resBadCoords = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: initialBoard, row: 10, col: 0 })
    });
    assert.equal(resBadCoords.status, 400);
  } finally {
    await close();
  }
});

test('5. POST /api/game/valid-moves: Prioridad de captura obligatoria', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const board = createEmptyBoard();
    board[5][2] = PIECES.P1_MAN;
    board[4][3] = PIECES.P2_MAN;
    board[5][6] = PIECES.P1_MAN; // Otra ficha que solo tiene movimiento simple

    // Consultar la ficha en (5, 6) que NO puede capturar
    const resNoCap = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, row: 5, col: 6 })
    });
    const dataNoCap = await resNoCap.json();
    // Debido a la captura obligatoria en (5, 2), la pieza en (5, 6) no tiene movimientos legales
    assert.equal(dataNoCap.validMoves.length, 0);
    assert.equal(dataNoCap.mustCapture, true);

    // Consultar la ficha en (5, 2) que SÍ tiene captura
    const resCap = await fetch(`${baseUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, row: 5, col: 2 })
    });
    const dataCap = await resCap.json();
    assert.equal(dataCap.validMoves.length, 1);
    assert.equal(dataCap.validMoves[0].isCapture, true);
    assert.deepEqual(dataCap.validMoves[0].to, { row: 3, col: 4 });
  } finally {
    await close();
  }
});

test('6. POST /api/game/ai-move: Cálculo Minimax Alfa-Beta y retorno de métricas', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const board = createEmptyBoard();
    // Jugador 2 (IA) tiene una oportunidad de captura inmediata
    board[2][3] = PIECES.P2_MAN;
    board[3][4] = PIECES.P1_MAN;

    const res = await fetch(`${baseUrl}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board,
        player: PLAYER_2,
        difficulty: 'medium'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.bestMove, 'Debe devolver una jugada seleccionada');
    assert.deepEqual(data.bestMove.from, { row: 2, col: 3 });
    assert.deepEqual(data.bestMove.to, { row: 4, col: 5 });
    assert.equal(data.bestMove.captures.length, 1);

    // Verificación de métricas
    assert.ok(data.metrics, 'Debe incluir objeto de métricas');
    assert.equal(typeof data.metrics.nodesEvaluated, 'number');
    assert.equal(typeof data.metrics.depth, 'number');
    assert.equal(typeof data.metrics.timeMs, 'number');
    assert.equal(data.metrics.depth, 4);

    // Verificación del tablero proyectado resultante
    assert.ok(data.resultingBoard);
    assert.equal(data.resultingBoard[2][3], PIECES.EMPTY);
    assert.equal(data.resultingBoard[3][4], PIECES.EMPTY);
    assert.equal(data.resultingBoard[4][5], PIECES.P2_MAN);
  } finally {
    await close();
  }
});

test('7. POST /api/game/ai-move: Validación de errores y estado terminal', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    // Error 400: Tablero inválido
    const resBad = await fetch(`${baseUrl}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: 'invalid_board' })
    });
    assert.equal(resBad.status, 400);

    // Tablero en fin de partida (IA sin piezas)
    const emptyBoard = createEmptyBoard();
    emptyBoard[5][2] = PIECES.P1_MAN; // Solo quedan piezas del humano

    const resTerminal = await fetch(`${baseUrl}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: emptyBoard,
        player: PLAYER_2
      })
    });

    assert.equal(resTerminal.status, 200);
    const dataTerminal = await resTerminal.json();
    assert.equal(dataTerminal.success, true);
    assert.equal(dataTerminal.bestMove, null);
    assert.equal(dataTerminal.isGameOver, true);
    assert.equal(dataTerminal.winner, PLAYER_1);
  } finally {
    await close();
  }
});

test('8. POST /api/game/apply-move: Validación y ejecución de jugada en el servidor', async () => {
  const { baseUrl, close } = await createTestServer();
  try {
    const board = createEmptyBoard();
    board[5][2] = PIECES.P1_MAN;

    // Movimiento ilegal (salto inválido)
    const resIllegal = await fetch(`${baseUrl}/apply-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board,
        player: PLAYER_1,
        move: { from: { row: 5, col: 2 }, to: { row: 2, col: 2 } }
      })
    });
    assert.equal(resIllegal.status, 400);

    // Movimiento legal
    const resLegal = await fetch(`${baseUrl}/apply-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board,
        player: PLAYER_1,
        move: { from: { row: 5, col: 2 }, to: { row: 4, col: 1 } }
      })
    });
    assert.equal(resLegal.status, 200);
    const dataLegal = await resLegal.json();
    assert.equal(dataLegal.success, true);
    assert.equal(dataLegal.resultingBoard[5][2], PIECES.EMPTY);
    assert.equal(dataLegal.resultingBoard[4][1], PIECES.P1_MAN);
  } finally {
    await close();
  }
});
