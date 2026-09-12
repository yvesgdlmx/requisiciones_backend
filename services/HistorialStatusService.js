import { HistorialStatusRequisicion } from "../models/Index.js"

class HistorialStatusService {
    static async registrarCambioStatus({
        requisicionId,
        statusAnterior,
        statusNuevo,
        usuario,
        comentario = null
    }) {
        if (!requisicionId || !statusNuevo) return null;

        if (statusAnterior === statusNuevo) return null;

        return await HistorialStatusRequisicion.create({
            requisicionId,
            statusAnterior: statusAnterior || null,
            statusNuevo,
            usuarioId: usuario?.id || null,
            usuarioNombre: usuario
                ? `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim()
                : null,
            usuarioRol: usuario?.rol || null,
            comentario,
            fechaCambio: new Date()
        });
    }
}

export default HistorialStatusService
