// Mapa interactivo (index.html): secciones 2016-2024 (bivariada), colonias, cerradas y las respuestas
// del Conglomerado RL (datos/conglomerado-rl.js). Consume datos/*.js, app.js, conglomerado.js y analisis.js.

(function () {
  var C = APP.C, fmt = APP.fmt, pct = APP.pct, esc = APP.escapar, titulo = APP.titulo;
  var MODELO = null;

  // ---------------------------------------------------------------- mapa base
  var limites = L.geoJSON(mCUU1624).getBounds();
  // fadeAnimation: false para que "Guardar vista" capture los mosaicos recien cargados
  // abre en la mancha urbana; el boton de distritos o el zoom permiten ver todo el municipio
  var VISTA_INICIAL = [[28.57, -106.18], [28.75, -105.99]];
  var map = L.map('map', { zoomSnap: 0.5, minZoom: 9, fadeAnimation: false }).fitBounds(VISTA_INICIAL);
  var bases = {
    'Claro': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, maxNativeZoom: 16, crossOrigin: true, attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap'
    }),
    'Calles': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, attribution: '&copy; OpenStreetMap' })
  };
  bases['Claro'].addTo(map);
  L.control.layers(bases, null, { position: 'bottomright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  // ---------------------------------------------------------------- estado
  var ESTADO = {
    dl: [], df: [], filtros: {}, colorearPor: 'candidato',
    capas: { secciones: true, encuestados: true, colonias: true, cerradas: true },
    secciones: new Set(),   // secciones seleccionadas para el resumen de secciones
    filas: new Set()        // respuestas seleccionadas en la tabla
  };
  var CAPAS = [
    { clave: 'secciones', etiqueta: 'Secciones 2016–2024' },
    { clave: 'encuestados', etiqueta: 'Encuestados' },
    { clave: 'colonias', etiqueta: 'Colonias' },
    { clave: 'cerradas', etiqueta: 'Cerradas' }
  ];

  // ---------------------------------------------------------------- capas geograficas
  var capaSecciones = null, capaSeleccion = L.layerGroup(), capaColonias = null, capaCerradas = null, capaEncuestados = L.featureGroup();

  function seccionEnDistrito(p) {
    if (ESTADO.dl.length && ESTADO.dl.indexOf(String(p.DISTRITO_L)) === -1) return false;
    if (ESTADO.df.length && ESTADO.df.indexOf(String(p.DISTRITO)) === -1) return false;
    return true;
  }
  function seccionesVisibles() { return mCUU1624.features.filter(function (f) { return seccionEnDistrito(f.properties); }); }

  function dibujarSecciones() {
    if (capaSecciones) map.removeLayer(capaSecciones);
    // se conserva la simbologia bivariada de ArcGIS (colores, transparencia y contornos)
    capaSecciones = CapaArcGIS.crear({ type: 'FeatureCollection', features: seccionesVisibles() }, mCUU1624_estilo, { popups: false, alClic: clicSeccion });
    dibujarSeleccion();
  }
  function dibujarSeleccion() {
    capaSeleccion.clearLayers();
    mCUU1624.features.forEach(function (f) {
      if (ESTADO.secciones.has(f.properties.SECCION) && seccionEnDistrito(f.properties)) {
        L.geoJSON(f, { interactive: false, style: { color: C.oxido, weight: 3, opacity: 1, fill: false } }).addTo(capaSeleccion);
      }
    });
    var n = ESTADO.secciones.size;
    document.getElementById('secciones_contador_sel').textContent = n;
    document.getElementById('secciones_limpiar_btn').style.display = n ? 'inline-flex' : 'none';
  }
  function clicSeccion(feature, capa, ev) {
    var s = feature.properties.SECCION;
    if (ESTADO.secciones.has(s)) ESTADO.secciones.delete(s); else ESTADO.secciones.add(s);
    dibujarSeleccion();
    ordenarCapas();
    L.popup({ maxWidth: 360 }).setLatLng(ev.latlng).setContent(popupSeccion(feature.properties)).openOn(map);
  }
  function popupSeccion(p) {
    var r = APP.sumar2024([p]);
    var filas = r.grupos.filter(function (g) { return g.votos > 0; }).map(function (g) {
      var detalle = g.partidos.length ? '<div class="vw-popup-desglose">' + g.partidos.map(function (x) { return esc(x.etiqueta) + ' ' + fmt(x.votos); }).join(' · ') + '</div>' : '';
      return '<tr><td class="k"><span class="vw-chip" style="background:' + (APP.COLOR_PARTIDO[g.etiqueta] || C.carbon) + '"></span> ' + esc(g.etiqueta) + detalle + '</td><td>' + fmt(g.votos) + ' · ' + pct(r.votos ? g.votos / r.votos : 0) + '</td></tr>';
    }).join('');
    var enc = '';
    if (MODELO) {
      var resp = filtrarRegistros().filter(function (x) { return x.seccion === String(p.SECCION); });
      if (resp.length) {
        var c = APP.contar(resp, function (x) { return x.cand; });
        var top = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 3);
        enc = '<div class="vw-popup-sub" style="margin-top:8px">Encuesta en la sección (' + fmt(resp.length) + ' respuestas)</div><div class="vw-popup-texto">' +
          top.map(function (k) { return esc(k) + ' ' + pct(c[k] / resp.length, 0); }).join(' · ') + '</div>';
      }
    }
    return '<div class="vw-popup"><div class="vw-popup-sub">DL ' + p.DISTRITO_L + ' // DF ' + p.DISTRITO + '</div><div class="vw-popup-titulo">Sección ' + p.SECCION + '</div>' +
      '<div class="vw-popup-prioridad" style="background:' + (APP.COLOR_PARTIDO[p.F2024___GANADOR] || C.carbon) + '">2024 · ' + esc(p.F2024___GANADOR || 'Sin dato') + '</div>' +
      '<table style="margin-top:8px"><tr><td class="k">Lista nominal</td><td>' + fmt(r.lista) + '</td></tr><tr><td class="k">Votación total</td><td>' + fmt(r.votos) +
      ' · ' + pct(r.participacion) + '</td></tr>' + filas + '</table>' + enc +
      '<div class="vw-popup-nota">Clic de nuevo en la sección para quitarla de la selección.</div></div>';
  }

  function construirColonias() {
    // tal cual la capa de ArcGIS: contorno punteado y etiqueta con el nombre
    capaColonias = CapaArcGIS.crear(colonias, colonias_estilo);
  }
  function construirCerradas() {
    capaCerradas = L.geoJSON(cerradas, {
      style: { color: '#ff0000', weight: 1, opacity: 1, fill: true, fillColor: '#ff0000', fillOpacity: 0.05 },
      onEachFeature: function (f, capa) {
        var p = f.properties;
        capa.bindPopup('<div class="vw-popup"><div class="vw-popup-sub">Cerrada</div><div class="vw-popup-titulo">' + esc(p.Colonia || 'Sin nombre') +
          '</div><table><tr><td class="k">Código postal</td><td>' + esc(p.CP || '—') + '</td></tr><tr><td class="k">Municipio</td><td>' + esc(titulo(p.MUNICIPIO_N || '')) + '</td></tr></table></div>');
      }
    });
  }

  // ---------------------------------------------------------------- respuestas del Conglomerado
  function filtro(col) { return ESTADO.filtros[col] && ESTADO.filtros[col].length ? ESTADO.filtros[col] : null; }
  function filtrarRegistros() {
    if (!MODELO) return [];
    var activos = APP.FILTROS.filter(function (d) { return filtro(d.col); });
    return MODELO.registros.filter(function (r) {
      if (ESTADO.dl.length && ESTADO.dl.indexOf(r.dl) === -1) return false;
      if (ESTADO.df.length && ESTADO.df.indexOf(r.df) === -1) return false;
      for (var i = 0; i < activos.length; i++) {
        if (filtro(activos[i].col).indexOf(APP.valorFiltro(activos[i], r)) === -1) return false;
      }
      return true;
    });
  }
  function colorRegistro(r) {
    if (ESTADO.colorearPor === 'sexo') return APP.COLOR_SEXO[r.sexo] || C.carbon;
    if (ESTADO.colorearPor === 'edad') return APP.COLOR_EDAD[r.edadRango] || C.carbon;
    if (ESTADO.colorearPor === 'confianza') return APP.COLOR_CONFIANZA[r.confianza] || C.carbon;
    if (ESTADO.colorearPor === 'cambio') return r.tel_.cambia ? C.oxido : C.tinta400;
    return APP.colorCandidato(r.cand);
  }
  // Una persona = un punto, con su respuesta mas reciente dentro de los filtros
  var marcadorPorTel = {};
  function dibujarEncuestados(registros) {
    capaEncuestados.clearLayers();
    marcadorPorTel = {};
    var ultima = {};
    registros.forEach(function (r) {
      if (r.lat === null && !(r.persona && r.persona.ficha && r.persona.ficha.lat !== null)) return;
      var u = ultima[r.tel];
      if (!u || r.orden > u.orden) ultima[r.tel] = r;
    });
    Object.keys(ultima).forEach(function (tel) {
      var r = ultima[tel], f = r.persona ? r.persona.ficha : r;
      var sel = estaSeleccionado(tel);
      var m = L.circleMarker([f.lat, f.lon], {
        radius: sel ? 8 : 5, fillColor: colorRegistro(r), fillOpacity: 0.9, color: sel ? C.oxido : '#ffffff', weight: sel ? 3 : 1
      }).bindPopup(function () { return popupPersona(r.persona || { tel: tel, ficha: f, opiniones: [], registros: [r] }); }, { maxWidth: 360 });
      m.addTo(capaEncuestados);
      marcadorPorTel[tel] = m;
    });
  }
  function estaSeleccionado(tel) {
    var sel = false;
    ESTADO.filas.forEach(function (n) { if (MODELO.registros[n].tel === tel) sel = true; });
    return sel;
  }
  function valorCampo(r, campo) { return MODELO.valor(r, campo); }
  function popupPersona(p) {
    var f = p.ficha;
    var filas = [
      ['Teléfono', esc(p.tel)], ['Sexo · Edad', esc(f.sexo) + ' · ' + esc(valorCampo(f, 'edad') || '—')],
      ['Sección · Colonia', esc(f.seccion) + ' · ' + esc(f.colonia || '—')], ['Distrito local · federal', esc(f.dl) + ' · ' + esc(f.df)],
      ['Servidor público', esc(valorCampo(f, 'servidor') === '0' ? 'No' : valorCampo(f, 'servidor') || '—')],
      ['Partido nacional', esc(f.partido)], ['Confianza de ubicación', esc(f.confianza)]
    ].map(function (x) { return '<tr><td class="k">' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('');
    var historial = (p.opiniones || []).map(function (o) {
      return '<div class="cg-hist"><span>' + esc(o.hoja) + '</span>' + o.candidatos.map(function (c) {
        return '<b style="background:' + APP.colorCandidato(c) + '">' + esc(c) + '</b>';
      }).join('') + '</div>';
    }).join('');
    return '<div class="vw-popup"><div class="vw-popup-sub">' + (p.cambia ? 'Cambió de opinión' : 'Encuestado') + '</div><div class="vw-popup-titulo">' +
      esc(valorCampo(f, 'nombre') || 'Sin nombre') + '</div><table>' + filas + '</table>' +
      (historial ? '<div class="vw-popup-sub" style="margin-top:8px">Opiniones</div>' + historial : '') +
      '<a class="vw-popup-enlace" href="#" data-ficha="' + esc(p.tel) + '">Ver ficha completa</a></div>';
  }
  map.on('popupopen', function (e) {
    var a = e.popup.getElement().querySelector('[data-ficha]');
    if (a) a.addEventListener('click', function (ev) { ev.preventDefault(); verFicha(a.getAttribute('data-ficha')); });
  });
  function verFicha(tel) {
    var p = MODELO.personaPorTel[tel];
    if (!p) return;
    var f = p.ficha || p.registros[0];
    crearVentana('Ficha — ' + (MODELO.valor(f, 'nombre') || tel), null, null, function (cuerpo) {
      cuerpo.innerHTML = tablaHtml(['Campo', 'Valor'], MODELO.columnas.map(function (c, i) { return [c, f.fila[i]]; })) +
        '<div class="ventana-seccion"><b>Opiniones registradas</b></div>' +
        tablaHtml(['Fecha', 'Candidato'], p.opiniones.map(function (o) { return [o.hoja, o.candidatos.join(' / ')]; }));
    });
  }

  // ---------------------------------------------------------------- redibujo general
  var VISTA = { registros: [] };
  function redibujar() {
    var regs = filtrarRegistros();
    VISTA.registros = regs;
    dibujarEncuestados(regs);
    construirLeyenda();
    construirTabla();
    var tels = new Set(regs.map(function (r) { return r.tel; }));
    var personas = new Set(regs.filter(function (r) { return r.persona; }).map(function (r) { return r.tel; }));
    var txt = MODELO ? fmt(regs.length) + ' respuestas · ' + fmt(tels.size) + ' teléfonos' : 'Sin datos del Conglomerado';
    document.getElementById('contador_header').textContent = txt;
    document.getElementById('contador').textContent = MODELO ? txt + ' · ' + fmt(personas.size) + ' emparejados' : 'Falta datos/conglomerado-rl.js';
    document.getElementById('btnResumen').disabled = !MODELO;
  }
  function sincronizarCapas() {
    var pares = [['secciones', capaSecciones], ['secciones', capaSeleccion], ['cerradas', capaCerradas], ['colonias', capaColonias], ['encuestados', capaEncuestados]];
    pares.forEach(function (p) {
      if (!p[1]) return;
      var on = ESTADO.capas[p[0]];
      if (on && !map.hasLayer(p[1])) p[1].addTo(map);
      if (!on && map.hasLayer(p[1])) map.removeLayer(p[1]);
    });
    ordenarCapas();
  }
  function ordenarCapas() {
    // todas las capas vectoriales comparten un solo SVG: el orden de dibujo es el de este arreglo
    [capaSecciones, capaCerradas, capaColonias, capaSeleccion, capaEncuestados].forEach(function (c) {
      if (c && map.hasLayer(c) && c.bringToFront) c.bringToFront();
      if (c === capaSeleccion && map.hasLayer(c)) c.eachLayer(function (l) { l.bringToFront(); });
    });
  }

  // ---------------------------------------------------------------- leyenda
  function filaLeyenda(color, texto, forma) {
    return '<div class="leyenda-color-fila"><span class="leyenda-color-muestra' + (forma ? ' ' + forma : '') + '" style="background:' + color + '"></span><span>' + esc(texto) + '</span></div>';
  }
  function leyendaBivariada() {
    var color = {};
    mCUU1624_estilo.leyenda.forEach(function (it) {
      var m = /\(([A-Z0-9]+)\)/.exec(it.etiqueta || '');
      var s = mCUU1624_estilo.simbolos[it.s];
      if (m && s && s.capas && s.capas[0] && s.capas[0].relleno) color[m[1]] = s.capas[0].relleno.color;
    });
    var niveles = ['L', 'M1', 'M2', 'H'], celdas = '';
    for (var i = 3; i >= 0; i--) for (var j = 0; j < 4; j++) {
      var k = niveles[i] + niveles[j];
      celdas += '<div title="PAN ' + niveles[i] + ' / Oposición ' + niveles[j] + '" style="background:' + (color[k] || '#eee') + '"></div>';
    }
    return '<div class="leyenda-seccion">Secciones — PAN vs oposición (% votación)</div><div class="leyenda-biv"><div class="leyenda-biv-y">PAN ↑</div>' +
      '<div class="leyenda-biv-grid">' + celdas + '</div></div><div class="leyenda-biv-x">Oposición →</div>';
  }
  function construirLeyenda() {
    var html = '';
    if (ESTADO.capas.encuestados && MODELO) {
      var t = { candidato: 'Encuestados — candidato', sexo: 'Encuestados — sexo', edad: 'Encuestados — edad', confianza: 'Encuestados — confianza de ubicación', cambio: 'Encuestados — cambio de opinión' };
      html += '<div class="leyenda-seccion">' + t[ESTADO.colorearPor] + '</div>';
      if (ESTADO.colorearPor === 'sexo') ['Mujer', 'Hombre'].forEach(function (s) { html += filaLeyenda(APP.COLOR_SEXO[s], s); });
      else if (ESTADO.colorearPor === 'edad') APP.EDADES.slice(0, 4).forEach(function (e) { html += filaLeyenda(APP.COLOR_EDAD[e], e); });
      else if (ESTADO.colorearPor === 'confianza') APP.CONFIANZAS.slice(0, 5).forEach(function (e) { html += filaLeyenda(APP.COLOR_CONFIANZA[e], e); });
      else if (ESTADO.colorearPor === 'cambio') { html += filaLeyenda(C.oxido, 'Cambió de opinión'); html += filaLeyenda(C.tinta400, 'Opinión constante'); }
      else MODELO.candidatos.forEach(function (c) { html += filaLeyenda(APP.colorCandidato(c), c); });
      html += '<div class="leyenda-nota">Un punto por persona emparejada; respuesta más reciente.</div>';
    }
    if (ESTADO.capas.secciones) html += leyendaBivariada();
    if (ESTADO.capas.cerradas) html += '<div class="leyenda-seccion">Cerradas</div>' + filaLeyenda('#ffffff', 'Perímetro de cerrada', 'cerrada');
    if (ESTADO.capas.colonias) html += '<div class="leyenda-seccion">Colonias</div>' + filaLeyenda('#ffffff', 'Límite de colonia', 'colonia');
    document.getElementById('leyenda_color_cuerpo').innerHTML = html || '<div class="leyenda-nota">Sin capas encendidas.</div>';
  }
  document.getElementById('leyenda_color_toggle').addEventListener('click', function () {
    document.getElementById('leyenda_color').classList.toggle('leyenda-color-colapsada');
  });

  // ---------------------------------------------------------------- HUD superior
  function botonHud(texto, alClic) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'kt-btn kt-btn-sm kt-btn-outline hud-btn';
    b.textContent = texto;
    b.addEventListener('click', alClic);
    return b;
  }
  function hudDistritos(id, valores, campo) {
    var hud = document.getElementById(id);
    var todos = botonHud('Todos', function () { ESTADO[campo] = []; alCambiarDistrito(); });
    todos.dataset.todos = '1';
    hud.appendChild(todos);
    valores.forEach(function (v) {
      var b = botonHud(v, function () {
        var i = ESTADO[campo].indexOf(v);
        if (i === -1) ESTADO[campo].push(v); else ESTADO[campo].splice(i, 1);
        alCambiarDistrito();
      });
      b.dataset.valor = v;
      hud.appendChild(b);
    });
  }
  hudDistritos('hud_dl', APP.DISTRITOS_LOCALES, 'dl');
  hudDistritos('hud_df', APP.DISTRITOS_FEDERALES, 'df');
  var hudCapas = document.getElementById('hud_capas_botones');
  CAPAS.forEach(function (c) {
    var b = botonHud(c.etiqueta, function () { ESTADO.capas[c.clave] = !ESTADO.capas[c.clave]; actualizarHud(); sincronizarCapas(); construirLeyenda(); });
    b.dataset.capa = c.clave;
    hudCapas.appendChild(b);
  });
  function actualizarHud() {
    [['hud_dl', 'dl'], ['hud_df', 'df']].forEach(function (h) {
      document.querySelectorAll('#' + h[0] + ' .hud-btn').forEach(function (b) {
        b.classList.toggle('hud-btn-activo', b.dataset.todos ? ESTADO[h[1]].length === 0 : ESTADO[h[1]].indexOf(b.dataset.valor) !== -1);
      });
    });
    hudCapas.querySelectorAll('.hud-btn').forEach(function (b) { b.classList.toggle('hud-btn-activo', !!ESTADO.capas[b.dataset.capa]); });
  }
  function alCambiarDistrito() {
    actualizarHud();
    dibujarSecciones();
    sincronizarCapas();
    redibujar();
    var b = L.geoJSON({ type: 'FeatureCollection', features: seccionesVisibles() }).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [10, 10] });
  }
  document.getElementById('secciones_limpiar_btn').addEventListener('click', function () { ESTADO.secciones.clear(); dibujarSeleccion(); });

  // ---------------------------------------------------------------- "Colorear encuestados por" (seleccion unica)
  (function () {
    var select = document.getElementById('colorear_por');
    var boton = document.getElementById('colorear_por_btn');
    var lista = document.getElementById('colorear_por_lista');
    function pintar() {
      boton.textContent = select.options[select.selectedIndex].textContent;
      lista.querySelectorAll('.filtro-opcion').forEach(function (op) { op.classList.toggle('filtro-opcion-activa', op.dataset.valor === select.value); });
    }
    Array.from(select.options).forEach(function (opt) {
      var op = document.createElement('div');
      op.className = 'filtro-opcion';
      op.dataset.valor = opt.value;
      op.textContent = opt.textContent;
      op.addEventListener('click', function () {
        lista.classList.remove('abierta');
        if (select.value === opt.value) return;
        select.value = opt.value;
        pintar();
        select.dispatchEvent(new Event('change'));
      });
      lista.appendChild(op);
    });
    lista.addEventListener('click', function (e) { e.stopPropagation(); });
    boton.addEventListener('click', function (e) {
      e.stopPropagation();
      var abierta = lista.classList.contains('abierta');
      cerrarListas(lista);
      lista.classList.toggle('abierta', !abierta);
    });
    select.addEventListener('change', function () { ESTADO.colorearPor = select.value; redibujar(); });
    pintar();
  })();

  // ---------------------------------------------------------------- filtros laterales (Conglomerado)
  var checksPorColumna = {};
  function cerrarListas(excepto) { document.querySelectorAll('.filtro-lista').forEach(function (l) { if (l !== excepto) l.classList.remove('abierta'); }); }
  document.addEventListener('click', function () { cerrarListas(null); });
  function textoBoton(col) {
    var s = ESTADO.filtros[col];
    if (!s || !s.length) return '-- Todos --';
    return s.length === 1 ? s[0] : s.length + ' seleccionados';
  }
  function establecerFiltro(col, valores) {
    if (!valores.length) delete ESTADO.filtros[col]; else ESTADO.filtros[col] = valores.slice();
    document.getElementById('btn_' + col).textContent = textoBoton(col);
    var reg = checksPorColumna[col];
    var marcados = reg.checks.filter(function (c) { c.checked = valores.indexOf(c.value) !== -1; return c.checked; }).length;
    reg.todos.checked = marcados === reg.checks.length;
    reg.todos.indeterminate = marcados > 0 && marcados < reg.checks.length;
    redibujar();
  }
  function construirFiltros() {
    var cont = document.getElementById('filtros');
    cont.innerHTML = '';
    checksPorColumna = {};
    ESTADO.filtros = {};
    if (!MODELO) return;
    APP.FILTROS.forEach(function (def) {
      var col = def.col, valores = APP.valoresFiltro(def, MODELO);
      var div = document.createElement('div');
      div.className = 'filtro';
      var label = document.createElement('label');
      label.className = 'filtro-label';
      label.textContent = col;
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'kt-btn kt-btn-outline w-full justify-start filtro-btn';
      boton.id = 'btn_' + col;
      boton.textContent = '-- Todos --';
      var lista = document.createElement('div');
      lista.className = 'filtro-lista';
      lista.addEventListener('click', function (e) { e.stopPropagation(); });
      var optTodos = document.createElement('label');
      optTodos.className = 'todos';
      var chkTodos = document.createElement('input');
      chkTodos.type = 'checkbox';
      optTodos.appendChild(chkTodos);
      optTodos.appendChild(document.createTextNode('Seleccionar todos'));
      lista.appendChild(optTodos);
      var checks = [];
      valores.forEach(function (v) {
        var opt = document.createElement('label');
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = v;
        chk.addEventListener('change', function () {
          var actual = (ESTADO.filtros[col] || []).slice();
          if (chk.checked) actual.push(v); else actual = actual.filter(function (x) { return x !== v; });
          establecerFiltro(col, actual);
        });
        opt.appendChild(chk);
        opt.appendChild(document.createTextNode(v));
        lista.appendChild(opt);
        checks.push(chk);
      });
      chkTodos.addEventListener('change', function () { establecerFiltro(col, chkTodos.checked ? valores : []); });
      boton.addEventListener('click', function (e) {
        e.stopPropagation();
        var abierta = lista.classList.contains('abierta');
        cerrarListas(lista);
        lista.classList.toggle('abierta', !abierta);
      });
      checksPorColumna[col] = { todos: chkTodos, checks: checks };
      div.appendChild(label);
      div.appendChild(boton);
      div.appendChild(lista);
      cont.appendChild(div);
    });
  }
  document.getElementById('reset').addEventListener('click', function (e) {
    e.stopPropagation();
    Object.keys(checksPorColumna).forEach(function (col) {
      document.getElementById('btn_' + col).textContent = '-- Todos --';
      checksPorColumna[col].checks.forEach(function (c) { c.checked = false; });
      checksPorColumna[col].todos.checked = false;
      checksPorColumna[col].todos.indeterminate = false;
    });
    ESTADO.filtros = {};
    ESTADO.dl = [];
    ESTADO.df = [];
    alCambiarDistrito();
  });
  document.getElementById('filtros_toggle').addEventListener('click', function () { document.getElementById('filtros_sidebar').classList.toggle('filtros-colapsado'); });
  document.getElementById('filtros_sidebar').addEventListener('transitionend', function (e) { if (e.propertyName === 'width') map.invalidateSize(); });
  document.querySelector('.kt-wrapper').addEventListener('transitionend', function (e) { if (e.propertyName === 'padding-inline-start') map.invalidateSize(); });

  // ---------------------------------------------------------------- tabla de datos (todas las columnas del Conglomerado)
  var LIMITE_TABLA = 500;
  var ordenTabla = { i: null, dir: 1 };
  function construirTabla() {
    var thead = document.querySelector('#tabla_datos thead'), tbody = document.querySelector('#tabla_datos tbody');
    if (!MODELO) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td class="cg-vacio">Falta datos/conglomerado-rl.js: ejecute python herramientas/excel_a_js.py.</td></tr>';
      document.getElementById('tabla_datos_titulo').textContent = 'Tabla de datos — sin datos del Conglomerado';
      return;
    }
    if (!thead.children.length) {
      var tr = document.createElement('tr');
      MODELO.columnas.forEach(function (c, i) {
        var th = document.createElement('th');
        th.textContent = c;
        th.className = 'col-ordenable';
        th.dataset.i = i;
        th.addEventListener('click', function () {
          ordenTabla = ordenTabla.i === i ? { i: i, dir: -ordenTabla.dir } : { i: i, dir: 1 };
          construirTabla();
        });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }
    thead.querySelectorAll('th').forEach(function (th) {
      th.classList.remove('col-orden-asc', 'col-orden-desc');
      if (+th.dataset.i === ordenTabla.i) th.classList.add(ordenTabla.dir === 1 ? 'col-orden-asc' : 'col-orden-desc');
    });
    var lista = VISTA.registros;
    if (ordenTabla.i !== null) {
      var i = ordenTabla.i, d = ordenTabla.dir;
      lista = lista.slice().sort(function (a, b) {
        var x = a.fila[i], y = b.fila[i];
        if (CG.vacio(x) && CG.vacio(y)) return 0;
        if (CG.vacio(x)) return 1;
        if (CG.vacio(y)) return -1;
        var nx = Number(x), ny = Number(y);
        if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * d;
        return String(x).localeCompare(String(y), 'es', { numeric: true }) * d;
      });
    }
    var frag = document.createDocumentFragment();
    lista.slice(0, LIMITE_TABLA).forEach(function (r) {
      var tr = document.createElement('tr');
      if (ESTADO.filas.has(r.n)) tr.classList.add('fila-seleccionada');
      r.fila.forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = CG.vacio(v) ? '-' : v;
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () { alternarFila(r); });
      frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
    var t = 'Tabla de datos — ' + fmt(lista.length) + ' fila' + (lista.length === 1 ? '' : 's');
    if (lista.length > LIMITE_TABLA) t += ' (mostrando las primeras ' + LIMITE_TABLA + ')';
    document.getElementById('tabla_datos_titulo').textContent = t;
    actualizarSeleccionFilas();
  }
  function alternarFila(r) {
    if (ESTADO.filas.has(r.n)) ESTADO.filas.delete(r.n); else ESTADO.filas.add(r.n);
    dibujarEncuestados(VISTA.registros);
    construirTabla();
    var m = marcadorPorTel[r.tel];
    if (m && ESTADO.filas.has(r.n)) { map.setView(m.getLatLng(), Math.max(map.getZoom(), 15)); m.openPopup(); }
  }
  function actualizarSeleccionFilas() {
    var n = ESTADO.filas.size;
    document.getElementById('tabla_datos_contador_sel').textContent = n;
    document.getElementById('tabla_datos_limpiar_sel_btn').style.display = n ? 'inline-flex' : 'none';
  }
  document.getElementById('tabla_datos_limpiar_sel_btn').addEventListener('click', function (e) {
    e.stopPropagation();
    ESTADO.filas.clear();
    dibujarEncuestados(VISTA.registros);
    construirTabla();
  });
  document.getElementById('tabla_descargar_btn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!MODELO) return;
    APP.descargarCsv('conglomerado-filtrado.csv', MODELO.columnas, VISTA.registros.map(function (r) { return r.fila; }));
  });
  document.getElementById('tabla_datos_toggle').addEventListener('click', function () {
    var abierta = document.getElementById('tabla_datos_wrap').classList.toggle('tabla-datos-abierta');
    document.getElementById('tabla_datos_toggle_icon').classList.toggle('tabla-datos-icono-abierto', abierta);
  });
  document.getElementById('tabla_datos_wrap').addEventListener('transitionend', function (e) { if (e.propertyName === 'max-height') map.invalidateSize(); });

  // ---------------------------------------------------------------- ventanas de resumen
  var contadorVentanas = 0;
  function hacerArrastrable(v, cab) {
    var ox = 0, oy = 0, arr = false;
    cab.addEventListener('mousedown', function (e) { arr = true; ox = e.clientX - v.offsetLeft; oy = e.clientY - v.offsetTop; });
    document.addEventListener('mousemove', function (e) { if (!arr) return; v.style.left = (e.clientX - ox) + 'px'; v.style.top = (e.clientY - oy) + 'px'; });
    document.addEventListener('mouseup', function () { arr = false; });
  }
  function describirFiltros() {
    var partes = [];
    if (ESTADO.dl.length) partes.push('DL ' + ESTADO.dl.join(', '));
    if (ESTADO.df.length) partes.push('DF ' + ESTADO.df.join(', '));
    Object.keys(ESTADO.filtros).forEach(function (col) {
      var v = ESTADO.filtros[col];
      partes.push(col + ': ' + (v.length > 4 ? v.length + ' valores' : v.join(', ')));
    });
    return partes.length ? 'Filtros — ' + partes.join(' · ') : 'Sin filtros';
  }
  function agregarBotonGuardar(botones, tituloEl, cuerpo, origen, contexto) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ventana-guardar';
    b.title = 'Guardar en Análisis manual';
    b.innerHTML = '<span class="material-symbols-outlined">bookmark_add</span><span>Guardar</span>';
    b.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      AM.modalGuardar(tituloEl.textContent, function (nombre) {
        if (AM.guardar({ titulo: nombre, origen: origen, contexto: contexto, html: cuerpo.innerHTML })) AM.aviso('Bloque guardado en Análisis manual.', { texto: 'Ver hoja', href: 'analisis.html' });
        else AM.aviso('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.', null, true);
      });
    });
    botones.insertBefore(b, botones.firstChild);
  }
  function crearVentana(tituloTxt, origen, contexto, construirCuerpo) {
    contadorVentanas++;
    var v = document.createElement('div');
    v.className = 'ventana';
    var off = (contadorVentanas - 1) % 8 * 24;
    v.style.top = (80 + off) + 'px';
    v.style.left = (340 + off) + 'px';
    var cab = document.createElement('div');
    cab.className = 'ventana-cabecera';
    var t = document.createElement('div');
    t.className = 'ventana-titulo';
    t.textContent = tituloTxt;
    var botones = document.createElement('div');
    botones.className = 'ventana-botones';
    [['_', 'Minimizar', function () { v.classList.toggle('minimizada'); }],
     ['□', 'Ampliar', function () { v.style.width = v.style.width === '780px' ? '' : '780px'; }],
     ['✕', 'Cerrar', function () { v.remove(); }]].forEach(function (d) {
      var b = document.createElement('button');
      b.textContent = d[0];
      b.title = d[1];
      b.addEventListener('click', d[2]);
      botones.appendChild(b);
    });
    cab.appendChild(t);
    cab.appendChild(botones);
    var cuerpo = document.createElement('div');
    cuerpo.className = 'ventana-cuerpo';
    construirCuerpo(cuerpo);
    v.appendChild(cab);
    v.appendChild(cuerpo);
    document.body.appendChild(v);
    if (origen) agregarBotonGuardar(botones, t, cuerpo, origen, contexto);
    hacerArrastrable(v, cab);
  }
  function barras(tit, items, maximo, formato) {
    var html = tit ? '<div class="ventana-seccion"><b>' + esc(tit) + '</b></div>' : '';
    items.forEach(function (it) {
      html += '<div class="barra-fila' + (it.sub ? ' barra-sub' : '') + '"><div class="barra-etiqueta" title="' + esc(it.etiqueta) + '">' + esc(it.etiqueta) + '</div>' +
        '<div class="barra-visual"><div class="barra-rellena" style="width:' + (maximo ? Math.max(0, it.valor) / maximo * 100 : 0) + '%;background:' + (it.color || C.pod) + '"></div></div>' +
        '<div class="barra-valor">' + (formato ? formato(it) : fmt(it.valor)) + '</div></div>';
    });
    return html;
  }
  function tablaHtml(cab, filas) {
    return '<div class="tabla-pivote-wrap"><table class="tabla-pivote"><tr>' + cab.map(function (c, i) { return '<th' + (i === 0 ? ' style="text-align:left"' : '') + '>' + esc(c) + '</th>'; }).join('') +
      '</tr>' + filas.map(function (f) { return '<tr>' + f.map(function (v, i) { return i === 0 ? '<td class="etq">' + esc(v) + '</td>' : '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }

  function resumenEncuesta() {
    var regs = VISTA.registros;
    if (!regs.length) { AM.aviso('No hay respuestas con los filtros actuales.', null, true); return; }
    var tels = new Set(regs.map(function (r) { return r.tel; }));
    var emp = new Set(regs.filter(function (r) { return r.persona; }).map(function (r) { return r.tel; }));
    var cambian = new Set(regs.filter(function (r) { return r.tel_.cambia; }).map(function (r) { return r.tel; }));
    var porCand = APP.contar(regs, function (r) { return r.cand; });
    var cands = MODELO.candidatos.filter(function (c) { return porCand[c]; });
    var hojas = MODELO.hojas.filter(function (h) { return regs.some(function (r) { return r.hoja === h; }); });
    var piv = {};
    regs.forEach(function (r) { var k = r.cand + '|' + r.hoja; piv[k] = (piv[k] || 0) + 1; });
    var porHoja = APP.contar(regs, function (r) { return r.hoja; });
    var dls = APP.DISTRITOS_LOCALES.filter(function (d) { return regs.some(function (r) { return r.dl === d; }); });
    var pivDl = {};
    regs.forEach(function (r) { if (r.dl) { var k = r.cand + '|' + r.dl; pivDl[k] = (pivDl[k] || 0) + 1; } });
    crearVentana('Resumen #' + (contadorVentanas + 1) + ' (' + fmt(regs.length) + ' respuestas)', 'Resumen de encuesta', describirFiltros(), function (cuerpo) {
      cuerpo.innerHTML =
        '<div class="resumen-total">' + fmt(regs.length) + ' respuestas · ' + fmt(tels.size) + ' teléfonos · ' + fmt(emp.size) + ' emparejados</div>' +
        '<div class="resumen-kpis"><div><span>Olas</span><b>' + fmt(hojas.length) + '</b></div><div><span>Cambiaron de opinión</span><b>' + fmt(cambian.size) + '</b></div>' +
        '<div><span>Líder</span><b>' + esc(cands[0] || '—') + '</b></div></div>' +
        barras('Preferencia (% de respuestas)', cands.map(function (c) { return { etiqueta: c, valor: porCand[c], color: APP.colorCandidato(c) }; }), porCand[cands[0]],
          function (it) { return pct(it.valor / regs.length, 1); }) +
        '<div class="ventana-seccion"><b>Candidato × fecha (% de cada fecha)</b></div>' +
        tablaHtml(['Candidato'].concat(hojas), cands.map(function (c) { return [c].concat(hojas.map(function (h) { return piv[c + '|' + h] ? pct(piv[c + '|' + h] / porHoja[h], 0) : ''; })); })) +
        (dls.length ? '<div class="ventana-seccion"><b>Candidato × distrito local (respuestas)</b></div>' +
          tablaHtml(['Candidato'].concat(dls.map(function (d) { return 'DL ' + d; })), cands.map(function (c) { return [c].concat(dls.map(function (d) { return pivDl[c + '|' + d] ? fmt(pivDl[c + '|' + d]) : ''; })); })) : '');
    });
  }
  function resumenSecciones() {
    var lista = ESTADO.secciones.size
      ? mCUU1624.features.filter(function (f) { return ESTADO.secciones.has(f.properties.SECCION); })
      : seccionesVisibles();
    var props = lista.map(function (f) { return f.properties; });
    var r = APP.sumar2024(props);
    var items = [];
    r.grupos.forEach(function (g) {
      if (!g.votos) return;
      items.push({ etiqueta: g.etiqueta, valor: g.votos, color: APP.COLOR_PARTIDO[g.etiqueta] });
      g.partidos.forEach(function (p) { if (p.votos) items.push({ etiqueta: '  ' + p.etiqueta, valor: p.votos, color: APP.COLOR_PARTIDO[p.etiqueta] || C.tinta300, sub: true }); });
    });
    var max = Math.max.apply(null, items.map(function (i) { return i.valor; }).concat([1]));
    var ganadas = Object.keys(r.ganadas).sort(function (a, b) { return r.ganadas[b] - r.ganadas[a]; });
    var porDl = {};
    props.forEach(function (p) { (porDl[p.DISTRITO_L] = porDl[p.DISTRITO_L] || []).push(p); });
    var origenTxt = ESTADO.secciones.size ? 'secciones seleccionadas' : 'secciones visibles';
    crearVentana('Resumen de secciones 2024 #' + (contadorVentanas + 1) + ' (' + fmt(props.length) + ')', 'Resumen de secciones 2024',
      'Elección 2024 · ' + fmt(props.length) + ' ' + origenTxt + ' · ' + describirFiltros(), function (cuerpo) {
        cuerpo.innerHTML =
          '<div class="resumen-total">' + fmt(props.length) + ' ' + origenTxt + ' · ' + fmt(r.votos) + ' votos · lista nominal ' + fmt(r.lista) + '</div>' +
          '<div class="resumen-kpis"><div><span>Participación 2024</span><b>' + pct(r.participacion) + '</b></div>' +
          ganadas.slice(0, 2).map(function (g) { return '<div><span>Ganó ' + esc(g) + '</span><b>' + fmt(r.ganadas[g]) + ' secc.</b></div>'; }).join('') + '</div>' +
          barras('Votación 2024 por coalición y partido', items, max, function (it) { return fmt(it.valor) + ' · ' + pct(r.votos ? it.valor / r.votos : 0, 1); }) +
          '<div class="ventana-seccion"><b>Por distrito local (% de la votación)</b></div>' +
          tablaHtml(['DL', 'Secc.', 'PAN-PRI-PRD', 'MORENA-PT', 'MC', 'Particip.'], Object.keys(porDl).sort(function (a, b) { return a - b; }).map(function (dl) {
            var x = APP.sumar2024(porDl[dl]);
            return ['DL ' + dl, fmt(x.secciones), pct(x.votos ? x.grupos[0].votos / x.votos : 0, 1), pct(x.votos ? x.grupos[1].votos / x.votos : 0, 1),
              pct(x.votos ? x.grupos[2].votos / x.votos : 0, 1), pct(x.participacion, 1)];
          }));
      });
  }
  document.getElementById('btnResumen').addEventListener('click', function (e) { e.stopPropagation(); resumenEncuesta(); });
  document.getElementById('resumen_secciones_btn').addEventListener('click', function (e) { e.stopPropagation(); resumenSecciones(); });

  // ---------------------------------------------------------------- Guardar vista (captura del mapa)
  function capturarMapa() {
    return html2canvas(document.getElementById('mapa_area'), {
      useCORS: true, backgroundColor: '#ebe8de', scale: Math.min(window.devicePixelRatio || 1, 1.5), logging: false,
      ignoreElements: function (el) {
        return el.classList && (el.classList.contains('leaflet-control-zoom') || el.classList.contains('leaflet-control-layers') || el.hasAttribute('data-html2canvas-ignore'));
      },
      onclone: function (doc) {
        // html2canvas ignora el origen del viewBox del SVG de Leaflet: se coloca en el origen del panel
        doc.querySelectorAll('#mapa_area .leaflet-overlay-pane svg').forEach(function (svg) {
          svg.style.transform = 'none'; svg.style.left = '0px'; svg.style.top = '0px';
          svg.setAttribute('viewBox', '0 0 ' + (parseFloat(svg.getAttribute('width')) || 0) + ' ' + (parseFloat(svg.getAttribute('height')) || 0));
        });
        doc.querySelectorAll('#leyenda_color, .leaflet-popup-content-wrapper').forEach(function (el) {
          el.style.setProperty('box-shadow', 'none', 'important');
          el.style.setProperty('background', '#ffffff', 'important');
          el.style.setProperty('border', '1px solid #dddad0', 'important');
        });
        doc.querySelectorAll('.leyenda-biv-y').forEach(function (el) { el.style.writingMode = 'horizontal-tb'; el.style.transform = 'rotate(-90deg)'; el.style.width = '12px'; });
      }
    }).then(function (canvas) {
      var escala = Math.min(1, 1600 / canvas.width), salida = canvas;
      if (escala < 1) {
        salida = document.createElement('canvas');
        salida.width = Math.round(canvas.width * escala);
        salida.height = Math.round(canvas.height * escala);
        salida.getContext('2d').drawImage(canvas, 0, 0, salida.width, salida.height);
      }
      return salida.toDataURL('image/jpeg', 0.85);
    });
  }
  document.getElementById('guardar_vista_btn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof html2canvas === 'undefined') { AM.aviso('No se pudo cargar el capturador de imagen. Revise la conexión a internet.', null, true); return; }
    var boton = this;
    boton.disabled = true;
    boton.classList.add('vw-map-btn-ocupado');
    var c = map.getCenter();
    var capasOn = CAPAS.filter(function (x) { return ESTADO.capas[x.clave]; }).map(function (x) { return x.etiqueta; }).join(', ');
    var contexto = 'Capas: ' + capasOn + ' · ' + describirFiltros() + ' · Centro ' + c.lat.toFixed(3) + ', ' + c.lng.toFixed(3) + ' · Zoom ' + map.getZoom();
    var resumen = document.getElementById('contador_header').textContent;
    capturarMapa().then(function (imagen) {
      AM.modalGuardar('Vista del mapa', function (nombre) {
        var html = '<div class="resumen-total">' + esc(resumen) + '</div><figure class="am-captura"><img src="' + imagen + '" alt="Captura del mapa"></figure>';
        if (AM.guardar({ titulo: nombre, origen: 'Vista del mapa', contexto: contexto, html: html })) AM.aviso('Vista del mapa guardada en Análisis manual.', { texto: 'Ver hoja', href: 'analisis.html' });
        else AM.aviso('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.', null, true);
      });
    }).catch(function () { AM.aviso('No se pudo capturar el mapa.', null, true); })
      .then(function () { boton.disabled = false; boton.classList.remove('vw-map-btn-ocupado'); });
  });

  // ---------------------------------------------------------------- inicio
  construirColonias();
  construirCerradas();
  dibujarSecciones();
  actualizarHud();
  sincronizarCapas();
  redibujar();
  CG.panel(document.getElementById('cg_panel'), function (modelo) {
    MODELO = modelo;
    APP.asignarColores(modelo.candidatos);
    ESTADO.filas.clear();
    document.querySelector('#tabla_datos thead').innerHTML = '';
    construirFiltros();
    redibujar();
    sincronizarCapas();
  }, { compacto: true });

  window.MAPA = { map: map, ESTADO: ESTADO, bases: bases, redibujar: redibujar };
})();
