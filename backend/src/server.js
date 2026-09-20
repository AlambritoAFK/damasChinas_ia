/**
 * Servidor Principal de la Aplicación de Damas 8x8 con IA (server.js).
 * 
 * Punto de entrada del backend en Express. Configura middlewares globales (CORS,
 * express.json, express.static), monta las rutas REST bajo el prefijo /api/game,
 * maneja errores centralizados y arranca la escucha en el puerto configurado.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const gameRoutes = require('./routes/gameRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para plataformas en la nube (Render, Railway, Fly.io)
app.set('trust proxy', 1);

// 1. Middlewares globales de rendimiento y seguridad
app.use(compression());
app.use(cors());
app.use(express.json());

// Limitador de tasa global: 300 peticiones por ventana de 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo en unos minutos.'
  }
});
app.use('/api', globalLimiter);

// Limitador especializado para cálculo de IA: 60 peticiones por minuto por IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Has alcanzado el límite de cálculos de IA por minuto. Por favor espera un momento.'
  }
});
app.use('/api/game/ai-move', aiLimiter);

// 2. Servir archivos estáticos del frontend (si están presentes)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// 3. Montaje de rutas de la API de juego
app.use('/api/game', gameRoutes);

// 4. Ruta informativa raíz de la API
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'Damas 8x8 con IA - API REST',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/game/health',
      newGame: 'POST /api/game/new',
      validMoves: 'POST /api/game/valid-moves',
      aiMove: 'POST /api/game/ai-move',
      applyMove: 'POST /api/game/apply-move',
      resign: 'POST /api/game/resign'
    }
  });
});

// 5. Middleware para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// 6. Middleware centralizado para manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no controlado en el servidor:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

// 7. Arranque del servidor si se ejecuta directamente
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log('========================================================');
    console.log(' Servidor de Damas 8x8 con Agente de Inteligencia Artificial');
    console.log(` Puerto activo: ${PORT}`);
    console.log(` Healthcheck: http://localhost:${PORT}/api/game/health`);
    console.log('========================================================');
  });
}

module.exports = app;
