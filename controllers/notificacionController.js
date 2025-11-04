import { Notificacion, Requisicion, Usuario } from "../models/Index.js";

// Obtener notificaciones del usuario autenticado
export const obtenerNotificacionesUsuario = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }

    const { limit = 20, offset = 0, soloNoLeidas = false } = req.query;

    const whereCondition = { usuarioId: usuario.id };
    if (soloNoLeidas === 'true') {
      whereCondition.leida = false;
    }

    const notificaciones = await Notificacion.findAll({
      where: whereCondition,
      order: [["fechaCreacion", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Requisicion,
          as: "requisicion",
          attributes: ["id", "folio", "status"]
        }
      ]
    });

    const totalNoLeidas = await Notificacion.count({
      where: { usuarioId: usuario.id, leida: false }
    });

    return res.json({ 
      notificaciones,
      totalNoLeidas
    });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    return res.status(500).json({ msg: "Error al obtener notificaciones" });
  }
};

export const marcarNotificacionLeida = async (req, res) => {
  try {
    const usuario = req.usuario;
    if(!usuario) {
      return res.status(404).json({ msg: "No autorizado"})
    }

    const { id } = req.params;
    const notificacion = await Notificacion.findByPk(id);

    if(!notificacion) {
      return res.status(404).json({ msg: "Notificación no encontrada" });
    }

    if(notificacion.usuarioId !== usuario.id) {
      return res.status(403).json({ msg: "No tienes permiso para modificar esta notificación" });
    }

    if(!notificacion.leida) {
      notificacion.leida = true;
      await notificacion.save();
    }

    const totalNoLeidas = await Notificacion.count({
      where: { usuarioId: usuario.id, leida: false }
    });

    return res.json({ notificacion, totalNoLeidas})
  } catch (error) {
    consnole.error("Error al marcar notificación como leída:", error);
    return res.status(500).json({ msg: "Error al marcar notificación como leída" });
  }
}

export const eliminarNotificacion = async  (req, res) => {
  try {
    const usuario = req.usuario;
    if(!usuario) {
      return res.status(404).json({ msg: "No autorizado"})
    }

    const { id } = req.params;
    const notificacion = await Notificacion.findByPk(id);

    if(!notificacion) {
      return res.status(404).json({ msg: "Notificación no encontrada" });
    }

    if(notificacion.usuarioId !== usuario.id) {
      return res.status(403).json({ msg: "No tienes permiso para eliminar esta notificación" });
    }

    await notificacion.destroy();

    const totalNoLeidas = await Notificacion.count({
      where: { usuarioId: usuario.id, leida: false }
    });

    return res.json({ msg: "Notificación eliminada", id, totalNoLeidas });
  } catch (error) {
    console.error("Error al eliminar notificación:", error);
    return res.status(500).json({ msg: "Error al eliminar notificación" });
  }
}