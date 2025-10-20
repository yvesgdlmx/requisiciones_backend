import express from 'express';
import { uploadConfig } from '../config/uploadConfig.js';
import {
  nuevoUsuario,
  autenticar,
  perfil,
  actualizarImagenPerfil,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  cambiarPassword
} from '../controllers/usuarioController.js';
import checkAuth from '../middleware/checkAuth.js';

const router = express.Router();

router.post('/registro', nuevoUsuario);
router.post('/login', autenticar);
router.get('/perfil', checkAuth, perfil);
router.put("/perfil/imagen", checkAuth, uploadConfig.single("imagenPerfil"), actualizarImagenPerfil);
router.put("/perfil/password", checkAuth, cambiarPassword);
router.get('/usuarios', checkAuth, obtenerUsuarios);
router.get('/usuarios/:id', checkAuth, obtenerUsuarioPorId)
router.put('/usuarios/:id', checkAuth, actualizarUsuario);
router.delete('/usuarios/:id', checkAuth, eliminarUsuario);

export default router;