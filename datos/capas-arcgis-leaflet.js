/*
 * capas-arcgis-leaflet.js
 * Dibuja en Leaflet (1.7+) las capas generadas por "Herramienta transformar_capas"
 * con la simbologia de ArcGIS Pro: rellenos, contornos, guiones, achurados,
 * transparencias, marcadores, rangos de escala, etiquetas, popups y leyenda.
 *
 * Uso basico:
 *   <script src="capas-arcgis-leaflet.js"></script>
 *   <script src="miCapa.js"></script>          // define miCapa y miCapa_estilo
 *   var capa = CapaArcGIS.crear(miCapa, miCapa_estilo).addTo(mapa);
 *   CapaArcGIS.leyenda(capa).addTo(mapa);       // opcional
 *
 * Opciones de CapaArcGIS.crear(datos, estilo, opciones):
 *   popups        true   popup con los campos visibles, alias y formatos de Pro
 *   etiquetas     (lo que diga el .lyrx)  true/false para forzar
 *   escalas       true   respetar los rangos de visibilidad de Pro
 *   renderer      L.canvas() / L.svg(); por defecto canvas si hay mas de 3000 features
 *                 (los achurados requieren SVG y lo fuerzan)
 *   maxEtiquetas  1500   tope de etiquetas simultaneas en pantalla
 *   alClic        function (feature, capaLeaflet, evento)  ademas (o en lugar) del popup
 */
(function (raiz) {
  'use strict';
  var L = raiz.L;
  if (!L) throw new Error('capas-arcgis-leaflet.js requiere cargar Leaflet antes.');

  var PANEL_ETIQUETAS = 'etiquetasArcGIS';

  // --- Utilidades -----------------------------------------------------------

  function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Escala de ArcGIS (1:N) equivalente a la vista actual de Leaflet (96 dpi).
  function escalaDelMapa(mapa) {
    var lat = mapa.getCenter().lat;
    var metrosPorPixel = 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, mapa.getZoom() + 8);
    return metrosPorPixel * 96 / 0.0254;
  }

  // En Pro: escalaMin = la mas alejada (1:N mayor) a la que aun se ve; escalaMax = la mas cercana.
  function enRangoDeEscala(escala, min, max) {
    return (!min || escala <= min) && (!max || escala >= max);
  }

  // --- Patrones (achurados / imagenes) como <pattern> SVG ---------------------

  var contenedorDefs = null;

  function idPatron(estilo, i) {
    return 'patron-' + (estilo.variable || 'capa') + '-' + i;
  }

  function tieneFlechas(estilo) {
    return estilo.simbolos.some(function (s) { return s && s.flechas; });
  }

  function idFlecha(estilo, s, extremo) {
    return 'flecha-' + (estilo.variable || 'capa') + '-' + s + '-' + extremo;
  }

  // Puntas de flecha como <marker> SVG: el navegador las orienta solas con la
  // direccion de la linea en su extremo.
  function asegurarFlechas(estilo, ns) {
    estilo.simbolos.forEach(function (s, i) {
      if (!s || !s.flechas) return;
      ['inicio', 'fin'].forEach(function (extremo) {
        var f = s.flechas[extremo];
        var id = idFlecha(estilo, i, extremo);
        if (!f || document.getElementById(id)) return;
        var marcador = document.createElementNS(ns, 'marker');
        marcador.setAttribute('id', id);
        marcador.setAttribute('viewBox', '0 0 10 10');
        marcador.setAttribute('refX', 10);
        marcador.setAttribute('refY', 5);
        marcador.setAttribute('markerUnits', 'userSpaceOnUse');
        marcador.setAttribute('markerWidth', f.tamano);
        marcador.setAttribute('markerHeight', f.tamano);
        marcador.setAttribute('orient', extremo === 'inicio' ? 'auto-start-reverse' : 'auto');
        var punta = document.createElementNS(ns, 'path');
        punta.setAttribute('d', 'M0,0 L10,5 L0,10 Z');
        punta.setAttribute('fill', f.color);
        if (f.opacidad < 1) punta.setAttribute('fill-opacity', f.opacidad);
        marcador.appendChild(punta);
        contenedorDefs.appendChild(marcador);
      });
    });
  }

  function asegurarPatrones(estilo) {
    var conPatrones = estilo.patrones && estilo.patrones.length;
    if ((!conPatrones && !tieneFlechas(estilo)) || !document.body) return;
    var ns = 'http://www.w3.org/2000/svg';
    if (!contenedorDefs) {
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      contenedorDefs = document.createElementNS(ns, 'defs');
      svg.appendChild(contenedorDefs);
      document.body.appendChild(svg);
    }
    asegurarFlechas(estilo, ns);
    (estilo.patrones || []).forEach(function (p, i) {
      var id = idPatron(estilo, i);
      if (document.getElementById(id)) return;
      var patron = document.createElementNS(ns, 'pattern');
      patron.setAttribute('id', id);
      patron.setAttribute('patternUnits', 'userSpaceOnUse');
      if (p.tipo === 'rayado') {
        var s = p.separacion;
        patron.setAttribute('width', s);
        patron.setAttribute('height', s);
        patron.setAttribute('patternTransform', 'rotate(' + (-p.angulo) + ')');
        var linea = document.createElementNS(ns, 'line');
        var y = (s / 2 + (p.desfase || 0)) % s;
        linea.setAttribute('x1', 0);
        linea.setAttribute('x2', s);
        linea.setAttribute('y1', y);
        linea.setAttribute('y2', y);
        linea.setAttribute('stroke', p.color);
        linea.setAttribute('stroke-opacity', p.opacidad);
        linea.setAttribute('stroke-width', p.grosor);
        if (p.guiones) linea.setAttribute('stroke-dasharray', p.guiones);
        patron.appendChild(linea);
      } else if (p.tipo === 'imagen') {
        patron.setAttribute('width', p.ancho);
        patron.setAttribute('height', p.alto);
        if (p.angulo) patron.setAttribute('patternTransform', 'rotate(' + (-p.angulo) + ')');
        var imagen = document.createElementNS(ns, 'image');
        imagen.setAttribute('href', p.url);
        imagen.setAttribute('width', p.ancho);
        imagen.setAttribute('height', p.alto);
        imagen.setAttribute('preserveAspectRatio', 'none');
        if (p.opacidad < 1) imagen.setAttribute('opacity', p.opacidad);
        patron.appendChild(imagen);
      }
      contenedorDefs.appendChild(patron);
    });
  }

  // --- Estilos de path ----------------------------------------------------------

  // --- Dependencias de escala ---------------------------------------------
  //
  // Todo lo que en Pro cambia con la escala se resuelve aqui. Si no se pasa
  // escala (capa todavia sin mapa) se usa el simbolo principal sin filtros.

  // Valor interpolado (en escala logaritmica) de pares [[escala, valor], ...]
  // ordenados de la escala mas cercana a la mas lejana.
  function interpolarPorEscala(pares, escala) {
    if (escala <= pares[0][0]) return pares[0][1];
    var ultimo = pares[pares.length - 1];
    if (escala >= ultimo[0]) return ultimo[1];
    for (var i = 1; i < pares.length; i++) {
      if (escala <= pares[i][0]) {
        var a = pares[i - 1], b = pares[i];
        var t = (Math.log(escala) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return ultimo[1];
  }

  function tieneRango(objeto) { return !!(objeto && (objeto.escalaMin || objeto.escalaMax)); }

  // Mascara de filtros de visualizacion activos; -1 = ninguno aplica (se dibuja todo).
  function mascaraFiltros(filtros, escala) {
    if (!filtros || escala === undefined) return -1;
    if (filtros.tipo === 'manual') return filtros.activo >= 0 ? (1 << filtros.activo) : -1;
    var m = 0;
    filtros.lista.forEach(function (f, i) { if (enRangoDeEscala(escala, f.escalaMin, f.escalaMax)) m |= (1 << i); });
    return m === 0 ? -1 : m;
  }

  // Indice del simbolo que corresponde al feature en esta escala (-1 = no se dibuja).
  function indiceSimbolo(feature, estilo, escala) {
    var s = feature && feature._s;
    if (s === undefined) s = 0;
    if (s < 0 || !estilo.simbolos[s]) return -1;
    if (escala === undefined) return s;
    var mascara = mascaraFiltros(estilo.filtros, escala);
    if (mascara !== -1 && ((feature._f || 0) & mascara) === 0) return -1;
    var principal = estilo.simbolos[s];
    if (!tieneRango(principal) || enRangoDeEscala(escala, principal.escalaMin, principal.escalaMax)) return s;
    var alternos = principal.alternos || [];
    for (var i = 0; i < alternos.length; i++) {
      var alterno = estilo.simbolos[alternos[i]];
      if (!tieneRango(alterno) || enRangoDeEscala(escala, alterno.escalaMin, alterno.escalaMax)) return alternos[i];
    }
    return -1;
  }

  function simboloDe(feature, estilo, escala) {
    var i = indiceSimbolo(feature, estilo, escala);
    return i >= 0 ? estilo.simbolos[i] : null;
  }

  function factorDeTamano(simbolo, escala) {
    if (!simbolo || !simbolo.variacionEscala || escala === undefined) return 1;
    return interpolarPorEscala(simbolo.variacionEscala, escala);
  }

  function dependeDeEscala(estilo) {
    return !!estilo.filtros || estilo.simbolos.some(function (s) {
      return s && (tieneRango(s) || s.variacionEscala);
    });
  }

  // Resume lo que cambia con la escala; la capa se redibuja solo si cambia.
  function claveDeEscala(estilo, escala) {
    var partes = [mascaraFiltros(estilo.filtros, escala)];
    estilo.simbolos.forEach(function (s) {
      if (!s) return;
      if (tieneRango(s)) partes.push(enRangoDeEscala(escala, s.escalaMin, s.escalaMax) ? 1 : 0);
      if (s.variacionEscala) partes.push(factorDeTamano(s, escala).toFixed(2));
    });
    return partes.join('|');
  }

  // Pasada que recibe clics/popups: la que tiene relleno (o la de arriba).
  function pasadaInteractiva(simbolo) {
    var capas = (simbolo && simbolo.capas) || [];
    for (var i = 0; i < capas.length; i++) if (capas[i].relleno) return i;
    return Math.max(0, capas.length - 1);
  }

  // Opciones de L.Path para la pasada k de un feature.
  function estiloDe(feature, estilo, k, escala) {
    k = k || 0;
    var simbolo = simboloDe(feature, estilo, escala);
    var capa = simbolo && simbolo.capas && simbolo.capas[k];
    if (!capa) return { stroke: false, fill: false, interactive: false };
    var factor = feature._o !== undefined ? feature._o : 1;
    var o = { stroke: false, fill: false, interactive: k === pasadaInteractiva(simbolo) };
    if (capa.relleno) {
      o.fill = true;
      if (capa.relleno.patron !== undefined) {
        o.fillColor = 'url(#' + idPatron(estilo, capa.relleno.patron) + ')';
        o.fillOpacity = factor;
      } else {
        o.fillColor = feature._c || capa.relleno.color;
        o.fillOpacity = capa.relleno.opacidad * factor;
      }
    }
    if (capa.trazo) {
      var t = capa.trazo;
      o.stroke = true;
      o.color = (!capa.relleno && feature._c) || t.color;
      o.opacity = t.opacidad * factor;
      o.weight = (feature._z !== undefined && estilo.geometria === 'linea' ? feature._z : t.grosor) * factorDeTamano(simbolo, escala);
      o.lineCap = t.extremo;
      o.lineJoin = t.union;
      o.dashArray = t.guiones || null;
      o.dashOffset = t.desfaseGuiones ? String(t.desfaseGuiones) : null;
    }
    return o;
  }

  var cacheIconos = {};

  function marcadorDe(feature, latlng, estilo, escala) {
    var indice = indiceSimbolo(feature, estilo, escala);
    var simbolo = indice >= 0 ? estilo.simbolos[indice] : null;
    var m = simbolo && simbolo.marcador;
    if (!m) return null;
    var factor = feature._o !== undefined ? feature._o : 1;
    var factorTamano = factorDeTamano(simbolo, escala);
    if (m.tipo === 'circulo') {
      var radio = (feature._z !== undefined ? feature._z / 2 : m.radio) * factorTamano;
      return L.circleMarker(latlng, {
        radius: radio,
        fill: !!m.relleno,
        fillColor: feature._c || (m.relleno && m.relleno.color),
        fillOpacity: m.relleno ? m.relleno.opacidad * factor : 0,
        stroke: !!m.borde,
        color: m.borde && m.borde.color,
        opacity: m.borde ? m.borde.opacidad * factor : 0,
        weight: m.borde ? m.borde.grosor : 0,
        dashArray: m.borde && m.borde.guiones || null
      });
    }
    var ampliacion = (feature._z !== undefined && m.alto ? feature._z / m.alto : 1) * factorTamano;
    var rotacion = feature._r || 0;
    var clave = indice + '|' + ampliacion.toFixed(3) + '|' + rotacion + '|' + factor + '|' + (feature._c || '');
    var icono = cacheIconos[estilo.variable + clave];
    if (!icono) {
      var svg = m.svg;
      if (feature._c) svg = svg.replace(/fill="#[0-9a-f]{6}"/i, 'fill="' + feature._c + '"');
      var transform = [];
      if (ampliacion !== 1) transform.push('scale(' + ampliacion + ')');
      if (rotacion) transform.push('rotate(' + rotacion + 'deg)');
      icono = L.divIcon({
        className: 'capa-arcgis-marcador',
        html: '<div style="width:' + m.ancho + 'px;height:' + m.alto + 'px;line-height:0;' +
          (transform.length ? 'transform:' + transform.join(' ') + ';transform-origin:' + m.anclaX + 'px ' + m.anclaY + 'px;' : '') +
          (factor < 1 ? 'opacity:' + factor + ';' : '') + '">' + svg + '</div>',
        iconSize: [m.ancho, m.alto],
        iconAnchor: [m.anclaX, m.anclaY]
      });
      cacheIconos[estilo.variable + clave] = icono;
    }
    return L.marker(latlng, { icon: icono });
  }

  // --- Popups ---------------------------------------------------------------------

  function formatearValor(valor, formato) {
    if (valor === null || valor === undefined || valor === '') return '';
    if (formato && typeof valor === 'number' && isFinite(valor)) {
      var v = formato.porcentaje === 'x100' ? valor * 100 : valor;
      var opciones = { useGrouping: !!formato.separador };
      if (formato.significativos !== undefined) {
        opciones.maximumSignificantDigits = Math.max(1, formato.significativos);
      } else if (formato.decimales !== undefined) {
        opciones.maximumFractionDigits = formato.decimales;
        opciones.minimumFractionDigits = formato.ceros ? formato.decimales : 0;
      }
      return escaparHtml(v.toLocaleString('es-MX', opciones) + (formato.porcentaje ? '%' : ''));
    }
    var texto = String(valor);
    if (/^https?:\/\/\S+$/i.test(texto)) return '<a href="' + escaparHtml(texto) + '" target="_blank" rel="noopener">' + escaparHtml(texto) + '</a>';
    return escaparHtml(texto);
  }

  function htmlPopup(feature, estilo) {
    var props = feature.properties || {};
    var popup = estilo.popup || { campos: Object.keys(props).map(function (k) { return { campo: k }; }) };
    var agregados = estilo.camposAgregados || [];
    var titulo = popup.titulo ? popup.titulo.replace(/\{([^}]+)\}/g, function (m, c) {
      return props[c] === null || props[c] === undefined ? '' : String(props[c]);
    }) : '';
    var filas = popup.campos.filter(function (c) {
      return agregados.indexOf(c.campo) === -1 && Object.prototype.hasOwnProperty.call(props, c.campo);
    }).map(function (c) {
      return '<tr><th>' + escaparHtml(c.alias || c.campo) + '</th><td>' + formatearValor(props[c.campo], c.formato) + '</td></tr>';
    });
    return '<div class="capa-arcgis-popup">' +
      (titulo ? '<div class="capa-arcgis-popup-titulo">' + escaparHtml(titulo) + '</div>' : '') +
      '<table>' + filas.join('') + '</table></div>';
  }

  // --- Etiquetas ---------------------------------------------------------------------

  function cssEtiqueta(e, tamano) {
    var est = e.estilo || {};
    var css = [
      "font-family:'" + String(est.fuente || 'Tahoma').replace(/['"<>]/g, '') + "',Tahoma,'Segoe UI',Arial,sans-serif",
      'font-size:' + (tamano || est.tamano || 13) + 'px',
      'font-weight:' + (est.negrita ? 'bold' : 'normal'),
      'font-style:' + (est.cursiva ? 'italic' : 'normal'),
      'color:' + (est.color || '#000'),
      'text-align:' + (est.alineacion || 'center'),
      'line-height:1.15',
      'white-space:pre',
      'pointer-events:none'
    ];
    if (est.opacidad !== undefined && est.opacidad < 1) css.push('opacity:' + est.opacidad);
    if (est.mayusculas) css.push('text-transform:' + est.mayusculas);
    if (est.subrayado) css.push('text-decoration:underline');
    if (est.halo) {
      var h = est.halo.tamano;
      var c = colorConOpacidad(est.halo.color, est.halo.opacidad);
      var sombras = [];
      for (var a = 0; a < 16; a++) {
        var ang = a / 16 * 2 * Math.PI;
        sombras.push((Math.cos(ang) * h).toFixed(2) + 'px ' + (Math.sin(ang) * h).toFixed(2) + 'px 0 ' + c);
      }
      css.push('text-shadow:' + sombras.join(','));
    }
    if (est.fondo) {
      var f = est.fondo;
      if (f.relleno) css.push('background:' + colorConOpacidad(f.relleno.color, f.relleno.opacidad));
      if (f.borde) css.push('border:' + f.borde.grosor + 'px solid ' + colorConOpacidad(f.borde.color, f.borde.opacidad));
      css.push('padding:' + f.margen.map(function (v) { return v + 'px'; }).join(' '));
      if (f.redondeado) css.push('border-radius:6px');
    }
    return css.join(';');
  }

  function colorConOpacidad(hex, opacidad) {
    if (opacidad === undefined || opacidad >= 1) return hex;
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + opacidad + ')';
  }

  // Apilado de Maplex: parte etiquetas largas en varias lineas por palabras.
  function apilar(texto, maxCaracteres, maxLineas) {
    if (!maxCaracteres || texto.length <= maxCaracteres || texto.indexOf('\n') !== -1) return texto;
    var palabras = texto.split(' ');
    var lineas = [''];
    palabras.forEach(function (p) {
      var actual = lineas[lineas.length - 1];
      if (actual && (actual + ' ' + p).length > maxCaracteres && lineas.length < maxLineas) lineas.push(p);
      else lineas[lineas.length - 1] = actual ? actual + ' ' + p : p;
    });
    return lineas.join('\n');
  }

  // --- Capa ---------------------------------------------------------------------------

  var CapaArcGISLayer = L.FeatureGroup.extend({
    initialize: function (datos, estilo, opciones) {
      L.FeatureGroup.prototype.initialize.call(this, []);
      if (!estilo || !estilo.simbolos) throw new Error('CapaArcGIS: falta el objeto de estilo (variable "<nombre>_estilo").');
      this.datos = datos;
      this.estilo = estilo;
      this.opciones = L.Util.extend({ popups: true, escalas: true, maxEtiquetas: 1500 }, opciones || {});
      var mostrar = this.opciones.etiquetas;
      this._etiquetasActivas = mostrar === undefined ? !!(estilo.etiquetas && estilo.etiquetas.visible) : !!mostrar;
      this._capaEtiquetas = L.layerGroup();
      this._pasadasVisibles = true;
      this._escala = undefined;
      this._clave = null;
      this._dependeDeEscala = dependeDeEscala(estilo);
      this._construir();
    },

    _construir: function () {
      var self = this;
      var estilo = this.estilo;
      var features = (this.datos && this.datos.features) || [];
      var renderer = this.opciones.renderer;
      // achurados y flechas son elementos SVG: requieren el renderer SVG
      if (!renderer && ((estilo.patrones && estilo.patrones.length) || tieneFlechas(estilo))) renderer = L.svg();
      if (!renderer && features.length > 3000) renderer = L.canvas({ padding: 0.5 });

      var pasadas = 1;
      estilo.simbolos.forEach(function (s) { if (s && s.capas) pasadas = Math.max(pasadas, s.capas.length); });
      this.pasadas = [];

      function enlazar(feature, capa) {
        if (self.opciones.popups && estilo.popup !== null) {
          capa.bindPopup(function () { return htmlPopup(feature, estilo); }, { maxWidth: 380, maxHeight: 420 });
        }
        if (self.opciones.alClic) capa.on('click', function (ev) { self.opciones.alClic(feature, capa, ev); });
      }

      for (var k = 0; k < pasadas; k++) {
        (function (k) {
          var pasada = L.geoJSON(null, {
            renderer: renderer,
            filter: function (f) {
              var s = simboloDe(f, estilo, self._escala);
              if (!s) return false;
              if (s.marcador) return k === 0;
              return !!(s.capas && s.capas[k]);
            },
            style: function (f) {
              var s = simboloDe(f, estilo, self._escala);
              return s && s.marcador ? {} : estiloDe(f, estilo, k, self._escala); // los marcadores ya traen su estilo
            },
            pointToLayer: function (f, latlng) {
              return marcadorDe(f, latlng, estilo, self._escala) || L.circleMarker(latlng, { radius: 0, stroke: false, fill: false });
            },
            onEachFeature: function (f, capa) {
              var s = simboloDe(f, estilo, self._escala);
              if (s && (s.marcador || pasadaInteractiva(s) === k)) enlazar(f, capa);
              if (s && s.flechas && k === s.capas.length - 1) {
                var indice = indiceSimbolo(f, estilo, self._escala);
                capa.on('add', function () {
                  if (!this._path) return;
                  if (s.flechas.fin) this._path.setAttribute('marker-end', 'url(#' + idFlecha(estilo, indice, 'fin') + ')');
                  if (s.flechas.inicio) this._path.setAttribute('marker-start', 'url(#' + idFlecha(estilo, indice, 'inicio') + ')');
                });
              }
            }
          });
          pasada.addData(self.datos);
          self.pasadas.push(pasada);
          self.addLayer(pasada);
        })(k);
      }
      this._prepararEtiquetas(features);
    },

    _prepararEtiquetas: function (features) {
      var e = this.estilo.etiquetas;
      this._etiquetas = [];
      if (!e) return;
      for (var i = 0; i < features.length; i++) {
        var f = features[i];
        if (!simboloDe(f, this.estilo)) continue;
        var texto = f._t !== undefined ? f._t : (e.campo ? f.properties[e.campo] : null);
        if (texto === null || texto === undefined || texto === '') continue;
        var punto = null;
        var esPunto = false;
        if (f._e) {
          punto = f._e;
        } else if (f.geometry && f.geometry.type === 'Point') {
          punto = f.geometry.coordinates;
          esPunto = true;
        } else if (f.geometry && f.geometry.type === 'MultiPoint' && f.geometry.coordinates.length) {
          punto = f.geometry.coordinates[0];
          esPunto = true;
        }
        if (!punto) continue;
        this._etiquetas.push({
          feature: f,
          latlng: L.latLng(punto[1], punto[0]),
          texto: apilar(String(texto), e.maxCaracteresLinea, e.maxLineas || 3),
          esPunto: esPunto
        });
      }
    },

    // Vuelve a cargar los features (cuando cambian filtros, simbolos alternos o tamanos por escala).
    _rellenar: function () {
      var datos = this.datos;
      this.pasadas.forEach(function (p) {
        p.clearLayers();
        p.addData(datos);
      });
    },

    onAdd: function (mapa) {
      asegurarPatrones(this.estilo);
      L.FeatureGroup.prototype.onAdd.call(this, mapa);
      if (!mapa.getPane(PANEL_ETIQUETAS)) {
        var panel = mapa.createPane(PANEL_ETIQUETAS);
        panel.style.zIndex = 640;
        panel.style.pointerEvents = 'none';
      }
      mapa.on('zoomend moveend', this._actualizar, this);
      this._actualizar();
    },

    onRemove: function (mapa) {
      mapa.off('zoomend moveend', this._actualizar, this);
      mapa.removeLayer(this._capaEtiquetas);
      L.FeatureGroup.prototype.onRemove.call(this, mapa);
      this._pasadasVisibles = true;
    },

    _actualizar: function () {
      var mapa = this._map;
      if (!mapa) return;
      var escala = escalaDelMapa(mapa);
      // con escalas:false se ignoran tambien filtros, simbolos alternos y tamanos por escala
      this._escala = this.opciones.escalas ? escala : undefined;
      if (this._dependeDeEscala && this.opciones.escalas) {
        var clave = claveDeEscala(this.estilo, escala);
        if (clave !== this._clave) {
          this._clave = clave;
          this._rellenar();
        }
      }
      var visible = !this.opciones.escalas || enRangoDeEscala(escala, this.estilo.escalaMin, this.estilo.escalaMax);
      if (visible !== this._pasadasVisibles) {
        this._pasadasVisibles = visible;
        this.pasadas.forEach(function (p) {
          if (visible) mapa.addLayer(p); else mapa.removeLayer(p);
        });
      }
      this._dibujarEtiquetas(visible, escala);
    },

    _dibujarEtiquetas: function (capaVisible, escala) {
      var mapa = this._map;
      var e = this.estilo.etiquetas;
      this._capaEtiquetas.clearLayers();
      if (!e || !this._etiquetasActivas || !capaVisible ||
          (this.opciones.escalas && !enRangoDeEscala(escala, e.escalaMin, e.escalaMax))) {
        mapa.removeLayer(this._capaEtiquetas);
        return;
      }
      var limites = mapa.getBounds().pad(0.05);
      var tam = (e.estilo && e.estilo.tamano) || 13;
      if (e.estilo && e.estilo.variacionEscala) tam = Math.round(interpolarPorEscala(e.estilo.variacionEscala, escala) * 10) / 10;
      var css = cssEtiqueta(e, tam);
      var margenFondo = e.estilo && e.estilo.fondo ? e.estilo.fondo.margen : [0, 0, 0, 0];
      var colocadas = [];
      var cuenta = 0;
      for (var i = 0; i < this._etiquetas.length && cuenta < this.opciones.maxEtiquetas; i++) {
        var et = this._etiquetas[i];
        if (!limites.contains(et.latlng)) continue;
        if (!simboloDe(et.feature, this.estilo, this._escala)) continue;
        var lineas = et.texto.split('\n');
        var largo = 0;
        lineas.forEach(function (l) { if (l.length > largo) largo = l.length; });
        var ancho = largo * tam * 0.58 + margenFondo[1] + margenFondo[3];
        var alto = lineas.length * tam * 1.15 + margenFondo[0] + margenFondo[2];
        var p = mapa.latLngToContainerPoint(et.latlng);
        var dx = et.esPunto ? e.desplazamiento + 4 : -ancho / 2;
        var dy = et.esPunto ? -alto - e.desplazamiento : -alto / 2;
        var caja = [p.x + dx - 2, p.y + dy - 2, p.x + dx + ancho + 2, p.y + dy + alto + 2];
        if (e.evitarSuperposicion) {
          var choca = false;
          for (var j = 0; j < colocadas.length; j++) {
            var c = colocadas[j];
            if (caja[0] < c[2] && caja[2] > c[0] && caja[1] < c[3] && caja[3] > c[1]) { choca = true; break; }
          }
          if (choca) continue;
          colocadas.push(caja);
        }
        var transform = et.esPunto
          ? 'translate(' + (e.desplazamiento + 4) + 'px,calc(-100% - ' + e.desplazamiento + 'px))'
          : 'translate(-50%,-50%)';
        L.marker(et.latlng, {
          pane: PANEL_ETIQUETAS,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'capa-arcgis-etiqueta',
            iconSize: null,
            html: '<div style="position:absolute;left:0;top:0;transform:' + transform + ';' + css + '">' + escaparHtml(et.texto) + '</div>'
          })
        }).addTo(this._capaEtiquetas);
        cuenta++;
      }
      if (!mapa.hasLayer(this._capaEtiquetas)) mapa.addLayer(this._capaEtiquetas);
    },

    mostrarEtiquetas: function (activas) {
      this._etiquetasActivas = !!activas;
      this._actualizar();
      return this;
    },

    leyenda: function (opciones) {
      return crearLeyenda(this.estilo, opciones);
    }
  });

  // --- Leyenda -----------------------------------------------------------------------------

  function muestraSimbolo(simbolo, estilo, indice) {
    if (!simbolo) return '';
    if (simbolo.marcador) {
      var m = simbolo.marcador;
      if (m.tipo === 'circulo') {
        var r = Math.min(9, m.radio);
        return '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="' + r + '"' +
          ' fill="' + (m.relleno ? m.relleno.color : 'none') + '" fill-opacity="' + (m.relleno ? m.relleno.opacidad : 0) + '"' +
          (m.borde ? ' stroke="' + m.borde.color + '" stroke-opacity="' + m.borde.opacidad + '" stroke-width="' + Math.min(3, m.borde.grosor) + '"' : '') + '/></svg>';
      }
      var factor = Math.min(1, 20 / Math.max(m.ancho, m.alto));
      return '<span style="display:inline-block;width:' + Math.round(m.ancho * factor) + 'px;height:' + Math.round(m.alto * factor) + 'px">' +
        m.svg.replace(/width="[^"]*" height="[^"]*"/, 'width="100%" height="100%"') + '</span>';
    }
    var partes = (simbolo.capas || []).map(function (c) {
      var esLinea = estilo.geometria === 'linea';
      var atributos = '';
      if (c.relleno && !esLinea) {
        atributos += c.relleno.patron !== undefined
          ? ' fill="url(#' + idPatron(estilo, c.relleno.patron) + ')"'
          : ' fill="' + c.relleno.color + '" fill-opacity="' + c.relleno.opacidad + '"';
      } else {
        atributos += ' fill="none"';
      }
      if (c.trazo) {
        atributos += ' stroke="' + c.trazo.color + '" stroke-opacity="' + c.trazo.opacidad + '" stroke-width="' + Math.min(4, c.trazo.grosor) + '"' +
          (c.trazo.guiones ? ' stroke-dasharray="' + c.trazo.guiones + '"' : '');
      }
      if (esLinea && simbolo.flechas && simbolo.flechas.fin) atributos += ' marker-end="url(#' + idFlecha(estilo, indice, 'fin') + ')"';
      return esLinea ? '<path d="M2 10 L22 10"' + atributos + '/>' : '<rect x="1.5" y="2.5" width="21" height="15"' + atributos + '/>';
    });
    return '<svg width="24" height="20" viewBox="0 0 24 20">' + partes.join('') + '</svg>';
  }

  function crearLeyenda(estiloOCapa, opciones) {
    var estilo = estiloOCapa && estiloOCapa.estilo ? estiloOCapa.estilo : estiloOCapa;
    opciones = L.Util.extend({ position: 'bottomright', titulo: estilo.nombre }, opciones || {});
    var control = L.control({ position: opciones.position });
    control.onAdd = function () {
      asegurarPatrones(estilo);
      var div = L.DomUtil.create('div', 'capa-arcgis-leyenda');
      var html = '<div class="capa-arcgis-leyenda-titulo">' + escaparHtml(opciones.titulo || '') + '</div>';
      if (estilo.titulo && estilo.titulo !== opciones.titulo) html += '<div class="capa-arcgis-leyenda-subtitulo">' + escaparHtml(estilo.titulo) + '</div>';
      var items = (estilo.leyenda || []).map(function (item) {
        return '<div class="capa-arcgis-leyenda-item">' + muestraSimbolo(estilo.simbolos[item.s], estilo, item.s) +
          '<span>' + escaparHtml(item.etiqueta === undefined || item.etiqueta === null ? '' : item.etiqueta) + '</span></div>';
      }).join('');
      // Leyendas largas (p. ej. una clase por municipio) se muestran plegadas
      var limite = opciones.maxSinPlegar === undefined ? 25 : opciones.maxSinPlegar;
      html += (estilo.leyenda || []).length > limite
        ? '<details><summary>' + estilo.leyenda.length + ' clases</summary>' + items + '</details>'
        : items;
      div.innerHTML = html;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };
    return control;
  }

  // --- Estilos CSS base ----------------------------------------------------------------------

  function insertarCss() {
    if (!document.head || document.getElementById('capas-arcgis-css')) return;
    var css = document.createElement('style');
    css.id = 'capas-arcgis-css';
    css.textContent =
      '.capa-arcgis-marcador,.capa-arcgis-etiqueta{background:none;border:none}' +
      '.capa-arcgis-popup{font:12px/1.4 Arial,Verdana,sans-serif}' +
      '.capa-arcgis-popup-titulo{font-weight:bold;font-size:13px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #ddd}' +
      '.capa-arcgis-popup table{border-collapse:collapse;width:100%}' +
      '.capa-arcgis-popup th{text-align:left;color:#555;font-weight:normal;padding:2px 10px 2px 0;vertical-align:top;white-space:nowrap}' +
      '.capa-arcgis-popup td{padding:2px 0;word-break:break-word}' +
      '.capa-arcgis-popup tr:nth-child(even){background:#f6f6f6}' +
      '.capa-arcgis-leyenda{background:#fff;padding:8px 10px;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.4);font:12px Arial,sans-serif;max-height:60vh;overflow:auto;max-width:280px}' +
      '.capa-arcgis-leyenda-titulo{font-weight:bold;margin-bottom:4px}' +
      '.capa-arcgis-leyenda-subtitulo{color:#555;margin-bottom:4px}' +
      '.capa-arcgis-leyenda-item{display:flex;align-items:center;gap:6px;margin:2px 0}' +
      '.capa-arcgis-leyenda-item svg{flex:none}';
    document.head.appendChild(css);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', insertarCss);
    else insertarCss();
  }

  raiz.CapaArcGIS = {
    crear: function (datos, estilo, opciones) { return new CapaArcGISLayer(datos, estilo, opciones); },
    leyenda: crearLeyenda,
    estiloDe: estiloDe,
    htmlPopup: htmlPopup,
    escalaDelMapa: escalaDelMapa,
    Capa: CapaArcGISLayer
  };
})(typeof window !== 'undefined' ? window : this);
