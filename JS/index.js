// Función para cargar los datos del usuario desde la base de datos
function cargarUsuario() {
    const usuarioStr = localStorage.getItem('usuarioActivo');
    if (!usuarioStr) {
        window.location.href = 'login.html';
        return;
    }

    const usuario = JSON.parse(usuarioStr);
    document.querySelector('.user-info').innerHTML =
        `${usuario.nombreCompleto} (${usuario.rol}) 
    <button onclick="cerrarSesion()" style="margin-left:15px; padding:5px 10px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer;">Salir</button>`;

    if (usuario.rol === 'Técnico') {
        document.getElementById('menu-ordenes').style.display = 'none';
        document.getElementById('menu-clientes').style.display = 'none';
        document.getElementById('menu-facturas').style.display = 'none';
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuarioActivo');
    window.location.href = 'login.html';
}

// Función para cargar las órdenes desde la base de datos
function cargarOrdenes() {
    const usuarioStr = localStorage.getItem('usuarioActivo');
    const usuarioActual = JSON.parse(usuarioStr);

    fetch('http://localhost:8080/api/ordenes')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('tabla-ordenes');
            tbody.innerHTML = '';

            let ordenesAMostrar = data;
            if (usuarioActual.rol === 'Técnico') {
                ordenesAMostrar = data.filter(orden => orden.idUsuarioTecnico.idUsuario === usuarioActual.idUsuario);
            }

            let totalActivas = ordenesAMostrar.length;
            let totalDiagnostico = ordenesAMostrar.filter(orden => orden.estadoReparacion === 'En Diagnóstico').length;
            let totalReparados = ordenesAMostrar.filter(orden => orden.estadoReparacion === 'Reparado').length;

            document.getElementById('count-activas').innerText = totalActivas;
            document.getElementById('count-diagnostico').innerText = totalDiagnostico;
            document.getElementById('count-listos').innerText = totalReparados;

            ordenesAMostrar.forEach(orden => {
                let badgeClass = orden.estadoReparacion === 'Reparado' ? 'badge ready' : 'badge diag';

                let botonAccion = '';
                if (orden.estadoReparacion !== 'Reparado' && usuarioActual.rol === 'Técnico') {
                    botonAccion = `<button onclick="marcarReparado(${orden.idOrden})" style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Marcar Reparado</button>`;
                }

                let fila = `
                <tr>
                    <td>#ORD-${orden.idOrden}</td>
                    <td>${orden.idEquipo.idCliente.nombreCliente}</td>
                    <td>${orden.idEquipo.marcaModelo}</td>
                    <td><span class="${badgeClass}">${orden.estadoReparacion}</span></td>
                    <td>${orden.idUsuarioTecnico.nombreCompleto}</td>
                    <td>${botonAccion}</td>
                </tr>
            `;
                tbody.innerHTML += fila;
            });
        })
        .catch(error => console.error('Error al cargar órdenes:', error));
}

// Función para que el técnico actualice el estado
function marcarReparado(idOrden) {
    if (confirm('¿Confirmas que este equipo está reparado?')) {
        fetch(`http://localhost:8080/api/ordenes/${idOrden}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Reparado' })
        })
            .then(res => res.json())
            .then(() => {
                cargarOrdenes(); 
            });
    }
}

window.onload = function() {
    cargarUsuario();
    cargarOrdenes();
};
 //parte modificada de parte de mauri
        let ordenesGlobales = []; // Guardará las órdenes cargadas para la impresión

        function cargarUsuario() {
            const usuarioStr = localStorage.getItem('usuarioActivo');
            if (!usuarioStr) {
                window.location.href = 'login.html';
                return;
            }

            const usuario = JSON.parse(usuarioStr);
            document.querySelector('.user-info').innerHTML =
                `${usuario.nombreCompleto} (${usuario.rol}) 
            <button onclick="cerrarSesion()" style="margin-left:15px; padding:5px 10px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer;">Salir</button>`;

            // Lógica de Roles estricta
            if (usuario.rol === 'Técnico') {
                if(document.getElementById('menu-ordenes')) document.getElementById('menu-ordenes').style.display = 'none';
                if(document.getElementById('menu-clientes')) document.getElementById('menu-clientes').style.display = 'none';
                if(document.getElementById('menu-facturas')) document.getElementById('menu-facturas').style.display = 'none';
            }
        }

        function cerrarSesion() {
            localStorage.removeItem('usuarioActivo');
            window.location.href = 'login.html';
        }

        function cargarOrdenes() {
            const usuarioStr = localStorage.getItem('usuarioActivo');
            const usuarioActual = JSON.parse(usuarioStr);

            fetch('http://localhost:8080/api/ordenes')
                .then(response => response.json())
                .then(data => {
                    ordenesGlobales = data; // Guardamos las órdenes en memoria
                    const tbody = document.getElementById('tabla-ordenes');
                    tbody.innerHTML = '';

                    let ordenesAMostrar = data;
                    if (usuarioActual.rol === 'Técnico') {
                        ordenesAMostrar = data.filter(orden => orden.idUsuarioTecnico.idUsuario === usuarioActual.idUsuario);
                    }

                    // Actualizar Tarjetas
                    document.getElementById('count-activas').innerText = ordenesAMostrar.length;
                    document.getElementById('count-diagnostico').innerText = ordenesAMostrar.filter(o => o.estadoReparacion === 'En Diagnóstico').length;
                    document.getElementById('count-listos').innerText = ordenesAMostrar.filter(o => o.estadoReparacion === 'Reparado').length;

                    ordenesAMostrar.forEach(orden => {
                        let badgeClass = orden.estadoReparacion === 'Reparado' ? 'badge ready' : 'badge diag';

                        // Botón de imprimir Ticket
                        let botonTicket = `<button onclick="imprimirTicket(${orden.idOrden})" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-right:5px;">🎫 Ticket</button>`;

                        // Botón para Marcar Reparado (Solo para técnicos y si está en diagnóstico)
                        let botonAccion = '';
                        if (orden.estadoReparacion !== 'Reparado' && usuarioActual.rol === 'Técnico') {
                            botonAccion = `<button onclick="marcarReparado(${orden.idOrden})" style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Marcar Reparado</button>`;
                        }

                        let fila = `
                            <tr>
                                <td>#ORD-${orden.idOrden}</td>
                                <td>${orden.idEquipo.idCliente.nombreCliente}</td>
                                <td>${orden.idEquipo.marcaModelo}</td>
                                <td><span class="${badgeClass}">${orden.estadoReparacion}</span></td>
                                <td>${orden.idUsuarioTecnico.nombreCompleto}</td>
                                <td>${botonTicket} ${botonAccion}</td>
                            </tr>
                        `;
                        tbody.innerHTML += fila;
                    });
                })
                .catch(error => console.error('Error al cargar órdenes:', error));
        }

        // Función para llenar los datos e invocar la ventana de impresión
        function imprimirTicket(idOrden) {
            const orden = ordenesGlobales.find(o => o.idOrden === idOrden);
            if (!orden) return;

            document.getElementById('ticket-id').innerText = `#ORD-${orden.idOrden}`;
            document.getElementById('ticket-fecha').innerText = orden.fechaIngreso ? new Date(orden.fechaIngreso).toLocaleString() : 'Reciente';
            document.getElementById('ticket-cliente').innerText = orden.idEquipo.idCliente.nombreCliente;
            document.getElementById('ticket-equipo').innerText = `${orden.idEquipo.marcaModelo} (SN: ${orden.idEquipo.numeroSerie})`;
            document.getElementById('ticket-tecnico').innerText = orden.idUsuarioTecnico.nombreCompleto;
            document.getElementById('ticket-problema').innerText = orden.problemaReportado || 'N/A';
            document.getElementById('ticket-notas').innerText = orden.notasEspeciales || 'Sin observaciones adicionales';

            // Abre el cuadro de diálogo de impresión del navegador
            window.print();
        }

        function marcarReparado(idOrden) {
            if (confirm('¿Confirmas que este equipo está reparado?')) {
                fetch(`http://localhost:8080/api/ordenes/${idOrden}/estado`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: 'Reparado' })
                })
                .then(res => res.json())
                .then(() => cargarOrdenes());
            }
        }

        window.onload = function() {
            cargarUsuario();
            cargarOrdenes();
        };
    
