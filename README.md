# Conglomerado RL — Municipio de Chihuahua

Sitio estático (HTML + JavaScript, sin servidor) para analizar el Conglomerado RL de encuestas telefónicas en el municipio de Chihuahua sobre las secciones electorales 2016–2024, las colonias y las cerradas.

## Páginas

| Página | Contenido |
|---|---|
| `index.html` — Mapa interactivo | Filtros superiores por distrito local (12, 15, 16, 17, 18) y federal (6, 8). Capas: secciones con simbología bivariada PAN vs oposición, colonias con etiquetas, cerradas (perímetro rojo) y encuestados emparejados. Filtros laterales y tabla con todas las columnas del Conglomerado. Resumen de encuesta y resumen de secciones (solo resultados 2024, por coalición y partido). |
| `dashboard.html` — Dashboard KPIs | Respuestas, teléfonos, emparejados, líder y cambios de opinión; preferencia, evolución por fecha, distrito, sexo, edad y perfil por candidato. |
| `resumen.html` — Resumen y hallazgos | Narrativa calculada con los datos y resultados 2024 por distrito. |
| `migracion.html` — Migración de opinión | Personas que opinaron distinto en fechas distintas («Nombre de la hoja»): ficha completa, cada fecha y su opinión; matriz de primera a última opinión y balance por candidato. |
| `analisis.html` — Análisis manual | Bloques guardados desde el mapa (resúmenes y vistas), reordenables y exportables a PDF. |

## Datos

- **Capas geográficas** (carpeta `datos/`): exportadas de ArcGIS Pro (`mCUU1624`, `colonias`, `cerradas`) y el ayudante `capas-arcgis-leaflet.js`.
- **Conglomerado RL**: el Excel `Conglomerado RL.xlsx` forma parte del repositorio y se convierte en `datos/conglomerado-rl.js`, que todas las páginas cargan por defecto (funciona también abriendo los HTML directamente, sin servidor). Se conservan todas las columnas y valores del archivo.

### Filtros por columnas del Conglomerado

Además de los filtros Sí/No (**Es servidor público**, **Es beneficiario**), las columnas `ServidorPublico`, `PartidoLocal`, `PartidoNacional`, `Beneficiario`, `ProgramaLocal` y `ProgramaFederal` se filtran con sus valores tal como vienen en el Excel en el mapa interactivo (filtros laterales), el dashboard y el bloque de filtros de Migración de opinión. Son datos de la persona: se toman de su ficha emparejada para todas sus respuestas; las respuestas sin ficha (o con `NULL`) quedan en «Sin dato».

## Publicar en GitHub Pages

1. Suba el contenido de esta carpeta a un repositorio.
2. **Settings → Pages → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Abra `https://<usuario>.github.io/<repositorio>/`.

## Actualizar

- **Capas**: reemplace los archivos de `datos/` por los nuevos de la carpeta de salidas (mismos nombres de variable).
- **Conglomerado**: reemplace `Conglomerado RL.xlsx` y ejecute `python herramientas/excel_a_js.py` (requiere `pip install openpyxl`) para regenerar `datos/conglomerado-rl.js`. Las columnas se reconocen por nombre; si cambian las columnas, se conservan y se muestran igual en la tabla y las fichas.
- **Distritos de los filtros superiores**: `app.js` → `DISTRITOS_LOCALES` y `DISTRITOS_FEDERALES`.

## Estructura

```
index.html, dashboard.html, resumen.html, migracion.html, analisis.html
app.js           utilidades, colores, filtros y resultados 2024 (coalición y partido)
conglomerado.js  modelo de análisis sobre datos/conglomerado-rl.js
mapa.js / dashboard.js / resumen.js / migracion.js / analisis.js
datos/           capas geográficas y conglomerado-rl.js (generado desde el Excel)
herramientas/    excel_a_js.py: convierte Conglomerado RL.xlsx en datos/conglomerado-rl.js
assets/          estilos (Metronic + tema), scripts y logotipos
```

Bibliotecas por CDN: Leaflet 1.9.4, html2canvas 1.4.1, jsPDF 2.5.1. Mapas base: Esri World Light Gray y OpenStreetMap.
