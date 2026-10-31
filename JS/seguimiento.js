// portal publico de seguimiento por token
const API_SEGUIMIENTO = 'http://localhost:8080/api/ordenes/consulta-publica';

// extrae token limpio si pegan url o texto del qr
function extraerToken(valor) {
    const txt = (valor || '').trim().toUpperCase();
    const match = txt.match(/TF-[A-Z0-9]{8}/);
    return match ? match[0] : txt;
}

// consulta orden por codigo
function consultarTicket() {
    const input = document.getElementById('inputTicket');
    const token = extraerToken(input.value);
    input.value = token;
    const msgError = document.getElementById('mensajeError');
    const card = document.getElementById('resultadoOrden');

    if (!/^TF-[A-Z0-9]{8}$/.test(token)) {
        msgError.innerText = 'Ingresa un código válido (ej: TF-7K3M9QX2).';
        msgError.style.display = 'block';
        card.style.display = 'none';
        return;
    }

    fetch(`${API_SEGUIMIENTO}/${encodeURIComponent(token)}`)
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.mensaje || 'Orden no encontrada');
            return data;
        })
        .then(orden => {
            msgError.style.display = 'none';
            document.getElementById('resTicket').innerText = orden.ticket;
            document.getElementById('resCliente').innerText = orden.cliente;
            document.getElementById('resEquipo').innerText = orden.equipo;
            document.getElementById('resSerie').innerText = orden.numeroSerie || 'N/A';
            document.getElementById('resProblema').innerText = orden.problemaReportado;
            document.getElementById('resTecnico').innerText = orden.tecnicoAsignado;

            const badge = document.getElementById('resEstado');
            badge.innerText = orden.estadoReparacion;
            badge.className = (orden.estadoReparacion === 'Reparado' || orden.estadoReparacion === 'Entregado') ? 'badge ready' : 'badge diag';

            // barra de progreso
            const estados = ['Recibido', 'En Diagnóstico', 'En Reparación', 'Reparado', 'Entregado'];
            const idx = estados.indexOf(orden.estadoReparacion);
            document.querySelectorAll('#barraProgreso .step').forEach((el, i) => {
                el.classList.toggle('active', i <= idx);
            });

            card.style.display = 'block';
        })
        .catch(err => {
            card.style.display = 'none';
            msgError.innerText = err.message;
            msgError.style.display = 'block';
        });
}

// enter para buscar
document.getElementById('inputTicket').addEventListener('keydown', e => {
    if (e.key === 'Enter') consultarTicket();
});

// si viene del qr llena el campo y consulta
window.addEventListener('DOMContentLoaded', () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
        document.getElementById('inputTicket').value = token.toUpperCase();
        consultarTicket();
    }
});

