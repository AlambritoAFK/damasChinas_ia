# Módulo de Estilos y Presentación (`frontend/css/`)

## 1. Propósito del Directorio
Este directorio gestiona la **apariencia visual, experiencia de usuario (UI/UX) y adaptabilidad responsiva** del juego. Utiliza CSS3 moderno sin librerías externas pesadas para lograr un diseño altamente estético, intuitivo y profesional, aspecto expresamente valorado en la rúbrica de calificación del proyecto.

---

## 2. Archivos que Contendrá y Responsabilidades

### `style.css`
- **Responsabilidad**: Estructura general de la interfaz, layout, controles y componentes auxiliares.
- **Contenido clave**:
  - Paleta de colores mediante variables CSS (`--bg-primary`, `--accent-color`, `--card-bg`, etc.).
  - Layout general en Flexbox / CSS Grid (área lateral de controles y estadísticas + área central del tablero).
  - Marcador de piezas restantes y capturadas para ambos jugadores.
  - Indicador visual de turno activo con animación sutil.
  - Selectores de modo de juego (Jugador vs. IA / Jugador vs. Jugador) y nivel de dificultad (Fácil, Medio, Difícil).
  - Botones de acción: "Nueva Partida" y "Rendirse" (*Resign*).
  - Modal estilizado para fin de partida (Victoria, Derrota, Empate o Rendición).
  - Panel colapsable de métricas de la IA (tiempo de cálculo y nodos evaluados).

### `board.css`
- **Responsabilidad**: Estilos exclusivos del tablero de damas $8 \times 8$ y sus piezas.
- **Contenido clave**:
  - Cuadrícula del tablero con `display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr);` manteniendo una relación de aspecto cuadrada (`aspect-ratio: 1 / 1`).
  - Casillas claras y oscuras alternadas.
  - Renderizado de fichas: Fichas circulares con gradientes radiales, bordes definidos y sombras (`box-shadow`) que simulan relieve 3D.
  - Distinción gráfica de **Damas / Reyes**: Símbolo de corona o borde dorado distintivo.
  - Estados visuales interactivos:
    - `.selected`: Borde brillante o halo en la pieza seleccionada por el jugador.
    - `.valid-move`: Indicador visual (círculo traslúcido o borde) en las casillas destino válidas.
    - `.must-capture`: Resaltado pulsante de alerta para piezas que tienen captura obligatoria.
  - Animaciones fluidas de transición para el movimiento y desvanecimiento al capturar piezas.

---

## 3. Instrucciones para el Agente de IA para su Construcción

Al construir este módulo, el agente de IA debe seguir estas pautas:
1. **Diseño Responsivo Obligatorio**:
   - Utilizar unidades relativas (`vmin`, `rem`, `%`) para que el tablero se ajuste perfectamente tanto en pantallas de escritorio grandes como en laptops o tablets, sin desbordamientos de scroll horizontal.
2. **Claridad Visual en las Reglas**:
   - Resaltar claramente la **captura obligatoria**. Si una pieza debe capturar por regla, la interfaz debe guiar visualmente al usuario sin generar confusión.
3. **Optimización de Animaciones**:
   - Utilizar `transform` y `opacity` para las transiciones de piezas, garantizando una tasa de 60 cuadros por segundo (FPS) sin provocar repintados costosos del navegador.
