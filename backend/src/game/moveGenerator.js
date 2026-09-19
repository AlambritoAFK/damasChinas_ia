/**
 * Módulo de generación de movimientos y validación de reglas de captura.
 * Implementa el algoritmo de saltos simples, saltos múltiples encadenados (DFS),
 * coronación en salto y la regla oficial de captura obligatoria.
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
  isKing,
  getDirections
} = require('./constants');

const {
  isInsideBoard,
  cloneBoard
} = require('./board');

/**
 * Genera los movimientos simples (de 1 paso a casillas vacías adyacentes)
 * disponibles para una pieza en una posición específica.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} row Fila de origen.
 * @param {number} col Columna de origen.
 * @returns {Array<object>} Lista de movimientos simples.
 */
function getSimpleMovesForPiece(board, row, col) {
  if (!isInsideBoard(row, col)) return [];
  const piece = board[row][col];
  if (piece === PIECES.EMPTY) return [];

  const moves = [];
  const directions = getDirections(piece);
  const player = getPlayer(piece);

  for (const [dRow, dCol] of directions) {
    const toRow = row + dRow;
    const toCol = col + dCol;

    if (isInsideBoard(toRow, toCol) && board[toRow][toCol] === PIECES.EMPTY) {
      const isKingPromotion =
        (player === PLAYER_1 && toRow === CROWN_ROW_P1 && piece === PIECES.P1_MAN) ||
        (player === PLAYER_2 && toRow === CROWN_ROW_P2 && piece === PIECES.P2_MAN);

      moves.push({
        from: { row, col },
        to: { row: toRow, col: toCol },
        path: [
          { row, col },
          { row: toRow, col: toCol }
        ],
        captures: [],
        isCapture: false,
        isKingPromotion
      });
    }
  }

  return moves;
}

/**
 * Retorna los saltos simples e inmediatos de 1 paso disponibles para una pieza.
 * Útil para validaciones rápidas, detección de capturas y control paso a paso en UI.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} row Fila de la pieza.
 * @param {number} col Columna de la pieza.
 * @returns {Array<object>} Lista de saltos inmediatos disponibles.
 */
function getSingleJumpsForPiece(board, row, col) {
  if (!isInsideBoard(row, col)) return [];
  const piece = board[row][col];
  if (piece === PIECES.EMPTY) return [];

  const jumps = [];
  const directions = getDirections(piece);
  const player = getPlayer(piece);
  const opponent = getOpponent(player);

  for (const [dRow, dCol] of directions) {
    const midRow = row + dRow;
    const midCol = col + dCol;
    const landRow = row + 2 * dRow;
    const landCol = col + 2 * dCol;

    if (isInsideBoard(landRow, landCol)) {
      const midPiece = board[midRow][midCol];
      const landPiece = board[landRow][landCol];

      if (getPlayer(midPiece) === opponent && landPiece === PIECES.EMPTY) {
        const isKingPromotion =
          (player === PLAYER_1 && landRow === CROWN_ROW_P1 && piece === PIECES.P1_MAN) ||
          (player === PLAYER_2 && landRow === CROWN_ROW_P2 && piece === PIECES.P2_MAN);

        jumps.push({
          from: { row, col },
          to: { row: landRow, col: landCol },
          path: [
            { row, col },
            { row: landRow, col: landCol }
          ],
          captures: [{ row: midRow, col: midCol }],
          isCapture: true,
          isKingPromotion
        });
      }
    }
  }

  return jumps;
}

/**
 * Genera exhaustivamente todas las secuencias completas de saltos (incluyendo
 * capturas múltiples encadenadas) mediante Búsqueda en Profundidad (DFS).
 * 
 * Reglas aplicadas:
 * 1. Si tras un salto hay otro salto posible, la pieza debe continuar.
 * 2. Si un peón simple alcanza la fila de coronación durante el salto, se corona
 *    y su turno finaliza inmediatamente según las reglas oficiales de damas 8x8.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} startRow Fila de origen de la pieza.
 * @param {number} startCol Columna de origen de la pieza.
 * @returns {Array<object>} Lista de secuencias completas de captura.
 */
function getJumpsForPiece(board, startRow, startCol) {
  if (!isInsideBoard(startRow, startCol)) return [];
  const initialPiece = board[startRow][startCol];
  if (initialPiece === PIECES.EMPTY) return [];

  const completedMoves = [];
  const player = getPlayer(initialPiece);
  const opponent = getOpponent(player);

  /**
   * Rutina recursiva DFS para encadenar capturas consecutivas.
   * 
   * @param {Array<Array<number>>} currentBoard Tablero actual en la simulación.
   * @param {number} currRow Posición actual de la pieza.
   * @param {number} currCol Posición actual de la pieza.
   * @param {number} currentPiece Estado de la pieza (peón o rey).
   * @param {Array<{row: number, col: number}>} currentPath Secuencia de casillas visitadas.
   * @param {Array<{row: number, col: number}>} currentCaptures Casillas de piezas capturadas.
   */
  function dfs(currentBoard, currRow, currCol, currentPiece, currentPath, currentCaptures) {
    const directions = getDirections(currentPiece);
    let canContinueJumping = false;

    for (const [dRow, dCol] of directions) {
      const midRow = currRow + dRow;
      const midCol = currCol + dCol;
      const landRow = currRow + 2 * dRow;
      const landCol = currCol + 2 * dCol;

      if (isInsideBoard(landRow, landCol)) {
        const midPiece = currentBoard[midRow][midCol];
        const landPiece = currentBoard[landRow][landCol];

        if (getPlayer(midPiece) === opponent && landPiece === PIECES.EMPTY) {
          canContinueJumping = true;

          // Verificar si esta etapa corona a un peón simple
          const willPromote =
            (player === PLAYER_1 && landRow === CROWN_ROW_P1 && currentPiece === PIECES.P1_MAN) ||
            (player === PLAYER_2 && landRow === CROWN_ROW_P2 && currentPiece === PIECES.P2_MAN);

          const nextPiece = willPromote
            ? (player === PLAYER_1 ? PIECES.P1_KING : PIECES.P2_KING)
            : currentPiece;

          // Simular el salto en un nuevo tablero clonado
          const nextBoard = cloneBoard(currentBoard);
          nextBoard[currRow][currCol] = PIECES.EMPTY;
          nextBoard[midRow][midCol] = PIECES.EMPTY; // Se retira la pieza capturada
          nextBoard[landRow][landCol] = nextPiece;

          const nextPath = [...currentPath, { row: landRow, col: landCol }];
          const nextCaptures = [...currentCaptures, { row: midRow, col: midCol }];

          // Regla oficial: Al coronarse en salto, el turno concluye inmediatamente
          if (willPromote) {
            completedMoves.push({
              from: { row: startRow, col: startCol },
              to: { row: landRow, col: landCol },
              path: nextPath,
              captures: nextCaptures,
              isCapture: true,
              isKingPromotion: true
            });
          } else {
            // Intentar saltos subsiguientes desde la nueva casilla de aterrizaje
            const branchesBefore = completedMoves.length;
            dfs(nextBoard, landRow, landCol, nextPiece, nextPath, nextCaptures);

            // Si la llamada recursiva no encontró más saltos, este camino termina aquí
            if (completedMoves.length === branchesBefore) {
              completedMoves.push({
                from: { row: startRow, col: startCol },
                to: { row: landRow, col: landCol },
                path: nextPath,
                captures: nextCaptures,
                isCapture: true,
                isKingPromotion: isKing(nextPiece) && !isKing(initialPiece)
              });
            }
          }
        }
      }
    }
  }

  // Iniciar DFS desde la casilla inicial
  dfs(
    board,
    startRow,
    startCol,
    initialPiece,
    [{ row: startRow, col: startCol }],
    []
  );

  return completedMoves;
}

/**
 * Determina de manera rápida y eficiente si un jugador tiene AL MENOS una
 * captura disponible en cualquier parte del tablero.
 * Permite aplicar poda y comprobaciones instantáneas para la regla de captura obligatoria.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} player PLAYER_1 o PLAYER_2.
 * @returns {boolean} True si existe al menos una captura disponible.
 */
function hasAnyCapture(board, player) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (getPlayer(piece) === player) {
        if (getSingleJumpsForPiece(board, r, c).length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Genera todos los movimientos válidos para un jugador en el tablero actual.
 * 
 * Aplica estrictamente la REGLA DE CAPTURA OBLIGATORIA:
 * - Si existen una o más capturas posibles en el tablero, ÚNICAMENTE se retornan
 *   las jugadas de captura (descartando por completo los movimientos simples).
 * - Si no existen capturas, retorna los movimientos simples disponibles.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} player Jugador activo (PLAYER_1 o PLAYER_2).
 * @returns {Array<object>} Lista de movimientos legales.
 */
function getValidMovesForPlayer(board, player) {
  const captureMoves = [];
  const simpleMoves = [];

  // Fase 1: Escanear todas las piezas del jugador
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (getPlayer(piece) === player) {
        const jumps = getJumpsForPiece(board, r, c);
        if (jumps.length > 0) {
          captureMoves.push(...jumps);
        }
      }
    }
  }

  // Regla de captura obligatoria: Si hay capturas, solo se retornan capturas
  if (captureMoves.length > 0) {
    return captureMoves;
  }

  // Fase 2: Si no hubo capturas, obtener movimientos simples
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (getPlayer(piece) === player) {
        const simples = getSimpleMovesForPiece(board, r, c);
        if (simples.length > 0) {
          simpleMoves.push(...simples);
        }
      }
    }
  }

  return simpleMoves;
}

/**
 * Retorna los movimientos válidos disponibles para una pieza específica en (row, col),
 * considerando la regla global de captura obligatoria para el jugador propietario.
 * 
 * - Si algún movimiento de captura existe en el tablero para ese jugador y esta pieza
 *   no puede capturar, retorna [] (obligando a mover la pieza con captura).
 * - Si la pieza puede capturar, retorna sus secuencias de salto.
 * - Si no hay capturas en todo el tablero, retorna sus movimientos simples.
 * 
 * @param {Array<Array<number>>} board Matriz 8x8 del tablero.
 * @param {number} row Fila de la pieza.
 * @param {number} col Columna de la pieza.
 * @returns {Array<object>} Movimientos legales para dicha pieza.
 */
function getValidMovesForPiece(board, row, col) {
  if (!isInsideBoard(row, col)) return [];
  const piece = board[row][col];
  if (piece === PIECES.EMPTY) return [];

  const player = getPlayer(piece);
  const playerMustCapture = hasAnyCapture(board, player);

  if (playerMustCapture) {
    // Si hay capturas obligatorias en el tablero, solo se permite capturar
    return getJumpsForPiece(board, row, col);
  }

  // Si no hay capturas obligatorias, se permiten los movimientos simples
  return getSimpleMovesForPiece(board, row, col);
}

module.exports = {
  getSimpleMovesForPiece,
  getSingleJumpsForPiece,
  getJumpsForPiece,
  hasAnyCapture,
  getValidMovesForPlayer,
  getValidMovesForPiece
};
