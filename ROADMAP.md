# $harky - Roadmap (Android)

Fecha de revision: 2026-06-10
Version base: 1.6.2
Plataforma: Android (Tauri Mobile), Play Store en proceso de alta

> $harky se enfoca por ahora exclusivamente en Android. El empaquetado de
> escritorio (Windows/.exe) queda fuera del roadmap mientras tanto; podria
> retomarse en el futuro pero no es prioridad.

## Diagnostico actual

$harky es una app movil completa: dashboard, transacciones/cuentas,
presupuestos y metas, importacion CSV de bancos dominicanos, reportes
PDF/Excel/JSON, escaneo de recibos, deteccion por notificaciones bancarias,
bloqueo por PIN/patron/biometria (cifrado con Android Keystore), inicio de
sesion con Google + sync opcional con Supabase, accesos directos de inicio
rapido y modo claro/oscuro. La pagina publica (`docs/`) ya refleja esto.

Lo que falta ya no es "construir mas pantallas", sino: **validar todo en
dispositivos reales, cerrar el alta en Play Store, y pulir los flujos que mas
usa un usuario nuevo o con datos reales** (sync, importacion, primeros pasos).

## Prioridades

| Prioridad | Area | Item | Por que importa |
| --- | --- | --- | --- |
| P0 | Lanzamiento | Terminar checklist de Play Console (calificacion de contenido, publico objetivo, anuncios, datos seguros) | Bloquea la publicacion |
| P0 | QA dispositivo real | Probar PIN/patron tras actualizar desde v1.6.1 a v1.6.2+ (migracion al nuevo storage cifrado) | Riesgo de que usuarios existentes queden bloqueados fuera de la app |
| P0 | QA dispositivo real | Probar notificaciones bancarias (permiso especial de Android), OCR de recibos (permiso camara) y Google Sign-In de punta a punta en un telefono real | Estas tres dependen de permisos/SO y son dificiles de validar en emulador |
| P0 | Ficha de Play Store | Generar capturas de pantalla reales (telefono y, si aplica, tablet) y un feature graphic | `docs/assets` solo tiene el icono; la ficha no puede publicarse sin capturas |
| P1 | Onboarding | Flujo inicial para usuario nuevo: crear primera cuenta, elegir moneda, categorias sugeridas | Hoy un usuario nuevo llega a un dashboard vacio sin guia |
| P1 | Sync cloud | Pantalla de conflictos lado a lado (local vs. cloud) cuando hay choques de sincronizacion | Los conflictos hoy solo se listan; el usuario no entiende que conservar |
| P1 | Accesibilidad | Auditoria AA: contraste, foco visible, labels en botones de icono | Calidad percibida y usuarios con lectores de pantalla |
| P1 | Importacion bancaria | Perfiles separados por moneda (RD$/US$) y soporte OFX/QFX | Reduce edicion manual para tarjetas en USD y otros bancos |
| P1 | Importacion bancaria | Historial de imports (fecha, archivo, cuenta, duplicados omitidos) + deshacer import completo | Un import equivocado hoy no se puede revertir limpio |
| P2 | Inteligencia financiera | Modal para editar una suscripcion detectada antes de convertirla en recurrencia | Evita crear recurrencias mal configuradas |
| P2 | Reportes | Comparativas mes vs. mes anterior y ano vs. ano anterior en el dashboard/reportes | Hoy los reportes son snapshots, sin contexto de tendencia |
| P2 | Reportes | Portada y notas por categoria en el PDF mensual | Se ve mas "documento para compartir" y menos export tecnico |
| P2 | Internacionalizacion | Revisar cobertura es/en (textos nuevos del quick-add, shortcuts, etc.) | Evitar claves sin traducir en produccion |
| P2 | Operacion | Reportes de error opcionales con consentimiento (mas alla de la telemetria local) | Detectar fallos reales de usuarios sin acceso a sus dispositivos |

## Fase A - Cierre de lanzamiento (P0)

- [ ] Completar los 9 items del checklist "Termina de configurar tu app".
- [ ] Verificar Data Safety form: que coincida con lo que realmente hace la
      app (Google sign-in, Supabase, sin anuncios, sin tracking de terceros).
- [ ] Smoke test en dispositivo real (apk firmado o build interno de Play):
  - Instalar version nueva sobre una instalacion previa con PIN configurado.
  - Activar lectura de notificaciones bancarias y registrar un gasto real.
  - Escanear un recibo con la camara.
  - Iniciar sesion con Google, cerrar la app por completo y reabrirla.
  - Crear un acceso directo desde el icono (mantener presionado) y agregar
    un gasto/ingreso desde la mini ventana.
- [ ] Tomar capturas de pantalla (dashboard, transacciones, presupuestos,
      reportes, escaneo de recibo) y crear el feature graphic.
- [ ] Una vez publicada la ficha, actualizar `docs/index.html` y
      `docs/PLAY_STORE.md` con el enlace real de Play Store.

## Fase B - Primeros pasos y confianza en los datos (P1)

- [ ] Onboarding: pantalla inicial para crear la primera cuenta, elegir
      moneda principal y (opcional) activar PIN/biometria.
- [ ] Pantalla de resolucion de conflictos de sync: comparacion local vs.
      cloud por entidad, con accion clara (mantener local / usar cloud /
      duplicar / ignorar).
- [x] Auditoria de accesibilidad: navegacion por teclado en flujos
      principales, foco visible, `aria-label` en botones de icono.
      Foco visible ya existia globalmente (`:focus-visible` en
      `base.css`). Se agrego `useDialogA11y` (foco inicial, cierre con
      `Escape`, restauracion de foco al cerrar) a todos los sheets/dialogos
      moviles, y `aria-label` a los botones de cerrar/volver/confirmar sin
      etiquetar. Pendiente como mejora futura: focus trap completo dentro
      de los dialogos y una alternativa accesible por teclado al menu de
      mantener-presionado del FAB (`MobileBottomNav.tsx`).

## Fase C - Importacion bancaria avanzada (P1)

- [ ] Perfiles CSV separados por moneda para tarjetas en USD.
- [ ] Soporte de import OFX/QFX como alternativa al CSV.
- [ ] Historial de importaciones con deshacer.
- [ ] Reglas de categorizacion mas precisas (comercio + cuenta + monto
      aproximado).

## Fase D - Inteligencia financiera y reportes (P2)

- [x] Modal de edicion previa al convertir una suscripcion detectada en
      recurrencia. Nueva seccion "Detectadas automaticamente" en
      `MobileSubscriptions` (usa `detectSubscriptions`, ocultando las que ya
      son recurrentes) con boton "Convertir" que abre un formulario
      (nombre, monto, categoria, cuenta, frecuencia) antes de crear la
      plantilla recurrente.
- [x] Comparativas mes vs. mes anterior y ano vs. ano anterior. Seccion
      "Comparativa" en `MobileAnalytics` (ingresos/gastos/neto vs. periodo
      anterior, segun la pestana mes/ano) y seccion "Comparativa
      interanual" en el reporte anual (`MobileAnnual`).
- [ ] Portada y notas por categoria en el PDF mensual.

## Deuda tecnica a vigilar

- No volver a guardar PIN, patron o tokens de Google en `localStorage` en
  texto plano en Android: deben pasar por `secureBlob`/`appLockStorage`.
- Mantener `partialize` de `settings.ts` sincronizado si se agregan nuevos
  campos sensibles.
- Revisar que las claves nuevas de `i18n` tengan version en `es` y `en`.
- Mantener exporters (PDF/Excel/JSON) cubiertos por pruebas al tocarlos.
- Los dos tests flaky conocidos (`financeIntelligence.test.ts`,
  `month-navigation.test.tsx`) deben revisarse si vuelven a fallar en CI;
  hasta ahora pasan en aislado.

## Orden recomendado

1. Fase A: cerrar el alta en Play Store y validar en dispositivo real.
2. Fase B: onboarding y conflictos de sync, antes de tener muchos usuarios
   con datos reales en la nube.
3. Fase C: importacion bancaria avanzada.
4. Fase D: inteligencia financiera y reportes.
