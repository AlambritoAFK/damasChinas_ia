/**
 * Controlador de peticiones HTTP para el juego de damas 8x8 con IA (gameController.js).
 * 
 * Orquesta la capa de transporte REST con los módulos de reglas del juego
 * (constants, board, moveGenerator, rules) y el motor de IA (difficulty, alphaBeta, heuristics).
 */

const {
  BOARD_SIZE,
  PLAYER_1,
  PLAYER_2,
  PIECES,
  getPlayer,
  getOpponent
} = require('../game/constants');

const {
  createInitialBoard,
  countPieces,
  isInsideBoard
} = require('../game/board');

const {
  getValidMovesForPlayer,
  getValidMovesForPiece,
  hasAnyCapture
} = require('../game/moveGenerator');

const {
  checkGameOver,
  applyMove,
  isValidMove,
  GAME_OVER_REASONS
} = require('../game/rules');

const {
  computeAiMove,
  normalizeDifficulty,
  getDifficultyConfig
} = require('../ai/difficulty');

/**
 * Conjunto de valores numéricos de piezas válidos en el tablero.
 */
const VALID_PIECE_VALUES = new Set([
  PIECES.EMPTY,     // 0
  PIECES.P1_MAN,    // 1
  PIECES.P1_KING,   // 2
  PIECES.P2_MAN,    // -1
  PIECES.P2_KING    // -2
]);

/**
 * Valida de forma exhaustiva la estructura del tablero 8x8.
 * Debe ser un arreglo de longitud 8 compuesto por arreglos de longitud 8
 * cuyos valores correspondan a piezas válidas.
 * 
 * @param {any} board 
 * @returns {{ isValid: boolean, error?: string }}
 */
function validateBoard(board) {
  if (!board || !Array.isArray(board)) {
    return {
      isValid: false,
      error: "La propiedad 'board' es requerida y debe ser un arreglo bidimensional (matriz 8x8)."
    };
  }

  if (board.length !== BOARD_SIZE) {
    return {
      isValid: false,
      error: `El tablero debe contener exactamente ${BOARD_SIZE} filas. Recibido: ${board.length}.`
    };
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = board[r];
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) {
      return {
        isValid: false,
        error: `La fila ${r} debe ser un arreglo de exactamente ${BOARD_SIZE} columnas.`
      };
    }

    for (let c = 0; c < BOARD_SIZE; c++) {
      const val = row[c];
      if (typeof val !== 'number' || !Number.isInteger(val) || !VALID_PIECE_VALUES.has(val)) {
        return {
          isValid: false,
          error: `Valor de pieza inválido en posición (${r}, ${c}): ${val}. Valores permitidos: 0, 1, 2, -1, -2.`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Valida que las coordenadas de una casilla sean enteras y estén dentro del rango 0 a 7.
 * 
 * @param {any} row 
 * @param {any} col 
 * @returns {{ isValid: boolean, error?: string }}
 */
function validateCoordinates(row, col) {
  if (row === undefined || col === undefined || row === null || col === null) {
    return {
      isValid: false,
      error: "Las coordenadas 'row' y 'col' son obligatorias."
    };
  }

  const r = Number(row);
  const c = Number(col);

  if (!Number.isInteger(r) || !Number.isInteger(c)) {
    return {
      isValid: false,
      error: "Las coordenadas 'row' y 'col' deben ser números enteros."
    };
  }

  if (!isInsideBoard(r, c)) {
    return {
      isValid: false,
      error: `Las coordenadas (${r}, ${c}) se encuentran fuera de los límites del tablero (0 a ${BOARD_SIZE - 1}).`
    };
  }

  return { isValid: true };
}

/**
 * Valida que el jugador corresponda a PLAYER_1 (1) o PLAYER_2 (-1).
 * 
 * @param {any} player 
 * @returns {{ isValid: boolean, error?: string }}
 */
function validatePlayer(player) {
  if (player === undefined || player === null) {
    return {
      isValid: false,
      error: "El parámetro 'player' es requerido."
    };
  }

  const p = Number(player);
  if (p !== PLAYER_1 && p !== PLAYER_2) {
    return {
      isValid: false,
      error: `Identificador de jugador inválido: ${player}. Valores permitidos: 1 (Humano) o -1 (IA).`
    };
  }

  return { isValid: true };
}

/**
 * Endpoint de verificación de estado y conectividad del servidor.
 * GET /api/game/health
 */
function healthCheck(req, res) {
  return res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Servidor de Damas 8x8 con IA operativo',
    timestamp: new Date().toISOString()
  });
}

/**
 * Endpoint para inicializar una nueva partida.
 * POST /api/game/new
 * 
 * Payload opcional:
 * {
 *   "difficulty": "medium",
 *   "startingPlayer": 1
 * }
 */
function newGame(req, res) {
  try {
    const { difficulty = 'medium', startingPlayer = PLAYER_1 } = req.body || {};

    if (startingPlayer !== undefined) {
      const playerValidation = validatePlayer(startingPlayer);
      if (!playerValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: playerValidation.error
        });
      }
    }

    const board = createInitialBoard();
    const pieceCounts = countPieces(board);
    const difficultyConfig = getDifficultyConfig(difficulty);

    return res.status(200).json({
      success: true,
      board,
      currentTurn: startingPlayer,
      pieceCounts,
      difficulty: difficultyConfig.key,
      difficultyName: difficultyConfig.name,
      message: 'Nueva partida inicializada exitosamente'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error interno al inicializar la partida',
      details: error.message
    });
  }
}

/**
 * Endpoint para consultar movimientos válidos.
 * POST /api/game/valid-moves
 * 
 * Payload esperado:
 * {
 *   "board": [[...], ...],
 *   "row": 5,      // Opcional si se especifica 'player'
 *   "col": 2,      // Opcional si se especifica 'player'
 *   "player": 1    // Opcional si se especifican 'row' y 'col'
 * }
 */
function getValidMoves(req, res) {
  try {
    const { board, row, col, player } = req.body || {};

    // 1. Validar tablero
    const boardValidation = validateBoard(board);
    if (!boardValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: boardValidation.error
      });
    }

    // 2. Caso A: Coordenadas de pieza específica
    if (row !== undefined && col !== undefined) {
      const coordValidation = validateCoordinates(row, col);
      if (!coordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: coordValidation.error
        });
      }

      const r = Number(row);
      const c = Number(col);
      const piece = board[r][c];

      if (piece === PIECES.EMPTY) {
        return res.status(200).json({
          success: true,
          piece: PIECES.EMPTY,
          player: 0,
          validMoves: [],
          hasCapture: false,
          mustCapture: false
        });
      }

      const piecePlayer = getPlayer(piece);

      // Si el cliente indicó además un jugador activo, validar coincidencia de turno
      if (player !== undefined) {
        const playerValidation = validatePlayer(player);
        if (!playerValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: playerValidation.error
          });
        }
        if (Number(player) !== piecePlayer) {
          return res.status(200).json({
            success: true,
            piece,
            player: piecePlayer,
            validMoves: [],
            hasCapture: false,
            mustCapture: false,
            message: 'La pieza seleccionada no pertenece al jugador activo'
          });
        }
      }

      const validMoves = getValidMovesForPiece(board, r, c);
      const playerMustCapture = hasAnyCapture(board, piecePlayer);

      return res.status(200).json({
        success: true,
        piece,
        player: piecePlayer,
        validMoves,
        hasCapture: validMoves.some(m => m.isCapture),
        mustCapture: playerMustCapture
      });
    }

    // 3. Caso B: Todos los movimientos del jugador activo
    if (player !== undefined) {
      const playerValidation = validatePlayer(player);
      if (!playerValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: playerValidation.error
        });
      }

      const activePlayer = Number(player);
      const validMoves = getValidMovesForPlayer(board, activePlayer);
      const playerMustCapture = hasAnyCapture(board, activePlayer);

      return res.status(200).json({
        success: true,
        player: activePlayer,
        validMoves,
        hasCapture: validMoves.some(m => m.isCapture),
        mustCapture: playerMustCapture
      });
    }

    // 4. Caso C: Parámetros insuficientes
    return res.status(400).json({
      success: false,
      error: "Debe proporcionar las coordenadas ('row', 'col') de la pieza o el identificador del jugador ('player')."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error interno al calcular movimientos válidos',
      details: error.message
    });
  }
}

/**
 * Endpoint para solicitar el cálculo del movimiento del Agente de IA.
 * POST /api/game/ai-move
 * 
 * Payload esperado:
 * {
 *   "board": [[...], ...],
 *   "player": -1,            // Opcional, por defecto -1 (PLAYER_2)
 *   "difficulty": "medium",  // Opcional, por defecto 'medium'
 *   "options": {}            // Opcional para pruebas avanzadas
 * }
 */
function getAiMove(req, res) {
  try {
    const { board, player = PLAYER_2, difficulty = 'medium', options = {} } = req.body || {};

    // 1. Validar tablero
    const boardValidation = validateBoard(board);
    if (!boardValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: boardValidation.error
      });
    }

    // 2. Validar jugador
    const playerValidation = validatePlayer(player);
    if (!playerValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: playerValidation.error
      });
    }
    const aiPlayer = Number(player);

    // 3. Verificar si la partida ya ha concluido antes de buscar
    const currentGameOver = checkGameOver(board, aiPlayer);
    if (currentGameOver.isGameOver) {
      return res.status(200).json({
        success: true,
        bestMove: null,
        isGameOver: true,
        winner: currentGameOver.winner,
        reason: currentGameOver.reason,
        metrics: {
          nodesEvaluated: 0,
          depth: 0,
          timeMs: 0
        }
      });
    }

    // 4. Ejecutar el cálculo del agente inteligente
    const aiResult = computeAiMove(board, aiPlayer, difficulty, options);

    // 5. Si existe un movimiento óptimo, proyectar el nuevo tablero y evaluar estado resultante
    let resultingBoard = board;
    let postMoveGameOver = { isGameOver: false, winner: null, reason: null };

    if (aiResult.bestMove) {
      resultingBoard = applyMove(board, aiResult.bestMove);
      postMoveGameOver = checkGameOver(resultingBoard, getOpponent(aiPlayer));
    }

    return res.status(200).json({
      success: true,
      bestMove: aiResult.bestMove,
      resultingBoard,
      isGameOver: postMoveGameOver.isGameOver,
      winner: postMoveGameOver.winner,
      reason: postMoveGameOver.reason,
      metrics: {
        nodesEvaluated: aiResult.nodesEvaluated,
        depth: aiResult.depth,
        timeMs: aiResult.timeMs,
        prunedBranches: aiResult.prunedBranches,
        score: aiResult.score,
        difficulty: aiResult.difficulty,
        difficultyName: aiResult.difficultyName
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar el movimiento de la IA',
      details: error.message
    });
  }
}

/**
 * Endpoint complementario para validar y aplicar un movimiento en el servidor.
 * POST /api/game/apply-move
 * 
 * Payload esperado:
 * {
 *   "board": [[...], ...],
 *   "player": 1,
 *   "move": { "from": { "row": 5, "col": 2 }, "to": { "row": 4, "col": 1 } }
 * }
 */
function applyPlayerMove(req, res) {
  try {
    const { board, player, move } = req.body || {};

    const boardValidation = validateBoard(board);
    if (!boardValidation.isValid) {
      return res.status(400).json({ success: false, error: boardValidation.error });
    }

    const playerValidation = validatePlayer(player);
    if (!playerValidation.isValid) {
      return res.status(400).json({ success: false, error: playerValidation.error });
    }

    if (!move || !move.from || !move.to) {
      return res.status(400).json({
        success: false,
        error: "Estructura de 'move' inválida. Debe contener 'from' y 'to' con 'row' y 'col'."
      });
    }

    const activePlayer = Number(player);
    const legalMove = isValidMove(board, activePlayer, move);

    if (!legalMove) {
      return res.status(400).json({
        success: false,
        error: 'El movimiento propuesto no es válido según las reglas del juego o captura obligatoria.'
      });
    }

    const resultingBoard = applyMove(board, legalMove);
    const postMoveGameOver = checkGameOver(resultingBoard, getOpponent(activePlayer));

    return res.status(200).json({
      success: true,
      move: legalMove,
      resultingBoard,
      pieceCounts: countPieces(resultingBoard),
      isGameOver: postMoveGameOver.isGameOver,
      winner: postMoveGameOver.winner,
      reason: postMoveGameOver.reason
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error interno al aplicar el movimiento',
      details: error.message
    });
  }
}

/**
 * Endpoint para procesar la rendición voluntaria de un jugador.
 * POST /api/game/resign
 * 
 * Payload esperado:
 * {
 *   "player": 1 // Jugador que se rinde (1 para Humano, -1 para IA)
 * }
 */
function resignGame(req, res) {
  try {
    const { player = PLAYER_1 } = req.body || {};
    const playerValidation = validatePlayer(player);
    if (!playerValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: playerValidation.error
      });
    }

    const resigningPlayer = Number(player);
    const winner = getOpponent(resigningPlayer);

    return res.status(200).json({
      success: true,
      isGameOver: true,
      winner,
      reason: GAME_OVER_REASONS.RESIGN,
      message: `El jugador ${resigningPlayer === PLAYER_1 ? '1 (Humano)' : '2 (IA)'} se ha rendido. Victoria para el jugador ${winner === PLAYER_1 ? '1 (Humano)' : '2 (IA)'}.`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la rendición',
      details: error.message
    });
  }
}

module.exports = {
  validateBoard,
  validateCoordinates,
  validatePlayer,
  healthCheck,
  newGame,
  getValidMoves,
  getAiMove,
  applyPlayerMove,
  resignGame
};
