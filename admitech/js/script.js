// ── TABS ──
function switchTab(name, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  (el || document.querySelector(`.tab[onclick*="'${name}'"]`))?.classList.add('active');
  document.getElementById('day-bar').style.display = (name === 'tickets') ? 'none' : 'flex';
  if (name === 'entradas') _actualizarTituloEntradas();
}

// ── EVENTOS (reemplaza "días") ──
const EVENTO_IDS = ['evento1','evento2','evento3','evento4','evento5'];
let diaActual = 'evento1';

// Almacena entradas por evento en memoria para no perder cambios al cambiar de tab
let entradasPorEvento = { evento1: null, evento2: null, evento3: null, evento4: null, evento5: null };

function switchDay(dia) {
  _guardarEntradasActuales();
  diaActual = dia;
  document.querySelectorAll('.day-pill').forEach(p => p.classList.toggle('active', p.dataset.day === dia));
  document.querySelectorAll('.day-content').forEach(c => c.classList.toggle('active', c.dataset.day === dia));
  _cargarEntradasEnPanel(entradasPorEvento[dia] || {});
  _actualizarTituloEntradas();
}

function _actualizarTituloEntradas() {
  const n = diaActual.replace('evento', '');
  const titulo = document.querySelector('#panel-entradas .section-title');
  if (titulo) titulo.textContent = `Tipos de entrada — Evento ${n}`;
  const sub = document.querySelector('#panel-entradas .section-sub');
  if (sub) sub.textContent = `Agrega, elimina o edita tipos de entrada del Evento ${n}. Los cambios se aplican al guardar.`;
}

function actualizarDayDot(dia, activo) {
  const dot = document.getElementById('day-dot-' + dia);
  if (dot) dot.classList.toggle('on', activo);
}

function actualizarPreviewSlide(dia) {
  const fechaInput = document.getElementById('ev-fecha-' + dia);
  const fechaEl = document.getElementById('slide-preview-date-' + dia);
  if (fechaEl && fechaInput) fechaEl.textContent = fechaInput.value.trim();
}

// ── TOAST ──
function mostrarToast(mensaje, tipo) {
  const t = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  txt.textContent = mensaje;
  t.className = 'toast' + (tipo === 'error' ? ' toast-error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ── GUARDAR CONFIG ──
async function guardarEvento() {
  const eventoActivoEl = document.getElementById('toggle-evento-activo-' + diaActual);
  if (eventoActivoEl?.checked) {
    // Auto-activar carrito
    const carritoToggle = document.getElementById('toggle-carrito-' + diaActual);
    if (carritoToggle) carritoToggle.checked = true;
    // Verificar entradas desactivadas del evento actual
    const entradasActuales = _leerEntradasDelPanel();
    const inactivas = Object.values(entradasActuales)
      .filter(e => !e.activa && !e.proximamente)
      .map(e => e.nombre || '—');
    if (inactivas.length) {
      const ok = confirm(
        `Las siguientes entradas del Evento ${diaActual.replace('evento','')} están desactivadas:\n\n• ${inactivas.join('\n• ')}\n\n¿Publicar igual? (puedes ir al tab Entradas para activarlas primero)`
      );
      if (!ok) { switchTab('entradas'); return; }
    }
  }
  await guardar();
}

async function guardar() {
  const adminKey = getKey();
  if (!adminKey) { mostrarToast('No autenticado', 'error'); return; }

  // Guardar entradas del evento actualmente visible antes de leer todo
  _guardarEntradasActuales();

  // Construir objeto por cada slot de evento
  const eventoObjs = {};
  EVENTO_IDS.forEach(id => {
    const activo               = document.getElementById(`toggle-evento-activo-${id}`)?.checked   ?? false;
    const destacado            = document.getElementById(`toggle-destacado-${id}`)?.checked       ?? false;
    const carrito              = document.getElementById(`toggle-carrito-${id}`)?.checked ?? false;
    const anuncio              = document.getElementById(`toggle-anuncio-${id}`)?.checked ?? false;
    // entradasGratis/Agotada se derivan de la fila gratis en la pestaña Entradas
    const _entradas = entradasPorEvento[id] || {};
    const _gratisEntry = Object.values(_entradas).find(e => e.tipo === 'gratis');
    const entradasGratis        = !!(_gratisEntry?.activa);
    const entradasGratisAgotada = !!(_gratisEntry && !_gratisEntry.activa && !_gratisEntry.proximamente);
    const limRaw               = parseInt(document.getElementById(`ev-limiteGratis-${id}`)?.value || '100', 10);
    const limiteEntradasGratis = isNaN(limRaw) || limRaw <= 0 ? 100 : limRaw;

    eventoObjs[id] = {
      activo, destacado, carrito, anuncio,
      entradasGratis, entradasGratisAgotada, limiteEntradasGratis,
      nombre:   document.getElementById(`ev-nombre-${id}`)?.value?.trim()    || '',
      fecha:    document.getElementById(`ev-fecha-${id}`)?.value?.trim()     || '',
      imagen:   document.getElementById(`ev-imagen-${id}`)?.value?.trim()    || '',
      lineup:   document.getElementById(`ev-lineup-${id}`)?.value?.trim()    || '',
      diaLabel: document.getElementById(`ev-diaLabel-${id}`)?.value?.trim()  || '',
      entradas: entradasPorEvento[id] || {},
    };
  });

  // Backward compat: keys planos que el frontend antiguo espera (mapeados al evento1)
  const ev1 = eventoObjs.evento1;
  const config = {
    // Claves planas legacy
    eventoActivo:              ev1.activo,
    carrito:                   ev1.carrito,
    anuncio:                   ev1.anuncio,
    entradasGratis:            ev1.entradasGratis,
    entradasGratisAgotada:     ev1.entradasGratisAgotada,
    limiteEntradasGratisViernes: ev1.limiteEntradasGratis,
    entradas:                  ev1.entradas,
    // eventoViernes = evento1 para backward compat
    eventoViernes: {
      activo:                ev1.activo,
      destacado:             ev1.destacado,
      carrito:               ev1.carrito,
      anuncio:               ev1.anuncio,
      entradasGratis:        ev1.entradasGratis,
      entradasGratisAgotada: ev1.entradasGratisAgotada,
      limiteEntradasGratis:  ev1.limiteEntradasGratis,
      nombre:   ev1.nombre,
      fecha:    ev1.fecha,
      imagen:   ev1.imagen,
      lineup:   ev1.lineup,
      diaLabel: ev1.diaLabel,
    },
    // Nuevos slots evento1..5
    ...eventoObjs,
  };

  try {
    const res = await fetch(`${API_BASE}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      mostrarToast('Cambios guardados y aplicados al sitio');
      actualizarResumenTickets();
    } else {
      mostrarToast('Error al guardar', 'error');
    }
  } catch {
    mostrarToast('Sin conexión', 'error');
  }
}

// ── MODAL REENVÍO ──
function abrirModalReenvio(codigo, correo) {
  document.getElementById('reenvio-codigo').value = codigo || '';
  document.getElementById('reenvio-correo').value = correo || '';
  document.getElementById('modal-reenvio').classList.add('show');
  document.addEventListener('keydown', cerrarModalReenvioEsc);
  document.getElementById('reenvio-codigo').focus();
}

function cerrarModalReenvio() {
  document.getElementById('modal-reenvio').classList.remove('show');
  document.removeEventListener('keydown', cerrarModalReenvioEsc);
}

function cerrarModalReenvioEsc(e) {
  if (e.key === 'Escape') cerrarModalReenvio();
}

async function enviarReenvio(event) {
  event.preventDefault();
  const adminKey = getKey();
  const codigo   = document.getElementById('reenvio-codigo').value.trim();
  const correo   = document.getElementById('reenvio-correo').value.trim();
  const btn      = document.querySelector('#form-reenvio button[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    const res = await fetch(`${API_BASE}/reenviar-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ codigo, email: correo }),
    });
    const data = await res.json();
    cerrarModalReenvio();
    mostrarToast(res.ok ? `Correo reenviado a ${correo}` : (data.error || 'Error al reenviar'), res.ok ? '' : 'error');
  } catch {
    cerrarModalReenvio();
    mostrarToast('Sin conexión', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reenviar correo';
  }
  return false;
}

// ── IMAGEN DEL EVENTO ──
function normalizarNombreArchivoEvento(fileName, dia) {
  const extension = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase();
  const extValida = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
  const diaKey = dia.startsWith('evento') ? dia : (dia === 'sabado' ? 'evento2' : 'evento1');
  return `evento-${diaKey}.${extValida}`;
}

function handleImagenSeleccionada(event, dia) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const nombreArchivo = normalizarNombreArchivoEvento(file.name, dia);
  document.getElementById('ev-imagen-preview-img-' + dia).src = url;
  document.getElementById('ev-imagen-wrap-' + dia).classList.add('has-image');
  document.getElementById('ev-imagen-' + dia).value = nombreArchivo;
  document.getElementById('ev-imagen-remove-' + dia).hidden = false;
}

function quitarImagen(dia) {
  document.getElementById('ev-imagen-wrap-' + dia).classList.remove('has-image');
  document.getElementById('ev-imagen-preview-img-' + dia).src = '';
  document.getElementById('ev-imagen-file-' + dia).value = '';
  document.getElementById('ev-imagen-' + dia).value = '';
  document.getElementById('ev-imagen-remove-' + dia).hidden = true;
}

// ── TOGGLES EVENTO ──
function onToggleEventoActivo(checkbox, dia) {
  if (!checkbox.checked) {
    const ok = confirm('¿Seguro que quieres desactivar el evento? Dejará de mostrarse en la página principal.');
    if (!ok) { checkbox.checked = true; return; }
  } else {
    const carritoToggle = document.getElementById('toggle-carrito-' + dia);
    if (carritoToggle && !carritoToggle.checked) carritoToggle.checked = true;
  }
  const badge = document.getElementById('estado-evento-badge-' + dia);
  badge.textContent = checkbox.checked ? 'Activo' : 'Inactivo';
  badge.classList.toggle('badge-green', checkbox.checked);
  badge.classList.toggle('badge-muted', !checkbox.checked);
  actualizarDayDot(dia, checkbox.checked);
}

function onToggleDestacado(checkbox, dia) {
  if (checkbox.checked) {
    // Solo un evento puede ser destacado a la vez
    EVENTO_IDS.forEach(id => {
      if (id !== dia) {
        const el = document.getElementById('toggle-destacado-' + id);
        if (el) el.checked = false;
      }
    });
  }
}

// ── ENTRADAS POR EVENTO (helpers) ──
function _leerEntradasDelPanel() {
  const entradas = {};
  document.querySelectorAll('#entradas-list .entrada-row:not(.entrada-row-header)').forEach(row => {
    const keyEl    = row.querySelector('.entrada-key');
    const precioEl = row.querySelector('.entrada-precio-input');
    const limiteEl = row.querySelector('.entrada-limite-input');
    const nombreEl = row.querySelector('.entrada-nombre-input');
    const tipoEl   = row.querySelector('.entrada-tipo-select');
    const estadoEl = row.querySelector('.entrada-estado-select');
    const horaEl   = row.querySelector('.entrada-hora-input');
    if (!keyEl) return;
    const key = keyEl.textContent.trim();
    if (!key) return;
    const estado = estadoEl?.value || 'activa';
    entradas[key] = {
      nombre:       nombreEl?.value?.trim() || key,
      precio:       parseInt(precioEl?.value || '0', 10),
      limite:       parseInt(limiteEl?.value || '0', 10),
      activa:       estado === 'activa',
      proximamente: estado === 'proximamente',
      tipo:         tipoEl?.value || 'general',
      personas:     tipoEl?.value === 'promo' ? 2 : 1,
      horaAcceso:   horaEl?.value?.trim() || '',
    };
  });
  return entradas;
}

function _guardarEntradasActuales() {
  entradasPorEvento[diaActual] = _leerEntradasDelPanel();
}

function _cargarEntradasEnPanel(entradas) {
  const list = document.getElementById('entradas-list');
  if (!list) return;
  if (!entradas || !Object.keys(entradas).length) {
    list.innerHTML = '';
    return;
  }
  // Asegurar que gratis siempre esté primero
  const gratisKey = 'gratis' in entradas ? 'gratis' : (Object.keys(entradas).find(k => entradas[k].tipo === 'gratis') || null);
  const sortedEntries = gratisKey ? [
    [gratisKey, entradas[gratisKey]],
    ...Object.entries(entradas).filter(([k]) => k !== gratisKey),
  ] : Object.entries(entradas);

  list.innerHTML = sortedEntries.map(([key, val]) => {
    const estado = val.proximamente ? 'proximamente' : (val.activa ? 'activa' : 'agotada');
    return `
      <div class="entrada-row">
        <div class="entrada-nombre">
          <input type="text" class="entrada-input entrada-nombre-input" value="${escapeHtml(val.nombre || key)}" placeholder="Nombre…" />
          <span class="entrada-key">${escapeHtml(key)}</span>
        </div>
        <div><select class="entrada-tipo-select">
          <option value="general"${val.tipo === 'general' ? ' selected' : ''}>General</option>
          <option value="vip"${val.tipo === 'vip' ? ' selected' : ''}>VIP</option>
          <option value="supervip"${val.tipo === 'supervip' ? ' selected' : ''}>Super VIP</option>
          <option value="gratis"${val.tipo === 'gratis' ? ' selected' : ''}>Gratis</option>
          <option value="promo"${val.tipo === 'promo' ? ' selected' : ''}>Promo 2x1</option>
        </select></div>
        <div><input type="number" value="${val.precio || 0}" min="0" class="entrada-input entrada-precio-input" /></div>
        <div><input type="number" value="${val.limite || 0}" min="0" class="entrada-input entrada-limite-input" /></div>
        <div class="entrada-stock">0</div>
        <div><select class="entrada-estado-select">
          <option value="activa"${estado === 'activa' ? ' selected' : ''}>Activa</option>
          <option value="agotada"${estado === 'agotada' ? ' selected' : ''}>Agotada</option>
          <option value="proximamente"${estado === 'proximamente' ? ' selected' : ''}>Próximamente</option>
        </select></div>
        <div><input type="text" value="${escapeHtml(val.horaAcceso || '')}" placeholder="Ej: 22:00" class="entrada-input entrada-hora-input" title="Hora de acceso (se muestra en el correo del ticket)" /></div>
        <button type="button" class="entrada-remove" onclick="this.closest('.entrada-row').remove()" title="Eliminar tipo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>`;
  }).join('');
}

// ── TICKETS DATA ──
let todosTickets = [];
let ticketsFiltrados = [];
let paginaActual = 1;
const TICKETS_POR_PAGINA = 25;

async function cargarTickets() {
  const adminKey = getKey();
  const tbody = document.getElementById('tickets-body');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">Cargando tickets…</td></tr>';

  try {
    const res  = await fetch(`${API_BASE}/admin/tickets`, { headers: { 'X-Admin-Key': adminKey } });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error');

    todosTickets = data.tickets;
    document.querySelector('#panel-tickets .section-sub').textContent =
      `${data.total} entrada${data.total !== 1 ? 's' : ''} en total`;
    document.getElementById('tab-ticket-count').textContent = data.total;

    actualizarFiltrosTickets();
    filtrarTickets();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red);">Error cargando tickets: ${e.message}</td></tr>`;
  }
}

function estadoBadge(estado) {
  if (estado === 'ACTIVO')  return '<span class="badge badge-green">ACTIVO</span>';
  if (estado === 'USADO')   return '<span class="badge badge-muted">USADO</span>';
  return '<span class="badge badge-red">ANULADO</span>';
}

function tipoLabel(evento) {
  const partes = String(evento || '').split(' — ');
  return partes.length > 1 ? partes.slice(1).join(' — ') : (evento || '—');
}

function eventoLabel(evento) {
  const partes = String(evento || '').split(' — ');
  return partes.length > 1 ? partes[0].trim() : '';
}

function renderTickets(data) {
  const tbody = document.getElementById('tickets-body');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">Sin resultados</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(t => {
    const nombre    = escapeHtml(`${t.nombre || ''} ${t.apellido || ''}`.trim() || '—');
    const rut       = escapeHtml(t.rut || '—');
    const email     = escapeHtml(t.email || '—');
    const tipo      = escapeHtml(tipoLabel(t.evento));
    const acomp     = escapeHtml(t.acompanante_de || '—');
    const codigo    = escapeHtml(t.codigo || '');
    const fecha     = escapeHtml(t.fecha_compra || '—');
    const estado    = t.estado || 'ACTIVO';
    const anulado   = estado === 'ANULADO';
    return `
      <tr class="ticket-row${anulado ? ' ticket-row-anulado' : ''}" onclick="filaTicketClick('${escapeHtml(t.codigo)}','${escapeHtml(t.email)}')">
        <td><span class="ticket-nombre">${nombre}</span></td>
        <td><span class="ticket-rut">${rut}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${email}</td>
        <td><span class="badge badge-muted">${tipo}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${acomp}</td>
        <td><span class="ticket-codigo">${codigo}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${fecha}</td>
        <td>${estadoBadge(estado)}</td>
        <td class="ticket-acciones">${anulado
          ? '<span class="ticket-accion-disabled">—</span>'
          : `<button type="button" class="ticket-accion-btn" onclick="event.stopPropagation(); anularTicket('${codigo}')" title="Anular ticket">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
             </button>`}
        </td>
      </tr>`;
  }).join('');
}

function filaTicketClick(codigo, email) {
  const ticket = todosTickets.find(t => t.codigo === codigo);
  if (!ticket || ticket.estado === 'ANULADO') return;
  abrirModalReenvio(codigo, email);
}

async function anularTicket(codigo) {
  const ok = confirm('¿Anular este ticket? Esta acción no se puede deshacer.');
  if (!ok) return;
  const adminKey = getKey();
  try {
    const res  = await fetch(`${API_BASE}/admin/anular-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ codigo }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const t = todosTickets.find(t => t.codigo === codigo);
      if (t) t.estado = 'ANULADO';
      renderPagina();
      mostrarToast('Ticket anulado');
    } else {
      mostrarToast(data.error || 'Error al anular', 'error');
    }
  } catch {
    mostrarToast('Sin conexión', 'error');
  }
}

// ── PAGINACIÓN ──
function totalPaginas() {
  return Math.max(1, Math.ceil(ticketsFiltrados.length / TICKETS_POR_PAGINA));
}

function renderPagina() {
  const inicio = (paginaActual - 1) * TICKETS_POR_PAGINA;
  renderTickets(ticketsFiltrados.slice(inicio, inicio + TICKETS_POR_PAGINA));
  document.getElementById('pagina-indicador').textContent = `Página ${paginaActual} de ${totalPaginas()}`;
  document.getElementById('btn-pagina-anterior').disabled = paginaActual <= 1;
  document.getElementById('btn-pagina-siguiente').disabled = paginaActual >= totalPaginas();
}

function paginaAnterior() {
  if (paginaActual > 1) { paginaActual--; renderPagina(); }
}

function paginaSiguiente() {
  if (paginaActual < totalPaginas()) { paginaActual++; renderPagina(); }
}

function filtrarTickets() {
  const q       = (document.getElementById('search-input')?.value || '').toLowerCase();
  const tipo    = document.getElementById('tickets-filtro-tipo')?.value || '';
  const evento  = document.getElementById('tickets-filtro-evento')?.value || '';
  ticketsFiltrados = todosTickets.filter(t => {
    const nombre  = `${t.nombre || ''} ${t.apellido || ''}`.toLowerCase();
    const tipo_t  = tipoLabel(t.evento);
    const evento_t = eventoLabel(t.evento);
    return (!tipo   || tipo_t   === tipo) &&
           (!evento || evento_t === evento) &&
           (!q || nombre.includes(q) ||
            (t.rut    || '').toLowerCase().includes(q) ||
            (t.codigo || '').toLowerCase().includes(q) ||
            (t.email  || '').toLowerCase().includes(q));
  });
  paginaActual = 1;
  renderPagina();
  actualizarResumenTickets();
}

function actualizarFiltrosTickets() {
  // Filtro por tipo
  const selectTipo = document.getElementById('tickets-filtro-tipo');
  if (selectTipo) {
    const valorTipo = selectTipo.value;
    const tipos = [...new Set(todosTickets.map(t => tipoLabel(t.evento)).filter(Boolean))];
    selectTipo.innerHTML = '<option value="">Todos los tipos</option>' +
      tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (tipos.includes(valorTipo)) selectTipo.value = valorTipo;
  }
  // Filtro por evento
  const selectEvento = document.getElementById('tickets-filtro-evento');
  if (selectEvento) {
    const valorEvento = selectEvento.value;
    const eventos = [...new Set(todosTickets.map(t => eventoLabel(t.evento)).filter(Boolean))];
    selectEvento.innerHTML = '<option value="">Todos los eventos</option>' +
      eventos.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
    if (eventos.includes(valorEvento)) selectEvento.value = valorEvento;
  }
}

// Alias para compatibilidad con llamadas antiguas
function actualizarFiltroTicketsPorTipo() { actualizarFiltrosTickets(); }

function actualizarResumenTickets() {
  const conteos = {};
  ticketsFiltrados.forEach(t => {
    const ev   = eventoLabel(t.evento) || 'Sin evento';
    const tipo = tipoLabel(t.evento)   || 'Sin tipo';
    const label = `${ev} / ${tipo}`;
    conteos[label] = (conteos[label] || 0) + 1;
  });
  const texto = Object.entries(conteos).map(([label, n]) => `${label}: ${n}`).join(' · ');
  const el = document.getElementById('tickets-resumen');
  if (el) el.textContent = texto || (todosTickets.length ? 'Sin resultados para el filtro' : 'Sin tickets registrados');
}

// ── EXPORTAR EXCEL ──
async function exportarCSV() {
  if (!todosTickets.length) { mostrarToast('No hay tickets para exportar', 'error'); return; }

  const COLS = [
    ['codigo',        'Código'],
    ['nombre',        'Nombre'],
    ['apellido',      'Apellido'],
    ['rut',           'RUT'],
    ['evento',        'Evento / Tipo'],
    ['acompanante_de','Acompañante de'],
    ['email',         'Email'],
    ['telefono',      'Teléfono'],
    ['precio_unit',   'Precio'],
    ['fecha_compra',  'Fecha compra'],
    ['id_pago',       'ID pago MP'],
    ['estado',        'Estado'],
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tickets');

  ws.columns = COLS.map(([key, label]) => {
    const maxLen = Math.max(label.length, ...todosTickets.map(t => String(t[key] ?? '').length));
    return { header: label, key, width: Math.min(maxLen + 4, 48) };
  });

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FF111111' }, size: 11, name: 'Calibri' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9A84C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF8B6B14' } } };
  });

  todosTickets.forEach((t, i) => {
    const row = ws.addRow(COLS.map(([key]) => t[key] ?? ''));
    row.height = 18;
    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF5EDD5';
    row.eachCell(cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font      = { size: 10, name: 'Calibri' };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `tickets-bluewine-${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('Excel exportado');
}

// ── ENTRADAS: AGREGAR ──
function agregarEntrada() {
  const list = document.getElementById('entradas-list');
  const uid = 'entrada' + Date.now();
  const row = document.createElement('div');
  row.className = 'entrada-row';
  row.innerHTML = `
    <div class="entrada-nombre">
      <input type="text" class="entrada-input entrada-nombre-input" value="" placeholder="Nombre del tipo…" oninput="actualizarKeyEntrada(this)" />
      <span class="entrada-key" style="font-size:10px;">${uid}</span>
    </div>
    <div><select class="entrada-tipo-select"><option value="general" selected>General</option><option value="vip">VIP</option><option value="supervip">Super VIP</option><option value="gratis">Gratis</option><option value="promo">Promo 2x1</option></select></div>
    <div><input type="number" value="5000" min="0" class="entrada-input entrada-precio-input" /></div>
    <div><input type="number" value="100"  min="0" class="entrada-input entrada-limite-input" /></div>
    <div class="entrada-stock">0</div>
    <div><select class="entrada-estado-select"><option value="activa" selected>Activa</option><option value="agotada">Agotada</option><option value="proximamente">Próximamente</option></select></div>
    <button type="button" class="entrada-remove" onclick="this.closest('.entrada-row').remove()" title="Eliminar tipo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>`;
  list.appendChild(row);
  row.querySelector('.entrada-nombre-input')?.focus();
}

function actualizarKeyEntrada(input) {
  const keyEl = input.closest('.entrada-row')?.querySelector('.entrada-key');
  if (!keyEl) return;
  const key = input.value.trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/).filter(Boolean)
    .map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1))
    .join('');
  if (key) keyEl.textContent = key;
}

// ── CARGAR CONFIG DEL SERVIDOR AL PANEL ──
async function cargarConfigPanel() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API_BASE}/config`, { signal: ctrl.signal });
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg.ok) return;

    const setToggle = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    // Fallback legacy: si no existe eventoN en cfg, intentar con claves antiguas.
    // Para evento1: usar el evento legacy que esté activo (sabado o viernes).
    // _usedLegacyKeys evita que dos slots consuman el mismo objeto legacy.
    const _legacyKeys = ['eventoSabado', 'eventoViernes'];
    const _fallback   = { evento2: ['eventoSabado', 'eventoViernes'] };
    const _usedLegacyKeys = new Set();
    function _resolverCfgEvento(id) {
      if (cfg[id] && typeof cfg[id] === 'object') return cfg[id];
      let legKey;
      if (id === 'evento1') {
        // Priorizar el que tenga activo:true; si ninguno, el primero que exista
        legKey = _legacyKeys.find(k => !_usedLegacyKeys.has(k) && cfg[k]?.activo)
              || _legacyKeys.find(k => !_usedLegacyKeys.has(k) && cfg[k] && typeof cfg[k] === 'object');
      } else {
        const legs = _fallback[id] || [];
        legKey = legs.find(k => !_usedLegacyKeys.has(k) && cfg[k] && typeof cfg[k] === 'object');
      }
      if (!legKey) return null;
      _usedLegacyKeys.add(legKey);
      const ev = { ...cfg[legKey] };
      if (id === 'evento1') {
        if (!('activo'    in ev)) ev.activo   = !!cfg.eventoActivo;
        if (!('carrito'   in ev)) ev.carrito  = !!cfg.carrito;
        if (!('anuncio'   in ev)) ev.anuncio  = !!cfg.anuncio;
        if (!('destacado' in ev)) ev.destacado = true;
        if (!('entradasGratis' in ev) && 'entradasGratis' in cfg) ev.entradasGratis = cfg.entradasGratis;
        if (!('entradasGratisAgotada' in ev) && 'entradasGratisAgotada' in cfg) ev.entradasGratisAgotada = cfg.entradasGratisAgotada;
        if (!('limiteEntradasGratis' in ev) && cfg.limiteEntradasGratisViernes) ev.limiteEntradasGratis = cfg.limiteEntradasGratisViernes;
      } else {
        // Slots secundarios: no heredar activo:true del legado — el usuario activa explícitamente
        ev.activo   = false;
        ev.carrito  = false;
        ev.destacado = false;
      }
      return ev;
    }

    EVENTO_IDS.forEach(id => {
      const ev = _resolverCfgEvento(id);
      if (!ev) return;

      setToggle(`toggle-evento-activo-${id}`, ev.activo);
      setToggle(`toggle-destacado-${id}`,     ev.destacado);
      setToggle(`toggle-carrito-${id}`,        ev.carrito);
      setToggle(`toggle-anuncio-${id}`,         ev.anuncio);

      const badge = document.getElementById(`estado-evento-badge-${id}`);
      if (badge) {
        badge.textContent = ev.activo ? 'Activo' : 'Inactivo';
        badge.className = 'badge ' + (ev.activo ? 'badge-green' : 'badge-muted');
        badge.style.cssText = 'font-size:13px;padding:4px 12px;';
      }
      actualizarDayDot(id, ev.activo);

      const setVal = (fieldId, v) => { const el = document.getElementById(fieldId); if (el && v) el.value = v; };
      setVal(`ev-nombre-${id}`,    ev.nombre);
      setVal(`ev-lineup-${id}`,    ev.lineup);
      setVal(`ev-diaLabel-${id}`,  ev.diaLabel);
      if (ev.limiteEntradasGratis) setVal(`ev-limiteGratis-${id}`, ev.limiteEntradasGratis);
      if (ev.fecha) { setVal(`ev-fecha-${id}`, ev.fecha); actualizarPreviewSlide(id); }
      if (ev.imagen) {
        setVal(`ev-imagen-${id}`, ev.imagen);
        const preview = document.getElementById(`ev-imagen-preview-img-${id}`);
        if (preview) {
          preview.src = `../Imagenes/${ev.imagen}`;
          document.getElementById(`ev-imagen-wrap-${id}`)?.classList.add('has-image');
          const removeBtn = document.getElementById(`ev-imagen-remove-${id}`);
          if (removeBtn) removeBtn.hidden = false;
        }
      }
      const statFecha  = document.getElementById(`stat-fecha-${id}`);
      const statNombre = document.getElementById(`stat-nombre-${id}`);
      if (statFecha && ev.fecha) statFecha.textContent = ev.fecha;
      if (statNombre && ev.nombre) statNombre.textContent = ev.nombre;

      // Guardar entradas del evento en memoria
      // Usar ev.entradas si existe, sino para evento1 usar cfg.entradas como fallback
      let entradasEv = ev.entradas || null;
      if (!entradasEv && id === 'evento1' && cfg.entradas) entradasEv = cfg.entradas;
      if (entradasEv) {
        // Asegurar que gratis esté presente
        if (!Object.values(entradasEv).some(e => e.tipo === 'gratis')) {
          entradasEv = {
            gratis: { nombre: 'Exclusivo solo para ellas', precio: 0, limite: 100, activa: false, proximamente: false, tipo: 'gratis' },
            ...entradasEv,
          };
        }
        entradasPorEvento[id] = entradasEv;
      }
    });

    // Mostrar entradas del evento actualmente seleccionado
    _cargarEntradasEnPanel(entradasPorEvento[diaActual] || {});
    _actualizarTituloEntradas();

  } catch { /* fail silently */ }
}

// ── RECUPERAR PAGO PENDIENTE ──
function abrirModalPendiente() {
  document.getElementById('form-pendiente').reset();
  document.getElementById('modal-pendiente').classList.add('show');
  document.addEventListener('keydown', _cerrarPendienteEsc);
  document.getElementById('pendiente-compra-id').focus();
}
function cerrarModalPendiente() {
  document.getElementById('modal-pendiente').classList.remove('show');
  document.removeEventListener('keydown', _cerrarPendienteEsc);
}
function _cerrarPendienteEsc(e) { if (e.key === 'Escape') cerrarModalPendiente(); }

async function enviarRecuperarPendiente(event) {
  event.preventDefault();
  const adminKey  = getKey();
  const compra_id = document.getElementById('pendiente-compra-id').value.trim();
  const email     = document.getElementById('pendiente-email').value.trim();
  const btn       = document.querySelector('#form-pendiente button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Emitiendo…';
  try {
    const body = { compra_id };
    if (email) body.email = email;
    const res  = await fetch(`${API_BASE}/recuperar-pendiente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    cerrarModalPendiente();
    if (res.ok) {
      mostrarToast(`Ticket emitido y enviado correctamente`);
      actualizarResumenTickets();
    } else {
      mostrarToast(data.error || 'Error al recuperar pago', 'error');
    }
  } catch {
    cerrarModalPendiente();
    mostrarToast('Sin conexión', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Emitir ticket';
  }
  return false;
}

// ── GENERAR TICKET MANUAL ──
let _entradasManual = {};

function abrirModalEmitirManual() {
  document.getElementById('form-emitir-manual').reset();
  const sel = document.getElementById('manual-entrada-select');
  sel.innerHTML = '<option value="">— Elige una entrada —</option>';
  _entradasManual = {};
  // Usar entradas del evento actualmente seleccionado
  const entradas = _leerEntradasDelPanel();
  Object.entries(entradas).forEach(([key, val]) => {
    _entradasManual[key] = { nombre: val.nombre, precio: val.precio };
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = val.nombre || key;
    sel.appendChild(opt);
  });
  document.getElementById('modal-emitir-manual').classList.add('show');
  document.addEventListener('keydown', _cerrarManualEsc);
  document.getElementById('manual-nombre').focus();
}
function cerrarModalEmitirManual() {
  document.getElementById('modal-emitir-manual').classList.remove('show');
  document.removeEventListener('keydown', _cerrarManualEsc);
}
function _cerrarManualEsc(e) { if (e.key === 'Escape') cerrarModalEmitirManual(); }

function actualizarManualEntrada() {
  const key    = document.getElementById('manual-entrada-select').value;
  const info   = _entradasManual[key];
  if (info) document.getElementById('manual-precio').value = info.precio;
}

async function enviarEmitirManual(event) {
  event.preventDefault();
  const adminKey = getKey();
  const key      = document.getElementById('manual-entrada-select').value;
  if (!key) { mostrarToast('Elige un tipo de entrada', 'error'); return false; }
  const info     = _entradasManual[key] || {};
  // Usar nombre del evento actualmente seleccionado
  const eventoNombre = document.getElementById(`ev-nombre-${diaActual}`)?.value?.trim()
    || (['evento1','evento2','evento3','evento4','evento5']
        .map(id => document.getElementById(`ev-nombre-${id}`)?.value?.trim())
        .find(Boolean))
    || 'Blue Wine';
  const comprador = {
    nombre:   document.getElementById('manual-nombre').value.trim(),
    apellido: document.getElementById('manual-apellido').value.trim(),
    email:    document.getElementById('manual-email').value.trim(),
    telefono: document.getElementById('manual-telefono').value.trim(),
    rut:      document.getElementById('manual-rut').value.trim(),
  };
  const precio = parseInt(document.getElementById('manual-precio').value || '0', 10);
  const btn    = document.querySelector('#form-emitir-manual button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    const res  = await fetch(`${API_BASE}/emitir-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({
        comprador,
        evento: `${eventoNombre} — ${info.nombre || key}`,
        precio,
      }),
    });
    const data = await res.json();
    cerrarModalEmitirManual();
    if (res.ok) {
      mostrarToast(`Ticket generado y enviado a ${comprador.email}`);
      actualizarResumenTickets();
    } else {
      mostrarToast(data.error || 'Error al generar ticket', 'error');
    }
  } catch {
    cerrarModalEmitirManual();
    mostrarToast('Sin conexión', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generar y enviar ticket';
  }
  return false;
}

// ── INIT ──
function onPanelListo() {
  cargarTickets();
  if (typeof initHuellaBtn === 'function') initHuellaBtn();
  cargarConfigPanel();
  _actualizarTituloEntradas();
}
