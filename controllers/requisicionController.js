import { Requisicion, Usuario, Articulo, Categoria, Excedente, HistorialGasto, HistorialStatusRequisicion } from "../models/Index.js";
import NotificacionService from "../services/NotificacionService.js";
import HistorialGastoService from "../services/HistorialGastoService.js";
import HistorialStatusService from "../services/HistorialStatusService.js";
import { canonicalizarStatusFlujo, normalizarStatusFlujo, validarTransicionStatus } from "../utils/flujoStatusRequisicion.js";
import fs, { stat } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../config/db.js";
import cloudinary from "../config/cloudinary.js";
import { Op } from "sequelize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generarFolio = (area, consecutivo) => {
    const letraArea = area.charAt(0).toUpperCase();
    const anioActual = new Date().getFullYear().toString().slice(-2);
    const bloqueIzquierda = `${anioActual}`;
    const bloqueDerecha = consecutivo.toString().padStart(5, "0");
    return `${letraArea}${bloqueIzquierda}-${bloqueDerecha}`;
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

const isPdfFile = (file) =>
    file?.mimetype === "application/pdf" ||
    file?.format === "pdf" ||
    file?.url?.match(/\.pdf($|\?)/i);

const serializeUploadedFile = (file) => ({
    url: file.path.replace(/\\/g, "/"),
    public_id: file.filename,
    resource_type: isPdfFile(file) ? "raw" : "image",
    format: isPdfFile(file) ? "pdf" : file.mimetype?.split("/")[1],
    mimetype: file.mimetype,
    original_name: file.originalname
});

const getUploadedFiles = (req, fieldName = "archivo") => {
    if (!req.files) return [];

    if (Array.isArray(req.files)) {
        return fieldName === "archivo" ? req.files : [];
    }

    return req.files[fieldName] || [];
};

const parseJsonArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const fileMatches = (file, target) =>
    (typeof target === "string" && target === file) ||
    (typeof target === "object" && typeof file === "object" && target.public_id === file.public_id) ||
    (typeof target === "object" && typeof file === "string" && target.url === file);

const deleteCloudinaryFile = async (file) => {
    if (typeof file !== "object" || !file.public_id) return;

    const resourceType = file.resource_type || (isPdfFile(file) ? "raw" : "image");
    const candidatePublicIds = [file.public_id];

    if (resourceType === "raw" && isPdfFile(file) && !file.public_id.endsWith(".pdf")) {
        candidatePublicIds.push(`${file.public_id}.pdf`);
    }

    for (const publicId of candidatePublicIds) {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType
            });

            if (result?.result === "ok" || result?.result === "not found") {
                console.log(`Eliminado de Cloudinary: ${publicId} (${resourceType})`);
                return;
            }
        } catch (err) {
            console.error("Error eliminando archivo de Cloudinary:", publicId, err);
        }
    }
};

const normalizarStatusReporte = (status) => {
    if (typeof status !== "string") return "";

    return status
        .toLowerCase()
        .replaceAll("Ã­", "í")
        .replaceAll("ÃƒÂ­", "í")
        .replaceAll("ÃƒÆ’Ã‚Â­", "í")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const formatearDuracionReporte = (milisegundos) => {
    if (milisegundos === null || milisegundos === undefined || milisegundos < 0) {
        return null;
    }

    const minutosTotales = Math.floor(milisegundos / 60000);
    const dias = Math.floor(minutosTotales / 1440);
    const horas = Math.floor((minutosTotales % 1440) / 60);
    const minutos = minutosTotales % 60;

    return `${dias}d ${horas}h ${minutos}m`;
};

const crearDuracionReporte = (inicio, fin) => {
    if (!inicio || !fin) {
        return {
            completado: false,
            milisegundos: null,
            texto: "Pendiente",
            inicio: inicio || null,
            fin: fin || null
        };
    }

    const inicioFecha = new Date(inicio);
    const finFecha = new Date(fin);
    const milisegundos = finFecha - inicioFecha;

    if (Number.isNaN(milisegundos) || milisegundos < 0) {
        return {
            completado: false,
            milisegundos: null,
            texto: "Sin dato",
            inicio,
            fin
        };
    }

    return {
        completado: true,
        milisegundos,
        texto: formatearDuracionReporte(milisegundos),
        inicio,
        fin
    };
};

const obtenerFechaPrimerStatus = (historial, statusObjetivo, fechaMinima = null) => {
    const statusNormalizado = normalizarStatusReporte(statusObjetivo);
    const minima = fechaMinima ? new Date(fechaMinima) : null;

    const movimiento = historial.find((item) => {
        const fechaCambio = new Date(item.fechaCambio);

        return (
            normalizarStatusReporte(item.statusNuevo) === statusNormalizado &&
            (!minima || fechaCambio >= minima)
        );
    });

    return movimiento?.fechaCambio || null;
};

const calcularPromedioReporte = (requisiciones, clave) => {
    const completados = requisiciones.filter((item) => item.tiempos[clave]?.completado).length;

    return {
        completados,
        pendientes: requisiciones.length - completados
    };
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
        const archivos = req.files ? req.files.map(serializeUploadedFile) : [];
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

        await NotificacionService.crearNotificacionRequisicionCreada(nuevaRequisicion.id, usuario);

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
                },
                {
                    model: Categoria,
                    as: "categoria",
                    attributes: ["id", "nombre", "cantidad", "diasPeriodo", "fechaInicio", "fechaFin"]
                }
            ]
        });
        return res.json({ requisiciones });
    } catch (error) {
        console.error("Error al obtener requisiciones:", error);
        return res.status(500).json({ msg: "Error al obtener requisiciones" });
    }
};

export const obtenerReporteTiemposRequisiciones = async (req, res) => {
    try {
        const requisiciones = await Requisicion.findAll({
            order: [["fechaHora", "DESC"]],
            attributes: ["id", "folio", "fechaHora", "status", "area", "objetivo"],
            include: [
                {
                    model: Usuario,
                    as: "usuario",
                    attributes: ["id", "nombre", "apellido", "email"]
                },
                {
                    model: HistorialStatusRequisicion,
                    as: "historialStatus",
                    attributes: ["id", "statusAnterior", "statusNuevo", "fechaCambio"],
                    required: false
                }
            ]
        });

        const detalle = requisiciones.map((requisicion) => {
            const reqJson = requisicion.toJSON();
            const historial = [...(reqJson.historialStatus || [])].sort(
                (a, b) => new Date(a.fechaCambio) - new Date(b.fechaCambio)
            );

            const fechaCreada = reqJson.fechaHora;
            const fechaCotizando = obtenerFechaPrimerStatus(historial, "cotizando");
            const fechaRechazada = obtenerFechaPrimerStatus(historial, "rechazada");
            const fechaEsperandoAutorizacion = obtenerFechaPrimerStatus(historial, "esperando autorizacion");
            const fechaAutorizada = obtenerFechaPrimerStatus(
                historial,
                "autorizada",
                fechaEsperandoAutorizacion
            );
            const fechaProveedorPreparandoEnvio = obtenerFechaPrimerStatus(
                historial,
                "proveedor preparando envio",
                fechaCotizando
            );
            const fechaConcluida = obtenerFechaPrimerStatus(historial, "concluida");

            return {
                id: reqJson.id,
                folio: reqJson.folio,
                fechaCreada,
                statusActual: reqJson.status,
                area: reqJson.area,
                objetivo: reqJson.objetivo,
                solicitante: reqJson.usuario
                    ? `${reqJson.usuario.nombre || ""} ${reqJson.usuario.apellido || ""}`.trim()
                    : "Sin solicitante",
                tiempos: {
                    creadaCotizando: crearDuracionReporte(fechaCreada, fechaCotizando),
                    creadaRechazada: crearDuracionReporte(fechaCreada, fechaRechazada),
                    esperandoAutorizacionAutorizada: crearDuracionReporte(
                        fechaEsperandoAutorizacion,
                        fechaAutorizada
                    ),
                    cotizandoProveedorPreparandoEnvio: crearDuracionReporte(
                        fechaCotizando,
                        fechaProveedorPreparandoEnvio
                    ),
                    creadaConcluida: crearDuracionReporte(fechaCreada, fechaConcluida)
                }
            };
        });

        const metricas = [
            {
                clave: "creadaCotizando",
                titulo: "Creada a cotizando",
                descripcion: "Desde la creacion hasta el inicio de cotizacion"
            },
            {
                clave: "creadaRechazada",
                titulo: "Creada a rechazada",
                descripcion: "Desde la creacion hasta rechazo"
            },
            {
                clave: "esperandoAutorizacionAutorizada",
                titulo: "Esperando autorizacion a autorizada",
                descripcion: "Tiempo en revision de autorizacion"
            },
            {
                clave: "cotizandoProveedorPreparandoEnvio",
                titulo: "Cotizando a proveedor preparando envio",
                descripcion: "Tiempo hasta preparacion del proveedor"
            },
            {
                clave: "creadaConcluida",
                titulo: "Creada a concluida",
                descripcion: "Tiempo total hasta cierre"
            }
        ].map((metrica) => ({
            ...metrica,
            ...calcularPromedioReporte(detalle, metrica.clave)
        }));

        return res.json({
            msg: "Reporte de tiempos obtenido",
            totalRequisiciones: detalle.length,
            metricas,
            requisiciones: detalle
        });
    } catch (error) {
        console.error("Error al obtener reporte de tiempos:", error);
        return res.status(500).json({
            msg: "Error al obtener el reporte de tiempos"
        });
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
        // Los cambios de proceso deben pasar por los endpoints administrativos.
        const errorStatus = validarTransicionStatus(requisicion.status, status, "solicitante");
        if (errorStatus) {
            await t.rollback();
            return res.status(400).json({ msg: errorStatus });
        }

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
        const archivosNuevos = req.files ? req.files.map(serializeUploadedFile) : [];

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
            await deleteCloudinaryFile(file);
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

        // Crear o actualizar historial de gasto si hay categoría y monto
        if (requisicionActualizada.categoriaId && requisicionActualizada.monto) {
            await HistorialGastoService.crearOActualizarHistorial(
                requisicionActualizada,
                `${usuario.nombre} ${usuario.apellido}`
            );
        }

        return res.json({ msg: "Requisición actualizada", requisicion: requisicionActualizada });
    } catch (error) {
        await t.rollback();
        console.error("Error al actualizar la requisición:", error);
        return res.status(500).json({ msg: "Error al actualizar la requisición" });
    }
};


export const actualizarRequisicionAdmin = async (req, res) => {
    let transaccion;
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
        transaccion = await db.transaction();
        let requisicion = await Requisicion.findByPk(id, {
            transaction: transaccion, lock: transaccion.LOCK.UPDATE
        });
        if (!requisicion) {
            return res.status(404).json({ msg: "Requisición no encontrada" });
        }
        const { status: statusSolicitado, prioridad, comentario, numeroOrdenCompra, cotizacion, numeroGuia, numeroOrdenVenta, factura, proveedor, tipoCompra, recurrenciaCompra, monto, eta, archivosExistentes, cotizacionesExistentes, categoriaGasto, categoriaId } = req.body;
        const status = canonicalizarStatusFlujo(statusSolicitado);

        // Guardar status anterior para notificaciones
        const statusAnterior = requisicion.status;
        const comentarioAnterior = requisicion.comentario;
        const etaAnterior = requisicion.eta ? new Date(requisicion.eta).toISOString() : null;

        const cambiaStatus = status !== undefined &&
            normalizarStatusFlujo(status) !== normalizarStatusFlujo(statusAnterior);
        // La decisión del superadmin se realiza en el endpoint de autorización.
        if (cambiaStatus && usuario.rol === "superadmin") {
            return res.status(403).json({ msg: "No tienes los permisos para actualizar una requisición" });
        }
        const errorStatus = validarTransicionStatus(statusAnterior, status, "admin");
        if (errorStatus) {
            return res.status(400).json({ msg: errorStatus });
        }
        if (cambiaStatus) {
            requisicion.status = status;
            requisicion.comprador = `${usuario.nombre} ${usuario.apellido}`;
            requisicion.fechaCambioStatus = new Date();
        }
        if (prioridad !== undefined) {
            requisicion.prioridad = prioridad;
        }
        if (comentario !== undefined) {
            requisicion.comentario = comentario;
        }
        if (numeroOrdenCompra !== undefined) {
            requisicion.numeroOrdenCompra = numeroOrdenCompra;
        }

        const compraInternacional = tipoCompra === "internacional";

        if (compraInternacional) {
            if (cotizacion !== undefined) {
                requisicion.cotizacion = cotizacion;
            }
            if (numeroGuia !== undefined) {
                requisicion.numeroGuia = numeroGuia;
            }
            if (numeroOrdenVenta !== undefined) {
                requisicion.numeroOrdenVenta = numeroOrdenVenta;
            }
            if (factura !== undefined) {
                requisicion.factura = factura;
            }
        } else if (tipoCompra !== undefined) {
            requisicion.cotizacion = null;
            requisicion.numeroGuia = null;
            requisicion.numeroOrdenVenta = null;
            requisicion.factura = null;
        }

        if (proveedor !== undefined) {
            requisicion.proveedor = proveedor;
        }
        if (tipoCompra !== undefined) {
            if (tipoCompra === "" || tipoCompra === "null") {
                requisicion.tipoCompra = null;
            } else {
                requisicion.tipoCompra = tipoCompra;
            }
        }
        if (recurrenciaCompra !== undefined) {
            if (recurrenciaCompra === "" || recurrenciaCompra === "null") {
                requisicion.recurrenciaCompra = null;
            } else {
                requisicion.recurrenciaCompra = recurrenciaCompra;
            }
        }

        // CAMBIO: Validar moneda del monto con la categoría antes de asignar
        if (monto !== undefined) {
            const parseMonto = (m) => {
                if (!m) return { cantidad: null, moneda: null };
                const [rawCant, mon] = String(m).trim().split(" ");
                const cant = parseFloat((rawCant || "").replace(/[$,]/g, ""));
                return { cantidad: Number.isNaN(cant) ? null : cant, moneda: mon || null };
            };

            const { cantidad: montoCantidad, moneda: monedaMonto } = parseMonto(monto);

            // Determinar categoría para validar moneda
            let catIdAValidar = null;
            if (categoriaId !== undefined) {
                catIdAValidar = (categoriaId === "" || categoriaId === "null") ? null : Number(categoriaId);
            } else if (categoriaGasto !== undefined && categoriaGasto !== "" && categoriaGasto !== "null") {
                const nombre = String(categoriaGasto).trim().toLowerCase();
                let cat = await Categoria.findOne({ where: { nombre } });
                if (!cat) {
                    cat = await Categoria.create({
                        nombre,
                        cantidad: 0,
                        diasPeriodo: 30,
                        moneda: "MXN",
                        fechaInicio: new Date(),
                        fechaFin: null
                    });
                }
                catIdAValidar = cat.id;
            } else {
                catIdAValidar = requisicion.categoriaId;
            }

            // CAMBIO: Validar que moneda del monto coincida con moneda de la categoría
            if (catIdAValidar && monedaMonto) {
                const categoria = await Categoria.findByPk(catIdAValidar);
                if (categoria && categoria.moneda && categoria.moneda !== monedaMonto) {
                    return res.status(400).json({
                        msg: `La moneda del monto (${monedaMonto}) no coincide con la moneda de la categoría (${categoria.moneda}). La categoría "${categoria.nombre}" usa ${categoria.moneda}.`
                    });
                }
            }

            // NUEVA LÓGICA: Validar presupuesto y registrar excedentes
            // Validar presupuesto al iniciar cotizacion o autorizar.
            if (montoCantidad !== null && catIdAValidar && (status === "cotizando" || status === "autorizada")) {
                const categoria = await Categoria.findByPk(catIdAValidar);

                if (categoria) {
                    // Obtener gasto actual de la categoría en el período actual
                    const gastoActual = await HistorialGasto.sum("montoGastado", {
                        where: {
                            categoriaId: catIdAValidar,
                            fechaGasto: {
                                [Op.gte]: categoria.fechaInicio,
                                [Op.lte]: categoria.fechaFin || new Date()
                            }
                        }
                    }) || 0;

                    const presupuestoDisponible = categoria.cantidad - gastoActual;

                    // Si el monto excede el presupuesto disponible
                    if (montoCantidad > presupuestoDisponible) {
                        const montoExcedente = montoCantidad - presupuestoDisponible;

                        const diasPeriodo = Number(categoria.diasPeriodo || 30);

                        // USAR fechaFin de la categoría como base
                        const periodoFin = new Date(categoria.fechaFin);

                        // Inicio del excedente: día siguiente a fechaFin 00:00:00
                        const excedenteInicio = startOfDayUTC(addDaysUTC(periodoFin, 1));

                        // Fin del excedente: diasPeriodo después con hora 23:59:59
                        const excedenteFin = endOfDayUTC(addDaysUTC(excedenteInicio, diasPeriodo - 1));

                        await Excedente.create({
                            categoriaId: catIdAValidar,
                            excedente: montoExcedente,
                            moneda: categoria.moneda,
                            fecha_inicio: excedenteInicio,
                            fecha_fin: excedenteFin
                        });

                        console.log(`Excedente registrado: ${montoExcedente} ${categoria.moneda} en categoría ${categoria.nombre}`);
                        console.log(`Período excedente: ${excedenteInicio.toISOString()} - ${excedenteFin.toISOString()}`);
                    }
                }
            }

            requisicion.monto = monto;
        }

        // Manejo de categoría: preferir categoriaId; si no hay, resolver por nombre (categoriaGasto)
        if (categoriaId !== undefined) {
            requisicion.categoriaId = (categoriaId === "" || categoriaId === "null") ? null : Number(categoriaId);
            requisicion.categoriaGasto = null; // limpiar el campo antiguo
        } else if (categoriaGasto !== undefined) {
            if (categoriaGasto === "" || categoriaGasto === "null") {
                requisicion.categoriaId = null;
                requisicion.categoriaGasto = null;
            } else {
                // Buscar o crear categoría por nombre
                const nombre = String(categoriaGasto).trim().toLowerCase();
                let cat = await Categoria.findOne({ where: { nombre } });
                if (!cat) {
                    cat = await Categoria.create({
                        nombre,
                        cantidad: 0,
                        diasPeriodo: 30,
                        moneda: "MXN",
                        fechaInicio: new Date(),
                        fechaFin: null
                    });
                }
                requisicion.categoriaId = cat.id;
                requisicion.categoriaGasto = categoriaGasto; // mantener por compatibilidad
            }
        }

        if (eta !== undefined) {
            if (eta === "" || eta === "null") {
                requisicion.eta = null;
            } else {
                const fechaEta = new Date(eta + 'T12:00:00.000Z');
                requisicion.eta = fechaEta;
            }
        }

        let archivosFinales = parseJsonArray(archivosExistentes);
        let cotizacionesFinales = parseJsonArray(cotizacionesExistentes);
        const documentosSubidos = getUploadedFiles(req, "archivo");
        const cotizacionesSubidas = getUploadedFiles(req, "cotizacionesArchivo");

        if (
            requisicion.recurrenciaCompra === "no_recurrente" &&
            cotizacionesFinales.length + cotizacionesSubidas.length < 3
        ) {
            for (const file of [...documentosSubidos, ...cotizacionesSubidas]) {
                await deleteCloudinaryFile(serializeUploadedFile(file));
            }

            return res.status(400).json({
                msg: "Las compras no recurrentes requieren al menos 3 archivos de cotizacion."
            });
        }

        // Identificar archivos a eliminar de Cloudinary
        const archivosOriginales = requisicion.archivos || [];
        const archivosAEliminar = archivosOriginales.filter(
            original => !archivosFinales.some(conservado => fileMatches(original, conservado))
        );

        // Eliminar archivos de Cloudinary
        for (const file of archivosAEliminar) {
            await deleteCloudinaryFile(file);
        }

        const cotizacionesOriginales = requisicion.cotizacionesArchivos || [];
        const cotizacionesAEliminar = cotizacionesOriginales.filter(
            original => !cotizacionesFinales.some(conservada => fileMatches(original, conservada))
        );

        for (const file of cotizacionesAEliminar) {
            await deleteCloudinaryFile(file);
        }

        // Agregar nuevos archivos subidos
        if (documentosSubidos.length > 0) {
            const nuevosArchivos = documentosSubidos.map(serializeUploadedFile);
            archivosFinales = [...archivosFinales, ...nuevosArchivos];
        }

        if (cotizacionesSubidas.length > 0) {
            const nuevasCotizaciones = cotizacionesSubidas.map(serializeUploadedFile);
            cotizacionesFinales = [...cotizacionesFinales, ...nuevasCotizaciones];
        }

        // Actualizar la requisición con los archivos finales
        requisicion.archivos = archivosFinales;

        requisicion.cotizacionesArchivos = cotizacionesFinales;

        await requisicion.save({ transaction: transaccion });

        // El avance y su historial se guardan juntos antes de emitir notificaciones.
        if (cambiaStatus) {
            await HistorialStatusService.registrarCambioStatus({
                requisicionId: requisicion.id, statusAnterior, statusNuevo: status,
                usuario, comentario, transaction: transaccion
            });
        }
        await transaccion.commit();

        // Generar notificaciones si hubo cambios relevantes
        if (cambiaStatus) {
            await NotificacionService.crearNotificacionCambioStatus(requisicion.id, statusAnterior, status, `${usuario.nombre} ${usuario.apellido}`);
        }
        // Notificación por comentario agregado
        if (comentario !== undefined && comentario !== comentarioAnterior && comentario !== null && comentario !== "") {
            await NotificacionService.crearNotificacionComentario(requisicion.id, "comentario");
        }
        // Notificación por cambio de ETA
        const nuevoEtaISO = requisicion.eta ? new Date(requisicion.eta).toISOString() : null;
        if (eta !== undefined && nuevoEtaISO !== etaAnterior && nuevoEtaISO !== null) {
            await NotificacionService.crearNotificacionEta(requisicion.id, nuevoEtaISO, proveedor);
        }

        // Consulta la requisición actualizada incluyendo datos del usuario, artículos y categoría
        requisicion = await Requisicion.findByPk(id, {
            include: [
                { model: Usuario, as: "usuario", attributes: ["id", "nombre", "apellido", "email"] },
                { model: Articulo, as: "articulos" },
                { model: Categoria, as: "categoria", attributes: ["id", "nombre", "cantidad", "diasPeriodo", "fechaInicio", "fechaFin", "moneda"] }
            ]
        });

        // Crear o actualizar historial de gasto
        await HistorialGastoService.crearOActualizarHistorial(
            requisicion,
            `${usuario.nombre} ${usuario.apellido}`
        );

        return res.json({ msg: "Requisición actualizada (admin)", requisicion });
    } catch (error) {
        console.error("Error al actualizar la requisición (admin):", error);
        return res.status(500).json({ msg: "Error al actualizar la requisición" });
    } finally {
        if (transaccion && !transaccion.finished) await transaccion.rollback();
    }
};

export const actualizarRequisicionSuperAdmin = async (req, res) => {
    let transaccion;
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
        transaccion = await db.transaction();
        let requisicion = await Requisicion.findByPk(id, {
            transaction: transaccion, lock: transaccion.LOCK.UPDATE
        });
        if (!requisicion) {
            return res.status(404).json({ msg: "Requisición no encontrada" });
        }

        // Actualizar status y comentario del autorizador
        const { status: statusSolicitado, comentarioAutorizador } = req.body;
        const status = canonicalizarStatusFlujo(statusSolicitado);

        const comentarioAutorizadorAnterior = requisicion.comentarioAutorizador;
        const statusAnterior = requisicion.status;

        const errorStatus = validarTransicionStatus(statusAnterior, status, "superadmin");
        if (errorStatus) {
            return res.status(400).json({ msg: errorStatus });
        }
        const cambiaStatus = status !== undefined &&
            normalizarStatusFlujo(status) !== normalizarStatusFlujo(statusAnterior);
        if (cambiaStatus) {
            requisicion.status = status;
            requisicion.fechaCambioStatus = new Date();
        }

        // NUEVO: Actualizar comentario del autorizador
        if (comentarioAutorizador !== undefined) {
            requisicion.comentarioAutorizador = comentarioAutorizador;
        }

        await requisicion.save({ transaction: transaccion });
        if (cambiaStatus) {
            await HistorialStatusService.registrarCambioStatus({
                requisicionId: requisicion.id, statusAnterior, statusNuevo: status,
                usuario, comentario: comentarioAutorizador, transaction: transaccion
            });
        }
        await transaccion.commit();

        //Gnerar notificaciones si hubo cambios relevantes
        if (cambiaStatus) {
            await NotificacionService.crearNotificacionCambioStatus(requisicion.id, statusAnterior, status, "Autorizador");
        }

        if (comentarioAutorizador !== undefined && comentarioAutorizador !== comentarioAutorizadorAnterior && comentarioAutorizador !== null && comentarioAutorizador !== "") {
            await NotificacionService.crearNotificacionComentario(requisicion.id, "comentario_autorizador");
        }

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
    } finally {
        if (transaccion && !transaccion.finished) await transaccion.rollback();
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
                await deleteCloudinaryFile(file);
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
