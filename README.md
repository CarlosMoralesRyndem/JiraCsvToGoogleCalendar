# JiraCsvToGoogleCalendar

Herramienta web para convertir tareas de Jira en eventos de Google Calendar.
Soporta dos modos de carga: **CSV exportado desde Jira** o **conexión directa a la API de Jira**.

---

## Cómo ejecutar

> **Siempre usa `iniciar.bat` para abrir la herramienta.** Esto aplica tanto para el modo CSV como para el modo API.

1. Haz doble clic en **`iniciar.bat`**
2. El script automáticamente:
   - Verifica que [Node.js](https://nodejs.org/) esté instalado (requerido)
   - Libera el puerto 3000 si estaba ocupado
   - Instala las dependencias la primera vez (`npm install`)
   - Levanta el servidor local en `http://localhost:3000`
   - Abre el navegador apuntando a esa URL
3. Para cerrar, cierra la ventana del terminal o presiona `Ctrl+C`

> El servidor actúa como proxy hacia la API de Jira para evitar bloqueos CORS. Las credenciales nunca salen de tu máquina local.

---

## Modos de uso

Una vez abierta la herramienta, elige el modo desde la pantalla de inicio:

| Modo | Cuándo usarlo |
|---|---|
| **CSV** | Tienes un archivo exportado desde Jira |
| **Jira API** | Quieres consultar tareas en tiempo real con JQL |

---

## Paso a paso — Modo CSV

### 1. Exportar desde Jira

1. Ve a tu proyecto en Jira → vista **Lista** o **Backlog**
2. Aplica los filtros que necesites (sprint, épica, asignado, etc.)
3. Haz clic en **Exportar → Exportar a CSV**
4. Selecciona **"Todos los campos"** para incluir las fechas personalizadas
5. Descarga el archivo `.csv` generado

> Si tu Jira está en español, las fechas vendrán en formato `DD/MMM/AA` (ej. `25/feb/26 12:00 AM`). La herramienta las reconoce automáticamente.

### 2. Cargar el CSV

- En la pantalla de inicio selecciona **"Cargar CSV"**
- Arrastra el archivo al área de carga o haz clic en **"Seleccionar archivo"**
- La herramienta detecta las columnas automáticamente

---

## Paso a paso — Modo API

### 1. Obtener un API Token de Jira

1. Ve a [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Haz clic en **"Crear token de API"**
3. Dale un nombre descriptivo (ej. `jira-calendar-tool`) y copia el token generado

### 2. Conectar desde la herramienta

1. En la pantalla de inicio selecciona **"Conectar con Jira API"**
2. Completa los campos:

| Campo | Ejemplo |
|---|---|
| URL de Jira | `https://tu-empresa.atlassian.net` |
| Email | `tu@correo.com` |
| API Token | El token generado en el paso anterior |
| JQL | `project = PESS ORDER BY "cf[10015]" ASC` |

3. Haz clic en **"Conectar y cargar"**
4. El mensaje de estado mostrará cuántas tareas se cargaron y qué campos de fecha se detectaron:
   ```
   ✅ 7 tarea(s) cargadas — inicio: 7/7 [customfield_10015] · fin: 7/7 [duedate (built-in)]
   ```

### 3. Re-consultar con otro JQL

Una vez cargados los datos, aparece una barra con el JQL activo.
Edítalo y presiona **"Actualizar"** para hacer una nueva consulta sin volver al inicio.

---

## Filtros

El panel de filtros tiene tres secciones:

### Búsqueda rápida
| Filtro | Descripción |
|---|---|
| Buscar | Texto libre sobre clave o resumen |
| Solo con fechas | Todas / Con inicio y fin / Con al menos una / Sin fechas |

### Categorías
| Filtro | Descripción |
|---|---|
| Proyecto(s) | Selección múltiple |
| Estado(s) | Ej. En curso, Tareas por hacer, Hecho |
| Persona asignada | Selección múltiple |
| Prioridad | High, Medium, Low… |

### Rango de fechas
| Filtro | Descripción |
|---|---|
| Inicio desde / hasta | Filtra por fecha de inicio |
| Fin desde / hasta | Filtra por fecha de vencimiento |

Haz clic en **"Aplicar filtros"** para actualizar la vista.
Los filtros se guardan en el navegador y se restauran automáticamente en la próxima sesión.

---

## Resultados

### Tabla resumen

Lista paginada con:
- Clave (enlace directo a Jira), título, fecha inicio, fecha fin
- Estado, prioridad, proyecto y persona asignada
- Indicador ⚠ para fechas en formato no reconocido

### Gráficos y Timeline

La pestaña **Gráficos** incluye:

- **Distribución por proyecto** (dona)
- **Distribución por estado** (barras)
- **Distribución por prioridad** (dona con colores semánticos)
- **Top 8 asignados** (barras)
- **Timeline Gantt** — barras horizontales por fecha de inicio y fin, coloreadas por proyecto

#### Toggles de proyecto en el Gantt

Encima del Gantt aparece un chip por cada proyecto con su color y conteo de tareas.
Haz clic en un chip para **ocultar** ese proyecto del timeline; haz clic de nuevo para **mostrarlo**.
Los colores se mantienen estables aunque cambies los filtros.

---

## Opciones de exportación

En la pestaña **Opciones** puedes configurar:

| Opción | Valores disponibles |
|---|---|
| Formato del título | `[CLAVE] Resumen` / Solo resumen / `[Proyecto - CLAVE] Resumen` / Solo clave |
| Descripción | Incluir / Excluir |
| Enlace a Jira | Incluir / Excluir |
| Estado / Prioridad / Asignado | Incluir / Excluir |
| Tipo de evento | Todo el día (recomendado) / Con hora |
| Cuando falta una fecha | Omitir tarea / Usar la fecha disponible / Usar la fecha de hoy |

> El default de **"Cuando falta una fecha"** es **"Usar la fecha disponible"**, igual que el modo CSV, para no perder tareas que solo tienen fecha de fin.

---

## Descargar el CSV de Calendar

En la pestaña **Exportar**:

| Botón | Resultado |
|---|---|
| Descargar todo en un CSV | Un archivo único con todos los eventos |
| Un CSV por proyecto | Un archivo `.csv` por cada proyecto |
| Un CSV por estado | Un archivo `.csv` por cada estado |

---

## Importar a Google Calendar

1. Abre [Google Calendar](https://calendar.google.com)
2. Haz clic en ⚙️ → **Configuración**
3. En el menú izquierdo selecciona **Importar y exportar**
4. Sube el CSV descargado
5. Elige el calendario destino y haz clic en **Importar**

---

## Columnas que detecta del CSV de Jira

| Campo | Columnas detectadas (en orden de prioridad) |
|---|---|
| Clave | `Clave de incidencia`, `Issue Key`, `Key` |
| Resumen | `Resumen`, `Summary` |
| Estado | `Estado`, `Status` |
| Prioridad | `Prioridad`, `Priority` |
| Persona asignada | `Persona asignada`, `Assignee` |
| Proyecto | `Nombre del proyecto`, `Project Name`, `Proyecto` |
| Fecha inicio | `Campo personalizado (Start date)`, `Campo personalizado (Planned start)`, `Start date`, `Fecha de inicio` |
| Fecha fin | `Fecha de vencimiento`, `Due Date`, `Campo personalizado (Planned end)`, `Campo personalizado (End Date)` |
| Descripción | `Descripción`, `Description` |

---

## Campos que solicita a la API de Jira

Además de los campos estándar (`summary`, `status`, `priority`, `assignee`, `project`, `description`, `duedate`), la herramienta:

- Detecta automáticamente campos personalizados de fecha de inicio y fin consultando `/rest/api/3/field`
- Siempre solicita `customfield_10015` (campo estándar de "Start date" en Jira Plans / Timeline)
- Muestra en el mensaje de estado qué campo ID se usó para inicio y fin

---

## Tecnologías

- HTML / CSS / JavaScript vanilla (frontend)
- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) (proxy local para API Jira — solo modo API)
- [PapaParse](https://www.papaparse.com/) — parsing de CSV
- [Chart.js](https://www.chartjs.org/) — gráficos y timeline
- Sin frameworks, sin build tools, sin dependencias en el cliente
