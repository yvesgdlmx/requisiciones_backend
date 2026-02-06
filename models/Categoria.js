import { DataTypes } from "sequelize";
import db from "../config/db.js";

const Categoria = db.define(
  "categorias",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    cantidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    moneda: {
      type: DataTypes.ENUM("MXN", "USD", "EUR"),
      allowNull: false,
      defaultValue: "MXN"
    },
    diasPeriodo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    fechaInicio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fechaFin: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Se calcula automáticamente basado en el período"
    },
    requiereReinicio: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    timestamps: false
  }
);

export default Categoria;