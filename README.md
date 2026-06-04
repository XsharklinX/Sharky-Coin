# $harky - Gestion de Finanzas

$harky es una app de finanzas personales para Windows. Permite registrar ingresos, gastos y transferencias, gestionar cuentas, controlar presupuestos, seguir metas de ahorro, importar CSV bancarios dominicanos y exportar reportes profesionales.

Version actual: `1.4.0`

## Caracteristicas

- Dashboard financiero con patrimonio neto, ingresos, gastos, ahorro e inteligencia financiera.
- Transacciones con filtros, etiquetas, seleccion multiple, CSV, Excel, PDF y backup JSON.
- Cuentas editables con efectivo, ahorro, debito y tarjetas de credito.
- Presupuestos por categoria con alertas y limites configurables.
- Metas de ahorro con aportes y seguimiento de progreso.
- Importacion CSV para formatos de Popular, BHD, Banreservas y Scotiabank.
- Reportes profesionales en PDF y Excel.
- Autenticacion local o cloud opcional con Supabase.
- Sincronizacion cloud opcional y backups cifrados.
- App desktop con Tauri, instalador `.exe` y portable.

## Stack

- React 18
- TypeScript
- Vite
- Zustand
- Tauri 2
- Supabase
- Recharts
- ExcelJS
- jsPDF
- Playwright
- Vitest

## Requisitos

- Node.js 20 o superior recomendado
- npm
- Rust estable
- Dependencias de Tauri para Windows

## Desarrollo

```powershell
npm install
npm run dev
```

Para abrir la app desktop en modo desarrollo:

```powershell
npm run tauri:dev
```

## Validacion

```powershell
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

## Empaquetar Windows

```powershell
npm run package:windows
```

Salidas esperadas:

- `release/windows/$harky-setup.exe`
- `release/windows/$harky-portable.exe`

La carpeta `release/` esta ignorada por Git. Para distribuir la app, sube esos archivos a GitHub Releases.

## GitHub Pages

La pagina web publica esta en:

```text
docs/index.html
```

Para activarla en GitHub:

1. Sube el repositorio a GitHub.
2. Ve a `Settings > Pages`.
3. En `Build and deployment`, elige `Deploy from a branch`.
4. Selecciona la rama principal y la carpeta `/docs`.
5. Guarda los cambios.

Cuando publiques los binarios en GitHub Releases, la landing apunta a:

```text
https://github.com/XsharklinX/Sharky-Coin/releases/latest
```

Sube ahi el instalador y el portable generados por `npm run package:windows`.

## Release

El checklist de release esta documentado en:

```text
docs/RELEASE.md
```

Antes de publicar una version:

- Ejecuta lint, tests, build y E2E.
- Empaqueta Windows.
- Verifica el portable.
- Publica hashes SHA-256.
- Firma los `.exe` si el release sera publico.

## Estado de v1.4.0

Incluye:

- Carga inicial optimizada con vistas bajo demanda.
- Exportadores pesados aislados en chunks on-demand.
- Changelog visible dentro de Configuracion.
- Canal estable/beta como preferencia operativa.
- Telemetria local opcional de errores, desactivada por defecto.
- Proceso de release documentado.

Pendiente externo:

- Certificado de firma de codigo Windows.
- Hosting de metadata para auto-update firmado.

## Licencia

Proyecto privado por ahora. Define una licencia antes de aceptar contribuciones publicas.
