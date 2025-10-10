import express from "express";
import checkAuth from "../middleware/checkAuth.js";
import { uploadConfig } from "../config/uploadConfig.js"; // Asegúrate de que la ruta sea correcta
import {
  crearRequisicion,
  obtenerRequisiciones,          
  obtenerRequisicion,              
  obtenerRequisicionesPorUsuario,  
  obtenerRequisicionPorUsuario,    
  actualizarRequisicion,           
  eliminarRequisicion,
  actualizarRequisicionAdmin,              
  obtenerRequisicionesAutorizacion,
  actualizarRequisicionSuperAdmin,
  marcarRequisicionComoVisto
} from "../controllers/requisicionController.js";
const router = express.Router();
// Usamos upload.array("archivo", maxCount) para recibir múltiples archivos
// Por ejemplo, maxCount puede ser 5 o la cantidad que se desee permitir
router.post("/", checkAuth, uploadConfig.array("archivo", 5), crearRequisicion);
router.get("/", checkAuth, obtenerRequisiciones);
router.get("/autorizar", checkAuth, obtenerRequisicionesAutorizacion)
router.get("/usuario", checkAuth, obtenerRequisicionesPorUsuario);
router.get("/usuario/:id", checkAuth, obtenerRequisicionPorUsuario);
router.get("/:id", checkAuth, obtenerRequisicion);
router.put("/:id/editar", checkAuth, uploadConfig.array("archivo", 5), actualizarRequisicion);
router.put("/:id/admin", checkAuth, uploadConfig.array("archivo", 5), actualizarRequisicionAdmin);
router.put("/:id/superadmin", checkAuth, actualizarRequisicionSuperAdmin);
router.put('/:id/abrir', checkAuth, marcarRequisicionComoVisto);
router.delete("/:id", checkAuth, eliminarRequisicion);


export default router;