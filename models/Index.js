import Usuario from "./Usuario.js";
import Requisicion from "./Requisicion.js";
import Articulo from "./Articulo.js";
import Notificacion from "./Notificacion.js";
import Categoria from "./Categoria.js";
import HistorialGasto from "./HistorialGasto.js";
import Excedente from "./Excedente.js";
import HistorialStatusRequisicion from "./HistorialStatusRequisicion.js";

// Asociación entre Requisicion y Usuario
Requisicion.belongsTo(Usuario, { foreignKey: "solicitante", as: "usuario" });
Usuario.hasMany(Requisicion, { foreignKey: "solicitante", as: "requisiciones" });
// Asociación uno a muchos: Una Requisicion tiene muchos Articulos
Requisicion.hasMany(Articulo, { foreignKey: "requisicionId", as: "articulos" });
Articulo.belongsTo(Requisicion, { foreignKey: "requisicionId", as: "requisicion" });

// Relaciones de notificación: una usuario tiene muchas notificaciones y una requisición tiene muchas notificaciones
Usuario.hasMany(Notificacion, { foreignKey: "usuarioId", as: "notificaciones" });
Notificacion.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

Requisicion.hasMany(Notificacion, { foreignKey: "requisicionId", as: "notificaciones" });
Notificacion.belongsTo(Requisicion, { foreignKey: "requisicionId", as: "requisicion" });

// Relación: una Categoría puede estar en muchas Requisiciones
Categoria.hasMany(Requisicion, { foreignKey: "categoriaId", as: "requisiciones" });
Requisicion.belongsTo(Categoria, { foreignKey: "categoriaId", as: "categoria" });

// Relación: un HistorialGasto está asociado a una Requisición (1:1)
Requisicion.hasOne(HistorialGasto, { foreignKey: "requisicionId", as: "historialGasto" });
HistorialGasto.belongsTo(Requisicion, { foreignKey: "requisicionId", as: "requisicion" });

// Relación: un HistorialGasto está asociado a una Categoría
HistorialGasto.belongsTo(Categoria, { foreignKey: "categoriaId", as: "categoria" });
Categoria.hasMany(HistorialGasto, { foreignKey: "categoriaId", as: "historialGastos" });

// Relacion: Excedente esta asociado a una categoria
Categoria.hasMany(Excedente, { foreignKey: "categoriaId", as: "excedentes" });
Excedente.belongsTo(Categoria, { foreignKey: "categoriaId", as: "categoria" });

// Relacion: Requisicion esta asociado a una requisicion
Requisicion.hasMany(HistorialStatusRequisicion, { foreignKey: "requisicionId", as: "historialStatus" })
HistorialStatusRequisicion.belongsTo(Requisicion, { foreignKey: "requisicionId", as: "requisicion" })

//Rekacion: Usuario esta asociado a un historial
Usuario.hasMany(HistorialStatusRequisicion, { foreignKey: "usuarioId", as: "historialStatus" })
HistorialStatusRequisicion.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" })

export { Usuario, Requisicion, Articulo, Notificacion, Categoria, HistorialGasto, Excedente, HistorialStatusRequisicion };
