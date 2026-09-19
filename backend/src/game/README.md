# Módulo de Reglas y Tablero (`backend/src/game/`)

## 1. Propósito del Directorio
Este directorio constituye el **núcleo de lógica pura del juego de damas** (Game Engine). Es completamente agnóstico al protocolo de comunicación (HTTP/Express) y a la interfaz gráfica. Su única responsabilidad es mantener la integridad de las reglas oficiales de las damas tradicionales (8x8), calcular movimientos válidos, validar capturas obligatorias y determinar el estado de la partida (victoria, derrota, empate).

---

## 2. Archivos que Contendrá y Responsabilidades

### `constants.js`
- **Responsabilidad**: Define constantes inmutables utilizadas en toda la lógica del juego.
- **Contenido clave**:
  - Identificadores de jugadores: `PLAYER_1` (Humano / Piezas Blancas o Rojas según configuración), `PLAYER_2` (IA / Piezas Negras).
  - Tipos de piezas: `EMPTY = 0`, `MAN = 1`, `KING = 2`.
  - Códigos numéricos de casillas: `EMPTY: 0`, `P1_MAN: 1`, `P1_KING: 2`, `P2_MAN: -1`, `P2_KING: -2`.
  - Dimensiones del tablero: `BOARD_SIZE = 8`.
  - Direcciones de avance diagonal para piezas simples y damas (reyes).

### `board.js`
- **Responsabilidad**: Estructura de datos del tablero $8 \times 8$ y funciones utilitarias de manipulación de estado.
- **Contenido clave**:
  - `createInitialBoard()`: Genera la matriz de $8 \times 8$ con las 12 fichas de cada jugador ubicadas exclusivamente en casillas oscuras (filas 0-2 para el jugador 2, filas 5-7 para el jugador 1).
  - `cloneBoard(board)`: Copia profunda rápida de la matriz para simulaciones en el árbol de búsqueda sin mutar el tablero real.
  - `isInsideBoard(row, col)`: Verifica límites del tablero ($0 \le \text{row}, \text{col} < 8$).
  - `countPieces(board)`: Retorna el conteo actual de peones y damas de cada bando.

### `moveGenerator.js`
- **Responsabilidad**: Generación exhaustiva de movimientos legales para un jugador dado en un tablero determinado.
- **Contenido clave**:
  - `getValidMovesForPlayer(board, player)`:
    1. Escanea todas las piezas del jugador.
    2. Identifica si existen **capturas disponibles**.
    3. **Regla de Captura Obligatoria**: Si existen una o más capturas posibles, *únicamente* se retornan los movimientos de captura (descartando movimientos simples).
    4. Si no hay capturas, retorna los movimientos diagonales simples de 1 paso.
  - `getJumpsForPiece(board, row, col, piece)`: Búsqueda recursiva o en profundidad de capturas múltiples (saltos encadenados consecutivos en el mismo turno).
  - `getSimpleMovesForPiece(board, row, col, piece)`: Movimientos simples de avance a casillas adyacentes vacías.

### `rules.js`
- **Responsabilidad**: Aplicación de jugadas y reglas de transición de estado.
- **Contenido clave**:
  - `applyMove(board, move)`: Ejecuta un movimiento en el tablero (traslada la pieza, elimina piezas capturadas y efectúa la coronación a rey si alcanza la fila extrema contraria).
  - `checkGameOver(board, currentPlayer)`: Determina si el juego ha terminado:
    - Victoria: El adversario no tiene piezas restantes.
    - Bloqueo: El adversario no tiene movimientos válidos disponibles (pierde según la regla de damas).
    - Empate (Tablas): Detección de repetición o número límite de jugadas sin capturas.

---

## 3. Instrucciones para el Agente de IA para su Construcción

Al construir este módulo, el agente de IA debe seguir estas pautas rigurosas:
1. **Inmutabilidad y Pureza Funcional**: Las funciones de simulación de movimientos (`applyMove`, etc.) deben devolver un nuevo tablero clonado o mutar copias locales, nunca mutar accidentalmente el tablero de la partida en curso.
2. **Prioridad Absoluta a la Captura Obligatoria**:
   - Se debe asegurar que si una pieza tiene la posibilidad de saltar y comer una ficha contraria, el generador de movimientos no permita ningún movimiento simple.
   - En capturas múltiples, el movimiento generado debe contemplar la secuencia completa del salto o las bifurcaciones de salto más largo.
3. **Manejo de Reyes / Damas**:
   - Una ficha normal se corona a rey si llega a la fila 0 (para el jugador que sube) o a la fila 7 (para el que baja).
   - Un rey puede moverse y capturar en las 4 diagonales (hacia adelante y hacia atrás).
4. **Optimización de Rendimiento**: Este código será invocado decenas de miles de veces por segundo dentro de la búsqueda Minimax Alfa-Beta; evitar asignaciones de memoria excesivas y preferir operaciones matriciales eficientes.
