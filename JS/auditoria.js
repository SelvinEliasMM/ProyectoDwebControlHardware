// contr de visualizacion de audit y trazabilidad inmutable
let ordenesCache = [];

// Inicializa el modulo de auditoria para usuarios administradores
async function inicializarModuloAuditoria() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('auditoria');
    renderHeaderUsuario();

    await cargarSelectOrdenes();

    document.getElementById('ordenAuditoriaSelect').addEventListener('change', function(e) {
        const id = parseInt(e.target.value);
        if (id) {
            cargarHistorialDeOrden(id);
        } else {
            document.getElementById('tabla-historial-estados').innerHTML = `
                <tr><td colspan="6" class="empty-state-card">Seleccione una orden para ver su trazabilidad.</td></tr>
            `;
        }
    });
}

// Conmuta entre las pestañas 
function cambiarTabAuditoria(tab) {
    const seccionEstados = document.getElementById('seccion-estados');
    const seccionBitacora = document.getElementById('seccion-bitacora');
    const btnEstados = document.getElementById('tab-estados-btn');
    const btnBitacora = document.getElementById('tab-bitacora-btn');

    if (tab === 'estados') {
        seccionEstados.style.display = 'block';
        seccionBitacora.style.display = 'none';
        btnEstados.classList.add('active');
        btnBitacora.classList.remove('active');
    } else {
        seccionEstados.style.display = 'none';
        seccionBitacora.style.display = 'block';
        btnEstados.classList.remove('active');
        btnBitacora.classList.add('active');
        cargarBitacoraGeneral();
    }
}

// Carga las órdenes disponibles en el selector
async function cargarSelectOrdenes() {
    try {
        const data = await apiFetch('/ordenes');
        ordenesCache = data || [];

        const select = document.getElementById('ordenAuditoriaSelect');
        select.innerHTML = '<option value="">-- Seleccionar Orden para Auditar --</option>';

        ordenesCache.forEach(o => {
            const cliente = o.idEquipo && o.idEquipo.idCliente ? o.idEquipo.idCliente.nombreCliente : 'Cliente N/A';
            const equipo = o.idEquipo ? o.idEquipo.marcaModelo : 'Equipo';
            select.innerHTML += `
                <option value="${o.idOrden}">
                    #ORD-${o.idOrden} | ${equipo} — ${cliente} [${o.estadoReparacion}]
                </option>
            `;
        });

        if (ordenesCache.length > 0) {
            select.value = ordenesCache[0].idOrden;
            await cargarHistorialDeOrden(ordenesCache[0].idOrden);
        }
    } catch (err) {
        console.error('Error al cargar órdenes para auditoría:', err);
    }
}

// Carga las transiciones cronológicas de estado de una orden
async function cargarHistorialDeOrden(idOrden) {
    const tbody = document.getElementById('tabla-historial-estados');
    const titulo = document.getElementById('titulo-historial-orden');
    titulo.innerText = `Línea de Tiempo de Estados - Orden #ORD-${idOrden}`;

    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">Consultando historial inmutable...</td></tr>`;

    try {
        const data = await apiFetch(`/auditoria/orden/${idOrden}`);
        const historial = data || [];

        if (historial.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">No hay cambios de estado registrados para esta orden (aún en estado inicial).</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        historial.forEach(h => {
            const usuario = h.idUsuario ? h.idUsuario.nombreCompleto : 'Sistema';
            const rol = h.idUsuario ? h.idUsuario.rol : 'Automático';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${formatearFecha(h.fechaCambio)}</strong></td>
                <td><span class="badge" style="background:rgba(156,163,175,0.2); color:#d1d5db;">${h.estadoAnterior || 'Ingreso Inicial'}</span></td>
                <td><span class="badge ready">${h.estadoNuevo}</span></td>
                <td><strong>${usuario}</strong></td>
                <td><span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa;">${rol}</span></td>
                <td class="field-help-text">${h.comentario || h.observaciones || 'Transición de estado regular'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar historial de orden:', err);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Error al consultar trazabilidad de la orden.</td></tr>`;
    }
}

// Refresh la orden seleccionada actualmente
function cargarHistorialOrdenSeleccionada() {
    const select = document.getElementById('ordenAuditoriaSelect');
    const id = parseInt(select.value);
    if (id) {
        cargarHistorialDeOrden(id);
    }
}

// formatea texto o json de bitacora
function limpiarTextoBitacora(raw) {
    if (!raw) return '';
    const txt = String(raw).trim();
    if (txt.startsWith('[') || txt.startsWith('{')) {
        try {
            const parsed = JSON.parse(txt);
            const obj = Array.isArray(parsed) ? parsed[0] : parsed;
            if (obj && typeof obj === 'object') {
                return Object.entries(obj)
                    .filter(([k, v]) => v !== null && v !== '' && !k.includes('fecha'))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ');
            }
        } catch (e) {
            return txt;
        }
    }
    return txt;
}

// obtiene id de registro afectado
function obtenerIdRegistroBitacora(b) {
    const raw = b.datosNuevos || b.datosOriginales || '';
    if (typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))) {
        try {
            const parsed = JSON.parse(raw);
            const obj = Array.isArray(parsed) ? parsed[0] : parsed;
            if (obj) {
                const idVal = obj.id_equipo || obj.id_orden || obj.id_cliente || obj.id_repuesto || obj.id_factura || obj.id_usuario;
                if (idVal) return idVal;
            }
        } catch (e) {}
    }
    return b.idBitacora || b.registroId || 1;
}

// Carga registros de la bitácora general de base de datos
async function cargarBitacoraGeneral() {
    const tbody = document.getElementById('tabla-bitacora-general');
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">Consultando registros de auditoría...</td></tr>`;

    try {
        const data = await apiFetch('/auditoria/bitacora');
        const logs = data || [];

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">No hay registros en la bitácora aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        logs.forEach(b => {
            const accion = b.accionRealizada || b.accion || 'OPERACIÓN';
            let opBadge = 'badge';
            if (accion === 'INSERT') opBadge = 'badge ready';
            else if (accion === 'UPDATE') opBadge = 'badge diag';
            else if (accion === 'DELETE') opBadge = 'badge danger';

            const usuario = b.idUsuario ? b.idUsuario.nombreCompleto : 'Sistema';
            const idReg = obtenerIdRegistroBitacora(b);
            const nuevos = limpiarTextoBitacora(b.datosNuevos || b.valoresNuevos);
            const orig = limpiarTextoBitacora(b.datosOriginales || b.valoresAnteriores);
            const detalle = nuevos || orig || 'Operación registrada';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatearFecha(b.fechaHora)}</td>
                <td><code>${b.tablaAfectada || 'SISTEMA'}</code></td>
                <td><span class="${opBadge}">${accion}</span></td>
                <td>#${idReg}</td>
                <td><strong>${usuario}</strong></td>
                <td style="font-size:0.82rem; color:var(--text-muted); max-width:340px;">
                    ${detalle}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar bitácora general:', err);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar bitácora del sistema.</td></tr>`;
    }
}

window.onload = inicializarModuloAuditoria;
