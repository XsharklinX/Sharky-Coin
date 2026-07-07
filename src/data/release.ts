/** Versión actual de la app, leída de package.json en build time — siempre
 *  coincide con la versión que se sube a la tienda, sin pasos manuales. */
export const APP_VERSION = __APP_VERSION__

export interface ReleaseNote {
  version: string
  date: string
  title: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.6.1',
    date: '2026-06-10',
    title: 'Privacidad y eliminacion de datos en la nube',
    items: [
      '"Eliminar todos los datos" ahora tambien borra tu copia sincronizada en Supabase, no solo los datos locales.',
      'Politica de privacidad y terminos de uso publicados como paginas web publicas.',
      'Correcciones de inicio de sesion con Google.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-04',
    title: 'UX profesional completa',
    items: [
      'Dialogos propios para confirmaciones destructivas.',
      'Filtro guardado con modal de texto propio.',
      'Cero dialogos nativos del navegador en flujos de usuario.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-04',
    title: 'Calidad de datos y recuperacion',
    items: [
      'Snapshot automatico antes de restaurar backups.',
      'Estado de datos visible en Configuracion.',
      'Pruebas de fixtures legacy, backups corruptos y restauracion segura.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-03',
    title: 'Distribucion y operacion',
    items: [
      'Carga inicial optimizada con vistas y exporters bajo demanda.',
      'Changelog visible dentro de Configuracion.',
      'Canal estable/beta preparado como preferencia operativa.',
      'Telemetria local opcional para diagnosticar errores sin enviar datos por defecto.',
      'Proceso de release documentado para build, pruebas, hashes y publicacion.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-03',
    title: 'Reportes y decision financiera',
    items: [
      'Sensibilidad configurable para gastos atipicos.',
      'Suscripciones detectadas convertibles en recurrencias mensuales.',
      'Resumen ejecutivo para Excel y PDF mensual.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-02',
    title: 'CSV bancario dominicano',
    items: [
      'Perfiles para bancos y tarjetas principales.',
      'Vista previa con mapeo manual y conciliacion flexible.',
    ],
  },
]
