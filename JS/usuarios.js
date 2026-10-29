// contr de usuarios y tecnicos
let listaUsuariosGlobal = [];

// inic modulo para admin
async function inicializarModuloUsuarios() {
    const usuario = verificarSesion(['Administrador']);
    if (!usuario) return;

    renderSidebar('usuarios');
    renderHeaderUsuario();

    await cargarUsuarios();

    const inputBuscar = document.getElementById('buscarUsuario');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', filtrarUsuarios);
    }

    const form = document.getElementById('formUsuario');
    if (form) {
        form.addEventListener('submit', guardarNuevoUsuario);
    }
}

// obtiene lista de usuarios del backend
async function cargarUsuarios() {
    try {
        const data = await apiFetch('/usuarios');
        listaUsuariosGlobal = data || [];
        renderizarTablaUsuarios(listaUsuariosGlobal);
    } catch (err) {
        const tbody = document.getElementById('tabla-usuarios');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar usuarios: ${err.message}</td></tr>`;
    }
}

// render
function renderizarTablaUsuarios(usuarios) {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '';

    if (usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state-card">No se encontraron usuarios registrados.</td></tr>`;
        return;
    }

    usuarios.forEach(u => {
        const badgeRol = u.rol === 'Administrador'
            ? `<span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa;">Administrador</span>`
            : `<span class="badge ready">Técnico</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${u.idUsuario}</strong></td>
            <td><strong>${u.nombreCompleto}</strong></td>
            <td><span style="color:#60a5fa;">${u.correo}</span></td>
            <td>${badgeRol}</td>
            <td><span class="badge ready">Activo</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// filtra usuarios en tabla
function filtrarUsuarios(e) {
    const texto = (e.target.value || '').toLowerCase().trim();
    if (!texto) {
        renderizarTablaUsuarios(listaUsuariosGlobal);
        return;
    }

    const filtrados = listaUsuariosGlobal.filter(u =>
        (u.nombreCompleto && u.nombreCompleto.toLowerCase().includes(texto)) ||
        (u.correo && u.correo.toLowerCase().includes(texto)) ||
        (u.rol && u.rol.toLowerCase().includes(texto))
    );

    renderizarTablaUsuarios(filtrados);
}

// guarda nuevo tecnico o admin
async function guardarNuevoUsuario(e) {
    e.preventDefault();

    const btn = document.getElementById('btnGuardarUsuario');
    const txtOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    const nuevoUsuario = {
        nombreCompleto: document.getElementById('nombreCompleto').value.trim(),
        correo: document.getElementById('correoUsuario').value.trim(),
        passwordHash: document.getElementById('passwordUsuario').value,
        rol: document.getElementById('rolUsuario').value
    };

    try {
        await apiFetch('/usuarios', {
            method: 'POST',
            body: JSON.stringify(nuevoUsuario)
        });

        mostrarNotificacion('Usuario registrado correctamente.', 'success');
        document.getElementById('formUsuario').reset();
        await cargarUsuarios();
    } catch (err) {
        alert(err.message || 'No se pudo registrar el usuario.');
    } finally {
        btn.disabled = false;
        btn.innerText = txtOriginal;
    }
}

window.onload = inicializarModuloUsuarios;

