/**
 * Módulo de evaluación heurística multicriterio para Damas 8x8.
 * 
 * Asigna una puntuación numérica estática f(s) a cualquier estado del tablero
 * desde la perspectiva del jugador evaluado (por defecto PLAYER_2 / IA).
 * Valores positivos favorecen a dicho jugador; valores negativos favorecen al oponente.
 * 
 * Criterios ponderados:
 * 1. Diferencia de Material (Peones simples vs Reyes/Damas)
 * 2. Control Posicional y Central (Casillas del centro primario y extendido)
 * 3. Avance hacia Coronación (Progresión de peones hacia la fila enemiga)
 * 4. Seguridad de Fila de Retaguardia (Defensa de la fila base propia)
 * 5. Movilidad Relativa (Cantidad de jugadas legales disponibles)
 * 6. Vulnerabilidad Táctica (Penalización por piezas expuestas a captura inmediata)
 */

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  getPlayer,
  getOpponent,
  isKing,
  isMan
} = require('../game/constants');

const {
  countPieces,
  isInsideBoard
} = require('../game/board');

const {
  getValidMovesForPlayer
} = require('../game/moveGenerator');

const {
  checkGameOver
} = require('../game/rules');

/**
 * Ponderaciones por defecto para los criterios heurísticos.
 */
const DEFAULT_WEIGHTS = {
  MAN: 100,              // Valor base de un peón simple
  KING: 280,             // Valor de una dama/rey (mayor movilidad y bidireccionalidad)
  CENTER: 20,            // Bonificación por ocupar casillas centrales primarias
  EXTENDED_CENTER: 10,   // Bonificación por ocupar casillas centrales extendidas
  ADVANCEMENT: 5,        // Bonificación por fila avanzada hacia la coronación
  BACK_ROW: 20,          // Bonificación por mantener peón en fila base de defensa
  MOBILITY: 4,           // Bonificación por cada movimiento legal adicional
  VULNERABILITY: 30      // Penalización por pieza expuesta a captura inmediata
};

/**
 * Puntuación absoluta para estados terminales (victoria / derrota).
 */
const WIN_SCORE = 100000;

/**
 * Casillas centrales primarias jugables (oscuras) en tablero 8x8.
 * (row + col) % 2 === 1
 */
const CENTER_SQUARES = [
  { row: 3, col: 2 },
  { row: 3, col: 4 },
  { row: 4, col: 3 },
  { row: 4, col: 5 }
];

/**
 * Casillas del centro extendido (anillo adyacente al centro primario).
 */
const EXTENDED_CENTER_SQUARES = [
  { row: 2, col: 3 },
  { row: 2, col: 5 },
  { row: 5, col: 2 },
  { row: 5, col: 4 }
];

/**
 * Normaliza valores numéricos para evitar que -0 genere inconsistencias de igualdad estricta.
 * @param {number} val 
 * @returns {number}
 */
function normalizeZero(val) {
  return val === 0 ? 0 : val;
}

/**
 * Calcula la puntuación del balance de material entre ambos jugadores.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @returns {number}
 */
function getMaterialScore(board, player, weights = DEFAULT_WEIGHTS) {
  const counts = countPieces(board);
  const p1Material = counts.player1.men * weights.MAN + counts.player1.kings * weights.KING;
  const p2Material = counts.player2.men * weights.MAN + counts.player2.kings * weights.KING;

  const score = player === PLAYER_1 ? (p1Material - p2Material) : (p2Material - p1Material);
  return normalizeZero(score);
}

/**
 * Calcula la bonificación por control de casillas centrales y centro extendido.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @returns {number}
 */
function getCenterScore(board, player, weights = DEFAULT_WEIGHTS) {
  let p1Center = 0;
  let p2Center = 0;

  // Centro primario
  for (const pos of CENTER_SQUARES) {
    const piece = board[pos.row][pos.col];
    const pieceOwner = getPlayer(piece);
    if (pieceOwner === PLAYER_1) {
      p1Center += weights.CENTER;
    } else if (pieceOwner === PLAYER_2) {
      p2Center += weights.CENTER;
    }
  }

  // Centro extendido
  for (const pos of EXTENDED_CENTER_SQUARES) {
    const piece = board[pos.row][pos.col];
    const pieceOwner = getPlayer(piece);
    if (pieceOwner === PLAYER_1) {
      p1Center += weights.EXTENDED_CENTER;
    } else if (pieceOwner === PLAYER_2) {
      p2Center += weights.EXTENDED_CENTER;
    }
  }

  const score = player === PLAYER_1 ? (p1Center - p2Center) : (p2Center - p1Center);
  return normalizeZero(score);
}

/**
 * Calcula la bonificación acumulativa por el avance de peones simples hacia la coronación.
 * - PLAYER_1 avanza de fila 7 a 0 (avance = 7 - row).
 * - PLAYER_2 avanza de fila 0 a 7 (avance = row).
 * - Reyes ya coronados no reciben bonificación de avance.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @returns {number}
 */
function getAdvancementScore(board, player, weights = DEFAULT_WEIGHTS) {
  let p1Advancement = 0;
  let p2Advancement = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece === PIECES.P1_MAN) {
        p1Advancement += (7 - r) * weights.ADVANCEMENT;
      } else if (piece === PIECES.P2_MAN) {
        p2Advancement += r * weights.ADVANCEMENT;
      }
    }
  }

  const score = player === PLAYER_1 ? (p1Advancement - p2Advancement) : (p2Advancement - p1Advancement);
  return normalizeZero(score);
}

/**
 * Calcula la bonificación por mantener peones en la fila base de retaguardia.
 * - PLAYER_1 defiende en fila 7.
 * - PLAYER_2 defiende en fila 0.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @returns {number}
 */
function getBackRowScore(board, player, weights = DEFAULT_WEIGHTS) {
  let p1BackRow = 0;
  let p2BackRow = 0;

  for (let c = 0; c < BOARD_SIZE; c++) {
    // Fila 7 para Jugador 1
    if (board[7][c] === PIECES.P1_MAN) {
      p1BackRow += weights.BACK_ROW;
    }
    // Fila 0 para Jugador 2
    if (board[0][c] === PIECES.P2_MAN) {
      p2BackRow += weights.BACK_ROW;
    }
  }

  const score = player === PLAYER_1 ? (p1BackRow - p2BackRow) : (p2BackRow - p1BackRow);
  return normalizeZero(score);
}

/**
 * Calcula la bonificación por movilidad relativa (número de movimientos legales disponibles).
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @param {Array<object>} [playerMoves] Opcional, movimientos de player ya calculados.
 * @param {Array<object>} [opponentMoves] Opcional, movimientos de opponent ya calculados.
 * @returns {number}
 */
function getMobilityScore(board, player, weights = DEFAULT_WEIGHTS, playerMoves = null, opponentMoves = null) {
  const opponent = getOpponent(player);
  const pMovesCount = playerMoves ? playerMoves.length : getValidMovesForPlayer(board, player).length;
  const oMovesCount = opponentMoves ? opponentMoves.length : getValidMovesForPlayer(board, opponent).length;

  const score = (pMovesCount - oMovesCount) * weights.MOBILITY;
  return normalizeZero(score);
}

/**
 * Evalúa las piezas expuestas a captura inmediata en el siguiente turno.
 * Penaliza las piezas propias vulnerables y bonifica las piezas enemigas expuestas.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} player Jugador evaluado.
 * @param {object} weights Ponderaciones de evaluación.
 * @param {Array<object>} [playerMoves] Opcional, movimientos de player ya calculados.
 * @param {Array<object>} [opponentMoves] Opcional, movimientos de opponent ya calculados.
 * @returns {number}
 */
function getVulnerabilityScore(board, player, weights = DEFAULT_WEIGHTS, playerMoves = null, opponentMoves = null) {
  const opponent = getOpponent(player);

  const pMoves = playerMoves || getValidMovesForPlayer(board, player);
  const oMoves = opponentMoves || getValidMovesForPlayer(board, opponent);

  // Piezas de 'player' que 'opponent' puede capturar inmediatamente
  const vulnerablePlayerPieces = new Set();
  if (oMoves.length > 0 && oMoves[0].isCapture) {
    for (const move of oMoves) {
      for (const cap of move.captures) {
        vulnerablePlayerPieces.add(`${cap.row},${cap.col}`);
      }
    }
  }

  // Piezas de 'opponent' que 'player' puede capturar inmediatamente
  const vulnerableOpponentPieces = new Set();
  if (pMoves.length > 0 && pMoves[0].isCapture) {
    for (const move of pMoves) {
      for (const cap of move.captures) {
        vulnerableOpponentPieces.add(`${cap.row},${cap.col}`);
      }
    }
  }

  // Más piezas enemigas amenazadas = positivo; más piezas propias expuestas = negativo
  const netAdvantage = vulnerableOpponentPieces.size - vulnerablePlayerPieces.size;
  const score = netAdvantage * weights.VULNERABILITY;
  return normalizeZero(score);
}

/**
 * Función principal de evaluación heurística f(s).
 * 
 * Asigna una puntuación al estado del tablero desde la perspectiva de `player`.
 * Por defecto `player = PLAYER_2` (IA), donde valores positivos favorecen a la IA
 * y valores negativos favorecen al jugador humano.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} [player=PLAYER_2] Jugador desde cuya perspectiva se evalúa.
 * @param {object} [customWeights={}] Ajuste opcional de ponderaciones.
 * @returns {number} Puntuación estática del tablero.
 */
function evaluateBoard(board, player = PLAYER_2, customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  const opponent = getOpponent(player);

  // 1. Verificación de estados terminales por eliminación de fichas
  const counts = countPieces(board);
  const playerTotal = player === PLAYER_1 ? counts.player1.total : counts.player2.total;
  const opponentTotal = player === PLAYER_1 ? counts.player2.total : counts.player1.total;

  if (playerTotal === 0) return -WIN_SCORE;
  if (opponentTotal === 0) return WIN_SCORE;

  // 2. Obtener movimientos legales de ambos jugadores para movilidad y vulnerabilidad
  const playerMoves = getValidMovesForPlayer(board, player);
  const opponentMoves = getValidMovesForPlayer(board, opponent);

  // 3. Verificación de bloqueo terminal
  if (playerMoves.length === 0) return -WIN_SCORE;
  if (opponentMoves.length === 0) return WIN_SCORE;

  // 4. Suma ponderada de componentes heurísticos
  const material = getMaterialScore(board, player, weights);
  const center = getCenterScore(board, player, weights);
  const advancement = getAdvancementScore(board, player, weights);
  const backRow = getBackRowScore(board, player, weights);
  const mobility = getMobilityScore(board, player, weights, playerMoves, opponentMoves);
  const vulnerability = getVulnerabilityScore(board, player, weights, playerMoves, opponentMoves);

  const rawTotal = material + center + advancement + backRow + mobility + vulnerability;
  return rawTotal === 0 ? 0 : rawTotal;
}

/**
 * Genera un reporte detallado con el desglose numérico de cada criterio heurístico.
 * Esencial para métricas, depuración del árbol de búsqueda y la sustentación oral.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8.
 * @param {number} [player=PLAYER_2] Jugador evaluado.
 * @param {object} [customWeights={}] Ponderaciones personalizadas.
 * @returns {object} Desglose completo de puntuaciones.
 */
function evaluateBoardDetailed(board, player = PLAYER_2, customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  const opponent = getOpponent(player);

  const counts = countPieces(board);
  const playerTotal = player === PLAYER_1 ? counts.player1.total : counts.player2.total;
  const opponentTotal = player === PLAYER_1 ? counts.player2.total : counts.player1.total;

  if (playerTotal === 0) {
    return {
      total: -WIN_SCORE,
      isTerminal: true,
      terminalReason: 'PLAYER_ELIMINATED',
      breakdown: { material: -WIN_SCORE, center: 0, advancement: 0, backRow: 0, mobility: 0, vulnerability: 0 }
    };
  }

  if (opponentTotal === 0) {
    return {
      total: WIN_SCORE,
      isTerminal: true,
      terminalReason: 'OPPONENT_ELIMINATED',
      breakdown: { material: WIN_SCORE, center: 0, advancement: 0, backRow: 0, mobility: 0, vulnerability: 0 }
    };
  }

  const playerMoves = getValidMovesForPlayer(board, player);
  const opponentMoves = getValidMovesForPlayer(board, opponent);

  if (playerMoves.length === 0) {
    return {
      total: -WIN_SCORE,
      isTerminal: true,
      terminalReason: 'PLAYER_BLOCKED',
      breakdown: { material: 0, center: 0, advancement: 0, backRow: 0, mobility: -WIN_SCORE, vulnerability: 0 }
    };
  }

  if (opponentMoves.length === 0) {
    return {
      total: WIN_SCORE,
      isTerminal: true,
      terminalReason: 'OPPONENT_BLOCKED',
      breakdown: { material: 0, center: 0, advancement: 0, backRow: 0, mobility: WIN_SCORE, vulnerability: 0 }
    };
  }

  const material = getMaterialScore(board, player, weights);
  const center = getCenterScore(board, player, weights);
  const advancement = getAdvancementScore(board, player, weights);
  const backRow = getBackRowScore(board, player, weights);
  const mobility = getMobilityScore(board, player, weights, playerMoves, opponentMoves);
  const vulnerability = getVulnerabilityScore(board, player, weights, playerMoves, opponentMoves);

  const total = normalizeZero(material + center + advancement + backRow + mobility + vulnerability);

  return {
    total,
    isTerminal: false,
    terminalReason: null,
    breakdown: {
      material,
      center,
      advancement,
      backRow,
      mobility,
      vulnerability
    }
  };
}

module.exports = {
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
};
