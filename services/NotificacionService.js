import { Notificacion, Usuario, Requisicion } from "../models/Index.js";

class NotificacionService {

  // Crear notificación individual para cada admin cuando se crea una requisición
  static async crearNotificacionRequisicionCreada(requisicionId, usuarioCreador) {
    try {
      const requisicion = await Requisicion.findByPk(requisicionId);
      if (!requisicion) return;

      // Obtener TODOS los usuarios admin (no superadmin)
      const administradores = await Usuario.findAll({
        where: {
          rol: 'admin'  // Solo admins
        }
      });

      // Crear notificación INDIVIDUAL para cada administrador
      for (const admin of administradores) {
        const mensaje = `Nueva requisición ${requisicion.folio} creada por ${usuarioCreador.nombre} ${usuarioCreador.apellido} del área ${requisicion.area}`;

        await Notificacion.create({
          usuarioId: admin.id, // Notificación individual para cada admin
          requisicionId: requisicionId,
          tipo: "requisicion_creada",
          mensaje: mensaje,
          metadata: {
            folio: requisicion.folio,
            solicitante: `${usuarioCreador.nombre} ${usuarioCreador.apellido}`,
            area: requisicion.area,
            prioridad: requisicion.prioridad,
            fechaCreacion: requisicion.fechaHora,
            esNotificacionAdmin: true // Flag para identificar que es notificación de admin
          }
        });
      }
    } catch (error) {
      console.error("Error creando notificación de requisición creada:", error);
    }
  }

   // Crear notificación para cambio de status
  static async crearNotificacionCambioStatus(requisicionId, statusAnterior, statusNuevo, compradorNombre = null) {
    try {
      const requisicion = await Requisicion.findByPk(requisicionId, {
        include: [{ model: Usuario, as: "usuario" }]
      });

      if (!requisicion) return;

      const mensaje = `Tu requisición ${requisicion.folio} cambió de "${statusAnterior}" a "${statusNuevo}"${compradorNombre ? ` por ${compradorNombre}` : ''}`;

      // Notificación al solicitante (existente)
      await Notificacion.create({
        usuarioId: requisicion.solicitante,
        requisicionId: requisicionId,
        tipo: "cambio_status",
        mensaje: mensaje,
        metadata: {
          statusAnterior,
          statusNuevo,
          comprador: compradorNombre,
          folio: requisicion.folio
        }
      });

      // Si el nuevo status es 'esperando autorizacion', notificar a TODOS los superadmin
      if (String(statusNuevo).toLowerCase() === "esperando autorizacion") {
        const superadmins = await Usuario.findAll({
          where: { rol: "superadmin" }
        });

        const mensajeSuper = `La requisición ${requisicion.folio} está en "esperando autorizacion" y requiere revisión/autorización.`;

        for (const sa of superadmins) {
          await Notificacion.create({
            usuarioId: sa.id,
            requisicionId,
            tipo: "esperando_autorizacion",
            mensaje: mensajeSuper,
            metadata: {
              folio: requisicion.folio,
              solicitante: requisicion.usuario ? `${requisicion.usuario.nombre} ${requisicion.usuario.apellido}` : null,
              prioridad: requisicion.prioridad
            }
          });
        }
      }
    } catch (error) {
      console.error("Error creando notificación de cambio de status:", error);
    }
  }

  // Crear notificación para comentario agregado
  static async crearNotificacionComentario(requisicionId, tipoComentario = "comentario") {
    try {
      const requisicion = await Requisicion.findByPk(requisicionId, {
        include: [{ model: Usuario, as: "usuario" }]
      });

      if (!requisicion) return;

      const mensaje = tipoComentario === "comentario_autorizador" 
        ? `Se agregó un comentario del autorizador a tu requisición ${requisicion.folio}`
        : `Se agregó un comentario a tu requisición ${requisicion.folio}`;

      await Notificacion.create({
        usuarioId: requisicion.solicitante,
        requisicionId: requisicionId,
        tipo: tipoComentario === "comentario_autorizador" ? "comentario_autorizador" : "comentario_agregado",
        mensaje: mensaje,
        metadata: {
          folio: requisicion.folio,
          tipoComentario
        }
      });
    } catch (error) {
      console.error("Error creando notificación de comentario:", error);
    }
  }

  // Obtener conteo de notificaciones no leídas por usuario
  static async contarNotificacionesNoLeidas(usuarioId) {
    try {
      return await Notificacion.count({
        where: { usuarioId, leida: false }
      });
    } catch (error) {
      console.error("Error contando notificaciones no leídas:", error);
      return 0;
    }
  }

  // Eliminar notificaciones antiguas (opcional, para limpieza)
  static async limpiarNotificacionesAntiguas(diasAntiguedad = 30) {
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

      const eliminadas = await Notificacion.destroy({
        where: {
          fechaCreacion: {
            [db.Sequelize.Op.lt]: fechaLimite
          },
          leida: true
        }
      });

      console.log(`Notificaciones eliminadas: ${eliminadas}`);
      return eliminadas;
    } catch (error) {
      console.error("Error limpiando notificaciones antiguas:", error);
      return 0;
    }
  }

  // Crear notificación para ETA asignado/modificado
   // Crear notificación para ETA asignado/modificado
  static async crearNotificacionEta(requisicionId, etaISO, proveedor = null) {
    try {
      const requisicion = await Requisicion.findByPk(requisicionId, {
        include: [{ model: Usuario, as: "usuario" }]
      });
      if (!requisicion) return;

      // Convierte un ISO date/fecha a Date en hora local evitando el shift UTC
      const parseToLocalDate = (iso) => {
        if (!iso) return null;
        // Si viene solo 'YYYY-MM-DD'
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          const [y, m, d] = iso.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
        // Si viene con hora ('YYYY-MM-DDTHH:MM:...') tomar solo la parte fecha
        const datePart = iso.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [y, m, d] = datePart.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
        // Fallback
        return new Date(iso);
      };

      const fecha = etaISO ? parseToLocalDate(etaISO) : (requisicion.eta ? parseToLocalDate(new Date(requisicion.eta).toISOString().split('T')[0]) : null);
      const fechaTexto = fecha ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (etaISO || '');

      const mensaje = `Se asignó fecha estimada de llegada ${fechaTexto} a tu requisición ${requisicion.folio}${proveedor ? ` con el proveedor ${proveedor}` : ''}`;

      await Notificacion.create({
        usuarioId: requisicion.solicitante,
        requisicionId: requisicionId,
        tipo: "eta_asignada",
        mensaje: mensaje,
        metadata: {
          folio: requisicion.folio,
          eta: etaISO,
          proveedor
        }
      });
    } catch (error) {
      console.error("Error creando notificación de ETA:", error);
    }
  }
}




export default NotificacionService;