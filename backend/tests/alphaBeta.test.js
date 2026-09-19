const test = require('node:test');
const assert = require('node:assert/strict');

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
  findBestMove,
  minimax,
  orderMoves
} = require('../src/ai/alphaBeta');

const {
  WIN_SCORE
} = require('../src/ai/heuristics');

function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. Optimización de jugada única forzada: Respuesta inmediata sin desplegar árbol', () => {
  const board = createEmptyBoard();
  // P2 en [3, 2] tiene captura obligatoria sobre [4, 3] aterrizando en [5, 4]
  board[3][2] = PIECES.P2_MAN;
  board[4][3] = PIECES.P1_MAN;

  // Pieza adicional de P2 con movimientos simples (descartados por la regla de captura obligatoria)
  board[0][1] = PIECES.P2_MAN;

  // Pieza de P1 lejana
  board[7][6] = PIECES.P1_MAN;

  // Por la regla de captura obligatoria, P2 solo tiene 1 movimiento válido posible en todo el tablero
  const result = findBestMove(board, PLAYER_2, 4);

  assert.ok(result.bestMove !== null);
  assert.equal(result.nodesEvaluated, 1, 'Debe haber evaluado exactamente 1 nodo para jugada forzada');
  assert.equal(result.prunedBranches, 0);
  assert.deepEqual(result.bestMove.from, { row: 3, col: 2 });
  assert.deepEqual(result.bestMove.to, { row: 5, col: 4 });
  assert.equal(result.bestMove.isCapture, true);
});

test('2. Selección de captura ganadora inmediata', () => {
  const board = createEmptyBoard();
  // P2 en [3, 2]
  board[3][2] = PIECES.P2_MAN;
  // Única pieza de P1 en [4, 3], aterrizaje en [5, 4] vacío
  board[4][3] = PIECES.P1_MAN;

  const result = findBestMove(board, PLAYER_2, 3);

  assert.ok(result.bestMove !== null);
  assert.equal(result.bestMove.isCapture, true);
  assert.deepEqual(result.bestMove.from, { row: 3, col: 2 });
  assert.deepEqual(result.bestMove.to, { row: 5, col: 4 });
  assert.deepEqual(result.bestMove.captures, [{ row: 4, col: 3 }]);
});

test('3. Priorización de captura múltiple (doble salto) sobre captura simple', () => {
  const board = createEmptyBoard();
  // P2 rey en [1, 2] que puede saltar hacia la izquierda (simple) o hacia la derecha (doble)
  board[1][2] = PIECES.P2_KING;

  // Camino simple: enemigo en [2, 1], aterrizaje [3, 0]
  board[2][1] = PIECES.P1_MAN;

  // Camino doble: enemigo en [2, 3] -> aterrizaje [3, 4], y enemigo en [4, 5] -> aterrizaje [5, 6]
  board[2][3] = PIECES.P1_MAN;
  board[4][5] = PIECES.P1_MAN;

  // Pieza auxiliar P1 para evitar que la partida termine de golpe
  board[7][0] = PIECES.P1_MAN;

  const result = findBestMove(board, PLAYER_2, 3);

  assert.ok(result.bestMove !== null);
  assert.equal(result.bestMove.isCapture, true);
  assert.equal(result.bestMove.captures.length, 2, 'Debe preferir el doble salto que captura 2 piezas');
  assert.deepEqual(result.bestMove.to, { row: 5, col: 6 });
});

test('4. Evasión táctica: La IA evita casillas suicidas', () => {
  const board = createEmptyBoard();
  // P2 en [3, 2] puede mover a [4, 1] o a [4, 3]
  board[3][2] = PIECES.P2_MAN;

  // Si P2 mueve a [4, 3], P1 en [5, 4] saltará sobre [4, 3] aterrizando en [3, 2]
  // porque [3, 2] quedará vacía y la dirección de P1 es hacia arriba!
  board[5][4] = PIECES.P1_MAN;

  // Piezas de soporte seguras
  board[0][1] = PIECES.P2_MAN;
  board[7][6] = PIECES.P1_MAN;

  const result = findBestMove(board, PLAYER_2, 3);

  assert.ok(result.bestMove !== null);
  // Debe elegir mover a [4, 1] para no suicidarse en [4, 3]
  assert.deepEqual(result.bestMove.from, { row: 3, col: 2 });
  assert.deepEqual(result.bestMove.to, { row: 4, col: 1 }, 'Debe elegir la casilla segura [4, 1] en lugar de [4, 3]');
});

test('5. Búsqueda de coronación: La IA aprovecha la oportunidad de coronar a Rey', () => {
  const board = createEmptyBoard();
  // P2 en [6, 3] puede coronar moviendo a [7, 4] o [7, 2]
  board[6][3] = PIECES.P2_MAN;
  // Otra pieza de P2 que solo tiene movimientos normales
  board[1][2] = PIECES.P2_MAN;

  // Piezas de P1 alejadas
  board[7][0] = PIECES.P1_MAN;
  board[6][7] = PIECES.P1_MAN;

  const result = findBestMove(board, PLAYER_2, 3);

  assert.ok(result.bestMove !== null);
  assert.equal(result.bestMove.isKingPromotion, true, 'La IA debe priorizar la jugada que corona a Rey');
  assert.equal(result.bestMove.to.row, 7);
});

test('6. Eficiencia de la Poda Alfa-Beta y Move Ordering', () => {
  const board = createInitialBoard();
  // En el tablero inicial a profundidad 4, deben producirse podas Alfa-Beta
  const result = findBestMove(board, PLAYER_2, 4);

  assert.ok(result.bestMove !== null);
  assert.ok(result.nodesEvaluated > 0);
  assert.ok(result.prunedBranches > 0, 'Debe haber producido podas Alfa-Beta (prunedBranches > 0)');
  assert.ok(result.timeMs < 1000, `El tiempo de cálculo (${result.timeMs}ms) debe ser menor a 1 segundo`);
});

test('7. orderMoves ordena capturas y coronaciones al inicio', () => {
  const board = createEmptyBoard();
  const moves = [
    { from: { row: 5, col: 2 }, to: { row: 4, col: 1 }, isCapture: false, isKingPromotion: false, captures: [] },
    { from: { row: 3, col: 2 }, to: { row: 5, col: 4 }, isCapture: true, isKingPromotion: false, captures: [{ row: 4, col: 3 }] },
    { from: { row: 1, col: 2 }, to: { row: 5, col: 6 }, isCapture: true, isKingPromotion: false, captures: [{ row: 2, col: 3 }, { row: 4, col: 5 }] },
    { from: { row: 6, col: 3 }, to: { row: 7, col: 4 }, isCapture: false, isKingPromotion: true, captures: [] }
  ];

  const ordered = orderMoves(board, moves, PLAYER_2);

  // El doble salto debe ser el primero
  assert.equal(ordered[0].captures.length, 2, 'La captura múltiple debe estar en primer lugar');
  // Luego el salto simple
  assert.equal(ordered[1].captures.length, 1, 'La captura simple debe estar en segundo lugar');
  // Luego la coronación
  assert.equal(ordered[2].isKingPromotion, true, 'La coronación debe preceder al movimiento simple normal');
  // Al final el movimiento simple
  assert.equal(ordered[3].isCapture, false);
});

test('8. Posición de fin de juego o bloqueo: Retorno seguro sin excepciones', () => {
  const board = createEmptyBoard();
  // Sin piezas de P2
  board[5][2] = PIECES.P1_MAN;

  const result = findBestMove(board, PLAYER_2, 2);
  assert.equal(result.bestMove, null);
  assert.equal(result.score, -WIN_SCORE);
  assert.equal(result.nodesEvaluated, 0);
});
