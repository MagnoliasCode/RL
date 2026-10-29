// Resumen y hallazgos (resumen.html): contexto electoral 2024 (siempre) y hallazgos del Conglomerado RL.

(function () {
  var fmt = APP.fmt, pct = APP.pct, esc = APP.escapar;

  function seccion(t, html) { return '<section><h2 class="text-lg font-semibold text-mono mb-2">' + t + '</h2>' + html + '</section>'; }
  function lista(items) { return '<ul class="flex flex-col gap-1">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
  function b(t) { return '<b class="num">' + t + '</b>'; }

  // ---------------------------------------------------------------- contexto electoral 2024 (capa de secciones)
  (function () {
    var props = mCUU1624.features.map(function (f) { return f.properties; });
    var filas = [];
    function fila(nombre, lista_) {
      var r = APP.sumar2024(lista_);
      var g = r.grupos;
      filas.push('<tr><td><b>' + nombre + '</b></td><td class="num">' + fmt(r.secciones) + '</td><td class="num">' + fmt(r.lista) + '</td><td class="num">' + pct(r.participacion) +
        '</td><td class="num">' + pct(r.votos ? g[0].votos / r.votos : 0) + '<div class="vw-sub-num">PAN ' + pct(r.votos ? g[0].partidos[0].votos / r.votos : 0) + ' · PRI ' + pct(r.votos ? g[0].partidos[1].votos / r.votos : 0) + ' · PRD ' + pct(r.votos ? g[0].partidos[2].votos / r.votos : 0) + '</div>' +
        '</td><td class="num">' + pct(r.votos ? g[1].votos / r.votos : 0) + '<div class="vw-sub-num">MORENA ' + pct(r.votos ? g[1].partidos[0].votos / r.votos : 0) + ' · PT ' + pct(r.votos ? g[1].partidos[1].votos / r.votos : 0) + '</div>' +
        '</td><td class="num">' + pct(r.votos ? g[2].votos / r.votos : 0) + '</td><td class="num">' + fmt(r.ganadas['COAL PAN-PRI-PRD'] || 0) + ' / ' + fmt(r.ganadas['COAL MORENA-PT'] || 0) + '</td></tr>');
      return r;
    }
    var total = fila('Municipio', props);
    APP.DISTRITOS_LOCALES.forEach(function (d) { fila('DL ' + d, props.filter(function (p) { return String(p.DISTRITO_L) === d; })); });
    APP.DISTRITOS_FEDERALES.forEach(function (d) { fila('DF ' + d, props.filter(function (p) { return String(p.DISTRITO) === d; })); });
    document.querySelector('#t_2024 tbody').innerHTML = filas.join('');
    var g = total.grupos;
    document.getElementById('contexto_2024').innerHTML = 'En 2024 la COAL PAN-PRI-PRD obtuvo ' + b(pct(g[0].votos / total.votos)) + ' de la votación en las ' + fmt(total.secciones) +
      ' secciones del municipio y ganó ' + b(fmt(total.ganadas['COAL PAN-PRI-PRD'] || 0)) + ' de ellas; la COAL MORENA-PT obtuvo ' + b(pct(g[1].votos / total.votos)) +
      ' y ganó ' + b(fmt(total.ganadas['COAL MORENA-PT'] || 0)) + '. La participación fue de ' + b(pct(total.participacion)) + '.';
  })();

  // ---------------------------------------------------------------- hallazgos del Conglomerado
  function lider(regs) {
    var c = APP.contar(regs, function (r) { return r.cand; });
    var orden = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
    return { orden: orden, conteo: c, total: regs.length };
  }
  function textoLider(l, n) {
    return l.orden.slice(0, n || 2).map(function (c) { return '<b>' + esc(c) + '</b> (' + pct(l.conteo[c] / l.total, 0) + ')'; }).join(', ');
  }

  CG.panel(document.getElementById('cg_panel'), function (M) {
    APP.asignarColores(M.candidatos);
    document.getElementById('r_contenido').hidden = false;
    var R = M.registros;
    var tels = M.personas.length;
    var emp = M.personas.filter(function (p) { return p.ficha; });
    var cambian = M.personas.filter(function (p) { return p.cambia; });
    var varias = M.personas.filter(function (p) { return p.opiniones.length > 1; });
    var general = lider(R);
    var hojas = M.hojas;
    var primeras = hojas.slice(0, Math.min(3, Math.ceil(hojas.length / 3)));
    var ultimas = hojas.slice(-Math.min(3, Math.ceil(hojas.length / 3)));
    var lIni = lider(R.filter(function (r) { return primeras.indexOf(r.hoja) !== -1; }));
    var lFin = lider(R.filter(function (r) { return ultimas.indexOf(r.hoja) !== -1; }));
    var tendencia = M.candidatos.map(function (c) {
      var a = lIni.total ? (lIni.conteo[c] || 0) / lIni.total : 0, z = lFin.total ? (lFin.conteo[c] || 0) / lFin.total : 0;
      return { c: c, a: a, z: z, d: z - a };
    }).sort(function (x, y) { return y.d - x.d; });
    var lideresHoja = hojas.map(function (h) { var l = lider(R.filter(function (r) { return r.hoja === h; })); return esc(h) + ': <b>' + esc(l.orden[0]) + '</b> (' + pct(l.conteo[l.orden[0]] / l.total, 0) + ', n=' + fmt(l.total) + ')'; });

    var porDl = APP.DISTRITOS_LOCALES.map(function (d) {
      var l = lider(R.filter(function (r) { return r.dl === d; }));
      return l.total ? 'DL ' + d + ': ' + textoLider(l, 2) + ' — n=' + fmt(l.total) : null;
    }).filter(Boolean);
    var porDf = APP.DISTRITOS_FEDERALES.map(function (d) {
      var l = lider(R.filter(function (r) { return r.df === d; }));
      return l.total ? 'DF ' + d + ': ' + textoLider(l, 2) + ' — n=' + fmt(l.total) : null;
    }).filter(Boolean);
    var ETIQUETA_PERFIL = { Mujer: 'Mujeres', Hombre: 'Hombres' };
    var perfil = ['Mujer', 'Hombre'].concat(APP.EDADES.slice(0, 4)).map(function (k) {
      var l = lider(R.filter(function (r) { return r.sexo === k || r.edadRango === k; }));
      return l.total ? (ETIQUETA_PERFIL[k] || k + ' años') + ': ' + textoLider(l, 2) : null;
    }).filter(Boolean);

    var flujos = APP.contar(cambian, function (p) { return p.primeraCat + ' → ' + p.ultimaCat; });
    var topFlujos = Object.keys(flujos).sort(function (a, b) { return flujos[b] - flujos[a]; }).slice(0, 6)
      .map(function (k) { return esc(k) + ': ' + b(fmt(flujos[k])) + ' personas'; });
    var balance = M.candidatos.map(function (c) {
      return { c: c, n: cambian.filter(function (p) { return p.ultimaCat === c && p.primeraCat !== c; }).length - cambian.filter(function (p) { return p.primeraCat === c && p.ultimaCat !== c; }).length };
    }).sort(function (x, y) { return y.n - x.n; });
    var dobles = M.personas.reduce(function (s, p) { return s + p.opiniones.filter(function (o) { return o.candidatos.length > 1; }).length; }, 0);
    var confianza = APP.contar(emp, function (p) { return p.ficha.confianza; });
    var fuera = emp.filter(function (p) { return APP.DISTRITOS_LOCALES.indexOf(p.ficha.dl) === -1; }).length;
    var sp = emp.filter(function (p) { return p.ficha.servidor === 'Sí'; }).length;
    var ben = emp.filter(function (p) { return p.ficha.beneficiario === 'Sí'; }).length;
    var conPartido = emp.filter(function (p) { return p.ficha.partido !== 'Sin dato'; }).length;

    document.getElementById('narrativa').innerHTML = [
      seccion('Panorama general',
        '<p>El Conglomerado RL reúne ' + b(fmt(R.length)) + ' respuestas de ' + b(fmt(tels)) + ' teléfonos en ' + b(fmt(hojas.length)) + ' fechas de levantamiento (de ' +
        esc(hojas[0]) + ' a ' + esc(hojas[hojas.length - 1]) + '). ' + b(fmt(emp.length)) + ' teléfonos (' + pct(emp.length / tels) + ') se emparejaron con una persona y tienen ficha con sección, colonia y ubicación; el resto solo tiene el teléfono. En el total de respuestas la preferencia es: ' +
        textoLider(general, 4) + '.</p>'),
      seccion('Tendencia en el tiempo',
        '<p>Comparando las primeras fechas (' + esc(primeras.join(', ')) + ') con las últimas (' + esc(ultimas.join(', ')) + '): ' +
        tendencia.filter(function (t) { return Math.abs(t.d) >= 0.01; }).slice(0, 3).map(function (t) { return '<b>' + esc(t.c) + '</b> ' + (t.d > 0 ? 'sube' : 'baja') + ' de ' + pct(t.a, 0) + ' a ' + pct(t.z, 0); }).join('; ') +
        (tendencia[tendencia.length - 1].d < -0.01 ? '; <b>' + esc(tendencia[tendencia.length - 1].c) + '</b> es quien más cae (de ' + pct(tendencia[tendencia.length - 1].a, 0) + ' a ' + pct(tendencia[tendencia.length - 1].z, 0) + ')' : '') +
        '. Líder en cada fecha:</p>' + lista(lideresHoja) +
        '<p class="mt-2 vw-nota-metodo">Cada fecha puede corresponder a un levantamiento distinto (muestras y preguntas diferentes); compare tendencias con cautela.</p>'),
      seccion('Territorio',
        '<p>Preferencia por distrito entre las respuestas emparejadas:</p>' + lista(porDl.concat(porDf)) +
        '<p class="mt-2">Compare con el contexto electoral 2024 de la tabla inferior: los distritos donde la oposición fue más competitiva son los que más conviene vigilar.</p>'),
      seccion('Perfil de los encuestados', perfil.length ? '<p>Entre las personas emparejadas:</p>' + lista(perfil) +
        '<p class="mt-2">' + b(fmt(sp)) + ' personas emparejadas aparecen como servidores públicos, ' + b(fmt(ben)) + ' como beneficiarios y ' + b(fmt(conPartido)) + ' tienen afiliación partidista registrada.</p>' : '<p>Sin datos de perfil.</p>'),
      seccion('Migración de opinión',
        '<p>' + b(fmt(varias.length)) + ' teléfonos se encuestaron en más de una fecha y ' + b(fmt(cambian.length)) + ' (' + pct(varias.length ? cambian.length / varias.length : 0) +
        ') cambiaron de candidato entre fechas; ' + b(fmt(cambian.filter(function (p) { return p.ficha; }).length)) + ' de ellos tienen ficha con nombre. Los movimientos más frecuentes (primera → última opinión):</p>' + lista(topFlujos) +
        '<p class="mt-2">Balance neto: ' + balance.map(function (x) { return '<b>' + esc(x.c) + '</b> ' + (x.n > 0 ? '+' : '') + fmt(x.n); }).join(' · ') +
        '. Vea cada caso en <a class="kt-link" href="migracion.html">Migración de opinión</a>.</p>'),
      seccion('Calidad de los datos', lista([
        b(fmt(dobles)) + ' veces un mismo teléfono aparece con dos candidatos distintos en la misma fecha; en la migración se muestran juntos y no cuentan como cambio.',
        'Confianza de la ubicación de las personas emparejadas: ' + Object.keys(confianza).sort(function (a, b) { return confianza[b] - confianza[a]; }).map(function (k) { return esc(k) + ' ' + fmt(confianza[k]); }).join(' · ') + '.',
        b(fmt(fuera)) + ' personas emparejadas tienen domicilio fuera de los distritos locales del municipio (' + APP.DISTRITOS_LOCALES.join(', ') + ').',
        'Las respuestas sin emparejar no tienen sección ni distrito: se cuentan en los totales pero no en el mapa ni en los cortes territoriales.'
      ])),
      seccion('Recomendaciones', lista([
        'Dar seguimiento a las personas que cambiaron de opinión, empezando por quienes pasaron de ' + esc(balance[balance.length - 1].c) + ' a otro candidato (el balance más negativo).',
        'Priorizar los distritos donde la preferencia del Conglomerado se aleja del resultado 2024 de su sección.',
        'Mejorar el emparejamiento de teléfonos: con más fichas aumenta la lectura territorial (hoy ' + pct(emp.length / tels, 0) + ').',
        'Unificar los levantamientos con varias hojas el mismo día (p. ej. «26 de junio 2» y «26 de junio 3») si corresponden a la misma ola.'
      ]))
    ].join('');

    var kv = function (k, v) { return '<div class="vw-kv"><span class="text-sm text-secondary-foreground">' + k + '</span><span class="text-sm font-semibold text-mono">' + v + '</span></div>'; };
    document.getElementById('datos_clave').innerHTML = [
      kv('Respuestas', fmt(R.length)),
      kv('Teléfonos', fmt(tels)),
      kv('Con ficha (emparejados)', fmt(emp.length)),
      kv('Fechas de levantamiento', fmt(hojas.length)),
      kv('Líder general', esc(general.orden[0]) + ' ' + pct(general.conteo[general.orden[0]] / general.total, 0)),
      kv('Líder en las últimas fechas', esc(lFin.orden[0] || '—')),
      kv('Cambiaron de opinión', fmt(cambian.length))
    ].join('');
  });
})();
