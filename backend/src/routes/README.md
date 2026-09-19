# Módulo de Rutas y Controladores REST (`backend/src/routes/`)

## 1. Propósito del Directorio
Este directorio define la **capa de transporte y comunicación HTTP** del backend. Expone los endpoints REST para que la interfaz gráfica (frontend) pueda interactuar con el motor del juego y solicitar las jugadas calculadas por el agente de Inteligencia Artificial.

---

## 2. Archivos que Contendrá y Responsabilidades

### `gameRoutes.js`
- **Responsabilidad**: Enrutador de Express (`express.Router()`) que mapea las URLs y métodos HTTP a sus respectivas funciones controladoras.
- **Endpoints a exponer**:
  - `POST /api/game/new`: Inicializa una nueva partida, devolviendo el tablero inicial $8 \times 8$, el turno inicial y la configuración.
  - `POST /api/game/valid-moves`: Recibe el estado actual del tablero y las coordenadas de una pieza; retorna los movimientos legales y saltos obligatorios disponibles.
  - `POST /api/game/ai-move`: Recibe el tablero actual, el jugador activo y la dificultad deseada; procesa la búsqueda con el agente de IA y devuelve el mejor movimiento elegido junto con métricas de búsqueda (tiempo de respuesta y profundidad evaluada).
  - `GET /api/game/health`: Endpoint ligero de verificación de estado y conectividad del servidor.

### `gameController.js`
- **Responsabilidad**: Controlador que contiene la lógica de negocio HTTP:
  - Extrae y valida los parámetros de `req.body` (validando que el tablero tenga formato de matriz $8 \times 8$ válido).
  - Orquesta las llamadas a `board.js`, `moveGenerator.js`, `rules.js` y `alphaBeta.js`.
  - Maneja excepciones y errores con códigos de estado HTTP semánticos (400 Bad Request, 500 Internal Server Error).
  - Retorna respuestas JSON limpias y estructuradas.

---

## 3. Formato de Payloads JSON Esperados

### Petición `POST /api/game/ai-move`
```json
{
  "board": [[0, -1, 0, -1, ...], ...],
  "player": -1,
  "difficulty": "medium"
}
```

### Respuesta `200 OK`
```json
{
  "success": true,
  "bestMove": {
    "from": { "row": 2, "col": 3 },
    "to": { "row": 4, "col": 5 },
    "captures": [{ "row": 3, "col": 4 }],
    "isKingPromotion": false
  },
  "metrics": {
    "nodesEvaluated": 1240,
    "depth": 4,
    "timeMs": 45
  }
}
```

---

## 4. Instrucciones para el Agente de IA para su Construcción

Al construir este módulo, el agente de IA debe seguir estas pautas:
1. **Validación Exhaustiva de Entrada**:
   - Nunca asumir que el cliente envía datos correctos. Validar que la propiedad `board` sea un array de longitud 8 compuesto de arrays de longitud 8, y que los valores numéricos correspondan a piezas válidas.
2. **CORS y Middlewares**:
   - Asegurar que la API tenga habilitado el middleware de CORS para admitir peticiones desde el frontend, e incluir `express.json()` para parsear cuerpos de petición.
3. **Métricas en la Respuesta**:
   - Incluir datos de diagnóstico (`nodesEvaluated`, `timeMs`) en la respuesta de `ai-move`. Esto es fundamental para que el estudiante pueda justificar el desempeño del algoritmo ante las preguntas del profesor descritas en la rúbrica.
