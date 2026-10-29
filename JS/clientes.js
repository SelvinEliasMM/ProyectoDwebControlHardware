// controlador de gestion y registro de clientes
let clientesCache = [];

// inic el modulo para usuarios con rol autorizado
async function inicializarModuloClientes() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('clientes');
    renderHeaderUsuario();

    await cargarClientes();
    configurarBuscador();
}

// Obtiene el catalogo completo de clientes
async function cargarClientes() {
    try {
        const data = await apiFetch('/clientes');
        clientesCache = data || [];
        renderizarTablaClientes(clientesCache);
    } catch (err) {
        console.error('Error al cargar clientes:', err);
        mostrarNotificacion('Error al obtener la lista de clientes.', 'error');
    }
}

//render
function renderizarTablaClientes(clientes) {
    const tbody = document.getElementById('tabla-clientes');
    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state-card">No se encontraron clientes registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    clientes.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#CLI-${c.idCliente}</strong></td>
            <td><strong>${c.nombreCliente}</strong></td>
            <td>${c.telefono || 'Sin teléfono'}</td>
            <td><a href="mailto:${c.email}" class="field-link">${c.email || 'N/A'}</a></td>
            <td>${c.direccion || 'No registrada'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtra clientes 
function configurarBuscador() {
    const inputBuscar = document.getElementById('buscarCliente');
    if (!inputBuscar) return;

    inputBuscar.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        const filtrados = clientesCache.filter(c => {
            const nom = (c.nombreCliente || '').toLowerCase();
            const tel = (c.telefono || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            return nom.includes(query) || tel.includes(query) || email.includes(query);
        });
        renderizarTablaClientes(filtrados);
    });
}

// Procesa el registro de un nuevo cliente 
document.getElementById('formCliente').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usuarioActivo = getUsuarioActivo();
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const direccion = document.getElementById('direccion').value.trim();

    const btnSubmit = document.getElementById('btnGuardarCliente');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Guardando cliente...';

    const nuevoCliente = {
        nombreCliente: nombre,
        telefono: telefono,
        email: email,
        direccion: direccion,
        usuarioCreacion: { idUsuario: usuarioActivo.idUsuario }
    };

    try {
        const guardado = await apiFetch('/clientes', {
            method: 'POST',
            body: JSON.stringify(nuevoCliente)
        });

        mostrarNotificacion(`Cliente "${guardado.nombreCliente}" guardado exitosamente.`, 'success');
        document.getElementById('formCliente').reset();
        await cargarClientes();
    } catch (err) {
        console.error('Error al guardar cliente:', err);
        alert(err.message || 'Error al guardar el cliente. Verifique que el correo no esté duplicado.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Guardar Cliente';
    }
});

window.onload = inicializarModuloClientes;
