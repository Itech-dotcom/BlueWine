# Blue Wine — Notas del proyecto

## Frases clave para cambios de estado de eventos

Cuando el usuario diga **"evento cerrado"** o **"nuevo evento"**, ejecutar la secuencia
correspondiente directamente (sin pedir confirmación paso a paso). Solo confirmar antes
de `git push`, como siempre ("¿Lo subo?").

### "evento cerrado"

Se usa cuando el evento de esta semana ya pasó y todavía no hay uno nuevo confirmado.

1. **index.html**
   - `.hero-evento-destacado` → agregar `style="display:none"` (oculta la imagen del
     evento del hero, deja solo el nombre "MultiEspacio Blue Wine")
   - `.nav-carrito-btn` del botón 🎟️ (`onclick="abrirCarritoEntradas()"`) → agregar
     `style="display:none"`
   - `#modal-principal` → agregar `style="display:none"`
   - `#carrito-entradas` → agregar `style="display:none"`
   - `#modal-anuncio` → agregar `style="display:none"`
   - Slides de Viernes y Sábado en `#eventosSlider` → poner en estado "Sin Evento",
     A MENOS que el usuario diga que uno de esos días sí tiene evento (en ese caso
     dejar ese slide con la info del evento nuevo). Patrón "Sin Evento":
     ```html
     <div class="evento-tag" style="background:rgba(100,100,100,0.2); color:var(--text-muted); border-color:var(--text-muted);">Sin Evento</div>
     <div class="evento-title" style="font-size:1.3rem; color:var(--text-muted);">Este [viernes/sábado] no hay evento</div>
     <div class="evento-desc">Esta semana no tenemos eventos programados. ¡Síguenos en Instagram para enterarte de la próxima fecha!</div>
     ...
     <a href="https://www.instagram.com/bluewine.quillon" target="_blank" class="hero-evento-btn" style="margin-top:0.5rem;text-decoration:none;">
       <span class="hero-evento-dot"></span>
       Seguir en Instagram
     </a>
     ```
   - Actualizar `.evento-slide-nombre-dia` con las fechas del viernes/sábado de la
     semana correspondiente.
   - Subir versión de cache: `<script src="JS/main.js?v=N">` → `?v=N+1`

2. **JS/main.js**
   - `CONFIG_ANUNCIO.activo = false`

### "nuevo evento"

Se usa cuando hay un evento nuevo confirmado. Si faltan datos, pedirlos al usuario:
- Nombre del evento
- Día (viernes y/o sábado) y fecha
- Imagen ya subida a `Imagenes/` (nombre de archivo)
- Tipos de entrada y precios (si cambian respecto al evento anterior)

1. **index.html**
   - `.hero-evento-destacado` → quitar `style="display:none"`
     - Actualizar `<img src="Imagenes/Evento___.jpeg" alt="___ - ___">`
     - Actualizar `.hero-evento-fecha-txt` con la fecha del evento
   - `.nav-carrito-btn` del botón 🎟️ → quitar `style="display:none"`
   - `#modal-principal` → quitar `style="display:none"`
     - Actualizar `<p class="section-label">Nombre — Día Fecha</p>` (nombre del
       evento y fecha)
   - `#carrito-entradas` → quitar `style="display:none"`
   - `#modal-anuncio` → quitar `style="display:none"` SOLO si `CONFIG_ANUNCIO.activo = true`
   - Slides de Viernes/Sábado en `#eventosSlider`:
     - Si ese día tiene evento → reemplazar el bloque "Sin Evento" con la info real
       (tag, título, descripción, botón "Ver entradas disponibles" con
       `onclick="abrirModal()"`)
     - Si ese día NO tiene evento → dejar/usar el patrón "Sin Evento" de arriba
   - Subir versión de cache: `?v=N` → `?v=N+1`

2. **JS/main.js**
   - `CONFIG_ANUNCIO`: actualizar `titulo`, `fecha`, `desc`, `imagen` y `activo`
     según corresponda
   - `ENTRADAS`: actualizar precios, `limite`/`disponibles` y `activa` para los
     tipos vigentes (poner `activa: false` o quitar los que no apliquen). Revisar
     también `esVip`, `grupos` y badges si los tipos de entrada cambian.

3. **backend/app.py**
   - Si se agregan tipos de entrada nuevos con stock limitado (como "Mesa Diamond"
     o "Meet & Greet"), revisar el endpoint `/stock` para incluirlos en el conteo.
