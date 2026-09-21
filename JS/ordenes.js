window.onload = function() {
    // Llenar select de Equipos
    fetch('http://localhost:8080/api/equipos')
        .then(res => res.json())
        .then(equipos => {
            const select = document.getElementById('equipoSelect');
            if (!select) return;
            select.innerHTML = '<option value="">Seleccione el Equipo...</option>';
            equipos.forEach(eq => {
                select.innerHTML += `<option value="${eq.idEquipo}">${eq.marcaModelo} - SN: ${eq.numeroSerie} (${eq.idCliente.nombreCliente})</option>`;
            });
        });

    // Llenar select de Técnicos 
    fetch('http://localhost:8080/api/usuarios')
        .then(res => res.json())
        .then(usuarios => {
            const select = document.getElementById('tecnicoSelect');
            if (!select) return;
            select.innerHTML = '<option value="">Asignar Técnico...</option>';
            usuarios.forEach(user => {
                select.innerHTML += `<option value="${user.idUsuario}">${user.nombreCompleto} (${user.rol})</option>`;
            });
        });
};

// Enviar el formulario
document.getElementById('formOrden').addEventListener('submit', function(e) {
    e.preventDefault();

    const nuevaOrden = {
        idEquipo: { idEquipo: document.getElementById('equipoSelect').value },
        idUsuarioTecnico: { idUsuario: document.getElementById('tecnicoSelect').value },
        problemaReportado: document.getElementById('problema').value,
        notasEspeciales: document.getElementById('notas').value
    };

    fetch('http://localhost:8080/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaOrden)
    })
    .then(res => res.json())
    .then(data => {
        alert('¡Orden de trabajo generada con éxito!');
        document.getElementById('formOrden').reset();
        window.location.href = 'index.html';
    })
    .catch(error => console.error('Error:', error));
});
