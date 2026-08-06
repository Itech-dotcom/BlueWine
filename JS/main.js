/* 
    Programador: Isaac Fernández
    Blue Wine
*/

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN DE ENTRADAS — EDITAR AQUÍ
// Para marcar agotada: activa: false
// Para mostrar "últimas entradas": disponibles <= 5
// Para cambiar precio: editar el campo precio
// ══════════════════════════════════════════════════════
const ENTRADAS = {
  general:        { nombre: 'General',              precio: 5000,   limite: 100, disponibles: 100, activa: false,                    tipo: 'general' },
  vip:            { nombre: 'VIP',                  precio: 10000,  limite: 50,  disponibles: 50,  activa: false, proximamente: true, tipo: 'vip' },
  mesaGoldenVip:  { nombre: 'Mesa Golden VIP',      precio: 150000, limite: 4,   disponibles: 4,   activa: false,                    tipo: 'supervip', desc: 'Podrás compartir con DJs' },
  generalMujeres: { nombre: 'General Mujeres',      precio: 5000,   limite: 100, disponibles: 100, activa: false, proximamente: true, tipo: 'general' },
  generalHombres: { nombre: 'General Hombres',      precio: 7000,   limite: 100, disponibles: 100, activa: false, proximamente: true, tipo: 'general' },
  preventaVip:    { nombre: 'VIP',                  precio: 10000,  limite: 150, disponibles: 0,   activa: false,                    tipo: 'vip' },
  preventa1:      { nombre: 'General',              precio: 5000,   limite: 700, disponibles: 0,   activa: false,                    tipo: 'general' },
  preventa2:      { nombre: 'Preventa 2',           precio: 13000,  limite: 700, disponibles: 700, activa: false,                    tipo: 'general' },
  soloMujeres:    { nombre: 'Solo Mujeres 2x',      precio: 12000,  limite: 700, disponibles: 700, activa: false,                    tipo: 'general', personas: 2 },
  mesaDiamond:    { nombre: 'Mesa Diamond (4 pers.)',precio: 150000, limite: 13,  disponibles: 13,  activa: false,                    tipo: 'supervip', personas: 4 },
  meetAndGreet:   { nombre: 'Meet & Greet',         precio: 50000,  limite: 10,  disponibles: 10,  activa: false,                    tipo: 'supervip' },
  prevDiamond:    { nombre: 'Diamond',              precio: 20000,  limite: 50,  disponibles: 50,  activa: false,                    tipo: 'vip' },
  puertaDiamond:  { nombre: 'Puerta Diamond',       precio: 30000,  limite: 50,  disponibles: 50,  activa: false,                    tipo: 'vip' },
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN EVENTOS RECURRENTES — EDITAR AQUÍ
// esGratis: true  → muestra badge "Entrada liberada hasta las hh:mm"
// horaCorte: hora límite de entrada liberada (solo se muestra si esGratis: true)
// ══════════════════════════════════════════════════════
const CONFIG_VIERNES = {
  esGratis:  false,
  horaCorte: '23:59',
};

const CONFIG_SABADO = {
  esGratis:      true,   // ← entradas gratis activas: Aniversario
  gratisAgotada: false,  // ← true = muestra tarjeta pero bloqueada
  horaCorte:     '23:00',
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN ANUNCIO EMERGENTE 
// activo: true → muestra el popup al cargar la página
// esGratis: true → muestra "Entrada Liberada" en el popup
// Usa el evento principal (hero) como referencia por defecto
// ══════════════════════════════════════════════════════
const CONFIG_ANUNCIO = {
  activo:   false,
  titulo:   'Aniversario Blue Wine',
  fecha:    'Sábado 8 de agosto',
  desc:     '¡Entradas disponibles próximamente!',
  esGratis: false,
  precio:   0,
  imagen:   'Imagenes/aniversario.PNG',
};

// ── Nombre del evento principal — se antepone al tipo de entrada en el ticket
// Ej: "Aniversario Blue Wine — General Hombres"
// ← EDITAR AQUÍ cuando cambie el evento
let NOMBRE_EVENTO_PRINCIPAL = 'Aniversario Blue Wine';

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN IVA Y COMISIÓN


// ══════════════════════════════════════════════════════
const IVA = 0;             // sin IVA
const COMISION_MP = 0.15; // 15% MercadoPago

function calcularDesglose(precioNeto, cantidad) {
  const subtotal   = precioNeto * cantidad;
  const ivaUnit    = Math.round(precioNeto * IVA);
  const comUnit    = Math.round(precioNeto * COMISION_MP);
  const totalUnit  = precioNeto + ivaUnit + comUnit;
  return {
    subtotal,
    ivaTotal:   ivaUnit * cantidad,
    comTotal:   comUnit * cantidad,
    totalFinal: totalUnit * cantidad,
    ivaUnit,
    comUnit,
    totalUnit,
  };
}

// ══════════════════════════════════════════════════════
// CARRITOS
// ══════════════════════════════════════════════════════
let carritoEntradas = []; // { id, nombre, precio, cantidad }
let carritoComida   = []; // { nombre, precio, cantidad }

// ── Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Menú móvil
let scrollY = 0;
function toggleNav() {
  const navLinks = document.getElementById('navLinks');
  const isOpen = navLinks.classList.contains('open');
  if (!isOpen) {
    scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
  } else {
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  }
  navLinks.classList.toggle('open');
  document.body.classList.toggle('menu-open');
}
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  });
});

// ── Animaciones scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => observer.observe(el));

// ── Espacios touch
document.querySelectorAll('.espacio-card').forEach(card => {
  card.addEventListener('click', () => {
    const isActive = card.classList.contains('active');
    document.querySelectorAll('.espacio-card').forEach(c => c.classList.remove('active'));
    if (!isActive) card.classList.add('active');
  });
});

// ── Formulario reservas
const btnSubmit = document.querySelector('.btn-submit');
if (btnSubmit) btnSubmit.addEventListener('click', enviarReserva);

function enviarReserva() {
  const nombre   = document.getElementById('res-nombre').value.trim();
  const telefono = document.getElementById('res-telefono').value.trim();
  const email    = document.getElementById('res-email').value.trim();
  const tipo     = document.getElementById('res-tipo').value.trim();
  const fecha    = document.getElementById('res-fecha').value.trim();
  const personas = document.getElementById('res-personas').value.trim();
  const mensaje  = document.getElementById('res-mensaje').value.trim();
  const errorEl  = document.getElementById('res-error');

  errorEl.style.display = 'none';

  if (!nombre)   { errorEl.textContent = '⚠️ Ingresa tu nombre.';         errorEl.style.display = 'block'; return; }
  if (!telefono) { errorEl.textContent = '⚠️ Ingresa tu teléfono.';       errorEl.style.display = 'block'; return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = '⚠️ Ingresa un correo válido.';
    errorEl.style.display = 'block'; return;
  }
  if (!tipo)     { errorEl.textContent = '⚠️ Selecciona el tipo de reserva.'; errorEl.style.display = 'block'; return; }

  // Armar texto para WhatsApp
  const fechaTexto = fecha ? fecha : 'No especificada';
  const personasTexto = personas ? personas : 'No especificado';
  const mensajeTexto = mensaje ? mensaje : '—';

  const textoWA = encodeURIComponent(
    `🍷 *Nueva Solicitud de Reserva — Blue Wine*\n\n` +
    `👤 *Nombre:* ${nombre}\n` +
    `📱 *Teléfono:* ${telefono}\n` +
    `✉️ *Email:* ${email}\n` +
    `📋 *Tipo:* ${tipo}\n` +
    `📅 *Fecha:* ${fechaTexto}\n` +
    `👥 *Personas:* ${personasTexto}\n` +
    `💬 *Mensaje:* ${mensajeTexto}`
  );

  // Enviar email via backend
  fetch('https://bluewine-production.up.railway.app/reserva', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, telefono, email, tipo, fecha: fechaTexto, personas: personasTexto, mensaje: mensajeTexto })
  }).catch(err => console.log('Error enviando email reserva:', err));

  // Abrir WhatsApp
  window.open(`https://wa.me/56977003199?text=${textoWA}`, '_blank');

  // Limpiar formulario y mostrar toast
  document.getElementById('res-nombre').value   = '';
  document.getElementById('res-telefono').value = '';
  document.getElementById('res-email').value    = '';
  document.getElementById('res-tipo').value     = '';
  document.getElementById('res-fecha').value    = '';
  document.getElementById('res-personas').value = '';
  document.getElementById('res-mensaje').value  = '';

  mostrarToast('✓ Solicitud enviada. Te contactaremos pronto 🍷');
}

// ══════════════════════════════════════════════════════
// SLIDER EVENTOS
// ══════════════════════════════════════════════════════
let slideActual = 0;
function moverSlider(dir) {
  slideActual = (slideActual + dir + 2) % 2;
  actualizarSlider();
}
function irASlide(i) { slideActual = i; actualizarSlider(); }
function actualizarSlider() {
  const s = document.getElementById('eventosSlider');
  if (s) s.style.transform = `translateX(-${slideActual * 100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === slideActual));
}

// ══════════════════════════════════════════════════════
// MODAL EVENTO PRINCIPAL — renderizar con datos de ENTRADAS
// ══════════════════════════════════════════════════════
// Retorna el color del indicador de cupos según qué tan lleno está el límite.
// < 20% disponibles → rojo | 20-50% → amarillo | > 50% → verde
function colorCupos(disponibles, limite) {
  const pct = disponibles / limite;
  if (pct < 0.2)  return '#e53935'; // rojo  — menos del 20%
  if (pct <= 0.5) return '#f9a825'; // amarillo — 20-50%
  return '#43a047';                  // verde — más del 50%
}

// Consulta al backend cuántos cupos reales quedan (contando tickets ya vendidos en Sheets).
// Se llama sin bloquear — si falla, los valores por defecto del ENTRADAS se mantienen.
function actualizarStock() {
  fetch('https://bluewine-production.up.railway.app/stock')
    .then(r => r.json())
    .then(stock => {
      Object.entries(stock).forEach(([key, val]) => {
        if (ENTRADAS[key] && typeof val === 'number') ENTRADAS[key].disponibles = val;
      });
      renderizarTiposEntrada();
    })
    .catch(() => {});
}

// Abre el modal de entradas. Primero muestra las cards con datos locales (instantáneo)
// y luego actualiza los cupos reales del backend en segundo plano.
function abrirModal() {
  try { renderizarTiposEntrada(); } catch(err) { console.error('renderizarTiposEntrada:', err); }
  actualizarStock();
  document.getElementById('modal-principal').classList.add('active');
  document.body.style.overflow = 'hidden'; // bloquea el scroll del fondo mientras el modal está abierto
}

// Dibuja las cards de tipos de entrada en el modal, agrupadas por categoría.
// Las entradas y su categoría se configuran desde el panel de administración.
function renderizarTiposEntrada() {
  const TITULOS = { general: '🎟️ General', vip: '⭐ VIP', supervip: '👑 Super VIP' };

  // Si el config del servidor ya cargó, mostrar solo las entradas configuradas.
  // Si aún no cargó (acceso muy rápido), usar las tres por defecto como fallback.
  const keys = ENTRADAS._configKeys
    ? [...ENTRADAS._configKeys]
    : ['generalHombres', 'generalMujeres', 'vip'];

  const grupos = { general: [], vip: [], supervip: [] };
  for (const id of keys) {
    const e = ENTRADAS[id];
    if (!e) continue;
    const tipo = e.tipo || 'general';
    if (grupos[tipo]) grupos[tipo].push(id);
  }

  const container = document.getElementById('modal-tipos-container');
  container.innerHTML = '';

  // Tarjeta gratis al tope si hay entradas liberadas activas o agotadas
  const esGratisViernes = CONFIG_VIERNES.esGratis;
  const esGratisSabado  = CONFIG_SABADO.esGratis;
  const gratisAgotada   = CONFIG_SABADO.gratisAgotada || CONFIG_VIERNES.gratisAgotada;
  if (esGratisViernes || esGratisSabado || gratisAgotada) {
    const dia       = esGratisSabado ? 'sabado' : 'viernes';
    const nombreEsc = NOMBRE_EVENTO_PRINCIPAL.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const gratisGrupo = document.createElement('div');
    gratisGrupo.className = 'modal-tipo-grupo';
    if (gratisAgotada) {
      gratisGrupo.innerHTML = `
        <div class="modal-tipo-grupo-titulo">🎉 Entrada Liberada</div>
        <div class="modal-tipo-opciones">
          <div class="modal-tipo-card agotado" style="cursor:default;">
            <div class="modal-tipo-badge badge-agotado">Agotada</div>
            <div class="modal-tipo-nombre">Entrada Gratuita</div>
            <div class="modal-tipo-precio">GRATIS</div>
          </div>
        </div>`;
    } else {
      gratisGrupo.innerHTML = `
        <div class="modal-tipo-grupo-titulo">🎉 Entrada Liberada</div>
        <div class="modal-tipo-opciones">
          <div class="modal-tipo-card" style="cursor:pointer;" onclick="abrirCheckoutGratis('${nombreEsc}','${dia}')">
            <div class="modal-tipo-badge badge-disponible">Gratis</div>
            <div class="modal-tipo-nombre">Entrada Gratuita</div>
            <div class="modal-tipo-precio">GRATIS</div>
          </div>
        </div>`;
    }
    container.appendChild(gratisGrupo);
  }

  for (const tipo of ['general', 'vip', 'supervip']) {
    const ids = grupos[tipo];
    if (!ids.length) continue;

    const grupo = document.createElement('div');
    grupo.className = 'modal-tipo-grupo';
    grupo.innerHTML = `<div class="modal-tipo-grupo-titulo">${TITULOS[tipo]}</div>`;
    const opciones = document.createElement('div');
    opciones.className = 'modal-tipo-opciones';

    ids.forEach(id => {
      const e = ENTRADAS[id];
      if (!e) return;
      const card = document.createElement('div');
      const esVip          = tipo === 'vip' || tipo === 'supervip';
      const esProximamente = e.proximamente === true;
      const esAgotado      = (!e.activa || e.disponibles === 0) && !esProximamente;
      const esDisponible   = e.activa && e.disponibles > 0;
      const ultimasEntradas = e.activa && e.disponibles > 0 && e.disponibles <= 5;

      card.className = `modal-tipo-card${esVip ? ' vip' : ''}${esAgotado || esProximamente ? ' agotado' : ''}`;
      card.dataset.id = id;

      if (esDisponible) card.onclick = () => agregarAlCarritoEntradas(id);

      card.innerHTML = `
        ${esDisponible   ? '<div class="modal-tipo-badge badge-disponible">Disponible</div>' : ''}
        ${esProximamente ? '<div class="modal-tipo-badge prox-badge">Próximamente</div>' : ''}
        ${esAgotado      ? '<div class="modal-tipo-badge agotado-badge">Agotado</div>' : ''}
        <div class="modal-tipo-nombre">${e.nombre}</div>
        ${e.desc ? '<div class="modal-tipo-sub">' + e.desc + '</div>' : ''}
        <div class="modal-tipo-precio">${e.precioLabel || formatPrecio(e.precio)}</div>
        ${esDisponible && e.limite ? '<div style="display:flex;align-items:center;gap:5px;margin-top:5px;"><span style="width:7px;height:7px;border-radius:50%;background:' + colorCupos(e.disponibles, e.limite) + ';flex-shrink:0;box-shadow:0 0 5px ' + colorCupos(e.disponibles, e.limite) + '88;"></span><span style="font-size:0.72rem;color:' + colorCupos(e.disponibles, e.limite) + ';font-weight:500;letter-spacing:0.02em;">' + e.disponibles + ' cupos disponibles</span></div>' : ''}
        ${ultimasEntradas ? '<div class="modal-ultimas">⚡ Últimas entradas</div>' : ''}
      `;

      opciones.appendChild(card);
    });

    grupo.appendChild(opciones);
    container.appendChild(grupo);
  }
}

// ── Modal viernes/sábado (entrada general)
function abrirModalGeneral(nombre, precio) {
  const esGratis = precio === 0;

  const modal = document.getElementById('modal-general');
  document.getElementById('modal-general-nombre').textContent = nombre;
  modal.dataset.precio    = precio;
  modal.dataset.nombre    = nombre;
  modal.dataset.cantidad  = 1;
  modal.dataset.esGratis  = esGratis ? 'true' : 'false';

  const precioEl = document.getElementById('modal-general-precio');
  const totalEl  = document.getElementById('modal-general-total');
  const notaEl   = document.getElementById('modal-general-nota');
  const btnEl    = document.getElementById('modal-general-btn');

  if (esGratis) {
    precioEl.textContent = '🎉 Entrada Liberada';
    totalEl.textContent  = 'GRATIS';
    notaEl.textContent   = 'Completa tus datos y recibirás tu entrada con código QR por email.';
    btnEl.textContent    = 'Obtener entrada gratis →';
  } else {
    precioEl.textContent = formatPrecio(precio);
    totalEl.textContent  = formatPrecio(precio);
    notaEl.textContent   = 'Se agregará al carrito de entradas para proceder al pago con Mercado Pago.';
    btnEl.textContent    = 'Agregar al carrito →';
  }

  document.getElementById('modal-general-cantidad').textContent = 1;
  const cantWrap = document.querySelector('.modal-cantidad-wrap');
  if (cantWrap) cantWrap.style.display = esGratis ? 'none' : '';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function cambiarCantidadGeneral(delta) {
  const modal    = document.getElementById('modal-general');
  const precio   = parseInt(modal.dataset.precio);
  const esGratis = modal.dataset.esGratis === 'true';
  if (esGratis) return;
  let cant = parseInt(modal.dataset.cantidad) + delta;
  cant = Math.max(1, Math.min(20, cant));
  modal.dataset.cantidad = cant;
  document.getElementById('modal-general-cantidad').textContent = cant;
  document.getElementById('modal-general-total').textContent = esGratis
    ? 'GRATIS'
    : formatPrecio(precio * cant);
}

function agregarGeneralAlCarrito() {
  const modal    = document.getElementById('modal-general');
  const nombre   = modal.dataset.nombre;
  const precio   = parseInt(modal.dataset.precio);
  const cantidad = parseInt(modal.dataset.cantidad);
  const esGratis = modal.dataset.esGratis === 'true';

  if (esGratis) {
    // Guardar contexto y abrir checkout sin carrito
    _pendienteEntradaGratis = { nombre, cantidad };
    cerrarTodosModales();
    document.getElementById('checkout-btn-pagar').textContent  = 'Obtener entrada gratis →';
    document.getElementById('checkout-btn-pagar').dataset.modo = 'gratis';
    document.getElementById('modal-checkout').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('checkout-error').style.display = 'none';
  } else {
    agregarItemCarritoEntradas({ id: 'general_' + Date.now(), nombre, precio, cantidad });
    cerrarTodosModales();
    mostrarToast('✓ Agregado al carrito de entradas');
  }
}

// Contexto temporal para entrada gratis
let _pendienteEntradaGratis = null;

// Abre el formulario de checkout directamente en modo gratis (sin pasar por modal intermedio).
// Se usa cuando entradasGratis está activo y el usuario presiona el botón del slide o hero.
function abrirCheckoutGratis(nombre, dia) {
  _pendienteEntradaGratis = { nombre, cantidad: 1, dia: dia || 'viernes' };
  cerrarTodosModales();
  const btn = document.getElementById('checkout-btn-pagar');
  if (btn) { btn.textContent = 'Obtener entrada gratis →'; btn.dataset.modo = 'gratis'; }
  document.getElementById('modal-checkout').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('checkout-error').style.display = 'none';
}

// ══════════════════════════════════════════════════════
// BADGE ENTRADA LIBERADA — sección eventos
// ══════════════════════════════════════════════════════
function renderBadgesGratis() {
  const badgeV = document.getElementById('badge-gratis-viernes');
  const badgeS = document.getElementById('badge-gratis-sabado');
  if (badgeV) badgeV.style.display = CONFIG_VIERNES.esGratis ? 'block' : 'none';
  if (badgeS) badgeS.style.display = CONFIG_SABADO.esGratis  ? 'block' : 'none';
  if (badgeV) badgeV.textContent = `🎉 Entrada liberada hasta las ${CONFIG_VIERNES.horaCorte}`;
  if (badgeS) badgeS.textContent = `🎉 Entrada liberada hasta las ${CONFIG_SABADO.horaCorte}`;
}

// ══════════════════════════════════════════════════════
// MODAL ANUNCIO EMERGENTE
// ══════════════════════════════════════════════════════
function cerrarModalAnuncio() {
  document.getElementById('modal-anuncio').classList.remove('active');
  document.body.style.overflow = '';
  sessionStorage.setItem('anuncio_visto', '1');
}

function mostrarAnuncioEvento() {
  if (!CONFIG_ANUNCIO.activo) return;

  document.getElementById('anuncio-titulo').textContent = CONFIG_ANUNCIO.titulo;
  document.getElementById('anuncio-fecha').textContent  = CONFIG_ANUNCIO.fecha;
  document.getElementById('anuncio-desc').textContent   = CONFIG_ANUNCIO.desc;

  const imgEl = document.getElementById('anuncio-imagen');
  if (CONFIG_ANUNCIO.imagen) {
    imgEl.src          = CONFIG_ANUNCIO.imagen;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  const precioEl = document.getElementById('anuncio-precio');
  if (CONFIG_ANUNCIO.esGratis) {
    precioEl.textContent = '🎉 Entrada Liberada';
    precioEl.style.color = '#4caf50';
  } else if (CONFIG_ANUNCIO.precio) {
    precioEl.textContent = 'Desde ' + formatPrecio(CONFIG_ANUNCIO.precio);
    precioEl.style.color = '#c9a84c';
  } else {
    precioEl.textContent = '';
  }

  setTimeout(() => {
    document.getElementById('modal-anuncio').classList.add('active');
    document.body.style.overflow = 'hidden';
  }, 1500);
}

function cerrarTodosModales() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}
function cerrarModalOverlay(e) { if (e.target.classList.contains('modal-overlay')) cerrarTodosModales(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarTodosModales(); });

// ══════════════════════════════════════════════════════
// CARRITO ENTRADAS
// ══════════════════════════════════════════════════════
function agregarAlCarritoEntradas(id) {
  const e = ENTRADAS[id];
  if (!e.activa || e.disponibles === 0) return;

  const enCarrito = carritoEntradas.find(i => i.id === id);
  const cantActual = enCarrito ? enCarrito.cantidad : 0;

  if (cantActual >= e.disponibles) {
    mostrarToast(`⚠️ Solo quedan ${e.disponibles} entradas disponibles para "${e.nombre}"`, true);
    return;
  }

  if (enCarrito) {
    enCarrito.cantidad++;
  } else {
    carritoEntradas.push({ id, nombre: e.nombre, nombreMP: e.nombreMP || e.nombre, precio: e.precio, cantidad: 1 });
  }

  actualizarBadgeCarrito();
  mostrarToast(`✓ "${e.nombre}" agregado al carrito`);
  document.querySelector(`.modal-tipo-card[data-id="${id}"]`)?.classList.add('en-carrito');
}

function agregarItemCarritoEntradas(item) {
  const existente = carritoEntradas.find(i => i.id === item.id);
  if (existente) existente.cantidad += item.cantidad;
  else carritoEntradas.push(item);
  actualizarBadgeCarrito();
}

function actualizarBadgeCarrito() {
  const totalE = carritoEntradas.reduce((s, i) => s + i.cantidad, 0);
  const totalC = carritoComida.reduce((s, i) => s + i.cantidad, 0);
  const badgeE = document.getElementById('badge-carrito-entradas');
  const badgeC = document.getElementById('badge-carrito-comida');
  if (badgeE) { badgeE.textContent = totalE; badgeE.style.display = totalE > 0 ? 'flex' : 'none'; }
  if (badgeC) { badgeC.textContent = totalC; badgeC.style.display = totalC > 0 ? 'flex' : 'none'; }
}

function abrirCarritoEntradas() {
  renderizarCarritoEntradas();
  document.getElementById('carrito-entradas').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderizarCarritoEntradas() {
  const lista = document.getElementById('carrito-entradas-lista');
  const total = document.getElementById('carrito-entradas-total');
  if (!lista) return;

  if (carritoEntradas.length === 0) {
    lista.innerHTML = '<div class="carrito-vacio">🎟️ Tu carrito está vacío</div>';
    total.textContent = '$0';
    return;
  }

  lista.innerHTML = carritoEntradas.map(item => {
    const d = calcularDesglose(item.precio, item.cantidad);
    return `
    <div class="carrito-item">
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        <div class="carrito-item-precio">${formatPrecio(item.precio)} neto c/u</div>
      </div>
      <div class="carrito-item-controls">
        <button onclick="cambiarCantCarritoE('${item.id}', -1)">−</button>
        <span>${item.cantidad}</span>
        <button onclick="cambiarCantCarritoE('${item.id}', 1)">+</button>
      </div>
      <button class="carrito-item-remove" onclick="eliminarDeCarritoE('${item.id}')">✕</button>
    </div>
    <div class="carrito-item-desglose">
      <div class="desglose-row"><span>Subtotal neto</span><span>${formatPrecio(d.subtotal)}</span></div>
      <div class="desglose-row"><span>Comisión ticketera (15%)</span><span>${formatPrecio(d.comTotal)}</span></div>
      <div class="desglose-row desglose-total"><span>Total este ítem</span><span>${formatPrecio(d.totalFinal)}</span></div>
    </div>
  `}).join('');

  const totalFinal = carritoEntradas.reduce((s, i) => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return s + d.totalFinal;
  }, 0);
  total.textContent = formatPrecio(totalFinal);
}

function cambiarCantCarritoE(id, delta) {
  const item = carritoEntradas.find(i => i.id === id);
  if (!item) return;
  const entrada = ENTRADAS[id];
  const nuevaCant = item.cantidad + delta;
  if (nuevaCant <= 0) { eliminarDeCarritoE(id); return; }
  if (entrada && nuevaCant > entrada.disponibles) {
    mostrarToast(`⚠️ Solo quedan ${entrada.disponibles} entradas disponibles`, true);
    return;
  }
  item.cantidad = nuevaCant;
  actualizarBadgeCarrito();
  renderizarCarritoEntradas();
}

function eliminarDeCarritoE(id) {
  carritoEntradas = carritoEntradas.filter(i => i.id !== id);
  actualizarBadgeCarrito();
  renderizarCarritoEntradas();
}

// ══════════════════════════════════════════════════════
// CHECKOUT FORM — DATOS DEL COMPRADOR
// ══════════════════════════════════════════════════════

// Abre el formulario de datos. Si hay más de 1 entrada en el carrito,
// renderFormulariosAcompanantes genera automáticamente los formularios extra.
function abrirCheckoutForm() {
  if (carritoEntradas.length === 0) { mostrarToast('⚠️ Agrega entradas al carrito primero', true); return; }
  cerrarTodosModales();
  renderFormulariosAcompanantes(); // genera los formularios de acompañantes según cantidad del carrito
  document.getElementById('modal-checkout').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('checkout-error').style.display = 'none';
}

// Genera dinámicamente los formularios de acompañantes según cuántas entradas hay en el carrito.
// Si hay 3 entradas → muestra "Comprador principal" + "Acompañante 1" + "Acompañante 2".
// Si solo hay 1 entrada → muestra el formulario normal sin secciones adicionales.
function renderFormulariosAcompanantes() {
  const total     = carritoEntradas.reduce((s, i) => s + i.cantidad * (ENTRADAS[i.id]?.personas || 1), 0);
  const container = document.getElementById('acompanantes-container');
  const headerP   = document.getElementById('checkout-header-principal');
  const titulo    = document.getElementById('checkout-titulo');
  const nota      = document.getElementById('checkout-nota');
  container.innerHTML = '';

  if (total > 1) {
    headerP.style.display = 'flex';
    titulo.textContent    = 'Datos de los asistentes';
    nota.textContent      = 'Cada persona recibirá su propio ticket QR en su correo.';

    for (let i = 1; i < total; i++) {
      const sec = document.createElement('div');
      sec.className = 'acomp-seccion';
      sec.innerHTML = `
        <div class="acomp-header">
          <span class="acomp-num">Acompañante ${i}</span>
        </div>
        <div class="checkout-form-row">
          <div class="checkout-form-group">
            <label>Nombre <span class="campo-req">*</span></label>
            <input type="text" id="acomp-${i}-nombre" placeholder="Ej: María" autocomplete="off" />
          </div>
          <div class="checkout-form-group">
            <label>Apellido <span class="campo-req">*</span></label>
            <input type="text" id="acomp-${i}-apellido" placeholder="Ej: González" autocomplete="off" />
          </div>
        </div>
        <div class="checkout-form-group">
          <label>RUT <span class="campo-req">*</span></label>
          <input type="text" id="acomp-${i}-rut" placeholder="Ej: 12.345.678-9" maxlength="12" autocomplete="off" />
        </div>
        <div class="checkout-form-group">
          <label>Correo electrónico <span class="campo-req">*</span></label>
          <input type="email" id="acomp-${i}-email" placeholder="su@correo.cl" autocomplete="off" />
        </div>
        <div class="checkout-form-group">
          <label>Confirmar correo electrónico <span class="campo-req">*</span></label>
          <input type="email" id="acomp-${i}-email-confirm" placeholder="su@correo.cl" autocomplete="off" onpaste="return false;" />
        </div>
        <div class="checkout-form-group">
          <label>Teléfono / WhatsApp <span class="campo-req">*</span></label>
          <input type="tel" id="acomp-${i}-telefono" placeholder="+56 9 xxxx xxxx" autocomplete="off" />
        </div>
      `;
      container.appendChild(sec);

      const rutInput = document.getElementById(`acomp-${i}-rut`);
      if (rutInput) {
        rutInput.addEventListener('input', function() {
          const cursorPos  = this.selectionStart;
          const valorAntes = this.value;
          this.value       = formatearRUT(this.value);
          const diff       = this.value.length - valorAntes.length;
          this.setSelectionRange(cursorPos + diff, cursorPos + diff);
        });
      }
    }
  } else {
    headerP.style.display = 'none';
    titulo.textContent    = 'Datos del comprador';
    nota.textContent      = 'Tus datos son necesarios para emitir el ticket y enviarlo a tu correo.';
  }
}

function abrirTerminos() {
  document.getElementById('modal-terminos').classList.add('active');
}

function aceptarTerminosYVolver() {
  document.getElementById('co-tc').checked = true;
  document.getElementById('modal-terminos').classList.remove('active');
}

function abrirPrivacidad() {
  document.getElementById('modal-privacidad').classList.add('active');
}

function aceptarPrivacidadYVolver() {
  document.getElementById('co-privacidad').checked = true;
  document.getElementById('modal-privacidad').classList.remove('active');
}

function formatearRUT(valor) {
  // Limpia y formatea RUT chileno mientras el usuario escribe
  let v = valor.replace(/[^0-9kK]/g, '').toUpperCase();
  if (v.length < 2) return v;
  const dv = v.slice(-1);
  let cuerpo = v.slice(0, -1);
  cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return cuerpo + '-' + dv;
}

function validarRUT(rut) {
  const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 2) return false;
  const dv = cleanRut.slice(-1);
  const cuerpo = cleanRut.slice(0, -1);
  let suma = 0, multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const dvEsperado = 11 - (suma % 11);
  const dvReal = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);
  return dv === dvReal;
}

// Valida todos los formularios (comprador + acompañantes) y envía los datos al backend
// para crear la preferencia de pago en MercadoPago. Abre MP en una nueva pestaña.
function procederPagoEntradas() {
  const modalCheckout = document.getElementById('modal-checkout');
  const btnPagar      = document.getElementById('checkout-btn-pagar');
  const modoGratis    = btnPagar && btnPagar.dataset.modo === 'gratis';

  if (!modalCheckout.classList.contains('active')) {
    abrirCheckoutForm();
    return;
  }

  // Validar campos
  const nombre   = document.getElementById('co-nombre').value.trim();
  const apellido = document.getElementById('co-apellido').value.trim();
  const rut      = document.getElementById('co-rut').value.trim();
  const email    = document.getElementById('co-email').value.trim();
  const telefono = document.getElementById('co-telefono').value.trim();
  const tc         = document.getElementById('co-tc').checked;
  const privacidad = document.getElementById('co-privacidad').checked;

  const errorEl = document.getElementById('checkout-error');
  const campos  = ['co-nombre','co-apellido','co-rut','co-email','co-email-confirm','co-telefono'];
  campos.forEach(id => document.getElementById(id).classList.remove('input-error'));
  errorEl.style.display = 'none';

  if (!nombre)   { marcarError('co-nombre',   '⚠️ Ingresa tu nombre.',    errorEl); return; }
  if (!apellido) { marcarError('co-apellido', '⚠️ Ingresa tu apellido.',  errorEl); return; }
  if (!rut)      { marcarError('co-rut',      '⚠️ Ingresa tu RUT.',       errorEl); return; }
  if (!validarRUT(rut)) { marcarError('co-rut', '⚠️ El RUT ingresado no es válido. Verifica el dígito verificador.', errorEl); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { marcarError('co-email', '⚠️ Ingresa un correo electrónico válido.', errorEl); return; }
  const emailConfirm = document.getElementById('co-email-confirm').value.trim();
  if (email.toLowerCase() !== emailConfirm.toLowerCase()) { marcarError('co-email-confirm', '⚠️ Los correos no coinciden. Verifica que sean iguales.', errorEl); return; }
  if (!telefono) { marcarError('co-telefono', '⚠️ Ingresa tu número de teléfono.', errorEl); return; }
  if (!tc) {
    errorEl.textContent = '📋 Debes leer y aceptar los Términos y Condiciones antes de continuar.';
    errorEl.style.display = 'block';
    return;
  }
  if (!privacidad) {
    errorEl.textContent = '🔒 Debes aceptar la Política de Privacidad para continuar.';
    errorEl.style.display = 'block';
    return;
  }

  const comprador = { nombre, apellido, rut, email, telefono };

  // ── Recoger y validar acompañantes ──
  const totalTickets = carritoEntradas.reduce((s, i) => s + i.cantidad * (ENTRADAS[i.id]?.personas || 1), 0);
  const formulariosPresentes = document.querySelectorAll('#acompanantes-container .acomp-seccion').length;
  if (totalTickets > 1 && formulariosPresentes < totalTickets - 1) {
    errorEl.textContent = '⚠️ Tu sesión está desactualizada. Por favor recarga la página e intenta nuevamente.';
    errorEl.style.display = 'block';
    return;
  }
  const acompanantes = [];
  for (let i = 1; i < totalTickets; i++) {
    const aNombre   = document.getElementById(`acomp-${i}-nombre`)?.value.trim();
    const aApellido = document.getElementById(`acomp-${i}-apellido`)?.value.trim();
    const aRut      = document.getElementById(`acomp-${i}-rut`)?.value.trim();
    const aEmail    = document.getElementById(`acomp-${i}-email`)?.value.trim();
    const aTelefono = document.getElementById(`acomp-${i}-telefono`)?.value.trim();

    if (!aNombre)   { marcarError(`acomp-${i}-nombre`,   `⚠️ Ingresa el nombre del acompañante ${i}.`,   errorEl); return; }
    if (!aApellido) { marcarError(`acomp-${i}-apellido`, `⚠️ Ingresa el apellido del acompañante ${i}.`, errorEl); return; }
    if (!aRut)      { marcarError(`acomp-${i}-rut`,      `⚠️ Ingresa el RUT del acompañante ${i}.`,      errorEl); return; }
    if (!validarRUT(aRut)) { marcarError(`acomp-${i}-rut`, `⚠️ El RUT del acompañante ${i} no es válido.`, errorEl); return; }
    if (!aEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aEmail)) { marcarError(`acomp-${i}-email`, `⚠️ Ingresa un correo válido para el acompañante ${i}.`, errorEl); return; }
    const aEmailConfirm = document.getElementById(`acomp-${i}-email-confirm`)?.value.trim();
    if (aEmail.toLowerCase() !== (aEmailConfirm || '').toLowerCase()) { marcarError(`acomp-${i}-email-confirm`, `⚠️ Los correos del acompañante ${i} no coinciden.`, errorEl); return; }
    if (!aTelefono) { marcarError(`acomp-${i}-telefono`, `⚠️ Ingresa el teléfono del acompañante ${i}.`, errorEl); return; }

    acompanantes.push({ nombre: aNombre, apellido: aApellido, rut: aRut, email: aEmail, telefono: aTelefono });
  }

  // ── FLUJO GRATIS ──
  if (modoGratis && _pendienteEntradaGratis) {
    mostrarToast('⏳ Generando tu entrada...');
    const { nombre: nombreEvento, cantidad } = _pendienteEntradaGratis;

    fetch('https://bluewine-production.up.railway.app/obtener-entrada-gratis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comprador, nombreEvento, cantidad, dia: _pendienteEntradaGratis.dia || 'viernes' })
    })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        cerrarTodosModales();
        _pendienteEntradaGratis = null;
        btnPagar.textContent = 'Pagar con Mercado Pago →';
        delete btnPagar.dataset.modo;
        setTimeout(() => {
          document.getElementById('modal-pago-exitoso').classList.add('active');
          document.body.style.overflow = 'hidden';
        }, 300);
      } else {
        errorEl.textContent = '⚠️ ' + (data.error || 'Error al generar la entrada. Intenta nuevamente.');
        errorEl.style.display = 'block';
      }
    })
    .catch(() => {
      errorEl.textContent = '⚠️ Error de conexión con el servidor. Intenta nuevamente.';
      errorEl.style.display = 'block';
    });
    return;
  }

  // ── FLUJO PAGO NORMAL ──
  mostrarToast('⏳ Procesando pago...');

  const ventana = window.open('', '_blank'); // Abrir antes del fetch para evitar bloqueo en Safari/iOS

  const items = carritoEntradas.map(i => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return { id: i.id, nombre: `${NOMBRE_EVENTO_PRINCIPAL} — ${i.nombreMP}`, cantidad: i.cantidad, precioFinal: d.totalUnit, personas: ENTRADAS[i.id]?.personas || 1 };
  });

  fetch('https://bluewine-production.up.railway.app/crear-pago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, comprador, acompanantes })
  })
  .then(res => res.json())
  .then(data => {
    if (data.init_point) {
      ventana.location.href = data.init_point;
    } else {
      ventana.close();
      errorEl.textContent = '⚠️ Error al procesar el pago. Intenta nuevamente.';
      errorEl.style.display = 'block';
    }
  })
  .catch(() => {
    ventana.close();
    errorEl.textContent = '⚠️ Error de conexión con el servidor. Intenta nuevamente.';
    errorEl.style.display = 'block';
  });
}

function marcarError(campoId, mensaje, errorEl) {
  document.getElementById(campoId).classList.add('input-error');
  document.getElementById(campoId).focus();
  errorEl.textContent = mensaje;
  errorEl.style.display = 'block';
}

// ══════════════════════════════════════════════════════
// CARRITO COMIDA
// ══════════════════════════════════════════════════════
function agregarAlCarritoComida(nombre, precio) {
  const existente = carritoComida.find(i => i.nombre === nombre);
  if (existente) existente.cantidad++;
  else carritoComida.push({ nombre, precio, cantidad: 1 });
  actualizarBadgeCarrito();
  mostrarToast(`✓ "${nombre}" agregado al carrito`);
}

function abrirCarritoComida() {
  renderizarCarritoComida();
  document.getElementById('carrito-comida').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderizarCarritoComida() {
  const lista = document.getElementById('carrito-comida-lista');
  const total = document.getElementById('carrito-comida-total');
  if (!lista) return;

  if (carritoComida.length === 0) {
    lista.innerHTML = '<div class="carrito-vacio">🍕 Tu carrito está vacío</div>';
    total.textContent = '$0';
    return;
  }

  lista.innerHTML = carritoComida.map(item => {
    const d = calcularDesglose(item.precio, item.cantidad);
    return `
    <div class="carrito-item">
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        <div class="carrito-item-precio">${formatPrecio(item.precio)} neto c/u</div>
      </div>
      <div class="carrito-item-controls">
        <button onclick="cambiarCantCarritoC('${item.nombre}', -1)">−</button>
        <span>${item.cantidad}</span>
        <button onclick="cambiarCantCarritoC('${item.nombre}', 1)">+</button>
      </div>
      <button class="carrito-item-remove" onclick="eliminarDeCarritoC('${item.nombre}')">✕</button>
    </div>
    <div class="carrito-item-desglose">
      <div class="desglose-row"><span>Subtotal neto</span><span>${formatPrecio(d.subtotal)}</span></div>
      <div class="desglose-row desglose-total"><span>Total este ítem</span><span>${formatPrecio(d.totalFinal)}</span></div>
    </div>
  `}).join('');

  const totalFinal = carritoComida.reduce((s, i) => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return s + d.totalFinal;
  }, 0);
  total.textContent = formatPrecio(totalFinal);
}

function cambiarCantCarritoC(nombre, delta) {
  const item = carritoComida.find(i => i.nombre === nombre);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) eliminarDeCarritoC(nombre);
  else { actualizarBadgeCarrito(); renderizarCarritoComida(); }
}

function eliminarDeCarritoC(nombre) {
  carritoComida = carritoComida.filter(i => i.nombre !== nombre);
  actualizarBadgeCarrito();
  renderizarCarritoComida();
}

function procederPedidoComida() {
  if (carritoComida.length === 0) { mostrarToast('⚠️ Agrega productos al carrito primero', true); return; }
  const totalFinal = carritoComida.reduce((s, i) => s + calcularDesglose(i.precio, i.cantidad).totalFinal, 0);
  const msg = encodeURIComponent(`Hola! Quiero hacer el siguiente pedido:\n${carritoComida.map(i => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return `• ${i.cantidad}x ${i.nombre} - ${formatPrecio(d.totalFinal)} (comisión incluida)`;
  }).join('\n')}\n\nTOTAL A PAGAR: ${formatPrecio(totalFinal)}`);
  window.open(`https://wa.me/56987584731?text=${msg}`, '_blank');
}

// ══════════════════════════════════════════════════════
// FILTRO DELIVERY
// ══════════════════════════════════════════════════════
function filtrarMenu(categoria) {
  document.querySelectorAll('.delivery-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.menu-card').forEach(card => {
    card.classList.toggle('hidden', !card.dataset.categoria.includes(categoria));
  });
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function formatPrecio(v) { return '$' + v.toLocaleString('es-CL'); }

function mostrarToast(msg, esError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (esError ? ' toast-error' : '');
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3000);
}

// ══════════════════════════════════════════════════════
// GALERÍA — Slider dinámico con pestañas
// Agrupa .galeria-item en páginas de 4 (escritorio) / 2 (móvil)
// Para agregar fotos: añadir <div class="galeria-item"><img .../></div>
// dentro del .galeria-slider correspondiente. El JS reagrupa solo.
// ══════════════════════════════════════════════════════
function inicializarGaleriaSlider(sliderId) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  const items = Array.from(slider.querySelectorAll('.galeria-item'));
  if (items.length === 0) return;
  const porPagina = window.innerWidth <= 480 ? 2 : 4;
  const paginas = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));

  slider.innerHTML = '';
  slider.dataset.slide = '0';
  paginas.forEach(pag => {
    const grid = document.createElement('div');
    grid.className = 'galeria-slide';
    pag.forEach(item => grid.appendChild(item));
    slider.appendChild(grid);
  });

  const wrap = slider.closest('.galeria-slider-wrap');
  const dotsId = sliderId.replace('galeriaSlider-', 'galeriaDots-');
  const dotsWrap = document.getElementById(dotsId);

  if (paginas.length > 1) {
    if (wrap) wrap.querySelectorAll('.slider-arrow').forEach(a => a.style.removeProperty('display'));
    if (dotsWrap) {
      dotsWrap.style.display = 'flex';
      dotsWrap.innerHTML = paginas.map((_, i) =>
        `<span class="slider-dot${i === 0 ? ' active' : ''}" onclick="irAGaleriaSlide('${sliderId}',${i})"></span>`
      ).join('');
    }
  } else {
    if (wrap) wrap.querySelectorAll('.slider-arrow').forEach(a => a.style.display = 'none');
    if (dotsWrap) dotsWrap.style.display = 'none';
  }

  if (wrap) {
    let tx = 0;
    wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      const diff = tx - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) moverGaleriaSlider(sliderId, diff > 0 ? 1 : -1);
    });
  }

  // Ajustar altura del wrap al primer slide tras render
  requestAnimationFrame(() => {
    const firstSlide = slider.querySelector('.galeria-slide');
    const w = slider.closest('.galeria-slider-wrap');
    if (firstSlide && w) w.style.height = firstSlide.offsetHeight + 'px';
  });
}

function moverGaleriaSlider(sliderId, dir) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  const total = slider.querySelectorAll('.galeria-slide').length;
  const current = ((parseInt(slider.dataset.slide) || 0) + dir + total) % total;
  slider.dataset.slide = current;
  actualizarGaleriaSlider(sliderId);
}

function irAGaleriaSlide(sliderId, i) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  slider.dataset.slide = i;
  actualizarGaleriaSlider(sliderId);
}

function actualizarGaleriaSlider(sliderId) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  const current = parseInt(slider.dataset.slide) || 0;
  slider.style.transform = `translateX(-${current * 100}%)`;
  const dotsId = sliderId.replace('galeriaSlider-', 'galeriaDots-');
  const dotsWrap = document.getElementById(dotsId);
  if (dotsWrap) dotsWrap.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === current));
  const slides = slider.querySelectorAll('.galeria-slide');
  const wrap = slider.closest('.galeria-slider-wrap');
  if (wrap && slides[current]) wrap.style.height = slides[current].offsetHeight + 'px';
}

function mostrarGaleriaTab(tab, btn) {
  document.querySelectorAll('.galeria-subseccion').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.galeria-tab').forEach(t => t.classList.remove('active'));
  const sec = document.getElementById('galeria-' + tab);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ══════════════════════════════════════════════════════
// PAGO EXITOSO — Detectar redirección de MercadoPago
// ══════════════════════════════════════════════════════
function cerrarModalExitoso() {
  document.getElementById('modal-pago-exitoso').classList.remove('active');
  document.body.style.overflow = '';
  // Limpiar el parámetro de la URL sin recargar
  const url = new URL(window.location.href);
  url.searchParams.delete('pago');
  window.history.replaceState({}, '', url);
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Detectar redirección de MercadoPago
  const urlParams = new URLSearchParams(window.location.search);
  const estadoPago = urlParams.get('pago');
  if (estadoPago === 'exitoso') {
    setTimeout(() => {
      document.getElementById('modal-pago-exitoso').classList.add('active');
      document.body.style.overflow = 'hidden';
    }, 600);
  } else if (estadoPago === 'fallido') {
    setTimeout(() => mostrarToast('⚠️ El pago no se completó. Puedes intentarlo nuevamente.', true), 600);
  } else if (estadoPago === 'pendiente') {
    setTimeout(() => mostrarToast('⏳ Tu pago está pendiente de confirmación.'), 600);
  }
  // Mostrar pizzas por defecto
  document.querySelectorAll('.menu-card').forEach(card => {
    if (!card.dataset.categoria.includes('pizza')) card.classList.add('hidden');
  });

  // Formateo automático RUT
  const rutInput = document.getElementById('co-rut');
  if (rutInput) {
    rutInput.addEventListener('input', function() {
      const cursorPos = this.selectionStart;
      const valorAntes = this.value;
      this.value = formatearRUT(this.value);
      // Mantener cursor aproximadamente en su posición
      const diff = this.value.length - valorAntes.length;
      this.setSelectionRange(cursorPos + diff, cursorPos + diff);
    });
  }

  // Swipe slider
  let tx = 0;
  const sw = document.querySelector('.eventos-slider-wrap');
  if (sw) {
    sw.addEventListener('touchstart', e => { tx = e.touches[0].clientX; });
    sw.addEventListener('touchend', e => {
      const diff = tx - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) moverSlider(diff > 0 ? 1 : -1);
    });
  }

  // Galería — inicializar sliders (Opción 1: artistas/eventos/instalaciones | Opción 2: galeria | Opción 3: simple)
  ['artistas', 'eventos', 'instalaciones', 'galeria', 'eventos3', 'instalaciones3'].forEach(tab => inicializarGaleriaSlider('galeriaSlider-' + tab));

  actualizarBadgeCarrito();
  renderBadgesGratis();
  mostrarAnuncioEvento();
  cargarConfigRemota();
});

// ── CONFIG REMOTA — aplica ajustes guardados desde el panel sin redeployar
async function cargarConfigRemota() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('https://bluewine-production.up.railway.app/config', { signal: ctrl.signal });
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg.ok) return;

    const show = sel => document.querySelectorAll(sel).forEach(el => el.style.removeProperty('display'));
    const hide = sel => document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });

    // Visibilidad evento y carrito — evaluada de una vez para evitar flash viernes→sábado
    const sabadoActivo  = cfg.eventoSabado?.activo  && cfg.eventoSabado?.carrito;
    const heroVisible   = cfg.eventoActivo || sabadoActivo;
    const carritoVisible = cfg.carrito     || sabadoActivo;

    if ('eventoActivo' in cfg || cfg.eventoSabado) {
      if (heroVisible) show('.hero-evento-destacado');
      else hide('.hero-evento-destacado');
    }
    if ('carrito' in cfg || cfg.eventoSabado) {
      if (carritoVisible) { show('.nav-carrito-btn'); show('#modal-principal'); show('#carrito-entradas'); }
      else { hide('.nav-carrito-btn'); hide('#modal-principal'); hide('#carrito-entradas'); }
    }

    // Entradas gratis
    if ('entradasGratis' in cfg) {
      CONFIG_VIERNES.esGratis = cfg.entradasGratis;
      renderBadgesGratis();
    }

    // Anuncio emergente (viernes tiene su propio toggle; sábado hereda si su toggle está ON)
    const anuncioActivo = cfg.anuncio || cfg.eventoSabado?.anuncio;
    if ('anuncio' in cfg || cfg.eventoSabado) {
      CONFIG_ANUNCIO.activo = !!anuncioActivo;
      if (!anuncioActivo) hide('#modal-anuncio');
    }

    // Datos del evento en slides y hero (I2)
    const slides = document.querySelectorAll('.evento-slide');
    function _aplicarEvento(slide, ev, esGratis, dia) {
      if (!slide || !ev?.nombre) return;
      const tag   = slide.querySelector('.evento-tag');
      const title = slide.querySelector('.evento-title');
      const desc  = slide.querySelector('.evento-desc');
      const footer = slide.querySelector('.evento-footer');
      if (tag)   { tag.removeAttribute('style');   tag.textContent = '🎉 Evento'; }
      if (title) { title.removeAttribute('style'); title.textContent = ev.nombre; }
      if (desc && ev.lineup) desc.textContent = ev.lineup;
      if (footer) {
        const nombreEsc = ev.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const diaEsc    = (dia || 'viernes');
        const onclick = esGratis ? `abrirCheckoutGratis('${nombreEsc}','${diaEsc}')` : 'abrirModal()';
        const label   = esGratis ? 'Obtener entrada gratis' : 'Ver entradas disponibles';
        footer.innerHTML = `<button class="hero-evento-btn" onclick="${onclick}"><span class="hero-evento-dot"></span>${label}</button>`;
      }
    }
    function _aplicarFechaSlide(slide, dia, fecha) {
      if (!slide) return;
      const el = slide.querySelector('.evento-slide-nombre-dia');
      if (el && fecha) el.textContent = fecha;
    }

    if (cfg.eventoViernes) {
      if (cfg.eventoViernes.nombre) NOMBRE_EVENTO_PRINCIPAL = cfg.eventoViernes.nombre;
      _aplicarFechaSlide(slides[0], 'viernes', cfg.eventoViernes.fecha);
      if (cfg.eventoActivo) {
        _aplicarEvento(slides[0], cfg.eventoViernes, cfg.entradasGratis, 'viernes');
        const heroImg = document.querySelector('.hero-carrusel-slide');
        if (heroImg && cfg.eventoViernes.imagen) heroImg.src = 'Imagenes/' + cfg.eventoViernes.imagen;
        const heroFecha = document.querySelector('.hero-evento-fecha-txt');
        if (heroFecha && cfg.eventoViernes.fecha) heroFecha.textContent = cfg.eventoViernes.fecha;
        // Si gratis activo: el botón del hero también va directo al formulario
        if (cfg.entradasGratis) {
          const heroBtn = document.querySelector('.hero-evento-btn');
          if (heroBtn) {
            const nombreEsc = cfg.eventoViernes.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            heroBtn.setAttribute('onclick', `abrirCheckoutGratis('${nombreEsc}','viernes')`);
            heroBtn.innerHTML = '<span class="hero-evento-dot"></span>Obtener entrada gratis';
          }
        }
      }
    }

    if (cfg.eventoSabado) {
      _aplicarFechaSlide(slides[1], 'sabado', cfg.eventoSabado.fecha);
      if ('entradasGratis' in cfg.eventoSabado) {
        CONFIG_SABADO.esGratis = !!cfg.eventoSabado.entradasGratis;
        renderBadgesGratis();
      }
      if ('entradasGratisAgotada' in cfg.eventoSabado) {
        CONFIG_SABADO.gratisAgotada = !!cfg.eventoSabado.entradasGratisAgotada;
      }
      if (cfg.eventoSabado.activo) {
        _aplicarEvento(slides[1], cfg.eventoSabado, cfg.eventoSabado.entradasGratis, 'sabado');
        // Si solo sábado está activo: hero muestra imagen/fecha de sábado y avanza el slider
        if (!cfg.eventoActivo) {
          const heroImg = document.querySelector('.hero-carrusel-slide');
          if (heroImg && cfg.eventoSabado.imagen) heroImg.src = 'Imagenes/' + cfg.eventoSabado.imagen;
          const heroFecha = document.querySelector('.hero-evento-fecha-txt');
          if (heroFecha && cfg.eventoSabado.fecha) heroFecha.textContent = cfg.eventoSabado.fecha;
          irASlide(1);
        }
      }
    }

    // Precios y disponibilidad de entradas
    if (cfg.entradas && typeof cfg.entradas === 'object') {
      const configKeys = new Set(Object.keys(cfg.entradas));
      Object.entries(cfg.entradas).forEach(([key, val]) => {
        if (!ENTRADAS[key]) {
          // Tipo nuevo creado desde el panel — agregarlo al runtime
          ENTRADAS[key] = {
            nombre:       val.nombre || key,
            precio:       val.precio || 0,
            limite:       val.limite || 0,
            disponibles:  val.limite || 0,
            activa:       val.activa === true,
            proximamente: val.proximamente === true,
            tipo:         val.tipo || 'general',
          };
        } else {
          if ('nombre'       in val) ENTRADAS[key].nombre       = val.nombre;
          if ('activa'       in val) ENTRADAS[key].activa       = val.activa;
          if ('proximamente' in val) ENTRADAS[key].proximamente = val.proximamente;
          if ('precio'       in val) ENTRADAS[key].precio       = val.precio;
          if ('tipo'         in val) ENTRADAS[key].tipo         = val.tipo;
          if ('limite'       in val) { ENTRADAS[key].limite = val.limite; ENTRADAS[key].disponibles = val.limite; }
        }
      });
      ENTRADAS._configKeys = configKeys;
      if (typeof renderizarTiposEntrada === 'function') renderizarTiposEntrada();
    }
  } catch {
    // Sin conexión o timeout — usa valores hardcodeados
  }
}