# Módulo de Inteligencia Artificial (`backend/src/ai/`)

## 1. Propósito del Directorio
Este directorio alberga el **cerebro y motor de toma de decisiones del Agente Basado en Objetivos**. Implementa algoritmos de búsqueda adversarial en árboles de juego (Minimax con poda Alfa-Beta) guiados por una función de evaluación heurística multicriterio para evaluar posiciones del tablero y competir estratégicamente contra el jugador humano.

---

## 2. Archivos que Contendrá y Responsabilidades

### `heuristics.js`
- **Responsabilidad**: Función de evaluación estática $f(s)$ que asigna una puntuación numérica a cualquier estado $s$ del tablero desde la perspectiva del agente (valores positivos favorecen a la IA, valores negativos favorecen al jugador).
- **Criterios de Evaluación**:
  1. **Diferencia de Material**:
     - Peón simple = 100 puntos.
     - Dama / Rey = 275 - 300 puntos (mayor movilidad y poder de ataque bidireccional).
  2. **Control Posicional y Central**:
     - Bonificación de 10 a 25 puntos por piezas ubicadas en las casillas centrales del tablero ($[3,3], [3,5], [4,2], [4,4]$), donde tienen mayor radio de acción y no quedan atrapadas en los bordes.
  3. **Avance hacia Coronación**:
     - Bonificación progresiva para peones normales proporcional a su cercanía a la última fila enemiga.
  4. **Seguridad y Fila de Retaguardia**:
     - Bonificación por mantener intactas las piezas de la fila base propia durante la apertura y medio juego, impidiendo la coronación temprana del oponente.
  5. **Movilidad Relativa**:
     - Bonificación calculada en base a la cantidad de movimientos legales disponibles para el agente vs. el oponente.
  6. **Vulnerabilidad**:
     - Penalización si una pieza queda expuesta a captura inmediata.

### `alphaBeta.js`
- **Responsabilidad**: Implementación del algoritmo Minimax optimizado con **Poda Alfa-Beta** ($\alpha$-$\beta$).
- **Contenido clave**:
  - `findBestMove(board, player, depth)`: Función principal que explora todos los movimientos legales iniciales y selecciona aquel con la mayor puntuación garantizada.
  - `minimax(board, depth, alpha, beta, isMaximizing, player)`: Rutina recursiva con poda:
    - Condición de parada: `depth === 0` o `checkGameOver(board) === true`.
    - Ordenamiento de jugadas (*Move Ordering*): Evaluar primero las capturas para maximizar la frecuencia de podas $\alpha$-$\beta$, reduciendo el número de nodos explorados.
    - Actualización de $\alpha$ (mejor opción para MAX) y $\beta$ (mejor opción para MIN); corte de rama cuando $\beta \le \alpha$.

### `difficulty.js`
- **Responsabilidad**: Ajuste dinámico del comportamiento y profundidad del árbol de búsqueda según el nivel seleccionado por el usuario:
  - **Fácil**: Profundidad fija de 1 o 2 niveles (o con probabilidad del 20% de elegir una jugada no óptima entre las 3 mejores).
  - **Medio**: Profundidad fija de 4 niveles con heurística completa.
  - **Difícil**: Profundidad de 5 a 6 niveles con ordenamiento heurístico y búsqueda extendida de capturas.

---

## 3. Instrucciones para el Agente de IA para su Construcción

Al construir este módulo, el agente de IA debe seguir estas directrices:
1. **Evitar Errores de Perspectiva (Signo en Minimax)**:
   - Asegurarse de que las puntuaciones devueltas por `heuristics.js` sean consistentes. Si MAX es la IA, una posición con más piezas de la IA debe retornar un valor fuertemente positivo.
2. **Priorización de Jugadas (Move Ordering)**:
   - Dado que en las damas la captura es obligatoria, ordenar los movimientos analizando primero las capturas y luego movimientos que avancen piezas o coronen. Esto garantiza que la poda $\alpha$-$\beta$ alcance su máxima eficiencia teórica ($O(b^{d/2})$).
3. **Manejo de Tiempos Límite y Recursión**:
   - Asegurar que la profundidad máxima no provoque *Call Stack Overflow* ni demoras superiores a 1 segundo en la respuesta HTTP hacia el cliente.
4. **Respuesta en Casos Críticos**:
   - Si solo existe un único movimiento legal (o captura forzada), la IA debe ejecutarlo inmediatamente sin necesidad de profundizar en el árbol Minimax, optimizando la respuesta a 0 ms.
