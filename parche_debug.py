"""
parche_debug.py - Agrega (o quita) el aviso en pantalla de imágenes que no cargan.

Uso:
  python parche_debug.py                 -> aplica a prueba.html
  python parche_debug.py otra.html       -> aplica a otro archivo
  python parche_debug.py --quitar        -> deshace el parche en prueba.html
  python parche_debug.py --quitar otra.html
"""
import shutil
import sys

args = [a for a in sys.argv[1:] if a != "--quitar"]
quitar = "--quitar" in sys.argv[1:]
ruta = args[0] if args else "prueba.html"

INI = "/* DEBUG-INICIO */"
FIN = "/* DEBUG-FIN */"

ANCLA = "let capaActual = 0;"

BLOQUE = f"""
      {INI}
      const fallos = [];
      const aviso = document.createElement('div');
      aviso.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:16px monospace;color:#ff6;background:rgba(0,0,0,.75);padding:6px 10px;max-width:90vw;white-space:pre-wrap';
      document.body.appendChild(aviso);
      const mostrarFallos = () => {{ aviso.textContent = fallos.length ? 'NO CARGAN:\\n' + fallos.join('\\n') : ''; }};
      {FIN}"""

ONLOAD_ORIG = "im.onload = () => resolve(true);"
ONLOAD_NEW = ("im.onload = () => { const k = fallos.indexOf(src); "
              "if (k > -1) fallos.splice(k, 1); mostrarFallos(); resolve(true); };")

ONERROR_ORIG = "im.onerror = () => { delete cacheImg[src]; resolve(false); };"
ONERROR_NEW = ("im.onerror = () => { delete cacheImg[src]; "
               "if (!fallos.includes(src)) fallos.push(src); mostrarFallos(); resolve(false); };")

with open(ruta, "r", encoding="utf-8", newline="") as f:
    html = f.read()

if quitar:
    if INI not in html:
        print("No hay parche aplicado. Nada que quitar.")
        sys.exit(0)
    i = html.index(INI)
    j = html.index(FIN) + len(FIN)
    # quita el bloque junto con el salto de línea previo
    ini_corte = html.rfind("\n", 0, i)
    html = html[:ini_corte] + html[j:]
    html = html.replace(ONLOAD_NEW, ONLOAD_ORIG).replace(ONERROR_NEW, ONERROR_ORIG)
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("Parche quitado de", ruta)
    sys.exit(0)

if INI in html:
    print("Ya está parcheado. Usa --quitar para deshacerlo.")
    sys.exit(0)

for texto in (ANCLA, ONLOAD_ORIG, ONERROR_ORIG):
    if html.count(texto) != 1:
        print(f"ABORTADO: no encontré exactamente 1 vez:\n  {texto}\nNo se tocó el archivo.")
        sys.exit(1)

shutil.copyfile(ruta, ruta + ".bak")
html = html.replace(ANCLA, ANCLA + BLOQUE)
html = html.replace(ONLOAD_ORIG, ONLOAD_NEW)
html = html.replace(ONERROR_ORIG, ONERROR_NEW)

with open(ruta, "w", encoding="utf-8", newline="") as f:
    f.write(html)

print("Parche aplicado a", ruta, "(respaldo:", ruta + ".bak)")
