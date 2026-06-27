/**
 * Hotel Luxe — Frontend SPA
 * Sistema de Gestión Hotelera
 */

// ============================================================
// ESTADO GLOBAL
// ============================================================
// ============================================================
// ESTADO GLOBAL
// ============================================================
let staffToken = localStorage.getItem('hotel_staff_token') || null;
let clienteToken = localStorage.getItem('hotel_cliente_token') || null;
let currentUser = JSON.parse(localStorage.getItem('hotel_user') || 'null');
let currentCliente = JSON.parse(localStorage.getItem('hotel_cliente') || 'null');
let currentView = 'dashboard';
let selectedHabitacion = null;
let searchDates = { checkin: null, checkout: null };

const API = '/api/v1';

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Set fechas mínimas
  const hoy = new Date().toISOString().split('T')[0];
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const pasado = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const ci = document.getElementById('search-checkin');
  const co = document.getElementById('search-checkout');
  if (ci) { ci.min = hoy; ci.value = manana; }
  if (co) { co.min = hoy; co.value = pasado; }

  // Forms
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('registro-form')?.addEventListener('submit', handleClienteRegistro);
  document.getElementById('form-reserva-web')?.addEventListener('submit', handleReservaWeb);

  // Loading screen → init
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) {
      ls.style.opacity = '0';
      setTimeout(() => { ls.style.display = 'none'; init(); }, 500);
    } else {
      init();
    }
  }, 1500);
});

function init() {
  if (staffToken && currentUser) {
    showDashboard();
  } else if (clienteToken && currentCliente) {
    showPage('web-page');
    loadTiposHabitacion();
    cargarConfigFooter();
  } else {
    showPage('login-page');
  }
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(pageId);
  if (target) target.classList.remove('hidden');

  if (pageId === 'web-page') {
    loadTiposHabitacion();
    actualizarNavCliente();
    cargarConfigFooter();
  } else if (pageId === 'mis-reservas-page') {
    cargarMisReservas();
  } else if (pageId === 'perfil-cliente-page') {
    cargarPerfilClienteForm();
  }
}

function showDashboard() {
  if (!currentUser) { showPage('login-page'); return; }
  showPage('dashboard-page');
  document.getElementById('user-display-name').textContent = `${currentUser.nombre} ${currentUser.apellido}`;
  document.getElementById('user-display-role').textContent = currentUser.rol;
  document.getElementById('user-avatar').textContent = currentUser.nombre?.[0]?.toUpperCase() || 'U';
  document.getElementById('sidebar-role-badge').textContent = currentUser.rol;

  // Aplicar visibilidad de menús de acuerdo al rol
  applyRolePermissionsUI();

  updateHeaderDate();
  setInterval(updateHeaderDate, 60000);
  loadView('dashboard');
}

function applyRolePermissionsUI() {
  const role = currentUser?.rol;
  const navAdmin = document.getElementById('nav-admin');
  const navOperaciones = document.getElementById('nav-operaciones');
  const navRecepcion = document.getElementById('nav-recepcion');
  const navConfig = document.getElementById('nav-configuracion-link');

  if (role === 'recepcionista') {
    if (navAdmin) navAdmin.style.display = 'none';
    if (navOperaciones) navOperaciones.style.display = 'block';
    if (navRecepcion) navRecepcion.style.display = 'block';
    if (navConfig) navConfig.style.display = 'none';
  } else if (role === 'gerente') {
    if (navAdmin) {
      navAdmin.style.display = 'block';
      const usersLink = navAdmin.querySelector('[data-view="usuarios"]');
      if (usersLink) usersLink.style.display = 'none';
    }
    if (navOperaciones) navOperaciones.style.display = 'block';
    if (navRecepcion) navRecepcion.style.display = 'block';
    if (navConfig) navConfig.style.display = 'none';
  } else {
    // Admin
    if (navAdmin) {
      navAdmin.style.display = 'block';
      const usersLink = navAdmin.querySelector('[data-view="usuarios"]');
      if (usersLink) usersLink.style.display = 'flex';
    }
    if (navOperaciones) navOperaciones.style.display = 'block';
    if (navRecepcion) navRecepcion.style.display = 'block';
    if (navConfig) navConfig.style.display = 'flex';
  }
}

function actualizarNavCliente() {
  const navRight = document.querySelector('.nav-links');
  if (!navRight) return;

  if (clienteToken && currentCliente) {
    const existingAuth = document.getElementById('nav-cliente-auth');
    if (!existingAuth) {
      const div = document.createElement('div');
      div.id = 'nav-cliente-auth';
      div.style.cssText = 'display:flex;align-items:center;gap:12px;';
      div.innerHTML = `
        <span style="color:rgba(255,255,255,0.8);font-size:14px;cursor:pointer;text-decoration:underline;" onclick="showPage('perfil-cliente-page')" title="Configurar Perfil">👤 ${currentCliente.nombres || currentCliente.nombre || currentCliente.email || 'Huésped'}</span>
        <button class="btn btn-sm btn-outline" onclick="showPage('mis-reservas-page')" style="border-color:var(--gold);color:var(--gold-light);">Mis Reservas</button>
        <button class="btn btn-sm btn-outline" onclick="logoutCliente()" style="border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.7);">Salir</button>
      `;
      document.getElementById('nav-login-btn')?.remove();
      navRight.appendChild(div);
    }
  } else {
    document.getElementById('nav-cliente-auth')?.remove();
    if (!document.getElementById('nav-login-btn')) {
      const btn = document.createElement('button');
      btn.id = 'nav-login-btn';
      btn.className = 'btn btn-primary btn-sm';
      btn.style.cssText = 'padding:8px 18px;font-size:13px;';
      btn.textContent = '🔑 Iniciar Sesión / Registrarse';
      btn.onclick = () => showPage('login-page');
      navRight.insertBefore(btn, navRight.querySelector('.btn-outline-sm'));
    }
  }
}

function updateHeaderDate() {
  const el = document.getElementById('header-date');
  if (el) el.textContent = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ============================================================
// AUTH GENERAL UNIFICADO
// ============================================================

function switchLoginTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('registro-form');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-registro');

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    regForm?.classList.add('hidden');
    tabLogin?.classList.add('active');
    tabReg?.classList.remove('active');
  } else {
    loginForm?.classList.add('hidden');
    regForm?.classList.remove('hidden');
    tabLogin?.classList.remove('active');
    tabReg?.classList.add('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  btn.innerHTML = '<span>Verificando...</span>';
  btn.disabled = true;
  errEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.message || 'Credenciales inválidas';
      errEl.classList.remove('hidden');
      return;
    }

    if (data.data.tipo === 'staff') {
      staffToken = data.data.token;
      currentUser = data.data.usuario;
      localStorage.setItem('hotel_staff_token', staffToken);
      localStorage.setItem('hotel_user', JSON.stringify(currentUser));
      showToast(`¡Bienvenido al sistema, ${currentUser.nombre}!`, 'success');
      showDashboard();
    } else {
      clienteToken = data.data.token;
      currentCliente = data.data.usuario; // unificado
      localStorage.setItem('hotel_cliente_token', clienteToken);
      localStorage.setItem('hotel_cliente', JSON.stringify(currentCliente));
      showToast(`¡Bienvenido, ${currentCliente.nombre}!`, 'success');
      showPage('web-page');
    }
  } catch (err) {
    errEl.textContent = 'Error de conexión con el servidor';
    errEl.classList.remove('hidden');
  } finally {
    btn.innerHTML = '<span>Ingresar</span>';
    btn.disabled = false;
  }
}

async function handleClienteRegistro(e) {
  e.preventDefault();
  const errEl = document.getElementById('registro-error');
  const succEl = document.getElementById('registro-success');
  const btn = document.getElementById('registro-btn');

  errEl.classList.add('hidden');
  succEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span>Registrando...</span>';

  try {
    const res = await fetch(`${API}/auth/cliente/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        telefono: document.getElementById('reg-telefono').value || undefined,
        tipo_doc: document.getElementById('reg-tipo-doc').value,
        nro_doc: document.getElementById('reg-nro-doc').value || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.message;
      errEl.classList.remove('hidden');
      return;
    }
    clienteToken = data.data.token;
    currentCliente = data.data.cliente;
    localStorage.setItem('hotel_cliente_token', clienteToken);
    localStorage.setItem('hotel_cliente', JSON.stringify(currentCliente));
    succEl.textContent = '¡Cuenta creada con éxito!';
    succEl.classList.remove('hidden');
    showToast('¡Registro exitoso!', 'success');
    document.getElementById('registro-form')?.reset();
    setTimeout(() => {
      showPage('web-page');
    }, 1500);
  } catch (err) {
    errEl.textContent = 'Error al procesar registro';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Crear Cuenta</span>';
  }
}

function continueAsGuest() {
  showPage('web-page');
}

function logout() {
  staffToken = null; currentUser = null;
  localStorage.removeItem('hotel_staff_token');
  localStorage.removeItem('hotel_user');
  showPage('login-page');
  showToast('Sesión staff cerrada', 'info');
}

function logoutCliente() {
  clienteToken = null; currentCliente = null;
  localStorage.removeItem('hotel_cliente_token');
  localStorage.removeItem('hotel_cliente');
  actualizarNavCliente();
  showPage('login-page');
  showToast('Sesión de huésped cerrada', 'info');
}

function togglePassword(id) {
  const input = document.getElementById(id);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}



// ============================================================
// API HELPER
// ============================================================

async function apiCall(endpoint, options = {}) {
  const token = staffToken;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    console.error('API 401 Unauthorized at:', endpoint);
    showToast(`Sesión de staff expirada o no autorizada al consultar: ${endpoint}`, 'error');
    logout();
    throw new Error('Sesión expirada');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error en la solicitud');
  return data.data;
}

async function apiClienteCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(clienteToken ? { 'Authorization': `Bearer ${clienteToken}` } : {}),
    ...options.headers
  };
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  if (res.status === 401) { logoutCliente(); throw new Error('Sesión expirada'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error en la solicitud');
  return data;
}

function togglePassword() {
  const input = document.getElementById('login-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ============================================================
// SIDEBAR & DASHBOARD
// ============================================================

async function loadView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === viewName));

  const titles = {
    dashboard: ['Dashboard', 'Resumen del día'],
    reservas: ['Reservas', 'Gestión de reservaciones'],
    checkin: ['Check-In', 'Ingreso de huéspedes'],
    estadias: ['Estadías Activas', 'Huéspedes en el hotel'],
    huespedes: ['Huéspedes', 'Base de datos de clientes'],
    habitaciones: ['Habitaciones', 'Estado y configuración'],
    inventario: ['Inventario', 'Stock y productos'],
    reportes: ['Reportes', 'Análisis y estadísticas'],
    usuarios: ['Usuarios', 'Gestión de personal'],
    configuracion: ['Configuración', 'Habitaciones, tarifas e imágenes'],
    ventas: ['Ventas Extra', 'Registro de consumos y ventas a habitaciones']
  };
  const [title, subtitle] = titles[viewName] || [viewName, ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;

  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>Cargando...</p></div>';

  try {
    switch (viewName) {
      case 'dashboard': await renderDashboard(); break;
      case 'reservas': await renderReservas(); break;
      case 'checkin': await renderCheckin(); break;
      case 'estadias': await renderEstadias(); break;
      case 'huespedes': await renderHuespedes(); break;
      case 'habitaciones': await renderHabitaciones(); break;
      case 'inventario': await renderInventario(); break;
      case 'reportes': await renderReportes(); break;
      case 'usuarios': await renderUsuarios(); break;
      case 'configuracion': await renderConfiguracion(); break;
      case 'ventas': await renderVentas(); break;
    }
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
  sb.classList.toggle('open');
}

// ============================================================
// DASHBOARD
// ============================================================

async function renderDashboard() {
  const content = document.getElementById('content-area');
  let stats = { habitaciones: { total:0, por_estado:{}, ocupacion_porcentaje:0 }, hoy:{llegadas:0, estancias_activas:0}, mes:{reservas:0, ingresos:0} };
  try { stats = await apiCall('/reportes/dashboard'); } catch(e) {}

  const pe = stats.habitaciones?.por_estado || {};
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card gold"><div class="stat-icon">📊</div><div class="stat-value">${stats.habitaciones?.ocupacion_porcentaje||0}%</div><div class="stat-label">Ocupación</div></div>
      <div class="stat-card blue"><div class="stat-icon">✅</div><div class="stat-value">${stats.hoy?.llegadas||0}</div><div class="stat-label">Llegadas Hoy</div></div>
      <div class="stat-card green"><div class="stat-icon">🛏️</div><div class="stat-value">${stats.hoy?.estancias_activas||0}</div><div class="stat-label">Estadías Activas</div></div>
      <div class="stat-card purple"><div class="stat-icon">📅</div><div class="stat-value">${stats.mes?.reservas||0}</div><div class="stat-label">Reservas del Mes</div></div>
      <div class="stat-card teal"><div class="stat-icon">💰</div><div class="stat-value">S/ ${parseFloat(stats.mes?.ingresos||0).toLocaleString('es-PE',{minimumFractionDigits:0})}</div><div class="stat-label">Ingresos del Mes</div></div>
      <div class="stat-card red"><div class="stat-icon">🏠</div><div class="stat-value">${stats.habitaciones?.total||0}</div><div class="stat-label">Habitaciones Total</div></div>
    </div>
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🏠 Estado de Habitaciones</h3>
          <button class="btn btn-sm btn-outline" onclick="loadView('habitaciones')">Ver todas</button>
        </div>
        <div class="card-body">
          <div id="rooms-status-container"><div class="empty-state"><p>Cargando...</p></div></div>
          <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;font-size:12px;">
            <span class="badge badge-success">🟢 Disponible: ${pe.disponible||0}</span>
            <span class="badge badge-error">🔴 Ocupada: ${pe.ocupada||0}</span>
            <span class="badge badge-warning">🟡 Limpieza: ${pe.limpieza||0}</span>
            <span class="badge badge-info">🔵 Mantenimiento: ${pe.mantenimiento||0}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">📅 Llegadas de Hoy</h3><button class="btn btn-sm btn-outline" onclick="loadView('checkin')">Check-in</button></div>
        <div class="card-body" id="llegadas-hoy-container"><div class="empty-state"><p>Cargando...</p></div></div>
      </div>
    </div>`;

  try {
    const habs = await apiCall('/habitaciones');
    document.getElementById('rooms-status-container').innerHTML = `
      <div class="rooms-status-grid">
        ${habs.map(h=>`
          <div class="room-status-card ${h.estado}" title="${h.tipo_nombre||''}" onclick="loadView('habitaciones')">
            <span class="room-num">${h.numero}</span>
            <span>${iconEstadoHab(h.estado)}</span>
          </div>`).join('')}
      </div>`;
  } catch(e) {}

  try {
    const llegadas = await apiCall('/reservas/hoy/llegadas');
    const el = document.getElementById('llegadas-hoy-container');
    if (!llegadas?.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><p>No hay llegadas pendientes hoy</p></div>`;
    } else {
      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
        ${llegadas.slice(0,5).map(r=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--gray-50,#fafafa);border-radius:8px;font-size:13px;">
            <div>
              <div style="font-weight:600;">${r.huespedes?.nombres} ${r.huespedes?.apellidos}</div>
              <div style="color:var(--gray-500)">Hab. ${r.habitaciones?.numero}</div>
            </div>
            <button class="btn btn-sm btn-success" onclick="quickCheckin('${r.id}')">Check-in</button>
          </div>`).join('')}
      </div>`;
    }
  } catch(e) {}
}

function iconEstadoHab(e) {
  return {disponible:'✓',ocupada:'●',limpieza:'🧹',mantenimiento:'🔧',fuera_de_servicio:'✗'}[e]||'?';
}

// ============================================================
// RESERVAS
// ============================================================

async function renderReservas() {
  document.getElementById('content-area').innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input type="text" class="search-input" id="reservas-search" placeholder="🔍 Buscar reserva..." oninput="filtrarReservas()">
        <select class="form-input" id="reservas-estado" onchange="filtrarReservas()" style="width:auto;">
          <option value="">Todos los estados</option>
          <option value="confirmada">Confirmada</option>
          <option value="pendiente">Pendiente</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" onclick="openModalNuevaReserva()">+ Nueva Reserva</button>
      </div>
    </div>
    <div class="card"><div class="card-body" id="reservas-table-container"><p>Cargando...</p></div></div>
    ${modalNuevaReserva()}${modalNuevoHuesped()}`;
  await cargarReservas();
}

let todasLasReservas = [];
async function cargarReservas() {
  try {
    const data = await apiCall('/reservas?limit=100');
    todasLasReservas = Array.isArray(data) ? data : [];
    renderTablaReservas(todasLasReservas);
    const badge = document.getElementById('badge-reservas');
    if (badge) badge.textContent = todasLasReservas.filter(r=>r.estado==='confirmada').length;
  } catch(e) {
    document.getElementById('reservas-table-container').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function filtrarReservas() {
  const q = (document.getElementById('reservas-search')?.value||'').toLowerCase();
  const estado = document.getElementById('reservas-estado')?.value||'';
  renderTablaReservas(todasLasReservas.filter(r=>
    (!estado||r.estado===estado) &&
    (!q||`${r.huespedes?.nombres} ${r.huespedes?.apellidos} ${r.huespedes?.nro_doc} ${r.habitaciones?.numero}`.toLowerCase().includes(q))
  ));
}

function renderTablaReservas(reservas) {
  const c = document.getElementById('reservas-table-container');
  if (!reservas?.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No hay reservas</h3></div>`;
    return;
  }
  c.innerHTML = `<div class="table-container"><table>
    <thead><tr><th>Huésped</th><th>Habitación</th><th>Check-in</th><th>Check-out</th><th>Origen</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
    <tbody>
      ${reservas.map(r=>`<tr>
        <td><div style="font-weight:600;">${r.huespedes?.nombres||''} ${r.huespedes?.apellidos||''}</div><div style="font-size:11px;color:var(--gray-500)">${r.huespedes?.nro_doc||''}</div></td>
        <td><strong>Hab. ${r.habitaciones?.numero||'-'}</strong><div style="font-size:11px;color:var(--gray-500)">${r.habitaciones?.tipos_habitacion?.nombre||''}</div></td>
        <td>${formatDate(r.fecha_checkin)}</td>
        <td>${formatDate(r.fecha_checkout)}</td>
        <td><span class="badge ${r.origen==='web'?'badge-info':'badge-gray'}">${r.origen}</span></td>
        <td><span class="badge ${badgeReserva(r.estado)}">${r.estado}</span></td>
        <td>S/ ${parseFloat(r.total_estimado||0).toFixed(2)}</td>
        <td><div style="display:flex;gap:6px;">
          ${r.estado==='confirmada'?`<button class="btn btn-sm btn-success" onclick="hacerCheckin('${r.id}')">Check-in</button>`:''}
          ${r.estado==='confirmada'?`<button class="btn btn-sm btn-danger" onclick="cancelarReserva('${r.id}')">Cancelar</button>`:''}
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function badgeReserva(e) {
  return {confirmada:'badge-success',pendiente:'badge-warning',cancelada:'badge-error',completada:'badge-info',no_show:'badge-gray'}[e]||'badge-gray';
}

async function cancelarReserva(id) {
  if (!confirm('¿Cancelar esta reserva?')) return;
  try {
    const motivo = prompt('Motivo de cancelación (opcional):') || '';
    await apiCall(`/reservas/${id}/cancelar`,{method:'PATCH',body:JSON.stringify({motivo_cancelacion:motivo})});
    showToast('Reserva cancelada','warning');
    cargarReservas();
  } catch(e) { showToast(e.message,'error'); }
}

async function hacerCheckin(reservaId) {
  try {
    await apiCall('/estadias/checkin',{method:'POST',body:JSON.stringify({reserva_id:reservaId})});
    showToast('Check-in realizado exitosamente','success');
    cargarReservas();
  } catch(e) { showToast(e.message,'error'); }
}

async function quickCheckin(reservaId) {
  await hacerCheckin(reservaId);
  loadView('estadias');
}

function modalNuevaReserva() {
  return `<div id="modal-nueva-reserva" class="modal-overlay hidden">
    <div class="modal modal-lg glass-card">
      <div class="modal-header"><h2>Nueva Reserva</h2><button class="btn-close" onclick="closeModal('modal-nueva-reserva')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitNuevaReserva(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Buscar Huésped (Doc)</label>
              <div style="display:flex;gap:8px;">
                <input type="text" id="nr-doc" class="form-input" placeholder="N° documento" style="flex:1">
                <button type="button" class="btn btn-secondary btn-sm" onclick="buscarHuesped()">Buscar</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="openModal('modal-nuevo-huesped')">+ Nuevo</button>
              </div>
              <div id="nr-huesped-info" style="font-size:12px;color:var(--success);margin-top:4px;"></div>
              <input type="hidden" id="nr-huesped-id">
            </div>
            <div class="form-group">
              <label>Habitación</label>
              <select id="nr-habitacion" class="form-input" required onchange="calcularTotalPreview()"><option value="">Selecciona...</option></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Check-in *</label><input type="date" id="nr-checkin" class="form-input" required onchange="calcularTotalPreview()"></div>
            <div class="form-group"><label>Check-out *</label><input type="date" id="nr-checkout" class="form-input" required onchange="calcularTotalPreview()"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Adultos</label><input type="number" id="nr-adultos" class="form-input" value="1" min="1"></div>
            <div class="form-group"><label>Niños</label><input type="number" id="nr-ninos" class="form-input" value="0" min="0"></div>
          </div>
          <div class="form-group"><label>Notas</label><textarea id="nr-notas" class="form-input" rows="2" placeholder="Solicitudes especiales..."></textarea></div>
          <div id="nr-total-preview" style="background:var(--gray-100);padding:12px;border-radius:8px;font-size:14px;margin-bottom:16px;display:none;">
            <strong>Total estimado: S/ <span id="nr-total">0.00</span></strong>
          </div>
          <div id="nr-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">✅ Crear Reserva</button>
        </form>
      </div>
    </div>
  </div>`;
}

function modalNuevoHuesped() {
  return `<div id="modal-nuevo-huesped" class="modal-overlay hidden">
    <div class="modal glass-card">
      <div class="modal-header"><h2>Registrar Huésped</h2><button class="btn-close" onclick="closeModal('modal-nuevo-huesped')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitNuevoHuesped(event)">
          <div class="form-row">
            <div class="form-group"><label>Tipo Doc</label><select id="nh-tipo-doc" class="form-input"><option value="DNI">DNI</option><option value="Pasaporte">Pasaporte</option><option value="CE">C. Extranjería</option></select></div>
            <div class="form-group"><label>N° Documento *</label><input type="text" id="nh-nro-doc" class="form-input" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Nombres *</label><input type="text" id="nh-nombres" class="form-input" required></div>
            <div class="form-group"><label>Apellidos *</label><input type="text" id="nh-apellidos" class="form-input" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" id="nh-email" class="form-input"></div>
            <div class="form-group"><label>Teléfono</label><input type="tel" id="nh-telefono" class="form-input"></div>
          </div>
          <div id="nh-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Registrar Huésped</button>
        </form>
      </div>
    </div>
  </div>`;
}

async function openModalNuevaReserva() {
  const select = document.getElementById('nr-habitacion');
  if (select) {
    try {
      const habs = await apiCall('/habitaciones?estado=disponible');
      select.innerHTML = '<option value="">Selecciona habitación</option>' +
        (habs||[]).map(h=>`<option value="${h.id}" data-precio="${h.tipos_habitacion?.precio_base||0}">${h.numero} - ${h.tipos_habitacion?.nombre||''} (S/ ${h.tipos_habitacion?.precio_base||0}/noche)</option>`).join('');
    } catch(e) {}
  }
  const hoy = new Date().toISOString().split('T')[0];
  const man = new Date(Date.now()+86400000).toISOString().split('T')[0];
  const ci = document.getElementById('nr-checkin');
  const co = document.getElementById('nr-checkout');
  if (ci) ci.value = hoy;
  if (co) co.value = man;
  openModal('modal-nueva-reserva');
}

function calcularTotalPreview() {
  const select = document.getElementById('nr-habitacion');
  const checkin = document.getElementById('nr-checkin')?.value;
  const checkout = document.getElementById('nr-checkout')?.value;
  const preview = document.getElementById('nr-total-preview');
  if (select?.value && checkin && checkout) {
    const precio = parseFloat(select.options[select.selectedIndex]?.dataset.precio||0);
    const noches = Math.ceil((new Date(checkout)-new Date(checkin))/86400000);
    if (noches>0) {
      document.getElementById('nr-total').textContent = (precio*noches).toFixed(2);
      if (preview) preview.style.display='block';
    }
  }
}

async function buscarHuesped() {
  const doc = document.getElementById('nr-doc')?.value.trim();
  if (!doc) return;
  try {
    const h = await apiCall(`/huespedes/buscar/doc?nro_doc=${doc}`);
    document.getElementById('nr-huesped-id').value = h.id;
    document.getElementById('nr-huesped-info').textContent = `✅ ${h.nombres} ${h.apellidos}`;
  } catch {
    document.getElementById('nr-huesped-id').value = '';
    document.getElementById('nr-huesped-info').textContent = '❌ No encontrado — usa "+ Nuevo" para registrar';
  }
}

async function submitNuevaReserva(e) {
  e.preventDefault();
  const huesped_id = document.getElementById('nr-huesped-id').value;
  const errEl = document.getElementById('nr-error');
  errEl.classList.add('hidden');
  if (!huesped_id) { errEl.textContent='Busca y selecciona un huésped primero'; errEl.classList.remove('hidden'); return; }
  try {
    await apiCall('/reservas',{method:'POST',body:JSON.stringify({
      huesped_id, habitacion_id:document.getElementById('nr-habitacion').value,
      fecha_checkin:document.getElementById('nr-checkin').value, fecha_checkout:document.getElementById('nr-checkout').value,
      adultos:parseInt(document.getElementById('nr-adultos').value), ninos:parseInt(document.getElementById('nr-ninos').value),
      notas:document.getElementById('nr-notas').value, origen:'mostrador'
    })});
    showToast('Reserva creada exitosamente','success');
    closeModal('modal-nueva-reserva');
    cargarReservas();
  } catch(err) { errEl.textContent=err.message; errEl.classList.remove('hidden'); }
}

async function submitNuevoHuesped(e) {
  e.preventDefault();
  const errEl = document.getElementById('nh-error');
  errEl.classList.add('hidden');
  try {
    const h = await apiCall('/huespedes',{method:'POST',body:JSON.stringify({
      tipo_doc:document.getElementById('nh-tipo-doc').value, nro_doc:document.getElementById('nh-nro-doc').value,
      nombres:document.getElementById('nh-nombres').value, apellidos:document.getElementById('nh-apellidos').value,
      email:document.getElementById('nh-email').value||null, telefono:document.getElementById('nh-telefono').value||null
    })});
    showToast('Huésped registrado','success');
    closeModal('modal-nuevo-huesped');
    document.getElementById('nr-huesped-id').value = h.id;
    document.getElementById('nr-huesped-info').textContent = `✅ ${h.nombres} ${h.apellidos}`;
    document.getElementById('nr-doc').value = h.nro_doc;
    openModal('modal-nueva-reserva');
  } catch(err) { errEl.textContent=err.message; errEl.classList.remove('hidden'); }
}

// ============================================================
// CHECK-IN
// ============================================================

async function renderCheckin() {
  document.getElementById('content-area').innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3 class="card-title">📋 Llegadas Pendientes Hoy</h3></div>
      <div class="card-body" id="llegadas-list"><p>Cargando...</p></div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">⚡ Check-in Rápido (Sin Reserva)</h3></div>
      <div class="card-body">
        <form onsubmit="submitCheckinRapido(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Buscar Huésped</label>
              <div style="display:flex;gap:8px">
                <input type="text" id="ci-doc" class="form-input" placeholder="N° documento" style="flex:1">
                <button type="button" class="btn btn-secondary btn-sm" onclick="buscarHuespedCheckin()">Buscar</button>
              </div>
              <input type="hidden" id="ci-huesped-id">
              <div id="ci-huesped-info" style="font-size:12px;margin-top:4px;"></div>
            </div>
            <div class="form-group">
              <label>Habitación</label>
              <select id="ci-habitacion" class="form-input"><option value="">Selecciona...</option></select>
            </div>
          </div>
          <button type="submit" class="btn btn-success">✅ Realizar Check-in</button>
        </form>
      </div>
    </div>`;

  try {
    const llegadas = await apiCall('/reservas/hoy/llegadas');
    const c = document.getElementById('llegadas-list');
    if (!llegadas?.length) {
      c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No hay llegadas pendientes hoy</h3></div>`;
    } else {
      c.innerHTML = `<div class="table-container"><table>
        <thead><tr><th>Huésped</th><th>Habitación</th><th>Check-out</th><th>Notas</th><th>Acción</th></tr></thead>
        <tbody>${llegadas.map(r=>`<tr>
          <td><div style="font-weight:600;">${r.huespedes?.nombres} ${r.huespedes?.apellidos}</div><div style="font-size:11px;color:var(--gray-500)">${r.huespedes?.nro_doc}</div></td>
          <td><strong>Hab. ${r.habitaciones?.numero}</strong><br><small>${r.habitaciones?.tipos_habitacion?.nombre||''}</small></td>
          <td>${formatDate(r.fecha_checkout)}</td>
          <td style="font-size:12px;">${r.notas||'-'}</td>
          <td><button class="btn btn-success btn-sm" onclick="confirmarCheckin('${r.id}')">✅ Check-in</button></td>
        </tr>`).join('')}</tbody></table></div>`;
    }
  } catch(e) {}

  try {
    const habs = await apiCall('/habitaciones?estado=disponible');
    const s = document.getElementById('ci-habitacion');
    if (s) s.innerHTML = '<option value="">Selecciona habitación</option>' +
      (habs||[]).map(h=>`<option value="${h.id}">Hab. ${h.numero} - ${h.tipos_habitacion?.nombre||''}</option>`).join('');
  } catch(e) {}
}

async function confirmarCheckin(reservaId) {
  try {
    await apiCall('/estadias/checkin',{method:'POST',body:JSON.stringify({reserva_id:reservaId})});
    showToast('Check-in realizado exitosamente','success');
    loadView('checkin');
  } catch(e) { showToast(e.message,'error'); }
}

async function buscarHuespedCheckin() {
  const doc = document.getElementById('ci-doc').value.trim();
  try {
    const h = await apiCall(`/huespedes/buscar/doc?nro_doc=${doc}`);
    document.getElementById('ci-huesped-id').value = h.id;
    document.getElementById('ci-huesped-info').textContent = `✅ ${h.nombres} ${h.apellidos}`;
    document.getElementById('ci-huesped-info').style.color='var(--success)';
  } catch {
    document.getElementById('ci-huesped-id').value='';
    document.getElementById('ci-huesped-info').textContent='❌ No encontrado';
    document.getElementById('ci-huesped-info').style.color='#c53030';
  }
}

async function submitCheckinRapido(e) {
  e.preventDefault();
  const huesped_id = document.getElementById('ci-huesped-id').value;
  const habitacion_id = document.getElementById('ci-habitacion').value;
  if (!huesped_id || !habitacion_id) { showToast('Selecciona huésped y habitación','warning'); return; }
  try {
    await apiCall('/estadias/checkin',{method:'POST',body:JSON.stringify({huesped_id,habitacion_id})});
    showToast('Check-in realizado exitosamente','success');
    loadView('estadias');
  } catch(e) { showToast(e.message,'error'); }
}

// ============================================================
// ESTADÍAS
// ============================================================

async function renderEstadias() {
  document.getElementById('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🛏️ Estadías Activas</h3></div>
      <div class="card-body" id="estadias-table"></div>
    </div>
    ${modalFolio()}${modalCheckoutSummary()}`;

  try {
    const estadias = await apiCall('/estadias?estado=activa');
    const c = document.getElementById('estadias-table');
    if (!estadias?.length) {
      c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🛏️</div><h3>No hay estadías activas</h3></div>`; return;
    }
    c.innerHTML=`<div class="table-container"><table>
      <thead><tr><th>Huésped</th><th>Habitación</th><th>Check-in</th><th>Días</th><th>Folio</th><th>Acciones</th></tr></thead>
      <tbody>${estadias.map(e=>{
        const dias=Math.ceil((Date.now()-new Date(e.checkin_real))/86400000);
        const folio=e.folios?.[0];
        return `<tr>
          <td><div style="font-weight:600;">${e.huespedes?.nombres} ${e.huespedes?.apellidos}</div><div style="font-size:11px;color:var(--gray-500)">${e.huespedes?.nro_doc||''}</div></td>
          <td><strong>Hab. ${e.habitaciones?.numero}</strong><br><small>${e.habitaciones?.tipos_habitacion?.nombre||''}</small></td>
          <td>${formatDateTime(e.checkin_real)}</td>
          <td><span class="badge badge-info">${dias} día${dias!==1?'s':''}</span></td>
          <td>${folio?`<span style="font-weight:600">S/ ${parseFloat(folio.total).toFixed(2)}</span> <span class="badge badge-${folio.estado==='abierto'?'warning':'success'}">${folio.estado}</span>`:'-'}</td>
          <td><div style="display:flex;gap:6px;">
            ${folio?`<button class="btn btn-sm btn-secondary" onclick="verFolio('${folio.id}')">Folio</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="abrirCheckoutModal('${e.id}')">Check-out</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  } catch(e) { document.getElementById('estadias-table').innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
}

async function abrirCheckoutModal(estadiaId) {
  openModal('modal-checkout-summary');
  const body = document.getElementById('checkout-summary-content');
  body.innerHTML = '<p>Cargando detalles de cuenta...</p>';

  try {
    const estadia = await apiCall(`/estadias/${estadiaId}`);
    const folios = await apiCall(`/estadias?estado=activa`);
    const activeEst = folios.find(e => e.id === estadiaId);
    const folioBrief = activeEst?.folios?.[0];
    
    if (!folioBrief) {
      body.innerHTML = '<div class="alert alert-error">No se encontró una cuenta activa para esta estadía</div>';
      return;
    }

    const folio = await apiCall(`/folios/${folioBrief.id}`);
    const cargos = folio.cargos || [];
    const total = cargos.reduce((s, c) => s + parseFloat(c.subtotal || 0), 0);

    let html = `
      <div style="margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px;">
        <h3 style="font-family:var(--font-serif);color:var(--gold);margin-bottom:4px;">🔑 Huésped: ${estadia.nombres} ${estadia.apellidos}</h3>
        <p style="font-size:13px;color:var(--gray-400);">Habitación: <strong>${estadia.habitacion_numero}</strong> · Ingreso: ${formatDateTime(estadia.checkin_real)}</p>
      </div>

      <h4 style="margin-bottom:8px;color:var(--gray-200);">📋 Detalle de Consumos y Hospedaje</h4>
      <div class="table-container" style="margin-bottom:16px;">
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${cargos.map(c => `
              <tr>
                <td>${c.descripcion}</td>
                <td>${c.cantidad}</td>
                <td>S/ ${parseFloat(c.precio_unitario).toFixed(2)}</td>
                <td><strong>S/ ${parseFloat(c.subtotal).toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;font-size:18px;font-weight:700;border:1px solid rgba(255,255,255,0.1);">
        <span style="color:var(--gray-300);">TOTAL A PAGAR</span>
        <span style="color:var(--gold);">S/ ${total.toFixed(2)}</span>
      </div>
    `;

    if (folio.estado === 'abierto') {
      html += `
        <div style="background:rgba(255,215,0,0.05);border:1px solid var(--gold);border-radius:12px;padding:16px;margin-bottom:16px;">
          <h4 style="margin-bottom:12px;color:var(--gold-light);">💳 Procesar Pago</h4>
          <form onsubmit="procesarPagoCheckout(event, '${estadiaId}', '${folio.id}', ${total})">
            <div class="form-row">
              <div class="form-group">
                <label>Método de Pago</label>
                <select id="co-metodo" class="form-input">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta de Crédito/Débito</option>
                  <option value="transferencia">🏦 Transferencia Bancaria</option>
                </select>
              </div>
              <div class="form-group">
                <label>Tipo Comprobante</label>
                <select id="co-comprobante" class="form-input">
                  <option value="boleta">🧾 Boleta</option>
                  <option value="factura">📄 Factura</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">💳 Facturar, Pagar y Cerrar Estadía</button>
          </form>
        </div>
      `;
    } else if (folio.estado === 'cerrado') {
      html += `
        <div style="background:rgba(255,215,0,0.05);border:1px solid var(--gold);border-radius:12px;padding:16px;margin-bottom:16px;">
          <h4 style="margin-bottom:12px;color:var(--gold-light);">💳 Registrar Pago Pendiente</h4>
          <form onsubmit="procesarPagoDirectoCheckout(event, '${estadiaId}', '${folio.id}', ${total})">
            <div class="form-group">
              <label>Método de Pago</label>
              <select id="co-metodo-directo" class="form-input">
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta de Crédito/Débito</option>
                <option value="transferencia">🏦 Transferencia Bancaria</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">💵 Registrar Pago y Cerrar Estadía</button>
          </form>
        </div>
      `;
    } else {
      html += `
        <div class="alert alert-success" style="margin-bottom:16px;">
          ✓ Esta cuenta ya se encuentra totalmente pagada.
        </div>
        <button class="btn btn-danger btn-full" onclick="confirmarCheckoutDirecto('${estadiaId}')">🚪 Realizar Check-out y desocupar habitación</button>
      `;
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-error">Error al cargar folio: ${err.message}</div>`;
  }
}

async function procesarPagoCheckout(e, estadiaId, folioId, total) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Procesando checkout...';

  try {
    const tipo = document.getElementById('co-comprobante').value;
    const metodo = document.getElementById('co-metodo').value;

    // 1. Facturar
    const factura = await apiCall(`/folios/${folioId}/facturar`, {
      method: 'POST',
      body: JSON.stringify({ tipo })
    });

    // 2. Registrar pago
    await apiCall(`/folios/${folioId}/pagar`, {
      method: 'POST',
      body: JSON.stringify({
        factura_id: factura.id,
        metodo_nombre: metodo,
        monto: total
      })
    });

    // 3. Checkout estadía
    await apiCall(`/estadias/${estadiaId}/checkout`, { method: 'POST' });

    showToast('Check-out y facturación completados 🎉', 'success');
    closeModal('modal-checkout-summary');
    loadView('estadias');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '💳 Facturar, Pagar y Cerrar Estadía';
  }
}

async function procesarPagoDirectoCheckout(e, estadiaId, folioId, total) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Procesando checkout...';

  try {
    const metodo = document.getElementById('co-metodo-directo').value;
    const folio = await apiCall(`/folios/${folioId}`);
    const facturaId = folio.facturas?.[0]?.id;

    if (facturaId) {
      await apiCall(`/folios/${folioId}/pagar`, {
        method: 'POST',
        body: JSON.stringify({
          factura_id: facturaId,
          metodo_nombre: metodo,
          monto: total
        })
      });
    }

    await apiCall(`/estadias/${estadiaId}/checkout`, { method: 'POST' });

    showToast('Pago registrado y Check-out completado 🎉', 'success');
    closeModal('modal-checkout-summary');
    loadView('estadias');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '💵 Registrar Pago y Cerrar Estadía';
  }
}

async function confirmarCheckoutDirecto(estadiaId) {
  try {
    await apiCall(`/estadias/${estadiaId}/checkout`, { method: 'POST' });
    showToast('Check-out realizado. Habitación en limpieza.', 'success');
    closeModal('modal-checkout-summary');
    loadView('estadias');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function modalCheckoutSummary() {
  return `<div id="modal-checkout-summary" class="modal-overlay hidden">
    <div class="modal glass-card" style="max-width:550px;">
      <div class="modal-header"><h2>🚪 Resumen de Check-Out</h2><button class="btn-close" onclick="closeModal('modal-checkout-summary')">✕</button></div>
      <div class="modal-body" id="checkout-summary-content">
        <p>Cargando...</p>
      </div>
    </div>
  </div>`;
}

function modalFolio() {
  return `<div id="modal-folio" class="modal-overlay hidden">
    <div class="modal modal-lg glass-card">
      <div class="modal-header"><h2>📄 Folio de Estadía</h2><button class="btn-close" onclick="closeModal('modal-folio')">✕</button></div>
      <div class="modal-body" id="folio-content"><p>Cargando...</p></div>
    </div>
  </div>`;
}

async function verFolio(folioId) {
  openModal('modal-folio');
  try {
    const folio = await apiCall(`/folios/${folioId}`);
    const cargos = folio.cargos || [];
    const subtotal = cargos.reduce((s,c)=>s+parseFloat(c.subtotal||0),0);
    document.getElementById('folio-content').innerHTML = `
      <div style="margin-bottom:16px;">
        <h3 style="font-family:var(--font-serif)">${folio.huespedes?.nombres} ${folio.huespedes?.apellidos}</h3>
        <p style="color:var(--gray-500);font-size:13px;">Hab. ${folio.estadias?.habitaciones?.numero} · ${folio.estadias?.habitaciones?.tipos_habitacion?.nombre||''}</p>
      </div>
      <div class="table-container" style="margin-bottom:16px;">
        <table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
        <tbody>${cargos.map(c=>`<tr>
          <td>${c.descripcion}</td><td>${c.cantidad}</td>
          <td>S/ ${parseFloat(c.precio_unitario).toFixed(2)}</td>
          <td><strong>S/ ${parseFloat(c.subtotal).toFixed(2)}</strong></td>
          <td>${folio.estado==='abierto'?`<button class="btn-icon" style="background:#fed7d7;color:#c53030;" onclick="eliminarCargo('${folioId}','${c.id}')">🗑️</button>`:''}</td>
        </tr>`).join('')}</tbody></table>
      </div>
      <div style="background:var(--gray-100);padding:16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;">
        <span>TOTAL</span><span>S/ ${subtotal.toFixed(2)}</span>
      </div>
      ${folio.estado==='abierto'?`
        <div style="background:white;border:1px solid var(--gray-200);border-radius:12px;padding:16px;margin-bottom:16px;">
          <h4 style="margin-bottom:12px;">➕ Agregar Cargo</h4>
          <form onsubmit="agregarCargo(event,'${folioId}')">
            <div class="form-row">
              <div class="form-group"><label>Descripción *</label><input type="text" id="ac-desc" class="form-input" required placeholder="Ej: Room service"></div>
              <div class="form-group"><label>Tipo</label><select id="ac-tipo" class="form-input"><option value="consumo">Consumo</option><option value="hospedaje">Hospedaje</option><option value="extra">Extra</option></select></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Cantidad</label><input type="number" id="ac-cantidad" class="form-input" value="1" min="0.1" step="0.1"></div>
              <div class="form-group"><label>Precio Unitario *</label><input type="number" id="ac-precio" class="form-input" required min="0" step="0.01"></div>
            </div>
            <button type="submit" class="btn btn-primary">➕ Agregar</button>
          </form>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-primary btn-full" onclick="facturar('${folioId}','boleta')">🧾 Boleta</button>
          <button class="btn btn-secondary" onclick="facturar('${folioId}','factura')">📄 Factura</button>
        </div>`:`<div class="alert alert-success">Folio ${folio.estado}. ${folio.facturas?.[0]?.nro_comprobante?'Comprobante: '+folio.facturas[0].nro_comprobante:''}</div>`}`;
  } catch(e) { document.getElementById('folio-content').innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
}

async function agregarCargo(e,folioId) {
  e.preventDefault();
  try {
    await apiCall(`/folios/${folioId}/cargos`,{method:'POST',body:JSON.stringify({
      descripcion:document.getElementById('ac-desc').value,
      tipo:document.getElementById('ac-tipo').value,
      cantidad:parseFloat(document.getElementById('ac-cantidad').value),
      precio_unitario:parseFloat(document.getElementById('ac-precio').value)
    })});
    showToast('Cargo agregado','success');
    verFolio(folioId);
  } catch(e) { showToast(e.message,'error'); }
}

async function eliminarCargo(folioId,cargoId) {
  if (!confirm('¿Eliminar cargo?')) return;
  try {
    await apiCall(`/folios/${folioId}/cargos/${cargoId}`,{method:'DELETE'});
    showToast('Cargo eliminado','info');
    verFolio(folioId);
  } catch(e) { showToast(e.message,'error'); }
}

async function facturar(folioId,tipo) {
  try {
    const factura = await apiCall(`/folios/${folioId}/facturar`,{method:'POST',body:JSON.stringify({tipo})});
    // Auto pago con efectivo
    await apiCall(`/folios/${folioId}/pagar`,{method:'POST',body:JSON.stringify({factura_id:factura.id,metodo_nombre:'efectivo',monto:factura.total})}).catch(()=>{});
    showToast(`Comprobante ${factura.nro_comprobante} — S/ ${factura.total}`,'success');
    verFolio(folioId);
  } catch(e) { showToast(e.message,'error'); }
}

// ============================================================
// HUÉSPEDES
// ============================================================

async function renderHuespedes() {
  document.getElementById('content-area').innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left"><input type="text" class="search-input" id="h-search" placeholder="🔍 Buscar..." oninput="filtrarHuespedes()" style="max-width:400px;flex:1;"></div>
      <div class="toolbar-right"><button class="btn btn-primary" onclick="openModal('modal-nuevo-huesped-2')">+ Nuevo Huésped</button></div>
    </div>
    <div class="card"><div class="card-body" id="huespedes-table"></div></div>
    ${modalNuevoHuespedV2()}`;
  await cargarHuespedes();
}

let todosHuespedes=[];
async function cargarHuespedes() {
  try {
    const data = await apiCall('/huespedes?limit=100');
    todosHuespedes = Array.isArray(data)?data:[];
    renderTablaHuespedes(todosHuespedes);
  } catch(e) { document.getElementById('huespedes-table').innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
}

function filtrarHuespedes() {
  const q=(document.getElementById('h-search')?.value||'').toLowerCase();
  renderTablaHuespedes(todosHuespedes.filter(h=>`${h.nombres} ${h.apellidos} ${h.nro_doc} ${h.email||''}`.toLowerCase().includes(q)));
}

function renderTablaHuespedes(huespedes) {
  const c=document.getElementById('huespedes-table');
  if (!huespedes?.length){c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No hay huéspedes</h3></div>`;return;}
  c.innerHTML=`<div class="table-container"><table>
    <thead><tr><th>Nombre</th><th>Documento</th><th>Email</th><th>Teléfono</th><th>Nacionalidad</th><th>Registrado</th></tr></thead>
    <tbody>${huespedes.map(h=>`<tr>
      <td><div style="font-weight:600;">${h.nombres} ${h.apellidos}</div></td>
      <td><span class="badge badge-gray">${h.tipo_doc}</span> ${h.nro_doc}</td>
      <td>${h.email||'-'}</td><td>${h.telefono||'-'}</td><td>${h.nacionalidad||'-'}</td>
      <td style="font-size:12px;">${formatDate(h.created_at)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function modalNuevoHuespedV2() {
  return `<div id="modal-nuevo-huesped-2" class="modal-overlay hidden">
    <div class="modal glass-card">
      <div class="modal-header"><h2>Nuevo Huésped</h2><button class="btn-close" onclick="closeModal('modal-nuevo-huesped-2')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitHuesped2(event)">
          <div class="form-row">
            <div class="form-group"><label>Tipo Doc</label><select id="h2-tipo-doc" class="form-input"><option value="DNI">DNI</option><option value="Pasaporte">Pasaporte</option><option value="CE">CE</option><option value="RUC">RUC</option></select></div>
            <div class="form-group"><label>N° Documento *</label><input type="text" id="h2-nro-doc" class="form-input" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Nombres *</label><input type="text" id="h2-nombres" class="form-input" required></div>
            <div class="form-group"><label>Apellidos *</label><input type="text" id="h2-apellidos" class="form-input" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" id="h2-email" class="form-input"></div>
            <div class="form-group"><label>Teléfono</label><input type="tel" id="h2-telefono" class="form-input"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Nacionalidad</label><input type="text" id="h2-nacionalidad" class="form-input" value="Peruana"></div>
            <div class="form-group"><label>Fecha Nacimiento</label><input type="date" id="h2-nacimiento" class="form-input"></div>
          </div>
          <div id="h2-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Registrar</button>
        </form>
      </div>
    </div>
  </div>`;
}

async function submitHuesped2(e) {
  e.preventDefault();
  const errEl=document.getElementById('h2-error');
  errEl.classList.add('hidden');
  try {
    await apiCall('/huespedes',{method:'POST',body:JSON.stringify({
      tipo_doc:document.getElementById('h2-tipo-doc').value,
      nro_doc:document.getElementById('h2-nro-doc').value,
      nombres:document.getElementById('h2-nombres').value,
      apellidos:document.getElementById('h2-apellidos').value,
      email:document.getElementById('h2-email').value||null,
      telefono:document.getElementById('h2-telefono').value||null,
      nacionalidad:document.getElementById('h2-nacionalidad').value,
      fecha_nacimiento:document.getElementById('h2-nacimiento').value||null
    })});
    showToast('Huésped registrado','success');
    closeModal('modal-nuevo-huesped-2');
    cargarHuespedes();
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

// ============================================================
// HABITACIONES
// ============================================================

async function renderHabitaciones() {
  document.getElementById('content-area').innerHTML = `
    <div class="tabs" id="habs-tabs">
      <button class="tab active" onclick="switchHabTab('grid',this)">🏠 Mapa Visual</button>
      <button class="tab" onclick="switchHabTab('tabla',this)">📋 Lista</button>
    </div>
    <div id="habs-view-grid"><div class="card"><div class="card-header"><h3 class="card-title">Estado de Habitaciones</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;">
        <span class="badge badge-success">● Disponible</span>
        <span class="badge badge-error">● Ocupada</span>
        <span class="badge badge-warning">● Limpieza</span>
        <span class="badge badge-info">● Mantenimiento</span>
      </div></div><div class="card-body" id="habs-grid-content"></div></div></div>
    <div id="habs-view-tabla" class="hidden">
      <div class="toolbar">
        <div class="toolbar-left"><select class="form-input" id="habs-filtro-estado" onchange="filtrarHabitacionesTabla()" style="width:auto;"><option value="">Todos los estados</option><option value="disponible">Disponible</option><option value="ocupada">Ocupada</option><option value="limpieza">Limpieza</option><option value="mantenimiento">Mantenimiento</option></select></div>
        <div class="toolbar-right"><button class="btn btn-primary" onclick="openModal('modal-nueva-hab')">+ Nueva Hab.</button></div>
      </div>
      <div class="card"><div class="card-body" id="habs-tabla-content"></div></div>
    </div>
    ${modalNuevaHabitacion()}${modalCambiarEstado()}`;
  await cargarHabitaciones();
}

let todasHabs=[];
async function cargarHabitaciones() {
  try {
    todasHabs=await apiCall('/habitaciones');
    renderHabsGrid(todasHabs);
    renderTablaHabitaciones(todasHabs);
  } catch(e) {}
}

function switchHabTab(tab,btn) {
  document.querySelectorAll('#habs-tabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('habs-view-grid').classList.toggle('hidden',tab!=='grid');
  document.getElementById('habs-view-tabla').classList.toggle('hidden',tab!=='tabla');
}

function renderHabsGrid(habs) {
  const c=document.getElementById('habs-grid-content');
  if(!c)return;
  const pisos={};
  habs.forEach(h=>{if(!pisos[h.piso])pisos[h.piso]=[];pisos[h.piso].push(h);});
  c.innerHTML=Object.entries(pisos).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([piso,hs])=>`
    <div style="margin-bottom:24px;">
      <h4 style="margin-bottom:12px;color:var(--gray-600);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Piso ${piso}</h4>
      <div class="rooms-status-grid">
        ${hs.map(h=>`<div class="room-status-card ${h.estado}" onclick="abrirCambiarEstado('${h.id}','${h.numero}','${h.estado}')" title="${h.tipos_habitacion?.nombre||h.tipo_nombre||''}">
          <span class="room-num">${h.numero}</span>
          <span style="font-size:10px;">${iconEstadoHab(h.estado)}</span>
          <span style="font-size:9px;text-align:center;">${h.tipos_habitacion?.nombre||h.tipo_nombre||''}</span>
        </div>`).join('')}
      </div>
    </div>`).join('');
}

function filtrarHabitacionesTabla() {
  const e=document.getElementById('habs-filtro-estado')?.value;
  renderTablaHabitaciones(e?todasHabs.filter(h=>h.estado===e):todasHabs);
}

function renderTablaHabitaciones(habs) {
  const c=document.getElementById('habs-tabla-content');
  if(!c)return;
  c.innerHTML=`<div class="table-container"><table>
    <thead><tr><th>N°</th><th>Piso</th><th>Tipo</th><th>Estado</th><th>Precio/Noche</th><th>Acciones</th></tr></thead>
    <tbody>${habs.map(h=>`<tr>
      <td><strong>${h.numero}</strong></td><td>${h.piso}</td>
      <td>${h.tipos_habitacion?.nombre||h.tipo_nombre||'-'}</td>
      <td><span class="badge badge-${{disponible:'success',ocupada:'error',limpieza:'warning',mantenimiento:'info'}[h.estado]||'gray'}">${h.estado}</span></td>
      <td>S/ ${parseFloat(h.tipos_habitacion?.precio_base||h.precio_base||0).toFixed(2)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="abrirCambiarEstado('${h.id}','${h.numero}','${h.estado}')">Cambiar Estado</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function modalNuevaHabitacion() {
  return `<div id="modal-nueva-hab" class="modal-overlay hidden">
    <div class="modal glass-card">
      <div class="modal-header"><h2>Nueva Habitación</h2><button class="btn-close" onclick="closeModal('modal-nueva-hab')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitNuevaHab(event)">
          <div class="form-row">
            <div class="form-group"><label>N° Habitación *</label><input type="text" id="nh2-numero" class="form-input" required placeholder="101"></div>
            <div class="form-group"><label>Piso</label><input type="number" id="nh2-piso" class="form-input" value="1" min="1"></div>
          </div>
          <div class="form-group"><label>Tipo *</label><select id="nh2-tipo" class="form-input" required></select></div>
          <div class="form-group"><label>Descripción</label><textarea id="nh2-desc" class="form-input" rows="2"></textarea></div>
          <div id="nh2-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Crear Habitación</button>
        </form>
      </div>
    </div>
  </div>`;
}

function modalCambiarEstado() {
  return `<div id="modal-cambiar-estado" class="modal-overlay hidden">
    <div class="modal glass-card" style="max-width:450px;">
      <div class="modal-header"><h2>Cambiar Estado — Hab. <span id="ce-numero"></span></h2><button class="btn-close" onclick="closeModal('modal-cambiar-estado')">✕</button></div>
      <div class="modal-body">
        <input type="hidden" id="ce-hab-id">
        <div class="form-group"><label>Nuevo Estado</label>
          <select id="ce-estado" class="form-input" onchange="toggleOcupadaGuestForm()">
            <option value="disponible">✅ Disponible</option>
            <option value="ocupada">🔴 Ocupada (Hacer Check-In)</option>
            <option value="limpieza">🧹 En Limpieza</option>
            <option value="mantenimiento">🔧 Mantenimiento</option>
            <option value="fuera_de_servicio">⛔ Fuera de Servicio</option>
          </select>
        </div>
        <div class="form-group"><label>Notas</label><textarea id="ce-notas" class="form-input" rows="1"></textarea></div>

        <!-- FORMULARIO DE HUÉSPED DINÁMICO PARA CHECK-IN -->
        <div id="ce-ocupada-form" class="hidden" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px;">
          <h4 style="margin-bottom:12px; color:var(--gold-light); font-size:14px;">📋 Datos del Huésped Ocupante</h4>
          
          <!-- Buscar huésped por DNI/Documento -->
          <div class="form-group">
            <label style="font-size:11px;">Buscar por DNI / Documento</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="ce-huesped-buscar-doc" class="form-input" placeholder="N° de documento" style="flex:1;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="buscarHuespedEstadoModal()" style="padding:6px 12px;">🔍 Buscar</button>
            </div>
            <div id="ce-huesped-buscar-feedback" style="font-size:12px; margin-top:4px; font-weight:600;"></div>
            <input type="hidden" id="ce-huesped-id">
            <input type="hidden" id="ce-huesped-cliente-id">
          </div>

          <!-- Campos para ingresar/editar datos del huésped -->
          <div class="form-row">
            <div class="form-group">
              <label style="font-size:11px;">Nombres *</label>
              <input type="text" id="ce-huesped-nombres" class="form-input" placeholder="Nombres">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Apellidos *</label>
              <input type="text" id="ce-huesped-apellidos" class="form-input" placeholder="Apellidos">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label style="font-size:11px;">Tipo Documento</label>
              <select id="ce-huesped-tipo-doc" class="form-input">
                <option value="DNI">DNI</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="CE">C. Extranjería</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Nro Documento *</label>
              <input type="text" id="ce-huesped-nro-doc" class="form-input" placeholder="12345678">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label style="font-size:11px;">Teléfono</label>
              <input type="text" id="ce-huesped-telefono" class="form-input" placeholder="+51 ...">
            </div>
            <div class="form-group">
              <label style="font-size:11px;">Nacionalidad</label>
              <input type="text" id="ce-huesped-nacionalidad" class="form-input" value="Peruana">
            </div>
          </div>

          <div class="form-group">
            <label style="font-size:11px;">Email</label>
            <input type="email" id="ce-huesped-email" class="form-input" placeholder="correo@ejemplo.com">
          </div>
        </div>

        <button class="btn btn-primary btn-full" id="btn-save-estado" onclick="submitCambiarEstado()" style="margin-top:16px;">💾 Guardar Estado</button>
      </div>
    </div>
  </div>`;
}

function toggleOcupadaGuestForm() {
  const estado = document.getElementById('ce-estado').value;
  const formSection = document.getElementById('ce-ocupada-form');
  if (estado === 'ocupada') {
    formSection?.classList.remove('hidden');
  } else {
    formSection?.classList.add('hidden');
  }
}

function abrirCambiarEstado(habId,numero,estadoActual) {
  document.getElementById('ce-hab-id').value=habId;
  document.getElementById('ce-numero').textContent=numero;
  document.getElementById('ce-estado').value=estadoActual;
  document.getElementById('ce-notes').value='';
  
  // Limpiar campos de huésped
  document.getElementById('ce-huesped-id').value = '';
  document.getElementById('ce-huesped-cliente-id').value = '';
  document.getElementById('ce-huesped-buscar-doc').value = '';
  document.getElementById('ce-huesped-buscar-feedback').textContent = '';
  document.getElementById('ce-huesped-nombres').value = '';
  document.getElementById('ce-huesped-apellidos').value = '';
  document.getElementById('ce-huesped-tipo-doc').value = 'DNI';
  document.getElementById('ce-huesped-nro-doc').value = '';
  document.getElementById('ce-huesped-telefono').value = '';
  document.getElementById('ce-huesped-nacionalidad').value = 'Peruana';
  document.getElementById('ce-huesped-email').value = '';

  toggleOcupadaGuestForm();
  openModal('modal-cambiar-estado');
}

async function buscarHuespedEstadoModal() {
  const docInput = document.getElementById('ce-huesped-buscar-doc').value.trim();
  const feedback = document.getElementById('ce-huesped-buscar-feedback');
  if (!docInput) { showToast('Ingresa un documento para buscar', 'warning'); return; }

  feedback.textContent = 'Buscando...';
  feedback.style.color = '#ffffff';

  try {
    const h = await apiCall(`/huespedes/buscar/doc?nro_doc=${docInput}`);
    document.getElementById('ce-huesped-id').value = h.id || '';
    document.getElementById('ce-huesped-cliente-id').value = h.cliente_id || '';
    document.getElementById('ce-huesped-nombres').value = h.nombres || '';
    document.getElementById('ce-huesped-apellidos').value = h.apellidos || '';
    document.getElementById('ce-huesped-tipo-doc').value = h.tipo_doc || 'DNI';
    document.getElementById('ce-huesped-nro-doc').value = h.nro_doc || '';
    document.getElementById('ce-huesped-telefono').value = h.telefono || '';
    document.getElementById('ce-huesped-nacionalidad').value = h.nacionalidad || 'Peruana';
    document.getElementById('ce-huesped-email').value = h.email || '';

    if (h.id) {
      feedback.textContent = `✅ Huésped encontrado: ${h.nombres} ${h.apellidos}`;
      feedback.style.color = 'var(--success)';
    } else {
      feedback.textContent = `👤 Cliente encontrado (sin historial de huésped): ${h.nombres} ${h.apellidos}. Datos auto-completados.`;
      feedback.style.color = 'var(--gold-light)';
    }
  } catch (err) {
    document.getElementById('ce-huesped-id').value = '';
    document.getElementById('ce-huesped-cliente-id').value = '';
    // Auto-completar el DNI en los campos para facilitarle el registro al recepcionista
    document.getElementById('ce-huesped-nro-doc').value = docInput;
    feedback.textContent = '❌ Huésped no encontrado. Completa los campos abajo para crearlo.';
    feedback.style.color = '#e53e3e';
  }
}

async function submitCambiarEstado() {
  const habId=document.getElementById('ce-hab-id').value;
  const estado=document.getElementById('ce-estado').value;
  const notas=document.getElementById('ce-notas').value;
  const btn = document.getElementById('btn-save-estado');

  try {
    if (estado === 'ocupada') {
      let huespedId = document.getElementById('ce-huesped-id').value;
      const clienteId = document.getElementById('ce-huesped-cliente-id').value;
      const nombres = document.getElementById('ce-huesped-nombres').value.trim();
      const apellidos = document.getElementById('ce-huesped-apellidos').value.trim();
      const nroDoc = document.getElementById('ce-huesped-nro-doc').value.trim();
      const tipoDoc = document.getElementById('ce-huesped-tipo-doc').value;
      const telefono = document.getElementById('ce-huesped-telefono').value.trim();
      const nacionalidad = document.getElementById('ce-huesped-nacionalidad').value.trim();
      const email = document.getElementById('ce-huesped-email').value.trim();

      if (!huespedId) {
        if (!nombres || !apellidos || !nroDoc) {
          showToast('Nombres, apellidos y Nro de documento son requeridos para ocupar la habitación', 'warning');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Creando huésped y registrando check-in...';

        // 1. Crear o actualizar huésped
        const h = await apiCall('/huespedes', {
          method: 'POST',
          body: JSON.stringify({
            tipo_doc: tipoDoc,
            nro_doc: nroDoc,
            nombres,
            apellidos,
            telefono: telefono || undefined,
            nacionalidad,
            email: email || undefined,
            cliente_id: clienteId || undefined
          })
        });
        huespedId = h.id;
      }

      // 2. Realizar Check-in rápido
      await apiCall('/estadias/checkin', {
        method: 'POST',
        body: JSON.stringify({
          huesped_id: huespedId,
          habitacion_id: habId
        })
      });
      showToast('Habitación ocupada y Check-in registrado exitosamente 🎉', 'success');
    } else {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      // Cambiar estado estándar
      await apiCall(`/habitaciones/${habId}/estado`,{method:'PATCH',body:JSON.stringify({estado,notas})});
      showToast(`Estado actualizado: ${estado}`,'success');
    }

    closeModal('modal-cambiar-estado');
    cargarHabitaciones();
  } catch(e) {
    showToast(e.message,'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Estado';
  }
}

async function submitNuevaHab(e) {
  e.preventDefault();
  const errEl=document.getElementById('nh2-error');
  errEl.classList.add('hidden');
  try {
    // Cargar tipos si está vacío
    const select=document.getElementById('nh2-tipo');
    if(!select.options.length||!select.value) {
      const tipos=await apiCall('/habitaciones/tipos/list');
      select.innerHTML=tipos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
    }
    await apiCall('/habitaciones',{method:'POST',body:JSON.stringify({
      numero:document.getElementById('nh2-numero').value,
      piso:parseInt(document.getElementById('nh2-piso').value),
      tipo_id:select.value, descripcion:document.getElementById('nh2-desc').value
    })});
    showToast('Habitación creada','success');
    closeModal('modal-nueva-hab');
    cargarHabitaciones();
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

// ============================================================
// INVENTARIO
// ============================================================

async function renderInventario() {
  document.getElementById('content-area').innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="switchInvTab('productos',this)">📦 Productos</button>
      <button class="tab" onclick="switchInvTab('alertas',this)">⚠️ Alertas Stock</button>
    </div>
    <div id="inv-tab-productos">
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="search-input" id="inv-search" placeholder="🔍 Buscar..." oninput="filtrarProductos()">
          <select class="form-input" id="inv-categoria" onchange="filtrarProductos()" style="width:auto;">
            <option value="">Todas las categorías</option>
            <option value="bebida">Bebida</option><option value="alimento">Alimento</option>
            <option value="servicio">Servicio</option><option value="insumo">Insumo</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="openModal('modal-nuevo-producto')">+ Producto</button>
          <button class="btn btn-secondary" onclick="abrirModalMovimiento()">📥 Movimiento</button>
        </div>
      </div>
      <div class="card"><div class="card-body" id="productos-table"></div></div>
    </div>
    <div id="inv-tab-alertas" class="hidden"><div class="card"><div class="card-body" id="alertas-content"></div></div></div>
    ${modalNuevoProducto()}${modalMovimiento()}`;
  await cargarProductos();
  await cargarAlertas();
}

let todosProductos=[];
async function cargarProductos() {
  try {
    todosProductos=await apiCall('/inventario/productos');
    renderTablaProductos(todosProductos);
  } catch(e){}
}

async function cargarAlertas() {
  try {
    const alertas=await apiCall('/inventario/alertas');
    const c=document.getElementById('alertas-content');
    if(!c)return;
    if(!alertas?.length){c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">✅</div><h3>Sin alertas de stock</h3></div>`;return;}
    c.innerHTML=`<div class="alert alert-warning">⚠️ ${alertas.length} producto(s) con stock bajo</div>
      <div class="table-container"><table>
        <thead><tr><th>Producto</th><th>Categoría</th><th>Stock Actual</th><th>Stock Mínimo</th></tr></thead>
        <tbody>${alertas.map(p=>`<tr>
          <td><strong>${p.nombre}</strong></td>
          <td><span class="badge badge-gray">${p.categoria}</span></td>
          <td><span style="color:#c53030;font-weight:700;">${p.stock_actual}</span></td>
          <td>${p.stock_minimo}</td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch(e){}
}

function filtrarProductos() {
  const q=(document.getElementById('inv-search')?.value||'').toLowerCase();
  const cat=document.getElementById('inv-categoria')?.value||'';
  renderTablaProductos(todosProductos.filter(p=>(!q||p.nombre.toLowerCase().includes(q))&&(!cat||p.categoria===cat)));
}

function renderTablaProductos(productos) {
  const c=document.getElementById('productos-table');
  if(!c)return;
  c.innerHTML=`<div class="table-container"><table>
    <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Stock Mín.</th><th>Unidad</th></tr></thead>
    <tbody>${productos.map(p=>`<tr>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-gray">${p.categoria}</span></td>
      <td>S/ ${parseFloat(p.precio||0).toFixed(2)}</td>
      <td><span style="font-weight:700;color:${p.stock_actual<=p.stock_minimo?'#c53030':'#276749'}">${p.stock_actual}</span></td>
      <td>${p.stock_minimo}</td>
      <td>${p.unidad}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function switchInvTab(tab,btn) {
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  ['productos','alertas'].forEach(t=>document.getElementById(`inv-tab-${t}`)?.classList.toggle('hidden',t!==tab));
}

function modalNuevoProducto() {
  return `<div id="modal-nuevo-producto" class="modal-overlay hidden">
    <div class="modal glass-card">
      <div class="modal-header"><h2>Nuevo Producto</h2><button class="btn-close" onclick="closeModal('modal-nuevo-producto')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitNuevoProducto(event)">
          <div class="form-row">
            <div class="form-group"><label>Nombre *</label><input type="text" id="np-nombre" class="form-input" required></div>
            <div class="form-group"><label>Categoría *</label><select id="np-categoria" class="form-input"><option value="bebida">Bebida</option><option value="alimento">Alimento</option><option value="servicio">Servicio</option><option value="insumo">Insumo</option><option value="otro">Otro</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Precio</label><input type="number" id="np-precio" class="form-input" value="0" min="0" step="0.01"></div>
            <div class="form-group"><label>Unidad</label><input type="text" id="np-unidad" class="form-input" value="und"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Stock Inicial</label><input type="number" id="np-stock" class="form-input" value="0" min="0"></div>
            <div class="form-group"><label>Stock Mínimo</label><input type="number" id="np-stock-min" class="form-input" value="5" min="0"></div>
          </div>
          <div id="np-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Crear Producto</button>
        </form>
      </div>
    </div>
  </div>`;
}

function modalMovimiento() {
  return `<div id="modal-movimiento" class="modal-overlay hidden">
    <div class="modal glass-card" style="max-width:450px;">
      <div class="modal-header"><h2>Registrar Movimiento</h2><button class="btn-close" onclick="closeModal('modal-movimiento')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitMovimiento(event)">
          <div class="form-group"><label>Producto *</label><select id="mov-producto" class="form-input" required><option value="">Seleccionar...</option></select></div>
          <div class="form-row">
            <div class="form-group"><label>Tipo *</label><select id="mov-tipo" class="form-input"><option value="entrada">📥 Entrada</option><option value="salida">📤 Salida</option><option value="merma">💧 Merma</option></select></div>
            <div class="form-group"><label>Cantidad *</label><input type="number" id="mov-cantidad" class="form-input" required min="1"></div>
          </div>
          <div class="form-group"><label>Motivo</label><input type="text" id="mov-motivo" class="form-input"></div>
          <div id="mov-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Registrar</button>
        </form>
      </div>
    </div>
  </div>`;
}

async function abrirModalMovimiento() {
  const select=document.getElementById('mov-producto');
  if(select&&select.options.length<=1){
    try {
      const productos=await apiCall('/inventario/productos');
      select.innerHTML='<option value="">Seleccionar...</option>'+(productos||[]).filter(p=>p.categoria!=='servicio').map(p=>`<option value="${p.id}">${p.nombre} (stock:${p.stock_actual})</option>`).join('');
    } catch(e){}
  }
  openModal('modal-movimiento');
}

async function submitNuevoProducto(e) {
  e.preventDefault();
  const errEl=document.getElementById('np-error');
  errEl.classList.add('hidden');
  try {
    await apiCall('/inventario/productos',{method:'POST',body:JSON.stringify({
      nombre:document.getElementById('np-nombre').value, categoria:document.getElementById('np-categoria').value,
      precio:parseFloat(document.getElementById('np-precio').value), stock_actual:parseInt(document.getElementById('np-stock').value),
      stock_minimo:parseInt(document.getElementById('np-stock-min').value), unidad:document.getElementById('np-unidad').value
    })});
    showToast('Producto creado','success');
    closeModal('modal-nuevo-producto');
    cargarProductos();
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

async function submitMovimiento(e) {
  e.preventDefault();
  const errEl=document.getElementById('mov-error');
  errEl.classList.add('hidden');
  try {
    await apiCall('/inventario/movimientos',{method:'POST',body:JSON.stringify({
      producto_id:document.getElementById('mov-producto').value,
      tipo:document.getElementById('mov-tipo').value,
      cantidad:parseInt(document.getElementById('mov-cantidad').value),
      motivo:document.getElementById('mov-motivo').value
    })});
    showToast('Movimiento registrado','success');
    closeModal('modal-movimiento');
    cargarProductos();
    cargarAlertas();
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

// ============================================================
// REPORTES
// ============================================================

async function renderReportes() {
  const desde=new Date(Date.now()-30*86400000).toISOString().split('T')[0];
  const hoy=new Date().toISOString().split('T')[0];
  document.getElementById('content-area').innerHTML=`
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3 class="card-title">📊 Filtros</h3></div>
      <div class="card-body">
        <div class="form-row" style="max-width:500px;">
          <div class="form-group"><label>Desde</label><input type="date" id="rep-desde" class="form-input" value="${desde}"></div>
          <div class="form-group"><label>Hasta</label><input type="date" id="rep-hasta" class="form-input" value="${hoy}"></div>
        </div>
        <button class="btn btn-primary" onclick="cargarReportes()">📈 Generar</button>
      </div>
    </div>
    <div id="reportes-content"></div>`;
  await cargarReportes();
}

async function cargarReportes() {
  const desde=document.getElementById('rep-desde')?.value;
  const hasta=document.getElementById('rep-hasta')?.value;
  const c=document.getElementById('reportes-content');
  try {
    const [ingresos, ocupacion, top] = await Promise.all([
      apiCall(`/reportes/ingresos?desde=${desde}&hasta=${hasta}`),
      apiCall(`/reportes/ocupacion?desde=${desde}&hasta=${hasta}`),
      apiCall('/reportes/top-huespedes')
    ]);
    c.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card gold"><div class="stat-icon">💰</div><div class="stat-value">S/ ${parseFloat(ingresos.resumen?.total_facturado||0).toLocaleString('es-PE',{minimumFractionDigits:0})}</div><div class="stat-label">Total Facturado</div></div>
        <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-value">S/ ${parseFloat(ingresos.resumen?.total_pagado||0).toLocaleString('es-PE',{minimumFractionDigits:0})}</div><div class="stat-label">Total Cobrado</div></div>
        <div class="stat-card blue"><div class="stat-icon">📋</div><div class="stat-value">${ingresos.resumen?.cantidad||0}</div><div class="stat-label">Facturas</div></div>
        <div class="stat-card purple"><div class="stat-icon">🛏️</div><div class="stat-value">${ocupacion.total||0}</div><div class="stat-label">Estadías</div></div>
      </div>
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header"><h3 class="card-title">📄 Últimas Facturas</h3></div>
          <div class="card-body"><div class="table-container"><table>
            <thead><tr><th>Comprobante</th><th>Huésped</th><th>Tipo</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>${(ingresos.facturas||[]).slice(0,10).map(f=>`<tr>
              <td style="font-size:12px;">${f.nro_comprobante||'-'}</td>
              <td>${f.nombres||''} ${f.apellidos||''}</td>
              <td><span class="badge badge-gray">${f.tipo}</span></td>
              <td><strong>S/ ${parseFloat(f.total).toFixed(2)}</strong></td>
              <td><span class="badge badge-${f.estado==='pagada'?'success':'warning'}">${f.estado}</span></td>
            </tr>`).join('')}</tbody>
          </table></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">🏆 Top Huéspedes</h3></div>
          <div class="card-body">${(top||[]).slice(0,8).map((h,i)=>`
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100);">
              <div style="width:28px;height:28px;background:${i<3?'var(--gradient-gold)':'var(--gray-200)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${i<3?'var(--navy)':'var(--gray-600)'};">${i+1}</div>
              <div style="flex:1"><div style="font-weight:600;font-size:14px;">${h.nombres} ${h.apellidos}</div></div>
              <div style="font-weight:700;color:var(--gold-dark);">${h.total_reservas} reservas</div>
            </div>`).join('')}</div>
        </div>
      </div>`;
  } catch(e){c.innerHTML=`<div class="alert alert-error">Error: ${e.message}</div>`;}
}

// ============================================================
// USUARIOS
// ============================================================

async function renderUsuarios() {
  document.getElementById('content-area').innerHTML=`
    <div class="toolbar">
      <div class="toolbar-left"><h3 style="color:var(--gray-700);">Gestión de Personal</h3></div>
      <div class="toolbar-right"><button class="btn btn-primary" onclick="openModalNuevoUsuario()">+ Nuevo Usuario</button></div>
    </div>
    <div class="card"><div class="card-body" id="usuarios-table"></div></div>
    ${modalNuevoUsuario()}`;
  try {
    const usuarios=await apiCall('/usuarios');
    const c=document.getElementById('usuarios-table');
    if(!usuarios?.length){c.innerHTML=`<div class="empty-state"><h3>No hay usuarios</h3></div>`;return;}
    c.innerHTML=`<div class="table-container"><table>
      <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>${usuarios.map(u=>`<tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:var(--gradient-gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--navy);font-size:13px;">${(u.nombre||'?')[0].toUpperCase()}</div>
          <div style="font-weight:600;">${u.nombre} ${u.apellido}</div>
        </div></td>
        <td>${u.email}</td>
        <td><span class="badge badge-gold">${u.rol_nombre||'-'}</span></td>
        <td><span class="badge badge-${u.estado==='activo'?'success':'error'}">${u.estado}</span></td>
        <td style="font-size:12px;">${formatDate(u.created_at)}</td>
        <td>${u.id!==currentUser?.id?`<button class="btn btn-sm btn-outline" onclick="toggleUsuario('${u.id}','${u.estado}')">${u.estado==='activo'?'🚫 Desactivar':'✅ Activar'}</button>`:'<span style="font-size:12px;color:var(--gray-500)">Tú</span>'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e){document.getElementById('usuarios-table').innerHTML=`<div class="alert alert-error">${e.message}</div>`;}
}

function modalNuevoUsuario() {
  return `<div id="modal-nuevo-usuario" class="modal-overlay hidden">
    <div class="modal glass-card">
      <div class="modal-header"><h2>Nuevo Usuario</h2><button class="btn-close" onclick="closeModal('modal-nuevo-usuario')">✕</button></div>
      <div class="modal-body">
        <form onsubmit="submitNuevoUsuario(event)">
          <div class="form-row">
            <div class="form-group"><label>Nombres *</label><input type="text" id="nu-nombre" class="form-input" required></div>
            <div class="form-group"><label>Apellidos *</label><input type="text" id="nu-apellido" class="form-input" required></div>
          </div>
          <div class="form-group"><label>Email *</label><input type="email" id="nu-email" class="form-input" required></div>
          <div class="form-group"><label>Password * (mín. 8 caracteres)</label><input type="password" id="nu-password" class="form-input" required minlength="8"></div>
          <div class="form-group"><label>Rol *</label><select id="nu-rol" class="form-input" required></select></div>
          <div id="nu-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full">Crear Usuario</button>
        </form>
      </div>
    </div>
  </div>`;
}

async function openModalNuevoUsuario() {
  const s=document.getElementById('nu-rol');
  if(s&&s.options.length<=0){
    try{const roles=await apiCall('/usuarios/roles/list');s.innerHTML=roles.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('');}catch(e){}
  }
  openModal('modal-nuevo-usuario');
}

async function submitNuevoUsuario(e) {
  e.preventDefault();
  const errEl=document.getElementById('nu-error');
  errEl.classList.add('hidden');
  try {
    await apiCall('/usuarios',{method:'POST',body:JSON.stringify({
      nombre:document.getElementById('nu-nombre').value, apellido:document.getElementById('nu-apellido').value,
      email:document.getElementById('nu-email').value, password:document.getElementById('nu-password').value,
      rol_id:document.getElementById('nu-rol').value
    })});
    showToast('Usuario creado','success');
    closeModal('modal-nuevo-usuario');
    loadView('usuarios');
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

async function toggleUsuario(id,estadoActual) {
  const nuevoEstado=estadoActual==='activo'?'inactivo':'activo';
  if(!confirm(`¿${nuevoEstado==='inactivo'?'Desactivar':'Activar'} usuario?`))return;
  try {
    await apiCall(`/usuarios/${id}`,{method:'PUT',body:JSON.stringify({estado:nuevoEstado})});
    showToast(`Usuario ${nuevoEstado}`,nuevoEstado==='activo'?'success':'warning');
    loadView('usuarios');
  } catch(e){showToast(e.message,'error');}
}

// ============================================================
// PORTAL WEB — CLIENTES
// ============================================================

async function loadTiposHabitacion() {
  try {
    const res = await fetch(`${API}/habitaciones/tipos/list`);
    const data = await res.json();
    const grid = document.getElementById('tipos-habitacion-grid');
    if (!grid) return;
    const tipos = data.data || [];
    grid.innerHTML = tipos.map(t=>`
      <div class="room-card">
        <div class="room-image"><span>${iconTipoHab(t.nombre)}</span><div class="room-badge">⭐ Popular</div></div>
        <div class="room-body">
          <h3 class="room-name">${t.nombre}</h3>
          <p class="room-desc">${t.descripcion||'Habitación cómoda y elegante'}</p>
          <div class="room-amenities">${(t.amenidades||['WiFi','TV','Baño privado']).slice(0,4).map(a=>`<span class="amenity-tag">${a}</span>`).join('')}</div>
          <div class="room-footer">
            <div><div class="room-price">S/ ${parseFloat(t.precio_base).toFixed(0)}</div><div class="room-price-sub">por noche</div></div>
            <div class="room-capacity">👥 Hasta ${t.capacidad} pers.</div>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {}
}

function iconTipoHab(nombre) {
  return {'Simple':'🛏️','Doble':'🛏️🛏️','Suite':'👑','Familiar':'👨‍👩‍👧','Twin':'🛏️🛏️'}[nombre]||'🏠';
}

async function buscarDisponibilidad() {
  const checkin=document.getElementById('search-checkin').value;
  const checkout=document.getElementById('search-checkout').value;
  if(!checkin||!checkout){showToast('Selecciona fechas','warning');return;}
  if(new Date(checkin)>=new Date(checkout)){showToast('La fecha de salida debe ser posterior','warning');return;}
  searchDates={checkin,checkout};

  const section=document.getElementById('results-section');
  const grid=document.getElementById('rooms-results');
  section.classList.remove('hidden');
  grid.innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div>';

  try {
    const res=await fetch(`${API}/habitaciones/disponibles?fecha_checkin=${checkin}&fecha_checkout=${checkout}`);
    const data=await res.json();
    const habs=data.data||[];
    const noches=Math.ceil((new Date(checkout)-new Date(checkin))/86400000);

    if(!habs.length){
      grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">😔</div><h3>Sin disponibilidad</h3><p>Prueba otras fechas</p></div>`; return;
    }
    grid.innerHTML=habs.map(h=>`
      <div class="room-card">
        <div class="room-image"><span>${iconTipoHab(h.tipos_habitacion?.nombre)}</span><div class="room-badge">Disponible</div></div>
        <div class="room-body">
          <h3 class="room-name">Hab. ${h.numero} — ${h.tipos_habitacion?.nombre}</h3>
          <p class="room-desc">Piso ${h.piso}</p>
          <div class="room-amenities">${(h.tipos_habitacion?.amenidades||[]).slice(0,3).map(a=>`<span class="amenity-tag">${a}</span>`).join('')}</div>
          <div class="room-footer">
            <div><div class="room-price">S/ ${(parseFloat(h.tipos_habitacion?.precio_base||0)*noches).toFixed(0)}</div><div class="room-price-sub">${noches} noche${noches!==1?'s':''} · S/ ${parseFloat(h.tipos_habitacion?.precio_base||0).toFixed(0)}/noche</div></div>
            <button class="btn btn-primary" onclick="iniciarReserva('${h.id}','${h.numero}','${h.tipos_habitacion?.nombre}',${h.tipos_habitacion?.precio_base},${noches})">Reservar</button>
          </div>
        </div>
      </div>`).join('');
    section.scrollIntoView({behavior:'smooth'});
  } catch(e){grid.innerHTML=`<div class="alert alert-error">Error buscando disponibilidad</div>`;}
}

function iniciarReserva(habId,numero,tipo,precio,noches) {
  selectedHabitacion={id:habId,numero,tipo,precio,noches};
  document.getElementById('reserva-habitacion-info').innerHTML=`
    <div class="hs-icon">${iconTipoHab(tipo)}</div>
    <div>
      <h3>Hab. ${numero} — ${tipo}</h3>
      <div class="hs-detail">📅 ${formatDate(searchDates.checkin)} → ${formatDate(searchDates.checkout)} (${noches} noche${noches!==1?'s':''})</div>
      <div class="hs-price">Total: S/ ${(precio*noches).toFixed(2)}</div>
    </div>`;
  openModal('modal-reserva');
}

async function handleReservaWeb(e) {
  e.preventDefault();
  if(!selectedHabitacion)return;
  if(!clienteToken){showPage('login-page');return;}

  const errEl=document.getElementById('reserva-error');
  const succEl=document.getElementById('reserva-success');
  errEl.classList.add('hidden');
  succEl.classList.add('hidden');

  try {
    const res=await fetch(`${API}/web/reservas`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${clienteToken}`},
      body:JSON.stringify({
        habitacion_id:selectedHabitacion.id,
        fecha_checkin:searchDates.checkin,
        fecha_checkout:searchDates.checkout,
        adultos:parseInt(document.getElementById('r-adultos')?.value||1),
        ninos:parseInt(document.getElementById('r-ninos')?.value||0),
        notas:document.getElementById('r-notas')?.value||''
      })
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.message||'Error al crear reserva');
    succEl.textContent=`✅ ${data.message}`;
    succEl.classList.remove('hidden');
    document.getElementById('form-reserva-web').reset();
    setTimeout(()=>closeModal('modal-reserva'), 3000);
  } catch(err){errEl.textContent=err.message;errEl.classList.remove('hidden');}
}

// ============================================================
// CARGAR RESERVAS CLIENTE
// ============================================================

async function cargarMisReservas() {
  const container = document.getElementById('cliente-reservas-container');
  if (!container) return;

  if (!clienteToken) {
    container.innerHTML = `<div class="empty-state"><h3>Debes iniciar sesión para ver tus reservas</h3></div>`;
    return;
  }

  container.innerHTML = '<div class="empty-state"><h3>Cargando tus reservaciones...</h3></div>';

  try {
    const res = await apiClienteCall('/web/mis-reservas');
    const reservas = res.data || [];

    if (reservas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <h3>No tienes reservaciones</h3>
          <p>Busca habitaciones disponibles para reservar tu estadía.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Habitación</th>
              <th>Tipo</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Huéspedes</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${reservas.map(r => `
              <tr>
                <td><strong>Hab. ${r.habitacion_numero}</strong></td>
                <td>${r.tipo_habitacion}</td>
                <td>${formatDate(r.fecha_checkin)}</td>
                <td>${formatDate(r.fecha_checkout)}</td>
                <td>${r.adultos} Ad, ${r.ninos} Ni</td>
                <td><strong>S/ ${parseFloat(r.total_estimado).toFixed(2)}</strong></td>
                <td><span class="badge ${badgeReserva(r.estado)}">${r.estado}</span></td>
                <td>
                  ${['confirmada', 'pendiente'].includes(r.estado) ? `
                    <button class="btn btn-sm btn-danger" onclick="cancelarReservaCliente('${r.id}')">Cancelar</button>
                  ` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar reservas: ${err.message}</div>`;
  }
}

async function cancelarReservaCliente(id) {
  if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;
  try {
    const res = await fetch(`${API}/reservas/${id}/cliente/cancelar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clienteToken}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al cancelar');

    showToast('Reserva cancelada exitosamente', 'success');
    cargarMisReservas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id){document.getElementById(id)?.classList.remove('hidden');}
function closeModal(id){document.getElementById(id)?.classList.add('hidden');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay'))e.target.classList.add('hidden');});

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message,type='info') {
  const c=document.getElementById('toast-container');
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<span>${icons[type]}</span><span>${message}</span>`;
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(100%)';t.style.transition='all 0.3s ease';setTimeout(()=>t.remove(),300);},3500);
}

// ============================================================
// FORMATTERS
// ============================================================

function formatDate(d){if(!d)return'-';return new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});}
function formatDateTime(d){if(!d)return'-';return new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}

// ============================================================
// ADMINISTRACIÓN: CONFIGURACIÓN GENERAL DEL HOTEL (Habitaciones, Tarifas, Fotos)
// ============================================================

async function renderConfiguracion() {
  document.getElementById('content-area').innerHTML = `
    <div class="tabs" id="config-tabs" style="margin-bottom: 24px;">
      <button class="tab active" onclick="switchConfigTab('tipos',this)">👑 Tipos de Habitación</button>
      <button class="tab" onclick="switchConfigTab('habitaciones',this)">🏠 Habitaciones</button>
      ${currentUser && currentUser.rol === 'admin' ? `<button class="tab" onclick="switchConfigTab('hotel',this)">📞 Datos de Hotel</button>` : ''}
    </div>

    <!-- SECCIÓN TIPOS -->
    <div id="config-section-tipos">
      <div class="toolbar" style="margin-bottom: 16px;">
        <div class="toolbar-left"><h3>Modelos de Habitaciones y Tarifas</h3></div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="abrirModalTipoHab()">+ Nuevo Tipo</button>
        </div>
      </div>
      <div class="card"><div class="card-body" id="config-tipos-list">Cargando...</div></div>
    </div>

    <!-- SECCIÓN HABITACIONES -->
    <div id="config-section-habitaciones" class="hidden">
      <div class="toolbar" style="margin-bottom: 16px;">
        <div class="toolbar-left"><h3>Lista de Habitaciones Físicas</h3></div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="abrirModalConfigHab()">+ Nueva Habitación</button>
        </div>
      </div>
      <div class="card"><div class="card-body" id="config-habs-list">Cargando...</div></div>
    </div>

    <!-- SECCIÓN DATOS DE HOTEL (SOLO ADMIN) -->
    ${currentUser && currentUser.rol === 'admin' ? `
    <div id="config-section-hotel" class="hidden">
      <div class="toolbar" style="margin-bottom: 16px;">
        <div class="toolbar-left"><h3>Configuración de Datos de Contacto y Horarios</h3></div>
      </div>
      <div class="card glass-card" style="max-width: 600px;">
        <div class="card-body">
          <form id="form-config-hotel" onsubmit="guardarConfigHotel(event)">
            <div class="form-group">
              <label>Dirección física (📍)</label>
              <input type="text" id="ch-direccion" class="form-input" required placeholder="Ej: Av. Principal 123, Lima">
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Teléfono de contacto (📞)</label>
                <input type="text" id="ch-telefono" class="form-input" required placeholder="Ej: +51 1 234-5678">
              </div>
              <div class="form-group">
                <label>Correo electrónico (✉️)</label>
                <input type="email" id="ch-email" class="form-input" required placeholder="Ej: info@hotelluxe.pe">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Horario Check-in</label>
                <input type="text" id="ch-checkin" class="form-input" required placeholder="Ej: 15:00">
              </div>
              <div class="form-group">
                <label>Horario Check-out</label>
                <input type="text" id="ch-checkout" class="form-input" required placeholder="Ej: 12:00">
              </div>
            </div>

            <div class="form-group">
              <label>Horario Recepción</label>
              <input type="text" id="ch-recepcion" class="form-input" required placeholder="Ej: 24/7">
            </div>

            <div id="ch-error" class="alert alert-error hidden" style="margin-bottom:12px;"></div>
            <button type="submit" id="btn-save-config-hotel" class="btn btn-primary btn-full">💾 Guardar Datos del Hotel</button>
          </form>
        </div>
      </div>
    </div>` : ''}

    <!-- MODAL CONFIGURACIÓN TIPO HABITACIÓN -->
    <div id="modal-config-tipo" class="modal-overlay hidden">
      <div class="modal glass-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2 id="mct-titulo">Nuevo Tipo de Habitación</h2>
          <button class="btn-close" onclick="closeModal('modal-config-tipo')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-config-tipo" onsubmit="guardarTipoHab(event)">
            <input type="hidden" id="mct-id">
            <div class="form-group">
              <label>Nombre del Tipo *</label>
              <input type="text" id="mct-nombre" class="form-input" required placeholder="Ej: Suite Matrimonial Deluxe">
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea id="mct-descripcion" class="form-input" rows="2" placeholder="Detalle sobre el tamaño, vistas, etc."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Capacidad Máxima *</label>
                <input type="number" id="mct-capacidad" class="form-input" required min="1" value="2">
              </div>
              <div class="form-group">
                <label>Precio Base por Noche * (S/)</label>
                <input type="number" id="mct-precio" class="form-input" required min="0" step="0.01" placeholder="150.00">
              </div>
            </div>
            <div class="form-group">
              <label>Amenidades (Separadas por comas)</label>
              <input type="text" id="mct-amenidades" class="form-input" placeholder="WiFi, Aire Acondicionado, Minibar, Jacuzzi">
            </div>
            <div id="mct-error" class="alert alert-error hidden" style="margin-bottom:12px;"></div>
            <button type="submit" class="btn btn-primary btn-full">💾 Guardar Tipo</button>
          </form>
        </div>
      </div>
    </div>

    <!-- MODAL CONFIGURACIÓN HABITACIÓN -->
    <div id="modal-config-hab" class="modal-overlay hidden">
      <div class="modal glass-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2 id="mch-titulo">Nueva Habitación</h2>
          <button class="btn-close" onclick="closeModal('modal-config-hab')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-config-hab" onsubmit="guardarConfigHab(event)">
            <input type="hidden" id="mch-id">
            <div class="form-row">
              <div class="form-group">
                <label>Número de Habitación *</label>
                <input type="text" id="mch-numero" class="form-input" required placeholder="101">
              </div>
              <div class="form-group">
                <label>Piso *</label>
                <input type="number" id="mch-piso" class="form-input" required min="1" value="1">
              </div>
            </div>
            <div class="form-group">
              <label>Tipo de Habitación *</label>
              <select id="mch-tipo" class="form-input" required></select>
            </div>
            <div class="form-group">
              <label>Estado Inicial</label>
              <select id="mch-estado" class="form-input">
                <option value="disponible">✅ Disponible</option>
                <option value="ocupada">🔴 Ocupada</option>
                <option value="limpieza">🧹 En Limpieza</option>
                <option value="mantenimiento">🔧 Mantenimiento</option>
              </select>
            </div>
            <div class="form-group">
              <label>Notas / Descripción</label>
              <textarea id="mch-descripcion" class="form-input" rows="2" placeholder="Ubicación o notas internas"></textarea>
            </div>
            <div id="mch-error" class="alert alert-error hidden" style="margin-bottom:12px;"></div>
            <button type="submit" class="btn btn-primary btn-full">💾 Guardar Habitación</button>
          </form>
        </div>
      </div>
    </div>

    <!-- MODAL DE SUBIDA DE IMAGEN -->
    <div id="modal-config-imagen" class="modal-overlay hidden">
      <div class="modal glass-card" style="max-width: 450px;">
        <div class="modal-header">
          <h2>Configurar Foto de Habitación</h2>
          <button class="btn-close" onclick="closeModal('modal-config-imagen')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-config-imagen" onsubmit="subirImagenTipoHab(event)">
            <input type="hidden" id="mci-id">
            <div class="form-group">
              <label>Seleccionar Imagen (JPG, PNG, WEBP)</label>
              <input type="file" id="mci-archivo" class="form-input" accept="image/*" required style="padding:10px;">
            </div>
            <div id="mci-preview" style="margin-top:12px;text-align:center;"></div>
            <div id="mci-error" class="alert alert-error hidden" style="margin-bottom:12px;"></div>
            <button type="submit" class="btn btn-primary btn-full" id="btn-subir-imagen">📤 Subir a Supabase Storage</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Cargar listas iniciales
  await cargarConfigTipos();
  await cargarConfigHabs();
  if (currentUser && currentUser.rol === 'admin') {
    await cargarConfigHotelForm();
  }
}

function switchConfigTab(tab, btn) {
  document.querySelectorAll('#config-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('config-section-tipos').classList.toggle('hidden', tab !== 'tipos');
  document.getElementById('config-section-habitaciones').classList.toggle('hidden', tab !== 'habitaciones');
  const hotelSec = document.getElementById('config-section-hotel');
  if (hotelSec) hotelSec.classList.toggle('hidden', tab !== 'hotel');
}

let todosTiposHab = [];
async function cargarConfigTipos() {
  const container = document.getElementById('config-tipos-list');
  try {
    const tipos = await apiCall('/habitaciones/tipos/list');
    todosTiposHab = tipos || [];
    if (!tipos.length) {
      container.innerHTML = '<div class="empty-state"><p>No hay tipos de habitación registrados.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Capacidad</th>
              <th>Precio Base</th>
              <th>Amenidades</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${tipos.map(t => `
              <tr>
                <td>
                  <div style="width:70px; height:45px; border-radius:6px; overflow:hidden; background:#1b254b; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.1)">
                    ${t.imagen_url ? `<img src="${t.imagen_url}" style="width:100%; height:100%; object-fit:cover">` : `<span style="font-size:18px">${iconTipoHab(t.nombre)}</span>`}
                  </div>
                </td>
                <td><strong>${t.nombre}</strong><br><small style="color:var(--gray-500)">${(t.descripcion||'').substring(0,40)}...</small></td>
                <td>👥 ${t.capacidad} pers.</td>
                <td><strong>S/ ${parseFloat(t.precio_base).toFixed(2)}</strong></td>
                <td>${(t.amenidades || []).map(a => `<span class="badge badge-gray" style="margin:2px; font-size:10px;">${a}</span>`).join('')}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-outline" onclick="abrirModalImagenTipo('${t.id}')">📷 Foto</button>
                    <button class="btn btn-sm btn-secondary" onclick="editarTipoHab('${t.id}')">✏️ Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarTipoHab('${t.id}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar tipos: ${e.message}</div>`;
  }
}

async function cargarConfigHabs() {
  const container = document.getElementById('config-habs-list');
  try {
    const habs = await apiCall('/habitaciones');
    if (!habs.length) {
      container.innerHTML = '<div class="empty-state"><p>No hay habitaciones registradas.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Habitación</th>
              <th>Piso</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${habs.map(h => `
              <tr>
                <td><strong>Nro. ${h.numero}</strong></td>
                <td>${h.piso}</td>
                <td>${h.tipos_habitacion?.nombre || h.tipo_nombre || '-'}</td>
                <td><span class="badge badge-${{disponible:'success',ocupada:'error',limpieza:'warning',mantenimiento:'info'}[h.estado]||'gray'}">${h.estado}</span></td>
                <td><small>${h.descripcion || '-'}</small></td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-secondary" onclick="editarConfigHab('${h.id}')">✏️ Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarConfigHab('${h.id}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar habitaciones: ${e.message}</div>`;
  }
}

function abrirModalTipoHab() {
  document.getElementById('mct-id').value = '';
  document.getElementById('mct-nombre').value = '';
  document.getElementById('mct-descripcion').value = '';
  document.getElementById('mct-capacidad').value = '2';
  document.getElementById('mct-precio').value = '';
  document.getElementById('mct-amenidades').value = '';
  document.getElementById('mct-titulo').textContent = 'Nuevo Tipo de Habitación';
  document.getElementById('mct-error').classList.add('hidden');
  openModal('modal-config-tipo');
}

function editarTipoHab(id) {
  const tipo = todosTiposHab.find(t => t.id === id);
  if (!tipo) return;

  document.getElementById('mct-id').value = tipo.id;
  document.getElementById('mct-nombre').value = tipo.nombre;
  document.getElementById('mct-descripcion').value = tipo.descripcion || '';
  document.getElementById('mct-capacidad').value = tipo.capacidad;
  document.getElementById('mct-precio').value = tipo.precio_base;
  document.getElementById('mct-amenidades').value = (tipo.amenidades || []).join(', ');
  document.getElementById('mct-titulo').textContent = 'Editar Tipo de Habitación';
  document.getElementById('mct-error').classList.add('hidden');
  openModal('modal-config-tipo');
}

async function guardarTipoHab(e) {
  e.preventDefault();
  const id = document.getElementById('mct-id').value;
  const errEl = document.getElementById('mct-error');
  errEl.classList.add('hidden');

  const payload = {
    nombre: document.getElementById('mct-nombre').value,
    descripcion: document.getElementById('mct-descripcion').value,
    capacidad: parseInt(document.getElementById('mct-capacidad').value),
    precio_base: parseFloat(document.getElementById('mct-precio').value),
    amenidades: document.getElementById('mct-amenidades').value.split(',').map(s => s.trim()).filter(s => s.length > 0)
  };

  try {
    if (id) {
      await apiCall(`/habitaciones/tipos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Tipo de habitación actualizado', 'success');
    } else {
      await apiCall('/habitaciones/tipos', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Tipo de habitación creado', 'success');
    }
    closeModal('modal-config-tipo');
    await cargarConfigTipos();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function eliminarTipoHab(id) {
  if (!confirm('¿Seguro que deseas eliminar este tipo de habitación? Esto fallará si hay habitaciones físicas asociadas.')) return;
  try {
    await apiCall(`/habitaciones/tipos/${id}`, { method: 'DELETE' });
    showToast('Tipo de habitación eliminado', 'info');
    await cargarConfigTipos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function abrirModalImagenTipo(id) {
  document.getElementById('mci-id').value = id;
  document.getElementById('mci-archivo').value = '';
  document.getElementById('mci-preview').innerHTML = '';
  document.getElementById('mci-error').classList.add('hidden');
  openModal('modal-config-imagen');
}

async function subirImagenTipoHab(e) {
  e.preventDefault();
  const id = document.getElementById('mci-id').value;
  const fileInput = document.getElementById('mci-archivo');
  const errEl = document.getElementById('mci-error');
  const btn = document.getElementById('btn-subir-imagen');

  if (!fileInput.files.length) return;

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Subiendo a Supabase Storage...';

  const formData = new FormData();
  formData.append('imagen', fileInput.files[0]);

  try {
    const res = await fetch(`${API}/habitaciones/tipos/${id}/imagen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${staffToken}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al subir');

    showToast('Imagen subida y guardada exitosamente 🎉', 'success');
    closeModal('modal-config-imagen');
    await cargarConfigTipos();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Subir a Supabase Storage';
  }
}

async function abrirModalConfigHab() {
  document.getElementById('mch-id').value = '';
  document.getElementById('mch-numero').value = '';
  document.getElementById('mch-piso').value = '1';
  document.getElementById('mch-descripcion').value = '';
  document.getElementById('mch-titulo').textContent = 'Nueva Habitación';
  document.getElementById('mch-error').classList.add('hidden');

  const select = document.getElementById('mch-tipo');
  if (select) {
    const tipos = await apiCall('/habitaciones/tipos/list');
    select.innerHTML = tipos.map(t => `<option value="${t.id}">${t.nombre} (S/ ${t.precio_base}/noche)</option>`).join('');
  }

  openModal('modal-config-hab');
}

async function editarConfigHab(id) {
  try {
    const h = await apiCall(`/habitaciones/${id}`);
    document.getElementById('mch-id').value = h.id;
    document.getElementById('mch-numero').value = h.numero;
    document.getElementById('mch-piso').value = h.piso;
    document.getElementById('mch-estado').value = h.estado;
    document.getElementById('mch-descripcion').value = h.descripcion || '';
    document.getElementById('mch-titulo').textContent = 'Editar Habitación';
    document.getElementById('mch-error').classList.add('hidden');

    const select = document.getElementById('mch-tipo');
    if (select) {
      const tipos = await apiCall('/habitaciones/tipos/list');
      select.innerHTML = tipos.map(t => `<option value="${t.id}">${t.nombre} (S/ ${t.precio_base}/noche)</option>`).join('');
      select.value = h.tipo_id || h.tipos_habitacion?.id;
    }

    openModal('modal-config-hab');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function guardarConfigHab(e) {
  e.preventDefault();
  const id = document.getElementById('mch-id').value;
  const errEl = document.getElementById('mch-error');
  errEl.classList.add('hidden');

  const payload = {
    numero: document.getElementById('mch-numero').value,
    piso: parseInt(document.getElementById('mch-piso').value),
    tipo_id: document.getElementById('mch-tipo').value,
    estado: document.getElementById('mch-estado').value,
    descripcion: document.getElementById('mch-descripcion').value
  };

  try {
    if (id) {
      await apiCall(`/habitaciones/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Habitación actualizada', 'success');
    } else {
      await apiCall('/habitaciones', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Habitación creada', 'success');
    }
    closeModal('modal-config-hab');
    await cargarConfigHabs();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function eliminarConfigHab(id) {
  if (!confirm('¿Seguro que deseas eliminar esta habitación?')) return;
  try {
    await apiCall(`/habitaciones/${id}`, { method: 'DELETE' });
    showToast('Habitación eliminada', 'info');
    await cargarConfigHabs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// PERFIL DE CLIENTE
// ============================================================

async function cargarPerfilClienteForm() {
  const errEl = document.getElementById('pc-error');
  if (errEl) errEl.classList.add('hidden');

  try {
    const res = await apiClienteCall('/auth/cliente/me');
    const c = res.data;

    document.getElementById('pc-nombres').value = c.nombres || '';
    document.getElementById('pc-apellidos').value = c.apellidos || '';
    document.getElementById('pc-tipo-doc').value = c.tipo_doc || 'DNI';
    document.getElementById('pc-nro-doc').value = c.nro_doc || '';
    document.getElementById('pc-telefono').value = c.telefono || '';
    document.getElementById('pc-nacionalidad').value = c.nacionalidad || 'Peruana';
  } catch (err) {
    showToast('Error al cargar perfil: ' + err.message, 'error');
  }
}

async function guardarPerfilCliente(e) {
  e.preventDefault();
  const errEl = document.getElementById('pc-error');
  if (errEl) errEl.classList.add('hidden');

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const payload = {
    nombres: document.getElementById('pc-nombres').value,
    apellidos: document.getElementById('pc-apellidos').value,
    tipo_doc: document.getElementById('pc-tipo-doc').value,
    nro_doc: document.getElementById('pc-nro-doc').value,
    telefono: document.getElementById('pc-telefono').value,
    nacionalidad: document.getElementById('pc-nacionalidad').value
  };

  try {
    const res = await apiClienteCall('/auth/cliente/perfil', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    
    // Actualizar datos del cliente localmente
    currentCliente = res.data;
    currentCliente.nombres = currentCliente.nombres || currentCliente.nombre;
    localStorage.setItem('hotel_cliente', JSON.stringify(currentCliente));

    showToast('¡Perfil actualizado con éxito! 🎉', 'success');
    
    // Forzar actualización de navbar
    document.getElementById('nav-cliente-auth')?.remove();
    actualizarNavCliente();
    
    setTimeout(() => {
      showPage('web-page');
    }, 1000);
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Cambios';
  }
}

// ============================================================
// VENTAS EXTRA
// ============================================================

let ventasProductos = [];

async function renderVentas() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; align-items: start;">
      
      <!-- Formulario para realizar venta -->
      <div class="card glass-card">
        <div class="card-header"><h3 class="card-title">🛒 Registrar Venta Extra a Habitación</h3></div>
        <div class="card-body">
          <form id="form-venta-extra" onsubmit="registrarVentaExtra(event)">
            <div class="form-group">
              <label>Seleccionar Habitación Ocupada *</label>
              <select id="ve-estadia-id" class="form-input" required onchange="actualizarPrecioVentaExtra()">
                <option value="">Cargando habitaciones activas...</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Seleccionar Producto *</label>
              <select id="ve-producto-id" class="form-input" required onchange="actualizarPrecioVentaExtra()">
                <option value="">Cargando catálogo...</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Cantidad *</label>
                <input type="number" id="ve-cantidad" class="form-input" value="1" min="1" required oninput="actualizarPrecioVentaExtra()">
              </div>
              <div class="form-group">
                <label>Precio Unitario (S/) *</label>
                <input type="number" id="ve-precio" class="form-input" step="0.01" required min="0">
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:8px; margin-bottom:16px; border:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:space-between; font-weight:700;">
              <span>Subtotal Venta:</span>
              <span id="ve-subtotal" style="color:var(--gold);">S/ 0.00</span>
            </div>

            <button type="submit" id="btn-submit-venta" class="btn btn-primary btn-full">💾 Confirmar y Registrar Venta</button>
          </form>
        </div>
      </div>

      <!-- Resumen de ventas recientes para Admin y Gerente -->
      <div class="card glass-card">
        <div class="card-header"><h3 class="card-title">📊 Ventas Recientes (Consumos de Habitaciones)</h3></div>
        <div class="card-body" id="ventas-recientes-table">
          <p>Cargando consumos registrados...</p>
        </div>
      </div>

    </div>
  `;

  try {
    const estadias = await apiCall('/estadias?estado=activa');
    const productos = await apiCall('/inventario/productos');

    ventasProductos = (productos || []).filter(p => p.activo);

    const selectEstadia = document.getElementById('ve-estadia-id');
    if (!estadias || estadias.length === 0) {
      selectEstadia.innerHTML = '<option value="">No hay habitaciones ocupadas en este momento</option>';
    } else {
      selectEstadia.innerHTML = '<option value="">-- Seleccionar Habitación --</option>' + 
        estadias.map(e => `<option value="${e.id}" data-folio-id="${e.folios?.[0]?.id || ''}">Habitación ${e.habitaciones?.numero} - ${e.huespedes?.nombres} ${e.huespedes?.apellidos}</option>`).join('');
    }

    const selectProducto = document.getElementById('ve-producto-id');
    if (!ventasProductos || ventasProductos.length === 0) {
      selectProducto.innerHTML = '<option value="">No hay productos activos en inventario</option>';
    } else {
      selectProducto.innerHTML = '<option value="">-- Seleccionar Producto --</option>' + 
        ventasProductos.map(p => `<option value="${p.id}" data-precio="${p.precio}" data-stock="${p.stock_actual}">${p.nombre} (Stock: ${p.stock_actual} ${p.unidad} · S/ ${parseFloat(p.precio).toFixed(2)})</option>`).join('');
    }

    actualizarPrecioVentaExtra();
    await cargarVentasRecientes();
  } catch(e) {
    showToast('Error cargando catálogos de venta: ' + e.message, 'error');
  }
}

function actualizarPrecioVentaExtra() {
  const selectProducto = document.getElementById('ve-producto-id');
  const inputPrecio = document.getElementById('ve-precio');
  const inputCantidad = document.getElementById('ve-cantidad');
  const subtotalEl = document.getElementById('ve-subtotal');

  if (!selectProducto || !inputPrecio || !inputCantidad || !subtotalEl) return;

  const selectedOpt = selectProducto.selectedOptions[0];
  if (selectedOpt && selectedOpt.value) {
    const precio = parseFloat(selectedOpt.getAttribute('data-precio') || 0);
    inputPrecio.value = precio.toFixed(2);
    
    const cantidad = parseFloat(inputCantidad.value || 0);
    const subtotal = precio * cantidad;
    subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
  } else {
    inputPrecio.value = '';
    subtotalEl.textContent = 'S/ 0.00';
  }
}

async function registrarVentaExtra(e) {
  e.preventDefault();
  const selectEstadia = document.getElementById('ve-estadia-id');
  const selectProducto = document.getElementById('ve-producto-id');
  const cantidad = parseFloat(document.getElementById('ve-cantidad').value);
  const precioUnitario = parseFloat(document.getElementById('ve-precio').value);

  const selectedEstOpt = selectEstadia.selectedOptions[0];
  const folioId = selectedEstOpt?.getAttribute('data-folio-id');
  const selectedProdOpt = selectProducto.selectedOptions[0];
  const productoId = selectProducto.value;

  if (!folioId) {
    showToast('La habitación seleccionada no tiene una cuenta de folio activa', 'warning');
    return;
  }

  const stockDisponible = parseFloat(selectedProdOpt?.getAttribute('data-stock') || 0);
  if (stockDisponible < cantidad) {
    showToast(`Stock insuficiente. Stock actual en inventario: ${stockDisponible}`, 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-venta');
  btn.disabled = true;
  btn.textContent = 'Registrando consumo...';

  try {
    const desc = `${selectedProdOpt.text.split(' (')[0]} (Venta Extra)`;
    await apiCall(`/folios/${folioId}/cargos`, {
      method: 'POST',
      body: JSON.stringify({
        descripcion: desc,
        cantidad,
        precio_unitario: precioUnitario,
        tipo: 'consumo',
        producto_id: productoId
      })
    });

    showToast('Venta extra registrada y cargada a la habitación exitosamente 🎉', 'success');
    document.getElementById('form-venta-extra').reset();
    actualizarPrecioVentaExtra();
    await renderVentas();
  } catch (err) {
    showToast('Error al registrar venta: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Confirmar y Registrar Venta';
  }
}

async function cargarVentasRecientes() {
  const container = document.getElementById('ventas-recientes-table');
  try {
    const estadias = await apiCall('/estadias?estado=activa');
    let consumos = [];

    for (const est of estadias) {
      const folioBrief = est.folios?.[0];
      if (folioBrief) {
        const folioDetalle = await apiCall(`/folios/${folioBrief.id}`);
        const cargosConsumo = (folioDetalle.cargos || []).filter(c => c.tipo === 'consumo');
        cargosConsumo.forEach(c => {
          consumos.push({
            habitacion: est.habitaciones?.numero,
            huesped: `${est.huespedes?.nombres} ${est.huespedes?.apellidos}`,
            descripcion: c.descripcion,
            cantidad: c.cantidad,
            subtotal: c.subtotal,
            fecha: c.created_at
          });
        });
      }
    }

    consumos.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    if (consumos.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Sin consumos</h3><p>No se han registrado consumos extras en las habitaciones activas.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Hab.</th>
              <th>Huésped</th>
              <th>Detalle</th>
              <th>Cant.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${consumos.map(c => `
              <tr>
                <td><strong>${c.habitacion}</strong></td>
                <td><small>${c.huesped}</small></td>
                <td>${c.descripcion}</td>
                <td>${parseInt(c.cantidad)}</td>
                <td><strong style="color:var(--gold);">S/ ${parseFloat(c.subtotal).toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar consumos: ${err.message}</div>`;
  }
}

// ============================================================
// DATOS DEL HOTEL
// ============================================================

async function cargarConfigFooter() {
  try {
    const res = await fetch(`${API}/config/public`);
    const data = await res.json();
    if (!res.ok) return;
    const c = data.data;

    if (c.contacto_direccion) document.getElementById('footer-direccion').textContent = `📍 ${c.contacto_direccion}`;
    if (c.contacto_telefono) document.getElementById('footer-telefono').textContent = `📞 ${c.contacto_telefono}`;
    if (c.contacto_email) document.getElementById('footer-email').textContent = `✉️ ${c.contacto_email}`;
    if (c.horario_checkin) document.getElementById('footer-checkin').textContent = `Check-in: ${c.horario_checkin}`;
    if (c.horario_checkout) document.getElementById('footer-checkout').textContent = `Check-out: ${c.horario_checkout}`;
    if (c.horario_recepcion) document.getElementById('footer-recepcion').textContent = `Recepción: ${c.horario_recepcion}`;
  } catch(e) {}
}

async function cargarConfigHotelForm() {
  try {
    const c = await apiCall('/config');
    document.getElementById('ch-direccion').value = c.contacto_direccion || '';
    document.getElementById('ch-telefono').value = c.contacto_telefono || '';
    document.getElementById('ch-email').value = c.contacto_email || '';
    document.getElementById('ch-checkin').value = c.horario_checkin || '';
    document.getElementById('ch-checkout').value = c.horario_checkout || '';
    document.getElementById('ch-recepcion').value = c.horario_recepcion || '';
  } catch (err) {}
}

async function guardarConfigHotel(e) {
  e.preventDefault();
  const errEl = document.getElementById('ch-error');
  errEl.classList.add('hidden');
  const btn = document.getElementById('btn-save-config-hotel');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const payload = {
    contacto_direccion: document.getElementById('ch-direccion').value.trim(),
    contacto_telefono: document.getElementById('ch-telefono').value.trim(),
    contacto_email: document.getElementById('ch-email').value.trim(),
    horario_checkin: document.getElementById('ch-checkin').value.trim(),
    horario_checkout: document.getElementById('ch-checkout').value.trim(),
    horario_recepcion: document.getElementById('ch-recepcion').value.trim()
  };

  try {
    await apiCall('/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showToast('Datos del hotel actualizados exitosamente 🎉', 'success');
    await cargarConfigFooter();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Datos del Hotel';
  }
}
