# Backend del Proyecto de Damas con IA (`backend/`)

## 1. Propósito del Directorio
Este directorio contiene la aplicación del servidor backend basada en **Node.js** y **Express.js**. Su función es actuar como el motor central de cómputo y toma de decisiones para el Agente Inteligente, calculando en servidor las jugadas óptimas mediante algoritmos de búsqueda y manteniendo la validación de las reglas del juego.

---

## 2. Dependencias del Proyecto

### Dependencias Principales (`dependencies`):
- `express`: Framework web minimalista para crear la API REST.
- `cors`: Middleware para permitir peticiones HTTP seguras desde el frontend.
- `dotenv`: Manejo de variables de entorno (como el puerto).

### Dependencias de Desarrollo (`devDependencies`):
- `nodemon`: Herramienta para reiniciar automáticamente el servidor ante cambios en el código.

---

## 3. Scripts Recomendados en `package.json`

```json
{
  "name": "damas-ai-backend",
  "version": "1.0.0",
  "description": "Backend API para juego de damas 8x8 con agente inteligente Minimax Alfa-Beta",
  "main": "src/server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

---

## 4. Instrucciones para el Agente de IA para su Construcción

1. **Inicialización**:
   - Navegar al directorio `backend/` y ejecutar `npm init -y`.
   - Instalar las dependencias con `npm install express cors dotenv`.
   - Instalar dependencias de desarrollo con `npm install --save-dev nodemon`.
2. **Estructura de Archivos**:
   - Crear el archivo `.env.example` con `PORT=3000`.
   - Seguir estrictamente las especificaciones descritas en `src/game/README.md`, `src/ai/README.md`, `src/routes/README.md` y `src/README.md`.
3. **Verificación**:
   - Probar el arranque del servidor ejecutando `node src/server.js` y corroborar que responda correctamente en `http://localhost:3000/api/game/health`.
