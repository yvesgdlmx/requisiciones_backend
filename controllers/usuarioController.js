import Usuario from "../models/Usuario.js";
import Requisicion from "../models/Requisicion.js";
import generarJWT from "../helpers/generarJWT.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary from "../config/cloudinary.js";
// Para obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Crea un nuevo usuario
export const nuevoUsuario = async (req, res) => {
  try {
    // Extraer los datos del body sin incluir el ID
    const { id, ...datosUsuario } = req.body;
    
    const usuario = await Usuario.create({
      ...datosUsuario,
      confirmado: true // Confirmar automáticamente para pruebas
    });
    
    res.json({
      msg: "Usuario creado correctamente",
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        area: usuario.area,
        rol: usuario.rol,
        email: usuario.email
      }
    });
  } catch (error) {
    console.log(error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ msg: "El email ya está registrado" });
    }
    res.status(500).json({ msg: 'Hubo un error al crear el usuario' });
  }
};

export const autenticar = async (req, res) => {
    const { email, password } = req.body;

    // Comprobar si el usuario existe
    const usuario = await Usuario.findOne({ where: { email: email } });
    if (!usuario) {
        const error = new Error("El Usuario no existe");
        return res.status(404).json({ msg: error.message });
    }

    // Comprobar si el usuario está confirmado
    if (!usuario.confirmado) {
        const error = new Error("Tu Cuenta no ha sido confirmada");
        return res.status(403).json({ msg: error.message });
    }

    // Comprobar su password
    if (usuario.verificarPassword(password)) {
        const token = generarJWT(usuario.id);

        // Guardar el token en la base de datos
        usuario.token = token;
        await usuario.save();

        res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            area: usuario.area,
            email: usuario.email,
            rol: usuario.rol,
            imagenPerfil: usuario.imagenPerfil,
            token: token
        });
    } else {
        const error = new Error("El Password es Incorrecto");
        return res.status(403).json({ msg: error.message });
    }
};

export const perfil = async (req, res) => {
    const { usuario } = req;
    res.json(usuario);
};

export const actualizarImagenPerfil = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    if (!req.file) {
      return res.status(400).json({ msg: "No se subió ninguna imagen" });
    }

    // Eliminar imagen anterior de Cloudinary si existe
    if (usuario.imagenPerfil && usuario.imagenPerfil.public_id) {
      try {
        await cloudinary.uploader.destroy(usuario.imagenPerfil.public_id, { resource_type: "image" });
      } catch (err) {
        console.warn("No se pudo eliminar la imagen anterior de Cloudinary:", err);
      }
    }

    // Guardar nueva imagen (url y public_id)
    usuario.imagenPerfil = {
      url: req.file.path.replace(/\\/g, "/"),
      public_id: req.file.filename
    };
    await usuario.save();

    return res.json({
      msg: "Imagen de perfil actualizada exitosamente",
      imagenPerfil: usuario.imagenPerfil,
    });
  } catch (error) {
    console.error("Error actualizando la imagen de perfil:", error);
    return res.status(500).json({ msg: "Error actualizando la imagen de perfil" });
  }
};

export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password', 'token'] }
    });
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener los usuarios" });
  }
};

export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password', 'token'] }
    });
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el usuario" });
  }
};

export const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    // Permitir actualizar el email y otros campos
    Object.assign(usuario, req.body);
    await usuario.save();
    res.json({ msg: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar el usuario" });
  }
};

export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Cambia el ID aquí por el de tu usuario especial
    const usuarioEliminadoId = 9999;

    // Actualiza las requisiciones que referencian a este usuario
    await Requisicion.update(
      { solicitante: usuarioEliminadoId },
      { where: { solicitante: id } }
    );

    await usuario.destroy();
    res.json({ msg: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar el usuario" });
  }
};

export const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;
    const usuario = req.usuario;

    // Verificar que se envíen ambas contraseñas
    if (!passwordActual || !passwordNuevo) {
      return res.status(400).json({ msg: "Ambas contraseñas son requeridas" });
    }

    // Verificar la contraseña actual
    if (!usuario.verificarPassword(passwordActual)) {
      return res.status(400).json({ msg: "La contraseña actual es incorrecta" });
    }

    // Validar que la nueva contraseña tenga al menos 6 caracteres
    if (passwordNuevo.length < 6) {
      return res.status(400).json({ msg: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    // Actualizar la contraseña
    usuario.password = passwordNuevo;
    await usuario.save();

    res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al cambiar la contraseña" });
  }
};

