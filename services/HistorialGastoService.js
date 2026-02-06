import { HistorialGasto, Requisicion, Categoria } from "../models/Index.js";
import { Op } from "sequelize";

class HistorialGastoService {
  static isStatusValido(status) {
    return status === "aprobada" || status === "autorizada";
  }

  static async crearOActualizarHistorial(requisicion, usuarioNombre = null) {
    try {
      // Buscar si ya existe un historial para esta requisición
      let historial = await HistorialGasto.findOne({
        where: { requisicionId: requisicion.id }
      });

      // Si el status no es válido, marcar como inactivo pero NO eliminar
      if (!this.isStatusValido(requisicion.status)) {
        if (historial) {
          historial.activo = false;
          historial.statusRequisicion = requisicion.status;
          await historial.save();
          console.log(`Historial marcado como inactivo para requisición ${requisicion.id}`);
        }
        return null;
      }

      if (!requisicion.categoriaId || !requisicion.monto) {
        if (historial) {
          historial.activo = false;
          await historial.save();
        }
        return null;
      }

      const categoria = await Categoria.findByPk(requisicion.categoriaId);
      if (!categoria) {
        if (historial) {
          historial.activo = false;
          await historial.save();
        }
        return null;
      }

      const monedaCategoria = categoria.moneda || "MXN";

      const hoy = new Date();
      const dias = Number(categoria.diasPeriodo || 30);

      let inicio = new Date(categoria.fechaInicio);
      inicio.setHours(0, 0, 0, 0);

      let fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias - 1);
      fin.setHours(23, 59, 59, 999);

      while (hoy > fin) {
        inicio = new Date(fin);
        inicio.setDate(inicio.getDate() + 1);
        inicio.setHours(0, 0, 0, 0);

        fin = new Date(inicio);
        fin.setDate(fin.getDate() + dias - 1);
        fin.setHours(23, 59, 59, 999);
      }

      let montoGastado = 0;
      if (typeof requisicion.monto === "number") {
        montoGastado = requisicion.monto;
      } else if (typeof requisicion.monto === "string") {
        const [rawCant, moneda] = requisicion.monto.trim().split(" ");
        const cant = parseFloat((rawCant || "").replace(/[$,]/g, ""));
        if (!Number.isNaN(cant) && moneda === monedaCategoria) {
          montoGastado = cant;
        }
      }

      // CAMBIO: Solo contar requisiciones ACTIVAS con status válido
      const requisiciones = await Requisicion.findAll({
        where: {
          categoriaId: requisicion.categoriaId,
          status: { [Op.in]: ["aprobada", "autorizada"] }
        },
        include: [{
          model: HistorialGasto,
          as: "historialGasto",
          where: { activo: true },
          required: false
        }]
      });

      let totalGastado = 0;
      requisiciones.forEach((req) => {
        if (req.monto == null) return;
        const f = req.fechaCambioStatus || req.updatedAt || req.fechaHora || new Date();
        if (f >= inicio && f <= fin) {
          if (typeof req.monto === "number") {
            totalGastado += req.monto;
          } else {
            const [rawCant, moneda] = String(req.monto).trim().split(" ");
            const cant = parseFloat((rawCant || "").replace(/[$,]/g, ""));
            if (!Number.isNaN(cant) && moneda === monedaCategoria) totalGastado += cant;
          }
        }
      });

      const presupuestoTotal = parseFloat(categoria.cantidad);
      const saldoDisponible = presupuestoTotal - totalGastado;

      if (historial) {
        historial.categoriaId = requisicion.categoriaId;
        historial.categoriaNombre = categoria.nombre;
        historial.presupuestoTotal = presupuestoTotal;
        historial.diasPeriodo = Number(categoria.diasPeriodo || 30);
        historial.fechaInicioPeriodo = inicio;
        historial.fechaFinPeriodo = fin;
        historial.montoGastado = montoGastado;
        historial.saldoDisponible = saldoDisponible;
        historial.fechaGasto = new Date();
        historial.moneda = monedaCategoria;
        historial.statusRequisicion = requisicion.status;
        historial.activo = true; // Reactivar si estaba inactivo
        if (usuarioNombre) {
          historial.usuarioComprador = usuarioNombre;
        }
        await historial.save();
      } else {
        historial = await HistorialGasto.create({
          requisicionId: requisicion.id,
          categoriaId: requisicion.categoriaId,
          categoriaNombre: categoria.nombre,
          presupuestoTotal,
          diasPeriodo: Number(categoria.diasPeriodo || 30),
          fechaInicioPeriodo: inicio,
          fechaFinPeriodo: fin,
          montoGastado,
          saldoDisponible,
          fechaGasto: new Date(),
          moneda: monedaCategoria,
          statusRequisicion: requisicion.status,
          usuarioComprador: usuarioNombre || null,
          activo: true // Nuevo campo
        });
      }

      return historial;
    } catch (error) {
      console.error("Error en HistorialGastoService.crearOActualizarHistorial:", error);
      return null;
    }
  }

  static async obtenerHistorialPorCategoria(categoriaId) {
    try {
      const historial = await HistorialGasto.findAll({
        where: { categoriaId },
        include: [
          { model: Requisicion, as: "requisicion", attributes: ["id", "folio", "status", "createdAt"] },
          { model: Categoria, as: "categoria", attributes: ["nombre", "cantidad", "diasPeriodo", "moneda"] }
        ],
        order: [["createdAt", "DESC"]]
      });
      return historial;
    } catch (error) {
      console.error("Error en HistorialGastoService.obtenerHistorialPorCategoria:", error);
      return [];
    }
  }

  static async obtenerHistorialPorRequisicion(requisicionId) {
    try {
      const historial = await HistorialGasto.findOne({
        where: { requisicionId },
        include: [
          { model: Requisicion, as: "requisicion" },
          { model: Categoria, as: "categoria" }
        ]
      });
      return historial;
    } catch (error) {
      console.error("Error en HistorialGastoService.obtenerHistorialPorRequisicion:", error);
      return null;
    }
  }

  static async obtenerTodoHistorial(filtro = {}) {
    try {
      const historial = await HistorialGasto.findAll({
        where: filtro,
        include: [
          { model: Requisicion, as: "requisicion", attributes: ["id", "folio", "status"] },
          { model: Categoria, as: "categoria", attributes: ["nombre", "cantidad", "moneda"] }
        ],
        order: [["createdAt", "DESC"]]
      });
      return historial;
    } catch (error) {
      console.error("Error en HistorialGastoService.obtenerTodoHistorial:", error);
      return [];
    }
  }
}

export default HistorialGastoService;