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
  preventa1:   { nombre: 'Preventa 1',         precio: 8000,   limite: 700, disponibles: 700, activa: true },
  preventa2:   { nombre: 'Preventa 2',         precio: 13000,  limite: 700, disponibles: 700, activa: true },
  soloMujeres: { nombre: 'Solo Mujeres 2x',    precio: 12000,  limite: 700, disponibles: 700, activa: true },
  mesaVip:     { nombre: 'Mesa VIP (4 pers.)', precio: 150000, limite: 10,  disponibles: 10,  activa: true },
  preventaVip: { nombre: 'Preventa VIP',       precio: 15000,  limite: 150, disponibles: 150, activa: true },
  vip:         { nombre: 'VIP',                precio: 20000,  limite: 150, disponibles: 150, activa: true },
  prevDiamond: { nombre: 'Prev. Diamond',      precio: 20000,  limite: 100, disponibles: 100, activa: true },
  puertaDiamond:{ nombre: 'Puerta Diamond',    precio: 30000,  limite: 100, disponibles: 100, activa: true },
  prueba: { nombre: 'Entrada prueba', precio: 10, limite: 1, disponibles: 1, activa: true },
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN EVENTOS RECURRENTES — EDITAR AQUÍ
// esGratis: true  → muestra badge "Entrada liberada hasta las hh:mm"
// horaCorte: hora límite de entrada liberada (solo se muestra si esGratis: true)
// ══════════════════════════════════════════════════════
const CONFIG_VIERNES = {
  esGratis:  true,       // ← cambiar a true para mostrar entrada liberada
  horaCorte: '23:00',     // ← hora límite entrada liberada
};

const CONFIG_SABADO = {
  esGratis:  false,       // ← cambiar a true para mostrar entrada liberada
  horaCorte: '23:00',     // ← hora límite entrada liberada
};

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN ANUNCIO EMERGENTE — EDITAR AQUÍ
// activo: true → muestra el popup al cargar la página
// esGratis: true → muestra "Entrada Liberada" en el popup
// Usa el evento principal (hero) como referencia por defecto
// ══════════════════════════════════════════════════════
const CONFIG_ANUNCIO = {
  activo:   true,                           // ← false para desactivar el popup
  titulo:   'Tobal MJ — Stage Principal',   // ← nombre del evento
  fecha:    'Sábado 16 de Mayo',            // ← fecha visible
  desc:     'Una noche que no querrás perderte. Entradas limitadas.',
  esGratis: false,                          // ← true si es entrada liberada
  precio:   null,                           // ← ej: 8000 si quieres mostrar precio (null = no mostrar)
  imagen:   'Imagenes/evento-principal.jpg', // ← ruta de la imagen (null = sin imagen)
};

// ── Nombre del evento principal — se antepone al tipo de entrada en el ticket
// Ej: "Tobal MJ — Preventa 1"
// ← EDITAR AQUÍ cuando cambie el evento
const NOMBRE_EVENTO_PRINCIPAL = 'Tobal MJ';

// ══════════════════════════════════════════════════════
// CONFIGURACIÓN IVA Y COMISIÓN — EDITAR AQUÍ SI CAMBIA
// ══════════════════════════════════════════════════════
const IVA = 0.19;          // 19%
const COMISION_MP = 0.0399; // 3.99% MercadoPago

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
function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
  document.body.classList.toggle('menu-open');
}
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
    document.body.classList.remove('menu-open');
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
function abrirModal() {
  renderizarTiposEntrada();
  document.getElementById('modal-principal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderizarTiposEntrada() {
  const grupos = {
    '🎟️ General': ['preventa1', 'preventa2', 'soloMujeres'],
    '🥂 Mesa VIP': ['mesaVip'],
    '⭐ VIP':      ['preventaVip', 'vip', 'prevDiamond', 'puertaDiamond', 'prueba'],
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
      const esVip = ['mesaVip','preventaVip','vip','prevDiamond','puertaDiamond'].includes(id);
      const esDiamond = ['prevDiamond','puertaDiamond'].includes(id);
      const ultimasEntradas = e.activa && e.disponibles > 0 && e.disponibles <= 5;

      card.className = `modal-tipo-card${esVip ? ' vip' : ''}${esDiamond ? ' diamond' : ''}${!e.activa || e.disponibles === 0 ? ' agotado' : ''}`;
      card.dataset.id = id;

      if (e.activa && e.disponibles > 0) {
        card.onclick = () => agregarAlCarritoEntradas(id);
      }

      card.innerHTML = `
        ${id === 'soloMujeres' ? '<div class="modal-tipo-badge">Promo</div>' : ''}
        ${!e.activa || e.disponibles === 0 ? '<div class="modal-tipo-badge agotado-badge">Agotado</div>' : ''}
        <div class="modal-tipo-nombre">${e.nombre}</div>
        ${id === 'mesaVip' ? '<div class="modal-tipo-sub">A un costado del escenario</div>' : ''}
        <div class="modal-tipo-precio">${formatPrecio(e.precio)}</div>
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
  if (sessionStorage.getItem('anuncio_visto')) return;

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
    carritoEntradas.push({ id, nombre: e.nombre, precio: e.precio, cantidad: 1 });
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
      <div class="desglose-row"><span>IVA (19%)</span><span>${formatPrecio(d.ivaTotal)}</span></div>
      <div class="desglose-row"><span>Comisión servicio (3.99%)</span><span>${formatPrecio(d.comTotal)}</span></div>
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

function abrirCheckoutForm() {
  if (carritoEntradas.length === 0) { mostrarToast('⚠️ Agrega entradas al carrito primero', true); return; }
  cerrarTodosModales();
  document.getElementById('modal-checkout').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('checkout-error').style.display = 'none';
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

  const items = carritoEntradas.map(i => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return { nombre: `${NOMBRE_EVENTO_PRINCIPAL} — ${i.nombre}`, cantidad: i.cantidad, precioFinal: d.totalUnit };
  });

  fetch('https://bluewine-production.up.railway.app/crear-pago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, comprador })
  })
  .then(res => res.json())
  .then(data => {
    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      errorEl.textContent = '⚠️ Error al procesar el pago. Intenta nuevamente.';
      errorEl.style.display = 'block';
    }
  })
  .catch(() => {
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
      <div class="desglose-row"><span>IVA (19%) × ${item.cantidad}</span><span>${formatPrecio(d.ivaTotal)}</span></div>
      <div class="desglose-row"><span>Comisión MP (3.99%) × ${item.cantidad}</span><span>${formatPrecio(d.comTotal)}</span></div>
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
    return `• ${i.cantidad}x ${i.nombre} - ${formatPrecio(d.totalFinal)} (IVA y comisión incluidos)`;
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