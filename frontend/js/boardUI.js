/**
 * frontend/js/boardUI.js
 * 
 * Paso 14: Renderizador y Manipulador del DOM para el tablero 8x8 de damas.
 * Gestiona el dibujo de casillas, piezas 3D, coronas de rey, estados de selección,
 * pips de destino, animaciones de movimiento/captura/coronación y actualización
 * de paneles informativos (marcador, turnos, docket y modal de fin de juego).
 * 
 * Regla de diseño: Exclusivamente responsable de la presentación y manipulación del DOM.
 */

const BOARD_SIZE = 8;

/**
 * Convierte coordenadas (row, col) a notación algebraica (ej. 7,0 -> A1; 0,1 -> B8).
 * @param {number} row 
 * @param {number} col 
 * @returns {string}
 */
export function coordToAlgebraic(row, col) {
  const colLetter = String.fromCharCode(65 + col);
  const rowNumber = 8 - row;
  return `${colLetter}${rowNumber}`;
}

/**
 * Convierte notación algebraica (ej. 'A1', 'B8') a coordenadas { row, col }.
 * @param {string} notation 
 * @returns {{ row: number, col: number } | null}
 */
export function algebraicToCoord(notation) {
  if (!notation || notation.length < 2) return null;
  const col = notation.toUpperCase().charCodeAt(0) - 65;
  const row = 8 - parseInt(notation.slice(1), 10);
  if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
    return { row, col };
  }
  return null;
}

/**
 * 1. Dibuja el tablero 8x8 completo y posiciona las piezas.
 * 
 * @param {number[][]} board Matriz 8x8 del tablero.
 * @param {Function} onSquareClick Callback invocado al hacer clic en una casilla (row, col).
 * @param {Array<{row: number, col: number}>} piecesWithCaptures Lista de piezas con captura obligatoria.
 */
export function renderBoard(board, onSquareClick, piecesWithCaptures = []) {
  const boardGrid = document.getElementById('checkersBoard');
  if (!boardGrid) return;

  // Limpiar contenido existente del tablero
  boardGrid.innerHTML = '';

  const mustCaptureSet = new Set(
    piecesWithCaptures.map(p => `${p.row},${p.col}`)
  );

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const isDark = (r + c) % 2 === 1;
      const coord = coordToAlgebraic(r, c);

      const square = document.createElement('div');
      square.className = `board-square ${isDark ? 'square-dark' : 'square-light'}`;
      square.dataset.row = r;
      square.dataset.col = c;
      square.dataset.coord = coord;

      // Las casillas oscuras son jugables y escuchan eventos de clic
      if (isDark) {
        square.addEventListener('click', (e) => {
          e.stopPropagation();
          onSquareClick(r, c);
        });
      }

      const pieceValue = board[r][c];

      // Si hay una pieza en la casilla
      if (pieceValue !== 0) {
        const isWhite = pieceValue > 0;
        const isKing = Math.abs(pieceValue) === 2;
        const isMustCapture = mustCaptureSet.has(`${r},${c}`);

        const pieceEl = document.createElement('div');
        pieceEl.className = `checker-piece ${isWhite ? 'piece-light' : 'piece-dark'}${isKing ? ' piece-king' : ''}${isMustCapture ? ' must-capture' : ''}`;
        pieceEl.dataset.piece = pieceValue;

        const ringOuter = document.createElement('div');
        ringOuter.className = 'ring-outer';

        const ringInner = document.createElement('div');
        ringInner.className = 'ring-inner';

        if (isKing) {
          const crown = document.createElement('span');
          crown.className = 'crown-icon';
          crown.textContent = 'crown';
          ringInner.appendChild(crown);
        }

        ringOuter.appendChild(ringInner);
        pieceEl.appendChild(ringOuter);
        square.appendChild(pieceEl);
      }

      boardGrid.appendChild(square);
    }
  }
}

/**
 * 2. Resalta visualmente la pieza seleccionada por el usuario y su casilla.
 * 
 * @param {number} row Fila de la pieza seleccionada.
 * @param {number} col Columna de la pieza seleccionada.
 */
export function highlightSelected(row, col) {
  clearHighlights();

  const square = getSquareElement(row, col);
  if (!square) return;

  square.classList.add('selected-square');
  const piece = square.querySelector('.checker-piece');
  if (piece) {
    piece.classList.add('selected');
  }
}

/**
 * 3. Muestra los indicadores visuales (pips luminosos) en las casillas destino válidas.
 * 
 * @param {Array<object>} validMoves Lista de jugadas disponibles para la pieza.
 * @param {Function} onDestinationClick Callback que se ejecuta al pulsar sobre un destino legal.
 */
export function showValidMoves(validMoves, onDestinationClick = null) {
  // Limpiar marcadores de destinos previos conservando la selección activa
  clearMoveTargets();

  if (!Array.isArray(validMoves) || validMoves.length === 0) return;

  validMoves.forEach(move => {
    const { row, col } = move.to;
    const targetSquare = getSquareElement(row, col);
    if (!targetSquare) return;

    targetSquare.classList.add('valid-move');

    // Pip indicador de salto o movimiento
    const pip = document.createElement('div');
    pip.className = `valid-move-pip${move.isCapture ? ' capture-target' : ''}`;
    targetSquare.appendChild(pip);

    // Si se provee onDestinationClick, guardar referencia al movimiento en el elemento
    targetSquare._destinationMove = move;
  });
}

/**
 * Limpia únicamente los indicadores de casillas destino y sus listeners.
 */
export function clearMoveTargets() {
  const validSquares = document.querySelectorAll('.board-square.valid-move');
  validSquares.forEach(sq => {
    sq.classList.remove('valid-move');
    if (sq._moveClickHandler) {
      sq.removeEventListener('click', sq._moveClickHandler);
      delete sq._moveClickHandler;
    }
    delete sq._destinationMove;
    const pip = sq.querySelector('.valid-move-pip');
    if (pip) pip.remove();
  });
}

/**
 * 4. Limpia todas las selecciones y marcadores del tablero.
 */
export function clearHighlights() {
  clearMoveTargets();

  document.querySelectorAll('.board-square.selected-square').forEach(sq => {
    sq.classList.remove('selected-square');
  });

  document.querySelectorAll('.checker-piece.selected').forEach(piece => {
    piece.classList.remove('selected');
  });
}

/**
 * 5. Obtiene el elemento DOM de una casilla a partir de sus coordenadas.
 * 
 * @param {number} row 
 * @param {number} col 
 * @returns {HTMLElement|null}
 */
export function getSquareElement(row, col) {
  return document.querySelector(`.board-square[data-row="${row}"][data-col="${col}"]`);
}

/**
 * 6. Anima la secuencia completa de movimiento y capturas de una ficha.
 * Soporta traslación fluida paso a paso para saltos simples o múltiples encadenados.
 * 
 * @param {object} move Objeto de jugada con from, to, path y captures.
 * @param {Function} onStepCallback Invocado en cada salto intermedio.
 * @returns {Promise<void>}
 */
export async function animateMoveSequence(move, onStepCallback = null) {
  if (!move || !move.from || !move.to) return;

  const fromSquare = getSquareElement(move.from.row, move.from.col);
  if (!fromSquare) return;

  const pieceEl = fromSquare.querySelector('.checker-piece');
  if (!pieceEl) return;

  // Secuencia de saltos a recorrer: si no viene path, se usa [from, to]
  const path = (move.path && move.path.length > 1)
    ? move.path
    : [move.from, move.to];

  // Desvanecer fichas capturadas
  const captures = move.captures || [];
  captures.forEach(cap => {
    const capSquare = getSquareElement(cap.row, cap.col);
    if (capSquare) {
      const capPiece = capSquare.querySelector('.checker-piece');
      if (capPiece) {
        capPiece.classList.add('piece-captured');
      }
    }
  });

  // Ejecutar animación física por cada tramo del camino
  for (let i = 0; i < path.length - 1; i++) {
    const stepFrom = path[i];
    const stepTo = path[i + 1];

    const currentSquare = getSquareElement(stepFrom.row, stepFrom.col);
    const nextSquare = getSquareElement(stepTo.row, stepTo.col);

    if (currentSquare && nextSquare) {
      const fromRect = currentSquare.getBoundingClientRect();
      const toRect = nextSquare.getBoundingClientRect();
      const deltaX = toRect.left - fromRect.left;
      const deltaY = toRect.top - fromRect.top;

      pieceEl.classList.add('animating-move');
      pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      await new Promise(resolve => setTimeout(resolve, 240));

      // Reubicar el elemento en la casilla siguiente y reiniciar transform
      pieceEl.classList.remove('animating-move');
      pieceEl.style.transform = '';
      nextSquare.appendChild(pieceEl);

      if (onStepCallback) {
        onStepCallback(stepTo, i);
      }
    }
  }

  // Si hubo coronación a Rey, añadir la corona y la animación dorada
  if (move.isKingPromotion) {
    pieceEl.classList.add('piece-king', 'crowning-animation');
    const ringInner = pieceEl.querySelector('.ring-inner');
    if (ringInner && !ringInner.querySelector('.crown-icon')) {
      const crown = document.createElement('span');
      crown.className = 'crown-icon';
      crown.textContent = 'crown';
      ringInner.appendChild(crown);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    pieceEl.classList.remove('crowning-animation');
  }

  // Esperar a que concluyan las animaciones de desvanecimiento de capturas
  if (captures.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 150));
    captures.forEach(cap => {
      const capSquare = getSquareElement(cap.row, cap.col);
      if (capSquare) {
        const capPiece = capSquare.querySelector('.checker-piece.piece-captured');
        if (capPiece) capPiece.remove();
      }
    });
  }
}

/**
 * 7. Actualiza el marcador de fichas restantes, damas y piezas comidas.
 * 
 * @param {object} pieceCounts Conteo { player1: { men, kings, total }, player2: { men, kings, total } }.
 * @param {number} currentTurn Jugador con turno activo (1 o -1).
 * @param {string} gameMode Modo de juego ('ai' o 'pvp').
 */
export function updateScoreboard(pieceCounts, currentTurn, gameMode = 'ai') {
  if (!pieceCounts) return;

  const whiteCountEl = document.getElementById('whiteCount');
  const blackCountEl = document.getElementById('blackCount');
  const whiteKingsEl = document.getElementById('whiteKings');
  const blackKingsEl = document.getElementById('blackKings');
  const whiteCapturedEl = document.getElementById('whiteCaptured');
  const blackCapturedEl = document.getElementById('blackCaptured');
  const player2Badge = document.getElementById('player2TypeBadge');

  if (whiteCountEl) whiteCountEl.textContent = pieceCounts.player1.total;
  if (blackCountEl) blackCountEl.textContent = pieceCounts.player2.total;
  if (whiteKingsEl) whiteKingsEl.textContent = pieceCounts.player1.kings;
  if (blackKingsEl) blackKingsEl.textContent = pieceCounts.player2.kings;

  // Piezas comidas (12 iniciales menos el total actual)
  if (blackCapturedEl) blackCapturedEl.textContent = Math.max(0, 12 - pieceCounts.player2.total);
  if (whiteCapturedEl) whiteCapturedEl.textContent = Math.max(0, 12 - pieceCounts.player1.total);

  if (player2Badge) {
    player2Badge.textContent = gameMode === 'ai' ? 'IA' : 'Humano';
  }

  // Actualizar banner de turno
  updateTurnBanner(currentTurn, gameMode);
}

/**
 * Actualiza los textos y avatares del banner de turno.
 * 
 * @param {number} currentTurn 
 * @param {string} gameMode 
 */
export function updateTurnBanner(currentTurn, gameMode = 'ai') {
  const turnBanner = document.getElementById('turnBanner');
  const turnAvatar = document.getElementById('turnAvatar');
  const turnTitle = document.getElementById('turnTitle');
  const turnSubtitle = document.getElementById('turnSubtitle');

  if (!turnBanner || !turnAvatar || !turnTitle || !turnSubtitle) return;

  if (currentTurn === 1) {
    turnBanner.classList.remove('active-black');
    turnBanner.classList.add('active-white');

    turnAvatar.className = 'turn-avatar piece-light';
    turnTitle.className = 'turn-text-title text-primary';
    turnTitle.textContent = gameMode === 'ai' ? 'Turno: Claras (Tú)' : 'Turno: Claras (Jugador 1)';
    turnSubtitle.textContent = 'Haz clic en una de tus fichas para moverla';
  } else {
    turnBanner.classList.remove('active-white');
    turnBanner.classList.add('active-black');

    turnAvatar.className = 'turn-avatar piece-dark';
    turnTitle.className = 'turn-text-title text-secondary';
    turnTitle.textContent = gameMode === 'ai' ? 'Turno: Oscuras (IA)' : 'Turno: Oscuras (Jugador 2)';
    turnSubtitle.textContent = gameMode === 'ai'
      ? 'La IA está calculando jugada...'
      : 'Haz clic en una de tus fichas para moverla';
  }
}

/**
 * 8. Activa o desactiva la insignia de "Calculando..." de la IA.
 * 
 * @param {boolean} isThinking 
 */
export function setAiThinking(isThinking) {
  const badge = document.getElementById('aiThinkingBadge');
  if (badge) {
    badge.classList.toggle('visible', Boolean(isThinking));
  }
}

/**
 * 9. Actualiza el panel de métricas de rendimiento del algoritmo de IA.
 * 
 * @param {object} metrics { timeMs, nodesEvaluated, depth }
 */
export function updateAiMetrics(metrics) {
  if (!metrics) return;

  const timeEl = document.getElementById('aiTime');
  const nodesEl = document.getElementById('aiNodes');
  const depthEl = document.getElementById('aiDepth');

  if (timeEl && metrics.timeMs !== undefined) {
    timeEl.textContent = `${metrics.timeMs} ms`;
  }
  if (nodesEl && metrics.nodesEvaluated !== undefined) {
    nodesEl.textContent = Number(metrics.nodesEvaluated).toLocaleString();
  }
  if (depthEl && metrics.depth !== undefined) {
    depthEl.textContent = metrics.depth;
  }
}

/**
 * 10. Actualiza el indicador visual de conexión con el backend.
 * 
 * @param {boolean} isOnline 
 * @param {string} text 
 */
export function updateServerStatus(isOnline, text = null) {
  const badge = document.getElementById('serverStatus');
  const textEl = document.getElementById('serverStatusText');

  if (badge) {
    badge.classList.toggle('offline', !isOnline);
  }
  if (textEl) {
    textEl.textContent = text || (isOnline ? 'En Línea' : 'Sin Conexión');
  }
}

/**
 * 11. Renderiza el registro histórico de jugadas en el docket.
 * 
 * @param {Array<object>} movesHistory Lista de movimientos ejecutados.
 * @param {number} activeIndex Índice del movimiento activo visualizado.
 */
export function renderMovesDocket(movesHistory, activeIndex = -1) {
  const listEl = document.getElementById('movesList');
  const countEl = document.getElementById('movesCount');

  if (!listEl) return;

  if (countEl) {
    countEl.textContent = `${movesHistory.length} Movimientos`;
  }

  if (movesHistory.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-6 text-outline text-label-sm italic opacity-70">
        La partida no ha comenzado.
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  // Agrupar jugadas en rondas de 2 (Claras y Oscuras)
  for (let i = 0; i < movesHistory.length; i += 2) {
    const roundNumber = Math.floor(i / 2) + 1;
    const whiteMove = movesHistory[i];
    const blackMove = movesHistory[i + 1] || null;

    const rowEl = document.createElement('div');
    rowEl.className = 'move-row';

    if (i === activeIndex || i + 1 === activeIndex) {
      rowEl.classList.add('current-move');
    }

    const numSpan = document.createElement('span');
    numSpan.className = 'text-outline text-[11px]';
    numSpan.textContent = `${roundNumber}.`;
    rowEl.appendChild(numSpan);

    const whiteSpan = document.createElement('span');
    whiteSpan.className = 'text-primary truncate font-semibold';
    whiteSpan.textContent = whiteMove ? formatMoveNotation(whiteMove) : '—';
    rowEl.appendChild(whiteSpan);

    const blackSpan = document.createElement('span');
    blackSpan.className = 'text-secondary truncate font-semibold';
    blackSpan.textContent = blackMove ? formatMoveNotation(blackMove) : '—';
    rowEl.appendChild(blackSpan);

    listEl.appendChild(rowEl);
  }

  // Auto-scroll al final del registro
  listEl.scrollTop = listEl.scrollHeight;
}

/**
 * Formatea un movimiento a notación estándar (ej. C3-D4 o B6xC4).
 * @param {object} move 
 * @returns {string}
 */
export function formatMoveNotation(move) {
  if (!move || !move.from || !move.to) return '—';
  const fromStr = coordToAlgebraic(move.from.row, move.from.col);
  const toStr = coordToAlgebraic(move.to.row, move.to.col);
  const separator = move.isCapture ? 'x' : '-';
  const crownSuffix = move.isKingPromotion ? '♕' : '';
  return `${fromStr}${separator}${toStr}${crownSuffix}`;
}

/**
 * 12. Despliega el modal de fin de juego con estadísticas y motivo.
 * 
 * @param {object} params
 * @param {number} params.winner Ganador (1, -1 o 0 para tablas).
 * @param {string} params.reason Motivo ('ELIMINATION', 'BLOCKED', 'RESIGN', 'DRAW').
 * @param {number} params.movesCount Total de jugadas realizadas.
 * @param {number} params.capturesCount Total de fichas capturadas.
 * @param {string} params.duration Tiempo transcurrido formateado (MM:SS).
 * @param {string} params.gameMode Modo de juego ('ai' o 'pvp').
 * @param {Function} params.onPlayAgain Callback para reiniciar la partida.
 */
export function showGameOverModal({
  winner,
  reason,
  movesCount,
  capturesCount,
  duration,
  gameMode = 'ai',
  onPlayAgain
}) {
  const modal = document.getElementById('gameOverModal');
  if (!modal) return;

  const iconEl = document.getElementById('modalIcon');
  const iconWrapper = document.getElementById('modalIconWrapper');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDescription');
  const statMoves = document.getElementById('statMoves');
  const statCaptures = document.getElementById('statCaptures');
  const statTime = document.getElementById('statTime');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  if (statMoves) statMoves.textContent = movesCount;
  if (statCaptures) statCaptures.textContent = capturesCount;
  if (statTime) statTime.textContent = duration;

  // Configuración de textos e iconos según el resultado
  if (winner === 1) {
    if (titleEl) titleEl.textContent = gameMode === 'ai' ? '¡Victoria Magistral!' : '¡Victoria de Claras!';
    if (iconEl) iconEl.textContent = 'emoji_events';
    if (iconWrapper) {
      iconWrapper.style.borderColor = 'var(--primary)';
      iconWrapper.style.backgroundColor = 'rgba(255, 182, 140, 0.15)';
    }
  } else if (winner === -1) {
    if (titleEl) titleEl.textContent = gameMode === 'ai' ? 'Derrota ante la IA' : '¡Victoria de Oscuras!';
    if (iconEl) iconEl.textContent = gameMode === 'ai' ? 'smart_toy' : 'emoji_events';
    if (iconWrapper) {
      iconWrapper.style.borderColor = 'var(--secondary)';
      iconWrapper.style.backgroundColor = 'rgba(123, 208, 255, 0.15)';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Partida en Tablas';
    if (iconEl) iconEl.textContent = 'handshake';
  }

  // Descripción detallada de la causa
  let description = '';
  switch (reason) {
    case 'ELIMINATION':
      description = winner === 1
        ? 'Has capturado todas las piezas del oponente.'
        : 'Todas tus piezas han sido capturadas.';
      break;
    case 'BLOCKED':
      description = winner === 1
        ? 'El adversario no tiene movimientos legales disponibles (bloqueo total).'
        : 'No te quedan movimientos válidos en tu turno (bloqueo total).';
      break;
    case 'RESIGN':
      description = 'La partida finalizó por rendición voluntaria.';
      break;
    default:
      description = 'Fin del juego.';
  }

  if (descEl) descEl.textContent = description;

  if (btnPlayAgain && onPlayAgain) {
    btnPlayAgain.onclick = () => {
      modal.close();
      onPlayAgain();
    };
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
}
