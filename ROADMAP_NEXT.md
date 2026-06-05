# $harky - Roadmap nuevo desde v1.4.0

Fecha de revision: 2026-06-04  
Version base: 1.6.0

## Diagnostico

$harky ya paso la etapa de prototipo. La app tiene escritorio Tauri, React + TypeScript, autenticacion local/cloud, CSV bancario, presupuestos, metas, reportes, backups, tests unitarios, E2E, instalador y portable.

El siguiente salto no deberia ser "agregar pantallas por agregar". La prioridad ahora es convertirla en una app confiable para usuarios reales: datos seguros, releases claros, mejor UX, menos friccion, mas validacion visual y mejores flujos cloud.

## Prioridades inmediatas

| Prioridad | Area | Problema | Impacto | Accion |
| --- | --- | --- | --- | --- |
| P0 | Release | Ejecutables sin firma de codigo | Windows SmartScreen puede bloquear o asustar al usuario | Comprar/configurar certificado y firmar setup + portable |
| P0 | Cloud | Flujo cloud no validado completo dentro del `.exe` | Puede funcionar en web pero fallar en Tauri por deep links/storage | Smoke test real: registro, confirmacion, login, logout, reset, sync |
| P0 | Datos | Faltan fixtures reales de migracion antiguos | Usuarios con datos viejos pueden actualizar mal | Agregar snapshots anonimizados v0.3, v0.5, v0.7 |
| P0 | Backup | Restore cloud/local no tiene E2E completo | Riesgo alto: recuperar datos es critico | E2E de backup valido, corrupto, passphrase incorrecta y restore exitoso |
| P1 | UX | Los dialogos nativos ya fueron removidos; falta profundizar microcopy por flujo | La app se siente mas consistente, pero todavia puede explicar mejor algunas acciones | Revisar microcopy y estados de error por vista |
| P1 | Sync | Conflictos cloud solo se listan, no se resuelven bien | El usuario no entiende que conservar o reemplazar | Crear pantalla de resolucion lado a lado |
| P1 | Accesibilidad | Falta auditoria AA formal | Teclado, foco y lector pueden fallar en flujos criticos | Checklist AA + tests E2E de teclado |
| P1 | Visual | No hay snapshot visual por tema | Regresiones de tema vuelven a aparecer tarde | Capturas E2E por tema y viewport |
| P1 | CSV | Faltan mas formatos reales de tarjetas | El import puede fallar con bancos/formats no probados | Fixtures anonimizados y perfiles por moneda |
| P2 | Reportes | PDF aun puede mejorar como documento final | Export funciona, pero puede verse mas premium | Portada, notas por categoria, branding completo |
| P2 | Producto | Suscripciones detectadas se convierten directo | Falta revisar antes de crear recurrencia | Modal de edicion previa de recurrencia |
| P2 | Operacion | Telemetria solo local | No ayuda a detectar fallos reales publicados | Backend opcional con consentimiento explicito |
| P2 | Distribucion | Auto-update no conectado | Usuarios deben reinstalar manualmente | Tauri updater tras firma + hosting |

## v1.5 - Calidad de datos y recuperacion

Objetivo: que ningun usuario pierda datos ni quede bloqueado al actualizar/restaurar.

Estado: completada como `v1.5.0`.

### Alcance

- Cerrado: fixtures de migracion legacy anonimizados.
- Cerrado: pruebas de backups corruptos y referencias invalidas.
- Cerrado: snapshot automatico antes de cualquier restore.
- Cerrado: pruebas de restore seguro con snapshot previo.
- Cerrado: estado de datos en Configuracion.
- Cerrado: visibilidad de recovery local, backup cloud y ultimo sync.
- Pendiente ampliable: E2E con dialogo de archivo nativo en Tauri real.
- Pendiente ampliable: smoke manual cloud con cuenta real.

### Criterio de salida

- Un backup roto nunca deja la app en estado parcial.
- Restore crea snapshot previo antes de reemplazar datos.
- Migraciones legacy tienen cobertura automatica.

## v1.6 - UX profesional completa

Objetivo: eliminar los restos de UX nativa del navegador y unificar flujos.

Estado: completada como `v1.6.0`.

### Alcance

- Reemplazar todos los `window.confirm` por modales propios.
- Reemplazar `window.prompt` de filtros guardados por modal propio.
- Crear sistema reutilizable de confirmacion.
- Crear sistema reutilizable de entrada de texto.
- Migrar confirmaciones destructivas en:
  - cuentas
  - presupuestos/categorias
  - metas
  - backups
  - recovery
  - transacciones en lote
- Mejorar estados vacios y de error en cada vista.
- Revisar copy de toda la app para mantener tono profesional.

### Criterio de salida

- Cero `window.confirm`.
- Cero `window.prompt`.
- Todos los flujos destructivos explican impacto y tienen accion clara.

## v1.7 - Cloud sync confiable

Objetivo: que la sincronizacion sea entendible y segura.

### Alcance

- Crear vista dedicada de conflictos.
- Comparacion lado a lado:
  - local
  - cloud
  - fecha de edicion
  - tipo de entidad
- Resolver por item:
  - conservar local
  - usar cloud
  - duplicar
  - ignorar
- Mostrar cola de cambios pendientes.
- Mostrar estado de conexion.
- Agregar E2E de conflicto simulado.

### Criterio de salida

- Ningun conflicto queda como texto tecnico.
- El usuario puede resolver sin perder contexto.
- Sync no sobrescribe datos silenciosamente.

## v1.8 - Accesibilidad y QA visual

Objetivo: evitar que vuelvan bugs visuales como temas rotos, categorias desalineadas o modales inconsistentes.

### Alcance

- Playwright screenshots por tema:
  - claro
  - oscuro
  - pizarra
  - carbon
- Viewports:
  - 1366 px
  - 1024 px
  - 768 px
  - movil
- Tests de teclado:
  - navegar sidebar
  - abrir/cerrar modal
  - guardar transaccion
  - importar CSV
  - usar command palette
- Revisar contraste AA.
- Labels ARIA en inputs criticos.
- Foco visible en todos los controles.

### Criterio de salida

- Cualquier regresion visual obvia falla en CI/local.
- La app puede usarse en flujos basicos sin mouse.

## v1.9 - Importacion bancaria avanzada

Objetivo: hacer el CSV mucho mas tolerante a formatos reales.

### Alcance

- Fixtures anonimizados por banco y tipo:
  - cuenta corriente
  - ahorro
  - tarjeta RD$
  - tarjeta US$
- Deteccion por moneda.
- OFX/QFX como alternativa estandar.
- Reglas por comercio + cuenta + monto aproximado.
- Editor de reglas mas claro.
- Historial de imports:
  - fecha
  - archivo
  - cuenta destino
  - cantidad importada
  - duplicados omitidos
- Undo de importacion completa.

### Criterio de salida

- Un import equivocado puede revertirse.
- El usuario entiende por que algo fue duplicado u omitido.

## v2.0 - Release publico

Objetivo: publicar $harky como producto descargable confiable.

### Alcance

- Firma de codigo Windows.
- GitHub Release completo:
  - setup `.exe`
  - portable `.exe`
  - hashes SHA-256
  - changelog
  - capturas
- Auto-update firmado con canal estable/beta.
- Landing actualizada con:
  - screenshots reales
  - instrucciones de instalacion
  - aviso de SmartScreen si aplica
- Licencia definida.
- Politica de privacidad.
- Politica de backups y datos.

### Criterio de salida

- Un usuario externo puede descargar, instalar, crear cuenta, usar y actualizar la app sin instrucciones privadas.

## Deuda tecnica a vigilar

- Evitar que `localStorage` crezca como capa de datos sin abstraccion.
- Evitar meter dependencias pesadas en el bundle inicial.
- No volver a mezclar vistas nuevas en archivos legacy `.jsx`.
- Mantener los exporters con tests.
- Mantener migraciones cubiertas.
- No guardar tokens cloud manualmente en storage inseguro dentro de Tauri.
- No agregar features financieras sin explicar impacto al usuario.
- No publicar ejecutables sin hashes.

## Orden recomendado

1. v1.5: datos, backup y migraciones.
2. v1.6: UX profesional completa.
3. v1.7: sync y conflictos cloud.
4. v1.8: accesibilidad y QA visual.
5. v1.9: importacion bancaria avanzada.
6. v2.0: release publico firmado.
