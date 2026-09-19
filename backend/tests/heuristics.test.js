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
  DEFAULT_WEIGHTS,
  WIN_SCORE,
  CENTER_SQUARES,
  EXTENDED_CENTER_SQUARES,
  getMaterialScore,
  getCenterScore,
  getAdvancementScore,
  getBackRowScore,
  getMobilityScore,
  getVulnerabilityScore,
  evaluateBoard,
  evaluateBoardDetailed
} = require('../src/ai/heuristics');

/**
 * Genera un tablero 8x8 vacío para pruebas controladas.
 */
function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. Tablero inicial: Simetría perfecta y balance de puntuación', () => {
  const board = createInitialBoard();

  // Desde la perspectiva de la IA (PLAYER_2)
  const scoreAI = evaluateBoard(board, PLAYER_2);
  // Desde la perspectiva del humano (PLAYER_1)
  const scoreHuman = evaluateBoard(board, PLAYER_1);

  assert.equal(scoreAI, 0, 'La posición inicial debe ser perfectamente neutra (0) para la IA');
  assert.equal(scoreHuman, 0, 'La posición inicial debe ser neutra (0) para el humano');
  assert.equal(scoreAI, -scoreHuman === 0 ? 0 : -scoreHuman, 'La evaluación debe ser simétrica entre ambos jugadores');
  assert.equal(scoreAI + scoreHuman, 0, 'La suma de evaluaciones simétricas debe ser cero');

  const detailed = evaluateBoardDetailed(board, PLAYER_2);
  assert.equal(detailed.total, 0);
  assert.equal(detailed.isTerminal, false);
  assert.equal(detailed.breakdown.material, 0);
  assert.equal(detailed.breakdown.center, 0);
  assert.equal(detailed.breakdown.advancement, 0);
  assert.equal(detailed.breakdown.backRow, 0);
  assert.equal(detailed.breakdown.mobility, 0);
  assert.equal(detailed.breakdown.vulnerability, 0);
});

test('2. Criterio de Material: Peones y Reyes', () => {
  const board = createEmptyBoard();
  // IA (P2) con 2 peones y 1 rey
  board[2][1] = PIECES.P2_MAN;
  board[2][3] = PIECES.P2_MAN;
  board[1][4] = PIECES.P2_KING;

  // Humano (P1) con 1 peón
  board[6][1] = PIECES.P1_MAN;

  // Material IA = 2*100 + 1*280 = 480
  // Material P1 = 1*100 = 100
  // Ventaja neta IA = 380
  const matScoreAI = getMaterialScore(board, PLAYER_2);
  assert.equal(matScoreAI, 380, 'La ventaja de material para la IA debe ser 380');

  const matScoreP1 = getMaterialScore(board, PLAYER_1);
  assert.equal(matScoreP1, -380, 'La ventaja de material para P1 debe ser -380');
});

test('3. Control Posicional y Central: Centro primario y extendido', () => {
  const board = createEmptyBoard();
  // P2 en casilla central [3, 2]
  board[3][2] = PIECES.P2_MAN;
  // P1 en casilla del borde [5, 0] (no central)
  board[5][0] = PIECES.P1_MAN;

  const centerScore = getCenterScore(board, PLAYER_2);
  assert.equal(centerScore, DEFAULT_WEIGHTS.CENTER, `Ocupar el centro primario debe otorgar +${DEFAULT_WEIGHTS.CENTER}`);

  // Agregar P1 en centro extendido [5, 2]
  board[5][2] = PIECES.P1_MAN;
  const centerScore2 = getCenterScore(board, PLAYER_2);
  assert.equal(centerScore2, DEFAULT_WEIGHTS.CENTER - DEFAULT_WEIGHTS.EXTENDED_CENTER);
});

test('4. Avance hacia Coronación: Progresión de peones simples', () => {
  const board = createEmptyBoard();
  // P2 avanza hacia fila 7. En fila 6 está a 1 casilla de coronar (avance = 6)
  board[6][1] = PIECES.P2_MAN;
  // P1 avanza hacia fila 0. En fila 5 ha avanzado 2 filas (7 - 5 = 2)
  board[5][4] = PIECES.P1_MAN;

  // P2 avance = 6 * 5 = 30
  // P1 avance = 2 * 5 = 10
  // Ventaja neta P2 = 20
  const advScore = getAdvancementScore(board, PLAYER_2);
  assert.equal(advScore, (6 - 2) * DEFAULT_WEIGHTS.ADVANCEMENT);

  // Reyes ya coronados no deben acumular bonificación de avance
  board[6][3] = PIECES.P2_KING;
  const advScoreWithKing = getAdvancementScore(board, PLAYER_2);
  assert.equal(advScoreWithKing, advScore, 'Un rey no debe sumar bonificación de avance de peón');
});

test('5. Seguridad de Fila de Retaguardia: Defensa base intacta', () => {
  const board = createEmptyBoard();
  // P2 mantiene 2 piezas en fila 0
  board[0][1] = PIECES.P2_MAN;
  board[0][3] = PIECES.P2_MAN;
  // P1 no tiene piezas en fila 7, solo en fila 6
  board[6][1] = PIECES.P1_MAN;

  const backRowScore = getBackRowScore(board, PLAYER_2);
  assert.equal(backRowScore, 2 * DEFAULT_WEIGHTS.BACK_ROW, '2 piezas en fila base deben dar 2 * BACK_ROW');

  // Si P1 tiene 1 en fila 7
  board[7][2] = PIECES.P1_MAN;
  const backRowScore2 = getBackRowScore(board, PLAYER_2);
  assert.equal(backRowScore2, (2 - 1) * DEFAULT_WEIGHTS.BACK_ROW);
});

test('6. Movilidad Relativa: Mayor número de opciones legales', () => {
  const board = createEmptyBoard();
  // P2 rey en el centro con 4 movimientos disponibles
  board[3][4] = PIECES.P2_KING;
  // P1 peón en la esquina [7, 0] bloqueado por borde o con solo 1 movimiento
  board[7][0] = PIECES.P1_MAN;

  const mobScore = getMobilityScore(board, PLAYER_2);
  assert.ok(mobScore > 0, 'La IA debe recibir bonificación positiva por mayor movilidad');
});

test('7. Vulnerabilidad Táctica: Detección y penalización de pieza expuesta', () => {
  const board = createEmptyBoard();
  // P1 en [5, 2]
  board[5][2] = PIECES.P1_MAN;
  // P2 en [4, 3] (expuesto a captura por P1 saltando a [3, 4])
  board[4][3] = PIECES.P2_MAN;
  // Pieza que bloquea el aterrizaje del contra-salto de P2 hacia [6, 1]
  board[6][1] = PIECES.P1_MAN;
  // Piezas auxiliares para evitar estado terminal
  board[7][6] = PIECES.P1_MAN;
  board[0][1] = PIECES.P2_MAN;

  // P1 tiene captura sobre [4, 3] (pieza de P2)
  // Por lo tanto, desde la perspectiva de P2, tiene 1 pieza vulnerable
  const vulnScoreP2 = getVulnerabilityScore(board, PLAYER_2);
  assert.equal(vulnScoreP2, -DEFAULT_WEIGHTS.VULNERABILITY, 'P2 debe tener una penalización por su pieza expuesta');

  // Desde la perspectiva de P1, amenaza 1 pieza enemiga
  const vulnScoreP1 = getVulnerabilityScore(board, PLAYER_1);
  assert.equal(vulnScoreP1, DEFAULT_WEIGHTS.VULNERABILITY, 'P1 debe tener una bonificación por amenazar pieza enemiga');
});

test('8. Estados Terminales: Victoria y derrota por eliminación o bloqueo', () => {
  // Eliminación de P1 (gana P2)
  const boardWinP2 = createEmptyBoard();
  boardWinP2[2][1] = PIECES.P2_MAN;
  assert.equal(evaluateBoard(boardWinP2, PLAYER_2), WIN_SCORE, 'Victoria de P2 debe retornar WIN_SCORE');
  assert.equal(evaluateBoard(boardWinP2, PLAYER_1), -WIN_SCORE, 'Derrota de P1 debe retornar -WIN_SCORE');

  // Bloqueo total de P1 (P1 no tiene movimientos legales)
  const boardBlockedP1 = createEmptyBoard();
  boardBlockedP1[7][0] = PIECES.P1_MAN;
  boardBlockedP1[6][1] = PIECES.P2_MAN;
  boardBlockedP1[5][2] = PIECES.P2_MAN; // Bloquea salto

  assert.equal(evaluateBoard(boardBlockedP1, PLAYER_1), -WIN_SCORE, 'Jugador bloqueado debe recibir -WIN_SCORE');
  assert.equal(evaluateBoard(boardBlockedP1, PLAYER_2), WIN_SCORE, 'Jugador que bloqueó debe recibir WIN_SCORE');
});

test('9. Inversión consistente de signo según perspectiva', () => {
  const board = createEmptyBoard();
  board[3][2] = PIECES.P2_MAN;
  board[2][1] = PIECES.P2_MAN;
  board[6][5] = PIECES.P1_MAN;
  board[7][4] = PIECES.P1_MAN;

  const scoreP2 = evaluateBoard(board, PLAYER_2);
  const scoreP1 = evaluateBoard(board, PLAYER_1);

  assert.equal(scoreP2, -scoreP1, 'La evaluación debe ser estrictamente de suma cero entre P1 y P2');
});

test('10. evaluateBoardDetailed: Desglose completo de métricas', () => {
  const board = createInitialBoard();
  const detailed = evaluateBoardDetailed(board, PLAYER_2);

  assert.equal(typeof detailed.total, 'number');
  assert.equal(detailed.isTerminal, false);
  assert.equal(detailed.terminalReason, null);

  const { material, center, advancement, backRow, mobility, vulnerability } = detailed.breakdown;
  assert.equal(detailed.total, material + center + advancement + backRow + mobility + vulnerability);
});
