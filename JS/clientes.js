document.getElementById('formCliente').addEventListener('submit', function(e) {
    e.preventDefault(); // Evita que la página se recargue

    // Captura los datos del formulario
    const nuevoCliente = {
        nombreCliente: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value,
        email: document.getElementById('email').value,
        direccion: document.getElementById('direccion').value,
    };

    // Envía los datos al backend de Spring Boot
    fetch('http://localhost:8080/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente)
    })
    .then(response => response.json())
    .then(data => {
        alert('¡Cliente guardado con éxito!');
        document.getElementById('formCliente').reset();
    })
    .catch(error => console.error('Error:', error));
});
