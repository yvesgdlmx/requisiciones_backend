import { Requisicion, Usuario, Articulo } from "../models/Index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../config/db.js";
import cloudinary from "../config/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generarFolio = (area, consecutivo) => {
  const letraArea = area.charAt(0).toUpperCase();
  const anioActual = new Date().getFullYear().toString().slice(-2);
  const bloqueIzquierda = `${anioActual}`;
  const bloqueDerecha = consecutivo.toString().padStart(5, "0");
  return `${letraArea}${bloqueIzquierda}-${bloqueDerecha}`;
};
export const crearRequisicion = async (req, res) => {
  const t = await db.transaction();
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    // Extraer datos del cuerpo de la petición
    let { objetivo, prioridad, articulos, links } = req.body;
    // Guardar url y public_id de cada archivo
    const archivos = req.files
      ? req.files.map(file => ({
          url: file.path.replace(/\\/g, "/"),
          public_id: file.filename
        }))
      : [];
    if (typeof articulos === "string") {
      try {
        articulos = JSON.parse(articulos);
      } catch (error) {
        return res.status(400).json({ msg: "El campo 'articulos' no es un JSON válido." });
      }
    }
    if (typeof links === "string") {
      try {
        links = JSON.parse(links);
      } catch (error) {
        links = [];
      }
    }
    if (!articulos || !Array.isArray(articulos)) {
      return res.status(400).json({ msg: "El campo 'articulos' debe ser un arreglo." });
    }
    const totalRequisiciones = await Requisicion.count();
    const consecutivo = totalRequisiciones + 1;
    const folio = generarFolio(usuario.area, consecutivo);
    const nuevaRequisicion = await Requisicion.create({
      folio,
      solicitante: usuario.id,
      archivos, // <-- ahora es un array de objetos {url, public_id}
      objetivo,
      prioridad,
      area: usuario.area,
      links
    }, { transaction: t });
    for (const item of articulos) {
      await Articulo.create({
        cantidad: item.cantidad,
        unidadMedida: item.unidadMedida,
        numeroParte: item.numeroParte,
        descripcion: item.descripcion,
        requisicionId: nuevaRequisicion.id
      }, { transaction: t });
    }
    await t.commit();
    const requisicionConArticulos = await Requisicion.findByPk(nuevaRequisicion.id, {
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre", "apellido", "email"] },
        { model: Articulo, as: "articulos" }
      ]
    });
    return res.status(201).json({
      msg: "Requisición creada exitosamente",
      requisicion: requisicionConArticulos
    });
  } catch (error) {
    await t.rollback();
    console.error("Error al crear la requisición:", error);
    return res.status(500).json({ msg: "Error al crear la requisición" });
  }
};

export const obtenerRequisiciones = async (req, res) => {
  try {
    const requisiciones = await Requisicion.findAll({
      order: [["fechaHora", "DESC"]],
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "apellido", "email"]
        },
        {
          model: Articulo,
          as: "articulos"
        }
      ]
    });
    return res.json({ requisiciones });
  } catch (error) {
    console.error("Error al obtener requisiciones:", error);
    return res.status(500).json({ msg: "Error al obtener requisiciones" });
  }
};

export const obtenerRequisicionesAutorizacion = async (req, res) => {
  try {
    const requisiciones = await Requisicion.findAll({
      where: { status: "esperando autorizacion" },
      order: [["fechaHora", "DESC"]],
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "apellido", "email"]
        },
        {
          model: Articulo,
          as: "articulos"
        }
      ]
    });
    return res.json({ requisiciones });
  } catch (error) {
    console.error("Error al obtener requisiciones en autorización:", error);
    return res.status(500).json({ msg: "Error al obtener requisiciones de autorización" });
  }
};

export const obtenerRequisicionesPorUsuario = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    const requisiciones = await Requisicion.findAll({
      where: { solicitante: usuario.id },
      order: [["fechaHora", "DESC"]],
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "apellido", "email"]
        },
        {
          model: Articulo,
          as: "articulos"
        }
      ]
    });
    return res.json({ requisiciones });
  } catch (error) {
    console.error("Error al obtener requisiciones del usuario:", error);
    return res.status(500).json({ msg: "Error al obtener requisiciones del usuario" });
  }
};

export const obtenerRequisicion = async (req, res) => {
  try {
    const { id } = req.params;
    const requisicion = await Requisicion.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "apellido", "email"]
        },
        {
          model: Articulo,
          as: "articulos"
        }
      ]
    });
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    return res.json({ requisicion });
  } catch (error) {
    console.error("Error al obtener la requisición:", error);
    return res.status(500).json({ msg: "Error al obtener la requisición" });
  }
};

export const obtenerRequisicionPorUsuario = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    const requisicion = await Requisicion.findOne({
      where: { id, solicitante: usuario.id },
      include: [
        { model: Articulo, as: "articulos" }
      ]
    });
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada o no pertenece al usuario" });
    }
    return res.json({ requisicion });
  } catch (error) {
    console.error("Error al obtener la requisición del usuario:", error);
    return res.status(500).json({ msg: "Error al obtener la requisición del usuario" });
  }
};

export const actualizarRequisicion = async (req, res) => {
  const t = await db.transaction();
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    const requisicion = await Requisicion.findByPk(id, {
      include: [{ model: Articulo, as: "articulos" }]
    });
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    if (requisicion.solicitante !== usuario.id) {
      return res.status(403).json({ msg: "Acción no permitida. No eres el propietario." });
    }
    if (requisicion.status !== "creada") {
      return res.status(403).json({ msg: "No puedes modificar la requisición porque su status ya cambió." });
    }

    const { objetivo, prioridad, status, articulos, links } = req.body;

    // Archivos existentes (pueden ser objetos o strings)
    let archivosExistentes = [];
    if (req.body.archivosExistentes) {
      try {
        archivosExistentes = JSON.parse(req.body.archivosExistentes);
      } catch (e) {
        archivosExistentes = Array.isArray(req.body.archivosExistentes)
          ? req.body.archivosExistentes
          : [];
      }
    }

    // Archivos nuevos (Cloudinary)
    const archivosNuevos = req.files
      ? req.files.map(file => ({
          url: file.path.replace(/\\/g, "/"),
          public_id: file.filename
        }))
      : [];

    // Combinar archivos existentes y nuevos
    const archivosFinales = [...archivosExistentes, ...archivosNuevos];

    // Eliminar archivos de Cloudinary que ya no están en la lista de conservación
    const archivosOriginales = requisicion.archivos || [];
    const archivosEliminados = archivosOriginales.filter(
      original => !archivosExistentes.some(
        exist =>
          (typeof exist === "string" && exist === original) ||
          (typeof exist === "object" && typeof original === "object" && exist.public_id === original.public_id) ||
          (typeof exist === "object" && typeof original === "string" && exist.url === original)
      )
    );
    for (const file of archivosEliminados) {
      if (typeof file === "object" && file.public_id) {
        let resourceType = "image";
        let publicId = file.public_id;
        if (file.url && file.url.match(/\.(pdf)$/i)) {
          resourceType = "raw";
          if (!publicId.endsWith('.pdf')) {
            publicId = publicId + '.pdf';
          }
        }
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          console.log(`Eliminado de Cloudinary: ${publicId} (${resourceType})`);
        } catch (err) {
          console.error("Error eliminando archivo de Cloudinary:", publicId, err);
        }
      }
    }

    // Actualizar campos de la cabecera
    requisicion.objetivo = (objetivo !== undefined) ? objetivo : requisicion.objetivo;
    requisicion.prioridad = (prioridad !== undefined) ? prioridad : requisicion.prioridad;
    requisicion.status = (status !== undefined) ? status : requisicion.status;
    requisicion.archivos = archivosFinales;

    // Manejar links
    let parsedLinks = requisicion.links || [];
    if (links !== undefined) {
      if (typeof links === "string") {
        try {
          parsedLinks = JSON.parse(links);
        } catch (e) {
          parsedLinks = [];
        }
      } else if (Array.isArray(links)) {
        parsedLinks = links;
      }
      requisicion.links = parsedLinks;
    }

    await requisicion.save({ transaction: t });

    // Procesar artículos
    let parsedArticulos = [];
    if (articulos) {
      try {
        parsedArticulos = JSON.parse(articulos);
      } catch (e) {
        parsedArticulos = Array.isArray(articulos) ? articulos : [];
      }
    }
    if (parsedArticulos.length > 0) {
      await Articulo.destroy({
        where: { requisicionId: requisicion.id },
        transaction: t
      });
      for (const item of parsedArticulos) {
        await Articulo.create({
          cantidad: item.cantidad,
          unidadMedida: item.unidadMedida,
          numeroParte: item.numeroParte,
          descripcion: item.descripcion,
          requisicionId: requisicion.id
        }, { transaction: t });
      }
    }
    await t.commit();
    const requisicionActualizada = await Requisicion.findByPk(requisicion.id, {
      include: [{ model: Articulo, as: "articulos" }]
    });
    return res.json({ msg: "Requisición actualizada", requisicion: requisicionActualizada });
  } catch (error) {
    await t.rollback();
    console.error("Error al actualizar la requisición:", error);
    return res.status(500).json({ msg: "Error al actualizar la requisición" });
  }
};


export const actualizarRequisicionAdmin = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    // Solo admin o superadmin pueden acceder
    if (!(usuario.rol === "admin" || usuario.rol === "superadmin")) {
      return res.status(403).json({ msg: "Acción no permitida. Solo admin o superAdmin pueden usar este endpoint." });
    }
    let requisicion = await Requisicion.findByPk(id);
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    const { status, prioridad, comentario, numeroOrdenCompra, proveedor, tipoCompra, monto, eta, archivosExistentes } = req.body;
    // Si se intenta actualizar el status y el rol es superadmin, se rechaza la acción
    if (status !== undefined && usuario.rol === "superadmin") {
      return res.status(403).json({ msg: "No tienes los permisos para actualizar una requisición" });
    }
    if (status !== undefined) {
      requisicion.status = status;
      // Registra el admin que realizó el cambio
      requisicion.comprador = `${usuario.nombre} ${usuario.apellido}`;
      requisicion.fechaCambioStatus = new Date();
    }
    if (prioridad !== undefined) {
      requisicion.prioridad = prioridad;
    }
    // Actualizar comentario (opcional)
    if (comentario !== undefined) {
      requisicion.comentario = comentario;
    }
    // NUEVO: Actualizar número de orden de compra, proveedor y tipo de compra
    if (numeroOrdenCompra !== undefined) {
      requisicion.numeroOrdenCompra = numeroOrdenCompra;
    }
    if (proveedor !== undefined) {
      requisicion.proveedor = proveedor;
    }
    if (tipoCompra !== undefined) {
      // Si viene vacío o como string "null", guarda null real en la BD
      if (tipoCompra === "" || tipoCompra === "null") {
        requisicion.tipoCompra = null;
      } else {
        requisicion.tipoCompra = tipoCompra;
      }
    }
    // NUEVOS CAMPOS: Actualizar monto y ETA
    if (monto !== undefined) {
      requisicion.monto = monto;
    }
    if (eta !== undefined) {
      // Si viene vacío, guarda null; si no, convierte a fecha
      if (eta === "" || eta === "null") {
        requisicion.eta = null;
      } else {
        requisicion.eta = new Date(eta);
      }
    }

    // MANEJO DE ARCHIVOS MEJORADO
    let archivosFinales = [];
    
    // Procesar archivos existentes que se conservarán
    if (archivosExistentes) {
      try {
        const archivosParseados = JSON.parse(archivosExistentes);
        archivosFinales = Array.isArray(archivosParseados) ? archivosParseados : [];
      } catch (e) {
        archivosFinales = [];
      }
    }

    // Identificar archivos a eliminar de Cloudinary
    const archivosOriginales = requisicion.archivos || [];
    const archivosAEliminar = archivosOriginales.filter(
      original => !archivosFinales.some(
        conservado =>
          (typeof conservado === "string" && conservado === original) ||
          (typeof conservado === "object" && typeof original === "object" && conservado.public_id === original.public_id) ||
          (typeof conservado === "object" && typeof original === "string" && conservado.url === original)
      )
    );

    // Eliminar archivos de Cloudinary
    for (const file of archivosAEliminar) {
      if (typeof file === "object" && file.public_id) {
        let resourceType = "image";
        let publicId = file.public_id;
        if (file.url && file.url.match(/\.(pdf)$/i)) {
          resourceType = "raw";
          if (!publicId.endsWith('.pdf')) {
            publicId = publicId + '.pdf';
          }
        }
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          console.log(`Eliminado de Cloudinary: ${publicId} (${resourceType})`);
        } catch (err) {
          console.error("Error eliminando archivo de Cloudinary:", publicId, err);
        }
      }
    }

    // Agregar nuevos archivos subidos
    if (req.files && req.files.length > 0) {
      const nuevosArchivos = req.files.map(file => ({
        url: file.path.replace(/\\/g, "/"),
        public_id: file.filename
      }));
      archivosFinales = [...archivosFinales, ...nuevosArchivos];
    }

    // Actualizar la requisición con los archivos finales
    requisicion.archivos = archivosFinales;

    await requisicion.save();
    // Consulta la requisición actualizada incluyendo datos del usuario y los artículos asociados
    requisicion = await Requisicion.findByPk(id, {
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre", "apellido", "email"] },
        { model: Articulo, as: "articulos" }
      ]
    });
    return res.json({ msg: "Requisición actualizada (admin)", requisicion });
  } catch (error) {
    console.error("Error al actualizar la requisición (admin):", error);
    return res.status(500).json({ msg: "Error al actualizar la requisición" });
  }
};

export const actualizarRequisicionSuperAdmin = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    
    // Verificar autorización
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    if (usuario.rol !== "superadmin") {
      return res.status(403).json({ msg: "Acción no permitida. Solo superadmin puede usar este endpoint." });
    }
    // Buscar la requisición
    let requisicion = await Requisicion.findByPk(id);
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    
    // Actualizar status y comentario del autorizador
    const { status, comentarioAutorizador } = req.body;
    
    if (status !== undefined) {
      requisicion.status = status;
      requisicion.fechaCambioStatus = new Date();
    }
    
    // NUEVO: Actualizar comentario del autorizador
    if (comentarioAutorizador !== undefined) {
      requisicion.comentarioAutorizador = comentarioAutorizador;
    }
    
    await requisicion.save();
    
    // Obtener la requisición actualizada con sus relaciones
    requisicion = await Requisicion.findByPk(id, {
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre", "apellido", "email"] },
        { model: Articulo, as: "articulos" }
      ]
    });
    return res.json({ 
      msg: "Requisición actualizada (superadmin)", 
      requisicion 
    });
  } catch (error) {
    console.error("Error al actualizar la requisición (superadmin):", error);
    return res.status(500).json({ msg: "Error al actualizar la requisición" });
  }
};

export const eliminarRequisicion = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    if (!usuario) {
      return res.status(401).json({ msg: "No autorizado" });
    }
    const requisicion = await Requisicion.findByPk(id);
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    // Verificar que el usuario propietario sea quien intente eliminarla
    if (requisicion.solicitante !== usuario.id) {
      return res.status(403).json({ msg: "Acción no permitida. No eres el propietario." });
    }

    // Eliminar archivos de Cloudinary asociados a la requisición
    if (requisicion.archivos && Array.isArray(requisicion.archivos)) {
      for (const file of requisicion.archivos) {
        if (typeof file === "object" && file.public_id) {
          let resourceType = "image";
          let publicId = file.public_id;
          if (file.url && file.url.match(/\.(pdf)$/i)) {
            resourceType = "raw";
            if (!publicId.endsWith('.pdf')) {
              publicId = publicId + '.pdf';
            }
          }
          try {
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            console.log(`Eliminado de Cloudinary: ${publicId} (${resourceType})`);
          } catch (err) {
            console.error("Error eliminando archivo de Cloudinary:", publicId, err);
          }
        }
      }
    }

    // Eliminar los artículos asociados a la requisición
    await Articulo.destroy({ where: { requisicionId: requisicion.id } });
    // Eliminar la requisición
    await requisicion.destroy();
    return res.json({ msg: "Requisición eliminada" });
  } catch (error) {
    console.error("Error al eliminar la requisición:", error);
    return res.status(500).json({ msg: "Error al eliminar la requisición" });
  }
};

export const marcarRequisicionComoVisto = async (req, res) => {
  try {
    const { id } = req.params;
    const requisicion = await Requisicion.findByPk(id);
    if (!requisicion) {
      return res.status(404).json({ msg: "Requisición no encontrada" });
    }
    // Si aún no fue marcada como abierta, o si el status ya no es "creada", actualizamos el campo.
    if (requisicion.status !== "creada") {
      requisicion.abierto = true;
      await requisicion.save();
    }
    return res.json({ msg: "Requisición marcada como vista", requisicion });
  } catch (error) {
    console.error("Error al marcar la requisición como vista:", error);
    return res.status(500).json({ msg: "Error al marcar la requisición como vista" });
  }
};