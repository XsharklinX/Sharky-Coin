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

Estado: completada el 2026-06-02 como `v0.4.0`.

### Cerrado en esta iteracion

- Accion global de agregar movimiento simplificada: se elimina el duplicado de la cabecera.
- Creacion de metas renovada con modal dedicado, fecha objetivo opcional y color identificativo.
- Politica de sobregiro configurable por cuenta con fallback al ajuste global.
- Recurrencias semanales o mensuales con inicio, fin opcional y proxima ejecucion editable.
- Vista de calendario financiero para revisar proximos movimientos esperados.
- Reglas de categorizacion bancaria administrables desde Configuracion.
- Historial de aportes a metas con fecha, cuenta origen y nota opcional.
- Filtros de transacciones guardables, reutilizables y eliminables.
- Presupuestos semanales, mensuales y anuales editables.
- Alertas de presupuesto configurables al 50%, 80% y 100%.
- Transferencias filtrables y edicion masiva para recategorizar, exportar o eliminar movimientos.

### Criterios de salida

- Las recurrencias no generan duplicados.
- Cada aporte a una meta aparece en su historial y afecta la cuenta origen.
- Las reglas CSV pueden revisarse, editarse y eliminarse desde la UI.

## v0.5 - Seguridad y sincronizacion

Objetivo: permitir uso real en mas de un dispositivo sin depender de `localStorage`.

Estado: completada el 2026-06-02 como `v0.5.0`.

### Cerrado en esta iteracion

- Ledger de categorias de presupuesto consolidado en un solo sistema responsive.
- Filas convertidas en tarjetas compactas cuando el ancho disponible no permite la tabla completa.
- Prueba E2E responsive para evitar regresiones de desborde, iconos y edicion de limites.
- Snapshots automaticos locales con retencion de cinco versiones y restauracion desde Configuracion.
- Punto de recuperacion manual y auditoria local de cuenta, backups, restauraciones e importaciones CSV.
- Infraestructura cloud elegida: Supabase Cloud `us-east-1`, Postgres con RLS y Auth por correo con PKCE.
- ADR tecnico agregado en `docs/ADR-001-supabase-auth-sync.md`.
- Proyecto Supabase aprovisionado con esquema relacional, indices, triggers de revision y RLS por usuario.
- Registro e inicio de sesion cloud integrados con confirmacion de correo, recuperacion de contraseña y cierre remoto.
- Modo local offline conservado como alternativa explicita para quien no quiera crear una cuenta cloud.
- Sincronizacion cloud manual bidireccional con baseline local, tombstones y conflictos visibles sin sobrescritura silenciosa.
- Cache local aislado por cuenta cloud para evitar mezclar datos al cambiar de usuario en un mismo equipo.
- Cola local de cambios con sincronizacion automatica agrupada y reintento al recuperar conexion.
- Base de datos cloud cifrada en reposo por Supabase.
- Backups cloud cifrados en cliente con frase secreta independiente, bucket privado, restauracion por version y retencion de diez copias.
- Exportacion JSON portable conservada como mecanismo independiente de recuperacion manual.
- Sesion Supabase de Tauri movida fuera de `localStorage` al Administrador de credenciales de Windows mediante comandos Rust.
- Limpieza automatica de tokens Supabase heredados en `localStorage` al iniciar la app de escritorio.
- Sincronizacion ampliada para politicas de sobregiro, presupuestos semanales y anuales, agenda recurrente e historial de aportes.

### Agregar


### Mejorar

- Validar manualmente el flujo cloud completo en el `.exe` firmado antes del release publico.

### Criterios de salida

- Dos dispositivos pueden editar sin perder movimientos.
- La cuenta puede recuperarse sin acceso al equipo anterior.
- El modo local sigue funcionando sin internet.

## v0.6 - Inteligencia financiera

Objetivo: convertir datos en decisiones practicas.

Estado: completada como parte de `v0.7.0`.

### Cerrado en esta iteracion

- Deteccion de suscripciones y gastos recurrentes sugeridos por comercio, categoria y cuenta.
- Proyeccion de flujo de caja a 30, 60 y 90 dias.
- Deteccion de gastos atipicos frente al patron historico.
- Tendencias por comercio, categoria y etiqueta.
- Objetivo mensual de ahorro recomendado segun ingresos y gastos recientes.
- Resumen mensual con acciones concretas en el Dashboard.

### Agregar

- Panel de detalle para aceptar una suscripcion detectada como recurrencia editable.
- Ajuste de sensibilidad para gastos atipicos.

### Mejorar

- Resumen anual compartible con comparaciones útiles.
- Tooltips enriquecidos en graficas.
- Exportacion de reportes con identidad visual completa.

## v0.7 - Integraciones bancarias dominicanas

Objetivo: reducir captura manual sin depender inicialmente de APIs bancarias.

Estado: primer corte completado como `v0.7.0`.

### Cerrado en esta iteracion

- Perfiles CSV versionados para Popular, BHD, Banreservas y Scotiabank.
- Deteccion de columnas con porcentaje de confianza y perfil detectado.
- Mapeo manual de columnas cuando el formato del banco no coincide.
- Bandeja de importacion con omision manual de filas antes de afectar saldos.
- Recategorizacion por movimiento durante la vista previa.
- Conciliacion por fecha, monto absoluto y descripcion normalizada.
- Soporte para montos negativos entre parentesis en columnas firmadas.

### Agregar

- Plantillas para estados de tarjeta de credito.

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
