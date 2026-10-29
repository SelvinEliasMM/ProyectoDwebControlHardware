document.getElementById('formLogin').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Validando credenciales...';

    const credenciales = {
        correo: document.getElementById('correo').value.trim(),
        passwordHash: document.getElementById('password').value
    };

    try {
        const response = await fetch('http://localhost:8080/api/usuarios/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credenciales)
        });

        if (response.status === 401) {
            alert('Acceso denegado: El correo o la contraseña son incorrectos.');
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            alert(errData.mensaje || 'Error al conectar con el servidor.');
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }

        const usuario = await response.json();
        // guarda sesion activa
        localStorage.setItem('usuarioActivo', JSON.stringify(usuario));
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error en login:', error);
        alert('No se pudo establecer conexión con el backend en http://localhost:8080.');
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
});
