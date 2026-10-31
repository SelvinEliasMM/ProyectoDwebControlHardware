// contr de ordenes de trabajo y comprobantes
let ordenGeneradaCache = null;
let equiposCache = [];
let usuariosCache = [];

// inic modulo
async function inicializarModuloOrdenes() {
    const usuario = verificarSesion();
    if (!usuario) return;

    renderSidebar('ordenes');
    renderHeaderUsuario();

    await Promise.all([
        cargarEquipos(),
        cargarTecnicos()
    ]);
}

// carga equipos para selector
async function cargarEquipos() {
    try {
        const select = document.getElementById('equipoSelect');
        const equipos = await apiFetch('/equipos');
        equiposCache = equipos || [];

        select.innerHTML = '<option value="">-- Seleccione el Equipo a Ingresar --</option>';
        if (equiposCache.length === 0) {
            select.innerHTML = '<option value="">No hay equipos registrados. Registre uno primero.</option>';
            return;
        }

        equiposCache.forEach(eq => {
            const clienteNombre = eq.idCliente ? eq.idCliente.nombreCliente : 'Cliente no especificado';
            select.innerHTML += `
                <option value="${eq.idEquipo}">
                    ${eq.marcaModelo} (Serie: ${eq.numeroSerie}) — Cliente: ${clienteNombre}
                </option>
            `;
        });
    } catch (err) {
        console.error('Error al cargar equipos:', err);
        mostrarNotificacion('Error al cargar equipos registrados.', 'error');
    }
}

// carga tecnicos para asignacion
async function cargarTecnicos() {
    try {
        const select = document.getElementById('tecnicoSelect');
        const usuarios = await apiFetch('/usuarios');
        usuariosCache = usuarios || [];

        select.innerHTML = '<option value="">-- Asignar Técnico de Hardware --</option>';
        usuariosCache.forEach(user => {
            select.innerHTML += `
                <option value="${user.idUsuario}">
                    ${user.nombreCompleto} (${user.rol})
                </option>
            `;
        });
    } catch (err) {
        console.error('Error al cargar técnicos:', err);
        mostrarNotificacion('Error al cargar catálogo de usuarios.', 'error');
    }
}

// envio del form para crear orden
document.getElementById('formOrden').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usuarioActivo = getUsuarioActivo();
    const idEquipo = document.getElementById('equipoSelect').value;
    const idTecnico = document.getElementById('tecnicoSelect').value;
    const requiereRespaldoVal = document.getElementById('requiereRespaldo').value;
    const problema = document.getElementById('problema').value.trim();
    const notas = document.getElementById('notas').value.trim();

    if (requiereRespaldoVal === '') {
        alert('Debe especificar obligatoriamente si el cliente requiere respaldo de información.');
        document.getElementById('requiereRespaldo').focus();
        return;
    }

    const btnSubmit = document.getElementById('btnCrearOrden');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Generando Comprobante y Guardando...';

    const nuevaOrden = {
        idEquipo: { idEquipo: parseInt(idEquipo) },
        idUsuarioTecnico: { idUsuario: parseInt(idTecnico) },
        requiereRespaldo: requiereRespaldoVal === 'true',
        problemaReportado: problema,
        notasEspeciales: notas,
        estadoReparacion: 'Recibido',
        usuarioCreacion: { idUsuario: usuarioActivo.idUsuario }
    };

    try {
        const ordenGuardada = await apiFetch('/ordenes', {
            method: 'POST',
            body: JSON.stringify(nuevaOrden)
        });

        ordenGeneradaCache = ordenGuardada;

        mostrarModalTicket(ordenGuardada);
        mostrarNotificacion(`Orden generada. Código: ${ordenGuardada.tokenSeguimiento}`, 'success');
        document.getElementById('formOrden').reset();
    } catch (err) {
        console.error('Error al generar orden:', err);
        alert(err.message || 'Error al guardar la orden de trabajo.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Generar Orden y Emitir Comprobante';
    }
});

// modal con num de ticket
function mostrarModalTicket(orden) {
    const modalBody = document.getElementById('modal-exito-body');
    const equipo = equiposCache.find(e => e.idEquipo === (orden.idEquipo ? orden.idEquipo.idEquipo : null)) || (orden.idEquipo || {});
    const cliente = equipo.idCliente || {};
    const tecnico = usuariosCache.find(u => u.idUsuario === (orden.idUsuarioTecnico ? orden.idUsuarioTecnico.idUsuario : null)) || (orden.idUsuarioTecnico || {});
    const token = orden.tokenSeguimiento || 'Sin código';

    modalBody.innerHTML = `
        <div class="ticket-number-badge">
            <p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 4px;">CÓDIGO DE SEGUIMIENTO:</p>
            <div class="ticket-number-display">${token}</div>
            <div id="modal-exito-qr" class="qr-box"></div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Orden interna #ORD-${orden.idOrden}. Entregue el código o QR al cliente para el seguimiento.</p>
        </div>

        <div class="summary-box">
            <p><strong>Cliente:</strong> ${cliente.nombreCliente || 'N/A'}</p>
            <p><strong>Equipo:</strong> ${equipo.marcaModelo || 'N/A'} (Serie: ${equipo.numeroSerie || 'N/A'})</p>
            <p><strong>Técnico Asignado:</strong> ${tecnico.nombreCompleto || 'N/A'}</p>
            <p><strong>Respaldo de Información:</strong> 
                ${orden.requiereRespaldo ? '<span style="color:#f87171; font-weight:bold;">SÍ - Conservar datos del cliente</span>' : 'NO'}
            </p>
            <p><strong>Falla Reportada:</strong> ${orden.problemaReportado}</p>
        </div>
    `;

    document.getElementById('ticket-print-id').innerText = token;
    document.getElementById('ticket-print-fecha').innerText = formatearFecha(orden.fechaIngreso || new Date());
    document.getElementById('ticket-print-cliente').innerText = cliente.nombreCliente || 'N/A';
    document.getElementById('ticket-print-equipo').innerText = equipo.marcaModelo || 'N/A';
    document.getElementById('ticket-print-serie').innerText = equipo.numeroSerie || 'N/A';
    document.getElementById('ticket-print-tecnico').innerText = tecnico.nombreCompleto || 'N/A';
    document.getElementById('ticket-print-respaldo').innerText = orden.requiereRespaldo ? 'SÍ (REQUERIDO - NO BORRAR INFORMACIÓN)' : 'NO';
    document.getElementById('ticket-print-problema').innerText = orden.problemaReportado || 'N/A';
    document.getElementById('ticket-print-notas').innerText = orden.notasEspeciales || 'Sin notas especiales';
    document.getElementById('ticket-print-token').innerText = token;

    // qr con el token
    generarQRTicket('modal-exito-qr', orden.tokenSeguimiento, 130);
    generarQRTicket('ticket-print-qr', orden.tokenSeguimiento, 150);

    document.getElementById('modal-ticket-generado').classList.add('active');
}

// cierra modal
function cerrarModalExito() {
    document.getElementById('modal-ticket-generado').classList.remove('active');
}

// registrar otra orden
function crearOtraOrden() {
    cerrarModalExito();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// impresion
function imprimirTicketGenerado() {
    window.print();
}

window.onload = inicializarModuloOrdenes;
