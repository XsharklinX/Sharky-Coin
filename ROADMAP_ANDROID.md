# $harky - Roadmap de Producto (Exclusivo Android)

Fecha de revisión: 2026-06-09  
Versión base: v1.6.0  
Plataforma objetivo: Android (Tauri Mobile / PWA / WebView)

---

## 1. Diagnóstico Actual

$harky es una aplicación de finanzas personales diseñada sobre una arquitectura híbrida de alto rendimiento: React, TypeScript, y Tauri. Al priorizar el ecosistema de **Android**, se eliminan todas las consideraciones exclusivas de Windows (como firmas de ejecutables `.exe`, instaladores MSI, o integraciones específicas de carpetas de escritorio).

El foco principal de desarrollo para Android se sitúa en la **calidad en el dispositivo móvil**, la integración fluida con los sensores y API nativas del sistema operativo Android (WebView, Biometría, Compartir archivo nativo, botón Atrás de hardware) y el rendimiento óptimo en WebViews de gama media y baja.

---

## 2. Problemas Identificados y Prioridades (Android)

| Prioridad | Área | Problema / Oportunidad | Impacto | Acción Recomendada |
| --- | --- | --- | --- | --- |
| **P0** | **Navegación** | Saltos de meses vacíos en el selector de fecha (Solucionado) | Confusión del usuario al navegar linealmente por el calendario. | Generar un rango contiguo de meses (`monthKeys`) entre la transacción más antigua y el mes actual. |
| **P0** | **Navegación** | Botón físico "Atrás" de Android | Puede cerrar la app por error si hay modales o vistas secundarias abiertos. | Robustecer `useMobileBackDismiss` para capturar eventos nativos del botón Atrás de Android en Tauri. |
| **P0** | **Datos** | Almacenamiento Seguro (Android Keystore) | El plugin `keyring` falla en Android al no estar configurado, rompiendo logins con OAuth. | Mantener y documentar el fallback automático a `browserStorage` (localStorage) solo para entornos móviles. |
| **P1** | **UI/UX** | Zonas seguras (Notches / Agujero de cámara) | Elementos de interfaz (como el TopBar o BottomNav) pueden colisionar con la barra de estado o barra de gestos de Android. | Incorporar y auditar CSS safe-area (`env(safe-area-inset-top)` / `bottom`). |
| **P1** | **Físico** | Tamaño de objetivos de toque (Touch Targets) | Botones o iconos con tamaño inferior a 48x48px provocan toques accidentales o insensibilidad. | Ajustar paddings de botones y áreas interactivas en `src/styles/` para cumplir con las pautas de Android (Material Design). |
| **P1** | **Integración** | Compartir archivos exportados | El guardado en la carpeta Descargas de Android puede requerir diálogos complejos de permisos. | Utilizar el Web Share API nativo de Android como flujo primario para exportar informes (Excel/PDF) hacia apps como Drive o WhatsApp. |
| **P2** | **Rendimiento** | Framerate en WebView | Animaciones pesadas (como contadores de dinero o gráficos canvas) pueden ir a menos de 30fps. | Añadir propiedades de aceleración por hardware (`will-change`, `transform: translate3d`) y simplificar renders en pantallas móviles. |
| **P2** | **Hardware** | Integración Biométrica | La huella dactilar/desbloqueo facial nativo de Android necesita pruebas exhaustivas en dispositivos reales. | Verificar el flujo de `@tauri-apps/plugin-biometric` en distintas versiones de Android. |

---

## 3. Fases del Roadmap Android

### v1.7.0-Android: Navegación Segura e Integración de Sistema
*Objetivo: Lograr que la app se comporte como un ciudadano nativo de Android al interactuar con el sistema operativo.*

- **Botón Atrás Físico de Android (Tauri)**:
  - Interceptar de forma global el evento de hardware `backButton` de Tauri.
  - Asegurar que cualquier overlay activo (formularios de transacciones, modal de configuración, selector de moneda) se cierre primero antes de permitir que la app se minimice o cierre.
- **Auditoría de Safe Areas (Notches / Gestos)**:
  - Configurar las directivas de viewport en `index.html` para permitir uso de pantalla completa (`viewport-fit=cover`).
  - Aplicar variables CSS `env(safe-area-inset-*)` a `mobile-topbar` y `mobile-bottom-nav` para evitar superposiciones con barras del sistema de Android.

### v1.8.0-Android: Optimización de WebView y Rendimiento Visual
*Objetivo: Fluidez total a 60fps y adaptabilidad a pantallas táctiles.*

- **Optimización de Animaciones**:
  - Forzar renderizado en GPU para las transiciones de pestañas usando transformaciones en lugar de modificar propiedades de diseño (como `left` o `width`).
  - Reducir redibujados innecesarios al abrir el teclado en pantalla de Android (el rediseño automático del viewport no debe romper las gráficas de `MobileAnalytics`).
- **Touch Targets Audit**:
  - Asegurar que los botones de navegación de meses en `MobileTopBar` y los elementos de lista en `MobileTransactionList` cumplan con la regla de 48x48px mínimo de área interactiva táctil.

### v1.9.0-Android: Integraciones Nativas de Archivo y Sensores
*Objetivo: Aprovechar al máximo las capacidades de Tauri Android para importación/exportación de datos y seguridad.*

- **Web Share API y Archivos Temporales**:
  - Al generar reportes PDF o Excel, en lugar de forzar una descarga en el sistema de archivos del teléfono, activar el menú "Compartir nativo" de Android para que el usuario envíe directamente el archivo.
- **Importación de Recibos compartidos**:
  - Validar y optimizar el plugin nativo que intercepta archivos compartidos de imagen/PDF (`take_pending_shared_file`) al abrir la app de forma directa desde la galería.
- **Autenticación Biométrica Nativa**:
  - Asegurar que la pantalla de bloqueo facial o huella digital (`MobileBiometricGate`) se sincronice limpiamente con los ajustes de seguridad del dispositivo Android.

### v2.0.0-Android: Distribución y Preparación de Producción
*Objetivo: Empaquetar y firmar digitalmente la app para distribución pública en Android.*

- **Configuración de Gradle & SDKs**:
  - Ajustar `minSdkVersion` y `targetSdkVersion` en la configuración del build de Tauri para cumplir con las directivas actuales de Google Play Store.
- **Generación de AAB y APK firmados**:
  - Documentar la creación del archivo de llaves `keystore.jks` y las variables de entorno de firma de compilación.
  - Habilitar compresión Proguard/R8 para optimizar el peso final del paquete de la app.
