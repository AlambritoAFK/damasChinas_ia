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
  getValidMovesForPlayer
} = require('../src/game/moveGenerator');

const {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIGS,
  normalizeDifficulty,
  getDifficultyConfig,
  computeAiMove
} = require('../src/ai/difficulty');

function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    b.push(new Array(BOARD_SIZE).fill(PIECES.EMPTY));
  }
  return b;
}

test('1. Normalización de dificultades: Manejo de sinónimos y mayúsculas', () => {
  assert.equal(normalizeDifficulty('easy'), DIFFICULTY_LEVELS.EASY);
  assert.equal(normalizeDifficulty('facil'), DIFFICULTY_LEVELS.EASY);
  assert.equal(normalizeDifficulty('FÁCIL'), DIFFICULTY_LEVELS.EASY);
  assert.equal(normalizeDifficulty('1'), DIFFICULTY_LEVELS.EASY);

  assert.equal(normalizeDifficulty('medium'), DIFFICULTY_LEVELS.MEDIUM);
  assert.equal(normalizeDifficulty('medio'), DIFFICULTY_LEVELS.MEDIUM);
  assert.equal(normalizeDifficulty('Normal'), DIFFICULTY_LEVELS.MEDIUM);
  assert.equal(normalizeDifficulty('2'), DIFFICULTY_LEVELS.MEDIUM);

  assert.equal(normalizeDifficulty('hard'), DIFFICULTY_LEVELS.HARD);
  assert.equal(normalizeDifficulty('dificil'), DIFFICULTY_LEVELS.HARD);
  assert.equal(normalizeDifficulty('DIFÍCIL'), DIFFICULTY_LEVELS.HARD);
  assert.equal(normalizeDifficulty('3'), DIFFICULTY_LEVELS.HARD);

  // Fallbacks ante entradas inválidas o nulas
  assert.equal(normalizeDifficulty(null), DIFFICULTY_LEVELS.MEDIUM);
  assert.equal(normalizeDifficulty('desconocido'), DIFFICULTY_LEVELS.MEDIUM);
});

test('2. Configuraciones de dificultad: Profundidades y nombres correctos', () => {
  const easyCfg = getDifficultyConfig('easy');
  assert.equal(easyCfg.depth, 2);
  assert.equal(easyCfg.name, 'Fácil');
  assert.equal(easyCfg.randomness, 0.20);

  const medCfg = getDifficultyConfig('medium');
  assert.equal(medCfg.depth, 4);
  assert.equal(medCfg.name, 'Medio');
  assert.equal(medCfg.randomness, 0);

  const hardCfg = getDifficultyConfig('hard');
  assert.equal(hardCfg.depth, 6);
  assert.equal(hardCfg.name, 'Difícil');
  assert.equal(hardCfg.randomness, 0);
});

test('3. Nivel Fácil: Ejecuta a profundidad 2 y retorna jugada legal', () => {
  const board = createInitialBoard();
  const res = computeAiMove(board, PLAYER_2, 'facil');

  assert.ok(res.bestMove !== null);
  assert.equal(res.difficulty, DIFFICULTY_LEVELS.EASY);
  assert.equal(res.difficultyName, 'Fácil');
  assert.equal(res.depth, 2);
  assert.ok(res.nodesEvaluated > 0);
  assert.ok(typeof res.timeMs === 'number');

  // Validar que la jugada pertenezca a los movimientos legales
  const validMoves = getValidMovesForPlayer(board, PLAYER_2);
  assert.ok(
    validMoves.some(
      m => m.from.row === res.bestMove.from.row &&
           m.from.col === res.bestMove.from.col &&
           m.to.row === res.bestMove.to.row &&
           m.to.col === res.bestMove.to.col
    ),
    'La jugada retornada en nivel fácil debe ser estrictamente legal'
  );
});

test('4. Nivel Medio: Ejecuta a profundidad 4 con heurística completa', () => {
  const board = createInitialBoard();
  const res = computeAiMove(board, PLAYER_2, 'medio');

  assert.ok(res.bestMove !== null);
  assert.equal(res.difficulty, DIFFICULTY_LEVELS.MEDIUM);
  assert.equal(res.difficultyName, 'Medio');
  assert.equal(res.depth, 4);
  assert.ok(res.nodesEvaluated > 10);
  assert.ok(res.prunedBranches > 0, 'Debe haber podas en profundidad 4');
  assert.ok(res.timeMs < 500, `Tiempo en medio (${res.timeMs}ms) debe ser menor a 500ms`);
});

test('5. Nivel Difícil: Búsqueda a profundidad 6 en tiempo óptimo (< 1s)', () => {
  const board = createInitialBoard();
  const res = computeAiMove(board, PLAYER_2, 'dificil');

  assert.ok(res.bestMove !== null);
  assert.equal(res.difficulty, DIFFICULTY_LEVELS.HARD);
  assert.equal(res.difficultyName, 'Difícil');
  assert.equal(res.depth, 6);
  assert.ok(res.nodesEvaluated > 50);
  assert.ok(res.prunedBranches > 0);
  assert.ok(res.timeMs < 1000, `El cálculo en difícil (${res.timeMs}ms) debe responder en menos de 1 segundo`);
});

test('6. Captura obligatoria inviolable en todas las dificultades', () => {
  const board = createEmptyBoard();
  // P2 en [3, 2] con captura sobre [4, 3] a [5, 4]
  board[3][2] = PIECES.P2_MAN;
  board[4][3] = PIECES.P1_MAN;
  // Pieza de P2 con movimiento simple
  board[0][1] = PIECES.P2_MAN;
  // Pieza lejana de P1
  board[7][6] = PIECES.P1_MAN;

  // Probar en los 3 niveles de dificultad
  for (const diff of ['facil', 'medio', 'dificil']) {
    const res = computeAiMove(board, PLAYER_2, diff);
    assert.ok(res.bestMove !== null);
    assert.equal(res.bestMove.isCapture, true, `En dificultad ${diff} debe ejecutar la captura obligatoria`);
    assert.deepEqual(res.bestMove.from, { row: 3, col: 2 });
    assert.deepEqual(res.bestMove.to, { row: 5, col: 4 });
  }
});

test('7. Margen de error en nivel Fácil (forceSuboptimal)', () => {
  const board = createInitialBoard();
  // Forzar jugada subóptima para validar rama estocástica de error táctico
  const resSub = computeAiMove(board, PLAYER_2, 'facil', { forceSuboptimal: true });

  assert.ok(resSub.bestMove !== null);
  assert.equal(resSub.difficulty, DIFFICULTY_LEVELS.EASY);

  // Asegurar que aun siendo subóptima es 100% legal
  const validMoves = getValidMovesForPlayer(board, PLAYER_2);
  assert.ok(
    validMoves.some(
      m => m.from.row === resSub.bestMove.from.row &&
           m.from.col === resSub.bestMove.from.col &&
           m.to.row === resSub.bestMove.to.row &&
           m.to.col === resSub.bestMove.to.col
    )
  );
});

test('8. Posición terminal sin jugadas: Retorno seguro en cualquier dificultad', () => {
  const board = createEmptyBoard();
  board[5][2] = PIECES.P1_MAN; // P2 no tiene piezas

  const res = computeAiMove(board, PLAYER_2, 'medio');
  assert.equal(res.bestMove, null);
  assert.equal(res.score, -100000);
  assert.equal(res.nodesEvaluated, 0);
});
