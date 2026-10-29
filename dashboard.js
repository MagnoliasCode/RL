// Dashboard de KPIs (dashboard.html) sobre el Conglomerado RL integrado en datos/conglomerado-rl.js.

(function () {
  var C = APP.C, fmt = APP.fmt, pct = APP.pct, esc = APP.escapar;
  var FUENTE = "'Roboto', system-ui, sans-serif";
  var MODELO = null;
  var F = { hoja: new Set(), dl: new Set(), df: new Set(), emp: new Set() };
  APP.FILTROS_PERSONA.forEach(function (d) { F[d.clave] = new Set(); });

  // Desplegables de las columnas de la persona: se agregan antes de que KTUI inicialice los dropdowns
  (function () {
    var reset = document.getElementById('f_reset');
    APP.FILTROS_PERSONA.forEach(function (d) {
      var div = document.createElement('div');
      div.className = 'relative inline-flex';
      div.setAttribute('data-kt-dropdown', 'true');
      div.setAttribute('data-kt-dropdown-trigger', 'click');
      div.innerHTML = '<button type="button" class="kt-btn kt-btn-outline kt-btn-sm" data-kt-dropdown-toggle="true">' + esc(d.col) +
        ' <span class="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline" id="f_' + d.clave + '_badge">Todos</span>' +
        '<span class="material-symbols-outlined vw-ico-16">expand_more</span></button>' +
        '<div class="kt-dropdown-menu hidden filtro-menu flex-col bg-background border border-border rounded-lg shadow-md p-3 gap-2" data-kt-dropdown-menu="true">' +
        '<label class="flex items-center gap-2 pb-2 mb-1 border-b border-border"><input class="kt-checkbox kt-checkbox-sm" type="checkbox" id="f_' + d.clave + '_todos">' +
        '<span class="text-xs font-semibold text-mono">Seleccionar todo</span></label>' +
        '<div class="flex flex-col gap-1 filtro-lista-dd" id="f_' + d.clave + '_lista"></div></div>';
      reset.parentNode.insertBefore(div, reset);
    });
  })();

  function base(tipo, alto, extra) {
    return Object.assign({
      chart: { type: tipo, height: alto || 300, toolbar: { show: false }, fontFamily: FUENTE, foreColor: '#42474b', animations: { enabled: false } },
      grid: { borderColor: '#e5e2d8', strokeDashArray: 3 },
      dataLabels: { enabled: false },
      legend: { position: 'bottom', horizontalAlign: 'center', fontFamily: FUENTE, itemMargin: { horizontal: 6, vertical: 0 }, markers: { size: 5 } },
      tooltip: { style: { fontFamily: FUENTE } }
    }, extra || {});
  }
  function grafica(sel, op) {
    var el = document.querySelector(sel);
    if (el.__chart) el.__chart.destroy();
    el.__chart = new ApexCharts(el, op);
    el.__chart.render();
  }

  function filtrados() {
    return MODELO.registros.filter(function (r) {
      if (F.hoja.size && !F.hoja.has(r.hoja)) return false;
      if (F.dl.size && !F.dl.has(r.dl)) return false;
      if (F.df.size && !F.df.has(r.df)) return false;
      if (F.emp.size && !F.emp.has(r.emp ? 'Sí' : 'No')) return false;
      for (var i = 0; i < APP.FILTROS_PERSONA.length; i++) {
        var d = APP.FILTROS_PERSONA[i];
        if (F[d.clave].size && !F[d.clave].has(APP.valorFiltro(d, r))) return false;
      }
      return true;
    });
  }

  // Barras 100 % apiladas: candidato dentro de cada categoria
  function apiladas(sel, regs, categorias, fCat, etiquetaCat, alto) {
    var cands = MODELO.candidatos;
    var totales = {}, conteo = {};
    regs.forEach(function (r) {
      var k = fCat(r);
      if (categorias.indexOf(k) === -1) return;
      totales[k] = (totales[k] || 0) + 1;
      conteo[r.cand + '|' + k] = (conteo[r.cand + '|' + k] || 0) + 1;
    });
    var cats = categorias.filter(function (k) { return totales[k]; });
    grafica(sel, base('bar', alto || Math.max(180, 60 + cats.length * 46), {
      series: cands.map(function (c) { return { name: c, data: cats.map(function (k) { return conteo[c + '|' + k] || 0; }) }; }),
      xaxis: { categories: cats.map(function (k) { return (etiquetaCat ? etiquetaCat(k) : k) + ' (n=' + fmt(totales[k]) + ')'; }) },
      colors: cands.map(APP.colorCandidato),
      chart: Object.assign(base('bar').chart, { stacked: true, stackType: '100%', height: alto || Math.max(180, 60 + cats.length * 46) }),
      plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 2 } },
      dataLabels: { enabled: true, formatter: function (v) { return v >= 7 ? Math.round(v) + '%' : ''; }, style: { colors: ['#fff'], fontWeight: 700, fontFamily: FUENTE } },
      tooltip: { y: { formatter: function (v) { return fmt(v) + ' respuestas'; } } }
    }));
    return cats.length;
  }

  function pintar() {
    var regs = filtrados();
    var tels = new Set(regs.map(function (r) { return r.tel; }));
    var emp = new Set(regs.filter(function (r) { return r.persona; }).map(function (r) { return r.tel; }));
    var cambian = new Set(regs.filter(function (r) { return r.tel_.cambia; }).map(function (r) { return r.tel; }));
    var hojas = MODELO.hojas.filter(function (h) { return regs.some(function (r) { return r.hoja === h; }); });
    var poner = function (id, t) { document.getElementById(id).textContent = t; };
    poner('k_respuestas', fmt(regs.length));
    poner('k_respuestas_sub', fmt(hojas.length) + ' fechas de levantamiento');
    poner('k_telefonos', fmt(tels.size));
    poner('k_telefonos_sub', fmt(regs.length / Math.max(1, tels.size), 2) + ' respuestas por teléfono');
    poner('k_emparejados', fmt(emp.size));
    poner('k_emparejados_sub', pct(tels.size ? emp.size / tels.size : 0) + ' de los teléfonos');
    var porCand = APP.contar(regs, function (r) { return r.cand; });
    var cands = MODELO.candidatos.filter(function (c) { return porCand[c]; }).sort(function (a, b) { return porCand[b] - porCand[a]; });
    poner('k_lider', cands[0] || '—');
    poner('k_lider_sub', cands[0] ? pct(porCand[cands[0]] / regs.length) + ' de las respuestas' : '');
    poner('k_cambian', fmt(cambian.size));
    poner('k_cambian_sub', pct(tels.size ? cambian.size / tels.size : 0) + ' de los teléfonos');
    document.getElementById('d_vacio').hidden = regs.length > 0;
    if (!regs.length) return;

    grafica('#ch_pref', base('bar', 320, {
      series: [{ name: 'Respuestas', data: cands.map(function (c) { return porCand[c]; }) }],
      xaxis: { categories: cands, labels: { formatter: function (v) { return fmt(v); } } },
      colors: cands.map(APP.colorCandidato),
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 6, borderRadiusApplication: 'end', barHeight: '65%' } },
      legend: { show: false },
      dataLabels: { enabled: true, formatter: function (v) { return pct(v / regs.length, 1) + ' (' + fmt(v) + ')'; }, style: { colors: ['#fff'], fontWeight: 700, fontFamily: FUENTE } },
      tooltip: { y: { formatter: function (v) { return fmt(v) + ' respuestas · ' + pct(v / regs.length, 1); } } }
    }));

    var porHoja = APP.contar(regs, function (r) { return r.hoja; });
    var piv = APP.contar(regs, function (r) { return r.cand + '|' + r.hoja; });
    grafica('#ch_evol', base('line', 440, {
      series: MODELO.candidatos.filter(function (c) { return porCand[c]; }).map(function (c) {
        return { name: c, data: hojas.map(function (h) { return +(((piv[c + '|' + h] || 0) / porHoja[h]) * 100).toFixed(1); }) };
      }),
      xaxis: { categories: hojas, labels: { rotate: -45, rotateAlways: hojas.length > 6 } },
      colors: MODELO.candidatos.filter(function (c) { return porCand[c]; }).map(APP.colorCandidato),
      stroke: { width: 3, curve: 'straight' }, markers: { size: 4 },
      yaxis: { labels: { formatter: function (v) { return Math.round(v) + '%'; } } },
      tooltip: { y: { formatter: function (v, o) { return v + '% · n=' + fmt(porHoja[hojas[o.dataPointIndex]]); } } }
    }));

    var nDl = apiladas('#ch_dl', regs, APP.DISTRITOS_LOCALES.concat(['Otro']), function (r) { return !r.dl ? null : (APP.DISTRITOS_LOCALES.indexOf(r.dl) === -1 ? 'Otro' : r.dl); }, function (k) { return k === 'Otro' ? 'Otro DL' : 'DL ' + k; });
    var nDf = apiladas('#ch_df', regs, APP.DISTRITOS_FEDERALES.concat(['Otro']), function (r) { return !r.df ? null : (APP.DISTRITOS_FEDERALES.indexOf(r.df) === -1 ? 'Otro' : r.df); }, function (k) { return k === 'Otro' ? 'Otro DF' : 'DF ' + k; });
    apiladas('#ch_sexo', regs, ['Mujer', 'Hombre'], function (r) { return r.sexo; });
    apiladas('#ch_edad', regs, APP.EDADES.slice(0, 4), function (r) { return r.edadRango; });
    document.getElementById('nota_perfil').hidden = nDl > 0 || nDf > 0;

    var empH = APP.contar(regs, function (r) { return r.hoja + '|' + (r.emp ? 1 : 0); });
    grafica('#ch_emp', base('bar', 300, {
      series: [
        { name: 'Emparejadas con persona', data: hojas.map(function (h) { return empH[h + '|1'] || 0; }) },
        { name: 'Solo teléfono', data: hojas.map(function (h) { return empH[h + '|0'] || 0; }) }
      ],
      chart: Object.assign(base('bar').chart, { stacked: true, height: 300 }),
      xaxis: { categories: hojas, labels: { rotate: -45, rotateAlways: hojas.length > 6 } },
      colors: [C.tinta, C.tinta300],
      plotOptions: { bar: { columnWidth: '65%', borderRadius: 3 } },
      yaxis: { labels: { formatter: function (v) { return fmt(v); } } },
      tooltip: { y: { formatter: function (v) { return fmt(v) + ' respuestas'; } } }
    }));

    // Perfil por candidato (personas emparejadas)
    document.querySelector('#t_perfil tbody').innerHTML = cands.map(function (c) {
      var rc = regs.filter(function (r) { return r.cand === c; });
      var re = rc.filter(function (r) { return r.persona; });
      var mujeres = re.filter(function (r) { return r.persona.ficha.sexo === 'Mujer'; }).length;
      var edades = re.map(function (r) { return parseInt(MODELO.valor(r.persona.ficha, 'edad'), 10); }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
      var sp = re.filter(function (r) { return r.persona.ficha.servidor === 'Sí'; }).length;
      var ben = re.filter(function (r) { return r.persona.ficha.beneficiario === 'Sí'; }).length;
      var camb = rc.filter(function (r) { return r.tel_.cambia; }).length;
      return '<tr><td><span class="vw-chip" style="background:' + APP.colorCandidato(c) + '"></span> ' + esc(c) + '</td><td class="num">' + fmt(rc.length) +
        '</td><td class="num">' + pct(rc.length ? re.length / rc.length : 0, 0) + '</td><td class="num">' + (re.length ? pct(mujeres / re.length, 0) : '—') +
        '</td><td class="num">' + (edades.length ? edades[edades.length >> 1] : '—') + '</td><td class="num">' + (re.length ? pct(sp / re.length, 1) : '—') +
        '</td><td class="num">' + (re.length ? pct(ben / re.length, 1) : '—') + '</td><td class="num">' + pct(rc.length ? camb / rc.length : 0, 0) + '</td></tr>';
    }).join('');
  }

  // Filtros del dashboard (menus desplegables con casillas)
  function listaCheck(clave, valores, etiqueta) {
    var cont = document.getElementById('f_' + clave + '_lista'), todos = document.getElementById('f_' + clave + '_todos'), badge = document.getElementById('f_' + clave + '_badge');
    var conjunto = F[clave];
    cont.innerHTML = '';
    function badgeTxt() { badge.textContent = conjunto.size ? conjunto.size + ' de ' + valores.length : 'Todos'; }
    valores.forEach(function (v) {
      var label = document.createElement('label');
      label.className = 'flex items-center gap-2';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'kt-checkbox kt-checkbox-sm';
      var span = document.createElement('span');
      span.className = 'text-xs text-foreground';
      span.textContent = etiqueta ? etiqueta(v) : v;
      label.appendChild(chk);
      label.appendChild(span);
      cont.appendChild(label);
      chk.addEventListener('change', function () {
        if (chk.checked) conjunto.add(v); else conjunto.delete(v);
        var n = cont.querySelectorAll('input:checked').length;
        todos.checked = n === valores.length;
        todos.indeterminate = n > 0 && n < valores.length;
        badgeTxt();
        pintar();
      });
    });
    todos.onchange = function () {
      cont.querySelectorAll('input').forEach(function (c) { c.checked = todos.checked; });
      conjunto.clear();
      if (todos.checked) valores.forEach(function (v) { conjunto.add(v); });
      todos.indeterminate = false;
      badgeTxt();
      pintar();
    };
    badgeTxt();
    return function () { cont.querySelectorAll('input').forEach(function (c) { c.checked = false; }); todos.checked = false; todos.indeterminate = false; conjunto.clear(); badgeTxt(); };
  }

  CG.panel(document.getElementById('cg_panel'), function (modelo) {
    MODELO = modelo;
    APP.asignarColores(modelo.candidatos);
    document.getElementById('d_contenido').hidden = false;
    document.getElementById('d_contenido_2').hidden = false;
    Object.keys(F).forEach(function (k) { F[k].clear(); });
    var reinicios = [
      listaCheck('hoja', modelo.hojas),
      listaCheck('dl', APP.DISTRITOS_LOCALES, function (v) { return 'DL ' + v; }),
      listaCheck('df', APP.DISTRITOS_FEDERALES, function (v) { return 'DF ' + v; }),
      listaCheck('emp', ['Sí', 'No'], function (v) { return v === 'Sí' ? 'Emparejadas con persona' : 'Solo teléfono'; })
    ].concat(APP.FILTROS_PERSONA.map(function (d) { return listaCheck(d.clave, APP.valoresFiltro(d, modelo)); }));
    document.getElementById('f_reset').onclick = function () { reinicios.forEach(function (f) { f(); }); pintar(); };
    pintar();
  });
})();
