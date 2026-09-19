/**
 * Módulo del motor de búsqueda Minimax con Poda Alfa-Beta (alphaBeta.js).
 * 
 * Implementa la exploración adversarial en árboles de juego guiada por la
 * función heurística multicriterio f(s), con optimizaciones de ordenamiento
 * de jugadas (Move Ordering) para maximizar la poda O(b^(d/2)), respuesta
 * inmediata para jugadas únicas forzadas y retorno de métricas de rendimiento.
 */

const {
  PLAYER_1,
  PLAYER_2,
  PIECES,
  getPlayer,
  getOpponent,
  isKing
} = require('../game/constants');

const {
  getValidMovesForPlayer
} = require('../game/moveGenerator');

const {
  applyMove,
  checkGameOver
} = require('../game/rules');

const {
  evaluateBoard,
  WIN_SCORE,
  DEFAULT_WEIGHTS
} = require('./heuristics');

/**
 * Ordena las jugadas legales candidatas para maximizar las podas Alfa-Beta.
 * Principio: Evaluar primero las jugadas más destructivas y decisivas:
 * 1. Capturas múltiples encadenadas (mayor número de piezas comidas).
 * 2. Capturas simples.
 * 3. Movimientos con coronación inmediata a Rey.
 * 4. Avances hacia la fila de coronación enemiga.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 actual.
 * @param {Array<object>} moves Lista de movimientos válidos.
 * @param {number} player Jugador que realiza el movimiento.
 * @returns {Array<object>} Lista ordenada de movimientos.
 */
function orderMoves(board, moves, player) {
  if (moves.length <= 1) return moves;

  return moves.slice().sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Prioridad 1: Capturas y número de piezas capturadas
    if (a.isCapture) {
      scoreA += 1000 + (a.captures ? a.captures.length * 300 : 0);
    }
    if (b.isCapture) {
      scoreB += 1000 + (b.captures ? b.captures.length * 300 : 0);
    }

    // Prioridad 2: Coronación a Rey
    if (a.isKingPromotion) scoreA += 500;
    if (b.isKingPromotion) scoreB += 500;

    // Prioridad 3: Avance hacia la fila de coronación
    if (player === PLAYER_1) {
      // P1 avanza hacia fila 0 (menor índice = mayor avance)
      scoreA += (7 - a.to.row) * 10;
      scoreB += (7 - b.to.row) * 10;
    } else {
      // P2 avanza hacia fila 7 (mayor índice = mayor avance)
      scoreA += a.to.row * 10;
      scoreB += b.to.row * 10;
    }

    // Prioridad 4: Control de centro (destino en columnas o filas intermedias)
    if (a.to.row >= 2 && a.to.row <= 5 && a.to.col >= 2 && a.to.col <= 5) scoreA += 50;
    if (b.to.row >= 2 && b.to.row <= 5 && b.to.col >= 2 && b.to.col <= 5) scoreB += 50;

    return scoreB - scoreA;
  });
}

/**
 * Rutina recursiva del algoritmo Minimax con Poda Alfa-Beta.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} depth Profundidad restante de búsqueda.
 * @param {number} alpha Mejor valor garantizado para el jugador MAX.
 * @param {number} beta Mejor valor garantizado para el jugador MIN.
 * @param {boolean} isMaximizing True si el turno actual corresponde a MAX.
 * @param {number} maximizingPlayer Jugador en favor de quien se optimiza la evaluación.
 * @param {object} customWeights Ponderaciones heurísticas personalizadas.
 * @param {object} metrics Acumulador de métricas { nodesEvaluated, prunedBranches }.
 * @returns {number} Puntuación minimax evaluada.
 */
function minimax(board, depth, alpha, beta, isMaximizing, maximizingPlayer, customWeights, metrics) {
  const currentPlayer = isMaximizing ? maximizingPlayer : getOpponent(maximizingPlayer);

  // 1. Verificación de estado terminal (victoria o derrota forzada)
  const gameOver = checkGameOver(board, currentPlayer);
  if (gameOver.isGameOver) {
    if (gameOver.winner === maximizingPlayer) {
      // Bonificar victorias tempranas agregando la profundidad restante
      return WIN_SCORE + depth;
    }
    if (gameOver.winner === getOpponent(maximizingPlayer)) {
      // Penalizar derrotas rápidas restando la profundidad restante
      return -WIN_SCORE - depth;
    }
    return 0; // Tablas
  }

  // 2. Condición de parada de profundidad
  if (depth <= 0) {
    return evaluateBoard(board, maximizingPlayer, customWeights);
  }

  // 3. Generación y ordenamiento de movimientos
  const validMoves = getValidMovesForPlayer(board, currentPlayer);
  if (validMoves.length === 0) {
    // Si no tiene movimientos válidos, está bloqueado y pierde
    return isMaximizing ? (-WIN_SCORE - depth) : (WIN_SCORE + depth);
  }

  const orderedMoves = orderMoves(board, validMoves, currentPlayer);

  // 4. Búsqueda y Poda
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      metrics.nodesEvaluated++;
      const nextBoard = applyMove(board, move);
      const evaluation = minimax(
        nextBoard,
        depth - 1,
        alpha,
        beta,
        false,
        maximizingPlayer,
        customWeights,
        metrics
      );

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);

      // Poda Beta: MIN ya tiene una opción mejor en una rama previa
      if (beta <= alpha) {
        metrics.prunedBranches++;
        break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      metrics.nodesEvaluated++;
      const nextBoard = applyMove(board, move);
      const evaluation = minimax(
        nextBoard,
        depth - 1,
        alpha,
        beta,
        true,
        maximizingPlayer,
        customWeights,
        metrics
      );

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);

      // Poda Alfa: MAX ya tiene una opción mejor en una rama previa
      if (beta <= alpha) {
        metrics.prunedBranches++;
        break;
      }
    }
    return minEval;
  }
}

/**
 * Función raíz del motor de IA que selecciona la mejor jugada disponible.
 * 
 * Aplica:
 * - Respuesta instantánea (0 ms) ante jugadas únicas forzadas (capturas únicas).
 * - Ordenamiento inicial de movimientos para maximizar la frecuencia de podas.
 * - Registro de métricas de nodos explorados, podas realizadas y tiempo total.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 actual.
 * @param {number} [player=PLAYER_2] Jugador para quien se calcula el movimiento.
 * @param {number} [depth=4] Profundidad de búsqueda en el árbol de juego.
 * @param {object} [customWeights={}] Ponderaciones heurísticas opcionales.
 * @returns {{
 *   bestMove: object | null,
 *   score: number,
 *   depth: number,
 *   nodesEvaluated: number,
 *   prunedBranches: number,
 *   timeMs: number
 * }}
 */
function findBestMove(board, player = PLAYER_2, depth = 4, customWeights = {}) {
  const startTime = performance.now();
  const metrics = {
    nodesEvaluated: 0,
    prunedBranches: 0
  };

  const validMoves = getValidMovesForPlayer(board, player);

  // 1. Caso sin movimientos disponibles (bloqueado o eliminado)
  if (validMoves.length === 0) {
    const elapsed = Number((performance.now() - startTime).toFixed(2));
    return {
      bestMove: null,
      score: -WIN_SCORE,
      depth,
      nodesEvaluated: 0,
      prunedBranches: 0,
      timeMs: elapsed
    };
  }

  // 2. Optimización crítica: Si solo existe 1 jugada legal (forzada), retornarla de inmediato
  if (validMoves.length === 1) {
    metrics.nodesEvaluated = 1;
    const singleMove = validMoves[0];
    const resultingBoard = applyMove(board, singleMove);
    const score = evaluateBoard(resultingBoard, player, customWeights);
    const elapsed = Number((performance.now() - startTime).toFixed(2));

    return {
      bestMove: singleMove,
      score,
      depth,
      nodesEvaluated: 1,
      prunedBranches: 0,
      timeMs: elapsed
    };
  }

  // 3. Ordenar jugadas iniciales para optimizar la poda en la raíz
  const orderedMoves = orderMoves(board, validMoves, player);

  let bestMove = orderedMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  // 4. Explorar cada rama de la raíz
  for (const move of orderedMoves) {
    metrics.nodesEvaluated++;
    const nextBoard = applyMove(board, move);

    // En el siguiente nivel le corresponde mover al oponente (isMaximizing = false)
    const score = minimax(
      nextBoard,
      depth - 1,
      alpha,
      beta,
      false,
      player,
      customWeights,
      metrics
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    alpha = Math.max(alpha, bestScore);

    // Si ya se encontró una victoria forzada absoluta inmediata, detener búsqueda
    if (bestScore >= WIN_SCORE) {
      break;
    }
  }

  const elapsed = Number((performance.now() - startTime).toFixed(2));

  return {
    bestMove,
    score: bestScore,
    depth,
    nodesEvaluated: metrics.nodesEvaluated,
    prunedBranches: metrics.prunedBranches,
    timeMs: elapsed
  };
}

module.exports = {
  findBestMove,
  minimax,
  orderMoves
};
