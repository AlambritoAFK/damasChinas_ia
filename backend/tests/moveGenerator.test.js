const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  CROWN_ROW_P1,
  CROWN_ROW_P2
} = require('../src/game/constants');

const {
  createInitialBoard,
  cloneBoard
} = require('../src/game/board');

const {
  getSimpleMovesForPiece,
  getSingleJumpsForPiece,
  getJumpsForPiece,
  hasAnyCapture,
  getValidMovesForPlayer,
  getValidMovesForPiece
} = require('../src/game/moveGenerator');

/**
 * Tablero vacío auxiliar para tests personalizados.
 */
function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. Tablero inicial: Movimientos válidos y ausencia de capturas', () => {
  const board = createInitialBoard();

  assert.equal(hasAnyCapture(board, PLAYER_1), false, 'P1 no debe tener capturas al inicio');
  assert.equal(hasAnyCapture(board, PLAYER_2), false, 'P2 no debe tener capturas al inicio');

  const p1Moves = getValidMovesForPlayer(board, PLAYER_1);
  // En el tablero inicial 8x8, la fila 5 tiene 4 piezas, cada una puede mover a 1 o 2 casillas
  // Casillas fila 5: [5,0] (1 mov: [4,1]), [5,2] (2 movs: [4,1],[4,3]), [5,4] (2 movs), [5,6] (2 movs: [4,5],[4,7]) => 7 movimientos
  assert.equal(p1Moves.length, 7, 'P1 debe tener exactamente 7 movimientos posibles de apertura');
  assert.ok(p1Moves.every(m => !m.isCapture), 'Todos los movimientos iniciales deben ser simples');

  const p2Moves = getValidMovesForPlayer(board, PLAYER_2);
  assert.equal(p2Moves.length, 7, 'P2 debe tener exactamente 7 movimientos posibles de apertura');
  assert.ok(p2Moves.every(m => !m.isCapture), 'Todos los movimientos de P2 deben ser simples');
});

test('2. Movimientos simples de peón P1 y P2 con límites de tablero', () => {
  const board = createEmptyBoard();
  // P1 en el borde izquierdo [5, 0]
  board[5][0] = PIECES.P1_MAN;
  // P2 en el centro [3, 4]
  board[3][4] = PIECES.P2_MAN;

  const p1Moves = getSimpleMovesForPiece(board, 5, 0);
  assert.equal(p1Moves.length, 1, 'P1 en la columna 0 solo puede mover hacia la derecha [4, 1]');
  assert.deepEqual(p1Moves[0].to, { row: 4, col: 1 });

  const p2Moves = getSimpleMovesForPiece(board, 3, 4);
  assert.equal(p2Moves.length, 2, 'P2 en centro puede avanzar hacia [4, 3] y [4, 5]');
  assert.ok(p2Moves.some(m => m.to.row === 4 && m.to.col === 3));
  assert.ok(p2Moves.some(m => m.to.row === 4 && m.to.col === 5));
});

test('3. Movimientos simples de Dama / Rey en las 4 diagonales', () => {
  const board = createEmptyBoard();
  board[3][3] = PIECES.P1_KING;

  const kingMoves = getSimpleMovesForPiece(board, 3, 3);
  assert.equal(kingMoves.length, 4, 'Un rey libre en el centro debe tener 4 movimientos diagonales');

  const expectedDestinations = [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 }
  ];

  for (const dest of expectedDestinations) {
    assert.ok(
      kingMoves.some(m => m.to.row === dest.row && m.to.col === dest.col),
      `El rey debería poder moverse a (${dest.row}, ${dest.col})`
    );
  }
});

test('4. Captura simple obligatoria y descarte de movimientos simples', () => {
  const board = createEmptyBoard();
  // P1 en [5, 2]
  board[5][2] = PIECES.P1_MAN;
  // P2 en [4, 3] (pieza rival para comer)
  board[4][3] = PIECES.P2_MAN;
  // Otra pieza P1 en [5, 6] que solo tiene movimientos simples
  board[5][6] = PIECES.P1_MAN;

  assert.equal(hasAnyCapture(board, PLAYER_1), true, 'P1 tiene una captura obligatoria');

  const validMovesP1 = getValidMovesForPlayer(board, PLAYER_1);
  // Debe retornar SOLAMENTE la captura de la pieza [5, 2]
  assert.equal(validMovesP1.length, 1, 'Solo debe haber 1 movimiento legal debido a la captura obligatoria');
  const captureMove = validMovesP1[0];
  assert.equal(captureMove.isCapture, true);
  assert.deepEqual(captureMove.from, { row: 5, col: 2 });
  assert.deepEqual(captureMove.to, { row: 3, col: 4 });
  assert.deepEqual(captureMove.captures, [{ row: 4, col: 3 }]);

  // Validar getValidMovesForPiece para la pieza que NO puede capturar
  const blockedPieceMoves = getValidMovesForPiece(board, 5, 6);
  assert.equal(blockedPieceMoves.length, 0, 'La pieza en [5, 6] no puede moverse porque existe captura obligatoria');

  // Validar getValidMovesForPiece para la pieza que SÍ captura
  const capturingPieceMoves = getValidMovesForPiece(board, 5, 2);
  assert.equal(capturingPieceMoves.length, 1);
  assert.deepEqual(capturingPieceMoves[0].to, { row: 3, col: 4 });
});

test('5. No se puede capturar piezas aliadas ni saltar si la casilla de destino está ocupada', () => {
  const board = createEmptyBoard();
  board[5][2] = PIECES.P1_MAN;
  // Aliado en diagonal
  board[4][3] = PIECES.P1_MAN;
  // Enemigo en otra diagonal pero con destino ocupado
  board[4][1] = PIECES.P2_MAN;
  board[3][0] = PIECES.P2_MAN; // casilla de aterrizaje ocupada

  const jumps = getJumpsForPiece(board, 5, 2);
  assert.equal(jumps.length, 0, 'No debe haber saltos válidos');
});

test('6. Salto múltiple encadenado (Doble Salto en zigzag)', () => {
  const board = createEmptyBoard();
  // P1 en [5, 0]
  board[5][0] = PIECES.P1_MAN;
  // Enemigo 1 en [4, 1], aterriza en [3, 2]
  board[4][1] = PIECES.P2_MAN;
  // Enemigo 2 en [2, 3], aterriza en [1, 4]
  board[2][3] = PIECES.P2_MAN;

  const jumps = getJumpsForPiece(board, 5, 0);
  assert.equal(jumps.length, 1, 'Debe haber exactamente 1 salto doble encadenado');

  const move = jumps[0];
  assert.deepEqual(move.from, { row: 5, col: 0 });
  assert.deepEqual(move.to, { row: 1, col: 4 });
  assert.deepEqual(move.captures, [
    { row: 4, col: 1 },
    { row: 2, col: 3 }
  ]);
  assert.deepEqual(move.path, [
    { row: 5, col: 0 },
    { row: 3, col: 2 },
    { row: 1, col: 4 }
  ]);
});

test('7. Bifurcación en saltos múltiples (dos caminos de doble salto)', () => {
  const board = createEmptyBoard();
  // P1 en [5, 2] salta sobre [4, 3] aterrizando en [3, 4]
  board[5][2] = PIECES.P1_MAN;
  board[4][3] = PIECES.P2_MAN;

  // Desde [3, 4], puede saltar a la izquierda sobre [2, 3] a [1, 2]
  // O a la derecha sobre [2, 5] a [1, 6]
  board[2][3] = PIECES.P2_MAN;
  board[2][5] = PIECES.P2_MAN;

  const jumps = getJumpsForPiece(board, 5, 2);
  assert.equal(jumps.length, 2, 'Debe haber 2 variantes de salto doble disponibles');

  const dests = jumps.map(j => `${j.to.row},${j.to.col}`).sort();
  assert.deepEqual(dests, ['1,2', '1,6']);
  assert.ok(jumps.every(j => j.captures.length === 2));
});

test('8. Coronación en salto: Peón se corona al llegar a fila extrema y finaliza turno', () => {
  const board = createEmptyBoard();
  // P1 en [2, 1]
  board[2][1] = PIECES.P1_MAN;
  // Enemigo en [1, 2], aterriza en fila 0 (coronación)
  board[1][2] = PIECES.P2_MAN;

  // Si hubiera otro enemigo en [1, 4] que un rey recién coronado pudiera comer hacia atrás,
  // la regla oficial estipula que al coronarse el turno culmina inmediatamente
  board[1][4] = PIECES.P2_MAN;

  const jumps = getJumpsForPiece(board, 2, 1);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].to.row, CROWN_ROW_P1);
  assert.equal(jumps[0].to.col, 3);
  assert.equal(jumps[0].isKingPromotion, true, 'El peón debe ser promovido a Rey');
  assert.equal(jumps[0].captures.length, 1, 'No debe continuar capturando en el mismo turno tras coronarse');
});

test('9. Salto múltiple de un Rey en retroceso y avance', () => {
  const board = createEmptyBoard();
  // Rey P1 en [1, 2]
  board[1][2] = PIECES.P1_KING;
  // Enemigo en [2, 3] -> aterriza en [3, 4]
  board[2][3] = PIECES.P2_MAN;
  // Enemigo en [4, 3] -> aterriza en [5, 2] (hacia atrás/abajo)
  board[4][3] = PIECES.P2_MAN;
  // Enemigo en [4, 1] -> aterriza en [3, 0] (hacia adelante/arriba)
  board[4][1] = PIECES.P2_MAN;

  const jumps = getJumpsForPiece(board, 1, 2);
  assert.equal(jumps.length, 1, 'El rey debe poder realizar el triple salto');
  assert.equal(jumps[0].captures.length, 3, 'Debe haber capturado 3 piezas');
  assert.deepEqual(jumps[0].to, { row: 3, col: 0 });
});

test('10. Coronación en movimiento simple para P1 y P2', () => {
  const board = createEmptyBoard();
  board[1][2] = PIECES.P1_MAN;
  board[6][5] = PIECES.P2_MAN;

  const p1Moves = getSimpleMovesForPiece(board, 1, 2);
  const p1Promotions = p1Moves.filter(m => m.isKingPromotion);
  assert.ok(p1Promotions.length > 0, 'El avance a fila 0 debe marcar isKingPromotion: true para P1');
  assert.ok(p1Promotions.every(m => m.to.row === 0));

  const p2Moves = getSimpleMovesForPiece(board, 6, 5);
  const p2Promotions = p2Moves.filter(m => m.isKingPromotion);
  assert.ok(p2Promotions.length > 0, 'El avance a fila 7 debe marcar isKingPromotion: true para P2');
  assert.ok(p2Promotions.every(m => m.to.row === 7));
});
