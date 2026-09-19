/**
 * Constantes inmutables del juego de damas 8x8.
 */

// Dimensiones del tablero
const BOARD_SIZE = 8;

// Identificadores de jugadores
const PLAYER_1 = 1;  // Humano (avanza hacia fila 0)
const PLAYER_2 = -1; // IA (avanza hacia fila 7)

// Códigos numéricos de casillas / tipos de piezas
const PIECES = {
  EMPTY: 0,
  P1_MAN: 1,
  P1_KING: 2,
  P2_MAN: -1,
  P2_KING: -2
};

// Direcciones de avance diagonal [dRow, dCol]
// PLAYER_1 avanza hacia arriba (filas menores: -1)
const P1_DIRECTIONS = [
  [-1, -1],
  [-1, 1]
];

// PLAYER_2 avanza hacia abajo (filas mayores: +1)
const P2_DIRECTIONS = [
  [1, -1],
  [1, 1]
];

// Reyes / Damas pueden moverse y capturar en las 4 diagonales
const KING_DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];

// Filas de coronación
const CROWN_ROW_P1 = 0;
const CROWN_ROW_P2 = 7;

/**
 * Retorna el jugador al que pertenece una pieza.
 * @param {number} piece 
 * @returns {number} PLAYER_1 (1), PLAYER_2 (-1), o 0 si está vacía.
 */
function getPlayer(piece) {
  if (piece > 0) return PLAYER_1;
  if (piece < 0) return PLAYER_2;
  return 0;
}

/**
 * Retorna el oponente de un jugador dado.
 * @param {number} player 
 * @returns {number}
 */
function getOpponent(player) {
  return player === PLAYER_1 ? PLAYER_2 : PLAYER_1;
}

/**
 * Determina si una pieza es un rey/dama.
 * @param {number} piece 
 * @returns {boolean}
 */
function isKing(piece) {
  return Math.abs(piece) === 2;
}

/**
 * Determina si una pieza es un peón simple.
 * @param {number} piece 
 * @returns {boolean}
 */
function isMan(piece) {
  return Math.abs(piece) === 1;
}

/**
 * Retorna las direcciones diagonales de movimiento para una pieza.
 * @param {number} piece 
 * @returns {Array<[number, number]>}
 */
function getDirections(piece) {
  if (isKing(piece)) {
    return KING_DIRECTIONS;
  }
  if (piece === PIECES.P1_MAN) {
    return P1_DIRECTIONS;
  }
  if (piece === PIECES.P2_MAN) {
    return P2_DIRECTIONS;
  }
  return [];
}

module.exports = {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  P1_DIRECTIONS,
  P2_DIRECTIONS,
  KING_DIRECTIONS,
  CROWN_ROW_P1,
  CROWN_ROW_P2,
  getPlayer,
  getOpponent,
  isKing,
  isMan,
  getDirections
};
