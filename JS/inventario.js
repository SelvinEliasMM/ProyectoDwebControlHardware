// Controlador de inventario de repuestos y movimientos de Kardex
let repuestosCache = [];
let kardexCache = [];

// inic modulo solo para admin
async function inicializarModuloInventario() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('inventario');
    renderHeaderUsuario();

    await cargarCatalogoRepuestos();
    configurarBuscadorRepuestos();
}

//  vista entre catálogo y Kardex
function cambiarTab(tab) {
    const catalogoTab = document.getElementById('seccion-catalogo');
    const kardexTab = document.getElementById('seccion-kardex');
    const btnCatalogo = document.getElementById('tab-catalogo-btn');
    const btnKardex = document.getElementById('tab-kardex-btn');

    if (tab === 'catalogo') {
        catalogoTab.style.display = 'block';
        kardexTab.style.display = 'none';
        btnCatalogo.classList.add('active');
        btnKardex.classList.remove('active');
    } else {
        catalogoTab.style.display = 'none';
        kardexTab.style.display = 'block';
        btnCatalogo.classList.remove('active');
        btnKardex.classList.add('active');
        cargarKardex();
    }
}

//  lista completa de repuestos
async function cargarCatalogoRepuestos() {
    try {
        const data = await apiFetch('/repuestos');
        repuestosCache = data || [];
        renderizarTablaRepuestos(repuestosCache);

        const stockBajo = repuestosCache.filter(r => (r.stock !== undefined ? r.stock : r.stockActual) <= r.stockMinimo);
        const spanResumen = document.getElementById('resumen-stock-bajo');
        if (spanResumen) {
            spanResumen.innerText = stockBajo.length > 0
                ? `Alerta: ${stockBajo.length} producto(s) en nivel crítico de inventario`
                : 'Niveles de inventario óptimos';
            spanResumen.style.color = stockBajo.length > 0 ? '#f87171' : '#34d399';
        }
    } catch (err) {
        console.error('Error al cargar repuestos:', err);
        mostrarNotificacion('Error al consultar el catálogo de inventario.', 'error');
    }
}

// render de los repuestos en la tabla
function renderizarTablaRepuestos(repuestos) {
    const tbody = document.getElementById('tabla-repuestos');
    if (repuestos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state-card">No hay repuestos registrados en el catálogo.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    repuestos.forEach(r => {
        const stockActual = r.stock !== undefined ? r.stock : r.stockActual;
        const precioUnitario = r.precioVenta !== undefined ? r.precioVenta : r.precioUnitario;
        const esBajo = stockActual <= r.stockMinimo;
        const badgeClass = esBajo ? 'badge baja-stock' : 'badge ready';
        const badgeTexto = esBajo ? 'STOCK BAJO' : 'NORMAL';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${r.codigoRepuesto}</code></td>
            <td><strong>${r.nombreRepuesto}</strong></td>
            <td class="field-help-text">${r.descripcion || 'Sin descripción'}</td>
            <td><strong>${formatearMoneda(precioUnitario)}</strong></td>
            <td>
                <span style="font-size:1.1rem; font-weight:bold; color:${stockActual === 0 ? '#ef4444' : '#ffffff'};">
                    ${stockActual}
                </span> unidades
            </td>
            <td>${r.stockMinimo}</td>
            <td><span class="${badgeClass}">${badgeTexto}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="verKardexRepuesto(${r.idRepuesto}, '${r.nombreRepuesto}')" title="Ver movimientos">
                    Movimientos
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// filtr búsqueda en catálogo de repuestos
function configurarBuscadorRepuestos() {
    const inputBuscar = document.getElementById('buscarRepuesto');
    if (!inputBuscar) return;

    inputBuscar.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        const filtrados = repuestosCache.filter(r => {
            const nom = (r.nombreRepuesto || '').toLowerCase();
            const cod = (r.codigoRepuesto || '').toLowerCase();
            const desc = (r.descripcion || '').toLowerCase();
            return nom.includes(query) || cod.includes(query) || desc.includes(query);
        });
        renderizarTablaRepuestos(filtrados);
    });
}

//  movimientos recientes de auditoría de inventario krdex
async function cargarKardex() {
    const tbody = document.getElementById('tabla-kardex');
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">Consultando movimientos de Kardex...</td></tr>`;

    try {
        const data = await apiFetch('/repuestos/kardex/ultimos');
        kardexCache = data || [];

        if (kardexCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-card">No se registran movimientos en el Kardex.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        kardexCache.forEach(m => {
            let tipoBadgeClass = 'badge mov-ajuste';
            if (m.tipoMovimiento === 'ENTRADA') tipoBadgeClass = 'badge mov-entrada';
            else if (m.tipoMovimiento === 'SALIDA') tipoBadgeClass = 'badge mov-salida';

            const repuestoNombre = m.idRepuesto ? m.idRepuesto.nombreRepuesto : 'N/A';
            const usuarioNombre = m.idUsuario ? m.idUsuario.nombreCompleto : 'Sistema';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatearFecha(m.fechaMovimiento)}</td>
                <td><strong>${repuestoNombre}</strong></td>
                <td><span class="${tipoBadgeClass}">${m.tipoMovimiento}</span></td>
                <td><strong>${m.tipoMovimiento === 'SALIDA' ? '-' : '+'}${m.cantidad}</strong></td>
                <td>${m.motivo || 'N/A'}</td>
                <td>${usuarioNombre}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar kardex:', err);
        mostrarNotificacion('Error al consultar movimientos del Kardex.', 'error');
    }
}

// historial de movimientos de un repuesto específico
async function verKardexRepuesto(idRepuesto, nombreRepuesto) {
    const modal = document.getElementById('modal-kardex-repuesto');
    const titulo = document.getElementById('modal-kardex-titulo');
    const contenido = document.getElementById('modal-kardex-contenido');

    titulo.innerText = `Kardex: ${nombreRepuesto}`;
    contenido.innerHTML = '<p class="empty-state-card">Cargando historial...</p>';
    modal.classList.add('active');

    try {
        const movimientos = await apiFetch(`/repuestos/${idRepuesto}/kardex`);
        if (!movimientos || movimientos.length === 0) {
            contenido.innerHTML = '<p class="empty-state-card">Este repuesto no tiene movimientos registrados aún.</p>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Motivo</th>
                        <th>Usuario</th>
                    </tr>
                </thead>
                <tbody>
        `;

        movimientos.forEach(m => {
            let tipoClass = m.tipoMovimiento === 'ENTRADA' ? 'badge mov-entrada' : 'badge mov-salida';
            html += `
                <tr>
                    <td>${formatearFecha(m.fechaMovimiento)}</td>
                    <td><span class="${tipoClass}">${m.tipoMovimiento}</span></td>
                    <td><strong>${m.tipoMovimiento === 'SALIDA' ? '-' : '+'}${m.cantidad}</strong></td>
                    <td>${m.motivo || 'Operación regular'}</td>
                    <td>${m.idUsuario ? m.idUsuario.nombreCompleto : 'Sistema'}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        contenido.innerHTML = html;
    } catch (err) {
        console.error('Error al cargar kardex del repuesto:', err);
        contenido.innerHTML = `<p style="color:#ef4444; padding:20px;">Error al consultar el Kardex del repuesto.</p>`;
    }
}


function cerrarModalKardexRepuesto() {
    document.getElementById('modal-kardex-repuesto').classList.remove('active');
}


function abrirModalNuevoRepuesto() {
    document.getElementById('formNuevoRepuesto').reset();
    document.getElementById('modal-nuevo-repuesto').classList.add('active');
}


function cerrarModalNuevoRepuesto() {
    document.getElementById('modal-nuevo-repuesto').classList.remove('active');
}

// Proc de registro de un nuevo repuesto y genera movimiento inicial en Kardex
document.getElementById('formNuevoRepuesto').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usuarioActivo = getUsuarioActivo();
    const btnSubmit = document.getElementById('btnGuardarRepuesto');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Guardando...';

    const precio = parseFloat(document.getElementById('precioRepuesto').value);

    const nuevoRepuesto = {
        codigoRepuesto: document.getElementById('codigoRepuesto').value.trim().toUpperCase(),
        nombreRepuesto: document.getElementById('nombreRepuesto').value.trim(),
        descripcion: document.getElementById('descripcionRepuesto').value.trim(),
        precioCosto: precio * 0.7,
        precioVenta: precio,
        precioUnitario: precio,
        stock: parseInt(document.getElementById('stockRepuesto').value),
        stockActual: parseInt(document.getElementById('stockRepuesto').value),
        stockMinimo: parseInt(document.getElementById('stockMinimoRepuesto').value)
    };

    try {
        const guardado = await apiFetch(`/repuestos?idUsuario=${usuarioActivo.idUsuario}`, {
            method: 'POST',
            body: JSON.stringify(nuevoRepuesto)
        });

        mostrarNotificacion(`Repuesto "${guardado.nombreRepuesto}" registrado exitosamente.`, 'success');
        cerrarModalNuevoRepuesto();
        await cargarCatalogoRepuestos();
    } catch (err) {
        console.error('Error al registrar repuesto:', err);
        alert(err.message || 'Error al guardar el nuevo repuesto en el catálogo.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Guardar en Catálogo';
    }
});

window.onload = inicializarModuloInventario;
