/**
 * frontend/js/app.js
 * 
 * Paso 15: Orquestador Principal del Juego y Controlador de Estados (Game Controller).
 * Conecta la lógica de interfaz (boardUI.js) con el cliente de red (api.js).
 * Gestiona el bucle de juego, control de turnos (Humano e IA), captura obligatoria,
 * saltos encadenados, botón de rendición, modal de fin de partida y notación PDN.
 */

import * as api from './api.js';
import * as boardUI from './boardUI.js';

// Constantes de jugadores y piezas
const BOARD_SIZE = 8;
const PLAYER_WHITE = 1;  // Humano (avanza hacia arriba / fila 0)
const PLAYER_BLACK = -1; // IA o Jugador 2 (avanza hacia abajo / fila 7)

// Estado global de la aplicación
const gameState = {
  board: [],
  currentTurn: PLAYER_WHITE,
  gameMode: 'ai',        // 'ai' | 'pvp'
  difficulty: 'medium',  // 'easy' | 'medium' | 'hard'
  selectedSquare: null,  // { row, col } | null
  currentValidMoves: [], // Movimientos válidos para la pieza seleccionada
  piecesWithCaptures: [],// Piezas del jugador activo con captura obligatoria
  isBoardLocked: false,  // Bloqueo de entrada durante animaciones o cálculo IA
  isGameOver: false,
  movesHistory: [],      // Historial de jugadas [{ from, to, captures, isCapture, isKingPromotion, boardBefore, boardAfter, player }]
  viewingMoveIndex: -1,  // Para inspección histórica en el docket
  gameStartTime: null,
  timerInterval: null,
  capturesCount: 0
};

/**
 * Genera la matriz inicial 8x8 estándar de damas en caso de ejecución offline o inicio rápido.
 * @returns {number[][]}
 */
function createLocalInitialBoard() {
  const board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const isDark = (r + c) % 2 === 1;
      if (isDark) {
        if (r <= 2) row.push(-1);      // Fichas negras (IA)
        else if (r >= 5) row.push(1);  // Fichas blancas (Humano)
        else row.push(0);              // Casilla vacía
      } else {
        row.push(0);                   // Casilla clara
      }
    }
    board.push(row);
  }
  return board;
}

/**
 * Cuenta las piezas del tablero localmente.
 * @param {number[][]} board 
 * @returns {object}
 */
function countPiecesLocal(board) {
  const counts = {
    player1: { men: 0, kings: 0, total: 0 },
    player2: { men: 0, kings: 0, total: 0 }
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const val = board[r][c];
      if (val === 1) { counts.player1.men++; counts.player1.total++; }
      else if (val === 2) { counts.player1.kings++; counts.player1.total++; }
      else if (val === -1) { counts.player2.men++; counts.player2.total++; }
      else if (val === -2) { counts.player2.kings++; counts.player2.total++; }
    }
  }
  return counts;
}

/**
 * Formatea el tiempo transcurrido en MM:SS.
 * @param {number} seconds 
 * @returns {string}
 */
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * 1. Inicializa una nueva partida restableciendo todas las variables de estado.
 */
async function initGame() {
  // Detener cronómetro anterior si existía
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }

  // Leer configuración de la barra superior
  const modeSelect = document.getElementById('gameMode');
  const diffSelect = document.getElementById('difficulty');
  if (modeSelect) gameState.gameMode = modeSelect.value;
  if (diffSelect) gameState.difficulty = diffSelect.value;

  gameState.currentTurn = PLAYER_WHITE;
  gameState.selectedSquare = null;
  gameState.currentValidMoves = [];
  gameState.piecesWithCaptures = [];
  gameState.isBoardLocked = false;
  gameState.isGameOver = false;
  gameState.movesHistory = [];
  gameState.viewingMoveIndex = -1;
  gameState.capturesCount = 0;
  gameState.gameStartTime = Date.now();

  // Iniciar cronómetro de duración de partida
  gameState.timerInterval = setInterval(() => {
    if (!gameState.isGameOver && gameState.gameStartTime) {
      const elapsedSec = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
      const statTime = document.getElementById('statTime');
      if (statTime) statTime.textContent = formatDuration(elapsedSec);
    }
  }, 1000);

  // Intentar inicializar partida en el backend
  try {
    const initData = await api.initNewGame(gameState.difficulty, PLAYER_WHITE);
    if (initData && initData.board) {
      gameState.board = initData.board;
      boardUI.updateServerStatus(true, 'En Línea');
    } else {
      gameState.board = createLocalInitialBoard();
    }
  } catch {
    gameState.board = createLocalInitialBoard();
    boardUI.updateServerStatus(false, 'Sin Conexión');
  }

  // Actualizar marcadores y docket
  const counts = countPiecesLocal(gameState.board);
  boardUI.updateScoreboard(counts, gameState.currentTurn, gameState.gameMode);
  boardUI.renderMovesDocket(gameState.movesHistory);

  // Actualizar piezas obligadas a capturar para el primer turno
  await refreshCapturesForCurrentPlayer();

  // Renderizar el tablero inicial en el DOM
  boardUI.renderBoard(
    gameState.board,
    handleSquareClick,
    gameState.piecesWithCaptures
  );
}

/**
 * Detecta qué piezas del jugador activo tienen capturas obligatorias disponibles.
 */
async function refreshCapturesForCurrentPlayer() {
  gameState.piecesWithCaptures = [];

  try {
    const data = await api.fetchValidMoves(gameState.board, null, null, gameState.currentTurn);
    if (data && data.success && data.mustCapture && Array.isArray(data.validMoves)) {
      // Extraer las casillas de origen de las capturas obligatorias
      const captureOrigins = new Map();
      data.validMoves.forEach(m => {
        if (m.isCapture && m.from) {
          const key = `${m.from.row},${m.from.col}`;
          captureOrigins.set(key, { row: m.from.row, col: m.from.col });
        }
      });
      gameState.piecesWithCaptures = Array.from(captureOrigins.values());
    }
  } catch (err) {
    console.warn('No se pudo verificar captura obligatoria en el backend:', err.message);
  }
}

/**
 * 2. Manejador de clics en las casillas del tablero.
 * Implementa la máquina de estados para selección de fichas y ejecución de jugadas.
 * 
 * @param {number} row 
 * @param {number} col 
 */
async function handleSquareClick(row, col) {
  // Si el tablero está bloqueado (animación en curso o IA pensando), ignorar clics
  if (gameState.isBoardLocked || gameState.isGameOver) return;

  // Si se estaba visualizando un movimiento histórico anterior, volver al último
  if (gameState.viewingMoveIndex !== -1) {
    viewHistoricalMove(gameState.movesHistory.length - 1);
  }

  // CASO 1: Si ya hay una pieza seleccionada y el usuario hace clic en una de sus casillas destino válidas
  if (gameState.selectedSquare && Array.isArray(gameState.currentValidMoves) && gameState.currentValidMoves.length > 0) {
    const matchingMove = gameState.currentValidMoves.find(
      m => m.to && m.to.row === row && m.to.col === col
    );

    if (matchingMove) {
      await executePlayerMove(matchingMove);
      return;
    }
  }

  const piece = gameState.board[row][col];
  const isPieceOfCurrentPlayer = (gameState.currentTurn === PLAYER_WHITE && piece > 0) ||
                                (gameState.currentTurn === PLAYER_BLACK && piece < 0);

  // CASO 2: El usuario hace clic en una de sus piezas (selección o cambio de selección)
  if (isPieceOfCurrentPlayer) {
    // Si hace clic en la misma pieza ya seleccionada, alternar/deseleccionar
    if (gameState.selectedSquare && gameState.selectedSquare.row === row && gameState.selectedSquare.col === col) {
      boardUI.clearHighlights();
      gameState.selectedSquare = null;
      gameState.currentValidMoves = [];
      return;
    }

    // Regla de captura obligatoria: Si hay capturas forzadas, solo se puede elegir piezas con capturas
    if (gameState.piecesWithCaptures.length > 0) {
      const canThisPieceCapture = gameState.piecesWithCaptures.some(
        p => p.row === row && p.col === col
      );

      if (!canThisPieceCapture) {
        // Indicar visualmente al usuario que debe capturar
        boardUI.clearHighlights();
        gameState.selectedSquare = null;
        gameState.currentValidMoves = [];
        const sq = boardUI.getSquareElement(row, col);
        if (sq) {
          sq.classList.add('selected-square');
          setTimeout(() => sq.classList.remove('selected-square'), 400);
        }
        return;
      }
    }

    // Seleccionar la pieza y consultar sus movimientos válidos
    gameState.selectedSquare = { row, col };
    boardUI.highlightSelected(row, col);

    try {
      const movesData = await api.fetchValidMoves(
        gameState.board,
        row,
        col,
        gameState.currentTurn
      );

      if (movesData && movesData.success && Array.isArray(movesData.validMoves)) {
        gameState.currentValidMoves = movesData.validMoves;
        boardUI.showValidMoves(gameState.currentValidMoves, (selectedMove) => {
          executePlayerMove(selectedMove);
        });
      }
    } catch (error) {
      console.error('Error al obtener movimientos válidos:', error);
    }
    return;
  }

  // CASO 3: El usuario hace clic en una casilla vacía no válida u otra pieza que no es de su turno
  boardUI.clearHighlights();
  gameState.selectedSquare = null;
  gameState.currentValidMoves = [];
}

/**
 * 3. Ejecuta el movimiento elegido por el jugador humano.
 * 
 * @param {object} move Objeto jugada con from, to, captures, isCapture, isKingPromotion.
 */
async function executePlayerMove(move) {
  if (gameState.isBoardLocked || gameState.isGameOver) return;

  // Bloquear el tablero durante la animación
  gameState.isBoardLocked = true;
  gameState.selectedSquare = null;
  gameState.currentValidMoves = [];
  boardUI.clearHighlights();

  const boardBefore = gameState.board.map(r => [...r]);

  // Ejecutar animación en el DOM
  await boardUI.animateMoveSequence(move);

  // Aplicar movimiento autoritativo en el backend si hay conexión
  let resultingBoard = null;
  try {
    const applyRes = await api.applyMoveOnServer(gameState.board, gameState.currentTurn, move);
    if (applyRes && applyRes.success && applyRes.resultingBoard) {
      resultingBoard = applyRes.resultingBoard;
    }
  } catch (err) {
    console.warn('Aplicando movimiento de forma local:', err.message);
  }

  // Si no se obtuvo del backend, aplicar localmente
  if (!resultingBoard) {
    resultingBoard = applyMoveLocally(gameState.board, move);
  }

  gameState.board = resultingBoard;

  if (move.isCapture && move.captures) {
    gameState.capturesCount += move.captures.length;
  }

  // Registrar en el historial de la partida
  gameState.movesHistory.push({
    ...move,
    player: gameState.currentTurn,
    boardBefore,
    boardAfter: gameState.board.map(r => [...r])
  });

  boardUI.renderMovesDocket(gameState.movesHistory, gameState.movesHistory.length - 1);

  // Actualizar marcador
  const counts = countPiecesLocal(gameState.board);
  boardUI.updateScoreboard(counts, gameState.currentTurn, gameState.gameMode);

  // Verificar fin de partida para el oponente
  const nextPlayer = -gameState.currentTurn;
  const isEnd = await checkEndCondition(gameState.board, nextPlayer);
  if (isEnd) return;

  // Alternar turno
  gameState.currentTurn = nextPlayer;
  boardUI.updateTurnBanner(gameState.currentTurn, gameState.gameMode);

  // Si estamos en modo IA y es el turno de las piezas oscuras
  if (gameState.gameMode === 'ai' && gameState.currentTurn === PLAYER_BLACK) {
    await triggerAiTurn();
  } else {
    // Si es turno del jugador humano (o modo PvP)
    await refreshCapturesForCurrentPlayer();
    boardUI.renderBoard(
      gameState.board,
      handleSquareClick,
      gameState.piecesWithCaptures
    );
    gameState.isBoardLocked = false;
  }
}

/**
 * Aplica un movimiento sobre el tablero de manera local.
 * 
 * @param {number[][]} board 
 * @param {object} move 
 * @returns {number[][]}
 */
function applyMoveLocally(board, move) {
  const newBoard = board.map(r => [...r]);
  const { from, to, captures = [] } = move;

  let piece = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = 0;

  // Eliminar capturas
  captures.forEach(c => {
    newBoard[c.row][c.col] = 0;
  });

  // Evaluar coronación a Rey
  const isP1Crown = piece === 1 && to.row === 0;
  const isP2Crown = piece === -1 && to.row === 7;

  if (isP1Crown || (piece > 0 && move.isKingPromotion)) {
    piece = 2;
  } else if (isP2Crown || (piece < 0 && move.isKingPromotion)) {
    piece = -2;
  }

  newBoard[to.row][to.col] = piece;
  return newBoard;
}

/**
 * 4. Gestiona el turno del Agente Inteligente (Minimax Alfa-Beta).
 */
async function triggerAiTurn() {
  gameState.isBoardLocked = true;
  boardUI.setAiThinking(true);

  const startTime = Date.now();

  try {
    // Solicitar jugada óptima al motor de IA en el backend
    const aiResponse = await api.fetchAiMove(
      gameState.board,
      PLAYER_BLACK,
      gameState.difficulty
    );

    // Añadir retardo natural mínimo (350ms) para que el usuario aprecie el turno de la IA
    const elapsed = Date.now() - startTime;
    if (elapsed < 350) {
      await new Promise(resolve => setTimeout(resolve, 350 - elapsed));
    }

    boardUI.setAiThinking(false);

    if (aiResponse && aiResponse.success && aiResponse.bestMove) {
      const bestMove = aiResponse.bestMove;

      // Actualizar métricas del motor en pantalla
      if (aiResponse.metrics) {
        boardUI.updateAiMetrics(aiResponse.metrics);
      }

      const boardBefore = gameState.board.map(r => [...r]);

      // Animar movimiento de la IA
      await boardUI.animateMoveSequence(bestMove);

      // Aplicar el nuevo estado del tablero
      gameState.board = aiResponse.resultingBoard || applyMoveLocally(gameState.board, bestMove);

      if (bestMove.isCapture && bestMove.captures) {
        gameState.capturesCount += bestMove.captures.length;
      }

      // Registrar jugada de la IA
      gameState.movesHistory.push({
        ...bestMove,
        player: PLAYER_BLACK,
        boardBefore,
        boardAfter: gameState.board.map(r => [...r])
      });

      boardUI.renderMovesDocket(gameState.movesHistory, gameState.movesHistory.length - 1);

      // Actualizar marcadores
      const counts = countPiecesLocal(gameState.board);
      boardUI.updateScoreboard(counts, PLAYER_BLACK, gameState.gameMode);

      // Verificar si la partida terminó tras la jugada de la IA
      if (aiResponse.isGameOver) {
        handleGameOver(aiResponse.winner, aiResponse.reason);
        return;
      }

      const isEnd = await checkEndCondition(gameState.board, PLAYER_WHITE);
      if (isEnd) return;

      // Ceder el turno nuevamente al jugador humano
      gameState.currentTurn = PLAYER_WHITE;
      boardUI.updateTurnBanner(gameState.currentTurn, gameState.gameMode);

      await refreshCapturesForCurrentPlayer();
      boardUI.renderBoard(
        gameState.board,
        handleSquareClick,
        gameState.piecesWithCaptures
      );
      gameState.isBoardLocked = false;
    } else {
      // Si la IA no tiene jugadas disponibles, el Humano gana por bloqueo
      handleGameOver(PLAYER_WHITE, 'BLOCKED');
    }
  } catch (error) {
    boardUI.setAiThinking(false);
    console.error('Error al procesar el turno de la IA:', error);
    boardUI.updateServerStatus(false, 'Error IA');
    boardUI.renderBoard(
      gameState.board,
      handleSquareClick,
      gameState.piecesWithCaptures
    );
    gameState.isBoardLocked = false;
  }
}

/**
 * 5. Evalúa si existen condiciones de fin de partida (eliminación de fichas o bloqueo de movimientos).
 * 
 * @param {number[][]} board 
 * @param {number} playerToMove Jugador que debe mover en el siguiente turno.
 * @returns {Promise<boolean>} True si la partida concluyó.
 */
async function checkEndCondition(board, playerToMove) {
  const counts = countPiecesLocal(board);

  // 1. Victoria por eliminación total de piezas
  if (counts.player1.total === 0) {
    handleGameOver(PLAYER_BLACK, 'ELIMINATION');
    return true;
  }
  if (counts.player2.total === 0) {
    handleGameOver(PLAYER_WHITE, 'ELIMINATION');
    return true;
  }

  // 2. Verificación de bloqueo de movimientos
  try {
    const validMovesData = await api.fetchValidMoves(board, null, null, playerToMove);
    if (validMovesData && validMovesData.success && Array.isArray(validMovesData.validMoves)) {
      if (validMovesData.validMoves.length === 0) {
        // Si no tiene jugadas válidas, el oponente gana por bloqueo
        handleGameOver(-playerToMove, 'BLOCKED');
        return true;
      }
    }
  } catch (err) {
    console.warn('Verificación de fin de juego en modo offline:', err.message);
  }

  return false;
}

/**
 * Finaliza la partida desplegando el modal de estadísticas.
 * 
 * @param {number} winner Ganador (1 para Claras, -1 para Oscuras).
 * @param {string} reason Causa ('ELIMINATION', 'BLOCKED', 'RESIGN').
 */
function handleGameOver(winner, reason) {
  gameState.isGameOver = true;
  gameState.isBoardLocked = true;

  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }

  const elapsedSec = gameState.gameStartTime
    ? Math.floor((Date.now() - gameState.gameStartTime) / 1000)
    : 0;

  boardUI.showGameOverModal({
    winner,
    reason,
    movesCount: gameState.movesHistory.length,
    capturesCount: gameState.capturesCount,
    duration: formatDuration(elapsedSec),
    gameMode: gameState.gameMode,
    onPlayAgain: () => initGame()
  });
}

/**
 * 6. Manejador del botón "Rendirse" (Resign).
 */
async function handleResign() {
  if (gameState.isGameOver) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Partida finalizada',
        text: 'La partida actual ya ha terminado.',
        icon: 'info',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'damas-swal-popup',
          title: 'damas-swal-title',
          htmlContainer: 'damas-swal-html',
          confirmButton: 'damas-swal-confirm-btn',
          actions: 'damas-swal-actions'
        },
        buttonsStyling: false
      });
    }
    return;
  }

  let confirmed = false;
  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title: '¿Deseas rendirte?',
      text: '¿Estás seguro de que deseas abandonar la partida? La partida se dará por perdida.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<span class="material-symbols-outlined text-[18px] mr-1 align-middle">flag</span> Sí, rendirme',
      cancelButtonText: '<span class="material-symbols-outlined text-[18px] mr-1 align-middle">close</span> Seguir jugando',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'damas-swal-popup',
        title: 'damas-swal-title',
        htmlContainer: 'damas-swal-html',
        confirmButton: 'damas-swal-danger-btn',
        cancelButton: 'damas-swal-cancel-btn',
        actions: 'damas-swal-actions'
      },
      buttonsStyling: false
    });
    confirmed = result.isConfirmed;
  } else {
    confirmed = window.confirm('¿Estás seguro de que deseas rendirte? La partida se dará por perdida.');
  }

  if (confirmed) {
    try {
      await api.resignGame(gameState.currentTurn);
    } catch (err) {
      console.warn('Rendición procesada de forma local:', err.message);
    }
    const winner = -gameState.currentTurn;
    handleGameOver(winner, 'RESIGN');
  }
}

/**
 * 7. Inspección histórica del tablero desde el docket de jugadas.
 * 
 * @param {number} index Índice del movimiento en gameState.movesHistory.
 */
function viewHistoricalMove(index) {
  if (gameState.movesHistory.length === 0) return;

  const boundedIndex = Math.max(0, Math.min(index, gameState.movesHistory.length - 1));
  gameState.viewingMoveIndex = boundedIndex;

  const historyItem = gameState.movesHistory[boundedIndex];
  if (historyItem && historyItem.boardAfter) {
    boardUI.clearHighlights();
    boardUI.renderBoard(historyItem.boardAfter, () => {}, []);
    boardUI.renderMovesDocket(gameState.movesHistory, boundedIndex);

    // Si no estamos en el último movimiento, bloquear el tablero
    gameState.isBoardLocked = (boundedIndex !== gameState.movesHistory.length - 1);
  }
}

/**
 * 8. Genera la notación PDN (Portable Draughts Notation) de la partida y la copia al portapapeles.
 */
async function copyPdnToClipboard() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const resultStr = gameState.isGameOver
    ? (gameState.movesHistory.length % 2 === 1 ? '1-0' : '0-1')
    : '*';

  let pdn = `[Event "Partida Damas 8x8 con IA"]\n`;
  pdn += `[Site "Damas.io Web"]\n`;
  pdn += `[Date "${dateStr}"]\n`;
  pdn += `[White "Humano"]\n`;
  pdn += `[Black "${gameState.gameMode === 'ai' ? 'Motor Minimax Alfa-Beta' : 'Jugador 2'}"]\n`;
  pdn += `[Result "${resultStr}"]\n\n`;

  for (let i = 0; i < gameState.movesHistory.length; i += 2) {
    const round = Math.floor(i / 2) + 1;
    const w = boardUI.formatMoveNotation(gameState.movesHistory[i]);
    const b = gameState.movesHistory[i + 1] ? boardUI.formatMoveNotation(gameState.movesHistory[i + 1]) : '';
    pdn += `${round}. ${w} ${b} `.trim() + '\n';
  }

  try {
    await navigator.clipboard.writeText(pdn);
    const btn = document.getElementById('btnCopyPdn');
    if (btn) {
      const prevText = btn.innerHTML;
      btn.innerHTML = `<span class="material-symbols-outlined text-[13px]">check</span><span>Copiado</span>`;
      setTimeout(() => { btn.innerHTML = prevText; }, 2000);
    }
  } catch {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Notación PDN',
        text: 'Copia el texto PDN a continuación:',
        input: 'textarea',
        inputValue: pdn,
        confirmButtonText: 'Cerrar',
        customClass: {
          popup: 'damas-swal-popup',
          title: 'damas-swal-title',
          htmlContainer: 'damas-swal-html',
          confirmButton: 'damas-swal-confirm-btn',
          actions: 'damas-swal-actions'
        },
        buttonsStyling: false
      });
    } else {
      alert('No se pudo copiar automáticamente. Aquí está tu PDN:\n\n' + pdn);
    }
  }
}

/**
 * 9. Registro de event listeners del DOM.
 */
function setupEventListeners() {
  // Botón Nueva Partida
  const btnNewGame = document.getElementById('btnNewGame');
  if (btnNewGame) {
    btnNewGame.addEventListener('click', async () => {
      if (!gameState.isGameOver && gameState.movesHistory.length > 0) {
        let confirmed = false;
        if (typeof Swal !== 'undefined') {
          const result = await Swal.fire({
            title: '¿Reiniciar partida?',
            text: 'Tienes una partida en curso. ¿Deseas descartar el progreso actual y comenzar una nueva partida?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<span class="material-symbols-outlined text-[18px] mr-1 align-middle">restart_alt</span> Nueva Partida',
            cancelButtonText: '<span class="material-symbols-outlined text-[18px] mr-1 align-middle">close</span> Continuar Partida',
            reverseButtons: true,
            focusCancel: true,
            customClass: {
              popup: 'damas-swal-popup',
              title: 'damas-swal-title',
              htmlContainer: 'damas-swal-html',
              confirmButton: 'damas-swal-confirm-btn',
              cancelButton: 'damas-swal-cancel-btn',
              actions: 'damas-swal-actions'
            },
            buttonsStyling: false
          });
          confirmed = result.isConfirmed;
        } else {
          confirmed = window.confirm('¿Deseas reiniciar la partida en curso?');
        }

        if (confirmed) {
          initGame();
        }
      } else {
        initGame();
      }
    });
  }

  // Botón Rendirse
  const btnResign = document.getElementById('btnResign');
  if (btnResign) {
    btnResign.addEventListener('click', handleResign);
  }

  // Selector de Modo de Juego
  const gameModeSelect = document.getElementById('gameMode');
  const difficultyGroup = document.getElementById('difficultyGroup');
  if (gameModeSelect) {
    gameModeSelect.addEventListener('change', async (e) => {
      const newMode = e.target.value;
      if (!gameState.isGameOver && gameState.movesHistory.length > 0) {
        let confirmed = false;
        if (typeof Swal !== 'undefined') {
          const result = await Swal.fire({
            title: '¿Cambiar modo de juego?',
            text: 'Cambiar el modo reiniciará la partida en curso. ¿Deseas continuar?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            focusCancel: true,
            customClass: {
              popup: 'damas-swal-popup',
              title: 'damas-swal-title',
              htmlContainer: 'damas-swal-html',
              confirmButton: 'damas-swal-confirm-btn',
              cancelButton: 'damas-swal-cancel-btn',
              actions: 'damas-swal-actions'
            },
            buttonsStyling: false
          });
          confirmed = result.isConfirmed;
        } else {
          confirmed = window.confirm('Cambiar el modo reiniciará la partida en curso. ¿Deseas continuar?');
        }

        if (!confirmed) {
          gameModeSelect.value = gameState.gameMode;
          return;
        }
      }

      gameState.gameMode = newMode;
      if (difficultyGroup) {
        difficultyGroup.style.display = gameState.gameMode === 'pvp' ? 'none' : 'flex';
      }
      initGame();
    });
  }

  // Selector de Dificultad
  const difficultySelect = document.getElementById('difficulty');
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      gameState.difficulty = e.target.value;
    });
  }

  // Controles de Navegación del Historial en el Docket
  const btnFirst = document.getElementById('btnFirstMove');
  const btnPrev = document.getElementById('btnPrevMove');
  const btnNext = document.getElementById('btnNextMove');
  const btnLast = document.getElementById('btnLastMove');

  if (btnFirst) btnFirst.addEventListener('click', () => viewHistoricalMove(0));
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      const target = (gameState.viewingMoveIndex === -1 ? gameState.movesHistory.length - 1 : gameState.viewingMoveIndex) - 1;
      viewHistoricalMove(target);
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const target = (gameState.viewingMoveIndex === -1 ? gameState.movesHistory.length - 1 : gameState.viewingMoveIndex) + 1;
      viewHistoricalMove(target);
    });
  }
  if (btnLast) {
    btnLast.addEventListener('click', () => {
      viewHistoricalMove(gameState.movesHistory.length - 1);
    });
  }

  // Botón Copiar PDN
  const btnCopyPdn = document.getElementById('btnCopyPdn');
  if (btnCopyPdn) {
    btnCopyPdn.addEventListener('click', copyPdnToClipboard);
  }

  // Comprobación periódica de salud del servidor cada 15 segundos
  setInterval(async () => {
    const status = await api.checkServerStatus();
    boardUI.updateServerStatus(status.isOnline);
  }, 15000);
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initGame();
});
