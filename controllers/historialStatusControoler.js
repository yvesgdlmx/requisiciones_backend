import {
    HistorialStatusRequisicion,
    Requisicion,
    Usuario
} from "../models/Index.js";

export const obtenerHistorialStatus = async (req, res) => {
    try {
        const historial = await HistorialStatusRequisicion.findAll({
            order: [["fechaCambio", "DESC"]],
            include: [
                {
                    model: Requisicion,
                    as: "requisicion",
                    attributes: ["id", "folio", "status", "objetivo", "area"],
                    include: [
                        {
                            model: Usuario,
                            as: "usuario",
                            attributes: ["id", "nombre", "apellido", "email"]
                        }
                    ]
                },
                {
                    model: Usuario,
                    as: "usuario",
                    attributes: ["id", "nombre", "apellido", "email", "rol"]
                }
            ]
        });

        return res.json({
            msg: "Historial de status obtenido",
            historial
        });
    } catch (error) {
        console.error("Error al obtener historial de status", error);
        return res.status(500).json({
            msg: "Error al obtener el historial de status"
        });
    }
};

export const obtenerHistorialStatusPorRequisicion = async (req, res) => {
    try {
        const { requisicionId } = req.params;

        const historial = await HistorialStatusRequisicion.findAll({
            where: { requisicionId },
            order: [["fechaCambio", "ASC"]],
            include: [
                {
                    model: Usuario,
                    as: "usuario",
                    attributes: ["id", "nombre", "apellido", "email", "rol"]
                }
            ]
        });

        return res.json({
            msg: "Historial de status por requisicion obtenido",
            historial
        });
    } catch (error) {
        console.error("Error al obtener el historial por requisicion", error);
        return res.status(500).json({
            msg: "Error al obtener historial por requisicion"
        });
    }
};
