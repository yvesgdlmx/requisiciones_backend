import { DataTypes } from "sequelize";
import db from '../config/db.js'
const Articulo = db.define("articulos", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  cantidad: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  unidadMedida: {
    type: DataTypes.ENUM("Pieza", "Galon", "Cubeta", "Metros", "Caja", "Paquete", "Frasco", "KG"),
    allowNull: false
  },
  numeroParte: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  requisicionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "requisiciones",
      key: "id"
    }
  }
}, {
  timestamps: true
});
export default Articulo;