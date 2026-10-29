// controlador de facturación y liquidación de órdenes
let ordenesCache = [];
let ordenSeleccionada = null;
let repuestosConsumidos = [];
let subtotalRepuestos = 0;
let facturaActiva = null;

// Inicializa módulo de facturación para administradores
async function inicializarModuloFacturacion() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('facturas');
    renderHeaderUsuario();

    await Promise.all([
        cargarOrdenesParaFacturar(),
        cargarFacturasEmitidas()
    ]);

    document.getElementById('ordenFacturaSelect').addEventListener('change', async function(e) {
        const id = parseInt(e.target.value);
        if (id) {
            await seleccionarOrdenFactura(id);
        } else {
            deseleccionarOrdenFactura();
        }
    });

    document.getElementById('costoManoObra').addEventListener('input', recalcularTotales);

    const urlParams = new URLSearchParams(window.location.search);
    const idOrdenParam = urlParams.get('idOrden');
    if (idOrdenParam) {
        const select = document.getElementById('ordenFacturaSelect');
        select.value = idOrdenParam;
        await seleccionarOrdenFactura(parseInt(idOrdenParam));
    }
}

// carga órdenes disponibles para facturación
async function cargarOrdenesParaFacturar() {
    try {
        const data = await apiFetch('/ordenes');
        ordenesCache = data || [];

        const select = document.getElementById('ordenFacturaSelect');
        select.innerHTML = '<option value="">-- Seleccionar Orden para Facturar --</option>';

        ordenesCache.forEach(o => {
            const cliente = o.idEquipo && o.idEquipo.idCliente ? o.idEquipo.idCliente.nombreCliente : 'Cliente N/A';
            const equipo = o.idEquipo ? o.idEquipo.marcaModelo : 'Equipo';
            select.innerHTML += `
                <option value="${o.idOrden}">
                    #ORD-${o.idOrden} | ${equipo} — ${cliente} [${o.estadoReparacion}]
                </option>
            `;
        });
    } catch (err) {
        console.error('Error al cargar órdenes para facturar:', err);
    }
}

// carga detalle y repuestos de la orden seleccionada para liquidar
async function seleccionarOrdenFactura(idOrden) {
    const orden = ordenesCache.find(o => o.idOrden === idOrden);
    if (!orden) return;
    ordenSeleccionada = orden;

    document.getElementById('formulario-factura-detalles').style.display = 'block';

    const cliente = orden.idEquipo && orden.idEquipo.idCliente ? orden.idEquipo.idCliente : {};
    const equipo = orden.idEquipo || {};
    const tecnico = orden.idUsuarioTecnico ? orden.idUsuarioTecnico.nombreCompleto : 'No asignado';

    document.getElementById('factura-cliente-nombre').innerText = `${cliente.nombreCliente || 'N/A'} (Tel: ${cliente.telefono || 'N/A'})`;
    document.getElementById('factura-equipo-desc').innerText = `${equipo.marcaModelo || 'N/A'} (Serie: ${equipo.numeroSerie || 'N/A'})`;
    document.getElementById('factura-tecnico-nombre').innerText = tecnico;

    await verificarFacturaPrevia(idOrden);
    await cargarDetalleRepuestos(idOrden);
    recalcularTotales();
}

// Restablece la vista si no hay orden seleccionada
function deseleccionarOrdenFactura() {
    ordenSeleccionada = null;
    facturaActiva = null;
    document.getElementById('formulario-factura-detalles').style.display = 'none';
    document.getElementById('contenedor-aviso-existente').style.display = 'none';
}

// Valida si la orden ya cuenta con una factura emitida
async function verificarFacturaPrevia(idOrden) {
    const contenedorAviso = document.getElementById('contenedor-aviso-existente');
    const btnEmitir = document.getElementById('btnEmitirFactura');
    const btnImprimir = document.getElementById('btnImprimirFacturaDirecta');

    try {
        const resp = await fetch(`http://localhost:8080/api/facturas/orden/${idOrden}`);
        if (resp.ok) {
            facturaActiva = await resp.json();
            const total = facturaActiva.total !== undefined ? facturaActiva.total : facturaActiva.totalFactura;
            contenedorAviso.style.display = 'block';
            contenedorAviso.innerHTML = `
                <div class="alert-box-warning">
                    <strong>Factura ya emitida:</strong> Esta orden cuenta con la <strong>Factura #FAC-${facturaActiva.idFactura}</strong> 
                    emitida el ${formatearFecha(facturaActiva.fechaEmision)} por un total de <strong>${formatearMoneda(total)}</strong>.
                    <br><small>No se permite emitir comprobantes duplicados para una misma orden.</small>
                </div>
            `;
            btnEmitir.style.display = 'none';
            btnImprimir.style.display = 'block';
            document.getElementById('costoManoObra').value = facturaActiva.costoManoObra || 0;
            document.getElementById('costoManoObra').disabled = true;
            document.getElementById('metodoPago').value = facturaActiva.metodoPago || 'Efectivo';
            document.getElementById('metodoPago').disabled = true;
        } else {
            facturaActiva = null;
            contenedorAviso.style.display = 'none';
            btnEmitir.style.display = 'block';
            btnImprimir.style.display = 'none';
            document.getElementById('costoManoObra').disabled = false;
            document.getElementById('metodoPago').disabled = false;
        }
    } catch (err) {
        console.error('Error al verificar factura previa:', err);
    }
}

// Carga  repuestos utilizados en la orden
async function cargarDetalleRepuestos(idOrden) {
    const tbody = document.getElementById('tabla-repuestos-factura');
    try {
        const detalles = await apiFetch(`/repuestos/orden/${idOrden}`);
        repuestosConsumidos = detalles || [];
        subtotalRepuestos = 0;

        if (repuestosConsumidos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state-card" style="padding: 8px;">No se utilizaron repuestos de inventario.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        repuestosConsumidos.forEach(d => {
            const sub = (d.cantidad || 0) * (d.precioUnitario || 0);
            subtotalRepuestos += sub;
            const repuestoNombre = d.idRepuesto ? d.idRepuesto.nombreRepuesto : 'Repuesto';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${repuestoNombre}</strong></td>
                <td>${d.cantidad}</td>
                <td>${formatearMoneda(d.precioUnitario)}</td>
                <td><strong>${formatearMoneda(sub)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar repuestos de orden:', err);
    }
}

// calcula monto total sumando repuestos y mano de obra
function recalcularTotales() {
    const manoObra = parseFloat(document.getElementById('costoManoObra').value) || 0;
    const total = subtotalRepuestos + manoObra;

    document.getElementById('calc-repuestos').innerText = formatearMoneda(subtotalRepuestos);
    document.getElementById('calc-mano-obra').innerText = formatearMoneda(manoObra);
    document.getElementById('calc-total-final').innerText = formatearMoneda(total);
}

// gen y reg la factura en el sistema
document.getElementById('formGenerarFactura').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    const usuarioActivo = getUsuarioActivo();
    const manoObra = parseFloat(document.getElementById('costoManoObra').value) || 0;
    const metodoPago = document.getElementById('metodoPago').value;

    const btnSubmit = document.getElementById('btnEmitirFactura');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Calculando y Facturando...';

    const payload = {
        idOrden: ordenSeleccionada.idOrden,
        costoManoObra: manoObra,
        metodoPago: metodoPago,
        idUsuario: usuarioActivo.idUsuario
    };

    try {
        const nuevaFactura = await apiFetch('/facturas', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        facturaActiva = nuevaFactura;
        const total = nuevaFactura.total !== undefined ? nuevaFactura.total : nuevaFactura.totalFactura;
        mostrarNotificacion(`Factura #FAC-${nuevaFactura.idFactura} emitida exitosamente. Total: ${formatearMoneda(total)}`, 'success');

        await cargarFacturasEmitidas();
        await verificarFacturaPrevia(ordenSeleccionada.idOrden);
        
        prepararImpresionFactura(nuevaFactura);
    } catch (err) {
        console.error('Error al emitir factura:', err);
        alert(err.message || 'Error al emitir factura para esta orden.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Generar y Emitir Factura';
    }
});

// historial de facturas registradas
async function cargarFacturasEmitidas() {
    const tbody = document.getElementById('tabla-facturas-emitidas');
    try {
        const data = await apiFetch('/facturas');
        const facturas = data || [];

        if (facturas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">No hay facturas emitidas registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        facturas.forEach(f => {
            const total = f.total !== undefined ? f.total : f.totalFactura;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#FAC-${f.idFactura}</strong></td>
                <td>#ORD-${f.idOrden ? f.idOrden.idOrden : 'N/A'}</td>
                <td>${formatearFecha(f.fechaEmision)}</td>
                <td><strong style="color:#34d399;">${formatearMoneda(total)}</strong></td>
                <td><span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa;">${f.metodoPago}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="verFacturaEmitida(${f.idFactura})">
                        Imprimir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar facturas:', err);
    }
}

// Carga los datos de una factura para imprimir
async function verFacturaEmitida(idFactura) {
    try {
        const f = await apiFetch(`/facturas/${idFactura}`);
        if (f.idOrden && f.idOrden.idOrden) {
            repuestosConsumidos = await apiFetch(`/repuestos/orden/${f.idOrden.idOrden}`) || [];
        }
        prepararImpresionFactura(f);
        window.print();
    } catch (err) {
        console.error('Error al cargar factura para imprimir:', err);
    }
}

// Llena la plantilla de impresión física
function prepararImpresionFactura(f) {
    const orden = f.idOrden || {};
    const equipo = orden.idEquipo || {};
    const cliente = equipo.idCliente || {};
    const total = f.total !== undefined ? f.total : f.totalFactura;

    document.getElementById('print-fac-numero').innerText = `#FAC-${f.idFactura}`;
    document.getElementById('print-fac-fecha').innerText = `Fecha: ${formatearFecha(f.fechaEmision)}`;
    document.getElementById('print-fac-cliente').innerText = cliente.nombreCliente || 'Consumidor Final';
    document.getElementById('print-fac-telefono').innerText = cliente.telefono || 'N/A';
    document.getElementById('print-fac-correo').innerText = cliente.email || 'N/A';

    document.getElementById('print-fac-orden').innerText = `#ORD-${orden.idOrden || 'N/A'}`;
    document.getElementById('print-fac-equipo').innerText = equipo.marcaModelo || 'Dispositivo';
    document.getElementById('print-fac-serie').innerText = equipo.numeroSerie || 'N/A';

    const tbody = document.getElementById('print-fac-items');
    tbody.innerHTML = '';

    if (repuestosConsumidos && repuestosConsumidos.length > 0) {
        repuestosConsumidos.forEach(r => {
            const sub = (r.cantidad || 0) * (r.precioUnitario || 0);
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 6px;">${r.cantidad}</td>
                    <td style="padding: 6px;">${r.idRepuesto ? r.idRepuesto.nombreRepuesto : 'Repuesto de Hardware'}</td>
                    <td style="padding: 6px; text-align: right;">${formatearMoneda(r.precioUnitario)}</td>
                    <td style="padding: 6px; text-align: right;">${formatearMoneda(sub)}</td>
                </tr>
            `;
        });
    }

    tbody.innerHTML += `
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 6px;">1</td>
            <td style="padding: 6px;">Servicio Técnico Especializado de Reparación y Mano de Obra</td>
            <td style="padding: 6px; text-align: right;">${formatearMoneda(f.costoManoObra)}</td>
            <td style="padding: 6px; text-align: right;">${formatearMoneda(f.costoManoObra)}</td>
        </tr>
    `;

    document.getElementById('print-fac-sub-rep').innerText = formatearMoneda(f.costoRepuestos);
    document.getElementById('print-fac-sub-mo').innerText = formatearMoneda(f.costoManoObra);
    document.getElementById('print-fac-total').innerText = formatearMoneda(total);
    document.getElementById('print-fac-metodo').innerText = f.metodoPago || 'Efectivo';
}

// Lanza diálogo de impresión de la factura activa
function imprimirFacturaActual() {
    if (facturaActiva) {
        prepararImpresionFactura(facturaActiva);
        window.print();
    }
}

window.onload = inicializarModuloFacturacion;
