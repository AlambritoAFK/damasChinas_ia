/**
 * Módulo de reglas del juego y transiciones de estado para damas 8x8.
 * Gestiona la aplicación inmutable de movimientos, coronación de piezas,
 * verificación de fin de partida (eliminación o bloqueo) y validación de jugadas.
 */

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  CROWN_ROW_P1,
  CROWN_ROW_P2,
  getPlayer,
  getOpponent,
  isKing
} = require('./constants');

const {
  cloneBoard,
  countPieces,
  isInsideBoard
} = require('./board');

const {
  getValidMovesForPlayer
} = require('./moveGenerator');

/**
 * Razones estándar de finalización de partida.
 */
const GAME_OVER_REASONS = {
  ELIMINATION: 'ELIMINATION', // Un jugador se quedó sin piezas
  BLOCKED: 'BLOCKED',         // El jugador activo no tiene movimientos válidos
  DRAW: 'DRAW'                // Tablas o empate
};

/**
 * Aplica un movimiento de manera inmutable sobre el tablero.
 * - Traslada la pieza de la casilla origen a la de destino.
 * - Elimina todas las fichas capturadas contenidas en `move.captures`.
 * - Aplica automáticamente la coronación si un peón alcanza la fila extrema.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 actual.
 * @param {object} move Objeto movimiento { from, to, captures, isKingPromotion }.
 * @returns {Array<Array<number>>} Nuevo tablero clonado con el movimiento aplicado.
 */
function applyMove(board, move) {
  if (!move || !move.from || !move.to) {
    throw new Error('Estructura de movimiento inválida');
  }

  const newBoard = cloneBoard(board);
  const { from, to, captures = [] } = move;

  let piece = newBoard[from.row][from.col];
  if (piece === PIECES.EMPTY) {
    return newBoard;
  }

  // 1. Vaciar casilla de origen
  newBoard[from.row][from.col] = PIECES.EMPTY;

  // 2. Retirar piezas comidas
  for (const cap of captures) {
    if (isInsideBoard(cap.row, cap.col)) {
      newBoard[cap.row][cap.col] = PIECES.EMPTY;
    }
  }

  // 3. Evaluar coronación a Rey
  const player = getPlayer(piece);
  const isP1Promoting = player === PLAYER_1 && to.row === CROWN_ROW_P1 && piece === PIECES.P1_MAN;
  const isP2Promoting = player === PLAYER_2 && to.row === CROWN_ROW_P2 && piece === PIECES.P2_MAN;

  if (isP1Promoting) {
    piece = PIECES.P1_KING;
  } else if (isP2Promoting) {
    piece = PIECES.P2_KING;
  } else if (move.isKingPromotion) {
    piece = player === PLAYER_1 ? PIECES.P1_KING : PIECES.P2_KING;
  }

  // 4. Ubicar la pieza en su casilla de destino
  newBoard[to.row][to.col] = piece;

  return newBoard;
}

/**
 * Evalúa si la partida ha terminado para el jugador que tiene el turno actual.
 * 
 * Condiciones de fin de juego según las reglas de damas 8x8:
 * 1. Un jugador pierde si no le quedan piezas en el tablero (ELIMINATION).
 * 2. Un jugador pierde si en su turno no tiene ningún movimiento legal disponible (BLOCKED).
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} currentPlayer Jugador activo al que le corresponde mover (PLAYER_1 o PLAYER_2).
 * @returns {{
 *   isGameOver: boolean,
 *   winner: number | null,
 *   reason: string | null
 * }}
 */
function checkGameOver(board, currentPlayer) {
  const counts = countPieces(board);

  // Verificación por eliminación de piezas
  if (counts.player1.total === 0) {
    return {
      isGameOver: true,
      winner: PLAYER_2,
      reason: GAME_OVER_REASONS.ELIMINATION
    };
  }

  if (counts.player2.total === 0) {
    return {
      isGameOver: true,
      winner: PLAYER_1,
      reason: GAME_OVER_REASONS.ELIMINATION
    };
  }

  // Verificación por bloqueo de movimientos para el jugador activo
  const validMoves = getValidMovesForPlayer(board, currentPlayer);
  if (validMoves.length === 0) {
    return {
      isGameOver: true,
      winner: getOpponent(currentPlayer),
      reason: GAME_OVER_REASONS.BLOCKED
    };
  }

  return {
    isGameOver: false,
    winner: null,
    reason: null
  };
}

/**
 * Valida si un movimiento propuesto por el usuario o cliente es legal.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} player Jugador que propone el movimiento.
 * @param {object} proposedMove Movimiento { from: { row, col }, to: { row, col } }.
 * @returns {object|null} Retorna el objeto movimiento completo si es legal, o null si no lo es.
 */
function isValidMove(board, player, proposedMove) {
  if (!proposedMove || !proposedMove.from || !proposedMove.to) return null;

  const validMoves = getValidMovesForPlayer(board, player);

  return validMoves.find(m =>
    m.from.row === proposedMove.from.row &&
    m.from.col === proposedMove.from.col &&
    m.to.row === proposedMove.to.row &&
    m.to.col === proposedMove.to.col
  ) || null;
}

module.exports = {
  GAME_OVER_REASONS,
  applyMove,
  checkGameOver,
  isValidMove
};
