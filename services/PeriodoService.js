class PeriodoService {
  /**
   * Calcula la fecha de fin basada en fecha de inicio y período
   */
  static calcularFechaFin(fechaInicio, periodo) {
    const fecha = new Date(fechaInicio);
    
    switch(periodo) {
      case "semana":
        fecha.setDate(fecha.getDate() + 7);
        break;
      case "quincena":
        fecha.setDate(fecha.getDate() + 15);
        break;
      case "mes":
        fecha.setMonth(fecha.getMonth() + 1);
        break;
      case "varios meses":
        fecha.setMonth(fecha.getMonth() + 3);
        break;
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
    const fechaInicio = new Date(fechaFinActual);
    fechaInicio.setDate(fechaInicio.getDate() + 1); // Empezar al día siguiente
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
    let inicio = new Date(fechaInicio);
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
    let inicio = new Date(fechaInicio);
    let fin = new Date(inicio);
    fin.setDate(fin.getDate() + (diasPeriodo || 30)); // Default 30 días
    
    while (fechaActual > fin) {
      inicio = new Date(fin);
      inicio.setDate(inicio.getDate() + 1);
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + (diasPeriodo || 30));
    }
    
    return { fechaInicio: inicio, fechaFin: fin };
  }
}

export default PeriodoService;