import express from "express";
import {
  obtenerNotificacionesUsuario,
  marcarNotificacionLeida,
  eliminarNotificacion
} from "../controllers/notificacionController.js";
import checkAuth from "../middleware/checkAuth.js";

const router = express.Router();

router.get("/", checkAuth, obtenerNotificacionesUsuario);
router.put("/:id/marcar-leida", checkAuth, marcarNotificacionLeida);
router.delete("/:id", checkAuth, eliminarNotificacion);
export default router;