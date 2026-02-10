import { Categoria, Requisicion } from "../models/Index.js";
import PeriodoService from "../services/PeriodoService.js";
import { Op } from "sequelize";

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
  
  // Calcular fecha de fin con bordes de día completos
  // Parsear el datetime directamente sin conversión de timezone
  const inicio = new Date(fechaInicio);
  
  const fechaFin = new Date(inicio);
  fechaFin.setDate(fechaFin.getDate() + Number(diasPeriodo) - 1);
  fechaFin.setHours(23, 59, 59, 999);
  
  const nuevaCategoria = await Categoria.create({
    nombre,
    cantidad,
    diasPeriodo: Number(diasPeriodo),
    fechaInicio: inicio,
    fechaFin: fechaFin,
    requiereReinicio: false,
    moneda
  });
    
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
          let inicio = new Date(cat.fechaFin);
          inicio.setDate(inicio.getDate() + 1);
          inicio.setHours(0, 0, 0, 0);
          
          let fin = new Date(inicio);
          fin.setDate(fin.getDate() + dias - 1);
          fin.setHours(23, 59, 59, 999);
          
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
      let inicio = new Date(categoria.fechaFin);
      inicio.setDate(inicio.getDate() + 1);
      inicio.setHours(0, 0, 0, 0);
      
      let fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias - 1);
      fin.setHours(23, 59, 59, 999);
      
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
      const fin = new Date(categoria.fechaInicio);
      fin.setDate(fin.getDate() + Number(diasPeriodo) - 1);
      fin.setHours(23, 59, 59, 999);
      categoria.fechaFin = fin;
    }
    
    if (fechaInicio !== undefined) {
      // Parsear el datetime directamente sin conversión de timezone
      const newInicio = new Date(fechaInicio);
      categoria.fechaInicio = newInicio;
      
      // Recalcular fechaFin con bordes correctos
      const newFin = new Date(newInicio);
      newFin.setDate(newFin.getDate() + (categoria.diasPeriodo || 30) - 1);
      newFin.setHours(23, 59, 59, 999);
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

    let inicio = new Date(categoria.fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    let fin = new Date(inicio);
    fin.setDate(fin.getDate() + dias - 1);
    fin.setHours(23, 59, 59, 999);

    // Si el período ya expiró, iterar hasta el período vigente
    while (hoy > fin) {
      inicio = new Date(fin);
      inicio.setDate(inicio.getDate() + 1);
      inicio.setHours(0, 0, 0, 0);

      fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias - 1);
      fin.setHours(23, 59, 59, 999);
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