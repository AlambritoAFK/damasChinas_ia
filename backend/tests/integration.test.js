const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('path');

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  CROWN_ROW_P1,
  CROWN_ROW_P2,
  getOpponent,
  isKing
} = require('../src/game/constants');

const {
  createInitialBoard,
  cloneBoard,
  countPieces
} = require('../src/game/board');

const {
  getValidMovesForPlayer,
  getValidMovesForPiece,
  hasAnyCapture
} = require('../src/game/moveGenerator');

const {
  applyMove,
  checkGameOver,
  isValidMove,
  GAME_OVER_REASONS
} = require('../src/game/rules');

const {
  computeAiMove,
  DIFFICULTY_LEVELS
} = require('../src/ai/difficulty');

const gameRoutes = require('../src/routes/gameRoutes');

/**
 * Servidor Express de prueba con rutas de API y archivos estáticos del frontend.
 */
function createFullTestServer() {
  const app = express();
  app.use(express.json());

  // Servir frontend estático igual que en producción
  const frontendPath = path.join(__dirname, '../../frontend');
  app.use(express.static(frontendPath));

  app.use('/api/game', gameRoutes);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        baseUrl,
        apiUrl: `${baseUrl}/api/game`,
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

// =========================================================================
// BLOQUE 1: SIMULACIÓN DE PARTIDAS COMPLETAS Y FLUIDEZ DE LA IA
// =========================================================================

test('1. Simulación de Partida Completa Autónoma (IA vs IA) con Validación de Integridad', () => {
  let board = createInitialBoard();
  let currentTurn = PLAYER_1;
  const maxTurns = 80;
  let turnsPlayed = 0;
  let gameOver = false;

  while (!gameOver && turnsPlayed < maxTurns) {
    turnsPlayed++;

    // 1. Obtener movimientos legales disponibles
    const validMoves = getValidMovesForPlayer(board, currentTurn);
    if (validMoves.length === 0) {
      // Bloqueo total
      const result = checkGameOver(board, currentTurn);
      assert.equal(result.isGameOver, true);
      assert.equal(result.winner, getOpponent(currentTurn));
      assert.equal(result.reason, GAME_OVER_REASONS.BLOCKED);
      gameOver = true;
      break;
    }

    // 2. Comprobar que si hay captura, todos los movimientos legales son de captura
    const hasCapture = hasAnyCapture(board, currentTurn);
    if (hasCapture) {
      for (const m of validMoves) {
        assert.equal(m.isCapture, true, 'Regla violada: Si hay captura posible, todos los movimientos deben ser capturas');
        assert.ok(m.captures && m.captures.length > 0);
      }
    }

    // 3. Seleccionar jugada mediante IA (P1 en modo Fácil, P2 en modo Medio)
    const difficulty = currentTurn === PLAYER_1 ? 'easy' : 'medium';
    const aiResult = computeAiMove(board, currentTurn, difficulty);
    assert.ok(aiResult.bestMove, `El jugador ${currentTurn} debe encontrar un movimiento legal`);

    // 4. Validar que la jugada seleccionada es legal
    const legalMove = isValidMove(board, currentTurn, aiResult.bestMove);
    assert.ok(legalMove, 'La jugada seleccionada por la IA debe ser estrictamente legal');

    // 5. Aplicar la jugada
    const piecesBefore = countPieces(board);
    const newBoard = applyMove(board, aiResult.bestMove);
    const piecesAfter = countPieces(newBoard);

    // Si hubo captura, las piezas del oponente deben haber disminuido exactamente en el número de capturas
    if (aiResult.bestMove.isCapture) {
      const capturedCount = aiResult.bestMove.captures.length;
      if (currentTurn === PLAYER_1) {
        assert.equal(piecesBefore.player2.total - piecesAfter.player2.total, capturedCount);
      } else {
        assert.equal(piecesBefore.player1.total - piecesAfter.player1.total, capturedCount);
      }
    }

    // Si una pieza llegó a la fila extrema, debe haberse coronado a Rey
    const destRow = aiResult.bestMove.to.row;
    const destCol = aiResult.bestMove.to.col;
    if (currentTurn === PLAYER_1 && destRow === CROWN_ROW_P1) {
      assert.equal(newBoard[destRow][destCol], PIECES.P1_KING);
    } else if (currentTurn === PLAYER_2 && destRow === CROWN_ROW_P2) {
      assert.equal(newBoard[destRow][destCol], PIECES.P2_KING);
    }

    board = newBoard;

    // 6. Verificar si la partida terminó tras la jugada
    const opponent = getOpponent(currentTurn);
    const endCondition = checkGameOver(board, opponent);
    if (endCondition.isGameOver) {
      assert.equal(endCondition.winner, currentTurn);
      assert.ok(endCondition.reason === GAME_OVER_REASONS.ELIMINATION || endCondition.reason === GAME_OVER_REASONS.BLOCKED);
      gameOver = true;
      break;
    }

    // Alternar turno
    currentTurn = opponent;
  }

  assert.ok(turnsPlayed > 5, 'La partida debe haber progresado al menos 5 jugadas fluidamente');
});

test('2. Rendimiento y Fluidez de la IA en los 3 Niveles de Dificultad (Fácil, Medio, Difícil)', () => {
  const initialBoard = createInitialBoard();

  // Nivel Fácil (Profundidad 2): < 150ms
  const easyStart = performance.now();
  const easyRes = computeAiMove(initialBoard, PLAYER_2, DIFFICULTY_LEVELS.EASY);
  const easyElapsed = performance.now() - easyStart;
  assert.ok(easyRes.bestMove !== null);
  assert.equal(easyRes.depth, 2);
  assert.ok(easyElapsed < 250, `Nivel fácil debe responder en < 250ms. Tomó: ${easyElapsed.toFixed(1)}ms`);

  // Nivel Medio (Profundidad 4): < 500ms
  const medStart = performance.now();
  const medRes = computeAiMove(initialBoard, PLAYER_2, DIFFICULTY_LEVELS.MEDIUM);
  const medElapsed = performance.now() - medStart;
  assert.ok(medRes.bestMove !== null);
  assert.equal(medRes.depth, 4);
  assert.ok(medRes.nodesEvaluated > 0);
  assert.ok(medElapsed < 800, `Nivel medio debe responder en < 800ms. Tomó: ${medElapsed.toFixed(1)}ms`);

  // Nivel Difícil (Profundidad 6): < 1500ms
  const hardStart = performance.now();
  const hardRes = computeAiMove(initialBoard, PLAYER_2, DIFFICULTY_LEVELS.HARD);
  const hardElapsed = performance.now() - hardStart;
  assert.ok(hardRes.bestMove !== null);
  assert.equal(hardRes.depth, 6);
  assert.ok(hardRes.prunedBranches >= 0);
  assert.ok(hardElapsed < 1800, `Nivel difícil debe responder en tiempo razonable. Tomó: ${hardElapsed.toFixed(1)}ms`);
});

// =========================================================================
// BLOQUE 2: VALIDACIÓN DE CASOS LÍMITE (EDGE CASES)
// =========================================================================

test('3. Caso Límite: Captura Obligatoria Inviolable cuando existen múltiples opciones simples', () => {
  const board = createEmptyBoard();
  // P1 tiene una ficha en (5, 2) que puede capturar a P2 en (4, 3) saltando a (3, 4)
  board[5][2] = PIECES.P1_MAN;
  board[4][3] = PIECES.P2_MAN;
  // P1 tiene otra ficha en (6, 7) con movimientos simples libres hacia (5, 6)
  board[6][7] = PIECES.P1_MAN;

  const validMovesP1 = getValidMovesForPlayer(board, PLAYER_1);
  assert.equal(validMovesP1.length, 1, 'Únicamente el movimiento de captura debe ser generado');
  assert.equal(validMovesP1[0].isCapture, true);
  assert.equal(validMovesP1[0].from.row, 5);
  assert.equal(validMovesP1[0].from.col, 2);
  assert.equal(validMovesP1[0].to.row, 3);
  assert.equal(validMovesP1[0].to.col, 4);

  // La ficha en (6,7) no debe tener movimientos válidos debido a la regla de captura obligatoria
  const pieceMoves67 = getValidMovesForPiece(board, 6, 7);
  assert.equal(pieceMoves67.length, 0, 'La ficha sin capturas no debe poder moverse si hay capturas en el tablero');
});

test('4. Caso Límite: Salto Múltiple Encadenado Complejo (Triple Salto en Zigzag)', () => {
  const board = createEmptyBoard();
  // P1 en (7, 0)
  board[7][0] = PIECES.P1_MAN;
  // Fichas enemigas P2 alineadas para un triple salto zigzag:
  // Salto 1: salta sobre (6, 1) cayendo en (5, 2)
  board[6][1] = PIECES.P2_MAN;
  // Salto 2: salta sobre (4, 3) cayendo en (3, 4)
  board[4][3] = PIECES.P2_MAN;
  // Salto 3: salta sobre (2, 5) cayendo en (1, 6)
  board[2][5] = PIECES.P2_MAN;

  const moves = getValidMovesForPlayer(board, PLAYER_1);
  assert.equal(moves.length, 1, 'Debe haber exactamente 1 ruta de triple salto');
  const jump = moves[0];
  assert.equal(jump.isCapture, true);
  assert.equal(jump.captures.length, 3, 'Deben registrarse 3 fichas capturadas');
  assert.equal(jump.to.row, 1);
  assert.equal(jump.to.col, 6);

  // Aplicar movimiento y verificar eliminación de las 3 piezas enemigas
  const resultingBoard = applyMove(board, jump);
  assert.equal(resultingBoard[7][0], PIECES.EMPTY);
  assert.equal(resultingBoard[6][1], PIECES.EMPTY);
  assert.equal(resultingBoard[4][3], PIECES.EMPTY);
  assert.equal(resultingBoard[2][5], PIECES.EMPTY);
  assert.equal(resultingBoard[1][6], PIECES.P1_MAN);
});

test('5. Caso Límite: Coronación Inmediata al Alcanzar Fila Extrema y Finalización de Turno', () => {
  // Caso A: Coronación en movimiento simple para P1 (fila 0) y P2 (fila 7)
  const boardA = createEmptyBoard();
  boardA[1][2] = PIECES.P1_MAN;
  boardA[6][5] = PIECES.P2_MAN;

  const moveP1 = { from: { row: 1, col: 2 }, to: { row: 0, col: 1 }, captures: [] };
  const boardAfterP1 = applyMove(boardA, moveP1);
  assert.equal(boardAfterP1[0][1], PIECES.P1_KING, 'Peón P1 debe coronarse a Rey (2) al alcanzar fila 0');

  const moveP2 = { from: { row: 6, col: 5 }, to: { row: 7, col: 6 }, captures: [] };
  const boardAfterP2 = applyMove(boardA, moveP2);
  assert.equal(boardAfterP2[7][6], PIECES.P2_KING, 'Peón P2 debe coronarse a Rey (-2) al alcanzar fila 7');

  // Caso B: Coronación mediante salto con captura
  const boardB = createEmptyBoard();
  boardB[2][3] = PIECES.P1_MAN;
  boardB[1][2] = PIECES.P2_MAN; // Capturable por P1 aterrizando en (0, 1)

  const captureMoveP1 = getValidMovesForPlayer(boardB, PLAYER_1);
  assert.equal(captureMoveP1.length, 1);
  assert.equal(captureMoveP1[0].to.row, 0);
  assert.equal(captureMoveP1[0].isKingPromotion, true);

  const boardAfterCapture = applyMove(boardB, captureMoveP1[0]);
  assert.equal(boardAfterCapture[0][1], PIECES.P1_KING);
  assert.equal(boardAfterCapture[1][2], PIECES.EMPTY, 'Ficha enemiga debe ser removida');
});

test('6. Caso Límite: Rey con Movilidad Total en las 4 Diagonales y Capturas en Retroceso', () => {
  const board = createEmptyBoard();
  board[4][4] = PIECES.P1_KING; // Rey blanco en el centro

  // Ficha enemiga detrás del rey: en (5, 3)
  board[5][3] = PIECES.P2_MAN;
  // Ficha enemiga delante del rey: en (3, 5)
  board[3][5] = PIECES.P2_MAN;

  const moves = getValidMovesForPiece(board, 4, 4);
  // El rey debe poder capturar tanto hacia adelante (saltando a 2, 6) como hacia atrás (saltando a 6, 2)
  assert.equal(moves.length, 2, 'El rey debe poder capturar en ambas direcciones diagonales');
  const destinations = moves.map(m => `${m.to.row},${m.to.col}`).sort();
  assert.deepEqual(destinations, ['2,6', '6,2']);
});

test('7. Caso Límite: Detección de Victoria por Bloqueo Total (Stalemate)', () => {
  const board = createEmptyBoard();
  // P1 en la esquina (7, 0)
  board[7][0] = PIECES.P1_MAN;
  // P2 bloqueando en (6, 1) y casilla de salto (5, 2) ocupada
  board[6][1] = PIECES.P2_MAN;
  board[5][2] = PIECES.P2_MAN;

  const result = checkGameOver(board, PLAYER_1);
  assert.equal(result.isGameOver, true, 'El juego debe terminar al no haber movimientos válidos');
  assert.equal(result.winner, PLAYER_2, 'El oponente gana si el jugador activo queda bloqueado');
  assert.equal(result.reason, GAME_OVER_REASONS.BLOCKED);
});

test('8. Caso Límite: Opción de Rendirse (Resignation) y Finalización Inmediata', () => {
  // 1. Rendición de Jugador 1
  const resignP1 = {
    isGameOver: true,
    winner: PLAYER_2,
    reason: GAME_OVER_REASONS.RESIGN
  };
  assert.equal(resignP1.winner, PLAYER_2);
  assert.equal(resignP1.reason, 'RESIGN');

  // 2. Rendición de Jugador 2
  const resignP2 = {
    isGameOver: true,
    winner: PLAYER_1,
    reason: GAME_OVER_REASONS.RESIGN
  };
  assert.equal(resignP2.winner, PLAYER_1);
  assert.equal(resignP2.reason, 'RESIGN');
});

// =========================================================================
// BLOQUE 3: PRUEBAS INTEGRALES DE LA API REST (CLIENTE-SERVIDOR E2E)
// =========================================================================

test('9. Flujo Integral E2E: Partida Completa mediante API REST con Validación de Turnos y Rendición', async () => {
  const { baseUrl, apiUrl, close } = await createFullTestServer();

  try {
    // 1. GET /api/game/health: Comprobación de salud
    const healthRes = await fetch(`${apiUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.success, true);
    assert.equal(healthData.status, 'ok');

    // 2. POST /api/game/new: Iniciar nueva partida
    const newGameRes = await fetch(`${apiUrl}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: 'medium', startingPlayer: 1 })
    });
    assert.equal(newGameRes.status, 200);
    const gameData = await newGameRes.json();
    assert.equal(gameData.success, true);
    assert.equal(gameData.board.length, 8);
    assert.equal(gameData.pieceCounts.player1.total, 12);
    assert.equal(gameData.pieceCounts.player2.total, 12);

    let currentBoard = gameData.board;

    // 3. POST /api/game/valid-moves: Consultar movimientos válidos para la pieza en (5, 0)
    const validMovesRes = await fetch(`${apiUrl}/valid-moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: currentBoard, row: 5, col: 0, player: 1 })
    });
    assert.equal(validMovesRes.status, 200);
    const movesData = await validMovesRes.json();
    assert.equal(movesData.success, true);
    assert.ok(movesData.validMoves.length > 0);
    const chosenMove = movesData.validMoves[0];

    // 4. POST /api/game/apply-move: Aplicar movimiento humano en el servidor
    const applyRes = await fetch(`${apiUrl}/apply-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: currentBoard, player: 1, move: chosenMove })
    });
    assert.equal(applyRes.status, 200);
    const appliedData = await applyRes.json();
    assert.equal(appliedData.success, true);
    currentBoard = appliedData.resultingBoard;

    // 5. POST /api/game/ai-move: Solicitar respuesta de la IA
    const aiRes = await fetch(`${apiUrl}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: currentBoard, player: -1, difficulty: 'medium' })
    });
    assert.equal(aiRes.status, 200);
    const aiData = await aiRes.json();
    assert.equal(aiData.success, true);
    assert.ok(aiData.bestMove !== null);
    assert.ok(aiData.metrics.timeMs >= 0);
    assert.equal(aiData.metrics.depth, 4);

    // 6. POST /api/game/resign: Rendición voluntaria del Humano
    const resignRes = await fetch(`${apiUrl}/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: 1 })
    });
    assert.equal(resignRes.status, 200);
    const resignData = await resignRes.json();
    assert.equal(resignData.success, true);
    assert.equal(resignData.isGameOver, true);
    assert.equal(resignData.winner, -1, 'Si el jugador 1 se rinde, el ganador debe ser el jugador 2');
    assert.equal(resignData.reason, 'RESIGN');

  } finally {
    await close();
  }
});

test('10. Servidor Express: Distribución Estática Correcta del Frontend y Recursos', async () => {
  const { baseUrl, close } = await createFullTestServer();

  try {
    // 1. GET / (index.html)
    const indexRes = await fetch(`${baseUrl}/`);
    assert.equal(indexRes.status, 200);
    const indexHtml = await indexRes.text();
    assert.ok(indexHtml.includes('id="checkersBoard"'), 'index.html debe contener el tablero checkersBoard');
    assert.ok(indexHtml.includes('id="btnResign"'), 'index.html debe contener el botón de rendirse');
    assert.ok(indexHtml.includes('id="btnNewGame"'), 'index.html debe contener el botón de nueva partida');
    assert.ok(indexHtml.includes('id="gameMode"'), 'index.html debe contener el selector de modo de juego');
    assert.ok(indexHtml.includes('id="difficulty"'), 'index.html debe contener el selector de dificultad');
    assert.ok(indexHtml.includes('id="gameOverModal"'), 'index.html debe contener el modal de fin de juego');

    // 2. GET /css/board.css
    const boardCssRes = await fetch(`${baseUrl}/css/board.css`);
    assert.equal(boardCssRes.status, 200);
    const boardCss = await boardCssRes.text();
    assert.ok(boardCss.includes('.checkers-board-grid'), 'board.css debe definir la cuadrícula');

    // 3. GET /css/style.css
    const styleCssRes = await fetch(`${baseUrl}/css/style.css`);
    assert.equal(styleCssRes.status, 200);

    // 4. GET /js/api.js, /js/boardUI.js, /js/app.js
    const apiJsRes = await fetch(`${baseUrl}/js/api.js`);
    assert.equal(apiJsRes.status, 200);
    const boardUiJsRes = await fetch(`${baseUrl}/js/boardUI.js`);
    assert.equal(boardUiJsRes.status, 200);
    const appJsRes = await fetch(`${baseUrl}/js/app.js`);
    assert.equal(appJsRes.status, 200);

  } finally {
    await close();
  }
});
