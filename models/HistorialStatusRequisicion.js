import { DataTypes } from "sequelize";
import db from "../config/db.js"

const HistorialStatusRequisicion = db.define(
    "historialStatusRequisiciones",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        requisicionId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        statusAnterior: {
            type: DataTypes.STRING,
            allowNull: true,
            defautlValue: null
        },
        statusNuevo: {
            type: DataTypes.STRING,
            allowNull: false
        },
        usuarioId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defautlValue: null
        },
        usuarioNombre: {
            type: DataTypes.STRING,
            allowNull: false,
            defautlValue: null
        },
        usuarioRol: {
            type: DataTypes.STRING,
            allowNull: true,
            defautlValue: null
        },
        comentario: {
            type: DataTypes.TEXT,
            allowNull: true,
            defautlValue: null
        },
        fechaCambio: {
            type: DataTypes.DATE,
            allowNull: false,
            defautlValue: DataTypes.NOW
        }
    },
    {
        timestamps: true
    }
)

export default HistorialStatusRequisicion;