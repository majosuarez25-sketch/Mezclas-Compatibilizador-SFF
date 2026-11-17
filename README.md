# Mezclas Compatibilizador SFF — SF Fertilizantes

Aplicación web estática para consultar, filtrar y registrar ensayos de compatibilidad de agroquímicos.

## Estructura del proyecto

- `index.html`: Estructura principal de la interfaz y modal de carga de ensayos.
- `styles.css`: Estilos responsivos y paleta corporativa.
- `app.js`: Lógica de búsqueda multi-término, filtros dinámicos, detección de mezclas repetidas y exportaciones.
- `data/ensayos.json`: Base de datos completa con los 153 ensayos iniciales.
- `vercel.json`: Configuración lista para despliegue estático en Vercel.

## Despliegue en Vercel

1. Subí esta carpeta a un repositorio en GitHub (o arrastrala directamente en Vercel CLI / Vercel Dashboard).
2. Vercel detectará automáticamente que es un sitio estático (`Framework Preset: Other`, sin comando de build).
3. El archivo `data/ensayos.json` se sirve de forma estática y los nuevos ensayos cargados desde el navegador se persisten en `localStorage`, pudiendo exportarse en cualquier momento como `ensayos.json`, `.xlsx`, `.csv` o `.html` portable.
