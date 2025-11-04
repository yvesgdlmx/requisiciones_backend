import Usuario from "./Usuario.js"; // Asumiendo que ya cuentas con este modelo
import Requisicion from "./Requisicion.js";
import Articulo from "./Articulo.js";
import Notificacion from "./Notificacion.js";

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

export { Usuario, Requisicion, Articulo, Notificacion };