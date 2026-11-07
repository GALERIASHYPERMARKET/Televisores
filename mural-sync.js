/*
 * GALERIA GOURMET - MURAL SINCRONIZADO PARA 4 TELEVISORES
 * Todos los HTML cargan este mismo archivo; solo cambia data-col (0..3).
 * No modifica ni detiene los ciclos originales de menús/publicidades:
 * el mural se superpone durante 8 s cada 148 s.
 */
(() => {
  'use strict';

  const script = document.currentScript;
  if (!script) {
    console.error('[Mural] No se pudo identificar el script de configuración.');
    return;
  }

  const COLS = 4;
  const FILAS = 1;
  const col = Number.parseInt(script.dataset.col, 10);
  const fila = Number.parseInt(script.dataset.fila || '0', 10);
  const imagePath = script.dataset.image || './publicidad/mural.webp';

  if (!Number.isInteger(col) || col < 0 || col >= COLS || fila !== 0) {
    console.error('[Mural] Configuración de cuadrante inválida:', { col, fila });
    return;
  }

  // 35 s de menú + 3 publicidades de 35 s + 8 s de mural = 148 s.
  // La ventana del mural ocupa los últimos 8 segundos de cada ciclo global.
  const CYCLE_MS = 148000;
  const MURAL_MS = 8000;
  const MURAL_START_MS = CYCLE_MS - MURAL_MS;
  const imageUrl = new URL(imagePath, document.baseURI).href;

  const overlay = document.createElement('div');
  overlay.id = 'galeria-gourmet-mural-sync';
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    zIndex: '2147483647',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#000',
    backgroundImage: `url("${imageUrl}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${COLS * 100}% ${FILAS * 100}%`,
    backgroundPosition: `${(col / (COLS - 1)) * 100}% 50%`,
    pointerEvents: 'none'
  });
  document.body.appendChild(overlay);

  // Permite una prueba manual en los cuatro enlaces añadiendo ?muralTest=1.
  const testMode = new URLSearchParams(window.location.search).get('muralTest') === '1';
  let visible = false;
  let clockOffsetMs = 0;

  function setVisible(next) {
    if (next === visible) return;
    visible = next;
    overlay.style.display = next ? 'block' : 'none';
    console.info(`[Mural] TV ${col + 1}/4: ${next ? 'visible' : 'oculto'}`);
  }

  async function syncClock() {
    try {
      const t0 = Date.now();
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        cache: 'no-store'
      });
      const t1 = Date.now();
      const dateHeader = response.headers.get('Date');
      if (!response.ok || !dateHeader) return;

      // El encabezado Date tiene precisión de segundos; +500 ms centra ese intervalo.
      const serverMs = Date.parse(dateHeader);
      if (!Number.isFinite(serverMs)) return;
      const midpoint = t0 + (t1 - t0) / 2;
      clockOffsetMs = serverMs + 500 - midpoint;
      console.info('[Mural] Diferencia estimada del reloj:', Math.round(clockOffsetMs), 'ms');
    } catch (error) {
      // Si HEAD no está disponible, Date.now() local sigue permitiendo la sincronización
      // siempre que los relojes de los cuatro equipos estén ajustados automáticamente.
      console.warn('[Mural] No se pudo sincronizar con el servidor; se usa el reloj local.', error);
    }
  }

  function tick() {
    if (testMode) {
      setVisible(true);
      window.setTimeout(tick, 500);
      return;
    }

    const now = Date.now() + clockOffsetMs;
    const position = ((now % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    const muralActive = position >= MURAL_START_MS;
    setVisible(muralActive);

    const remaining = muralActive
      ? CYCLE_MS - position
      : MURAL_START_MS - position;

    // Revisa dos veces por segundo para absorber pequeños ajustes del reloj.
    window.setTimeout(tick, Math.max(50, Math.min(remaining + 20, 500)));
  }

  // Espera el primer intento de sincronización antes de calcular la fase.
  syncClock().finally(() => tick());
  window.setInterval(syncClock, 5 * 60 * 1000);

  // Precarga explícita para detectar inmediatamente una ruta incorrecta.
  const preload = new Image();
  preload.onload = () => console.info('[Mural] Imagen panorámica cargada correctamente.');
  preload.onerror = () => console.error('[Mural] No se pudo cargar:', imageUrl);
  preload.src = imageUrl;
})();
