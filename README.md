# 📊 Dashboard de Asistencia — Iglesia

Dashboard web para visualizar y dar seguimiento a la asistencia de los miembros de una iglesia a **célula** y **servicio**, a partir de un reporte en Excel. Todo el procesamiento ocurre en el navegador: no hay backend ni base de datos, solo HTML, CSS y JavaScript puro (vanilla JS, ES6).

## ✨ Características principales

- **Carga de archivos Excel** (`.xlsx`, `.xlsm`) con parseo automático de la estructura del reporte (grupos ministeriales, asistencia a célula/servicio, nuevos integrantes, excluidos).
- **KPIs en tiempo real**: totales y porcentajes de asistencia a célula, servicio, ambos, inasistencia total y nuevos ingresos.
- **Gráficos interactivos** (Chart.js): dona general, funnel, rankings por grupo (top/bottom), barras agrupadas y barras apiladas.
- **Tablas filtrables y con búsqueda**: personas, excluidos, nuevos, histórico y un módulo dedicado de **ausencias prolongadas** con niveles de alerta.
- **Filtros globales**: por grupo ministerial, estado, célula, servicio y condición de "nuevo".
- **Modo claro/oscuro** persistente, con paleta adaptada para gráficos y tablas.
- **Sincronización en vivo con Google Sheets** (modo lectura, vía CSV publicado).
- **Historial de reportes en GitHub**: listar, cargar y subir archivos Excel directamente desde/hacia un repositorio de GitHub usando un token personal de acceso (PAT).

## 🗂️ Estructura del proyecto

```
.
├── index.html   # Estructura de la interfaz (topbar, modales, KPIs, gráficos, tablas)
├── style.css    # Estilos, temas claro/oscuro, animaciones y responsive
└── app.js       # Toda la lógica de la aplicación (módulos ES6)
```

No requiere instalación ni build: basta con abrir `index.html` en un navegador o servirlo con cualquier servidor estático.

## 🧩 Dependencias (vía CDN)

| Librería | Uso |
|---|---|
| [Bootstrap 5](https://getbootstrap.com/) | Layout, modales, offcanvas, componentes UI |
| [Bootstrap Icons](https://icons.getbootstrap.com/) | Iconografía |
| [Chart.js 4](https://www.chartjs.org/) | Gráficos (dona, barras, funnel) |
| [SheetJS (xlsx)](https://sheetjs.com/) | Lectura/escritura de archivos Excel en el navegador |
| Google Fonts (Bebas Neue + Outfit) | Tipografía |

No hay `package.json` ni dependencias de Node: todo se carga desde `cdnjs.cloudflare.com` y `fonts.googleapis.com`.

## 🏗️ Arquitectura de `app.js`

El código está organizado en **módulos (objetos) independientes**, cada uno con una responsabilidad clara:

| Módulo | Responsabilidad |
|---|---|
| `DataStore` | Estado centralizado: datos crudos por hoja, filtros activos, metadatos del archivo |
| `ExcelParser` | Lee el workbook de SheetJS y normaliza cada hoja en registros de JS |
| `KPIEngine` | Calcula todos los indicadores (totales, porcentajes, agregados por grupo) |
| `ChartEngine` | Crea y actualiza las instancias de Chart.js |
| `TableEngine` | Renderiza y filtra las tablas de personas/excluidos/nuevos/histórico |
| `FilterEngine` | Popula los `<select>` de filtros y lee/resetea su estado |
| `UIController` | Orquesta la carga de archivos y coordina el refresco general de la UI |
| `AbsenceEngine` | Calcula días de ausencia y asigna niveles de alerta (ver abajo) |
| `GSheetsEngine` | Sincronización en vivo desde una hoja de Google Sheets publicada |
| `ThemeEngine` | Alterna y persiste el tema claro/oscuro |
| `HistoryEngine` | Lista y carga reportes históricos desde un repositorio de GitHub |
| `AuthEngine` | Gestiona el Personal Access Token de GitHub (guardado local, aviso de caducidad) |
| `CloudEngine` | Sube el archivo Excel actual al repositorio de GitHub |

Toda la app arranca en un único listener `DOMContentLoaded` que inicializa estos módulos en orden.

## 📥 Formato esperado del Excel

`ExcelParser` espera un workbook con una hoja principal y, opcionalmente, hojas adicionales detectadas por nombre (coincidencia parcial, insensible a mayúsculas):

- **Hoja principal**: la primera hoja que no coincida con los nombres especiales. Sus filas representan personas agrupadas bajo encabezados de grupo ministerial (texto en la columna A sin numeración).
- **`Excluidos`**: personas excluidas del conteo general.
- **`NUEVO EX`**: nuevos ingresos marcados explícitamente.
- **`ANTIGUO EX`**: registro histórico simplificado (nombre + estado + fecha).

Columnas de la hoja principal (0-indexed):

| Columna | Campo | Valores esperados |
|---|---|---|
| A | N° | Numérico, identifica fila de datos |
| B | Nombre | Texto |
| C | Célula | `SI`, `NO`, `NUEVO` |
| D | Servicio | `SI`, `NO` |
| E | Estado | tipo de miembro; `NUEVO` indica nuevo en célula |
| F | Fecha última falta | fecha o serial de Excel |

> Una persona se considera **nueva en célula** si la columna Estado (E) es `NUEVO`, y **nueva en servicio** si la columna Célula (C) es `NUEVO`. Estas dos condiciones son independientes entre sí.

## 🚦 Niveles de alerta por ausencia

`AbsenceEngine` solo procesa personas con fecha de última falta registrada, calculando los días transcurridos hasta hoy:

| Nivel | Rango de días | Significado |
|---|---|---|
| 🟢 Normal | 0–6 | Menos de una semana |
| 🟡 Seguimiento | 7–13 | 1–2 semanas |
| 🟠 Advertencia | 14–27 | 2–4 semanas |
| 🔴 Crítico | 28+ | Más de un mes |

La tabla de ausencias se ordena con los casos críticos primero y permite filtrar por nivel y por texto de búsqueda.

## 🔄 Sincronización con Google Sheets

`GSheetsEngine` permite conectar una hoja de cálculo **publicada en la web** (Archivo → Publicar en la web → CSV) o una URL normal de edición (se convierte automáticamente al endpoint de exportación CSV). La descarga pasa por un proxy CORS público (`corsproxy.io`) para evitar bloqueos del navegador, y se reparsea con el mismo motor que un archivo local. Se puede configurar un intervalo de auto-sincronización o sincronizar manualmente.

## ☁️ Historial y subida a GitHub

- **`HistoryEngine`** consulta la API de contenidos de GitHub (`GET /repos/.../contents/REPORTES`) para listar los archivos Excel disponibles en la carpeta `REPORTES` del repositorio configurado, y permite cargarlos directamente al dashboard.
- **`CloudEngine`** permite subir el archivo Excel actualmente cargado a esa misma carpeta mediante `PUT /repos/.../contents/REPORTES/<archivo>` (crea o actualiza según exista o no el archivo).
- **`AuthEngine`** gestiona un **Personal Access Token (PAT)** de GitHub, guardado en `localStorage` del navegador, necesario para subir archivos o consultar el historial sin límites estrictos de la API pública. Avisa cuando el token está próximo a cumplir un año desde que fue guardado.

> ⚠️ El repositorio y la ruta están actualmente fijados en el código (`HistoryEngine.GITHUB_API` y `CloudEngine.GITHUB_UPLOAD_BASE`). Para usar este dashboard con otro repositorio, hay que editar esas constantes en `app.js`.

## 🎨 Temas

`ThemeEngine` alterna entre tema oscuro (por defecto) y claro aplicando el atributo `data-theme` sobre `<html>`, persistiendo la preferencia y ajustando los colores por defecto de Chart.js para que los ejes y leyendas se adapten automáticamente.

## 🚀 Uso rápido

1. Abrir `index.html` en el navegador (o servirlo con un servidor estático).
2. Cargar un archivo Excel con el botón de carga, o conectar una hoja de Google Sheets, o cargar un reporte desde el historial de GitHub.
3. Explorar los KPIs, gráficos y tablas; aplicar filtros según grupo, célula, servicio o estado de "nuevo".
4. Revisar la pestaña de **Ausencias** para identificar personas en seguimiento o estado crítico.
5. (Opcional) Configurar un token de GitHub para subir el reporte actual al historial en la nube.

## 🔮 Extensibilidad

El propio código deja indicado cómo extender cada parte (comentario final de `app.js`):

- **Nuevo KPI**: calcularlo en `KPIEngine.compute()`, añadir su card en `index.html` y mostrarlo en `UIController.updateKPICards()`.
- **Nuevo gráfico**: añadir el `<canvas>` en `index.html`, crear `ChartEngine.renderMiGrafico(kpis)` y llamarlo desde `ChartEngine.renderAll()`.
- **Nueva hoja de Excel**: añadir `ExcelParser.parseMiHoja(ws)`, registrarla en `ExcelParser.parse()`, guardarla en `DataStore` y renderizarla con un nuevo método de `TableEngine`.
- **Nuevo filtro**: `DataStore.filters` puede extenderse con nuevas claves sin romper el código existente, ya que `applyFilters()` solo usa las claves definidas en ese objeto.

## 📄 Licencia

No especificada. Agrega aquí la licencia que corresponda a tu proyecto (por ejemplo, MIT) si planeas distribuirlo públicamente.
