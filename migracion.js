// Migracion de opinion (migracion.html): personas que opinaron distinto en fechas distintas
// ("Nombre de la hoja"), con su ficha completa del Conglomerado y su trayectoria de opiniones.

(function () {
  var fmt = APP.fmt, pct = APP.pct, esc = APP.escapar;
  var MODELO = null, CAMBIAN = [], LISTA = [], mostrados = 0;
  var POR_PAGINA = 30;
  var F = { texto: '', emp: '', primera: '', ultima: '', paso: '', dl: '', df: '', columnas: {} };

  // Filtros de las columnas de la persona (ServidorPublico, partidos, Beneficiario y programas)
  (function () {
    var orden = document.getElementById('f_orden');
    APP.FILTROS_PERSONA.forEach(function (d) {
      var sel = document.createElement('select');
      sel.id = 'f_col_' + d.clave;
      sel.title = d.col;
      sel.addEventListener('change', function () {
        if (sel.value) F.columnas[d.clave] = sel.value; else delete F.columnas[d.clave];
        if (MODELO) filtrar();
      });
      orden.parentNode.insertBefore(sel, orden);
    });
  })();

  // Columnas que cambian en cada respuesta (no forman parte de la ficha personal)
  function esColumnaDeRespuesta(i) { return i === MODELO.indice.hoja || i === MODELO.indice.candidato; }
  function cambios(p) {
    var n = 0;
    for (var i = 1; i < p.opiniones.length; i++) {
      if (p.opiniones[i].candidatos.slice().sort().join('/') !== p.opiniones[i - 1].candidatos.slice().sort().join('/')) n++;
    }
    return n;
  }
  function nombre(p) { return p.ficha ? (MODELO.valor(p.ficha, 'nombre') || 'Sin nombre') : 'Teléfono sin emparejar'; }
  function chip(c) { return '<b class="mg-chip" style="background:' + APP.colorCandidato(c) + '">' + esc(c) + '</b>'; }

  function pintarIndicadores() {
    var conVarias = MODELO.personas.filter(function (p) { return p.opiniones.length > 1; });
    var conNombre = CAMBIAN.filter(function (p) { return p.ficha; });
    var poner = function (id, t) { document.getElementById(id).textContent = t; };
    poner('k_varias', fmt(conVarias.length));
    poner('k_varias_sub', 'de ' + fmt(MODELO.personas.length) + ' teléfonos');
    poner('k_cambian', fmt(CAMBIAN.length));
    poner('k_cambian_sub', pct(conVarias.length ? CAMBIAN.length / conVarias.length : 0) + ' de los encuestados más de una vez');
    poner('k_nombre', fmt(conNombre.length));
    poner('k_nombre_sub', 'con ficha personal');
    var totalCambios = CAMBIAN.reduce(function (s, p) { return s + p.nCambios; }, 0);
    poner('k_pasos', fmt(totalCambios / Math.max(1, CAMBIAN.length), 2));
    poner('k_pasos_sub', 'cambios por persona en promedio');
    var tres = CAMBIAN.filter(function (p) { return p.candidatosDistintos.length >= 3; }).length;
    poner('k_tres', fmt(tres));

    // Matriz primera -> ultima opinion
    var firmas = {};
    CAMBIAN.forEach(function (p) { firmas[p.primeraCat] = 1; firmas[p.ultimaCat] = 1; });
    var orden = MODELO.candidatos.filter(function (c) { return firmas[c]; }).concat(Object.keys(firmas).filter(function (f) { return MODELO.candidatos.indexOf(f) === -1; }).sort());
    var m = APP.contar(CAMBIAN, function (p) { return p.primeraCat + '→' + p.ultimaCat; });
    var max = Math.max.apply(null, Object.keys(m).map(function (k) { return m[k]; }).concat([1]));
    var html = '<table class="mg-matriz"><thead><tr><th>De ↓ / A →</th>' + orden.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    orden.forEach(function (a) {
      html += '<tr><th>' + chip(a) + '</th>' + orden.map(function (b) {
        var n = m[a + '→' + b] || 0;
        var alfa = n ? 0.12 + 0.75 * n / max : 0;
        return '<td style="background:rgba(168,57,17,' + alfa.toFixed(2) + ');color:' + (alfa > 0.5 ? '#fff' : 'inherit') + '">' + (n ? fmt(n) : '') + '</td>';
      }).join('') + '</tr>';
    });
    document.getElementById('matriz').innerHTML = html + '</tbody></table><p class="vw-nota-metodo mt-2">La diagonal son personas que regresaron a su primera opinión después de cambiar. «' + CG.VARIOS + '»: en esa fecha el teléfono aparece con más de un candidato (el detalle está en cada tarjeta).</p>';

    // Balance por candidato (primera vs ultima opinion)
    document.querySelector('#t_balance tbody').innerHTML = MODELO.candidatos.map(function (c) {
      var perdio = CAMBIAN.filter(function (p) { return p.primeraCat === c && p.ultimaCat !== c; }).length;
      var gano = CAMBIAN.filter(function (p) { return p.ultimaCat === c && p.primeraCat !== c; }).length;
      var paso = CAMBIAN.filter(function (p) { return p.candidatosDistintos.indexOf(c) !== -1; }).length;
      return { c: c, gano: gano, perdio: perdio, neto: gano - perdio, paso: paso };
    }).sort(function (a, b) { return b.neto - a.neto; }).map(function (x) {
      return '<tr><td>' + chip(x.c) + '</td><td class="num">' + fmt(x.paso) + '</td><td class="num">' + fmt(x.gano) + '</td><td class="num">' + fmt(x.perdio) +
        '</td><td class="num"><b style="color:' + (x.neto > 0 ? '#2e7d32' : x.neto < 0 ? '#ba1a1a' : 'inherit') + '">' + (x.neto > 0 ? '+' : '') + fmt(x.neto) + '</b></td></tr>';
    }).join('');
  }

  function opciones(sel, valores, todos) {
    var el = document.getElementById(sel);
    el.innerHTML = '<option value="">' + todos + '</option>' + valores.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
  }

  function filtrar() {
    var t = CG.normalizar(F.texto);
    LISTA = CAMBIAN.filter(function (p) {
      if (F.emp === 'si' && !p.ficha) return false;
      if (F.emp === 'no' && p.ficha) return false;
      if (F.primera && p.primeraCat !== F.primera) return false;
      if (F.ultima && p.ultimaCat !== F.ultima) return false;
      if (F.paso && p.candidatosDistintos.indexOf(F.paso) === -1) return false;
      if (F.dl && (!p.ficha || p.ficha.dl !== F.dl)) return false;
      if (F.df && (!p.ficha || p.ficha.df !== F.df)) return false;
      for (var clave in F.columnas) { if (p.registros[0][clave] !== F.columnas[clave]) return false; }
      if (t) {
        var heno = CG.normalizar(p.tel + ' ' + (p.ficha ? MODELO.valor(p.ficha, 'nombre') + ' ' + MODELO.valor(p.ficha, 'curp') + ' ' + p.ficha.colonia + ' ' + p.ficha.seccion : ''));
        if (heno.indexOf(t) === -1) return false;
      }
      return true;
    });
    var orden = document.getElementById('f_orden').value;
    LISTA.sort(function (a, b) {
      if (orden === 'cambios') return b.nCambios - a.nCambios || b.opiniones.length - a.opiniones.length;
      if (orden === 'nombre') return nombre(a).localeCompare(nombre(b), 'es');
      return (b.ficha ? 1 : 0) - (a.ficha ? 1 : 0) || b.nCambios - a.nCambios;
    });
    document.getElementById('lista').innerHTML = '';
    mostrados = 0;
    document.getElementById('conteo').textContent = fmt(LISTA.length) + ' persona' + (LISTA.length === 1 ? '' : 's') + ' con cambio de opinión';
    mostrarMas();
  }

  function tarjeta(p) {
    var linea = p.opiniones.map(function (o, i) {
      var cambio = i > 0 && o.candidatos.slice().sort().join('/') !== p.opiniones[i - 1].candidatos.slice().sort().join('/');
      return (i ? '<span class="mg-flecha' + (cambio ? ' mg-flecha-cambio' : '') + '">→</span>' : '') +
        '<div class="mg-paso"><span class="mg-fecha">' + esc(o.hoja) + '</span>' + o.candidatos.map(chip).join('') + '</div>';
    }).join('');
    var ficha = '';
    if (p.ficha) {
      ficha = '<details class="mg-ficha"><summary>Ficha de la persona</summary><div class="mg-ficha-grid">' +
        MODELO.columnas.map(function (c, i) {
          if (esColumnaDeRespuesta(i)) return '';
          var v = p.ficha.fila[i];
          return '<div><span>' + esc(c) + '</span><b>' + esc(CG.vacio(v) ? '—' : v) + '</b></div>';
        }).join('') + '</div></details>';
    }
    var div = document.createElement('article');
    div.className = 'mg-tarjeta' + (p.ficha ? '' : ' mg-sin-ficha');
    div.innerHTML = '<div class="mg-cab"><div><span class="vw-label mg-sub">' + (p.ficha ? 'Sección ' + esc(p.ficha.seccion) + ' · DL ' + esc(p.ficha.dl) + ' · DF ' + esc(p.ficha.df) : 'Solo teléfono') +
      '</span><h3>' + esc(nombre(p)) + '</h3><span class="mg-tel">Tel. ' + esc(p.tel) + '</span></div><div class="mg-resumen"><b>' + p.opiniones.length + '</b> fechas<br><b>' + p.nCambios +
      '</b> cambio' + (p.nCambios === 1 ? '' : 's') + '</div></div><div class="mg-linea">' + linea + '</div>' + ficha;
    return div;
  }
  function mostrarMas() {
    var cont = document.getElementById('lista');
    LISTA.slice(mostrados, mostrados + POR_PAGINA).forEach(function (p) { cont.appendChild(tarjeta(p)); });
    mostrados = Math.min(LISTA.length, mostrados + POR_PAGINA);
    var btn = document.getElementById('mas');
    btn.hidden = mostrados >= LISTA.length;
    btn.textContent = 'Mostrar ' + Math.min(POR_PAGINA, LISTA.length - mostrados) + ' más (' + fmt(LISTA.length - mostrados) + ' restantes)';
  }

  function descargar() {
    var cols = ['Trayectoria (fecha: opinión)', 'Primera opinión', 'Última opinión', 'Número de fechas', 'Número de cambios'];
    var idx = MODELO.columnas.map(function (c, i) { return i; }).filter(function (i) { return !esColumnaDeRespuesta(i); });
    var fichaCols = idx.map(function (i) { return MODELO.columnas[i]; });
    APP.descargarCsv('migracion-de-opinion.csv', fichaCols.concat(cols), LISTA.map(function (p) {
      var base = idx.map(function (i) { return p.ficha ? p.ficha.fila[i] : (i === MODELO.indice.telefono ? p.tel : ''); });
      return base.concat([p.opiniones.map(function (o) { return o.hoja + ': ' + o.candidatos.join(' / '); }).join(' | '), p.primera, p.ultima, p.opiniones.length, p.nCambios]);
    }));
  }

  CG.panel(document.getElementById('cg_panel'), function (modelo) {
    MODELO = modelo;
    APP.asignarColores(modelo.candidatos);
    CAMBIAN = modelo.personas.filter(function (p) { return p.cambia; });
    CAMBIAN.forEach(function (p) { p.nCambios = cambios(p); });
    document.getElementById('m_contenido').hidden = false;
    pintarIndicadores();
    var firmas = Array.from(new Set(CAMBIAN.map(function (p) { return p.primeraCat; }).concat(CAMBIAN.map(function (p) { return p.ultimaCat; }))));
    var ordenFirmas = modelo.candidatos.filter(function (c) { return firmas.indexOf(c) !== -1; }).concat(firmas.filter(function (f) { return modelo.candidatos.indexOf(f) === -1; }).sort());
    opciones('f_primera', ordenFirmas, 'Cualquier primera opinión');
    opciones('f_ultima', ordenFirmas, 'Cualquier última opinión');
    opciones('f_paso', modelo.candidatos, 'Opinó en algún momento por…');
    opciones('f_dl', APP.DISTRITOS_LOCALES, 'Todos los DL');
    opciones('f_df', APP.DISTRITOS_FEDERALES, 'Todos los DF');
    APP.FILTROS_PERSONA.forEach(function (d) {
      var vistos = {};
      CAMBIAN.forEach(function (p) { vistos[p.registros[0][d.clave]] = 1; });
      var valores = APP.valoresFiltro(d, modelo).filter(function (v) { return vistos[v]; });
      opciones('f_col_' + d.clave, valores, d.col + ': todos');
    });
    filtrar();
  });

  [['f_texto', 'texto', 'input'], ['f_emp', 'emp', 'change'], ['f_primera', 'primera', 'change'], ['f_ultima', 'ultima', 'change'],
   ['f_paso', 'paso', 'change'], ['f_dl', 'dl', 'change'], ['f_df', 'df', 'change']].forEach(function (d) {
    document.getElementById(d[0]).addEventListener(d[2], function (e) { F[d[1]] = e.target.value; if (MODELO) filtrar(); });
  });
  document.getElementById('f_orden').addEventListener('change', function () { if (MODELO) filtrar(); });
  document.getElementById('mas').addEventListener('click', mostrarMas);
  document.getElementById('descargar').addEventListener('click', function () { if (MODELO) descargar(); });
})();
