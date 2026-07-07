# $harky — Roadmap

Versión: 1.7.1 | Fecha: 2026-06-17

El núcleo de la app está completo: transacciones, cuentas, presupuestos con
rollover, metas con aportes automáticos, suscripciones con pausa/salto,
simulador de deudas, inteligencia financiera, import CSV bancario (RD), reportes
PDF/Excel/PNG, OCR de recibos, búsqueda global, backup automático semanal,
widgets, notificaciones, seguridad con PIN/patrón/biometría, cloud sync, temas
dark/light/amoled y soporte EN/ES.

Lo que sigue son mejoras que elevan la app, no funcionalidad que le falta.

---

## Próximas mejoras

### Cuentas multi-moneda
Cada cuenta con su propia divisa. Los totales globales convierten
automáticamente usando el motor de tasas en vivo que ya existe. Hoy la app
muestra todo en una sola moneda con conversión visual — esto lo hace real.

### Cuentas de inversión y activos
Nuevos tipos de cuenta: inversión (fondos, acciones — valor manual) y activo
(propiedad, vehículo). Se suman al patrimonio neto separados como "líquido"
vs "patrimonio total". La pieza que falta para un net worth completo.

### Transacciones divididas
Una compra repartida entre 2+ categorías (ej. supermercado → comida +
limpieza). Campo opcional `splits` en la transacción, reflejado correctamente
en presupuestos y reportes.

### Calendario de flujo de caja
Vista que combina recurrencias + proyección de saldo día por día. Responde
directo a "¿me alcanza hasta fin de mes?".

### Búsqueda inteligente
Extender la búsqueda global para entender consultas como "comida en mayo" o
"más de $1000" parseando fecha/monto/categoría desde texto libre.

### OCR por lotes
Compartir varias fotos/PDFs de recibos a la vez y generar un lote de
transacciones para revisar antes de confirmar.

### Acciones desde insights
Que cada anomalía, tendencia o recomendación de la inteligencia financiera se
convierta en una acción directa (crear presupuesto, pausar suscripción,
ajustar meta) con un toque.

---

## Mejoras de experiencia

- **Dashboard personalizable**: reordenar/ocultar tarjetas del Home.
- **Revisión semanal guiada**: resumen de la semana con 1-2 acciones sugeridas.
- **Pase de accesibilidad**: contraste AA, tamaños táctiles ≥44px, lectores
  de pantalla en flujos críticos.
- **Backup cifrado**: passphrase opcional sobre el JSON antes de guardarlo.
- **Detección de aumentos en suscripciones**: alertar cuando un servicio
  recurrente sube de precio.

---

## Fuera de alcance

- Agregación bancaria automática (Plaid/Belvo) — no cubre bancos RD, rompe
  el modelo local-first.
- Trading / brokerage en vivo.
- iOS nativo — la PWA cubre el caso por ahora.

---

Este roadmap se actualiza conforme avanza el desarrollo.
