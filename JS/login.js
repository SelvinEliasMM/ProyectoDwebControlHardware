document.getElementById('formLogin').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const credenciales = {
        correo: document.getElementById('correo').value,
        passwordHash: document.getElementById('password').value
    };

    fetch('http://localhost:8080/api/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciales)
    })
    .then(response => {
        if(!response.ok) throw new Error("Credenciales inválidas");
        return response.json();
    })
    .then(usuario => {
        // GUARDA EL USUARIO EN LA MEMORIA DEL NAVEGADOR
        localStorage.setItem('usuarioActivo', JSON.stringify(usuario));
        window.location.href = 'index.html'; // Redirigir al dashboard
    })
    .catch(error => {
        alert('Correo o contraseña incorrectos.');
    });
});
