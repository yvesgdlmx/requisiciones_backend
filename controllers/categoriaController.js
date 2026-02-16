import { Categoria, Requisicion } from "../models/Index.js";
import PeriodoService from "../services/PeriodoService.js";
import { Op } from "sequelize";

const parseFechaInicioUTC = (fechaInicio) => {
  if (!fechaInicio) return null;
  if (fechaInicio instanceof Date) return new Date(fechaInicio.getTime());
  if (typeof fechaInicio === "string") {
    const datePart = fechaInicio.split("T")[0].split(" ")[0];
    const [y, m, d] = datePart.split("-").map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
  }
  return new Date(fechaInicio);
};

const addDaysUTC = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const endOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

// Crear una nueva categoría
export const crearCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    
    if (!(usuario.rol === "admin" || usuario.rol === "superadmin")) {
      return res.status(403).json({ msg: "Acción no permitida. Solo admin o superadmin pueden crear categorías." });
    }
    
  const { nombre, cantidad, diasPeriodo, fechaInicio, moneda } = req.body;
  
  if (!nombre || !cantidad || !diasPeriodo || !fechaInicio || !moneda) {
    return res.status(400).json({ msg: "Faltan campos requeridos: nombre, moneda, cantidad, diasPeriodo y fechaInicio" });
  }

  if (!["MXN", "USD", "EUR"].includes(moneda)) {
    return res.status(400).json({ msg: "Moneda inválida. Use MXN, USD o EUR." })  // ✅ CORRECTO
  }
  
  const categoriaExistente = await Categoria.findOne({ where: { nombre } });
  if (categoriaExistente) {
    return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
  }
  
  // ======= DEBUG LOGS =======
  console.log("=== DEBUG CREAR CATEGORÍA ===");
  console.log("1. Fecha recibida del frontend:", fechaInicio);
  console.log("2. Tipo de dato:", typeof fechaInicio);
  console.log("3. Zona horaria del servidor:", Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log("4. Offset del servidor:", new Date().getTimezoneOffset());
  
  // Calcular fecha de fin con bordes de día completos
  // Parsear el datetime directamente sin conversión de timezone
  const inicio = startOfDayUTC(parseFechaInicioUTC(fechaInicio));
  
  console.log("5. Fecha parseada (inicio):", inicio);
  console.log("6. inicio.toString():", inicio.toString());
  console.log("7. inicio.toISOString():", inicio.toISOString());
  console.log("8. inicio.toLocaleString():", inicio.toLocaleString());
  
  const fechaFin = endOfDayUTC(addDaysUTC(inicio, Number(diasPeriodo) - 1));
  
  console.log("9. Fecha fin calculada:", fechaFin.toISOString());
  console.log("=========================");
  
  const nuevaCategoria = await Categoria.create({
    nombre,
    cantidad,
    diasPeriodo: Number(diasPeriodo),
    fechaInicio: inicio,
    fechaFin: fechaFin,
    requiereReinicio: false,
    moneda
  });
  
  console.log("10. Categoría guardada en BD:", {
    id: nuevaCategoria.id,
    fechaInicio: nuevaCategoria.fechaInicio,
    fechaFin: nuevaCategoria.fechaFin
  });
  console.log("=========================\n");
    
    return res.status(201).json({
      msg: "Categoría creada exitosamente",
      categoria: nuevaCategoria
    });
  } catch (error) {
    console.error("Error al crear la categoría:", error);
    return res.status(500).json({ msg: "Error al crear la categoría" });
  }
};

// Obtener todas las categorías
export const obtenerCategorias = async (req, res) => {
  try {
    let categorias = await Categoria.findAll({
      order: [["fechaInicio", "DESC"]]
    });

    // Actualizar dinámicamente las fechas si han pasado períodos
    const categoriasActualizadas = await Promise.all(
      categorias.map(async (cat) => {
        if (PeriodoService.necesitaReinicio(cat.fechaFin)) {
          const dias = Number(cat.diasPeriodo || 30);
          let inicio = startOfDayUTC(addDaysUTC(cat.fechaFin, 1));
          let fin = endOfDayUTC(addDaysUTC(inicio, dias - 1));
          
          cat.fechaInicio = inicio;
          cat.fechaFin = fin;
          cat.requiereReinicio = false;
          
          await cat.save();
        }
        return cat;
      })
    );
    
    return res.json({ categorias: categoriasActualizadas });
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return res.status(500).json({ msg: "Error al obtener categorías" });
  }
};

// Obtener una categoría por ID
export const obtenerCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    
    const categoria = await Categoria.findByPk(id);
    
    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    
    // Verificar si necesita actualizar el período
    if (PeriodoService.necesitaReinicio(categoria.fechaFin)) {
      const dias = Number(categoria.diasPeriodo || 30);
      let inicio = startOfDayUTC(addDaysUTC(categoria.fechaFin, 1));
      let fin = endOfDayUTC(addDaysUTC(inicio, dias - 1));
      
      categoria.fechaInicio = inicio;
      categoria.fechaFin = fin;
      categoria.requiereReinicio = false;
      
      await categoria.save();
    }
    
    return res.json({ categoria });
  } catch (error) {
    console.error("Error al obtener la categoría:", error);
    return res.status(500).json({ msg: "Error al obtener la categoría" });
  }
};

// Actualizar una categoría
export const actualizarCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    
    if (!(usuario.rol === "admin" || usuario.rol === "superadmin")) {
      return res.status(403).json({ msg: "Acción no permitida. Solo admin o superadmin pueden actualizar categorías." });
    }
    
    let categoria = await Categoria.findByPk(id);
    
    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    
    const { nombre, cantidad, diasPeriodo, fechaInicio, moneda } = req.body;
    
    // Si se intenta cambiar el nombre, verificar que no exista otra categoría con ese nombre
    if (nombre && nombre !== categoria.nombre) {
      const categoriaExistente = await Categoria.findOne({ where: { nombre } });
      if (categoriaExistente) {
        return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
      }
    }
    
    // Actualizar campos
    if (nombre !== undefined) categoria.nombre = nombre;
    if (cantidad !== undefined) categoria.cantidad = cantidad;

    if (moneda !== undefined) {
      if(!["MXN", "USD", "EUR"].includes(moneda)) {
        return res.status(400).json({ msg: "Moneda no válida. Las opciones son: MXN, USD, EUR" });
      }
      categoria.moneda = moneda
    }
    
    if (diasPeriodo !== undefined) {
      categoria.diasPeriodo = Number(diasPeriodo);
      // Recalcular fechaFin si cambia diasPeriodo
      const fin = endOfDayUTC(addDaysUTC(startOfDayUTC(categoria.fechaInicio), Number(diasPeriodo) - 1));
      categoria.fechaFin = fin;
    }
    
    if (fechaInicio !== undefined) {
      // Parsear el datetime directamente sin conversión de timezone
      const newInicio = startOfDayUTC(parseFechaInicioUTC(fechaInicio));
      categoria.fechaInicio = newInicio;
      
      // Recalcular fechaFin con bordes correctos
      const newFin = endOfDayUTC(addDaysUTC(newInicio, (categoria.diasPeriodo || 30) - 1));
      categoria.fechaFin = newFin;
    }
    
    await categoria.save();
    
    return res.json({ 
      msg: "Categoría actualizada exitosamente", 
      categoria 
    });
  } catch (error) {
    console.error("Error al actualizar la categoría:", error);
    return res.status(500).json({ msg: "Error al actualizar la categoría" });
  }
};

// Eliminar una categoría
export const eliminarCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    
    if (!(usuario.rol === "admin" || usuario.rol === "superadmin")) {
      return res.status(403).json({ msg: "Acción no permitida. Solo admin o superadmin pueden eliminar categorías." });
    }
    
    const categoria = await Categoria.findByPk(id);
    
    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    
    await categoria.destroy();
    
    return res.json({ msg: "Categoría eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar la categoría:", error);
    return res.status(500).json({ msg: "Error al eliminar la categoría" });
  }
};

// Reiniciar el período de una categoría manualmente
export const reiniciarPeriodoCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    
    if (!(usuario.rol === "admin" || usuario.rol === "superadmin")) {
      return res.status(403).json({ msg: "Acción no permitida" });
    }
    
    let categoria = await Categoria.findByPk(id);
    
    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    
    // Calcular siguiente período
    const siguiente = PeriodoService.obtenerPeriodoActual(
      categoria.fechaFin,
      categoria.periodo
    );
    
    categoria.fechaInicio = siguiente.fechaInicio;
    categoria.fechaFin = siguiente.fechaFin;
    categoria.requiereReinicio = false;
    
    await categoria.save();
    
    return res.json({
      msg: "Período reiniciado exitosamente",
      categoria
    });
  } catch (error) {
    console.error("Error al reiniciar el período:", error);
    return res.status(500).json({ msg: "Error al reiniciar el período" });
  }
};

// Obtener el estado del período actual de una categoría
export const obtenerEstadoPeriodo = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await Categoria.findByPk(id);
    
    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    
    // Verificar si necesita reinicio y ajustar fechas
    if (PeriodoService.necesitaReinicio(categoria.fechaFin)) {
      const periodoActual = PeriodoService.obtenerPeriodoActual(
        categoria.fechaInicio,
        categoria.periodo
      );
      
      categoria.fechaInicio = periodoActual.fechaInicio;
      categoria.fechaFin = periodoActual.fechaFin;
      
      await categoria.save();
    }
    
    return res.json({
      categoria,
      periodoActivo: {
        inicio: categoria.fechaInicio,
        fin: categoria.fechaFin
      }
    });
  } catch (error) {
    console.error("Error al obtener estado del período:", error);
    return res.status(500).json({ msg: "Error al obtener estado" });
  }
};

// Agregar esta nueva función al final del archivo

export const obtenerPresupuestoDisponible = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await Categoria.findByPk(id);
    if (!categoria) return res.status(404).json({ msg: "Categoría no encontrada" });

    const monedaCategoria = categoria.moneda || "MXN";

    // Calcular período actual usando diasPeriodo (ignora la columna periodo)
    const hoy = new Date();
    const dias = Number(categoria.diasPeriodo || 30);

    let inicio = startOfDayUTC(categoria.fechaInicio);
    let fin = endOfDayUTC(addDaysUTC(inicio, dias - 1));

    // Si el período ya expiró, iterar hasta el período vigente
    while (hoy > fin) {
      inicio = startOfDayUTC(addDaysUTC(fin, 1));
      fin = endOfDayUTC(addDaysUTC(inicio, dias - 1));
    }

    const requisiciones = await Requisicion.findAll({
      where: { 
        categoriaId: id, 
        // CAMBIO: solo contar aprobadas/autorizadas
        status: { [Op.in]: ["aprobada", "autorizada"] }
      }
    });

    // Filtrar solo las del período actual
    const enPeriodo = requisiciones.filter((req) => {
      const f = req.fechaCambioStatus || req.updatedAt || req.fechaHora || new Date();
      return f >= inicio && f <= fin;
    });

    let totalGastado = 0;
    enPeriodo.forEach((req) => {
      if (req.monto == null) return;
      if (typeof req.monto === "number") {
        totalGastado += req.monto;
        return;
      }
      const [rawCant, moneda] = String(req.monto).trim().split(" ");
      const cant = parseFloat((rawCant || "").replace(/[$,]/g, ""));
      if (!Number.isNaN(cant) && moneda === monedaCategoria) totalGastado += cant;
    });

    const total = parseFloat(categoria.cantidad);
    const disponible = total - totalGastado;
    const porcentajeUsado = total > 0 ? parseFloat(((totalGastado / total) * 100).toFixed(2)) : 0;

    return res.json({
      categoria: {
        id: categoria.id,
        nombre: categoria.nombre,
        diasPeriodo: categoria.diasPeriodo || 30,
        periodo: `${categoria.diasPeriodo || 30} días`,
        presupuestoTotal: total,
        presupuestoUsado: totalGastado,
        presupuestoDisponible: disponible,
        porcentajeUsado,
        fechaInicio: inicio,
        fechaFin: fin,
        moneda: monedaCategoria
      },
      requisicionesEnPeriodo: enPeriodo.length,
    });
  } catch (error) {
    console.error("Error al calcular presupuesto:", error);
    return res.status(500).json({ msg: "Error al calcular presupuesto" });
  }
};