const API_BASE = 'https://bluewine-production.up.railway.app';
const HUELLA_CRED_KEY = 'bwPanelHuellaCredId';

function b64urlABuffer(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferAB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getKey() {
  return sessionStorage.getItem('bwAdminKey') || localStorage.getItem('bwAdminKey') || '';
}

function huellaSoportadaEnNavegador() {
  return window.isSecureContext && !!window.PublicKeyCredential;
}

async function huellaListaParaUsar() {
  if (!huellaSoportadaEnNavegador()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function mostrarMsgHuella(texto) {
  const msg = document.getElementById('login-huella-msg');
  if (msg) { msg.textContent = texto; msg.hidden = false; }
}

function mostrarFormularioClave() {
  document.getElementById('login-form-wrap').hidden = false;
  document.getElementById('btn-huella').hidden = true;
  document.getElementById('btn-usar-clave').hidden = true;
  document.getElementById('login-password').focus();
}

function setLoginLoading(loading) {
  const btn = document.querySelector('#login-form-wrap button[type="submit"]');
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Verificando…' : 'Entrar'; }
}

async function intentarLogin(event) {
  event.preventDefault();
  const input = document.getElementById('login-password');
  const error = document.getElementById('login-error');
  const clave = input.value.trim();
  if (!clave) return false;

  setLoginLoading(true);
  try {
    const res = await fetch(`${API_BASE}/admin/tickets`, {
      headers: { 'X-Admin-Key': clave }
    });
    if (res.ok) {
      sessionStorage.setItem('bwAdminKey', clave);
      // Si ya hay huella registrada, persistir clave en localStorage para próximas sesiones
      if (localStorage.getItem(HUELLA_CRED_KEY)) {
        localStorage.setItem('bwAdminKey', clave);
      }
      error.hidden = true;
      mostrarApp();
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  } catch {
    error.textContent = 'Sin conexión al servidor.';
    error.hidden = false;
  } finally {
    setLoginLoading(false);
  }
  return false;
}

async function ofrecerActivarHuella() {
  if (localStorage.getItem(HUELLA_CRED_KEY)) return;
  const lista = await huellaListaParaUsar();
  const btn = document.getElementById('btn-activar-huella');
  if (btn) btn.hidden = !lista;
}

async function registrarHuella() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Blue Wine · Panel' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'admin-panel',
          displayName: 'Blue Wine Admin'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    localStorage.setItem(HUELLA_CRED_KEY, bufferAB64url(cred.rawId));
    // Persistir clave para que la huella funcione en sesiones futuras
    const claveActual = sessionStorage.getItem('bwAdminKey');
    if (claveActual) localStorage.setItem('bwAdminKey', claveActual);
    document.getElementById('btn-activar-huella').hidden = true;
    mostrarMsgHuella('Huella activada para este dispositivo.');
  } catch {
    mostrarMsgHuella('No se pudo activar la huella en este dispositivo.');
  }
}

async function intentarLoginHuella() {
  const credId = localStorage.getItem(HUELLA_CRED_KEY);
  if (!credId) return;
  if (!getKey()) {
    mostrarMsgHuella('Ingresa tu clave una vez para re-vincularla con la huella.');
    mostrarFormularioClave();
    return;
  }
  // Intento 1: con el credential ID guardado
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: b64urlABuffer(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (assertion) {
      sessionStorage.setItem('bwAdminKey', getKey());
      mostrarApp();
      return;
    }
  } catch (err1) {
    // Si el credential no se encuentra, intentar sin allowCredentials (passkey discovery)
    if (err1?.name === 'NotAllowedError' || err1?.name === 'InvalidStateError') {
      try {
        const assertion2 = await navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            userVerification: 'required',
            timeout: 60000
          }
        });
        if (assertion2) {
          // Actualizar el ID guardado con el que realmente se usó
          localStorage.setItem(HUELLA_CRED_KEY, bufferAB64url(assertion2.rawId));
          sessionStorage.setItem('bwAdminKey', getKey());
          mostrarApp();
          return;
        }
      } catch { /* fallthrough al mensaje de error */ }
    }
    const detalle = err1?.name === 'NotAllowedError'
      ? 'Huella no reconocida o cancelada.'
      : err1?.name === 'InvalidStateError'
      ? 'Credencial no encontrada en este dispositivo. Vuelve a registrarla desde el panel.'
      : 'Error (' + (err1?.name || 'desconocido') + ').';
    mostrarMsgHuella(detalle + ' Usa tu clave para entrar.');
    mostrarFormularioClave();
  }
}

function cerrarSesion() {
  sessionStorage.removeItem('bwAdminKey');
  // Si hay huella registrada, mantener la clave en localStorage para el próximo login biométrico
  if (!localStorage.getItem(HUELLA_CRED_KEY)) {
    localStorage.removeItem('bwAdminKey');
  }
  location.reload();
}

function mostrarApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app-shell').classList.add('visible');
  if (typeof onPanelListo === 'function') onPanelListo();
}

async function initLogin() {
  if (sessionStorage.getItem('bwAdminKey')) {
    mostrarApp();
    return;
  }
  const credId = localStorage.getItem(HUELLA_CRED_KEY);
  const lista = credId ? await huellaListaParaUsar() : false;
  if (credId && lista) {
    document.getElementById('btn-huella').hidden = false;
    document.getElementById('btn-usar-clave').hidden = false;
    document.getElementById('login-form-wrap').hidden = true;
  }
}

// ── GESTIÓN DE HUELLA DESDE EL PANEL ──
async function initHuellaBtn() {
  const btn = document.getElementById('btn-huella-panel');
  if (!btn) return;
  const soportada = await huellaListaParaUsar();
  if (!soportada) return;
  const registrada = !!localStorage.getItem(HUELLA_CRED_KEY);
  const txt = document.getElementById('btn-huella-panel-txt');
  if (txt) txt.textContent = registrada ? 'Quitar huella' : 'Activar huella';
  btn.hidden = false;
}

async function gestionarHuella() {
  const registrada = !!localStorage.getItem(HUELLA_CRED_KEY);
  if (registrada) {
    if (!confirm('Ya tienes huella registrada.\n¿Deseas eliminarla y registrar de nuevo?')) return;
    localStorage.removeItem(HUELLA_CRED_KEY);
    const txt = document.getElementById('btn-huella-panel-txt');
    if (txt) txt.textContent = 'Activar huella';
    // Continúa al bloque de registro abajo
  }
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Blue Wine · Panel' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'admin-panel',
          displayName: 'Blue Wine Admin'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    localStorage.setItem(HUELLA_CRED_KEY, bufferAB64url(cred.rawId));
    const clave = getKey();
    if (!clave) {
      localStorage.removeItem(HUELLA_CRED_KEY);
      if (typeof mostrarToast === 'function') mostrarToast('Sesión expirada. Cierra sesión y vuelve a registrar la huella.', 'error');
      else alert('Sesión expirada. Cierra sesión y vuelve a registrar la huella.');
      return;
    }
    localStorage.setItem('bwAdminKey', clave);
    const txt = document.getElementById('btn-huella-panel-txt');
    if (txt) txt.textContent = 'Quitar huella';
    if (typeof mostrarToast === 'function') mostrarToast('Huella activada en este dispositivo');
    else alert('¡Huella activada correctamente!');
  } catch (err) {
    const detalle = err?.name === 'NotAllowedError'
      ? 'Permiso denegado o tiempo agotado.'
      : (err?.message || err?.name || 'error desconocido');
    const msg = 'No se pudo activar la huella: ' + detalle;
    if (typeof mostrarToast === 'function') mostrarToast(msg, 'error');
    else alert(msg);
  }
}

// initLogin() se llama desde index.html después de cargar todos los scripts
