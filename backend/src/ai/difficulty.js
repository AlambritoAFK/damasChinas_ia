/**
 * Módulo de calibración de dificultades para el Agente Inteligente (difficulty.js).
 * 
 * Configura y orquesta los niveles de dificultad del motor de juego:
 * - Fácil (Easy): Profundidad 2 con margen de error táctico (20% de probabilidad de jugada subóptima).
 * - Medio (Medium): Profundidad 4 con evaluación heurística multicriterio completa.
 * - Difícil (Hard): Profundidad 6 con búsqueda profunda y poda Alfa-Beta optimizada.
 */

const {
  PLAYER_2
} = require('../game/constants');

const {
  getValidMovesForPlayer
} = require('../game/moveGenerator');

const {
  findBestMove,
  orderMoves
} = require('./alphaBeta');

const {
  evaluateBoard
} = require('./heuristics');

const {
  applyMove
} = require('../game/rules');

/**
 * Identificadores estándar de dificultad.
 */
const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

/**
 * Configuraciones y parámetros de búsqueda por nivel de dificultad.
 */
const DIFFICULTY_CONFIGS = {
  [DIFFICULTY_LEVELS.EASY]: {
    key: DIFFICULTY_LEVELS.EASY,
    name: 'Fácil',
    depth: 2,
    randomness: 0.20, // 20% de probabilidad de elegir una jugada no óptima entre las opciones legales
    description: 'Profundidad 2 con margen de error táctico para principiantes'
  },
  [DIFFICULTY_LEVELS.MEDIUM]: {
    key: DIFFICULTY_LEVELS.MEDIUM,
    name: 'Medio',
    depth: 4,
    randomness: 0.0,
    description: 'Profundidad 4 con evaluación heurística multicriterio completa'
  },
  [DIFFICULTY_LEVELS.HARD]: {
    key: DIFFICULTY_LEVELS.HARD,
    name: 'Difícil',
    depth: 6,
    randomness: 0.0,
    description: 'Profundidad 6 con búsqueda profunda y poda Alfa-Beta maximizada'
  }
};

/**
 * Normaliza cualquier entrada de texto a un identificador de dificultad válido.
 * Admite español e inglés, tildes, números y mayúsculas.
 * 
 * @param {string|number} difficulty Entrada de dificultad proporcionada por el cliente.
 * @returns {string} Clave de dificultad normalizada ('easy', 'medium', 'hard').
 */
function normalizeDifficulty(difficulty) {
  if (!difficulty) {
    return DIFFICULTY_LEVELS.MEDIUM;
  }

  const str = String(difficulty).trim().toLowerCase();

  if (str === 'easy' || str === 'facil' || str === 'fácil' || str === '1') {
    return DIFFICULTY_LEVELS.EASY;
  }
  if (str === 'hard' || str === 'dificil' || str === 'difícil' || str === '3') {
    return DIFFICULTY_LEVELS.HARD;
  }
  if (str === 'medium' || str === 'medio' || str === 'normal' || str === '2') {
    return DIFFICULTY_LEVELS.MEDIUM;
  }

  return DIFFICULTY_LEVELS.MEDIUM;
}

/**
 * Obtiene el objeto de configuración correspondiente a una dificultad dada.
 * 
 * @param {string|number} difficulty Identificador de dificultad.
 * @returns {object} Configuración { key, name, depth, randomness, description }.
 */
function getDifficultyConfig(difficulty) {
  const key = normalizeDifficulty(difficulty);
  return DIFFICULTY_CONFIGS[key];
}

/**
 * Calcula el movimiento de la IA calibrado según el nivel de dificultad seleccionado.
 * 
 * En nivel Fácil, si existen múltiples jugadas legales y se activa el factor de aleatoriedad,
 * la IA puede seleccionar una alternativa válida secundaria para permitir errores humanos,
 * respetando SIEMPRE de forma inviolable la regla de captura obligatoria.
 * 
 * En niveles Medio y Difícil, ejecuta la búsqueda óptima pura con poda Alfa-Beta a profundidades
 * 4 y 6 respectivamente.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 actual.
 * @param {number} [player=PLAYER_2] Jugador para quien se calcula la jugada.
 * @param {string|number} [difficulty='medium'] Nivel de dificultad solicitado.
 * @param {object} [options={}] Opciones avanzadas (customWeights, depthOverride, forceSuboptimal).
 * @returns {{
 *   bestMove: object | null,
 *   score: number,
 *   difficulty: string,
 *   difficultyName: string,
 *   depth: number,
 *   nodesEvaluated: number,
 *   prunedBranches: number,
 *   timeMs: number
 * }}
 */
function computeAiMove(board, player = PLAYER_2, difficulty = DIFFICULTY_LEVELS.MEDIUM, options = {}) {
  const startTime = performance.now();
  const config = getDifficultyConfig(difficulty);
  const targetDepth = options.depthOverride || config.depth;

  const validMoves = getValidMovesForPlayer(board, player);

  // 1. Caso sin movimientos disponibles
  if (validMoves.length === 0) {
    return {
      bestMove: null,
      score: -100000,
      difficulty: config.key,
      difficultyName: config.name,
      depth: targetDepth,
      nodesEvaluated: 0,
      prunedBranches: 0,
      timeMs: 0
    };
  }

  // 2. Jugada única forzada: Respuesta instantánea en cualquier dificultad
  if (validMoves.length === 1) {
    const singleMove = validMoves[0];
    const resultingBoard = applyMove(board, singleMove);
    const score = evaluateBoard(resultingBoard, player, options.customWeights);
    const elapsed = Number((performance.now() - startTime).toFixed(2));

    return {
      bestMove: singleMove,
      score,
      difficulty: config.key,
      difficultyName: config.name,
      depth: targetDepth,
      nodesEvaluated: 1,
      prunedBranches: 0,
      timeMs: elapsed
    };
  }

  // 3. Comportamiento estocástico en nivel Fácil (margen de error táctico)
  const shouldMakeSuboptimalMove =
    config.randomness > 0 &&
    (options.forceSuboptimal === true || Math.random() < config.randomness);

  if (shouldMakeSuboptimalMove && validMoves.length > 1) {
    const orderedMoves = orderMoves(board, validMoves, player);
    // Seleccionar entre la 2da y 3ra mejor opción disponible
    const maxIndex = Math.min(2, orderedMoves.length - 1);
    const selectedIndex = options.forceSuboptimal ? 1 : Math.floor(1 + Math.random() * maxIndex);
    const subMove = orderedMoves[selectedIndex] || orderedMoves[0];

    const resultingBoard = applyMove(board, subMove);
    const score = evaluateBoard(resultingBoard, player, options.customWeights);
    const elapsed = Number((performance.now() - startTime).toFixed(2));

    return {
      bestMove: subMove,
      score,
      difficulty: config.key,
      difficultyName: config.name,
      depth: targetDepth,
      nodesEvaluated: validMoves.length,
      prunedBranches: 0,
      timeMs: elapsed
    };
  }

  // 4. Búsqueda Minimax Alfa-Beta estándar u óptima
  const result = findBestMove(board, player, targetDepth, options.customWeights);
  const elapsed = Number((performance.now() - startTime).toFixed(2));

  return {
    bestMove: result.bestMove,
    score: result.score,
    difficulty: config.key,
    difficultyName: config.name,
    depth: result.depth,
    nodesEvaluated: result.nodesEvaluated,
    prunedBranches: result.prunedBranches,
    timeMs: elapsed
  };
}

module.exports = {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIGS,
  normalizeDifficulty,
  getDifficultyConfig,
  computeAiMove
};
