import express from 'express';
import dotenv from 'dotenv'
import cors from 'cors'
import db from './config/db.js'
import usuarioRoutes from './routes/usuarioRoutes.js'
import requisicionRoutes from './routes/requisicionRoutes.js'
import notificacionRoutes from './routes/notificacionRoutes.js'
import categoriaRoutes from './routes/categoriaRoutes.js'
import historialGastosRoutes from './routes/historialGastosRoutes.js'

const app = express();
app.use(express.json())

dotenv.config();

app.use("/uploads", express.static("uploads"));

//conexion a la base de datos
try {
    await db.authenticate();
    db.sync()
    console.log('Conexion correcta a la base de datos')
} catch (error) {
    console.log(error);
}

// --- después de dotenv.config() ---
const FRONTEND = process.env.FRONTEND_URL; // ej: "http://localhost:5173"
const whitelist = [FRONTEND];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    console.log('Origin de la petición:', origin);
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Error de CORS: origen no permitido'));
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  exposedHeaders: ['Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rutas
app.use("/api/usuarios", usuarioRoutes)
app.use("/api/requisiciones", requisicionRoutes)
app.use('/api/notificaciones', notificacionRoutes)
app.use('/api/categorias', categoriaRoutes)
app.use('/api/historial-gastos', historialGastosRoutes)

const PORT = process.env.PORT || 3000;
const servidor = app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

app.use((err, req, res, next) => {
  console.error("Error global:", err);
  res.status(500).json({ error: err.message, stack: err.stack });
});
