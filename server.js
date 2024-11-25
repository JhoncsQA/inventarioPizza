const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
const port = 3000;

// Middleware para servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la base de datos
const dbConfig = {
  user: 'user_proyecto', 
  password: 'oracle',  
  connectString: 'localhost:1521' 
};

// Ruta de login (POST)
app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    
    try {
        const connection = await oracledb.getConnection(dbConfig);
        
        // Verifica si el usuario existe y si la contraseña es correcta, y obtiene el rol
        const result = await connection.execute(
            `SELECT u.ID_USUARIO, u.USUARIO, u.ContraseñaUsuario, u.ID_ROL, r.NOMBREROL 
             FROM Usuario u
             JOIN Rol r ON u.ID_ROL = r.ID_ROL
             WHERE u.USUARIO = :usuario AND u.ContraseñaUsuario = :password`,
            [usuario, password],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        ); 

        if (result.rows.length > 0) {
            const user = result.rows[0];  // El primer usuario que coincide

            console.log('Usuario encontrado:', user);
            console.log('Rol del usuario:', user.NOMBREROL); // Asegúrate de que 'NOMBREROL' sea correcto

            // Si el rol es 'Gerente'
            if (user.NOMBREROL === 'Administrador') {
                res.json({ success: true, message: '¡Inicio de sesión exitoso!', redirectTo: '/inventario-admin' });
            } else {
                res.json({ success: true, message: '¡Inicio de sesión exitoso!', redirectTo: '/inventario-usuario' });
            }
        } else {
            // Si las credenciales no son correctas
            res.json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        // Cierra la conexión
        await connection.close();
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Error al conectarse a la base de datos' });
    }
});

app.get('/api/insumos', async (req, res) => {
    try {
        const connection = await oracledb.getConnection(dbConfig);
        const query = `
            SELECT 
                i.Id_Insumo,
                i.NombreInsumo,
                i.FechaVencimiento,
                i.CantidadTotal,
                u.NombreDeMedida,
                p.NombreProveedor,
                r.CantidadDisponible,
                r.StockMinimo,
                e.TipoEstado
            FROM Insumo i
            JOIN Registro r ON i.Id_Insumo = r.Id_Insumo
            JOIN Estado e ON r.Id_Estado = e.Id_Estado
            JOIN UnidadMedida u ON i.Id_UnidadMedida = u.Id_UnidadMedida
            JOIN Proveedor p ON i.Id_Proveedor = p.Id_Proveedor
        `;
        
        const result = await connection.execute(query);

        // Verifica que solo se responda una vez
        if (result.rows.length > 0) {
            console.log(result.rows);
            res.json(result.rows);
        } else {
            res.status(404).json({ message: 'No se encontraron insumos.' });
        }
        
        await connection.close();
    } catch (err) {
        console.error('Error al obtener los insumos:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error al obtener los insumos.' });
        }
    }
});



// Rutas de inventario (deben estar fuera del bloque de login)
app.get('/inventario-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inventario-admin.html'));
});

app.post('/api/pedidos', async (req, res) => {
    const { idPedido, pizzasSeleccionadas, fechaPedido } = req.body;

    try {
        const connection = await oracledb.getConnection(dbConfig);

        // 1. Insertar el pedido
        const insertPedidoQuery = `
            INSERT INTO Pedido (Id_Pedido, FechaPedido)
            VALUES (:idPedido, :fechaPedido)
        `;
        await connection.execute(insertPedidoQuery, {
            idPedido: idPedido,
            fechaPedido: fechaPedido
        });

        // 2. Insertar los detalles del pedido (pizzas seleccionadas)
        const insertDetallePedidoQuery = `
            INSERT INTO Detalle_Pedido (Id_Detalle_Pedido, Cantidad, NombrePizza, Id_Pedido)
            VALUES (:idDetallePedido, :cantidad, :nombrePizza, :idPedido)
        `;

        // Variables para las inserciones
        let idDetallePedido = 1;

        for (let pizza of pizzasSeleccionadas) {
            await connection.execute(insertDetallePedidoQuery, {
                idDetallePedido: idDetallePedido++,
                cantidad: pizza.cantidad,
                nombrePizza: pizza.nombrePizza,
                idPedido: idPedido
            });
        }

        // 3. Verificar si los insumos están disponibles
        const insumosNecesarios = [];
        for (let pizza of pizzasSeleccionadas) {
            const recetaQuery = `
                SELECT ri.Id_RecetaInsumo, ri.CantidadNecesaria, i.Id_Insumo, i.CantidadTotal
                FROM Receta_Insumo ri
                JOIN Insumo i ON ri.Id_Insumo = i.Id_Insumo
                WHERE ri.Id_Pizza = :nombrePizza
            `;

            const recetaResult = await connection.execute(recetaQuery, {
                nombrePizza: pizza.nombrePizza
            });

            for (let receta of recetaResult.rows) {
                const cantidadDisponible = receta[3];
                const cantidadNecesaria = receta[1] * pizza.cantidad; // Consideramos la cantidad de pizzas

                if (cantidadDisponible < cantidadNecesaria) {
                    return res.status(400).json({
                        success: false, 
                        message: `No hay suficiente cantidad del insumo ${receta[2]} para preparar las pizzas seleccionadas.`
                    });
                }

                insumosNecesarios.push({
                    idInsumo: receta[2],
                    cantidadNecesaria: cantidadNecesaria
                });
            }
        }

        // 4. Insertar los detalles de los insumos requeridos para cada pizza en el pedido
        const insertDetalleRecetaQuery = `
            INSERT INTO DetalleReceta (Id_DetalleReceta, NombreReceta, Id_Pedido, Id_RecetaInsumo)
            VALUES (:idDetalleReceta, :nombreReceta, :idPedido, :idRecetaInsumo)
        `;

        let idDetalleReceta = 1;

        for (let insumo of insumosNecesarios) {
            await connection.execute(insertDetalleRecetaQuery, {
                idDetalleReceta: idDetalleReceta++,
                nombreReceta: "Receta para " + pizza.nombrePizza, // Aquí puedes ajustar según tu modelo
                idPedido: idPedido,
                idRecetaInsumo: insumo.idInsumo
            });
        }

        // Confirmar la transacción
        await connection.commit();
        res.json({ success: true, message: 'Pedido creado correctamente con las pizzas y los insumos asociados.' });

        // Cerrar la conexión
        await connection.close();
    } catch (err) {
        console.error('Error al crear el pedido:', err);
        res.status(500).json({ success: false, message: 'Error al crear el pedido.' });
    }
});


// Ruta para obtener las pizzas disponibles y no disponibles
app.get('/api/pizzas', async (req, res) => {
    try {
        const connection = await oracledb.getConnection(dbConfig);

        const query = `
            SELECT DISTINCT NombrePizza
            FROM Detalle_Pedido
            WHERE Id_Pedido IS NULL
        `;
        // Obtén las pizzas disponibles
        const result = await connection.execute(query);

        const pizzasDisponibles = result.rows.map(row => row[0]);

        const queryNoDisponibles = `
            SELECT DISTINCT NombrePizza
            FROM Detalle_Pedido
            WHERE Id_Pedido IS NOT NULL
        `;
        // Obtén las pizzas no disponibles
        const resultNoDisponibles = await connection.execute(queryNoDisponibles);
        const pizzasNoDisponibles = resultNoDisponibles.rows.map(row => row[0]);

        res.json({ pizzasDisponibles, pizzasNoDisponibles });

        await connection.close();
    } catch (err) {
        console.error('Error al obtener las pizzas:', err);
        res.status(500).json({ error: 'Error al obtener las pizzas' });
    }
});


// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
