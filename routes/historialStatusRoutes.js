import express from "express"
import checkAuth from "../middleware/checkAuth.js"
import { obtenerHistorialStatus, obtenerHistorialStatusPorRequisicion } from "../controllers/historialStatusController.js"

const router = express.Router()

router.get("/", checkAuth, obtenerHistorialStatus);
router.get("/requisicion/:requisicionId", checkAuth, obtenerHistorialStatusPorRequisicion)

export default router;
