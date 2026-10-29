// contr de registro y catálogo de equipos
let equiposCache = [];
let clientesCache = [];

// inicializa el catalogo y controles del módulo
async function inicializarModuloEquipos() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('equipos');
    renderHeaderUsuario();

    await Promise.all([
        cargarSelectClientes(),
        cargarEquipos()
    ]);

    configurarBuscador();
}

// carga listado de clientes para vincular al equipo
async function cargarSelectClientes() {
    try {
        const select = document.getElementById('clienteSelect');
        const clientes = await apiFetch('/clientes');
        clientesCache = clientes || [];

        select.innerHTML = '<option value="">-- Seleccione el Cliente Propietario --</option>';
        clientesCache.forEach(c => {
            select.innerHTML += `<option value="${c.idCliente}">${c.nombreCliente} (Tel: ${c.telefono || 'N/A'})</option>`;
        });
    } catch (err) {
        console.error('Error al cargar select de clientes:', err);
    }
}

// Obtiene los equipos registrados en el sistema
async function cargarEquipos() {
    try {
        const data = await apiFetch('/equipos');
        equiposCache = data || [];
        renderizarTablaEquipos(equiposCache);
    } catch (err) {
        console.error('Error al cargar equipos:', err);
        mostrarNotificacion('Error al obtener la lista de equipos.', 'error');
    }
}

// Renderiza 
function renderizarTablaEquipos(equipos) {
    const tbody = document.getElementById('tabla-equipos');
    if (equipos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state-card">No hay equipos registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    equipos.forEach(eq => {
        const clienteNombre = eq.idCliente ? eq.idCliente.nombreCliente : 'Sin cliente asignado';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#EQ-${eq.idEquipo}</strong></td>
            <td>
                <strong>${eq.marcaModelo}</strong>
                <div class="field-help-text">${eq.tipoEquipo || 'Equipo'}</div>
            </td>
            <td><code style="background:var(--input-bg); padding:3px 6px; border-radius:4px; color:#34d399;">${eq.numeroSerie}</code></td>
            <td>${clienteNombre}</td>
            <td style="font-size:0.85rem; color:var(--text-muted); max-width:260px;">${eq.caracteristicasHardware || 'Sin detalles'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtra la tabla de equipos 
function configurarBuscador() {
    const inputBuscar = document.getElementById('buscarEquipo');
    if (!inputBuscar) return;

    inputBuscar.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        const filtrados = equiposCache.filter(eq => {
            const serie = (eq.numeroSerie || '').toLowerCase();
            const marca = (eq.marcaModelo || '').toLowerCase();
            const cliente = (eq.idCliente && eq.idCliente.nombreCliente ? eq.idCliente.nombreCliente : '').toLowerCase();
            return serie.includes(query) || marca.includes(query) || cliente.includes(query);
        });
        renderizarTablaEquipos(filtrados);
    });
}

// Procesa el registro de un equipo 
document.getElementById('formEquipo').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usuarioActivo = getUsuarioActivo();
    const idCliente = document.getElementById('clienteSelect').value;
    const tipo = document.getElementById('tipo').value;
    const marca = document.getElementById('marca').value.trim();
    const serie = document.getElementById('serie').value.trim();
    const caracteristicas = document.getElementById('caracteristicas').value.trim();

    const btnSubmit = document.getElementById('btnGuardarEquipo');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Guardando dispositivo...';

    const nuevoEquipo = {
        idCliente: { idCliente: parseInt(idCliente) },
        tipoEquipo: tipo,
        marcaModelo: marca,
        numeroSerie: serie,
        caracteristicasHardware: caracteristicas,
        usuarioCreacion: { idUsuario: usuarioActivo.idUsuario }
    };

    try {
        const guardado = await apiFetch('/equipos', {
            method: 'POST',
            body: JSON.stringify(nuevoEquipo)
        });

        mostrarNotificacion(`Equipo "${guardado.marcaModelo}" guardado exitosamente.`, 'success');
        document.getElementById('formEquipo').reset();
        await cargarEquipos();
    } catch (err) {
        console.error('Error al guardar equipo:', err);
        alert(err.message || 'Error al registrar el equipo. Verifique que el número de serie no esté duplicado.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Guardar Equipo';
    }
});

window.onload = inicializarModuloEquipos;
