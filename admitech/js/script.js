// ── TABS ──
function switchTab(name, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  (el || document.querySelector(`.tab[onclick*="'${name}'"]`))?.classList.add('active');
  document.getElementById('day-bar').style.display = (name === 'tickets') ? 'none' : 'flex';
}

// ── DÍAS ──
let diaActual = 'viernes';

function switchDay(dia) {
  diaActual = dia;
  document.querySelectorAll('.day-pill').forEach(p => p.classList.toggle('active', p.dataset.day === dia));
  document.querySelectorAll('.day-content').forEach(c => c.classList.toggle('active', c.dataset.day === dia));
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
    // Verificar entradas desactivadas
    const inactivas = [];
    document.querySelectorAll('#entradas-list .entrada-row:not(.entrada-row-header)').forEach(row => {
      const activaEl  = row.querySelector('.entrada-activa-toggle');
      const nombreEl  = row.querySelector('.entrada-nombre-input');
      const keyEl     = row.querySelector('.entrada-key');
      if (activaEl && !activaEl.checked) inactivas.push(nombreEl?.value?.trim() || keyEl?.textContent?.trim() || '—');
    });
    if (inactivas.length) {
      const ok = confirm(
        `Las siguientes entradas están desactivadas y no se mostrarán:\n\n• ${inactivas.join('\n• ')}\n\n¿Publicar igual? (puedes ir al tab Entradas para activarlas primero)`
      );
      if (!ok) { switchTab('entradas'); return; }
    }
  }
  await guardar();
}

async function guardar() {
  const adminKey = getKey();
  if (!adminKey) { mostrarToast('No autenticado', 'error'); return; }

  // Leer toggles del tab evento (viernes activo)
  const eventoActivo    = document.getElementById('toggle-evento-activo-viernes')?.checked    ?? false;
  const entradasGratis  = document.getElementById('toggle-entradas-gratis-viernes')?.checked  ?? false;
  const carrito         = document.getElementById('toggle-carrito-viernes')?.checked           ?? false;
  const anuncio         = document.getElementById('toggle-anuncio-viernes')?.checked           ?? false;

  // Leer entradas del tab entradas
  const entradas = {};
  document.querySelectorAll('#entradas-list .entrada-row:not(.entrada-row-header)').forEach(row => {
    const keyEl    = row.querySelector('.entrada-key');
    const precioEl = row.querySelector('.entrada-precio-input');
    const limiteEl = row.querySelector('.entrada-limite-input');
    const activaEl = row.querySelector('.entrada-activa-toggle');
    const nombreEl = row.querySelector('.entrada-nombre-input');
    const tipoEl   = row.querySelector('.entrada-tipo-select');
    if (!keyEl) return;
    const key = keyEl.textContent.trim();
    if (!key) return;
    entradas[key] = {
      nombre: nombreEl?.value?.trim() || key,
      precio: parseInt(precioEl?.value || '0', 10),
      limite: parseInt(limiteEl?.value || '0', 10),
      activa: activaEl?.checked ?? false,
      tipo:   tipoEl?.value || 'general',
    };
  });

  const config = {
    eventoActivo, entradasGratis, carrito, anuncio, entradas,
    eventoViernes: {
      nombre: document.getElementById('ev-nombre-viernes')?.value?.trim() || '',
      fecha:  document.getElementById('ev-fecha-viernes')?.value?.trim()  || '',
      imagen: document.getElementById('ev-imagen-viernes')?.value?.trim() || '',
      lineup: document.getElementById('ev-lineup-viernes')?.value?.trim() || '',
    },
    eventoSabado: {
      activo:  document.getElementById('toggle-evento-activo-sabado')?.checked ?? false,
      carrito: document.getElementById('toggle-carrito-sabado')?.checked       ?? false,
      nombre:  document.getElementById('ev-nombre-sabado')?.value?.trim()      || '',
      fecha:   document.getElementById('ev-fecha-sabado')?.value?.trim()       || '',
      imagen:  document.getElementById('ev-imagen-sabado')?.value?.trim()      || '',
      lineup:  document.getElementById('ev-lineup-sabado')?.value?.trim()      || '',
    },
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
function handleImagenSeleccionada(event, dia) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('ev-imagen-preview-img-' + dia).src = url;
  document.getElementById('ev-imagen-wrap-' + dia).classList.add('has-image');
  document.getElementById('ev-imagen-' + dia).value = file.name;
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
    // Auto-activar carrito al activar el evento
    const carritoToggle = document.getElementById('toggle-carrito-' + dia);
    if (carritoToggle && !carritoToggle.checked) carritoToggle.checked = true;
  }
  const badge = document.getElementById('estado-evento-badge-' + dia);
  badge.textContent = checkbox.checked ? 'Activo' : 'Inactivo';
  badge.classList.toggle('badge-green', checkbox.checked);
  badge.classList.toggle('badge-muted', !checkbox.checked);
  actualizarDayDot(dia, checkbox.checked);
}

function onToggleEntradasGratis(checkbox, dia) {
  const sub = document.getElementById('estado-evento-sub-' + dia);
  if (sub) sub.textContent = checkbox.checked ? 'Entradas gratis habilitadas' : '';
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

    actualizarFiltroTicketsPorTipo();
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
  // "Pre Aniversario Blue Wine — General" → "General"
  const partes = String(evento || '').split(' — ');
  return partes.length > 1 ? partes.slice(1).join(' — ') : (evento || '—');
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
  const q    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const tipo = document.getElementById('tickets-filtro-tipo')?.value || '';
  ticketsFiltrados = todosTickets.filter(t => {
    const nombre = `${t.nombre || ''} ${t.apellido || ''}`.toLowerCase();
    const tipo_t = tipoLabel(t.evento);
    return (!tipo || tipo_t === tipo) &&
      (!q || nombre.includes(q) ||
        (t.rut || '').toLowerCase().includes(q) ||
        (t.codigo || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q));
  });
  paginaActual = 1;
  renderPagina();
  actualizarResumenTickets();
}

function actualizarFiltroTicketsPorTipo() {
  const select = document.getElementById('tickets-filtro-tipo');
  const valorActual = select.value;
  const tipos = [...new Set(todosTickets.map(t => tipoLabel(t.evento)).filter(Boolean))];
  select.innerHTML = '<option value="">Todos los tipos</option>' +
    tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (tipos.includes(valorActual)) select.value = valorActual;
}

function actualizarResumenTickets() {
  const conteos = {};
  ticketsFiltrados.forEach(t => {
    const tipo = tipoLabel(t.evento) || 'Sin tipo';
    conteos[tipo] = (conteos[tipo] || 0) + 1;
  });
  const texto = Object.entries(conteos).map(([tipo, n]) => `${tipo}: ${n}`).join(' · ');
  const el = document.getElementById('tickets-resumen');
  if (el) el.textContent = texto || (todosTickets.length ? 'Sin resultados para el filtro' : 'Sin tickets registrados');
}

// ── EXPORTAR CSV ──
function exportarCSV() {
  if (!todosTickets.length) { mostrarToast('No hay tickets para exportar', 'error'); return; }

  const COLS = [
    ['codigo',        'Código'],
    ['nombre',        'Nombre'],
    ['apellido',      'Apellido'],
    ['rut',           'RUT'],
    ['email',         'Email'],
    ['telefono',      'Teléfono'],
    ['evento',        'Evento / Tipo'],
    ['acompanante_de','Acompañante de'],
    ['precio_unit',   'Precio'],
    ['fecha_compra',  'Fecha compra'],
    ['id_pago',       'ID pago MP'],
    ['estado',        'Estado'],
  ];

  const escapeCsv = v => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = COLS.map(([, label]) => escapeCsv(label)).join(',');
  const rows   = todosTickets.map(t =>
    COLS.map(([key]) => escapeCsv(t[key] ?? '')).join(',')
  );

  const bom     = '﻿';
  const content = bom + [header, ...rows].join('\n');
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `tickets-bluewine-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('CSV exportado');
}

// ── ENTRADAS: AGREGAR / ELIMINAR ──
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
    <div><select class="entrada-tipo-select"><option value="general" selected>General</option><option value="vip">VIP</option><option value="supervip">Super VIP</option></select></div>
    <div><input type="number" value="5000" min="0" class="entrada-input entrada-precio-input" /></div>
    <div><input type="number" value="100"  min="0" class="entrada-input entrada-limite-input" /></div>
    <div class="entrada-stock">0</div>
    <div><label class="toggle"><input type="checkbox" class="entrada-activa-toggle" checked /><span class="toggle-slider"></span></label></div>
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

    if ('eventoActivo' in cfg) {
      setToggle('toggle-evento-activo-viernes', cfg.eventoActivo);
      const badge = document.getElementById('estado-evento-badge-viernes');
      if (badge) {
        badge.textContent = cfg.eventoActivo ? 'Activo' : 'Inactivo';
        badge.className = 'badge ' + (cfg.eventoActivo ? 'badge-green' : 'badge-muted');
        badge.style.cssText = 'font-size:13px;padding:4px 12px;';
      }
      actualizarDayDot('viernes', cfg.eventoActivo);
    }
    if ('entradasGratis' in cfg) setToggle('toggle-entradas-gratis-viernes', cfg.entradasGratis);
    if ('carrito'        in cfg) setToggle('toggle-carrito-viernes',          cfg.carrito);
    if ('anuncio'        in cfg) setToggle('toggle-anuncio-viernes',           cfg.anuncio);

    if (cfg.entradas && typeof cfg.entradas === 'object') {
      document.querySelectorAll('#entradas-list .entrada-row:not(.entrada-row-header)').forEach(row => {
        const keyEl = row.querySelector('.entrada-key');
        if (!keyEl) return;
        const val = cfg.entradas[keyEl.textContent.trim()];
        if (!val) return;
        const nombreEl = row.querySelector('.entrada-nombre-input');
        const precioEl = row.querySelector('.entrada-precio-input');
        const limiteEl = row.querySelector('.entrada-limite-input');
        const activaEl = row.querySelector('.entrada-activa-toggle');
        const tipoEl   = row.querySelector('.entrada-tipo-select');
        if (nombreEl && val.nombre) nombreEl.value = val.nombre;
        if (precioEl && 'precio' in val) precioEl.value = val.precio;
        if (limiteEl && 'limite' in val) limiteEl.value = val.limite;
        if (activaEl && 'activa' in val) activaEl.checked = !!val.activa;
        if (tipoEl   && val.tipo)        tipoEl.value = val.tipo;
      });
    }

    // Datos del evento Viernes
    if (cfg.eventoViernes) {
      const ev = cfg.eventoViernes;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setVal('ev-nombre-viernes', ev.nombre);
      setVal('ev-lineup-viernes', ev.lineup);
      if (ev.fecha) { setVal('ev-fecha-viernes', ev.fecha); actualizarPreviewSlide('viernes'); }
      if (ev.imagen) {
        setVal('ev-imagen-viernes', ev.imagen);
        const preview = document.getElementById('ev-imagen-preview-img-viernes');
        if (preview) { preview.src = `../Imagenes/${ev.imagen}`; document.getElementById('ev-imagen-wrap-viernes')?.classList.add('has-image'); document.getElementById('ev-imagen-remove-viernes') && (document.getElementById('ev-imagen-remove-viernes').hidden = false); }
      }
      const sub = document.getElementById('stat-fecha-viernes');
      if (sub && ev.fecha) sub.textContent = ev.fecha;
      const nombre = document.getElementById('stat-nombre-viernes');
      if (nombre && ev.nombre) nombre.textContent = ev.nombre;
    }

    // Datos del evento Sábado
    if (cfg.eventoSabado) {
      const ev = cfg.eventoSabado;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
      setToggle('toggle-evento-activo-sabado', ev.activo);
      setToggle('toggle-carrito-sabado', ev.carrito);
      setVal('ev-nombre-sabado', ev.nombre);
      setVal('ev-lineup-sabado', ev.lineup);
      if (ev.fecha) { setVal('ev-fecha-sabado', ev.fecha); actualizarPreviewSlide('sabado'); }
      if (ev.imagen) {
        setVal('ev-imagen-sabado', ev.imagen);
        const preview = document.getElementById('ev-imagen-preview-img-sabado');
        if (preview) { preview.src = `../Imagenes/${ev.imagen}`; document.getElementById('ev-imagen-wrap-sabado')?.classList.add('has-image'); document.getElementById('ev-imagen-remove-sabado') && (document.getElementById('ev-imagen-remove-sabado').hidden = false); }
      }
      const badge = document.getElementById('estado-evento-badge-sabado');
      if (badge) { badge.textContent = ev.activo ? 'Activo' : 'Inactivo'; badge.className = 'badge ' + (ev.activo ? 'badge-green' : 'badge-muted'); badge.style.cssText = 'font-size:13px;padding:4px 12px;'; }
      actualizarDayDot('sabado', ev.activo);
      const sub = document.getElementById('stat-fecha-sabado');
      if (sub && ev.fecha) sub.textContent = ev.fecha;
      const nombre = document.getElementById('stat-nombre-sabado');
      if (nombre && ev.nombre) nombre.textContent = ev.nombre;
    }
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
  // Poblar select con entradas actuales del panel
  const sel = document.getElementById('manual-entrada-select');
  sel.innerHTML = '<option value="">— Elige una entrada —</option>';
  _entradasManual = {};
  document.querySelectorAll('#entradas-list .entrada-row:not(.entrada-row-header)').forEach(row => {
    const keyEl    = row.querySelector('.entrada-key');
    const nombreEl = row.querySelector('.entrada-nombre-input');
    const precioEl = row.querySelector('.entrada-precio-input');
    if (!keyEl) return;
    const key    = keyEl.textContent.trim();
    const nombre = nombreEl?.value?.trim() || key;
    const precio = parseInt(precioEl?.value || '0', 10);
    if (!key) return;
    _entradasManual[key] = { nombre, precio };
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = nombre;
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
  // Construir nombre de evento igual que el backend: "NOMBRE_EVENTO — Tipo"
  const eventoNombre = document.querySelector('#ev-nombre-viernes')?.value?.trim()
    || document.querySelector('#ev-nombre-sabado')?.value?.trim()
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
}
