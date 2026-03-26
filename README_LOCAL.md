# MangroveShield - Edición Desarrollo Local

Esta es una copia de seguridad y desarrollo del proyecto MangroveShield, configurada específicamente para funcionar con tu backend de Python local.

## 📁 Diferencias con la versión de Producción
- **API Routing**: La variable `API_BASE_URL` en `frontend/lib/constants.ts` está configurada como `http://localhost:8000`.
- **Backend Sync**: Los scripts en `backend/` están listos para ser usados sin interferir con la caché de producción en Firestore (a menos que uses las llaves de Firebase).

## 🚀 Cómo empezar
1. Abre una terminal en esta carpeta: `cd c:\Users\ADMIN\Desktop\MangroveShield_Local\frontend`
2. Inicia el frontend: `npm run dev`
3. En otra terminal, inicia tu backend de Python en `backend/`.

## 🛡️ Seguridad
Recuerda que esta versión **NO** tiene las optimizaciones de seguridad de Cloud (CSP estrictas) activadas para facilitar el desarrollo rápido entre el frontend (puerto 3000) y el backend (puerto 8000).
