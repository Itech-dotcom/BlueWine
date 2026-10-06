# Blue Wine — Notas del proyecto

## Sistema de eventos (evento1..evento5)

El sitio soporta hasta 5 eventos simultáneos en slots `evento1`..`evento5`.
- **Evento 1** es el principal (controla el carrito de pago MercadoPago y las claves legacy).
- Cada evento tiene su propia configuración: `activo`, `destacado`, `carrito`, `anuncio`, `entradasGratis`, `entradasGratisAgotada`, `limiteEntradasGratis`, `nombre`, `fecha`, `imagen`, `lineup`, `diaLabel`, `entradas`.
- El evento con `destacado: true` aparece en el hero; si ninguno está destacado, el primer activo es el hero.
- La configuración vive en PostgreSQL (tabla `config`). El panel admin (`admitech/`) la lee y escribe.
- Backward compat: el backend lee `eventoViernes`/`eventoSabado` si `evento1`/`evento2` no existen en PG.

## Panel admin (admitech/)

- **Tab Evento** → barra con Evento 1..5; cada tab tiene: datos del evento, imagen, preview slide, toggles de configuración.
- **Tab Entradas** → tipos de entrada del evento actualmente seleccionado (se intercambian al cambiar de tab). Cada evento tiene sus propios tipos.
- **Tab Tickets** → listado con filtro por evento y por tipo de entrada.
- Guardar construye `evento1`..`evento5` en PG y también escribe claves legacy (`eventoViernes`, `eventoActivo`, `carrito`, etc.) que apuntan a Evento 1.

## Frases clave para cambios de estado de eventos

Cuando el usuario diga **"evento cerrado"** o **"nuevo evento"**, ejecutar la secuencia
correspondiente directamente (sin pedir confirmación paso a paso). Solo confirmar antes
de `git push`, como siempre ("¿Lo subo?").

### "evento cerrado"

Se usa cuando todos los eventos han pasado y no hay ninguno nuevo confirmado.

1. **Panel admin** (método preferido): desactivar los toggles "Evento activo" de cada evento en los tabs Evento 1/2/3, guardar. El sitio oculta los slides automáticamente.

2. **index.html** (si se requiere cambio manual en código):
   - `.hero-evento-destacado` → agregar `style="display:none"` (oculta la imagen del
     evento del hero, deja solo el nombre "MultiEspacio Blue Wine")
   - `.nav-carrito-btn` del botón 🎟️ → agregar `style="display:none"`
   - `#modal-principal` → agregar `style="display:none"`
   - `#carrito-entradas` → agregar `style="display:none"`
   - `#modal-anuncio` → agregar `style="display:none"`
   - Slides en `#eventosSlider` → poner en estado "Sin Evento". Patrón "Sin Evento":
     ```html
     <div class="evento-tag" style="background:rgba(100,100,100,0.2); color:var(--text-muted); border-color:var(--text-muted);">Sin Evento</div>
     <div class="evento-title" style="font-size:1.3rem; color:var(--text-muted);">Este [día] no hay evento</div>
     <div class="evento-desc">Esta semana no tenemos eventos programados. ¡Síguenos en Instagram para enterarte de la próxima fecha!</div>
     ...
     <a href="https://www.instagram.com/bluewine.quillon" target="_blank" class="hero-evento-btn" style="margin-top:0.5rem;text-decoration:none;">
       <span class="hero-evento-dot"></span>
       Seguir en Instagram
     </a>
     ```
   - Subir versión de cache: `<script src="JS/main.js?v=N">` → `?v=N+1`

3. **JS/main.js**
   - `CONFIG_ANUNCIO.activo = false`

### "nuevo evento"

Se usa cuando hay un evento nuevo confirmado. Si faltan datos, pedirlos al usuario:
- Nombre del evento y a qué slot va (evento1 = principal, evento2/3 = secundarios)
- Fecha y etiqueta del día (ej: "Viernes", "Sábado", "Jueves")
- Imagen ya subida a `Imagenes/` (nombre de archivo)
- Si tiene entradas de pago: tipos y precios
- Si tiene entradas gratis: límite y si está activo

1. **Panel admin** (método preferido): ir al tab del slot correspondiente (Evento 1/2/3), rellenar datos y activar los toggles necesarios, guardar.

2. **Si es Evento 1 (principal) y cambian los precios** → también actualizar en código:

   **JS/main.js**
   - `CONFIG_ANUNCIO`: actualizar `titulo`, `fecha`, `desc`, `imagen` y `activo`
   - `ENTRADAS`: actualizar precios, `limite`/`disponibles` y `activa` para los tipos vigentes

   **backend/app.py**
   - **OBLIGATORIO**: actualizar `PRECIOS_ENTRADAS` y `NOMBRE_EVENTO_PRINCIPAL` para
     que coincidan exactamente con `ENTRADAS` de `JS/main.js` (precios, `personas`, nombres).
     El backend valida cada compra contra esta tabla — si no coincide, `/crear-pago`
     rechazará los tipos de entrada nuevos o cobrará el precio antiguo.
   - Si se agregan tipos de entrada con stock limitado, revisar el endpoint `/stock`.

   **index.html**
   - Subir versión de cache: `?v=N` → `?v=N+1`

## Seguridad — endpoints administrativos

- `/emitir-manual`, `/reenviar-ticket` y `/recuperar-pendiente` requieren el header
  `X-Admin-Key` con el valor de `ADMIN_KEY` (variable de entorno en Railway,
  fallback `bw-admin-2026` en el código). Si se rota la clave, actualizarla en
  Railway y usar el nuevo valor en los comandos PowerShell de administración.
- `/crear-pago` valida cada item del carrito contra `PRECIOS_ENTRADAS` (precio,
  `personas`, nombre del evento) y verifica que `len(acompanantes) == total
  personas - 1`. Nunca confiar en precios/cantidades/nombres que vengan del
  frontend.
- `/obtener-entrada-gratis` solo funciona si `ENTRADA_GRATIS_ACTIVA = True` en
  `backend/app.py` (poner en `True` solo durante una promo de entradas liberadas
  y volver a `False` después). La activación/desactivación de gratis por evento
  se controla además por el toggle `entradasGratis` en el panel admin.
