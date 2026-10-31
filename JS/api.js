// conexión HTTP, control de sesión
const API_BASE = 'http://localhost:8080/api';

// datos del usuario en sesión activa
function getUsuarioActivo() {
    const raw = localStorage.getItem('usuarioActivo');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

// Ppersiste los datos de sesión en almacenamiento local
function setUsuarioActivo(usuario) {
    localStorage.setItem('usuarioActivo', JSON.stringify(usuario));
}

// cierra sesión activa y redirige a la vista de login
function cerrarSesion() {
    localStorage.removeItem('usuarioActivo');
    window.location.href = 'login.html';
}

// valida la existencia de sesión activa y permisos por rol
function verificarSesion(rolesPermitidos = []) {
    const usuario = getUsuarioActivo();
    if (!usuario || !usuario.idUsuario) {
        window.location.href = 'login.html';
        return null;
    }

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
        alert('Acceso restringido: El rol actual no tiene autorización para este módulo.');
        window.location.href = 'index.html';
        return null;
    }

    return usuario;
}

//  peticiones fetch agregando autenticación Bearer y control de errores
async function apiFetch(endpoint, options = {}) {
    const usuario = getUsuarioActivo();
    const headers = options.headers || {};

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (usuario && usuario.token) {
        headers['Authorization'] = `Bearer ${usuario.token}`;
    }

    options.headers = headers;

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            alert('La sesión ha finalizado. Inicie sesión nuevamente.');
            cerrarSesion();
            return null;
        }

        const contentType = response.headers.get('content-type');
        let data = null;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = text ? { mensaje: text } : {};
        }

        if (!response.ok) {
            const errorMsg = data && (data.mensaje || data.error) ? (data.mensaje || data.error) : `Error ${response.status}: ${response.statusText}`;
            const err = new Error(errorMsg);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    } catch (err) {
        console.error(`Error en petición ${options.method || 'GET'} a ${url}:`, err);
        throw err;
    }
}

// render de iconos  e imagen de logotipo
function renderSidebar(activePage = '') {
    const usuario = getUsuarioActivo();
    const esAdmin = usuario && usuario.rol === 'Administrador';

    const sidebarContainer = document.querySelector('.sidebar');
    if (!sidebarContainer) return;

    let html = `
        <a href="index.html" class="sidebar-logo-container">
            <img src="imgs/logo.jpg" alt="Logo TechFix" class="sidebar-logo-img">
            <span class="sidebar-logo-text">TechFix ERP</span>
        </a>

        <div class="menu-item ${activePage === 'dashboard' ? 'active' : ''}">
            <a href="index.html">
                <img src="imgs/activity.svg" alt="" class="menu-icon">
                <span>Dashboard</span>
            </a>
        </div>
        <div class="menu-item ${activePage === 'ordenes' ? 'active' : ''}">
            <a href="ordenes.html">
                <img src="imgs/checkup-list.svg" alt="" class="menu-icon">
                <span>Órdenes de Trabajo</span>
            </a>
        </div>
        <div class="menu-item ${activePage === 'diagnostico' ? 'active' : ''}">
            <a href="diagnostico.html">
                <img src="imgs/1093183-3f51b5.svg" alt="" class="menu-icon">
                <span>Diagnóstico y Taller</span>
            </a>
        </div>
    `;

    if (esAdmin) {
        html += `
            <div class="menu-item ${activePage === 'inventario' ? 'active' : ''}">
                <a href="inventario.html">
                    <img src="imgs/box.svg" alt="" class="menu-icon">
                    <span>Inventario y Kardex</span>
                </a>
            </div>
            <div class="menu-item ${activePage === 'clientes' ? 'active' : ''}">
                <a href="clientes.html">
                    <img src="imgs/309094-3f51b5.svg" alt="" class="menu-icon">
                    <span>Clientes</span>
                </a>
            </div>
            <div class="menu-item ${activePage === 'equipos' ? 'active' : ''}">
                <a href="equipos.html">
                    <img src="imgs/2237420-3f51b5.svg" alt="" class="menu-icon">
                    <span>Equipos</span>
                </a>
            </div>
            <div class="menu-item ${activePage === 'facturas' ? 'active' : ''}">
                <a href="facturas.html">
                    <img src="imgs/38206-3f51b5.svg" alt="" class="menu-icon">
                    <span>Facturación</span>
                </a>
            </div>
            <div class="menu-item ${activePage === 'auditoria' ? 'active' : ''}">
                <a href="auditoria.html">
                    <img src="imgs/1785039-ff5722.svg" alt="" class="menu-icon">
                    <span>Auditoría</span>
                </a>
            </div>
            <div class="menu-item ${activePage === 'usuarios' ? 'active' : ''}">
                <a href="usuarios.html">
                    <img src="imgs/309094-3f51b5.svg" alt="" class="menu-icon">
                    <span>Usuarios y Técnicos</span>
                </a>
            </div>
        `;
    }

    sidebarContainer.innerHTML = html;
}

// render los datos del usuario 
function renderHeaderUsuario() {
    const usuario = getUsuarioActivo();
    const infoContainer = document.querySelector('.user-info');
    if (!infoContainer || !usuario) return;

    const rolColor = usuario.rol === 'Administrador' ? '#3b82f6' : '#10b981';

    infoContainer.innerHTML = `
        <span style="font-weight:600;">${usuario.nombreCompleto || usuario.correo}</span>
        <span class="user-badge" style="background:${rolColor};">
            ${usuario.rol}
        </span>
        <button onclick="cerrarSesion()" class="btn-logout" title="Cerrar Sesión">
            Cerrar Sesión
        </button>
    `;
}

//  alertas flotantes no intrusivas en pantalla
function mostrarNotificacion(mensaje, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:99999; display:flex; flex-direction:column; gap:10px; max-width:400px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorBg = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : tipo === 'warning' ? '#f59e0b' : '#3b82f6';

    toast.style.cssText = `background:${colorBg}; color:white; padding:12px 18px; border-radius:8px; box-shadow:0 6px 15px rgba(0,0,0,0.3); font-size:0.9rem; animation:fadeIn 0.3s ease;`;
    toast.innerHTML = `<div>${mensaje}</div>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// format cadenas de fecha a formato estándar local
function formatearFecha(fechaStr) {
    if (!fechaStr) return 'N/A';
    try {
        const d = new Date(fechaStr);
        return d.toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        return fechaStr;
    }
}

// format montos numéricos a formato de moneda quetzales
function formatearMoneda(monto) {
    const val = parseFloat(monto) || 0;
    return `Q${val.toFixed(2)}`;
}

// url base para el qr (poner ip de la red si se escanea desde cel, ej: 'http://192.168.1.10:5501/')
const URL_BASE_SEGUIMIENTO = '';

// arma link de seguimiento con token
function urlSeguimiento(token) {
    const base = URL_BASE_SEGUIMIENTO || window.location.href;
    return new URL(`seguimiento.html?token=${encodeURIComponent(token)}`, base).href;
}

// dibuja qr del ticket en un contenedor
function generarQRTicket(contenedorId, token, tam = 140) {
    const cont = document.getElementById(contenedorId);
    if (!cont) return;
    cont.innerHTML = '';
    if (!token || typeof QRCode === 'undefined') return;
    new QRCode(cont, {
        text: urlSeguimiento(token),
        width: tam,
        height: tam,
        correctLevel: QRCode.CorrectLevel.M
    });
}
