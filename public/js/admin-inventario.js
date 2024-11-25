// Cargar insumos al iniciar la página
document.addEventListener('DOMContentLoaded', async () => {
    await cargarInsumos();
    await cargarPedidos();
});

// Cargar insumos desde la base de datos
async function cargarInsumos() {
    try {
        const response = await fetch('/api/insumos'); // Solicita los datos al backend
        const insumos = await response.json();
        
        // Agrega el log para revisar la respuesta
        console.log(insumos);  // Verifica si la respuesta contiene los datos esperados

        const tabla = document.getElementById('tabla-insumos').querySelector('tbody');
        tabla.innerHTML = ''; // Limpia la tabla antes de cargar nuevos datos

        insumos.forEach(insumo => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${insumo[0]}</td>  <!-- ID -->
                <td>${insumo[1]}</td>  <!-- Nombre -->
                <td>${insumo[2]}</td>  <!-- Fecha Vencimiento -->
                <td>${insumo[3]}</td>  <!-- Cantidad Total -->
                <td>${insumo[4]}</td>  <!-- Unidad de Medida -->
                <td>${insumo[5]}</td>  <!-- Proveedor -->
                <td>${insumo[6]}</td>  <!-- Cantidad Disponible -->
                <td>${insumo[7]}</td>  <!-- Stock Mínimo -->
                <td>${insumo[8]}</td>  <!-- Estado -->
                <td>
                    <button onclick="editarInsumo(${insumo[0]})">Editar</button>
                </td>
            `;
            tabla.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar los insumos:', error);
    }
}


// Función para crear un nuevo pedido
async function crearPedido() {
    const pizzaSeleccionada = document.getElementById('pizzaSeleccionada').value;
    const fechaPedido = new Date().toISOString().split('T')[0]; // Fecha actual

    try {
        const response = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pizzaSeleccionada, fechaPedido })
        });

        const data = await response.json();
        if (data.success) {
            alert(`Pedido creado correctamente. Pizza está ${data.pizzaEstado}.`);
        } else {
            alert('Hubo un problema al crear el pedido.');
        }
    } catch (error) {
        console.error('Error al crear el pedido:', error);
        alert('Error al procesar la solicitud.');
    }
}

// Llama a la función crearPedido cuando el formulario se envíe
const formularioPedido = document.getElementById('formularioPedido');
if (formularioPedido) {
    formularioPedido.addEventListener('submit', (event) => {
        event.preventDefault();
        crearPedido();
    });
}



document.getElementById('btn-agregar-insumo').addEventListener('click', () => {
    // Abrir el modal
    document.getElementById('modal-agregar-insumo').style.display = 'block';

    // Establecer la cantidad disponible igual a la cantidad total
    document.getElementById('cantidad-total').value = ''; // O valor inicial si se requiere

    // No es necesario un campo para "estado", se debe inicializar como "Activo"
    // El estado se manejará en el backend al registrar el insumo como "Activo" por defecto.
    
    // Cargar la lista de proveedores
    cargarProveedores();
});

// Función para cargar la lista de proveedores en el select
async function cargarProveedores() {
    try {
        const response = await fetch('/api/proveedores');  // Cambia esto por la URL de tu API o fuente de datos
        const proveedores = await response.json(); // Suponiendo que la respuesta es un JSON con una lista de proveedores

        const selectProveedor = document.getElementById('proveedor');
        proveedores.forEach(proveedor => {
            const option = document.createElement('option');
            option.value = proveedor.id; // Asume que el proveedor tiene un ID
            option.textContent = proveedor.nombre; // Asume que el proveedor tiene un nombre
            selectProveedor.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar los proveedores:', error);
    }
}


// Ejecutar la función para cargar proveedores cuando se haga clic en el botón de agregar insumo
document.getElementById('btn-agregar-insumo').addEventListener('click', () => {
    document.getElementById('modal-agregar-insumo').style.display = 'block'; // Mostrar el modal
    cargarProveedores(); // Llamar a la función para cargar los proveedores
});


// Enviar los datos del formulario cuando se haga submit
document.getElementById('form-insumo').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitar el comportamiento predeterminado

    const insumo = {
        nombre: document.getElementById('nombre').value,
        fechaVencimiento: document.getElementById('fecha-vencimiento').value,
        cantidadTotal: document.getElementById('cantidad-total').value,
        unidadMedida: document.getElementById('unidad-medida').value,
        proveedor: document.getElementById('proveedor').value,
        cantidadDisponible: document.getElementById('cantidad-total').value, // Igual a cantidad total
        stockMinimo: document.getElementById('stock-minimo').value,
        estado: 'Activo' // El estado se establece como "Activo" por defecto
    };

    try {
        const response = await fetch('/api/insumos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(insumo)
        });

        const result = await response.json();
        if (result.success) {
            alert('Insumo agregado correctamente');
            cargarInsumos(); // Recargar los insumos en la tabla
            document.getElementById('modal-agregar-insumo').style.display = 'none';
        } else {
            alert('Hubo un error al agregar el insumo');
        }
    } catch (error) {
        console.error('Error al agregar insumo:', error);
        alert('Error al agregar el insumo');
    }
});




