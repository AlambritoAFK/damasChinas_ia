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
  applyMove,
  checkGameOver,
  isValidMove,
  GAME_OVER_REASONS
} = require('../src/game/rules');

function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. applyMove: Movimiento simple e inmutabilidad del tablero original', () => {
  const board = createEmptyBoard();
  board[5][2] = PIECES.P1_MAN;

  const move = {
    from: { row: 5, col: 2 },
    to: { row: 4, col: 1 },
    captures: []
  };

  const newBoard = applyMove(board, move);

  // Tablero original no debe haber cambiado (inmutabilidad)
  assert.equal(board[5][2], PIECES.P1_MAN, 'El tablero original debe mantenerse inmutable');
  assert.equal(board[4][1], PIECES.EMPTY, 'La casilla destino original debe seguir vacía');

  // Nuevo tablero debe reflejar el traslado
  assert.equal(newBoard[5][2], PIECES.EMPTY, 'La casilla origen en el nuevo tablero debe quedar vacía');
  assert.equal(newBoard[4][1], PIECES.P1_MAN, 'La pieza debe estar en la casilla destino');
});

test('2. applyMove: Salto con captura y eliminación de ficha enemiga', () => {
  const board = createEmptyBoard();
  board[5][2] = PIECES.P1_MAN;
  board[4][3] = PIECES.P2_MAN;

  const move = {
    from: { row: 5, col: 2 },
    to: { row: 3, col: 4 },
    captures: [{ row: 4, col: 3 }]
  };

  const newBoard = applyMove(board, move);

  assert.equal(newBoard[5][2], PIECES.EMPTY);
  assert.equal(newBoard[4][3], PIECES.EMPTY, 'La ficha enemiga capturada debe desaparecer del tablero');
  assert.equal(newBoard[3][4], PIECES.P1_MAN, 'La ficha atacante debe encontrarse en la casilla destino');
});

test('3. applyMove: Salto múltiple y eliminación de varias fichas', () => {
  const board = createEmptyBoard();
  board[5][0] = PIECES.P1_MAN;
  board[4][1] = PIECES.P2_MAN;
  board[2][3] = PIECES.P2_MAN;

  const move = {
    from: { row: 5, col: 0 },
    to: { row: 1, col: 4 },
    captures: [
      { row: 4, col: 1 },
      { row: 2, col: 3 }
    ]
  };

  const newBoard = applyMove(board, move);

  assert.equal(newBoard[5][0], PIECES.EMPTY);
  assert.equal(newBoard[4][1], PIECES.EMPTY, 'Primera ficha comida eliminada');
  assert.equal(newBoard[2][3], PIECES.EMPTY, 'Segunda ficha comida eliminada');
  assert.equal(newBoard[1][4], PIECES.P1_MAN);
});

test('4. applyMove: Coronación a Rey al alcanzar la fila extrema', () => {
  const board = createEmptyBoard();
  board[1][2] = PIECES.P1_MAN;

  const move = {
    from: { row: 1, col: 2 },
    to: { row: 0, col: 3 },
    captures: []
  };

  const newBoard = applyMove(board, move);
  assert.equal(newBoard[0][3], PIECES.P1_KING, 'El peón debe coronarse a Rey (valor 2) al llegar a fila 0');

  // Coronación para P2
  const boardP2 = createEmptyBoard();
  boardP2[6][3] = PIECES.P2_MAN;
  const moveP2 = {
    from: { row: 6, col: 3 },
    to: { row: 7, col: 4 },
    captures: []
  };
  const newBoardP2 = applyMove(boardP2, moveP2);
  assert.equal(newBoardP2[7][4], PIECES.P2_KING, 'El peón de P2 debe coronarse a Rey (valor -2) al llegar a fila 7');
});

test('5. checkGameOver: Partida inicial en curso', () => {
  const board = createInitialBoard();
  const statusP1 = checkGameOver(board, PLAYER_1);
  assert.equal(statusP1.isGameOver, false);
  assert.equal(statusP1.winner, null);

  const statusP2 = checkGameOver(board, PLAYER_2);
  assert.equal(statusP2.isGameOver, false);
});

test('6. checkGameOver: Victoria por eliminación de piezas', () => {
  const board = createEmptyBoard();
  // Solo queda 1 pieza de P1
  board[4][3] = PIECES.P1_MAN;

  const status = checkGameOver(board, PLAYER_2);
  assert.equal(status.isGameOver, true);
  assert.equal(status.winner, PLAYER_1, 'P1 gana porque P2 no tiene piezas');
  assert.equal(status.reason, GAME_OVER_REASONS.ELIMINATION);

  // Caso opuesto: P2 tiene piezas y P1 no
  const board2 = createEmptyBoard();
  board2[2][1] = PIECES.P2_MAN;
  const status2 = checkGameOver(board2, PLAYER_1);
  assert.equal(status2.isGameOver, true);
  assert.equal(status2.winner, PLAYER_2, 'P2 gana porque P1 no tiene piezas');
  assert.equal(status2.reason, GAME_OVER_REASONS.ELIMINATION);
});

test('7. checkGameOver: Victoria por bloqueo de movimientos', () => {
  const board = createEmptyBoard();
  // P1 en esquina [7, 0], bloqueado por pieza de P2 en [6, 1] y sin casilla vacía detrás
  board[7][0] = PIECES.P1_MAN;
  board[6][1] = PIECES.P2_MAN;
  board[5][2] = PIECES.P2_MAN; // bloquea el salto

  const status = checkGameOver(board, PLAYER_1);
  assert.equal(status.isGameOver, true, 'Debe terminar el juego porque P1 no tiene jugadas');
  assert.equal(status.winner, PLAYER_2, 'P2 gana por bloqueo');
  assert.equal(status.reason, GAME_OVER_REASONS.BLOCKED);
});

test('8. isValidMove: Detección de jugada legal vs ilegal', () => {
  const board = createInitialBoard();

  // Jugada legal de apertura para P1: [5, 2] -> [4, 1]
  const valid = isValidMove(board, PLAYER_1, {
    from: { row: 5, col: 2 },
    to: { row: 4, col: 1 }
  });
  assert.ok(valid !== null, 'Debe reconocer como válida la jugada legal');
  assert.deepEqual(valid.from, { row: 5, col: 2 });
  assert.deepEqual(valid.to, { row: 4, col: 1 });

  // Jugada ilegal: intentar mover pieza hacia atrás siendo peón
  const invalid = isValidMove(board, PLAYER_1, {
    from: { row: 5, col: 2 },
    to: { row: 6, col: 1 }
  });
  assert.equal(invalid, null, 'No debe permitir jugadas ilegales');

  // Jugada ilegal: intentar mover casilla vacía
  const invalidEmpty = isValidMove(board, PLAYER_1, {
    from: { row: 4, col: 3 },
    to: { row: 3, col: 4 }
  });
  assert.equal(invalidEmpty, null, 'No debe permitir mover casillas vacías');
});
