// Llenar el menú desplegable con los clientes existentes
window.onload = function() {
    fetch('http://localhost:8080/api/clientes')
        .then(response => response.json())
        .then(clientes => {
            const select = document.getElementById('clienteSelect');
            if (!select) return;
            select.innerHTML = '<option value="">Seleccione un cliente...</option>';
            clientes.forEach(cliente => {
                select.innerHTML += `<option value="${cliente.idCliente}">${cliente.nombreCliente}</option>`;
            });
        });
};

// Guardar el equipo
document.getElementById('formEquipo').addEventListener('submit', function(e) {
    e.preventDefault();

    const nuevoEquipo = {
        idCliente: { idCliente: document.getElementById('clienteSelect').value },
        tipoEquipo: document.getElementById('tipo').value,
        marcaModelo: document.getElementById('marca').value,
        numeroSerie: document.getElementById('serie').value,
        caracteristicasHardware: document.getElementById('caracteristicas').value
    };

    fetch('http://localhost:8080/api/equipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoEquipo)
    })
    .then(response => response.json())
    .then(data => {
        alert('¡Equipo guardado con éxito!');
        document.getElementById('formEquipo').reset();
    })
    .catch(error => console.error('Error:', error));
});
