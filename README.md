# JiraCsvToGoogleCalendar

Herramienta web para convertir exportaciones CSV de Jira a eventos de Google Calendar, con filtros, gráficos y descarga directa.

---

## ¿Qué hace?

- Convierte el CSV exportado de Jira en un archivo listo para importar en Google Calendar
- Detecta automáticamente las columnas en español e inglés (incluyendo campos personalizados como `Campo personalizado (Start date)`)
- Permite filtrar tareas antes de exportar (proyecto, estado, prioridad, persona asignada, rango de fechas)
- Muestra gráficos de distribución y un timeline Gantt de las tareas
- Soporta exportación en un solo archivo o separado por proyecto / estado
- Tema claro y oscuro

---

## Paso a paso

### 1. Exportar desde Jira

1. Ve a tu proyecto en Jira y abre la vista de **Lista** o **Backlog**
2. Aplica los filtros que necesites (sprint, épica, asignado, etc.)
3. Haz clic en **Exportar → Exportar a CSV**
4. Selecciona **"Todos los campos"** para asegurarte de incluir las fechas personalizadas (`Start date`, `Fecha de vencimiento`)
5. Descarga el archivo `.csv` generado

> **Nota:** Si tu Jira está en español, las fechas vendrán en formato `DD/MMM/AA` (ej. `25/feb/26 12:00 AM`). La herramienta las reconoce automáticamente.

---

### 2. Abrir la herramienta

Abre el archivo `index.html` directamente en tu navegador (no requiere servidor ni instalación).

---

### 3. Cargar el CSV

- Arrastra el archivo CSV al área de carga, o haz clic en **"Seleccionar archivo"**
- La herramienta detecta las columnas automáticamente y muestra un resumen

---

### 4. Revisar y filtrar (opcional)

En la pestaña **Filtros** puedes acotar los resultados por:

| Filtro | Descripción |
|---|---|
| Proyecto(s) | Selección múltiple |
| Estado(s) | Ej. En curso, Tareas por hacer, Hecho |
| Persona asignada | Selección múltiple |
| Prioridad | High, Medium, Low… |
| Rango de fechas | Inicio desde/hasta, Fin desde/hasta |
| Solo con fechas | Todas / Con inicio y fin / Con al menos una / Sin fechas |
| Búsqueda | Texto libre sobre clave o resumen |

Haz clic en **"Aplicar filtros"** para actualizar la vista. Los filtros se guardan automáticamente en el navegador para la próxima sesión.

---

### 5. Revisar los resultados

- **Tabla resumen** — lista paginada con clave (link a Jira), título, fechas, estado, prioridad, proyecto y asignado
- **Gráficos** — distribución por proyecto, estado, prioridad y persona asignada + timeline Gantt
- Las tareas con fechas en formato no reconocido aparecen marcadas con ⚠

---

### 6. Configurar opciones (opcional)

En la pestaña **Opciones** puedes ajustar:

- **Formato del título**: `[CLAVE] Resumen` / Solo resumen / `[Proyecto - CLAVE] Resumen` / Solo clave
- **Contenido del evento**: incluir o excluir descripción, enlace a Jira, estado, prioridad y persona asignada
- **Tipo de evento**: todo el día (recomendado) o con hora
- **Cuando falta una fecha**: omitir la tarea / usar la fecha disponible para inicio y fin / usar la fecha de hoy

---

### 7. Descargar el CSV

En la pestaña **Exportar**:

| Botón | Resultado |
|---|---|
| Descargar todo en un CSV | Un archivo único con todos los eventos |
| Un CSV por proyecto | Un archivo por cada proyecto |
| Un CSV por estado | Un archivo por cada estado |

---

### 8. Importar a Google Calendar

1. Abre [Google Calendar](https://calendar.google.com)
2. Haz clic en ⚙️ → **Configuración**
3. En el menú izquierdo selecciona **Importar y exportar**
4. Sube el CSV descargado
5. Elige el calendario destino y haz clic en **Importar**

---

## Columnas que usa del CSV de Jira

| Campo | Columnas que detecta (en orden de prioridad) |
|---|---|
| Clave | `Clave de incidencia`, `Issue Key` |
| Resumen | `Resumen`, `Summary` |
| Estado | `Estado`, `Status` |
| Prioridad | `Prioridad`, `Priority` |
| Persona asignada | `Persona asignada`, `Assignee` |
| Proyecto | `Nombre del proyecto`, `Project Name` |
| Fecha inicio | `Campo personalizado (Start date)`, `Campo personalizado (Planned start)`, `Start date` |
| Fecha fin | `Fecha de vencimiento`, `Due Date`, `Campo personalizado (Planned end)` |
| Descripción | `Descripción`, `Description` |

---

## Tecnologías

- HTML / CSS / JavaScript vanilla
- [PapaParse](https://www.papaparse.com/) — parsing de CSV
- [Chart.js](https://www.chartjs.org/) — gráficos
- Sin dependencias de servidor, sin build tools
