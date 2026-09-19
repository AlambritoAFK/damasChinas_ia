# Módulo de Lógica e Interacción del Cliente (`frontend/js/`)

## 1. Propósito del Directorio
Este directorio contiene la **lógica de cliente en JavaScript moderno (ES6+)**. Se encarga de gestionar el estado interactivo de la partida, coordinar la captura de eventos del usuario, renderizar el tablero en el DOM y comunicarse asíncronamente con la API REST del backend para obtener las jugadas de la Inteligencia Artificial.

---

## 2. Archivos que Contendrá y Responsabilidades

### `api.js`
- **Responsabilidad**: Cliente de red que encapsula las llamadas HTTP mediante `fetch()`.
- **Funciones clave**:
  - `fetchAiMove(board, player, difficulty)`: Envía el estado del tablero al endpoint `POST /api/game/ai-move` y retorna la jugada óptima calculada por Minimax Alfa-Beta.
  - `fetchValidMoves(board, row, col)`: Consulta los movimientos válidos para una pieza específica desde `POST /api/game/valid-moves`.
  - `checkServerStatus()`: Verifica la disponibilidad del backend mediante `GET /api/game/health`.
  - Manejo robusto de errores de red con mensajes claros en la UI si el servidor está apagado o no responde.

### `boardUI.js`
- **Responsabilidad**: Manipulación directa del Document Object Model (DOM) del tablero.
- **Funciones clave**:
  - `renderBoard(board)`: Dibuja las 64 casillas del tablero y posiciona las piezas (peones y reyes de ambos bandos).
  - `highlightSelected(row, col)`: Aplica clases visuales a la pieza activa.
  - `showValidMoves(moves)`: Muestra los indicadores visuales en las casillas a las que el jugador puede desplazarse o saltar.
  - `clearHighlights()`: Limpia selecciones y marcadores de jugadas anteriores.
  - `animateMove(from, to, onComplete)`: Reproduce la animación de traslación de la ficha.
  - `updateScoreboard(pieceCounts, currentTurn)`: Actualiza en pantalla las fichas restantes de cada bando y el indicador de turno.

### `app.js`
- **Responsabilidad**: Orquestador principal del juego en el cliente (*Game Controller*).
- **Funciones clave**:
  - `initGame()`: Inicializa el estado local (tablero inicial, turno del jugador blanco/rojo, dificultad seleccionada y modo de juego).
  - `handleSquareClick(row, col)`: Máquina de estados para la selección de fichas y ejecución del movimiento del jugador humano.
  - `executePlayerMove(move)`: Aplica el movimiento, valida si hay saltos múltiples obligatorios pendientes para la misma ficha o si finaliza el turno.
  - `triggerAiTurn()`: Muestra el indicador de "IA pensando...", solicita la jugada a `api.js` y ejecuta el movimiento retornado con un retardo natural para simular reflexión.
  - `handleResign()`: Permite al jugador rendirse voluntariamente, finalizando la partida con derrota para el jugador activo.
  - `checkEndCondition()`: Evalúa condiciones de victoria/derrota y despliega el modal correspondiente.

---

## 3. Instrucciones para el Agente de IA para su Construcción

Al construir este módulo, el agente de IA debe seguir estas pautas:
1. **Desacoplamiento Estricto**:
   - `api.js` no debe tocar el DOM.
   - `boardUI.js` no debe hacer cálculos matemáticos de IA ni peticiones de red.
   - `app.js` actúa como el mediador central conectando la UI con la API.
2. **Bloqueo de Interfaz Durante el Turno de la IA**:
   - Mientras el agente de IA esté procesando su jugada, deshabilitar los clics del usuario en el tablero para evitar condiciones de carrera o inconsistencias de estado.
3. **Manejo de Saltos Múltiples del Humano**:
   - Si tras una captura la misma ficha tiene otro salto obligatorio consecutivo, no ceder el turno a la IA; obligar al jugador a continuar la secuencia de captura hasta completarla.
