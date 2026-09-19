# Frontend del Proyecto de Damas con IA (`frontend/`)

## 1. Propósito del Directorio
Este directorio contiene la **interfaz gráfica web completa** para el usuario. Permite jugar damas en dos modalidades:
- **Jugador vs. Computadora (Agente Inteligente con búsqueda Minimax Alfa-Beta)**.
- **Jugador vs. Jugador (Modo local de 2 jugadores)**.

Cumple con todos los requerimientos estéticos y funcionales del proyecto académico: interfaz gráfica rica, fluida, intuitiva, soporte de captura obligatoria, coronación a dama, botón de rendición y tablero estándar de $8 \times 8$.

---

## 2. Estructura de Archivos del Frontend

```text
frontend/
├── index.html          # Estructura semántica, paneles, tablero y modales
├── css/
│   ├── README.md       # Documentación e instrucciones de estilos
│   ├── style.css       # Estilos globales, controles, paneles y modales
│   └── board.css       # Cuadrícula 8x8, diseño de fichas, reyes y efectos
└── js/
    ├── README.md       # Documentación e instrucciones de lógica de cliente
    ├── api.js          # Consumo de la API REST del backend con fetch
    ├── boardUI.js      # Renderizado del DOM y animaciones
    └── app.js          # Orquestador del juego y máquina de estados
```

---

## 3. Instrucciones para el Agente de IA para su Construcción

1. **Construcción de `index.html`**:
   - Crear una estructura semántica limpia con `<header>` (título y selector de modo/dificultad), `<main>` (tablero central en `<div id="board">`), `<aside>` (panel de turno, piezas restantes, métricas de IA y botón de rendirse), y modal de fin de juego en `<dialog>` o `div` con overlay.
   - Enlazar correctamente las hojas de estilo `css/style.css` y `css/board.css`.
   - Cargar los scripts modulares con `<script type="module" src="js/app.js"></script>`.
2. **Prueba de Ejecución**:
   - Se puede abrir directamente en el navegador o servir mediante cualquier servidor de estáticos (`npx serve frontend`, extensión Live Server de VS Code, o servido estáticamente por el backend de Express).
