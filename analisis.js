// Analisis manual: bloques guardados desde las ventanas de resumen del mapa (index.html)
// y mostrados en analisis.html. Se guardan en localStorage del navegador, por lo que viven
// en el equipo y navegador donde se crearon.

var AM = (function () {
  var CLAVE = 'cuu_rl_analisis_manual_v1'; // propia de este sitio: en GitHub Pages los repositorios de una cuenta comparten localStorage

  function cargar() {
    try {
      var lista = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  }

  function escribir(lista) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
      return true;
    } catch (e) {
      return false;
    }
  }

  // bloque = { titulo, origen, contexto, html }; devuelve el bloque guardado o null si fallo
  function guardar(bloque) {
    var lista = cargar();
    var nuevo = {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      titulo: bloque.titulo,
      origen: bloque.origen,
      contexto: bloque.contexto || '',
      html: bloque.html,
      fecha: new Date().toISOString()
    };
    lista.push(nuevo);
    return escribir(lista) ? nuevo : null;
  }

  function eliminar(id) {
    return escribir(cargar().filter(function (b) { return b.id !== id; }));
  }

  // Guarda el orden de los bloques segun la lista de ids; los que no vengan en la lista se
  // conservan al final (p. ej. guardados desde otra pestaña mientras se reordenaba)
  function reordenar(ids) {
    var lista = cargar();
    var porId = {};
    lista.forEach(function (b) { porId[b.id] = b; });
    var ordenada = ids.filter(function (id) { return porId[id]; }).map(function (id) { return porId[id]; });
    lista.forEach(function (b) { if (ids.indexOf(b.id) === -1) ordenada.push(b); });
    return escribir(ordenada);
  }

  function formatearFecha(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var dos = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
  }

  function icono(nombre, clase) {
    var s = document.createElement('span');
    s.className = 'material-symbols-outlined' + (clase ? ' ' + clase : '');
    s.textContent = nombre;
    return s;
  }

  // Modal generica con el estilo del tema.
  // opciones = { icono, titulo, contenido (Node), textoAccion, onAccion (devuelve false para no cerrar), alAbrir }
  function abrirModal(opciones) {
    var scrim = document.createElement('div');
    scrim.className = 'vw-modal-scrim';
    var dialogo = document.createElement('div');
    dialogo.className = 'vw-modal';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');

    var cabecera = document.createElement('div');
    cabecera.className = 'vw-modal-cabecera';
    var tituloEl = document.createElement('h3');
    tituloEl.appendChild(icono(opciones.icono || 'bookmark_add', 'vw-modal-icono'));
    tituloEl.appendChild(document.createTextNode(opciones.titulo));
    var cerrarBtn = document.createElement('button');
    cerrarBtn.type = 'button';
    cerrarBtn.className = 'vw-modal-cerrar';
    cerrarBtn.title = 'Cerrar';
    cerrarBtn.appendChild(icono('close'));
    cabecera.appendChild(tituloEl);
    cabecera.appendChild(cerrarBtn);

    var cuerpo = document.createElement('div');
    cuerpo.className = 'vw-modal-cuerpo';
    if (opciones.contenido) cuerpo.appendChild(opciones.contenido);

    var pie = document.createElement('div');
    pie.className = 'vw-modal-pie';
    var cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'kt-btn kt-btn-outline';
    cancelar.textContent = 'Cancelar';
    var accion = document.createElement('button');
    accion.type = 'button';
    accion.className = 'kt-btn kt-btn-primary vw-modal-accion' + (opciones.peligro ? ' vw-modal-accion-peligro' : '');
    accion.appendChild(document.createTextNode(opciones.textoAccion || 'Guardar'));
    accion.appendChild(icono('arrow_forward', 'vw-ico-18'));
    pie.appendChild(cancelar);
    pie.appendChild(accion);

    dialogo.appendChild(cabecera);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    scrim.appendChild(dialogo);
    document.body.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('vw-modal-abierta'); });

    function cerrar() {
      document.removeEventListener('keydown', teclas);
      scrim.remove();
    }
    function ejecutar() {
      if (opciones.onAccion && opciones.onAccion() === false) return;
      cerrar();
    }
    function teclas(e) {
      if (e.key === 'Escape') cerrar();
    }
    // Los mousedown/click no deben llegar a la ventana arrastrable ni a los listeners del documento
    scrim.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    scrim.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === scrim) cerrar();
    });
    cerrarBtn.addEventListener('click', cerrar);
    cancelar.addEventListener('click', cerrar);
    accion.addEventListener('click', ejecutar);
    document.addEventListener('keydown', teclas);
    if (opciones.alAbrir) opciones.alAbrir(ejecutar);
  }

  // Modal "Guardar": nombre editable (precargado con el titulo de la ventana) y boton Guardar.
  function modalGuardar(tituloInicial, onGuardar) {
    var contenido = document.createElement('div');
    contenido.className = 'vw-modal-campos';
    var etiqueta = document.createElement('label');
    etiqueta.className = 'vw-label';
    etiqueta.textContent = 'Nombre del bloque';
    etiqueta.htmlFor = 'am_nombre_bloque';
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'am_nombre_bloque';
    input.className = 'vw-input';
    input.maxLength = 120;
    input.value = tituloInicial;
    var nota = document.createElement('p');
    nota.className = 'vw-modal-nota';
    nota.appendChild(icono('info', 'vw-ico-16'));
    nota.appendChild(document.createTextNode('El bloque se agregará a la hoja Análisis manual con los datos tal como se ven en esta ventana.'));
    contenido.appendChild(etiqueta);
    contenido.appendChild(input);
    contenido.appendChild(nota);

    abrirModal({
      icono: 'bookmark_add',
      titulo: 'Guardar análisis',
      contenido: contenido,
      textoAccion: 'Guardar',
      onAccion: function () {
        var nombre = input.value.trim();
        if (!nombre) {
          input.classList.add('vw-input-error');
          input.focus();
          return false;
        }
        onGuardar(nombre);
      },
      alAbrir: function (ejecutar) {
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ejecutar(); });
        input.addEventListener('input', function () { input.classList.remove('vw-input-error'); });
        setTimeout(function () { input.focus(); input.select(); }, 30);
      }
    });
  }

  function modalConfirmar(titulo, texto, textoAccion, onConfirmar) {
    var p = document.createElement('p');
    p.className = 'vw-modal-texto';
    p.textContent = texto;
    abrirModal({ icono: 'warning', titulo: titulo, contenido: p, textoAccion: textoAccion, peligro: true, onAccion: onConfirmar });
  }

  // Aviso breve en la esquina inferior; enlace opcional { texto, href }
  function aviso(texto, enlace, error) {
    var t = document.createElement('div');
    t.className = 'vw-toast' + (error ? ' vw-toast-error' : '');
    t.appendChild(icono(error ? 'error' : 'check_circle', 'vw-ico-18'));
    var s = document.createElement('span');
    s.textContent = texto;
    t.appendChild(s);
    if (enlace) {
      var a = document.createElement('a');
      a.href = enlace.href;
      a.textContent = enlace.texto;
      t.appendChild(a);
    }
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('vw-toast-visible'); });
    setTimeout(function () {
      t.classList.remove('vw-toast-visible');
      setTimeout(function () { t.remove(); }, 250);
    }, 4000);
  }

  return {
    cargar: cargar,
    guardar: guardar,
    eliminar: eliminar,
    reordenar: reordenar,
    formatearFecha: formatearFecha,
    modalGuardar: modalGuardar,
    modalConfirmar: modalConfirmar,
    aviso: aviso
  };
})();
