// conrtrol de lógica del Dashboard principal
let ordenesCache = [];
let ordenSeleccionada = null;

// Inicializacion componentes y datos del panel de control
async function inicializarDashboard() {
    const usuario = verificarSesion();
    if (!usuario) return;

    renderSidebar('dashboard');
    renderHeaderUsuario();

    if (usuario.rol !== 'Administrador') {
        const badgeStock = document.getElementById('count-stock-bajo');
        if (badgeStock && badgeStock.parentElement) {
            badgeStock.parentElement.style.display = 'none';
        }
        await cargarOrdenesDashboard(usuario);
        return;
    }

    await Promise.all([
        cargarOrdenesDashboard(usuario),
        cargarAlertasStock()
    ]);
}

// Cargar listado de órdenes y actualiza indicadores de resumen
async function cargarOrdenesDashboard(usuario) {
    try {
        const data = await apiFetch('/ordenes');
        ordenesCache = data || [];

        // filtro por rol del usuario autenticado
        let ordenesAMostrar = ordenesCache;
        if (usuario.rol === 'Técnico') {
            ordenesAMostrar = ordenesCache.filter(o => o.idUsuarioTecnico && o.idUsuarioTecnico.idUsuario === usuario.idUsuario);
        }

        const totalActivas = ordenesAMostrar.filter(o => o.estadoReparacion !== 'Entregado').length;
        const totalDiag = ordenesAMostrar.filter(o => o.estadoReparacion === 'En Diagnóstico').length;
        const totalListos = ordenesAMostrar.filter(o => o.estadoReparacion === 'Reparado').length;

        document.getElementById('count-activas').innerText = totalActivas;
        document.getElementById('count-diagnostico').innerText = totalDiag;
        document.getElementById('count-listos').innerText = totalListos;

        const tbody = document.getElementById('tabla-ordenes');
        if (ordenesAMostrar.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state-card">No hay órdenes registradas para mostrar.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        ordenesAMostrar.forEach(orden => {
            const idOrden = orden.idOrden;
            const cliente = orden.idEquipo && orden.idEquipo.idCliente ? orden.idEquipo.idCliente.nombreCliente : 'Cliente no asignado';
            const equipo = orden.idEquipo ? `${orden.idEquipo.marcaModelo} <span class="field-help-text">(Serie: ${orden.idEquipo.numeroSerie})</span>` : 'N/A';
            const tecnico = orden.idUsuarioTecnico ? orden.idUsuarioTecnico.nombreCompleto : 'Sin asignar';
            
            // Distintivo visual del estado de reparación
            let badgeClass = 'badge recibido';
            if (orden.estadoReparacion === 'En Diagnóstico') badgeClass = 'badge diag';
            else if (orden.estadoReparacion === 'Reparado') badgeClass = 'badge ready';
            else if (orden.estadoReparacion === 'Entregado') badgeClass = 'badge entregado';

            // Distintivo de solicitud de respaldo
            const requiereRespaldoBadge = orden.requiereRespaldo
                ? `<span class="badge respaldo-si" title="Solicitud de respaldo de archivos">SÍ (Respaldar)</span>`
                : `<span class="badge respaldo-no">NO</span>`;

            // Botones de acción contextual
            let btnTicket = `<button class="btn btn-secondary btn-sm" onclick="verTicket(${idOrden})" title="Ver comprobante">Ticket</button>`;
            let btnTaller = `<a href="diagnostico.html?idOrden=${idOrden}" class="btn btn-primary btn-sm" title="Ir a taller">Taller</a>`;
            let btnFacturar = '';
            
            if (usuario.rol === 'Administrador' && orden.estadoReparacion === 'Reparado') {
                btnFacturar = `<a href="facturas.html?idOrden=${idOrden}" class="btn btn-success btn-sm" title="Emitir factura">Facturar</a>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#ORD-${idOrden}</strong></td>
                <td>${cliente}</td>
                <td>${equipo}</td>
                <td>${requiereRespaldoBadge}</td>
                <td><span class="${badgeClass}">${orden.estadoReparacion}</span></td>
                <td>${tecnico}</td>
                <td>
                    <div class="cell-actions">
                        ${btnTicket}
                        ${btnTaller}
                        ${btnFacturar}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error al cargar órdenes:', err);
        mostrarNotificacion('No se pudieron obtener las órdenes del servidor.', 'error');
    }
}

// consult repuestos con nivel de existencia crítico
async function cargarAlertasStock() {
    try {
        const stockBajo = await apiFetch('/repuestos/stock-bajo');
        const countBadge = document.getElementById('count-stock-bajo');
        if (countBadge) {
            countBadge.innerText = (stockBajo || []).length;
        }
    } catch (err) {
        console.error('Error al consultar stock bajo:', err);
    }
}

// modal con detalles del comprobante para visualización e impresión
function verTicket(idOrden) {
    const orden = ordenesCache.find(o => o.idOrden === idOrden);
    if (!orden) return;
    ordenSeleccionada = orden;

    const modalBody = document.getElementById('modal-ticket-body');
    const cliente = orden.idEquipo && orden.idEquipo.idCliente ? orden.idEquipo.idCliente : {};
    const equipo = orden.idEquipo || {};
    const tecnico = orden.idUsuarioTecnico ? orden.idUsuarioTecnico.nombreCompleto : 'No asignado';
    const token = orden.tokenSeguimiento || 'Sin código';

    modalBody.innerHTML = `
        <div class="summary-box">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="font-size:1.1rem; font-weight:bold; color:#60a5fa;">Orden #ORD-${orden.idOrden}</span>
                <span class="badge ${orden.estadoReparacion === 'Reparado' ? 'ready' : 'diag'}">${orden.estadoReparacion}</span>
            </div>
            <p><strong>Código de seguimiento:</strong> <span class="ticket-token">${token}</span></p>
            <p><strong>Fecha de Ingreso:</strong> ${formatearFecha(orden.fechaIngreso)}</p>
            <p><strong>Cliente:</strong> ${cliente.nombreCliente || 'N/A'} (Tel: ${cliente.telefono || 'N/A'})</p>
            <p><strong>Equipo:</strong> ${equipo.marcaModelo || 'N/A'} - <strong>Serie:</strong> ${equipo.numeroSerie || 'N/A'}</p>
            <p><strong>Técnico Asignado:</strong> ${tecnico}</p>
            <p style="margin-top:8px;"><strong>Respaldo de Información:</strong> 
                ${orden.requiereRespaldo ? '<span style="color:#ef4444; font-weight:bold;">SÍ - Realizar copia de seguridad</span>' : 'NO'}
            </p>
        </div>
        <div style="margin-bottom:10px;">
            <strong>Problema Reportado:</strong>
            <p class="summary-box" style="margin-top:4px;">${orden.problemaReportado || 'N/A'}</p>
        </div>
        <div>
            <strong>Notas Especiales:</strong>
            <p class="summary-box" style="margin-top:4px;">${orden.notasEspeciales || 'Ninguna especificación adicional'}</p>
        </div>
        <div id="modal-ticket-qr" class="qr-box"></div>
    `;

    // dTOS Carga plantilla de impresión física
    document.getElementById('ticket-id').innerText = token;
    document.getElementById('ticket-fecha').innerText = formatearFecha(orden.fechaIngreso);
    document.getElementById('ticket-cliente').innerText = cliente.nombreCliente || 'N/A';
    document.getElementById('ticket-telefono').innerText = cliente.telefono || 'N/A';
    document.getElementById('ticket-equipo').innerText = equipo.marcaModelo || 'N/A';
    document.getElementById('ticket-serie').innerText = equipo.numeroSerie || 'N/A';
    document.getElementById('ticket-tecnico').innerText = tecnico;
    document.getElementById('ticket-respaldo').innerText = orden.requiereRespaldo ? 'SÍ (REQUERIDO POR CLIENTE)' : 'NO';
    document.getElementById('ticket-problema').innerText = orden.problemaReportado || 'N/A';
    document.getElementById('ticket-notas').innerText = orden.notasEspeciales || 'Sin notas especiales';
    document.getElementById('ticket-print-token').innerText = token;

    // qr con el token
    generarQRTicket('modal-ticket-qr', orden.tokenSeguimiento, 130);
    generarQRTicket('ticket-print-qr', orden.tokenSeguimiento, 150);

    document.getElementById('modal-ticket').classList.add('active');
}

// cierra modal de visualización de ticket
function cerrarModalTicket() {
    document.getElementById('modal-ticket').classList.remove('active');
}

// dialog de impresión del navegador
function imprimirTicketActual() {
    window.print();
}

window.onload = inicializarDashboard;
