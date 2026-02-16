class PeriodoService {
  static _toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    return new Date(value);
  }

  static _addDaysUTC(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  static _addMonthsUTC(date, months) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
  }

  /**
   * Calcula la fecha de fin basada en fecha de inicio y período
   */
  static calcularFechaFin(fechaInicio, periodo) {
    const fecha = this._toDate(fechaInicio);
    
    switch(periodo) {
      case "semana":
        return this._addDaysUTC(fecha, 7);
      case "quincena":
        return this._addDaysUTC(fecha, 15);
      case "mes":
        return this._addMonthsUTC(fecha, 1);
      case "varios meses":
        return this._addMonthsUTC(fecha, 3);
    }
    
    return fecha;
  }

  /**
   * Verifica si una categoría necesita reinicio (si ya pasó la fecha fin)
   */
  static necesitaReinicio(fechaFin) {
    if (!fechaFin) return false;
    const ahora = new Date();
    const fin = new Date(fechaFin);
    return ahora > fin;
  }

  /**
   * Calcula el siguiente período después del actual
   */
  static calcularSiguientePeriodo(fechaFinActual, periodo) {
    const fechaInicio = this._addDaysUTC(fechaFinActual, 1); // Empezar al día siguiente
    const fechaFin = this.calcularFechaFin(fechaInicio, periodo);
    
    return { fechaInicio, fechaFin };
  }

  /**
   * Verifica si una fecha está dentro de un período
   */
  static estaEntrePeriodo(fecha, fechaInicio, fechaFin) {
    return fecha >= fechaInicio && fecha <= fechaFin;
  }

  /**
   * Obtiene el período actual basado en fechaInicio y período
   * Si ha pasado el período, calcula el siguiente automáticamente
   */
  static obtenerPeriodoActual(fechaInicio, periodo, fechaActual = new Date()) {
    let inicio = this._toDate(fechaInicio);
    let fin = this.calcularFechaFin(inicio, periodo);
    
    // Si la fecha actual está fuera del período, calcular el siguiente
    while (fechaActual > fin) {
      const siguiente = this.calcularSiguientePeriodo(fin, periodo);
      inicio = siguiente.fechaInicio;
      fin = siguiente.fechaFin;
    }
    
    return {
      fechaInicio: inicio,
      fechaFin: fin,
      esPeriodoActual: this.estaEntrePeriodo(fechaActual, inicio, fin)
    };
  }

  /**
   * Obtiene el período actual por días (para compatibilidad con obtenerPresupuestoDisponible)
   */
  static obtenerPeriodoActualPorDias(fechaInicio, diasPeriodo, fechaActual = new Date()) {
    let inicio = this._toDate(fechaInicio);
    let fin = this._addDaysUTC(inicio, diasPeriodo || 30); // Default 30 días
    
    while (fechaActual > fin) {
      inicio = this._addDaysUTC(fin, 1);
      fin = this._addDaysUTC(inicio, diasPeriodo || 30);
    }
    
    return { fechaInicio: inicio, fechaFin: fin };
  }
}

export default PeriodoService;