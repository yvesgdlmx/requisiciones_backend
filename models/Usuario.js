import { DataTypes } from "sequelize";
import db from "../config/db.js";
const Usuario = db.define("usuarios", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  apellido: {
    type: DataTypes.STRING,
    allowNull: false
  },
  area: {
    type: DataTypes.STRING,
    allowNull: false
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  token: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  confirmado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  imagenPerfil: {  
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  }
}, {
  timestamps: false
});

// Métodos Personalizados
Usuario.prototype.verificarPassword = function(password){
    return password === this.password;
}

export default Usuario;