/**
 * frontend/js/api.js
 * 
 * Paso 13: Cliente HTTP REST para el juego de damas 8x8 con IA.
 * Encapsula la comunicación con la API de Express mediante fetch().
 * 
 * Regla de diseño: Desacoplamiento estricto (no interactúa con el DOM).
 */

/**
 * Determina dinámicamente la URL base del backend.
 * Si la aplicación se sirve desde el propio servidor Express (puerto 3000),
 * se utiliza el origen actual. Si se abre mediante Live Server (puertos 5500, 8080, etc.)
 * o como archivo local (file://), recurre por defecto a http://localhost:3000.
 */
let API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (protocol === 'http:' || protocol === 'https:') {
      // Si el puerto actual es 3000 o si no hay puerto específico (proxy inverso / prod)
      if (port === '3000' || port === '') {
        return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
      }
      // Si se sirve desde otro puerto local (ej. Live Server en 5500/8080), conectar al backend en 3000
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:3000`;
      }
    }
  }
  return 'http://localhost:3000';
})();

/**
 * Permite reconfigurar manualmente la URL base si es necesario.
 * @param {string} url 
 */
export function setApiBaseUrl(url) {
  API_BASE_URL = url.replace(/\/+$/, '');
}

/**
 * Retorna la URL base configurada actualmente.
 * @returns {string}
 */
export function getApiBaseUrl() {
  return API_BASE_URL;
}

/**
 * Función auxiliar para realizar peticiones HTTP seguras con timeout y manejo de errores.
 * 
 * @param {string} endpoint Ruta del endpoint (ej. '/api/game/health').
 * @param {object} options Opciones para fetch().
 * @param {number} timeoutMs Límite de tiempo en milisegundos (por defecto 10000ms).
 * @returns {Promise<any>} Respuesta parseada en JSON.
 */
async function apiRequest(endpoint, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = (data && data.error) ? data.error : `Error HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      const timeoutErr = new Error(`Tiempo de espera agotado al consultar ${endpoint}`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    // Si es un error de red (servidor apagado, CORS bloqueado, etc.)
    if (!error.status) {
      error.isNetworkError = true;
    }

    throw error;
  }
}

/**
 * 1. Verifica el estado de salud y conectividad del servidor backend.
 * Endpoint: GET /api/game/health
 * 
 * @param {number} timeoutMs Tiempo de espera reducido para sondeo rápido (por defecto 3000ms).
 * @returns {Promise<{ isOnline: boolean, data?: any, error?: string }>}
 */
export async function checkServerStatus(timeoutMs = 3000) {
  try {
    const data = await apiRequest('/api/game/health', { method: 'GET' }, timeoutMs);
    return {
      isOnline: Boolean(data && data.success),
      data
    };
  } catch (error) {
    return {
      isOnline: false,
      error: error.message || 'No se pudo contactar al servidor de backend'
    };
  }
}

/**
 * 2. Inicializa una nueva partida en el servidor y obtiene el tablero 8x8 inicial.
 * Endpoint: POST /api/game/new
 * 
 * @param {string} difficulty Dificultad ('easy', 'medium', 'hard').
 * @param {number} startingPlayer Jugador que inicia (1 para Humano, -1 para IA).
 * @returns {Promise<{
 *   success: boolean,
 *   board: number[][],
 *   currentTurn: number,
 *   pieceCounts: object,
 *   difficulty: string,
 *   difficultyName: string
 * }>}
 */
export async function initNewGame(difficulty = 'medium', startingPlayer = 1) {
  return await apiRequest('/api/game/new', {
    method: 'POST',
    body: JSON.stringify({
      difficulty,
      startingPlayer
    })
  });
}

/**
 * 3. Consulta los movimientos válidos para una pieza o para todo el jugador activo.
 * Aplica estrictamente la regla de captura obligatoria desde el backend.
 * Endpoint: POST /api/game/valid-moves
 * 
 * @param {number[][]} board Matriz 8x8 actual.
 * @param {number|null} row Fila de la pieza (opcional si se consulta por jugador).
 * @param {number|null} col Columna de la pieza (opcional si se consulta por jugador).
 * @param {number|null} player Identificador del jugador (1 o -1).
 * @returns {Promise<{
 *   success: boolean,
 *   piece?: number,
 *   player: number,
 *   validMoves: Array<object>,
 *   hasCapture: boolean,
 *   mustCapture: boolean
 * }>}
 */
export async function fetchValidMoves(board, row = null, col = null, player = null) {
  const payload = { board };

  if (row !== null && col !== null && row !== undefined && col !== undefined) {
    payload.row = row;
    payload.col = col;
  }
  if (player !== null && player !== undefined) {
    payload.player = player;
  }

  return await apiRequest('/api/game/valid-moves', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * 4. Solicita al agente inteligente el cálculo de su mejor movimiento mediante Minimax Alfa-Beta.
 * Endpoint: POST /api/game/ai-move
 * 
 * @param {number[][]} board Matriz 8x8 actual.
 * @param {number} player Jugador de la IA (por defecto -1).
 * @param {string} difficulty Nivel de dificultad ('easy', 'medium', 'hard').
 * @param {object} options Opciones adicionales de simulación o heurística.
 * @returns {Promise<{
 *   success: boolean,
 *   bestMove: object|null,
 *   resultingBoard: number[][],
 *   isGameOver: boolean,
 *   winner: number|null,
 *   reason: string|null,
 *   metrics: {
 *     nodesEvaluated: number,
 *     depth: number,
 *     timeMs: number,
 *     prunedBranches: number,
 *     score: number,
 *     difficulty: string,
 *     difficultyName: string
 *   }
 * }>}
 */
export async function fetchAiMove(board, player = -1, difficulty = 'medium', options = {}) {
  // Se extiende el timeout a 15s para dar margen a cálculos a profundidad alta
  return await apiRequest('/api/game/ai-move', {
    method: 'POST',
    body: JSON.stringify({
      board,
      player,
      difficulty,
      options
    })
  }, 15000);
}

/**
 * 5. Valida y aplica autoritativamente un movimiento en el servidor.
 * Endpoint: POST /api/game/apply-move
 * 
 * @param {number[][]} board Matriz 8x8 actual.
 * @param {number} player Jugador que ejecuta el movimiento (1 o -1).
 * @param {object} move Objeto de movimiento con from y to.
 * @returns {Promise<{
 *   success: boolean,
 *   move: object,
 *   resultingBoard: number[][],
 *   pieceCounts: object,
 *   isGameOver: boolean,
 *   winner: number|null,
 *   reason: string|null
 * }>}
 */
export async function applyMoveOnServer(board, player, move) {
  return await apiRequest('/api/game/apply-move', {
    method: 'POST',
    body: JSON.stringify({
      board,
      player,
      move
    })
  });
}

/**
 * 6. Notifica la rendición voluntaria del jugador al backend.
 * Endpoint: POST /api/game/resign
 * 
 * @param {number} player Jugador que se rinde (1 o -1).
 * @returns {Promise<{
 *   success: boolean,
 *   isGameOver: boolean,
 *   winner: number,
 *   reason: string,
 *   message: string
 * }>}
 */
export async function resignGame(player = 1) {
  return await apiRequest('/api/game/resign', {
    method: 'POST',
    body: JSON.stringify({ player })
  });
}
