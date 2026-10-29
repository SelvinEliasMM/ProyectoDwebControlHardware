// controlador de taller registro de diagnósticos y tambien asignación de repuestos
let ordenesCache = [];
let ordenActual = null;
let repuestosCatalogo = [];

// inic el módulo de taller y atención técnica
async function inicializarModuloDiagnostico() {
    const usuario = verificarSesion();
    if (!usuario) return;

    renderSidebar('diagnostico');
    renderHeaderUsuario();

    await cargarOrdenesTaller();

    const urlParams = new URLSearchParams(window.location.search);
    const idOrdenParam = urlParams.get('idOrden');
    if (idOrdenParam) {
        const select = document.getElementById('ordenSelect');
        select.value = idOrdenParam;
        await seleccionarOrden(parseInt(idOrdenParam));
    }

    document.getElementById('ordenSelect').addEventListener('change', function(e) {
        const id = parseInt(e.target.value);
        if (id) {
            seleccionarOrden(id);
        } else {
            deseleccionarOrden();
        }
    });
}

// carga las ords en taller para el selector
async function cargarOrdenesTaller() {
    const usuario = getUsuarioActivo();
    try {
        const data = await apiFetch('/ordenes');
        ordenesCache = data || [];

        const select = document.getElementById('ordenSelect');
        select.innerHTML = '<option value="">-- Seleccionar Orden de Trabajo --</option>';

        ordenesCache.forEach(o => {
            const cliente = o.idEquipo && o.idEquipo.idCliente ? o.idEquipo.idCliente.nombreCliente : 'Cliente N/A';
            const equipo = o.idEquipo ? o.idEquipo.marcaModelo : 'Equipo';
            const esMio = o.idUsuarioTecnico && o.idUsuarioTecnico.idUsuario === usuario.idUsuario;
            const prefijo = esMio ? '(Asignada a mí) ' : '';

            select.innerHTML += `
                <option value="${o.idOrden}">
                    ${prefijo}#ORD-${o.idOrden} | ${equipo} — ${cliente} [${o.estadoReparacion}]
                </option>
            `;
        });
    } catch (err) {
        console.error('Error al cargar órdenes:', err);
        mostrarNotificacion('Error al cargar órdenes de trabajo.', 'error');
    }
}

// carga y despl la información tecnica de la orden seleccionada
async function seleccionarOrden(idOrden) {
    const orden = ordenesCache.find(o => o.idOrden === idOrden);
    if (!orden) return;
    ordenActual = orden;

    document.getElementById('panel-sin-seleccion').style.display = 'none';
    document.getElementById('panel-orden-activa').style.display = 'block';

    const cliente = orden.idEquipo && orden.idEquipo.idCliente ? orden.idEquipo.idCliente : {};
    const equipo = orden.idEquipo || {};

    document.getElementById('info-ticket').innerText = `#ORD-${orden.idOrden}`;
    document.getElementById('info-cliente').innerText = cliente.nombreCliente || 'N/A';
    document.getElementById('info-equipo').innerText = `${equipo.marcaModelo || 'N/A'} (Serie: ${equipo.numeroSerie || 'N/A'})`;
    
    actualizarBadgeEstado(orden.estadoReparacion);

    const banner = document.getElementById('banner-respaldo-alerta');
    if (orden.requiereRespaldo) {
        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="alert-box-danger">
                <h3 style="color:#ef4444; margin:0 0 4px 0; font-size:1.05rem;">ADVERTENCIA: RESPALDO DE INFORMACIÓN REQUERIDO</h3>
                <p style="margin:0; font-size:0.9rem;">El cliente solicitó explícitamente conservar sus archivos personales. Realice una copia de seguridad antes de cualquier procedimiento de formateo o cambio de almacenamiento.</p>
            </div>
        `;
    } else {
        banner.style.display = 'none';
    }

    await Promise.all([
        cargarDiagnosticosDeOrden(idOrden),
        cargarRepuestosDisponibles(),
        cargarRepuestosConsumidos(idOrden)
    ]);
}

// ocult  panel activo cuando no hay orden seleccionada
function deseleccionarOrden() {
    ordenActual = null;
    document.getElementById('panel-sin-seleccion').style.display = 'block';
    document.getElementById('panel-orden-activa').style.display = 'none';
}

// act el distintivo del estado de reparación
function actualizarBadgeEstado(estado) {
    const contenedor = document.getElementById('info-estado');
    let badgeClass = 'badge recibido';
    if (estado === 'En Diagnóstico') badgeClass = 'badge diag';
    else if (estado === 'Reparado') badgeClass = 'badge ready';
    else if (estado === 'Entregado') badgeClass = 'badge entregado';

    contenedor.innerHTML = `<span class="${badgeClass}">${estado}</span>`;
}

// consulta el historial de diagnósticos previos de la orden
async function cargarDiagnosticosDeOrden(idOrden) {
    const contenedor = document.getElementById('lista-diagnosticos');
    contenedor.innerHTML = '<p class="field-help-text">Consultando diagnósticos previos...</p>';

    try {
        const data = await apiFetch(`/diagnosticos/orden/${idOrden}`);
        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p class="field-help-text" style="font-style:italic;">No hay diagnósticos registrados para esta orden aún.</p>';
            return;
        }

        contenedor.innerHTML = '';
        data.forEach(d => {
            const fecha = formatearFecha(d.fechaDiagnostico);
            const tecnico = d.idTecnico ? d.idTecnico.nombreCompleto : 'Técnico';
            const item = document.createElement('div');
            item.className = 'summary-box';
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.8rem; color:var(--text-muted);">
                    <strong>${tecnico}</strong>
                    <span>${fecha}</span>
                </div>
                <p style="margin:0 0 6px 0;"><strong>Hallazgo:</strong> ${d.diagnosticoTecnico}</p>
                ${d.solucionPropuesta ? `<p style="margin:0; color:#93c5fd;"><strong>Solución:</strong> ${d.solucionPropuesta}</p>` : ''}
            `;
            contenedor.appendChild(item);
        });
    } catch (err) {
        console.error('Error al cargar diagnósticos:', err);
    }
}

// selector con repuestos que cuentan con existencias
async function cargarRepuestosDisponibles() {
    const select = document.getElementById('repuestoSelect');
    try {
        const data = await apiFetch('/repuestos');
        repuestosCatalogo = data || [];

        select.innerHTML = '<option value="">-- Seleccionar Repuesto en Stock --</option>';
        repuestosCatalogo.forEach(r => {
            const stockActual = r.stock !== undefined ? r.stock : r.stockActual;
            const precio = r.precioVenta !== undefined ? r.precioVenta : r.precioUnitario;
            const deshabilitado = stockActual <= 0 ? 'disabled' : '';
            const alertaStock = stockActual <= 0 ? '(AGOTADO)' : `(Stock: ${stockActual})`;

            select.innerHTML += `
                <option value="${r.idRepuesto}" ${deshabilitado}>
                    ${r.nombreRepuesto} — ${formatearMoneda(precio)} ${alertaStock}
                </option>
            `;
        });
    } catch (err) {
        console.error('Error al cargar catálogo para taller:', err);
    }
}

// Consulta y lista los repuestos consumidos 
async function cargarRepuestosConsumidos(idOrden) {
    const tbody = document.getElementById('tabla-repuestos-orden');
    const totalSpan = document.getElementById('total-repuestos-monto');

    try {
        const detalles = await apiFetch(`/repuestos/orden/${idOrden}`);
        if (!detalles || detalles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state-card" style="padding: 10px;">No se han consumido repuestos en esta orden.</td></tr>`;
            totalSpan.innerText = formatearMoneda(0);
            return;
        }

        tbody.innerHTML = '';
        let totalAcumulado = 0;

        detalles.forEach(d => {
            const subtotal = (d.cantidad || 0) * (d.precioUnitario || 0);
            totalAcumulado += subtotal;
            const repuestoNombre = d.idRepuesto ? d.idRepuesto.nombreRepuesto : 'Repuesto';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${repuestoNombre}</strong></td>
                <td>${d.cantidad}</td>
                <td>${formatearMoneda(d.precioUnitario)}</td>
                <td><strong>${formatearMoneda(subtotal)}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        totalSpan.innerText = formatearMoneda(totalAcumulado);
    } catch (err) {
        console.error('Error al cargar repuestos consumidos:', err);
    }
}

// Guarda una nueva evaluación diagnostica
document.getElementById('formDiagnostico').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!ordenActual) return;

    const usuarioActivo = getUsuarioActivo();
    const btnSubmit = document.getElementById('btnGuardarDiagnostico');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Guardando diagnóstico...';

    const nuevoDiagnostico = {
        idOrden: { idOrden: ordenActual.idOrden },
        diagnosticoTecnico: document.getElementById('diagnosticoTecnico').value.trim(),
        solucionPropuesta: document.getElementById('solucionPropuesta').value.trim(),
        idTecnico: { idUsuario: usuarioActivo.idUsuario }
    };

    try {
        await apiFetch(`/diagnosticos?idUsuario=${usuarioActivo.idUsuario}`, {
            method: 'POST',
            body: JSON.stringify(nuevoDiagnostico)
        });

        mostrarNotificacion('Diagnóstico guardado y orden actualizada a "En Diagnóstico".', 'success');
        document.getElementById('formDiagnostico').reset();
        
        ordenActual.estadoReparacion = 'En Diagnóstico';
        actualizarBadgeEstado('En Diagnóstico');

        await cargarDiagnosticosDeOrden(ordenActual.idOrden);
        await cargarOrdenesTaller();
    } catch (err) {
        console.error('Error al guardar diagnóstico:', err);
        alert(err.message || 'Error al registrar el diagnóstico técnico.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Guardar Diagnóstico y Marcar "En Diagnóstico"';
    }
});

// asigna un repuesto del inventario a la orden deduciendo el stock
document.getElementById('formAsignarRepuesto').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!ordenActual) return;

    const idRepuesto = parseInt(document.getElementById('repuestoSelect').value);
    const cantidad = parseInt(document.getElementById('cantidadRepuesto').value);
    const usuarioActivo = getUsuarioActivo();

    if (!idRepuesto || cantidad <= 0) {
        alert('Seleccione un repuesto válido y una cantidad mayor a cero.');
        return;
    }

    const btnSubmit = document.getElementById('btnAsignarRepuesto');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Descontando de inventario...';

    const payload = {
        idOrden: ordenActual.idOrden,
        idRepuesto: idRepuesto,
        cantidad: cantidad,
        idUsuario: usuarioActivo.idUsuario
    };

    try {
        await apiFetch('/repuestos/asignar', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        mostrarNotificacion('Repuesto descontado de inventario y asignado a la orden exitosamente.', 'success');
        document.getElementById('cantidadRepuesto').value = '1';

        await Promise.all([
            cargarRepuestosConsumidos(ordenActual.idOrden),
            cargarRepuestosDisponibles()
        ]);
    } catch (err) {
        console.error('Error al asignar repuesto:', err);
        alert(err.message || 'Error al asignar repuesto a la orden.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Consumir Repuesto';
    }
});

// Mod el estado de reparacion con validacion  de autorización
async function cambiarEstadoOrden(nuevoEstado) {
    if (!ordenActual) return;

    const confirmacion = confirm(`¿Confirma cambiar el estado de la orden #ORD-${ordenActual.idOrden} a "${nuevoEstado}"?`);
    if (!confirmacion) return;

    const usuarioActivo = getUsuarioActivo();

    try {
        await apiFetch(`/ordenes/${ordenActual.idOrden}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                estado: nuevoEstado,
                idUsuarioModificacion: usuarioActivo.idUsuario.toString()
            })
        });

        ordenActual.estadoReparacion = nuevoEstado;
        actualizarBadgeEstado(nuevoEstado);
        mostrarNotificacion(`Estado de orden actualizado a "${nuevoEstado}".`, 'success');
        await cargarOrdenesTaller();
    } catch (err) {
        console.error('Error al cambiar estado de orden:', err);
        alert(err.message || 'No tiene permisos para modificar el estado de esta orden.');
    }
}

window.onload = inicializarModuloDiagnostico;
