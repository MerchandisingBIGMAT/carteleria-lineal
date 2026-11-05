# Generador de carteles de precio · BigMat

Aplicación web para crear carteles de **Precios profesionales** a partir de la plantilla oficial de Scribus y descargarlos en PDF.
No necesita instalación: se abre en el navegador y funciona publicada en GitHub Pages.

## Cómo se usa

1. **Carteles**: crea un cartel nuevo, duplica el actual o elimínalo. Con las flechas ← → o el desplegable de la parte superior se pasa de un cartel a otro.
2. **Precio**:
   - **Precio en euros**: se escribe con coma, por ejemplo `12,99`, y rellena a la vez los euros y los céntimos del cartel.
   - **Unidad de medida**: por ejemplo `€/m²`, `€/kg` o `€/ud`.
3. **Textos**:
   - **Descripción del producto**: cada salto de línea es una línea en el cartel.
   - **Características técnicas**.
   - **Referencia**: solo admite números, hasta 8 cifras. Si tiene menos se completa con ceros a la izquierda y en el cartel aparece como `Ref. 00012345`.
4. **Descargar PDF**: elige el tamaño de papel (**DIN A3, A4 o A5**) y pulsa:
   - **Descargar PDF de este cartel** para el cartel que estás viendo.
   - **Descargar PDF de todos** para un único PDF con un cartel por página.

Mientras un campo está vacío, el cartel muestra `XXX` en su lugar.
Pinchando un texto en la vista previa se salta a su campo en el panel.

## Comportamiento

- **Elementos fijos:** el fondo, la cabecera "Precios profesionales", el logo, el símbolo € y el texto legal no se pueden editar.
- **Tamaños de letra:** son los de la plantilla y el usuario no puede cambiarlos. El precio se reduce solo cuando un número es demasiado largo para caber en una línea, por ejemplo `1234`.
- **Ver más o menos grande:** el zoom de **Opciones** solo cambia la vista en pantalla, no el PDF.
- **Se empieza siempre de cero:** cada vez que se abre o recarga la página aparece vacía, sin carteles anteriores. Descarga el PDF antes de cerrarla.
- **Calidad del PDF:** se genera a unos 300 ppp en el tamaño de papel elegido. El texto queda como imagen, no editable.

## Fuente "Mark My Words"

La plantilla usa la fuente **Mark My Words**. Si no está instalada en el equipo, la aplicación muestra una parecida (Permanent Marker).

Para ver y descargar los carteles con la fuente real, sube el archivo `.ttf` u `.otf` en **Opciones → Subir archivo de fuente**. Queda guardada en ese navegador y no hace falta volver a subirla.

## Estructura del proyecto

```
index.html                      Página de la aplicación
assets/
  css/styles.css                Estilos (misma línea visual que el Generador de fichas técnicas)
  js/app.js                     Lógica: lectura de la plantilla, edición y PDF
  js/plantilla-embebida.js      Copia de la plantilla para abrir index.html sin servidor
  img/logo-bigmat.png           Logo de la cabecera
plantilla/
  PREC_PROF_FOND_LINEAL_NORMAL_DECIMAL_A4_9999.sla   Plantilla de Scribus
README.md
```

Librerías externas, cargadas desde cdnjs: **html2canvas 1.4.1** para dibujar el cartel y **jsPDF 2.5.1** para crear el PDF. La fuente de la interfaz es **Montserrat**, de Google Fonts.

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio, en la rama `main`.
2. En el repositorio, ve a **Settings → Pages → Build and deployment**.
3. En **Source** elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`, y guarda.
4. En uno o dos minutos la aplicación estará en `https://<usuario>.github.io/<repositorio>/`.

También se puede abrir `index.html` con doble clic. En ese caso la plantilla se lee de `assets/js/plantilla-embebida.js`.

## Mantenimiento

### Cambiar la plantilla

1. Sustituye `plantilla/PREC_PROF_FOND_LINEAL_NORMAL_DECIMAL_A4_9999.sla` por la nueva versión, con el mismo nombre. Los cuadros de texto deben conservar su identificador.
2. Si los cuadros cambian, revisa la lista `FIELDS` al principio de `assets/js/app.js`. Cada cuadro se identifica por su `ItemID` de Scribus:

| ItemID      | Campo                    |
|-------------|--------------------------|
| `210023872` | Descripción del producto |
| `210029536` | Características técnicas |
| `210639376` | Precio · euros           |
| `210018208` | Precio · céntimos        |
| `211134976` | Unidad de medida         |
| `211129312` | Referencia               |

3. Para que la nueva plantilla también funcione abriendo `index.html` con doble clic, regenera `assets/js/plantilla-embebida.js`. Este archivo contiene la línea `window.PLANTILLA_B64 = "..."` con el `.sla` en Base64. En GitHub Pages se lee siempre el `.sla`.

### Ajustar la posición de la unidad de medida

La unidad de medida y su recuadro negro están 14 pt más abajo que en la plantilla original para no chocar con el símbolo €. El valor está en `MOVE_Y`, en `assets/js/app.js`.

### Textos de relleno

Los textos que se ven cuando un campo está vacío (`XXX XXXX`, `XX`, `Ref. XXXXXXXX`…) se definen en la propiedad `ph` de cada campo dentro de `FIELDS`.
