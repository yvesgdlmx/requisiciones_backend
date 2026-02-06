import { HistorialGasto, Requisicion, Usuario, Categoria } from '../models/Index.js';

export const obtenerHistorialGastos = async (req, res) => {
  try {
    const historial = await HistorialGasto.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Requisicion,
          as: "requisicion",
          attributes: ["id", "folio", "status"],
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["nombre", "apellido", "email"]
            }
          ]
        },
        {
          model: Categoria,
          as: "categoria",
          attributes: ["nombre", "cantidad", "diasPeriodo"]
        }
      ]
    });

    return res.json({
      msg: "Historial de gastos obtenido",
      historial
    });
  } catch (error) {
    console.error("Error al obtener historial de gastos:", error);
    return res.status(500).json({ msg: "Error al obtener historial de gastos" });
  }
};

export const obtenerHistorialPorRequisicion = async (req, res) => {
  try {
    const { requisicionId } = req.params;

    const historial = await HistorialGasto.findOne({
      where: { requisicionId },
      include: [
        {
          model: Requisicion,
          as: "requisicion",
          attributes: ["id", "folio", "status"]
        },
        {
          model: Categoria,
          as: "categoria",
          attributes: ["nombre", "cantidad", "diasPeriodo"]
        }
      ]
    });

    if (!historial) {
      return res.status(404).json({ msg: "No se encontró historial para esta requisición" });
    }

    return res.json({
      msg: "Historial encontrado",
      historial
    });
  } catch (error) {
    console.error("Error al obtener historial por requisición:", error);
    return res.status(500).json({ msg: "Error al obtener historial" });
  }
};