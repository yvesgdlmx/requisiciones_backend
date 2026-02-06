import express from "express";
import checkAuth from "../middleware/checkAuth.js";
import {
  crearCategoria,
  obtenerCategorias,
  obtenerCategoria,
  actualizarCategoria,
  eliminarCategoria,
  obtenerPresupuestoDisponible // ← Importar nueva función
} from "../controllers/categoriaController.js";

const router = express.Router();

router.post("/", checkAuth, crearCategoria);
router.get("/", checkAuth, obtenerCategorias);
router.get("/:id", checkAuth, obtenerCategoria);

router.get("/:id/presupuesto-disponible", checkAuth, obtenerPresupuestoDisponible); // ← Nueva ruta
router.put("/:id", checkAuth, actualizarCategoria);

router.delete("/:id", checkAuth, eliminarCategoria);

export default router;