import { DataTypes } from "sequelize";
import db from "../config/db.js";

const HistorialGasto = db.define(
  "historialGastos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    requisicionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    categoriaId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    categoriaNombre: {
      type: DataTypes.STRING,
      allowNull: true
    },
    presupuestoTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    diasPeriodo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 30
    },
    fechaInicioPeriodo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fechaFinPeriodo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    montoGastado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    saldoDisponible: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    fechaGasto: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    usuarioComprador: {
      type: DataTypes.STRING,
      allowNull: true
    },
    moneda: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: "MXN",
    },
    statusRequisicion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: true
  }
);

export default HistorialGasto;