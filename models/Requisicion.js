import { DataTypes } from "sequelize";
import db from "../config/db.js";
import Usuario from "./Usuario.js";
const Requisicion = db.define(
  "requisiciones",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    folio: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    solicitante: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Usuario,
        key: "id"
      }
    },
    area: {
      type: DataTypes.STRING,
      allowNull: false
    },
    objetivo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fechaHora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    prioridad: {
      type: DataTypes.ENUM("muy alto", "alto", "moderado"),
      allowNull: false,
      defaultValue: "moderado"
    },
    archivos: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    links: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    comprador: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    status: {
      type: DataTypes.ENUM(
        "creada",
        "cotizando",
        "aprobada",
        "esperando autorizacion",
        "autorizada",
        "rechazada",
        "liberacion aduanal",
        "proceso de entrega",
        "entregada parcial",
        "concluida",
        "cancelada"
      ),
      allowNull: false,
      defaultValue: "creada"
    },
    // Nuevo campo para el comentario; es opcional.
    comentario: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    numeroOrdenCompra: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    proveedor: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    tipoCompra: {
      type: DataTypes.ENUM("nacional", "internacional"),
      allowNull: true,
      defaultValue: null
    },
    monto: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    comentarioAutorizador: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    eta: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    abierto: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    timestamps: false
  }
);
export default Requisicion;