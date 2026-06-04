# $harky - Roadmap de v1.x

Fecha de revision: 2026-06-02
Version actual: 1.1.0

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
| P1 | UX | Los modales principales aun no comparten un sistema unico de layout y estados | La app funciona, pero algunos flujos se sienten menos consistentes que el resto. |
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

### P1

- Agregar plantillas CSV para tarjetas de credito.
- Separar perfiles por banco, producto y moneda.
- Mejorar aprendizaje de reglas: categoria por comercio, cuenta y monto aproximado.
- Conciliacion avanzada con tolerancia de fecha y equivalencias de descripcion.
- Importacion OFX/QFX como alternativa estandar.

### Criterio de salida

- Un usuario puede importar estados comunes sin editar columnas manualmente.
- Los duplicados se detectan de forma explicable antes de confirmar.

## v1.3 - Reportes y decision financiera

Objetivo: que la app explique el dinero, no solo lo registre.

### P2

- Ajuste de sensibilidad para gastos atipicos.
- Panel para convertir suscripciones detectadas en recurrencias.
- Reportes PDF con logo, identidad visual, resumen ejecutivo y detalle mensual.
- Excel con hojas por mes, categoria, cuenta y resumen anual.
- Comparativas utiles: este mes vs mes anterior, este ano vs ano anterior.

### Criterio de salida

- Los reportes se pueden enviar a otra persona sin parecer un export tecnico.
- Las recomendaciones tienen accion directa dentro de la app.

## v1.4 - Distribucion y operacion

Objetivo: mantener la app en produccion sin friccion.

### P2

- Auto-update firmado en Tauri.
- Canal beta y canal estable.
- Changelog visible dentro de la app.
- Telemetria opcional y desactivable para errores tecnicos.
- Proceso de release documentado: build, test, firma, hash, publicacion.

### Criterio de salida

- Publicar una nueva version no requiere reinstalacion manual.
- Los fallos reales se pueden diagnosticar sin leer reportes vagos del usuario.

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
