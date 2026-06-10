# $harky

**Gestion de finanzas personales para Windows.**  
$harky ayuda a registrar movimientos, controlar presupuestos, seguir metas de ahorro, importar estados bancarios dominicanos y generar reportes profesionales desde una app desktop local-first.

![Version](https://img.shields.io/badge/version-1.6.1-3b82f6)
![Platform](https://img.shields.io/badge/platform-Windows-111827)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Tauri-22c55e)
![Status](https://img.shields.io/badge/status-active-2563eb)

## Preview

La pagina publica del proyecto esta en:

[Ver landing de $harky](https://xsharklinx.github.io/Sharky-Coin/)

> Nota: si GitHub Pages aun no esta activo, habilitalo desde `Settings > Pages` usando la carpeta `/docs`.

## Que es $harky

$harky es una aplicacion desktop para gestionar finanzas personales sin depender de hojas de calculo manuales. Esta pensada para usuarios que quieren una vista clara de su dinero: cuentas, gastos, ingresos, presupuestos, metas, reportes y backups.

El enfoque principal es **local-first**:

- La app puede funcionar localmente.
- La autenticacion y sincronizacion cloud son opcionales.
- Los backups pueden exportarse manualmente.
- Los datos financieros no dependen de un servidor para usarse en el dia a dia.

## Funcionalidades principales

### Dashboard financiero

- Patrimonio neto.
- Ingresos, gastos y ahorro mensual.
- Comparacion contra el mes anterior.
- Distribucion de gasto por categoria.
- Presupuesto usado del mes.
- Movimientos recientes.
- Inteligencia financiera con acciones sugeridas.

### Transacciones

- Ingresos, gastos y transferencias.
- Filtros por tipo, categoria, texto y etiquetas.
- Seleccion multiple.
- Recategorizacion en lote.
- Export CSV.
- Export Excel.
- Export PDF.
- Backup JSON.
- Restauracion de backup.

### Cuentas

- Cuentas de efectivo, debito, ahorro y credito.
- Balance por cuenta.
- Etiquetas y colores.
- Politica de sobregiro.
- Soporte para limites de tarjetas.

### Presupuestos

- Presupuesto mensual por categoria.
- Alertas configurables.
- Vista de gasto vs limite.
- Categorias editables.
- Iconos y colores personalizados.

### Metas

- Objetivos de ahorro.
- Aportes a metas.
- Progreso visual.
- Fecha estimada o limite.
- Eliminacion y seguimiento por meta.

### Importacion bancaria

Soporte para CSV de bancos dominicanos:

- Banco Popular
- BHD
- Banreservas
- Scotiabank

Incluye:

- Deteccion automatica de columnas.
- Mapeo manual si el formato cambia.
- Deteccion de duplicados.
- Normalizacion de descripciones.
- Reglas aprendidas para categoria por comercio.
- Vista previa antes de importar.

### Reportes

- PDF mensual con resumen ejecutivo.
- Excel con multiples hojas:
  - Resumen ejecutivo.
  - Resumen anual.
  - Categorias.
  - Cuentas.
  - Hojas mensuales.
- Export de graficas como PNG.
- Backup JSON completo.

### Autenticacion y sincronizacion

- Modo local.
- Modo cloud con Supabase.
- Confirmacion de cuenta.
- Sesion segura en Tauri.
- Sincronizacion opcional.
- Backups cloud cifrados.

## Stack tecnico

| Area | Tecnologia |
| --- | --- |
| Desktop | Tauri 2 |
| Frontend | React 18 |
| Lenguaje | TypeScript |
| Build | Vite |
| Estado | Zustand |
| Auth / Cloud | Supabase |
| Graficas | Recharts |
| PDF | jsPDF |
| Excel | ExcelJS |
| Tests unitarios | Vitest |
| E2E | Playwright |
| Packaging | Tauri NSIS |
| Android | Tauri Android / Gradle |

## Arquitectura

```text
src/
  components/       Componentes UI reutilizables
  data/             Import/export, backups, inteligencia financiera
  hooks/            Automatizaciones locales y Tauri helpers
  lib/              Integraciones base
  modals/           Flujos modales
  store/            Stores Zustand
  views/            Pantallas principales de la app

src-tauri/
  src/              Backend Rust de Tauri
  tauri.conf.json   Configuracion desktop y empaquetado

docs/
  index.html        Landing para GitHub Pages
  RELEASE.md        Proceso de release
```

## Requisitos de desarrollo

- Node.js 20 o superior.
- npm.
- Rust estable.
- Dependencias requeridas por Tauri para Windows.
- Cuenta Supabase solo si se va a probar sincronizacion cloud.

## Instalacion local

```powershell
npm install
```

Crear archivo de entorno:

```powershell
Copy-Item .env.example .env.local
```

Configura las variables de Supabase si vas a usar auth/cloud. Para uso local sin cloud, la app puede correr sin credenciales reales.

## Ejecutar en desarrollo

Web:

```powershell
npm run dev
```

Desktop con Tauri:

```powershell
npm run tauri:dev
```

## Validacion

Antes de publicar o empaquetar:

```powershell
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

Estado actual de la base:

- Lint: activo.
- Tests unitarios: activos.
- E2E: activo.
- Build Windows: activo.
- Portable Windows: activo.

## Build desktop

```powershell
npm run package:windows
```

Genera:

```text
release/windows/$harky-setup.exe
release/windows/$harky-portable.exe
```

La carpeta `release/` no se versiona. Los binarios deben publicarse en:

[GitHub Releases](https://github.com/XsharklinX/Sharky-Coin/releases)

## Build Android

Generar APK debug para telefono Android moderno:

```powershell
npm run package:android -- -Debug -Target aarch64
```

Salida:

```text
release/android/$harky-android-debug-universal.apk
```

Instalar por USB:

```powershell
adb devices
adb install -r "release/android/$harky-android-debug-universal.apk"
```

Guia completa:

[docs/ANDROID.md](docs/ANDROID.md)

## GitHub Pages

La landing publica esta en:

```text
docs/index.html
```

Para publicarla:

1. Ir a `Settings > Pages`.
2. Seleccionar `Deploy from a branch`.
3. Elegir la rama principal.
4. Elegir la carpeta `/docs`.
5. Guardar.

La URL esperada sera:

```text
https://xsharklinx.github.io/Sharky-Coin/
```

## Release process

El proceso completo esta documentado en:

[docs/RELEASE.md](docs/RELEASE.md)

Resumen:

1. Actualizar version en `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` y `src/data/release.ts`.
2. Ejecutar lint, tests, build y E2E.
3. Ejecutar `npm run package:windows`.
4. Probar instalador y portable.
5. Publicar hashes SHA-256.
6. Subir binarios a GitHub Releases.
7. Firmar ejecutables si el release sera publico.

## Seguridad y privacidad

- La app es local-first.
- La telemetria de errores es local, opcional y desactivada por defecto.
- Los backups cloud usan cifrado con frase secreta de usuario.
- Los tokens cloud no deben guardarse manualmente en `localStorage` dentro de Tauri.
- Supabase debe usar RLS para datos sincronizados.
- No se deben mezclar datos entre usuarios cloud.

## Estado actual

Version: `1.6.0`

Incluye:

- UX profesional completa sin dialogos nativos del navegador.
- Confirmaciones destructivas propias y consistentes.
- Filtros guardados con modal de texto integrado.
- Calidad de datos y recuperacion reforzada.
- Snapshot automatico antes de restaurar backups.
- Estado de datos visible en Configuracion.
- Optimizacion de carga inicial con vistas lazy.
- Exportadores pesados aislados bajo demanda.
- PWA precache reducido.
- Changelog visible dentro de la app.
- Canal estable/beta como preferencia.
- Diagnosticos locales opcionales.
- Instalador `.exe` y portable `.exe`.

Pendiente externo:

- Firma de codigo Windows.
- Hosting de metadata para auto-update firmado.
- Publicacion formal de binarios en GitHub Releases.

## Roadmap

Ver roadmap completo:

[ROADMAP.md](ROADMAP.md)

Prioridades siguientes:

- Resolucion visual de conflictos cloud.
- QA visual automatizado por tema y viewport.
- Auto-update firmado.
- Firma de instalador y portable.
- Mas fixtures reales de CSV bancarios.
- Auditoria completa de accesibilidad.
- Mejoras visuales en reportes PDF.

## Contribuir

Este proyecto aun esta en evolucion activa. Antes de abrir cambios grandes:

1. Revisa el roadmap.
2. Mantén las vistas como componentes TypeScript reales en `src/views/`.
3. No reintroduzcas estado global mutable en `window`.
4. Agrega tests para importadores, exporters o migraciones.
5. Ejecuta validacion completa antes de proponer cambios.

## Licencia

Sin licencia publica definida por ahora. Antes de aceptar contribuciones externas, agrega una licencia explicita al repositorio.
