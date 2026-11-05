# Generador de carteles de precio · BigMat

Aplicación web para rellenar la plantilla de cartel **Precios profesionales** (A4) y descargar los carteles en PDF.

## Qué hace

- Edita los textos del cartel: descripción, características técnicas, precio (euros y céntimos), precio por unidad y referencia.
- En el precio también se puede cambiar el tamaño de la fuente.
- El símbolo €, el texto legal y el fondo son fijos.
- Permite crear varios carteles (nuevo, duplicar, eliminar) y moverse entre ellos.
- Descarga el PDF del cartel actual o de todos a la vez (un cartel por página) en **DIN A3, A4 o A5**.
- Los carteles se guardan solos en el navegador de cada usuario.

## Estructura

```
index.html
assets/
  css/styles.css
  js/app.js
  js/plantilla-embebida.js   ← copia de la plantilla para abrir index.html sin servidor
  img/logo-bigmat.png
plantilla/
  PREC_PROF_FOND_LINEAL_NORMAL_DECIMAL_A4_9999.sla
```

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio (rama `main`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)` y guarda.
4. En uno o dos minutos la app estará en `https://<usuario>.github.io/<repositorio>/`.

## Fuente "Mark My Words"

La plantilla usa la fuente **Mark My Words**. Si no está instalada en el equipo, la app muestra una parecida (Permanent Marker).
Para ver y descargar los carteles con la fuente real, cada usuario puede subir el archivo `.ttf` u `.otf` en **Opciones → Subir archivo de fuente** (queda guardado en su navegador).

## Cambiar la plantilla

Sustituye `plantilla/PREC_PROF_FOND_LINEAL_NORMAL_DECIMAL_A4_9999.sla` por la nueva versión con el mismo nombre.
Si cambian los cuadros de texto, revisa la lista `FIELDS` al principio de `assets/js/app.js` (usa el `ItemID` de cada cuadro en Scribus).
`plantilla-embebida.js` solo se usa al abrir `index.html` con doble clic, sin servidor. En GitHub Pages se lee siempre el `.sla`.
