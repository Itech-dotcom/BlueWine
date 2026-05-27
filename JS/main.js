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
  preventa1:    { nombre: 'Preventa 1',            precio: 8000,   limite: 700, disponibles: 700, activa: true },
  preventa2:    { nombre: 'Preventa 2',            precio: 13000,  limite: 700, disponibles: 700, activa: false, proximamente: true },
  soloMujeres:  { nombre: 'Solo Mujeres 2x',       precio: 12000,  limite: 700, disponibles: 700, activa: true, personas: 2 },
  mesaDiamond:  { nombre: 'Mesa Diamond (4 pers.)',precio: 150000, limite: 13,  disponibles: 13,  activa: true, personas: 4 },
  meetAndGreet: { nombre: 'Meet & Greet',           precio: 50000,  limite: 10,  disponibles: 10,  activa: true },
  preventaVip:  { nombre: 'Preventa VIP',          precio: 15000,  limite: 150, disponibles: 150, activa: true },
  vip:          { nombre: 'VIP',                   precio: 20000,  limite: 150, disponibles: 150, activa: false, proximamente: true },
  prevDiamond:  { nombre: 'Diamond',               precio: 20000,  limite: 50,  disponibles: 50,  activa: false, proximamente: true },
  puertaDiamond:{ nombre: 'Puerta Diamond',        precio: 30000,  limite: 50,  disponibles: 50,  activa: false, proximamente: true },
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN EVENTOS RECURRENTES — EDITAR AQUÍ
// esGratis: true  → muestra badge "Entrada liberada hasta las hh:mm"
// horaCorte: hora límite de entrada liberada (solo se muestra si esGratis: true)
// ══════════════════════════════════════════════════════
const CONFIG_VIERNES = {
  esGratis:  false,       // ← cambiar a true para mostrar entrada liberada
  horaCorte: '23:00',     // ← hora límite entrada liberada
};

const CONFIG_SABADO = {
  esGratis:  false,       // ← cambiar a true para mostrar entrada liberada
  horaCorte: '23:00',     // ← hora límite entrada liberada
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN ANUNCIO EMERGENTE 
// activo: true → muestra el popup al cargar la página
// esGratis: true → muestra "Entrada Liberada" en el popup
// Usa el evento principal (hero) como referencia por defecto
// ══════════════════════════════════════════════════════
const CONFIG_ANUNCIO = {
  activo:   true,                              // ← false para desactivar el popup
  titulo:   'Loyaltty — Stage Principal',      // ← nombre del evento
  fecha:    'Sábado 6 de Junio',               // ← fecha visible
  desc:     'Una noche que no querrás perderte. Entradas limitadas.',
  esGratis: false,                             // ← true si es entrada liberada
  precio:   null,                              // ← ej: 8000 si quieres mostrar precio (null = no mostrar)
  imagen:   'Imagenes/EventoLoyaltty.jpeg',    // ← ruta de la imagen (null = sin imagen)
};

// ── Nombre del evento principal — se antepone al tipo de entrada en el ticket
// Ej: "Loyaltty — Preventa 1"
// ← EDITAR AQUÍ cuando cambie el evento
const NOMBRE_EVENTO_PRINCIPAL = 'Loyaltty';

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN IVA Y COMISIÓN
// ══════════════════════════════════════════════════════
const IVA = 0;             // sin IVA
const COMISION_MP = 0.1; // 10% MercadoPago

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
function actualizarStockDiamond() {
  fetch('https://bluewine-production.up.railway.app/stock')
    .then(r => r.json())
    .then(stock => {
      // Actualiza los disponibles solo si el backend retornó un número válido
      if (typeof stock.prevDiamond   === 'number') ENTRADAS.prevDiamond.disponibles   = stock.prevDiamond;
      if (typeof stock.puertaDiamond === 'number') ENTRADAS.puertaDiamond.disponibles = stock.puertaDiamond;
      if (typeof stock.mesaDiamond   === 'number') ENTRADAS.mesaDiamond.disponibles   = stock.mesaDiamond;
      renderizarTiposEntrada(); // vuelve a dibujar las cards con los cupos actualizados
    })
    .catch(() => {}); // si falla el backend, no se muestra error — se usan valores locales
}

// Abre el modal de entradas. Primero muestra las cards con datos locales (instantáneo)
// y luego actualiza los cupos reales del backend en segundo plano.
function abrirModal() {
  try { renderizarTiposEntrada(); } catch(err) { console.error('renderizarTiposEntrada:', err); }
  actualizarStockDiamond();
  document.getElementById('modal-principal').classList.add('active');
  document.body.style.overflow = 'hidden'; // bloquea el scroll del fondo mientras el modal está abierto
}

// Dibuja las cards de tipos de entrada en el modal.
// Para agregar o quitar un tipo de entrada del modal, editar el objeto "grupos" abajo.
// Para cambiar precios, límites o activar/desactivar entradas, editar el objeto ENTRADAS arriba.
function renderizarTiposEntrada() {
  const grupos = {
    // Cada grupo es una sección con título. El array son los IDs de ENTRADAS que aparecen.
    '🎟️ General': ['preventa1', 'preventa2', 'soloMujeres'],
    '💎 Mesa Diamond': ['mesaDiamond', 'meetAndGreet'],
    '⭐ VIP':      ['preventaVip', 'vip'],
  };

  const container = document.getElementById('modal-tipos-container');
  container.innerHTML = '';

  for (const [titulo, ids] of Object.entries(grupos)) {
    const grupo = document.createElement('div');
    grupo.className = 'modal-tipo-grupo';
    grupo.innerHTML = `<div class="modal-tipo-grupo-titulo">${titulo}</div>`;
    const opciones = document.createElement('div');
    opciones.className = 'modal-tipo-opciones';

    ids.forEach(id => {
      const e = ENTRADAS[id];
      const card = document.createElement('div');
      const esVip          = ['mesaDiamond','meetAndGreet','preventaVip','vip'].includes(id); // aplica estilo dorado/vip
      const esDiamond      = false; // reservado para uso futuro
      const esProximamente = e.proximamente === true;       // card apagada con badge "Próximamente"
      const esAgotado      = !e.activa && !esProximamente;  // card apagada con badge "Agotado"
      const esDisponible   = e.activa && e.disponibles > 0 && id !== 'soloMujeres'; // badge verde "Disponible"
      const ultimasEntradas = e.activa && e.disponibles > 0 && e.disponibles <= 5;  // aviso ⚡ últimas 5

      card.className = `modal-tipo-card${esVip ? ' vip' : ''}${esDiamond ? ' diamond' : ''}${esAgotado || esProximamente ? ' agotado' : ''}`;
      card.dataset.id = id;

      if (e.activa && e.disponibles > 0) {
        card.onclick = () => agregarAlCarritoEntradas(id);
      }

      card.innerHTML = `
        ${id === 'soloMujeres' ? '<div class="modal-tipo-badge badge-disponible">Promo Disponible</div>' : ''}
        ${id === 'meetAndGreet' ? '<div class="modal-tipo-badge exclusive-badge">✦ Exclusivo</div>' : ''}
        ${esDisponible && id !== 'meetAndGreet' ? '<div class="modal-tipo-badge badge-disponible">Disponible</div>' : ''}
        ${esProximamente ? '<div class="modal-tipo-badge prox-badge">Próximamente</div>' : ''}
        ${esAgotado      ? '<div class="modal-tipo-badge agotado-badge">Agotado</div>' : ''}
        <div class="modal-tipo-nombre">${e.nombre}</div>
        ${id === 'mesaDiamond' ? '<div class="modal-tipo-sub">Frente al escenario</div>' : ''}
        ${id === 'meetAndGreet' ? '<div class="modal-tipo-sub">Entrada VIP + Conocer al artista + foto</div>' : ''}
        <div class="modal-tipo-precio">${e.precioLabel || formatPrecio(e.precio)}</div>
        ${(id === 'mesaDiamond' || id === 'meetAndGreet') && e.activa && e.disponibles > 0 ? '<div style="display:flex;align-items:center;gap:5px;margin-top:5px;"><span style="width:7px;height:7px;border-radius:50%;background:' + colorCupos(e.disponibles, e.limite) + ';flex-shrink:0;box-shadow:0 0 5px ' + colorCupos(e.disponibles, e.limite) + '88;"></span><span style="font-size:0.72rem;color:' + colorCupos(e.disponibles, e.limite) + ';font-weight:500;letter-spacing:0.02em;">Cupos limitados: ' + e.disponibles + '</span></div>' : ''}
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
  const configKey  = nombre.toLowerCase().includes('viernes') ? 'viernes' : 'sabado';
  const config     = configKey === 'viernes' ? CONFIG_VIERNES : CONFIG_SABADO;
  const esGratis   = config.esGratis;

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
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function cambiarCantidadGeneral(delta) {
  const modal    = document.getElementById('modal-general');
  const precio   = parseInt(modal.dataset.precio);
  const esGratis = modal.dataset.esGratis === 'true';
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
      <div class="desglose-row"><span>Comisión ticketera (10%)</span><span>${formatPrecio(d.comTotal)}</span></div>
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
  const tc       = document.getElementById('co-tc').checked;

  const errorEl = document.getElementById('checkout-error');
  const campos  = ['co-nombre','co-apellido','co-rut','co-email','co-telefono'];
  campos.forEach(id => document.getElementById(id).classList.remove('input-error'));
  errorEl.style.display = 'none';

  if (!nombre)   { marcarError('co-nombre',   '⚠️ Ingresa tu nombre.',    errorEl); return; }
  if (!apellido) { marcarError('co-apellido', '⚠️ Ingresa tu apellido.',  errorEl); return; }
  if (!rut)      { marcarError('co-rut',      '⚠️ Ingresa tu RUT.',       errorEl); return; }
  if (!validarRUT(rut)) { marcarError('co-rut', '⚠️ El RUT ingresado no es válido. Verifica el dígito verificador.', errorEl); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { marcarError('co-email', '⚠️ Ingresa un correo electrónico válido.', errorEl); return; }
  if (!telefono) { marcarError('co-telefono', '⚠️ Ingresa tu número de teléfono.', errorEl); return; }
  if (!tc) {
    errorEl.textContent = '📋 Debes leer y aceptar los Términos y Condiciones antes de continuar.';
    errorEl.style.display = 'block';
    return;
  }

  const comprador = { nombre, apellido, rut, email, telefono };

  // ── Recoger y validar acompañantes ──
  const totalTickets = carritoEntradas.reduce((s, i) => s + i.cantidad * (ENTRADAS[i.id]?.personas || 1), 0);
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
      body: JSON.stringify({ comprador, nombreEvento, cantidad })
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
        errorEl.textContent = '⚠️ Error al generar la entrada. Intenta nuevamente.';
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
    return { id: i.id, nombre: `${NOMBRE_EVENTO_PRINCIPAL} — ${i.nombreMP}`, cantidad: i.cantidad, precioFinal: d.totalUnit };
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

  actualizarBadgeCarrito();
  renderBadgesGratis();
  mostrarAnuncioEvento();
});