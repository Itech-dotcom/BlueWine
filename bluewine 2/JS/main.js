/* 
    Programador: Isaac Fernández
    Fecha creación: 24 marzo 2026
*/

// ── Navbar: cambio de estilo al hacer scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Menú móvil: abrir / cerrar
function toggleNav() {
  const navLinks = document.getElementById('navLinks');
  navLinks.classList.toggle('open');
  document.body.classList.toggle('menu-open');
}

// Cerrar menú al hacer clic en un enlace
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// ── Animaciones al hacer scroll (Intersection Observer)
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
  observer.observe(el);
});

// ── Touch: tarjetas de espacios (móvil)
document.querySelectorAll('.espacio-card').forEach(card => {
  card.addEventListener('click', () => {
    const isActive = card.classList.contains('active');
    document.querySelectorAll('.espacio-card').forEach(c => c.classList.remove('active'));
    if (!isActive) card.classList.add('active');
  });
});

// ── Formulario de reservas
const btnSubmit = document.querySelector('.btn-submit');
if (btnSubmit) {
  btnSubmit.addEventListener('click', () => {
    alert('¡Gracias! Tu solicitud fue enviada. Te contactaremos pronto. 🍷');
  });
}

// ══════════════════════════════════════
// MODAL COMPRA DE ENTRADAS
// ══════════════════════════════════════
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
  if (event.target === document.getElementById('modal-entradas')) {
    cerrarModal();
  }
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
  // Por ahora muestra confirmación — aquí irá la integración con Flow.cl
  alert(`Redirigiendo a Flow.cl para pagar ${cantidadEntradas} entrada(s) para "${nombreEvento}" por ${formatPrecio(precioUnitario * cantidadEntradas)} 🎟️\n\n(Integración con Flow.cl pendiente)`);
  cerrarModal();
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});

// ══════════════════════════════════════
// FILTRO DELIVERY
// ══════════════════════════════════════
function filtrarMenu(categoria) {
  // Actualizar botones activos
  document.querySelectorAll('.delivery-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  // Filtrar tarjetas
  document.querySelectorAll('.menu-card').forEach(card => {
    if (categoria === 'todos') {
      card.classList.remove('hidden');
    } else {
      const cats = card.dataset.categoria || '';
      if (cats.includes(categoria)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    }
  });
}