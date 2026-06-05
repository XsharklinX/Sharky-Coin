# $harky - Roadmap de v1.x

Fecha de revision: 2026-06-02
Version actual: 1.6.0

## Diagnostico actual

$harky ya tiene una base funcional fuerte: React + TypeScript, Tauri, autenticacion local/cloud, sincronizacion Supabase, importacion CSV bancaria, exportaciones profesionales, presupuestos, metas, cuentas, transacciones, graficas, pruebas unitarias, E2E y empaquetado Windows con instalador `.exe` y portable.

El riesgo principal ya no es "faltan pantallas". El riesgo esta en calidad de release, consistencia visual, recuperacion ante fallos, migraciones de datos y confianza de distribucion.

## Problemas actuales

| Prioridad | Area | Problema | Impacto |
| --- | --- | --- | --- |
| P0 | Release | Falta firma de codigo Windows | SmartScreen puede marcar el `.exe` como poco confiable aunque el build sea correcto. |
| P0 | Datos | No hay pruebas de migracion entre versiones antiguas y v1.0 | Un usuario con datos viejos puede encontrar estados inconsistentes tras actualizar. |
| P0 | Cloud | Falta validacion manual completa del flujo cloud dentro del `.exe` final | El navegador web puede pasar, pero Tauri tiene diferencias en deep links, storage seguro y permisos. |
| P0 | Recuperacion | Restaurar backups cloud/local necesita pruebas E2E completas | Es una funcion critica; debe cubrir corrupcion, frase incorrecta y restore exitoso. |
| P1 | UX | Falta completar microcopy y estados de error por vista | La app ya no usa dialogos nativos, pero algunos mensajes pueden ser mas explicativos. |
| P1 | UI | Falta una auditoria visual completa por tema: claro, oscuro, pizarra y sistema | Ya hay cobertura E2E, pero no comparacion visual automatica. |
| P1 | Accesibilidad | Falta checklist AA completo con teclado, foco visible y lector de pantalla | Puede bloquear usuarios y reduce calidad percibida. |
| P1 | Sync | Conflictos cloud visibles, pero falta una pantalla dedicada para resolverlos con contexto | El sistema evita sobrescrituras silenciosas, pero la resolucion aun puede mejorar. |
| P1 | CSV | Faltan plantillas para estados de tarjeta de credito | La importacion cubre bancos principales, pero no todos los formatos reales. |
| P2 | Producto | Inteligencia financiera no permite ajustar sensibilidad | Usuarios distintos pueden necesitar alertas mas o menos agresivas. |
| P2 | Reportes | Falta identidad visual completa en reportes exportados | PDF/Excel funcionan, pero pueden verse mas de marca y menos genericos. |
| P2 | Distribucion | Falta auto-update firmado | El usuario debe instalar manualmente nuevas versiones. |
| P2 | Observabilidad | No hay telemetria opcional de errores | Los fallos reales en equipos de usuarios pueden pasar desapercibidos. |

## Roadmap recomendado

## v1.0.1 - Hotfix de release

Objetivo: dejar el instalador y portable listos para uso real sin sorpresas.

Estado: completada como `v1.0.1`.

### Cerrado en esta iteracion

- Version de app, Tauri y Cargo actualizada a `1.0.1`.
- Metadata de Windows normalizada en ASCII para evitar caracteres rotos en instalador, terminal y manifiestos.
- Script de paquete Windows normalizado y con hashes SHA-256 de instalador y portable.
- Pruebas de migracion agregadas para backups v1 antiguos sin aportes a metas.
- Pruebas de restauracion agregadas para aportes a metas con referencias invalidas.
- Pruebas de sanitizacion agregadas para datos legacy persistidos con categorias, cuentas, aportes y movimientos inconsistentes.

### P0

- Pendiente externo: firmar el instalador `.exe` y portable con certificado de codigo.
- Pendiente manual: ejecutar smoke test en Windows limpio: instalar, abrir, crear usuario local, crear cuenta, crear movimiento, cerrar y reabrir.
- Pendiente manual: validar flujo cloud dentro del `.exe`: registro, confirmacion por correo, login, logout, recuperacion de sesion y deep link `sharky://auth/callback`.
- Pendiente manual: probar backup local y cloud con cuenta real de Supabase.
- Pendiente tecnico siguiente: ampliar snapshots de migracion con fixtures reales de v0.3, v0.5 y v0.7.

### Criterio de salida

- `npm run lint`, `npm run test -- --run`, `npm run build`, `npm run test:e2e` y `npm run package:windows` pasan.
- El `.exe` abre con cambios actuales, no una version cacheada.
- No hay textos corruptos en app, metadata o instalador.

## v1.1 - UX profesional y accesibilidad

Objetivo: subir la calidad percibida sin meter deuda nueva.

Estado: completada como `v1.1.0`.

### Cerrado en esta iteracion

- Sistema comun `ModalShell` con cierre por `Esc`, restauracion de foco, titulo, descripcion e icono.
- Modal de transacciones migrado al sistema comun sin cambiar reglas financieras.
- Modal de configuracion migrado al sistema comun y actualizado a `v1.1.0`.
- Estilos base de modal renovados con header, contenido, footer y foco consistentes.
- Roadmap interno actualizado para reflejar el salto a `v1.1.0`.

### P1

- Pendiente siguiente: migrar cuentas, metas, categorias CSV y confirmaciones destructivas al mismo `ModalShell`.
- Pendiente siguiente: auditoria visual de los cuatro temas con capturas comparativas.
- Pendiente siguiente: accesibilidad AA completa con navegacion por teclado, labels, roles ARIA y contraste.
- Pendiente siguiente: mejorar la pantalla de conflictos cloud con comparacion lado a lado.

### Criterio de salida

- Todos los modales usan el mismo patron.
- Navegacion completa sin mouse en flujos criticos.
- Sin overflow horizontal en 1280 px, 1024 px y 768 px.

## v1.2 - Integraciones bancarias reales

Objetivo: reducir trabajo manual para usuarios dominicanos.

Estado: completada como `v1.2.0`.

### Cerrado en esta iteracion

- Perfiles CSV separados para tarjetas de Banco Popular, BHD, Banreservas y Scotiabank.
- Deteccion automatica mejorada para encabezados de tarjeta: fecha de consumo/posteo, comercio, consumos, cargos, pagos y abonos.
- Conciliacion mas tolerante para tarjetas: mismo monto y comercio con hasta dos dias de diferencia entre fecha de consumo y posteo.
- Normalizacion de descripciones bancarias eliminando ruido comun de POS, VISA, Mastercard, autorizaciones y referencias.
- Modal de importacion CSV migrado al sistema comun `ModalShell`.
- Vista previa CSV muestra si el perfil detectado es Cuenta, Tarjeta o Mixto.

### P1

- Pendiente siguiente: separar perfiles por moneda cuando tengamos estados reales RD$/US$ por banco.
- Pendiente siguiente: mejorar aprendizaje de reglas por comercio, cuenta y monto aproximado.
- Pendiente siguiente: importar OFX/QFX como alternativa estandar.
- Pendiente siguiente: guardar ejemplos anonimizados de formatos reales para ampliar fixtures.

### Criterio de salida

- Un usuario puede importar estados comunes sin editar columnas manualmente.
- Los duplicados se detectan de forma explicable antes de confirmar.

## v1.3 - Reportes y decision financiera

Objetivo: que la app explique el dinero, no solo lo registre.

Estado: completada como `v1.3.0`.

### Cerrado en esta iteracion

- Ajuste de sensibilidad para gastos atipicos: alta, balanceada y baja.
- Motor de inteligencia conectado a la sensibilidad elegida por el usuario.
- Suscripciones detectadas accionables: se pueden convertir en recurrencias mensuales desde el Dashboard.
- Reportes Excel con hoja de resumen ejecutivo, resumen anual, categoria, cuenta y hojas mensuales.
- PDF mensual con identidad visual, resumen ejecutivo, KPI y categoria principal.
- Resumen ejecutivo reutilizable y cubierto por prueba unitaria.
- Roadmap interno del Dashboard actualizado hasta `v1.3`.

### P2

- Pendiente siguiente: panel dedicado para editar una suscripcion antes de convertirla en recurrencia.
- Pendiente siguiente: comparativas visuales avanzadas este mes vs mes anterior y este ano vs ano anterior.
- Pendiente siguiente: plantilla PDF con portada y notas por categoria.

### Criterio de salida

- Los reportes se pueden enviar a otra persona sin parecer un export tecnico.
- Las recomendaciones tienen accion directa dentro de la app.

## v1.4 - Distribucion y operacion

Objetivo: mantener la app en produccion sin friccion.

Estado: completada como `v1.4.0` para la parte implementable dentro del repo.

### Cerrado en esta iteracion

- Carga inicial optimizada con vistas principales bajo demanda.
- Exportadores PDF, Excel y captura PNG aislados en chunks on-demand.
- Chunks pesados nombrados y separados en Vite: Excel, PDF, captura, graficas e iconos.
- PWA precache reducido excluyendo exports y graficas pesadas.
- Changelog visible dentro de Configuracion.
- Canal estable/beta guardado como preferencia operativa.
- Telemetria local opcional para errores tecnicos, desactivada por defecto.
- Error boundaries guardan diagnosticos locales cuando el usuario lo permite.
- Proceso de release documentado en `docs/RELEASE.md`.

### P2

- Pendiente externo: certificado de firma de codigo Windows.
- Pendiente externo: hosting de update metadata para canal estable y beta.
- Pendiente siguiente: conectar Tauri updater cuando existan firma y endpoint.
- Pendiente siguiente: enviar diagnosticos opcionales a un backend propio con consentimiento explicito.

### Criterio de salida

- Build sin warning de chunks de primera carga.
- El usuario puede ver cambios de version dentro de la app.
- Los fallos reales tienen diagnostico local exportable sin tracking por defecto.

## v1.5 - Calidad de datos y recuperacion

Objetivo: que ningun usuario pierda datos ni quede bloqueado al actualizar o restaurar.

Estado: completada como `v1.5.0`.

### Cerrado en esta iteracion

- Snapshot automatico antes de cualquier restauracion de backup local o cloud.
- Estado de datos visible en Configuracion: cuentas, movimientos, categorias, metas, recovery, backup cloud y sync.
- Razones de recovery diferenciadas, incluyendo puntos creados antes de restore.
- Fixtures legacy anonimizados para versiones tempranas.
- Pruebas de backups corruptos, referencias invalidas, fixtures legacy y restore seguro.
- Changelog actualizado a `v1.5.0`.

### Pendiente siguiente

- E2E con dialogo de archivo nativo dentro del `.exe`.
- Smoke manual cloud con cuenta real de Supabase.
- Fixture reales adicionales de usuarios anonimizados.

### Criterio de salida

- Un restore crea snapshot previo antes de reemplazar datos.
- Un backup corrupto no modifica datos actuales.
- La app muestra al usuario el estado basico de seguridad de sus datos.

## v1.6 - UX profesional completa

Objetivo: eliminar dialogos nativos del navegador y unificar confirmaciones criticas.

Estado: completada como `v1.6.0`.

### Cerrado en esta iteracion

- `window.confirm` eliminado de flujos de usuario.
- `window.prompt` eliminado del guardado de filtros.
- Sistema reutilizable de dialogos en `DialogProvider`.
- Confirmaciones destructivas migradas en cuentas, presupuestos, metas, backups, recovery y transacciones en lote.
- Prueba E2E actualizada para validar el modal propio de eliminacion de metas.
- Changelog actualizado a `v1.6.0`.

### Pendiente siguiente

- Resolver conflictos cloud con comparacion lado a lado.
- Auditoria visual automatizada por tema y viewport.
- E2E completo de restore cloud/local con fixtures reales.

## Deuda tecnica que no debe crecer

- Mantener los componentes en `src/views/` como TypeScript real, sin volver a JSX heredado.
- No reintroducir estado global mutable en `window`.
- No depender de Babel runtime.
- No agregar nuevas pantallas sin E2E minimo.
- No agregar nuevos exporters sin pruebas de formato.
- No mezclar datos cloud entre usuarios ni volver a guardar tokens en `localStorage` dentro de Tauri.

## Orden de ejecucion

1. Cerrar v1.0.1 con firma, migraciones y smoke del `.exe`.
2. Hacer v1.1 antes de agregar nuevas features grandes.
3. Avanzar importacion bancaria real en v1.2.
4. Pulir reportes e inteligencia financiera en v1.3.
5. Automatizar actualizaciones y operacion en v1.4.
6. Reforzar datos, backups y recovery en v1.5.
