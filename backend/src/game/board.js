/**
 * Módulo de estructura y utilidades del tablero 8x8 para el juego de damas.
 */

const {
  BOARD_SIZE,
  PIECES
} = require('./constants');

/**
 * Determina si una casilla dada corresponde a una casilla oscura (jugable).
 * En damas estándar 8x8, las piezas se sitúan en casillas donde (row + col) % 2 !== 0.
 * @param {number} row 
 * @param {number} col 
 * @returns {boolean}
 */
function isDarkSquare(row, col) {
  return (row + col) % 2 === 1;
}

/**
 * Verifica si las coordenadas (row, col) están dentro de los límites del tablero 8x8.
 * @param {number} row 
 * @param {number} col 
 * @returns {boolean}
 */
function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Genera la matriz inicial de 8x8 con las 12 piezas de cada jugador
 * posicionadas exclusivamente en casillas oscuras.
 * - Filas 0 a 2: Jugador 2 (IA, valor -1)
 * - Filas 3 y 4: Zona neutral vacía (valor 0)
 * - Filas 5 a 7: Jugador 1 (Humano, valor 1)
 * @returns {Array<Array<number>>} Matriz 8x8
 */
function createInitialBoard() {
  const board = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isDarkSquare(r, c)) {
        if (r >= 0 && r <= 2) {
          row.push(PIECES.P2_MAN);
        } else if (r >= 5 && r <= 7) {
          row.push(PIECES.P1_MAN);
        } else {
          row.push(PIECES.EMPTY);
        }
      } else {
        row.push(PIECES.EMPTY);
      }
    }
    board.push(row);
  }

  return board;
}

/**
 * Realiza una copia profunda rápida de la matriz del tablero.
 * Esencial para evaluar estados en el árbol Minimax sin mutar el tablero real.
 * @param {Array<Array<number>>} board 
 * @returns {Array<Array<number>>} Nuevo tablero clonado
 */
function cloneBoard(board) {
  const copy = new Array(BOARD_SIZE);
  for (let r = 0; r < BOARD_SIZE; r++) {
    copy[r] = board[r].slice();
  }
  return copy;
}

/**
 * Cuenta la cantidad de piezas (peones y reyes) para cada jugador en el tablero.
 * @param {Array<Array<number>>} board 
 * @returns {{
 *   player1: { men: number, kings: number, total: number },
 *   player2: { men: number, kings: number, total: number }
 * }}
 */
function countPieces(board) {
  const counts = {
    player1: { men: 0, kings: 0, total: 0 },
    player2: { men: 0, kings: 0, total: 0 }
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece === PIECES.P1_MAN) {
        counts.player1.men++;
        counts.player1.total++;
      } else if (piece === PIECES.P1_KING) {
        counts.player1.kings++;
        counts.player1.total++;
      } else if (piece === PIECES.P2_MAN) {
        counts.player2.men++;
        counts.player2.total++;
      } else if (piece === PIECES.P2_KING) {
        counts.player2.kings++;
        counts.player2.total++;
      }
    }
  }

  return counts;
}

/**
 * Representación en texto del tablero para depuración y consola.
 * @param {Array<Array<number>>} board 
 * @returns {string}
 */
function printBoard(board) {
  let str = '  0 1 2 3 4 5 6 7\n';
  for (let r = 0; r < BOARD_SIZE; r++) {
    str += `${r} `;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      let symbol = '.';
      if (piece === PIECES.P1_MAN) symbol = 'w';
      else if (piece === PIECES.P1_KING) symbol = 'W';
      else if (piece === PIECES.P2_MAN) symbol = 'b';
      else if (piece === PIECES.P2_KING) symbol = 'B';
      str += symbol + ' ';
    }
    str += '\n';
  }
  return str;
}

module.exports = {
  isDarkSquare,
  isInsideBoard,
  createInitialBoard,
  cloneBoard,
  countPieces,
  printBoard
};
