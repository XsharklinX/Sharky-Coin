# $harky - Roadmap de producto

Fecha de revision: 2026-06-01

## Estado actual

$harky ya cubre el flujo principal de finanzas personales:

- Dashboard mensual con patrimonio, ingresos, gastos, ahorro y alertas.
- CRUD de movimientos, cuentas, categorias, presupuestos y metas.
- Importacion CSV para bancos dominicanos con reglas aprendidas.
- Exportacion JSON, PDF, Excel y graficas PNG.
- Estadisticas anuales, comparativa interanual y resumen financiero anual.
- Temas visuales, PWA y escritorio Tauri.
- Instalador NSIS `.exe` y ejecutable portable para Windows.
- Error boundaries globales y por vista.

La siguiente etapa no debe priorizar volumen de features. Primero hay que cerrar riesgos de integridad, seguridad y calidad de release.

## Prioridades inmediatas

| Prioridad | Estado | Tipo | Trabajo | Resultado |
| --- | --- | --- | --- | --- |
| P0 | Cerrado | Arreglar | Sustituir `xlsx` | Exportación migrada a `exceljs`; `npm audit` queda en cero vulnerabilidades. |
| P0 | Cerrado | Arreglar | Proteger eliminación de categorías | El store bloquea categorías usadas y la UI muestra el motivo. |
| P0 | Cerrado | Arreglar | Usar fecha real del sistema | Mes activo y datos demo parten de `new Date()`. |
| P0 | Cerrado | Arreglar | Normalizar encoding UTF-8 | Textos heredados y selector CSS del checkbox recurrente corregidos. |
| P1 | Cerrado | Seguridad | Activar CSP en Tauri | CSP explícita para scripts, estilos, fuentes, imágenes, IPC y workers. |
| P1 | Cerrado | Calidad | Agregar pruebas E2E | Playwright recorre las siete vistas, estadísticas, presupuestos y cuatro temas. |
| P1 | Cerrado | Producto | Definir política de sobregiro | Configuración global: bloquear, advertir o permitir. Granularidad por cuenta queda en v0.4. |

## v0.3 - Release estable local

Objetivo: publicar una version local confiable antes de agregar sincronizacion.

Estado: completada el 2026-06-01 como `v0.3.0`.

### Cerrado en esta iteración

- Exportación Excel migrada de `xlsx` a `exceljs`.
- `TODAY` fijo sustituido por `new Date()` con mes actual inyectable en helpers.
- Eliminación de categorías usadas bloqueada con feedback visible.
- Backups validados por esquema, tipos, IDs únicos y referencias existentes.
- Textos con mojibake y selector `input[type="checkbox"]` corregidos.
- CSP explícita aplicada al contenedor Tauri.
- Smoke E2E agregado para navegación, estadísticas, presupuestos y temas.

### Mejoras cerradas

- Confirmaciones consistentes para cuentas, categorías, metas, restauración y borrado masivo.
- Estados vacíos profesionales reutilizables en vistas críticas.
- Feedback de carga al importar CSV, gestionar backups y exportar Excel, PDF o PNG.
- Diagnóstico visible con reintento aislado cuando una vista falla.
- Importación CSV atómica: un error no deja movimientos aplicados parcialmente.

### Criterios de salida

- `npm audit` sin vulnerabilidades altas o criticas.
- `npm run lint`, `npm test`, `npm run build` y `npm run package:windows` pasan.
- Navegacion E2E por las 7 vistas en los 4 temas.
- Restaurar un backup corrupto nunca modifica el store.

## v0.4 - Control financiero completo

Objetivo: convertir el registro manual en una herramienta diaria solida.

Estado: en desarrollo desde el 2026-06-01 como `v0.4.0`.

### Cerrado en esta iteracion

- Accion global de agregar movimiento simplificada: se elimina el duplicado de la cabecera.
- Creacion de metas renovada con modal dedicado, fecha objetivo opcional y color identificativo.

### Agregar

- Politica de sobregiro configurable por cuenta: bloquear, advertir o permitir.
- Gastos recurrentes editables con frecuencia, fecha de inicio, fecha final y proxima ejecucion.
- Vista de calendario financiero con pagos esperados.
- Reglas de categorizacion editables para importacion bancaria.
- Historial de aportes a metas con `goalId`, fecha, cuenta origen y notas.
- Filtros guardados para transacciones.

### Mejorar

- Presupuestos semanales y anuales ademas del limite mensual.
- Alertas configurables al 50%, 80%, 100% y sobregiro.
- Transferencias con historial mas claro y filtros especificos.
- Edicion masiva de movimientos importados.

### Criterios de salida

- Las recurrencias no generan duplicados.
- Cada aporte a una meta aparece en su historial y afecta la cuenta origen.
- Las reglas CSV pueden revisarse, editarse y eliminarse desde la UI.

## v0.5 - Seguridad y sincronizacion

Objetivo: permitir uso real en mas de un dispositivo sin depender de `localStorage`.

### Agregar

- Backend con usuarios, sesiones, recuperacion de contraseña y cierre remoto.
- Base de datos cifrada en reposo.
- Sincronizacion incremental con timestamps y resolucion de conflictos.
- Backup automatico cifrado y restauracion por version.
- Exportacion manual portable como mecanismo de recuperacion.

### Mejorar

- Mover secretos y tokens fuera del frontend.
- Mantener modo local opcional para quien no quiera crear cuenta cloud.
- Registrar auditoria basica: inicio de sesion, importaciones y restauraciones.

### Criterios de salida

- Dos dispositivos pueden editar sin perder movimientos.
- La cuenta puede recuperarse sin acceso al equipo anterior.
- El modo local sigue funcionando sin internet.

## v0.6 - Inteligencia financiera

Objetivo: convertir datos en decisiones practicas.

### Agregar

- Deteccion de suscripciones y gastos recurrentes sugeridos.
- Proyeccion de flujo de caja a 30, 60 y 90 dias.
- Deteccion de gastos atipicos.
- Tendencias por comercio, categoria y etiqueta.
- Objetivos de ahorro recomendados segun ingresos y gastos.
- Resumen mensual con acciones concretas.

### Mejorar

- Resumen anual compartible con comparaciones útiles.
- Tooltips enriquecidos en graficas.
- Exportacion de reportes con identidad visual completa.

## v0.7 - Integraciones bancarias dominicanas

Objetivo: reducir captura manual sin depender inicialmente de APIs bancarias.

### Agregar

- Perfiles CSV versionados para Popular, BHD, Banreservas y Scotiabank.
- Asistente para mapear columnas desconocidas.
- Plantillas para estados de tarjeta de credito.
- Conciliacion por fecha, monto, moneda y descripcion normalizada.
- Bandeja de movimientos pendientes antes de afectar saldos.

### Investigar

- Disponibilidad legal y tecnica de conexiones Open Banking o agregadores.
- Manejo seguro de credenciales y consentimiento.

## v1.0 - Lanzamiento publico

Objetivo: distribuir una aplicacion estable y presentable.

### Producto

- Onboarding breve con demo opcional.
- Ayuda contextual y tour inicial.
- Accesibilidad AA: teclado, foco, contraste y lector de pantalla.
- Responsive final para desktop, tablet y movil.

### Distribucion

- Instalador Windows NSIS `.exe`.
- Ejecutable portable `.exe`.
- Firma de codigo para reducir advertencias de Windows SmartScreen.
- Actualizaciones automaticas firmadas en Tauri.
- Canal estable y canal beta.

### Calidad

- Suite E2E para flujos criticos.
- Pruebas de migracion de datos entre versiones.
- Telemetria opcional, anonimizada y desactivable.
- Checklist de release y changelog.

## Backlog posterior a v1.0

- Versiones macOS y Linux.
- App movil con Capacitor o cliente dedicado.
- Cuentas compartidas para hogares.
- Multi-moneda con tasas actualizables.
- Importacion OFX/QFX.
- Etiquetas inteligentes y busqueda avanzada.
- Widgets de escritorio.
- Presupuestos por sobres.

## Orden recomendado

1. Cerrar todos los P0 de integridad y seguridad.
2. Agregar pruebas E2E antes de seguir ampliando UI.
3. Completar recurrencias, sobregiro y metas con historial.
4. Diseñar backend y sincronizacion con modo local compatible.
5. Preparar firma, updater y proceso formal de release.
