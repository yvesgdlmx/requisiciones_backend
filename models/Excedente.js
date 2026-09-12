import { DataTypes } from "sequelize"
import db from "../config/db.js"

const Excedente = db.define("excedentes", 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        categoriaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "categorias",
                key: "id"
            }
        },
        excedente: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: "Monto que excedio el presupuesto de la categoria"
        },
        moneda: {
            type: DataTypes.ENUM("MXN", "USD", "EUR"),
            allowNull: false,
            defaultValue: "MXN",
        },
        fecha_inicio: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "Fecha de inicio del periodo del excedente"
        },
        fecha_fin: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "Fecha de fin del periodo del excedente"
        }
    },
    {
        timestamps: true,
        createdAt: "fecha_creacion",
        updateAt: "fecha_actualizacion",
    }
)

export default Excedente