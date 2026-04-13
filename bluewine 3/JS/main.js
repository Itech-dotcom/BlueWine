/* 
    Programador: Isaac Fernández
    Prototipo 3
*/

// ── Navbar: ocultar al bajar, mostrar al subir
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  
  // Scrolled style
  navbar.classList.toggle('scrolled', currentScroll > 60);
  
  // Ocultar al bajar, mostrar al subir
  if (currentScroll > 100) {
    if (currentScroll > lastScroll) {
      navbar.classList.add('hidden');
    } else {
      navbar.classList.remove('hidden');
    }
  } else {
    navbar.classList.remove('hidden');
  }
  
  lastScroll = currentScroll;
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

// ── Reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
  observer.observe(el);
});

// ── Espacios touch móvil
document.querySelectorAll('.espacio-card').forEach(card => {
  card.addEventListener('click', () => {
    const isActive = card.classList.contains('active');
    document.querySelectorAll('.espacio-card').forEach(c => c.classList.remove('active'));
    if (!isActive) card.classList.add('active');
  });
});

// ── Formulario reservas
const btnSubmit = document.querySelector('.btn-submit');
if (btnSubmit) {
  btnSubmit.addEventListener('click', () => {
    alert('¡Gracias! Tu solicitud fue enviada. Te contactaremos pronto. 🍷');
  });
}

// ══════════════════════════════════
// MODAL COMPRA DE ENTRADAS
// ══════════════════════════════════
let precioUnitario = 0;
let cantidadEntradas = 1;
let nombreEvento = '';

function abrirModal(nombre, precio) {
  nombreEvento = nombre;
  precioUnitario = precio;
  cantidadEntradas = 1;
  document.getElementById('modal-evento-nombre').textContent = nombre;
  document.getElementById('modal-cantidad').textContent = cantidadEntradas;
  document.getElementById('modal-total').textContent = formatPrecio(precio);
  document.getElementById('modal-entradas').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  document.getElementById('modal-entradas').classList.remove('active');
  document.body.style.overflow = '';
}

function cerrarModalOverlay(event) {
  if (event.target === document.getElementById('modal-entradas')) cerrarModal();
}

function cambiarCantidad(delta) {
  cantidadEntradas = Math.max(1, Math.min(20, cantidadEntradas + delta));
  document.getElementById('modal-cantidad').textContent = cantidadEntradas;
  document.getElementById('modal-total').textContent = formatPrecio(precioUnitario * cantidadEntradas);
}

function formatPrecio(valor) {
  return '$' + valor.toLocaleString('es-CL');
}

function irAPago() {
  alert(`Redirigiendo a Flow.cl para pagar ${cantidadEntradas} entrada(s) para "${nombreEvento}" por ${formatPrecio(precioUnitario * cantidadEntradas)} 🎟️\n\n(Integración con Flow.cl pendiente)`);
  cerrarModal();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});

// ══════════════════════════════════
// DELIVERY — SELECTOR DE CATEGORÍAS
// ══════════════════════════════════
function seleccionarCategoria(categoria, btn) {
  // Actualizar botones
  document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Ocultar todos los grids
  document.querySelectorAll('.platos-grid').forEach(g => g.classList.remove('active'));

  // Mostrar el seleccionado
  const grid = document.getElementById('cat-' + categoria);
  if (grid) grid.classList.add('active');
}

// ══════════════════════════════════
// EVENTOS PRIVADOS — SELECTOR
// ══════════════════════════════════
function seleccionarEvento(tipo, btn) {
  // Actualizar botones
  document.querySelectorAll('.privado-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Ocultar todos los paneles
  document.querySelectorAll('.privado-panel').forEach(p => p.classList.remove('active'));

  // Mostrar el seleccionado
  const panel = document.getElementById('ev-' + tipo);
  if (panel) {
    panel.classList.add('active');
    // Scroll suave al panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}