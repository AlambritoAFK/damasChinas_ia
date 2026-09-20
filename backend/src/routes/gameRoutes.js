/**
 * Enrutador de Express para la API REST del juego de damas 8x8 (gameRoutes.js).
 * 
 * Mapea los endpoints HTTP a los métodos del controlador gameController.
 * Admite tanto el prefijo relativo como la ruta absoluta para compatibilidad
 * con montaje en app.use('/api/game', router) o app.use('/', router).
 */

const express = require('express');
const router = express.Router();

const {
  healthCheck,
  newGame,
  getValidMoves,
  getAiMove,
  applyPlayerMove,
  resignGame
} = require('./gameController');

// 1. Verificación de estado del servidor
router.get(['/health', '/api/game/health'], healthCheck);

// 2. Inicialización de nueva partida
router.post(['/new', '/api/game/new'], newGame);

// 3. Consulta de movimientos legales para una pieza o jugador
router.post(['/valid-moves', '/api/game/valid-moves'], getValidMoves);

// 4. Cálculo del movimiento óptimo para el agente de IA
router.post(['/ai-move', '/api/game/ai-move'], getAiMove);

// 5. Aplicación y validación de jugadas en el servidor
router.post(['/apply-move', '/api/game/apply-move'], applyPlayerMove);

// 6. Rendición voluntaria de la partida
router.post(['/resign', '/api/game/resign'], resignGame);

module.exports = router;
