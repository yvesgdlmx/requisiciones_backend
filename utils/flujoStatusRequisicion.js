// Mantener estas transiciones sincronizadas con el flujo del otro proyecto.
export const TRANSICIONES_STATUS = {
  creada: ["cancelada", "esperando autorizacion", "cotizando"],
  cotizando: ["proveedor preparando envío"],
  "esperando autorizacion": ["autorizada", "rechazada"],
  autorizada: ["proceso de pago", "proveedor preparando envío"],
  "proceso de pago": ["proveedor preparando envío"],
  "proveedor preparando envio": ["liberacion aduanal", "proceso de entrega"],
  "liberacion aduanal": ["proceso de entrega"],
  "proceso de entrega": ["concluida", "entregada parcial"],
  cancelada: [],
  rechazada: [],
  concluida: [],
  "entregada parcial": ["concluida"],
};

export const normalizarStatusFlujo = (status) =>
  typeof status === "string"
    ? status.replaceAll("ÃƒÂ­", "í").replaceAll("Ã­", "í")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    : "";

export const obtenerSiguientesStatus = (status, rol) => {
  const actual = normalizarStatusFlujo(status);
  if (rol === "superadmin") {
    return actual === "esperando autorizacion" ? [...TRANSICIONES_STATUS[actual]] : [];
  }
  if (rol !== "admin" || actual === "esperando autorizacion") return [];
  return [...(TRANSICIONES_STATUS[actual] || [])];
};

export const canonicalizarStatusFlujo = (status) => {
  const normalizado = normalizarStatusFlujo(status);
  if (!Object.hasOwn(TRANSICIONES_STATUS, normalizado)) return status;
  return normalizado === "proveedor preparando envio" ? "proveedor preparando envío" : normalizado;
};

export const validarTransicionStatus = (actual, siguiente, rol) => {
  if (siguiente === undefined) return null;
  const origen = normalizarStatusFlujo(actual);
  const destino = normalizarStatusFlujo(siguiente);
  if (!destino || !Object.hasOwn(TRANSICIONES_STATUS, destino)) {
    return "El status seleccionado no es válido.";
  }
  // Permite guardar otros datos sin avanzar el proceso.
  if (origen === destino) return null;
  const permitidos = obtenerSiguientesStatus(actual, rol);
  if (permitidos.some((status) => normalizarStatusFlujo(status) === destino)) return null;
  return permitidos.length
    ? `No se puede pasar de "${actual}" a "${siguiente}". Siguientes status permitidos: ${permitidos.join(", ")}.`
    : `No puedes cambiar el status "${actual}". No hay transiciones permitidas para tu rol.`;
};
