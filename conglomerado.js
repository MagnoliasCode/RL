// Conglomerado RL: modelo de analisis sobre los datos integrados en datos/conglomerado-rl.js
// (generado desde "Conglomerado RL.xlsx" con herramientas/excel_a_js.py).
// Se conservan TODAS las columnas y valores del archivo tal como vienen.

var CG = (function () {
  // Columnas que usa el analisis, reconocidas por nombre (sin acentos, espacios ni mayusculas).
  // Si un archivo futuro trae otras columnas, se conservan igual y se muestran en la tabla.
  var CAMPOS = {
    telefono: ['numerodetelefono', 'telefono', 'numero'],
    hoja: ['nombredelahoja', 'hoja', 'fecha'],
    candidato: ['candidato', 'opinion'],
    ciudadanoId: ['ciudadanoid'],
    nombre: ['nombrecompleto', 'nombre'],
    sexo: ['sexo'],
    fechaNacimiento: ['fechanacimiento'],
    edad: ['edad'],
    curp: ['curp'],
    servidor: ['servidorpublico'],
    cve: ['cve'],
    df: ['distritofederal'],
    dl: ['distritolocal'],
    municipio: ['municipio'],
    nombreMunicipio: ['nombremunicipio'],
    seccion: ['seccion'],
    entidad: ['nombreentidad'],
    origenTel: ['origentelefono'],
    colonia: ['colonia'],
    cp: ['cp'],
    lat: ['lat', 'latitud'],
    lon: ['lon', 'lng', 'longitud'],
    direccion: ['direccioncompleta'],
    confianza: ['nivelconfianza'],
    partidoLocal: ['partidolocal'],
    partidoNacional: ['partidonacional'],
    beneficiario: ['beneficiario'],
    programaLocal: ['programalocal'],
    programaFederal: ['programafederal']
  };
  var VARIOS = 'Varios en la misma fecha';
  var MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function vacio(v) { v = String(v === null || v === undefined ? '' : v).trim(); return v === '' || v.toUpperCase() === 'NULL'; }

  // ---------------------------------------------------------------- modelo
  function ordenHoja(nombre) {
    var m = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(\d+))?/i.exec(normalizar(nombre) === '' ? '' : String(nombre).toLowerCase());
    if (!m) return 99999;
    var mes = MESES[normalizar(m[2])] || 13;
    return mes * 1000 + (+m[1]) * 10 + (m[3] ? +m[3] : 1);
  }
  function rangoEdad(e) {
    var n = parseInt(e, 10);
    if (!isFinite(n) || n <= 0) return 'Sin dato';
    if (n < 30) return '18 a 29';
    if (n < 45) return '30 a 44';
    if (n < 60) return '45 a 59';
    return '60 o más';
  }
  function siNo(v) { if (vacio(v)) return 'Sin dato'; return String(v).trim() === '0' ? 'No' : 'Sí'; }
  function crudo(v) { return vacio(v) ? 'Sin dato' : String(v).trim(); }

  // Columnas del Excel que se filtran con sus valores tal como vienen (mapa, dashboard y migracion).
  // clave: propiedad en cada respuesta (r[clave]); campo: llave de CAMPOS.
  var COLUMNAS_FILTRO = [
    { clave: 'servidorValor', campo: 'servidor', col: 'ServidorPublico' },
    { clave: 'partidoLocal', campo: 'partidoLocal', col: 'PartidoLocal' },
    { clave: 'partido', campo: 'partidoNacional', col: 'PartidoNacional' },
    { clave: 'beneficiarioValor', campo: 'beneficiario', col: 'Beneficiario' },
    { clave: 'programaLocal', campo: 'programaLocal', col: 'ProgramaLocal' },
    { clave: 'programaFederal', campo: 'programaFederal', col: 'ProgramaFederal' }
  ];

  function construirModelo(guardado) {
    var columnas = guardado.columnas;
    var indice = {};
    var norm = columnas.map(normalizar);
    Object.keys(CAMPOS).forEach(function (k) {
      for (var i = 0; i < CAMPOS[k].length; i++) {
        var j = norm.indexOf(CAMPOS[k][i]);
        if (j !== -1 && Object.keys(indice).map(function (x) { return indice[x]; }).indexOf(j) === -1) { indice[k] = j; break; }
      }
    });
    function v(fila, k) { return indice[k] === undefined ? '' : fila[indice[k]]; }

    var hojas = {}, personas = {};
    var registros = guardado.filas.map(function (fila, n) {
      var emp = !vacio(v(fila, 'ciudadanoId'));
      var lat = parseFloat(v(fila, 'lat')), lon = parseFloat(v(fila, 'lon'));
      var r = {
        n: n, fila: fila,
        tel: String(v(fila, 'telefono')).trim(),
        hoja: String(v(fila, 'hoja')).trim(),
        cand: String(v(fila, 'candidato')).trim() || 'Sin dato',
        emp: emp,
        dl: vacio(v(fila, 'dl')) ? '' : String(v(fila, 'dl')).trim(),
        df: vacio(v(fila, 'df')) ? '' : String(v(fila, 'df')).trim(),
        seccion: vacio(v(fila, 'seccion')) ? '' : String(v(fila, 'seccion')).trim(),
        colonia: vacio(v(fila, 'colonia')) ? '' : String(v(fila, 'colonia')).trim(),
        sexo: vacio(v(fila, 'sexo')) ? 'Sin dato' : String(v(fila, 'sexo')).trim(),
        edadRango: emp ? rangoEdad(v(fila, 'edad')) : 'Sin dato',
        origenTel: vacio(v(fila, 'origenTel')) ? 'Sin dato' : String(v(fila, 'origenTel')).trim(),
        confianza: vacio(v(fila, 'confianza')) ? 'Sin dato' : String(v(fila, 'confianza')).trim(),
        lat: emp && isFinite(lat) && lat !== 0 ? lat : null,
        lon: emp && isFinite(lon) && lon !== 0 ? lon : null
      };
      r.orden = ordenHoja(r.hoja);
      hojas[r.hoja] = r.orden;
      var p = personas[r.tel];
      if (!p) p = personas[r.tel] = { tel: r.tel, registros: [], ficha: null };
      p.registros.push(r);
      if (emp && !p.ficha) p.ficha = r;
      return r;
    });

    var listaHojas = Object.keys(hojas).sort(function (a, b) { return hojas[a] - hojas[b] || a.localeCompare(b, 'es'); });
    var listaPersonas = Object.keys(personas).map(function (t) {
      var p = personas[t];
      var porHoja = {};
      p.registros.forEach(function (r) {
        var h = porHoja[r.hoja] = porHoja[r.hoja] || { hoja: r.hoja, orden: r.orden, candidatos: [] };
        if (h.candidatos.indexOf(r.cand) === -1) h.candidatos.push(r.cand);
      });
      p.opiniones = Object.keys(porHoja).map(function (h) { return porHoja[h]; })
        .sort(function (a, b) { return a.orden - b.orden || a.hoja.localeCompare(b.hoja, 'es'); });
      // Cambia de opinion: en fechas distintas expreso preferencias distintas (dos respuestas
      // distintas en una misma fecha no cuentan por si solas como cambio)
      var firmas = p.opiniones.map(function (o) { return o.candidatos.slice().sort().join(' / '); });
      p.cambia = p.opiniones.length > 1 && firmas.some(function (f) { return f !== firmas[0]; });
      p.primera = firmas[0];
      p.ultima = firmas[firmas.length - 1];
      // Para matrices y filtros: un solo candidato, o 'Varios en la misma fecha' si esa fecha trae varios
      var categoria = function (o) { return o.candidatos.length === 1 ? o.candidatos[0] : VARIOS; };
      p.primeraCat = categoria(p.opiniones[0]);
      p.ultimaCat = categoria(p.opiniones[p.opiniones.length - 1]);
      p.candidatosDistintos = Array.from(new Set(p.registros.map(function (r) { return r.cand; })));
      // r.tel_ = telefono-persona de cada respuesta; r.persona solo cuando hay ficha emparejada
      // (la ficha y la ubicacion aplican a todas sus respuestas)
      p.registros.forEach(function (r) { r.tel_ = p; if (p.ficha) r.persona = p; });
      // Servidor publico, partidos, beneficiario y programas son datos de la persona: se toman de su
      // ficha para todas sus respuestas (las respuestas sin ficha quedan en 'Sin dato')
      var origen = p.ficha ? p.ficha.fila : null;
      p.registros.forEach(function (r) {
        COLUMNAS_FILTRO.forEach(function (c) { r[c.clave] = origen ? crudo(v(origen, c.campo)) : 'Sin dato'; });
        r.servidor = origen ? siNo(v(origen, 'servidor')) : 'Sin dato';
        r.beneficiario = origen ? siNo(v(origen, 'beneficiario')) : 'Sin dato';
      });
      return p;
    });
    var candidatos = {};
    registros.forEach(function (r) { candidatos[r.cand] = (candidatos[r.cand] || 0) + 1; });

    return {
      meta: guardado.meta,
      columnas: columnas,
      indice: indice,
      registros: registros,
      personas: listaPersonas,
      personaPorTel: personas,
      hojas: listaHojas,
      candidatos: Object.keys(candidatos).sort(function (a, b) { return candidatos[b] - candidatos[a]; }),
      conteoCandidatos: candidatos,
      valor: function (r, campo) { return v(r.fila, campo); }
    };
  }

  var cache = null;
  function obtener() {
    if (!cache && typeof CONGLOMERADO_RL !== 'undefined') cache = construirModelo(CONGLOMERADO_RL);
    return Promise.resolve(cache);
  }

  // ---------------------------------------------------------------- panel de estado reutilizable
  // contenedor: elemento donde se dibuja; alCargar(modelo) se llama con los datos integrados.
  function panel(contenedor, alCargar, opciones) {
    opciones = opciones || {};
    obtener().then(function (modelo) {
      // con datos no se muestra nada: el cuadro solo aparece si falta el archivo de datos
      if (modelo) { contenedor.remove(); alCargar(modelo); return; }
      var caja = document.createElement('div');
      caja.className = 'cg-panel' + (opciones.compacto ? ' cg-panel-compacto' : '');
      caja.innerHTML = '<div class="cg-panel-estado"><span class="material-symbols-outlined">error</span><div><b>Sin datos del Conglomerado</b>' +
        '<span>Falta datos/conglomerado-rl.js: ejecute python herramientas/excel_a_js.py</span></div></div>';
      contenedor.innerHTML = '';
      contenedor.appendChild(caja);
    });
  }

  return { VARIOS: VARIOS, COLUMNAS_FILTRO: COLUMNAS_FILTRO, obtener: obtener, panel: panel, vacio: vacio, normalizar: normalizar, rangoEdad: rangoEdad };
})();
