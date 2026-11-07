/*
 * GALERIA GOURMET - MURAL SINCRONIZADO PARA 4 TELEVISORES
 * Los cuatro HTML cargan este mismo archivo; solo cambia data-col (0..3).
 * Los ciclos propios de menús y publicidades siguen funcionando debajo.
 *
 * Programación común:
 *   140 s de contenido habitual + 20 s de mural = 160 s por ciclo.
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

  // Mismos valores en los cuatro televisores: 140 s de contenido + 20 s de mural.
  const CONTENT_MS = 140000;
  const MURAL_MS = 20000;
  const CYCLE_MS = CONTENT_MS + MURAL_MS;
  const MURAL_START_MS = CONTENT_MS;
  const CLOCK_SYNC_INTERVAL_MS = 60000;
  const CLOCK_SAMPLE_COUNT = 7;
  const CLOCK_SAMPLE_GAP_MS = 120;
  const CHECK_INTERVAL_MS = 100;
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

  // Prueba manual: añadir ?muralTest=1 a cada enlace.
  const testMode = new URLSearchParams(window.location.search).get('muralTest') === '1';
  let visible = false;
  let clockOffsetMs = 0;
  let clockReady = false;
  let syncInProgress = false;
  let imageReady = false;

  function setVisible(next) {
    // No enseñar una capa negra mientras termina de cargar la imagen.
    next = Boolean(next && imageReady);
    if (next === visible) return;
    visible = next;
    overlay.style.display = next ? 'block' : 'none';
    overlay.setAttribute('aria-hidden', next ? 'false' : 'true');
    console.info(`[Mural] TV ${col + 1}/4: ${next ? 'VISIBLE' : 'oculto'}`);
  }

  async function medirReloj(sampleNumber) {
    const url = new URL(imageUrl);
    url.searchParams.set('_mural_clock', `${Date.now()}-${sampleNumber}`);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1800);
    const t0 = Date.now();
    try {
      const response = await fetch(url.href, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      const t1 = Date.now();
      const headerDate = response.headers.get('Date');
      if (!response.ok || !headerDate) return null;

      const serverMs = Date.parse(headerDate);
      if (!Number.isFinite(serverMs)) return null;

      // Date HTTP tiene precisión de un segundo. Estimamos el instante de respuesta
      // con el punto medio del viaje y el centro del segundo indicado por Date.
      const midpoint = t0 + (t1 - t0) / 2;
      return serverMs + 500 - midpoint;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function syncClock() {
    if (syncInProgress || testMode) return;
    syncInProgress = true;
    const offsets = [];
    let failures = 0;

    try {
      // Las muestras separadas en el tiempo promedian el redondeo de 1 segundo
      // del encabezado HTTP Date. Así evitamos depender de una sola lectura.
      for (let i = 0; i < CLOCK_SAMPLE_COUNT; i++) {
        try {
          const offset = await medirReloj(i);
          if (Number.isFinite(offset)) {
            offsets.push(offset);
            failures = 0;
          } else {
            failures++;
          }
        } catch (_) {
          failures++;
        }

        if (failures >= 2) break;
        if (i < CLOCK_SAMPLE_COUNT - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, CLOCK_SAMPLE_GAP_MS));
        }
      }

      if (offsets.length >= 3) {
        // Promedio: las lecturas tomadas en distintos puntos del segundo compensan
        // el redondeo del encabezado Date y suavizan pequeñas variaciones de red.
        clockOffsetMs = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
        console.info(
          `[Mural] TV ${col + 1}/4: reloj sincronizado con ${offsets.length} muestras; ` +
          `corrección ${Math.round(clockOffsetMs)} ms`
        );
      } else {
        console.warn('[Mural] No hubo suficientes muestras de hora; se utilizará el reloj del equipo.');
      }
    } finally {
      clockReady = true;
      syncInProgress = false;
      tick();
    }
  }

  function tick() {
    if (testMode) {
      setVisible(true);
      window.setTimeout(tick, CHECK_INTERVAL_MS);
      return;
    }

    if (!clockReady) {
      setVisible(false);
      return;
    }

    const now = Date.now() + clockOffsetMs;
    const position = ((now % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    const muralActive = position >= MURAL_START_MS;
    setVisible(muralActive);

    // Revisión frecuente para que los cuatro equipos entren y salgan casi juntos,
    // incluso si el navegador retrasa ligeramente un temporizador.
    window.setTimeout(tick, CHECK_INTERVAL_MS);
  }

  // Precargar y decodificar la imagen antes de permitir que aparezca el mural.
  const preload = new Image();
  preload.onload = async () => {
    try {
      if (typeof preload.decode === 'function') await preload.decode();
    } catch (_) {
      // La imagen ya disparó onload; algunos navegadores no implementan decode bien.
    }
    imageReady = true;
    console.info('[Mural] Imagen panorámica cargada y lista.');
    tick();
  };
  preload.onerror = () => {
    imageReady = false;
    console.error('[Mural] No se pudo cargar la imagen:', imageUrl);
  };
  preload.src = imageUrl;

  // El modo de prueba no necesita consultar el reloj: muestra el mural al cargar.
  if (testMode) {
    clockReady = true;
    tick();
  } else {
    // Se sincroniza el reloj al arrancar y luego cada minuto.
    syncClock();
    window.setInterval(syncClock, CLOCK_SYNC_INTERVAL_MS);
  }
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
})();
