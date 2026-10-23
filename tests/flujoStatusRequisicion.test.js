import { test, mock } from "node:test";
import assert from "node:assert/strict";
import * as flujo from "../utils/flujoStatusRequisicion.js";
import * as flujoUI from "../../frontend/src/helpers/flujoStatusRequisicion.js";

const recorridos = [
  ["creada", "cotizando", "proveedor preparando envío", "proceso de entrega", "concluida"],
  ["creada", "cotizando", "proveedor preparando envío", "liberacion aduanal", "proceso de entrega", "entregada parcial", "concluida"],
  ["creada", "esperando autorizacion", "autorizada", "proveedor preparando envío", "proceso de entrega", "concluida"],
  ["creada", "esperando autorizacion", "autorizada", "proceso de pago", "proveedor preparando envío", "proceso de entrega", "entregada parcial"],
  ["creada", "esperando autorizacion", "rechazada"],
  ["creada", "cancelada"],
];
const transicionesEsperadas = new Set(recorridos.flatMap((camino) =>
  camino.slice(1).map((destino, indice) => camino[indice] + ">" + destino)
));
const estados = Object.keys(flujo.TRANSICIONES_STATUS).map(flujo.canonicalizarStatusFlujo);

test("el servidor y la interfaz respetan todos los recorridos y bloquean los demás saltos", () => {
  assert.deepEqual(flujo.TRANSICIONES_STATUS, flujoUI.TRANSICIONES_STATUS);
  for (const modulo of [flujo, flujoUI]) {
    for (const actual of estados) {
      for (const siguiente of estados) {
        for (const rol of ["admin", "superadmin", "solicitante"]) {
          const permitido = actual === siguiente ||
            (transicionesEsperadas.has(actual + ">" + siguiente) &&
              (actual === "esperando autorizacion" ? rol === "superadmin" : rol === "admin"));
          assert.equal(modulo.validarTransicionStatus(actual, siguiente, rol) === null,
            permitido, actual + " > " + siguiente + " (" + rol + ")");
        }
      }
    }
    assert.equal(Object.hasOwn(modulo.TRANSICIONES_STATUS, "aprobada"), false);
    for (const invalido of [null, "", {}, [], "inventado", "aprobada"]) {
      assert.ok(modulo.validarTransicionStatus("creada", invalido, "admin"));
    }
    assert.equal(modulo.validarTransicionStatus("creada", undefined, "admin"), null);
    assert.deepEqual(modulo.obtenerSiguientesStatus("proveedor preparando envio", "admin"),
      ["liberacion aduanal", "proceso de entrega"]);
  }
});

// Dobles de persistencia: no se abre ninguna conexión a la base de datos.
let registro;
let persistido;
let historial;
let transaccion;
let fallarHistorial = false;
let requisicionesReporte = [];
const clonar = (objeto) => structuredClone(objeto);
const modeloRequisicion = {
  async findAll() {
    return requisicionesReporte.map((requisicion) => ({ toJSON: () => clonar(requisicion) }));
  },
  async findByPk(id, opciones = {}) {
    if (!persistido) return null;
    if (opciones.lock) assert.equal(opciones.transaction, transaccion);
    registro = { ...clonar(persistido), async save(opcionesSave) {
      assert.equal(opcionesSave.transaction, transaccion);
      transaccion.pendiente = Object.fromEntries(
        Object.entries(this).filter(([, valor]) => typeof valor !== "function"));
    } };
    return registro;
  },
};
mock.module(new URL("../models/Index.js", import.meta.url).href, {
  namedExports: {
    Requisicion: modeloRequisicion, Usuario: {}, Articulo: {}, Categoria: {},
    Excedente: {}, HistorialGasto: {}, HistorialStatusRequisicion: {
      async create(datos, opciones) {
        assert.equal(opciones.transaction, transaccion);
        if (fallarHistorial) throw new Error("Fallo simulado de historial");
        transaccion.historialPendiente.push(datos);
      },
    },
  },
});
mock.module(new URL("../config/db.js", import.meta.url).href, {
  defaultExport: { async transaction() {
    transaccion = {
      LOCK: { UPDATE: "UPDATE" }, historialPendiente: [],
      async commit() {
        persistido = clonar(this.pendiente);
        historial.push(...this.historialPendiente);
        this.finished = "commit";
      },
      async rollback() { this.finished = "rollback"; },
    };
    return transaccion;
  } },
});
mock.module(new URL("../services/NotificacionService.js", import.meta.url).href, {
  defaultExport: {
    async crearNotificacionCambioStatus() {}, async crearNotificacionComentario() {},
    async crearNotificacionEta() {},
  },
});
mock.module(new URL("../services/HistorialGastoService.js", import.meta.url).href, {
  defaultExport: { async crearOActualizarHistorial() {} },
});
mock.module(new URL("../config/cloudinary.js", import.meta.url).href, { defaultExport: {} });
const controladores = await import("../controllers/requisicionController.js");

test("el reporte mide cotizacion y conserva pendientes cuando falta su fecha historica", async () => {
  requisicionesReporte = [{
    id: 1, folio: "C26-00001", status: "concluida", fechaHora: "2026-10-01T00:00:00Z",
    historialStatus: [
      { statusNuevo: "cotizando", fechaCambio: "2026-10-02T00:00:00Z" },
      { statusNuevo: "proveedor preparando envío", fechaCambio: "2026-10-03T00:00:00Z" },
      { statusNuevo: "concluida", fechaCambio: "2026-10-04T00:00:00Z" },
    ],
  }, {
    id: 2, folio: "C26-00002", status: "cotizando", fechaHora: "2026-10-01T00:00:00Z",
    historialStatus: [{ statusNuevo: "aprobada", fechaCambio: "2026-10-02T00:00:00Z" }],
  }];
  const respuesta = {
    status(codigo) { assert.fail(`Error de reporte: ${codigo}`); },
    json(datos) { this.datos = datos; },
  };
  await controladores.obtenerReporteTiemposRequisiciones({}, respuesta);
  assert.deepEqual(respuesta.datos.metricas.map((metrica) => metrica.clave), [
    "creadaCotizando", "creadaRechazada", "esperandoAutorizacionAutorizada",
    "cotizandoProveedorPreparandoEnvio", "creadaConcluida",
  ]);
  const [completa, migrada] = respuesta.datos.requisiciones;
  assert.equal(completa.tiempos.creadaCotizando.milisegundos, 86400000);
  assert.equal(completa.tiempos.cotizandoProveedorPreparandoEnvio.milisegundos, 86400000);
  assert.equal(migrada.tiempos.creadaCotizando.completado, false);
  assert.equal(migrada.tiempos.creadaCotizando.fin, null);
});

const reiniciar = (status) => {
  persistido = {
    id: 1, solicitante: 1, status, archivos: [], cotizacionesArchivos: [],
    fechaCambioStatus: new Date("2026-10-01T12:00:00Z"),
  };
  historial = [];
  fallarHistorial = false;
};
const llamar = async (endpoint, rol, body) => {
  const respuesta = {
    codigo: 200, status(codigo) { this.codigo = codigo; return this; },
    json(datos) { this.datos = datos; return this; },
  };
  await controladores[endpoint]({
    usuario: { id: 1, rol, nombre: "Comprador", apellido: "Prueba" },
    params: { id: 1 }, body,
  }, respuesta);
  return respuesta;
};

test("los endpoints rechazan saltos, retrocesos y decisiones de autorización de un admin", async () => {
  for (const [actual, siguiente, endpoint, rol] of [
    ["creada", "concluida", "actualizarRequisicionAdmin", "admin"],
    ["cotizando", "aprobada", "actualizarRequisicionAdmin", "admin"],
    ["esperando autorizacion", "autorizada", "actualizarRequisicionAdmin", "admin"],
    ["esperando autorizacion", "rechazada", "actualizarRequisicionAdmin", "admin"],
    ["creada", "autorizada", "actualizarRequisicionSuperAdmin", "superadmin"],
    ["concluida", "proceso de entrega", "actualizarRequisicionAdmin", "admin"],
    ["rechazada", "esperando autorizacion", "actualizarRequisicionSuperAdmin", "superadmin"],
    ["entregada parcial", "proceso de entrega", "actualizarRequisicionAdmin", "admin"],
    ["creada", "aprobada", "actualizarRequisicionAdmin", "admin"],
    ["creada", "aprobada", "actualizarRequisicion", "admin"],
  ]) {
    reiniciar(actual);
    const respuesta = await llamar(endpoint, rol, { status: siguiente });
    assert.equal(respuesta.codigo, 400);
    assert.equal(persistido.status, actual);
    assert.equal(historial.length, 0);
    assert.equal(transaccion.finished, "rollback");
  }
});

test("los endpoints guardan todos los recorridos y un historial por cada avance", async () => {
  for (const camino of recorridos) {
    reiniciar(camino[0]);
    for (let indice = 1; indice < camino.length; indice++) {
      const rol = camino[indice - 1] === "esperando autorizacion" ? "superadmin" : "admin";
      const endpoint = rol === "admin" ? "actualizarRequisicionAdmin" : "actualizarRequisicionSuperAdmin";
      const respuesta = await llamar(endpoint, rol, { status: camino[indice] });
      assert.equal(respuesta.codigo, 200);
      assert.equal(persistido.status, camino[indice]);
      assert.equal(historial.length, indice);
      assert.equal(historial[indice - 1].statusAnterior, camino[indice - 1]);
      assert.equal(historial[indice - 1].statusNuevo, camino[indice]);
      assert.equal(transaccion.finished, "commit");
    }
  }
});

test("editar datos sin avanzar conserva la fecha del status y no duplica el historial", async () => {
  for (const rol of ["admin", "superadmin"]) {
    for (const conStatus of [true, false]) {
      reiniciar("concluida");
      const fechaAnterior = persistido.fechaCambioStatus.getTime();
      const body = { comentario: "Dato actualizado", ...(conStatus ? { status: "concluida" } : {}) };
      const respuesta = await llamar("actualizarRequisicionAdmin", rol, body);
      assert.equal(respuesta.codigo, 200);
      assert.equal(persistido.comentario, body.comentario);
      assert.equal(persistido.fechaCambioStatus.getTime(), fechaAnterior);
      assert.equal(historial.length, 0);
    }
  }
});

test("si falla el historial se revierte el avance de status", async () => {
  for (const [actual, siguiente, rol, endpoint] of [
    ["creada", "cotizando", "admin", "actualizarRequisicionAdmin"],
    ["esperando autorizacion", "autorizada", "superadmin", "actualizarRequisicionSuperAdmin"],
  ]) {
    reiniciar(actual);
    fallarHistorial = true;
    const silencio = mock.method(console, "error", () => {});
    try {
      const respuesta = await llamar(endpoint, rol, { status: siguiente });
      assert.equal(respuesta.codigo, 500);
      assert.equal(persistido.status, actual);
      assert.equal(historial.length, 0);
      assert.equal(transaccion.finished, "rollback");
    } finally { silencio.mock.restore(); }
  }
});
