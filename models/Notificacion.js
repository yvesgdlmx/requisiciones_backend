import { DataTypes } from 'sequelize';
import db from '../config/db.js'
import Usuario from './Usuario.js'
import Requisicion from './Requisicion.js'

const Notificacion = db.define('notificaciones', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuarioId : {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model:  Usuario,
            key: "id"
        }
    },
    requisicionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Requisicion,
            key: "id"
        }
    },
    tipo : {
        type: DataTypes.ENUM(
            "cambio_status",
            "comentario_agregado",
            "comentario_autorizador",
            "requisicion_creada",
            "eta_asignada",
            'esperando_autorizacion'
        ),
        allowNull: false
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    leida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    fechaCreacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
    },
},{
    timestamps: false
});

export default Notificacion;
