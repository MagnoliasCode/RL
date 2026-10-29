// Utilidades compartidas: formatos, colores, filtros del Conglomerado y resultados electorales 2024.

var APP = (function () {
  var C = {
    tinta: '#0b232d', pod: '#223843', tinta600: '#4b616d', tinta400: '#8aa1ae', tinta300: '#b3cad8', hielo: '#cee6f4',
    oxido: '#a83911', naranja: '#ff784d', ambar: '#cf921c', ambar400: '#fdba45', carbon: '#73787b'
  };

  // Distritos del municipio de Chihuahua (filtros superiores del mapa)
  var DISTRITOS_LOCALES = ['12', '15', '16', '17', '18'];
  var DISTRITOS_FEDERALES = ['6', '8'];

  // Colores de candidatos: se asignan en orden de frecuencia, asi sirven para cualquier archivo
  var PALETA_CANDIDATOS = ['#0b232d', '#a83911', '#cf921c', '#2f6f8f', '#ff784d', '#7a5c99', '#8aa1ae', '#5b7f3a', '#b3cad8', '#4b616d'];
  var colorCandidatos = {};
  function asignarColores(candidatos) {
    colorCandidatos = {};
    candidatos.forEach(function (c, i) { colorCandidatos[c] = PALETA_CANDIDATOS[i % PALETA_CANDIDATOS.length]; });
  }
  function colorCandidato(c) { return colorCandidatos[c] || C.carbon; }

  var COLOR_SEXO = { Mujer: C.oxido, Hombre: C.tinta, 'Sin dato': C.tinta300 };
  var EDADES = ['18 a 29', '30 a 44', '45 a 59', '60 o más', 'Sin dato'];
  var COLOR_EDAD = { '18 a 29': C.hielo, '30 a 44': C.tinta400, '45 a 59': C.tinta600, '60 o más': C.tinta, 'Sin dato': '#dddad0' };
  var CONFIANZAS = ['ALTA', 'MEDIA', 'BAJA', 'MUY_BAJA', 'CENTROIDE', 'Sin dato'];
  var COLOR_CONFIANZA = { ALTA: C.tinta, MEDIA: C.tinta600, BAJA: C.ambar, MUY_BAJA: C.oxido, CENTROIDE: C.naranja, 'Sin dato': '#dddad0' };

  // Filtros laterales y del dashboard sobre las respuestas del Conglomerado
  var FILTROS = [
    { col: 'Fecha (nombre de la hoja)', clave: 'hoja' },
    { col: 'Candidato', clave: 'cand' },
    { col: 'Emparejado con persona', f: function (r) { return r.emp ? 'Sí' : 'No'; } },
    { col: 'Sexo', clave: 'sexo' },
    { col: 'Rango de edad', clave: 'edadRango', orden: EDADES },
    { col: 'Sección', clave: 'seccion', numerico: true },
    { col: 'Colonia', clave: 'colonia' },
    { col: 'Origen del teléfono', clave: 'origenTel' },
    { col: 'Nivel de confianza', clave: 'confianza', orden: CONFIANZAS },
    { col: 'Es servidor público', clave: 'servidor' },
    { col: 'Servidor público (dependencia)', clave: 'servidorValor' },
    { col: 'Partido local', clave: 'partidoLocal' },
    { col: 'Partido nacional', clave: 'partido' },
    { col: 'Es beneficiario', clave: 'beneficiario' },
    { col: 'Beneficiario (dependencia)', clave: 'beneficiarioValor' },
    { col: 'Programa local', clave: 'programaLocal' },
    { col: 'Programa federal', clave: 'programaFederal' },
    { col: 'Cambió de opinión', f: function (r) { return r.tel_.cambia ? 'Sí' : 'No'; } }
  ];
  // Filtros de las columnas de la persona (ServidorPublico, partidos, Beneficiario y programas):
  // tambien se usan en el dashboard y en Migracion de opinion
  var CLAVES_PERSONA = ['servidor', 'servidorValor', 'partidoLocal', 'partido', 'beneficiario', 'beneficiarioValor', 'programaLocal', 'programaFederal'];
  var FILTROS_PERSONA = FILTROS.filter(function (d) { return CLAVES_PERSONA.indexOf(d.clave) !== -1; });
  function valorFiltro(def, r) { return def.f ? def.f(r) : (r[def.clave] === '' ? 'Sin dato' : r[def.clave]); }
  function valoresFiltro(def, modelo) {
    var vistos = {};
    modelo.registros.forEach(function (r) { vistos[valorFiltro(def, r)] = 1; });
    var lista = Object.keys(vistos);
    if (def.clave === 'hoja') return modelo.hojas.slice();
    if (def.clave === 'cand') return modelo.candidatos.slice();
    if (def.orden) return def.orden.filter(function (x) { return vistos[x]; }).concat(lista.filter(function (x) { return def.orden.indexOf(x) === -1; }));
    return lista.sort(function (a, b) {
      if (a === 'Sin dato') return 1;
      if (b === 'Sin dato') return -1;
      return def.numerico ? (+a) - (+b) : a.localeCompare(b, 'es');
    });
  }

  // ---- Resultados 2024 por seccion (capa mCUU1624): coaliciones y su desglose por partido ----
  var COLOR_PARTIDO = {
    'COAL PAN-PRI-PRD': '#0047AB', PAN: '#0047AB', PRI: '#00953A', PRD: '#E0B800',
    'COAL MORENA-PT': '#A50F2D', MORENA: '#A50F2D', PT: '#D2232A', PVEM: '#50B747', MC: '#FF7A00',
    MRCH: '#7a5c99', PUEBLO: '#8aa1ae', Nulos: '#9aa0a6', 'Cand. no reg.': '#c2c7cb'
  };
  var ESTRUCTURA_2024 = [
    { etiqueta: 'COAL PAN-PRI-PRD', campo: 'F2024___COAL_PAN_PRI_PRD', partidos: [['PAN', 'F2024___PAN'], ['PRI', 'F2024___PRI'], ['PRD', 'F2024___PRD']] },
    { etiqueta: 'COAL MORENA-PT', campo: 'F2024___COAL_MORENA_PT', partidos: [['MORENA', 'F2024___MORENA'], ['PT', 'F2024___PT']] },
    { etiqueta: 'MC', campo: 'F2024___MC' },
    { etiqueta: 'PVEM', campo: 'F2024___PVEM' },
    { etiqueta: 'MRCH', campo: 'F2024___MRCH' },
    { etiqueta: 'PUEBLO', campo: 'F2024___PUEBLO' },
    { etiqueta: 'Nulos', campo: 'F2024___NULOS' },
    { etiqueta: 'Cand. no reg.', campo: 'F2024___CAND__NO_REG' }
  ];
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  // Suma los resultados 2024 de una lista de propiedades de seccion
  function sumar2024(props) {
    var r = { secciones: props.length, lista: 0, votos: 0, ganadas: {}, grupos: [] };
    ESTRUCTURA_2024.forEach(function (g) {
      var grupo = { etiqueta: g.etiqueta, votos: 0, partidos: (g.partidos || []).map(function (p) { return { etiqueta: p[0], campo: p[1], votos: 0 }; }) };
      r.grupos.push(grupo);
    });
    props.forEach(function (p) {
      r.lista += num(p.F2024___LISTA_NOMINAL);
      r.votos += num(p.F2024___TOTAL_VOTOS);
      var g = p.F2024___GANADOR || 'Sin dato';
      r.ganadas[g] = (r.ganadas[g] || 0) + 1;
      ESTRUCTURA_2024.forEach(function (def, i) {
        r.grupos[i].votos += num(p[def.campo]);
        r.grupos[i].partidos.forEach(function (pp) { pp.votos += num(p[pp.campo]); });
      });
    });
    // en una coalicion, los votos que no se asignan a un solo partido son combinaciones entre ellos
    r.grupos.forEach(function (g) {
      if (!g.partidos.length) return;
      var suma = g.partidos.reduce(function (s, p) { return s + p.votos; }, 0);
      // si la suma de partidos rebasa al total (discrepancia del computo) no se muestra el renglon
      if (Math.round(g.votos - suma) > 0) g.partidos.push({ etiqueta: 'Combinaciones', votos: g.votos - suma });
    });
    r.participacion = r.lista ? r.votos / r.lista : 0;
    return r;
  }

  function fmt(n, dec) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function pct(v, dec) { return (v === null || !isFinite(v)) ? '—' : fmt(v * 100, dec === undefined ? 1 : dec) + '%'; }
  function escapar(t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function titulo(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(.\-])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Del|La|Las|Los|Y|El|En)\b/g, function (m) { return m.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function contar(lista, f) {
    var c = {};
    lista.forEach(function (x) { var k = f(x); c[k] = (c[k] || 0) + 1; });
    return c;
  }
  // Descarga de un CSV generado en el navegador
  function descargarCsv(nombre, columnas, filas) {
    var esc = function (v) { v = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var texto = '﻿' + columnas.map(esc).join(',') + '\n' + filas.map(function (f) { return f.map(esc).join(','); }).join('\n') + '\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  return {
    C: C, DISTRITOS_LOCALES: DISTRITOS_LOCALES, DISTRITOS_FEDERALES: DISTRITOS_FEDERALES,
    asignarColores: asignarColores, colorCandidato: colorCandidato,
    COLOR_SEXO: COLOR_SEXO, EDADES: EDADES, COLOR_EDAD: COLOR_EDAD, CONFIANZAS: CONFIANZAS, COLOR_CONFIANZA: COLOR_CONFIANZA,
    FILTROS: FILTROS, FILTROS_PERSONA: FILTROS_PERSONA, valorFiltro: valorFiltro, valoresFiltro: valoresFiltro,
    COLOR_PARTIDO: COLOR_PARTIDO, sumar2024: sumar2024,
    fmt: fmt, pct: pct, escapar: escapar, titulo: titulo, contar: contar, descargarCsv: descargarCsv
  };
})();
