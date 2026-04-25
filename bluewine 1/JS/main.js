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
if (btnSubmit) btnSubmit.addEventListener('click', () => alert('¡Gracias! Tu solicitud fue enviada. Te contactaremos pronto. 🍷'));

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
  document.getElementById('modal-general-nombre').textContent = nombre;
  document.getElementById('modal-general-precio').textContent = formatPrecio(precio);
  document.getElementById('modal-general-cantidad').textContent = 1;
  document.getElementById('modal-general-total').textContent = formatPrecio(precio);
  document.getElementById('modal-general').dataset.precio = precio;
  document.getElementById('modal-general').dataset.nombre = nombre;
  document.getElementById('modal-general').dataset.cantidad = 1;
  document.getElementById('modal-general').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function cambiarCantidadGeneral(delta) {
  const modal = document.getElementById('modal-general');
  const precio = parseInt(modal.dataset.precio);
  let cant = parseInt(modal.dataset.cantidad) + delta;
  cant = Math.max(1, Math.min(20, cant));
  modal.dataset.cantidad = cant;
  document.getElementById('modal-general-cantidad').textContent = cant;
  document.getElementById('modal-general-total').textContent = formatPrecio(precio * cant);
}

function agregarGeneralAlCarrito() {
  const modal = document.getElementById('modal-general');
  const nombre = modal.dataset.nombre;
  const precio = parseInt(modal.dataset.precio);
  const cantidad = parseInt(modal.dataset.cantidad);
  agregarItemCarritoEntradas({ id: 'general_' + Date.now(), nombre, precio, cantidad });
  cerrarTodosModales();
  mostrarToast('✓ Agregado al carrito de entradas');
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

function procederPagoEntradas() {
  if (carritoEntradas.length === 0) { mostrarToast('⚠️ Agrega entradas al carrito primero', true); return; }

  mostrarToast('⏳ Procesando pago...');

  const items = carritoEntradas.map(i => {
    const d = calcularDesglose(i.precio, i.cantidad);
    return {
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioFinal: d.totalUnit
    };
  });

    fetch('https://bluewine-production.up.railway.app/crear-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    .then(res => res.json())
    .then(data => {
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        mostrarToast('⚠️ Error al procesar el pago', true);
      }
    })
    .catch(() => mostrarToast('⚠️ Error de conexión con el servidor', true));
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
// INIT
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Mostrar pizzas por defecto
  document.querySelectorAll('.menu-card').forEach(card => {
    if (!card.dataset.categoria.includes('pizza')) card.classList.add('hidden');
  });

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
});