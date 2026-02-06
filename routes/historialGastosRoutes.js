import express from "express";
import checkAuth from "../middleware/checkAuth.js";
import {
  obtenerHistorialGastos,
  obtenerHistorialPorRequisicion
} from "../controllers/historialGastoController.js";

const router = express.Router();

// Proteger todas las rutas con autenticación
router.use(checkAuth);

// GET /api/historial-gastos - Obtener todo el historial
router.get("/", obtenerHistorialGastos);

// GET /api/historial-gastos/requisicion/:requisicionId - Obtener historial de una requisición específica
router.get("/requisicion/:requisicionId", obtenerHistorialPorRequisicion);

export default router;