# Documentación Completa — Electoral Dashboard

> Plataforma de análisis de elecciones presidenciales de Estados Unidos (2016, 2020, 2024) correlacionada con datos demográficos, económicos, educativos y religiosos a nivel condado.

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Árbol de Archivos Completo](#3-árbol-de-archivos-completo)
4. [El Viaje del Dato: CSV → Pantalla](#4-el-viaje-del-dato-csv--pantalla)
5. [Esquema de Base de Datos Relacional](#5-esquema-de-base-de-datos-relacional)
6. [Query de Cada Gráfica](#6-query-de-cada-gráfica)
7. [Descripción Detallada de Cada Archivo](#7-descripción-detallada-de-cada-archivo)

---

## 1. Visión General

El proyecto es una aplicación web full-stack que permite explorar y analizar los resultados de las elecciones presidenciales de EE.UU. para los años 2016, 2020 y 2024. El análisis abarca más de **3,100 condados** y cruza los resultados electorales con más de **40 indicadores demográficos**, económicos, educativos y religiosos.

### Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL 16 |
| ORM / acceso asíncrono | SQLAlchemy 2.0 + asyncpg |
| Backend API | FastAPI (Python) |
| IA / NLQ | Groq LLM (llama-3.3-70b) |
| Frontend | React 18 + Recharts + React Router |
| Estado global (frontend) | Zustand |
| Build frontend | Vite |
| HTTP cliente | Axios |
| Limpieza de datos | Python + Pandas (Jupyter Notebook) |
| ETL (carga) | Python + psycopg2 |
| Contenedores | Docker + Docker Compose |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIO                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP :80
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND  (Nginx + React SPA)                  │
│  pages/       → vistas completas por tema                   │
│  components/  → gráficas reutilizables (Recharts)           │
│  services/    → clientes Axios hacia /api/*                 │
│  store/       → estado global (Zustand)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ proxy /api/* → :8000
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND  (FastAPI + uvicorn)                   │
│  routers/     → endpoints REST                              │
│  services/    → lógica de negocio + queries SQL             │
│  models/      → ORM SQLAlchemy                              │
│  schemas/     → validación Pydantic                         │
│  nlq/         → motor de consulta en lenguaje natural       │
└─────────────────────────┬───────────────────────────────────┘
                          │ asyncpg (async)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              BASE DE DATOS  (PostgreSQL 16)                 │
│  Tablas staging  → datos crudos temporales                  │
│  Dimensiones     → catálogos estables                       │
│  Hechos          → métricas y resultados                    │
│  Vistas          → consultas precomputadas                  │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ psycopg2 (sync, one-shot)
┌─────────────────────────┴───────────────────────────────────┐
│              ETL  (Python: load.py)                         │
│  Lee CSVs limpios → inserta en PostgreSQL                   │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ Pandas
┌─────────────────────────┴───────────────────────────────────┐
│              LIMPIEZA  (data_cleaning.ipynb)                │
│  Lee CSVs crudos → limpia → guarda en datasets/cleaned/     │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────┴───────────────────────────────────┐
│              DATOS CRUDOS  (backend/datasets/*.csv)         │
│  elections_data.csv · DemographicsData.csv                  │
│  PopulationDensityData.csv · education.csv · religion_data.csv │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Árbol de Archivos Completo

```
elections_data_ver2/
│
├── db.sql                          DDL completo de PostgreSQL (488 líneas)
├── docker-compose.yml              Orquestación: db, init, backend, frontend
├── data_cleaning.ipynb             Notebook de limpieza de los 5 CSVs
├── package.json                    Scripts de desarrollo del monorepo
├── .env                            GROQ_API_KEY y configuración local
├── .env.example                    Plantilla de variables de entorno
│
├── backend/
│   ├── main.py                     Punto de entrada para uvicorn
│   ├── Dockerfile                  Imagen Python del backend
│   ├── requirements.txt            Dependencias Python
│   │
│   ├── app/
│   │   ├── main.py                 Inicialización FastAPI + CORS + routers
│   │   ├── config.py               Settings con Pydantic (DATABASE_URL, GROQ_API_KEY)
│   │   ├── database.py             Engine async SQLAlchemy + función get_db
│   │   │
│   │   ├── models/
│   │   │   ├── dimensions.py       ORM: DimState, DimCounty, DimElection,
│   │   │   │                           DimParty, DimCandidate, DimIndicator,
│   │   │   │                           DimEducationLevel, DimReligiousGroup
│   │   │   └── facts.py            ORM: FactCountyCandidateVotes,
│   │   │                               FactCountyElectionSummary,
│   │   │                               FactCountyElectionWinnerHistory,
│   │   │                               FactCountyMetric, FactCountyEducation,
│   │   │                               FactCountyUrbanClass, FactCountyReligion
│   │   │
│   │   ├── schemas/
│   │   │   ├── elections.py        Pydantic: ElectionOut, CountyElectionSummaryOut
│   │   │   ├── counties.py         Pydantic: StateOut, CountyOut, CountyDetailOut
│   │   │   └── demographics.py     Pydantic: UrbanClassOut, MetricOut
│   │   │
│   │   ├── routers/
│   │   │   ├── elections.py        GET /api/elections/*
│   │   │   ├── counties.py         GET /api/counties/*
│   │   │   ├── states.py           GET /api/states/*
│   │   │   ├── analytics.py        GET /api/analytics/*
│   │   │   ├── dashboard.py        GET /api/dashboard/*
│   │   │   ├── chat_query.py       POST /api/chat/query  (NLQ con Groq)
│   │   │   └── standard_query.py   GET /api/standard-query/schema
│   │   │                           POST /api/standard-query/execute
│   │   │
│   │   └── services/
│   │       ├── election_service.py     Resultados, historial, swing counties
│   │       ├── county_service.py       Búsqueda, detalle, estado
│   │       ├── analytics_service.py    Demografía, educación, religión, ingresos
│   │       ├── dashboard_service.py    KPIs nacionales, mapa, tendencias
│   │       │
│   │       └── nlq/                    Motor de lenguaje natural
│   │           ├── llm_parser.py       Groq LLM → JSON estructurado
│   │           ├── query_builder.py    JSON → SQL
│   │           ├── executor.py         Ejecuta la query segura
│   │           ├── validator.py        Whitelist + validación FIPS
│   │           ├── schema.py           Modelos Pydantic del query estructurado
│   │           └── aliases.py          Normalización de nombres de condado
│   │
│   ├── etl/
│   │   ├── load.py                 Cargador principal CSV → PostgreSQL
│   │   └── init.sh                 Script de inicialización ETL en Docker
│   │
│   └── datasets/
│       ├── elections_data.csv          Resultados 2024 + ganadores 2020/2016
│       ├── DemographicsData.csv        43 indicadores demográficos por condado
│       ├── PopulationDensityData.csv   Población, área, densidad (Censo 2020)
│       ├── education.csv               Nivel educativo por condado (1970–2019)
│       ├── religion_data.csv           Congregaciones y feligreses por condado
│       └── cleaned/                    CSVs procesados por el notebook
│           ├── elections_clean.csv
│           ├── demographics_clean.csv
│           ├── population_density_clean.csv
│           ├── urban_class_clean.csv
│           ├── education_clean.csv
│           └── religion_clean.csv
│
└── frontend/
    ├── Dockerfile                  Build React → imagen Nginx
    ├── nginx.conf                  Proxy /api/* → backend:8000
    ├── vite.config.js              Configuración Vite + proxy dev
    ├── index.html                  Raíz HTML del SPA
    ├── package.json                Dependencias Node
    │
    └── src/
        ├── App.jsx                 Definición de rutas (React Router)
        ├── main.jsx                Punto de entrada React
        │
        ├── pages/
        │   ├── Dashboard.jsx       Mapa coroplético + KPI + tendencias
        │   ├── CountyDetail.jsx    Detalle de un condado
        │   ├── Analytics.jsx       Religión, educación, demografía
        │   ├── Economic.jsx        Ingreso, vivienda, estrés económico
        │   ├── Education.jsx       Tendencias educativas + correlación
        │   ├── Ethnic.jsx          Análisis étnico por condado
        │   ├── SmartQuery.jsx      Chatbot NLQ con Groq
        │   ├── StandardQuery.jsx   Editor SQL raw
        │   └── ElectionResults.jsx Resultados electorales detallados
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Layout.jsx      Wrapper con Header + Sidebar
        │   │   ├── Header.jsx      Barra superior
        │   │   └── Sidebar.jsx     Menú de navegación lateral
        │   │
        │   ├── charts/
        │   │   ├── StateMap.jsx                Mapa coroplético estatal
        │   │   ├── ElectionMap.jsx             Mapa coroplético por condado
        │   │   ├── TrendLineChart.jsx          Línea temporal 2016/2020/2024
        │   │   ├── VoteBarChart.jsx            Barras de votos por candidato
        │   │   ├── DemographicsChart.jsx       Pie/barras demográficas
        │   │   ├── EconomicStressChart.jsx     Score de estrés económico
        │   │   ├── HousingAffordabilityChart.jsx  Ratio vivienda/ingreso
        │   │   ├── IncomeCompetitivenessChart.jsx Ingreso vs competitividad
        │   │   ├── IncomePopulationChart.jsx   Ingreso vs población
        │   │   ├── IncomeQuintileChart.jsx     Distribución por quintil
        │   │   ├── IncomeSegmentChart.jsx      Segmentos bajo/medio/alto
        │   │   ├── InequalityProxyChart.jsx    Proxy de desigualdad
        │   │   └── PersuasionViolinChart.jsx   Distribución por segmento
        │   │
        │   ├── dashboard/
        │   │   ├── KpiBar.jsx              Métricas nacionales
        │   │   ├── RightPanel.jsx          Panel lateral contextual
        │   │   ├── StateInfoPanel.jsx      Detalle de estado seleccionado
        │   │   ├── CountyInfoPanel.jsx     Detalle de condado seleccionado
        │   │   ├── CountyResultsTable.jsx  Tabla de resultados por condado
        │   │   ├── StateSummaryTable.jsx   Tabla resumen por estado
        │   │   ├── SwingTable.jsx          Tabla de condados que cambiaron partido
        │   │   └── TrendsPanel.jsx         Panel de tendencias multi-año
        │   │
        │   └── ui/
        │       ├── Badge.jsx       Etiquetas de color
        │       ├── FilterPanel.jsx Panel de filtros
        │       ├── Spinner.jsx     Indicador de carga
        │       ├── StatCard.jsx    Tarjeta de estadística
        │       └── Tabs.jsx        Navegación por pestañas
        │
        ├── services/
        │   ├── dashboardService.js     Axios: /api/dashboard/*
        │   ├── analyticsService.js     Axios: /api/analytics/*
        │   ├── chatQueryService.js     Axios: POST /api/chat/query
        │   └── standardQueryService.js Axios: /api/standard-query/*
        │
        └── store/
            └── useElectionsStore.js    Zustand: election, county, state seleccionados
```

---

## 4. El Viaje del Dato: CSV → Pantalla

Esta sección explica, paso a paso y archivo a archivo, cómo un número en un CSV termina siendo un punto en una gráfica.

---

### Paso 1 — Fuentes de Datos Crudos (`backend/datasets/`)

Existen 5 archivos CSV de origen:

#### `elections_data.csv` — 3,106 filas
Contiene los resultados de la elección presidencial 2024 más los ganadores de 2016 y 2020.

| Columna | Descripción |
|---|---|
| `OBJECTID` | ID interno del dataset GIS |
| `COUNTY_NAME` | Nombre del condado |
| `STATE_NAME` | Nombre del estado |
| `STATE_ABBR` | Abreviatura de 2 letras del estado |
| `FIPS` | Código FIPS de 5 dígitos del condado (identificador único nacional) |
| `Votes_Tot` | Total de votos emitidos en 2024 |
| `Votes_Trump` | Votos para Trump en 2024 |
| `Votes_Harris` | Votos para Harris en 2024 |
| `Votes_Stein` | Votos para Stein en 2024 |
| `Pct_Trump` | Porcentaje de votos para Trump (escala 0–1, se convierte a 0–100) |
| `Pct_Harris` | Porcentaje de votos para Harris |
| `Pct_Stein` | Porcentaje de votos para Stein |
| `Winner_2024` | Ganador de 2024 (nombre: "Trump" o "Harris") |
| `Winner_2020` | Ganador de 2020 (Biden o Trump) |
| `Winner_2016` | Ganador de 2016 (Clinton o Trump) |

#### `DemographicsData.csv` — 3,140 filas
43 columnas con datos del Censo ACS (American Community Survey) de 5 años a nivel condado.

| Categoría | Columnas |
|---|---|
| Edad | `Age_Pct_65_Older`, `Age_Pct_Under_18`, `Age_Pct_Under_5` |
| Educación | `Education_Bachelors_Degree_or_Higher`, `Education_High_School_or_Higher` |
| Empleo | `Employment_Nonemployer_Establishments`, `Employment_Firms_*` (7 columnas) |
| Etnias | `Ethnicities_White_Alone`, `Ethnicities_Black_Alone`, `Ethnicities_Hispanic_or_Latino`, `Ethnicities_Asian_Alone`, `Ethnicities_American_Indian_Alaska_Native_Alone`, `Ethnicities_Native_Hawaiian_Pacific_Islander_Alone`, `Ethnicities_Two_or_More_Races`, `Ethnicities_White_Alone_not_Hispanic_Latino` |
| Vivienda | `Housing_Homeownership_Rate`, `Housing_Households`, `Housing_Housing_Units`, `Housing_Median_Value_Owner_Occupied_Units`, `Housing_Persons_per_Household` |
| Ingreso | `Income_Median_Household_Income`, `Income_Per_Capita_Income` |
| Varios | `Misc_Foreign_Born`, `Misc_Land_Area`, `Misc_Mean_Travel_Time_Work`, `Misc_Percent_Female`, `Misc_Veterans`, + más |
| Población | `Population_2020`, `Population_2010`, `Population_per_Square_Mile` |
| Ventas | `Sales_Accommodation_Food_Services`, `Sales_Retail_Sales` |

**Problema clave:** Los valores suprimidos por el Censo aparecen como `-1`. Son reemplazados por `NaN` y luego imputados por mediana estatal, luego nacional.

#### `PopulationDensityData.csv` — 3,049 filas

| Columna | Descripción |
|---|---|
| `County` | Nombre del condado |
| `State` | Nombre del estado |
| `FIPS Code` | FIPS de 5 dígitos |
| `Population` | Población del Censo 2020 |
| `Area` | Área en millas cuadradas |
| `Density` | Densidad (personas/mi²) |

Nota: Alaska Unorganized Borough usa FIPS `02270` que requiere normalización especial.

#### `education.csv` — 3,284 filas
Formato ancho: nivel educativo por condado para 5 períodos históricos (1970, 1980, 1990, 2000, 2015-19) × 4 niveles (< HS, HS only, Some College, Bachelor+). También incluye clasificaciones urbano/rural de 2003 y 2013.

#### `religion_data.csv` — ~80,000 filas (formato largo)
Una fila por cada combinación (condado × grupo religioso). Más de 50 tradiciones religiosas.

| Columna | Descripción |
|---|---|
| `FIPS` | Código FIPS del condado |
| `State Name` | Nombre del estado |
| `County Name` | Nombre del condado |
| `Group Code` | Código del grupo religioso (e.g. "CATH", "EVAN") |
| `Group Name` | Nombre completo del grupo |
| `Congregations` | Número de congregaciones |
| `Adherents` | Número de feligreses |
| `Adherents % Total Adherents` | % del total de feligreses del condado |
| `Adherents % Total Population` | % de la población total del condado |

---

### Paso 2 — Limpieza de Datos (`data_cleaning.ipynb`)

El notebook Jupyter realiza transformaciones de calidad antes de que el ETL cargue los datos. Produce los 6 CSVs en `datasets/cleaned/`.

#### Elections (`elections_clean.csv`)
1. **FIPS padding**: `str(fips).zfill(5)` — asegura exactamente 5 dígitos.
2. **Escala de porcentajes**: columnas `Pct_*` estaban en escala 0–1; se multiplican por 100.
3. **Imputación de totales nulos**: si `Votes_Tot` es nulo, se recalcula como suma de los 3 candidatos.
4. **Cálculo de `margin_votes`**: `abs(votes_trump - votes_harris)`.
5. **Cálculo de `margin_pct`**: `abs(pct_trump - pct_harris)`.
6. **Cálculo de `competitiveness_score`**: `100 - margin_pct`. Un valor de 100 significa empate perfecto; 0 significa resultado unilateral.
7. **Inferencia del ganador**: si `Winner_2024` es nulo, se deduce del candidato con mayor porcentaje.

#### Demographics (`demographics_clean.csv`)
1. **Renombrado de columnas**: snake_case estandarizado.
2. **Sentinela -1**: reemplazado por `NaN`.
3. **Imputación**: mediana por estado → luego mediana nacional.
4. **Normalización de nombre de condado**: se eliminan sufijos como "County", "Parish", "Borough", etc. para facilitar el join con el CSV de elecciones.

#### Education (`education_clean.csv` + `urban_class_clean.csv`)
1. **Filtro de filas de estado/nación**: se descartan las filas con FIPS que termina en `000` (resúmenes de estado o nación).
2. **Separación**: las columnas de clasificación urbano/rural se extraen a `urban_class_clean.csv`.
3. **Reshape wide→long**: las columnas de año se transforman en filas con columnas `period`, `level_code`, `adults_count`, `adults_pct`.
4. **Interpolación temporal**: para pares (fips, level_code) con valores faltantes en algún año, se interpola linealmente entre los años conocidos.
5. **Imputación**: mediana por grupo para datos restantes.

#### Population Density (`population_density_clean.csv`)
1. **FIPS normalizado**: cero-padding a 5 dígitos.
2. **Densidad recalculada**: `population / area` para consistencia.
3. **Log-densidad**: `ln(1 + density)` para reducir asimetría en visualizaciones.

#### Religion (`religion_clean.csv`)
1. **Filtro de FIPS inválidos**: se descartan filas con FIPS no numérico.
2. **Strip del símbolo %**: columnas de porcentaje vienen con el carácter `%`; se convierte a float.
3. **Imputación de adherentes**: cero no implica que no hay feligreses (puede ser privacidad del Censo); se imputa por (group_code, estado) → luego (group_code) → luego `1 × congregaciones` como piso.
4. **Recálculo de porcentajes**: tras la imputación, se recalculan `pct_total_adherents` y `pct_total_population`.
5. **Codificación**: normalización latin-1 → ASCII para caracteres especiales en nombres de grupos.

---

### Paso 3 — ETL: Carga en Base de Datos (`backend/etl/load.py`)

El ETL es un script Python síncrono que corre **una sola vez** al iniciar el contenedor Docker. Usa `psycopg2` (no el ORM) para velocidad en inserción masiva.

**Orden de ejecución en `main()`:**

```
1.  Lee los 6 CSVs limpios con Pandas
2.  Conecta a PostgreSQL (psycopg2, no async)
3.  load_states()          → INSERT dim_state
4.  load_counties()        → INSERT dim_county  (retorna set de FIPS conocidos)
5.  load_elections_2024()  → INSERT fact_county_candidate_votes
                            → INSERT fact_county_election_summary
6.  load_winner_history()  → INSERT dim_candidate (Biden, Clinton)
                            → INSERT fact_county_election_winner_history
7.  load_indicators()      → INSERT dim_indicator (40+ indicadores)
8.  load_demographics()    → INSERT fact_county_metric (demografía)
9.  load_pop_density()     → INSERT fact_county_metric (densidad)
10. load_urban_class()     → INSERT fact_county_urban_class
11. load_education()       → INSERT fact_county_education
12. load_religion()        → INSERT dim_religious_group
                            → INSERT fact_county_religion
13. run_test_queries()     → 10 queries de validación
```

**Técnicas clave del ETL:**

- `execute_values(cur, sql, rows, page_size=2000)`: inserta 2,000 filas por batch, mucho más rápido que INSERT por fila.
- `ON CONFLICT DO NOTHING`: hace el ETL idempotente — se puede re-ejecutar sin duplicar datos.
- `known_fips`: es un `set` de los FIPS que existen en `dim_county`. Todas las tablas de hechos verifican contra este set antes de insertar para garantizar integridad referencial sin depender de excepciones de FK.
- `pnone(x)`: convierte `pd.NA`, `np.nan` y `None` a `None` de Python antes de enviar a psycopg2.

---

### Paso 4 — Base de Datos (`db.sql` + PostgreSQL)

El esquema vive en `db.sql`. Se ejecuta automáticamente en el primer arranque del contenedor `db` (PostgreSQL lo ejecuta desde `/docker-entrypoint-initdb.d/`).

Habilita la extensión `pg_trgm` para búsqueda de texto aproximada:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

El detalle completo del esquema está en la [Sección 5](#5-esquema-de-base-de-datos-relacional).

---

### Paso 5 — Backend API (`backend/app/`)

Cuando el frontend necesita datos para una gráfica, llama a un endpoint REST. El ciclo es:

```
Frontend (Axios GET)
   → Nginx proxy /api/* → FastAPI router
   → router llama a service.método()
   → service ejecuta SQL async (SQLAlchemy text() o select())
   → PostgreSQL retorna rows
   → service convierte rows a dicts
   → FastAPI serializa a JSON
   → Axios recibe la respuesta
   → React actualiza el estado
   → Recharts renderiza la gráfica
```

**Inyección de dependencia** (`app/database.py`): cada request recibe su propia sesión async:
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

Los services usan dos estilos de query:
- **ORM (SQLAlchemy select())**: para queries simples con JOINs directos sobre modelos.
- **Raw SQL (text())**: para queries con CTEs, NTILE, PERCENTILE_CONT, DISTINCT ON, funciones de ventana — casos donde el ORM sería más verboso o menos claro.

---

### Paso 6 — Frontend (`frontend/src/`)

**Ciclo de vida de un componente de gráfica:**

1. **El usuario navega** a una página (React Router monta el componente de página).
2. **`useEffect`** dispara la llamada al servicio Axios.
3. **El servicio** llama al endpoint `/api/...` con los parámetros necesarios (election_id, state, etc.).
4. **La respuesta JSON** llega como array de objetos.
5. **El estado local** del componente se actualiza con `useState`.
6. **Recharts** recibe el array como prop `data` y renderiza la gráfica.
7. Si el usuario selecciona un condado o estado, **Zustand** actualiza el store global y los paneles laterales se re-renderizan.

**El store de Zustand** (`store/useElectionsStore.js`):
```
selectedElection   → ID de la elección activa (por defecto: 2024)
selectedCounty     → FIPS del condado seleccionado en el mapa
selectedState      → abreviatura del estado seleccionado
```

---

## 5. Esquema de Base de Datos Relacional

El esquema sigue el patrón **Star Schema** (esquema estrella): tablas de dimensión en los bordes, tablas de hechos en el centro conectadas por foreign keys.

```
                    dim_state
                        │
                    dim_county ─────────────────────────┐
                        │                               │
          ┌─────────────┼──────────────────┐            │
          │             │                  │            │
fact_county_    fact_county_       fact_county_    fact_county_
candidate_votes election_summary   winner_history    metric
          │             │
     dim_candidate  dim_election
          │
      dim_party

                    dim_indicator ───── fact_county_metric

              dim_education_level ───── fact_county_education

              dim_religious_group ───── fact_county_religion

                                        fact_county_urban_class
```

---

### 5.1 Tablas de Staging (temporales, datos crudos)

Estas tablas reciben los datos tal como vienen de los CSVs, con todas las columnas como `VARCHAR`. Son usadas como buffer intermedio y se pueden truncar después de cada carga.

---

#### `stg_elections_raw`

Reflejo directo de `elections_data.csv`. Todas las columnas son VARCHAR para aceptar cualquier valor sin validación.

| Columna | Tipo | Descripción |
|---|---|---|
| `raw_id` | BIGINT (identity) | PK autogenerada |
| `objectid` | VARCHAR(30) | ID del sistema GIS de origen |
| `county_name` | VARCHAR(160) | Nombre del condado |
| `state_name` | VARCHAR(100) | Nombre completo del estado |
| `state_abbr` | VARCHAR(10) | Abreviatura del estado |
| `fips` | VARCHAR(20) | Código FIPS (puede venir sin padding) |
| `votes_tot` | VARCHAR(30) | Total de votos como texto |
| `votes_trump` | VARCHAR(30) | Votos Trump como texto |
| `votes_harris` | VARCHAR(30) | Votos Harris como texto |
| `votes_stein` | VARCHAR(30) | Votos Stein como texto |
| `pct_trump` | VARCHAR(30) | % Trump como texto |
| `pct_harris` | VARCHAR(30) | % Harris como texto |
| `pct_stein` | VARCHAR(30) | % Stein como texto |
| `winner_2024` | VARCHAR(120) | Nombre del ganador 2024 |
| `winner_2020` | VARCHAR(120) | Nombre del ganador 2020 |
| `winner_2016` | VARCHAR(120) | Nombre del ganador 2016 |
| `load_batch_id` | VARCHAR(80) | Identificador de la carga |
| `loaded_at` | TIMESTAMPTZ | Timestamp de inserción |

**Índices:** `fips`, `(state_abbr, county_name)`, GIN trigram sobre concatenación de nombres.

---

#### `stg_population_density_raw`

| Columna | Tipo | Descripción |
|---|---|---|
| `raw_id` | BIGINT (identity) | PK |
| `county` | VARCHAR(160) | Nombre del condado |
| `state` | VARCHAR(100) | Nombre del estado |
| `fips_code` | VARCHAR(20) | Código FIPS |
| `population` | VARCHAR(40) | Población como texto |
| `area` | VARCHAR(40) | Área en mi² como texto |
| `density` | VARCHAR(40) | Densidad como texto |
| `load_batch_id` | VARCHAR(80) | ID de la carga |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

---

#### `stg_demographics_raw`

43 columnas, todas VARCHAR. Reflejo de `DemographicsData.csv`. Columnas relevantes:

| Columna | Descripción |
|---|---|
| `county` / `state` | Identificadores geográficos |
| `age_pct_65_older`, `age_pct_under_18`, `age_pct_under_5` | Datos de edad |
| `education_bachelors_degree_or_higher`, `education_high_school_or_higher` | Educación ACS |
| `ethnicities_*` (8 columnas) | Porcentaje de cada grupo étnico |
| `housing_*` (5 columnas) | Indicadores de vivienda |
| `income_median_household_income`, `income_per_capita_income` | Ingresos |
| `misc_*` (8 columnas) | Misceláneos: extranjeros, idioma, viaje, veteranos, etc. |
| `population_2020`, `population_2010`, `population_per_square_mile` | Población |
| `sales_*` (2 columnas) | Ventas de alimentos y retail |
| `employment_firms_*` (7 columnas) | Firmas por tipo de propiedad |

---

#### `stg_education_raw`

Reflejo de `education.csv`. Estructura ancha con ~50 columnas.

| Columna | Descripción |
|---|---|
| `fips_code`, `state`, `area_name` | Identificadores |
| `rural_urban_code_2003`, `urban_influence_code_2003` | Clasificación urbana 2003 |
| `rural_urban_code_2013`, `urban_influence_code_2013` | Clasificación urbana 2013 |
| `city_suburb_town_rural_2013` | Categoría textual 2013 |
| `less_than_hs_count_1970` ... `bachelors_or_higher_pct_2015_19` | 40 columnas de conteo y % por año y nivel |

---

#### `stg_religion_raw`

| Columna | Tipo | Descripción |
|---|---|---|
| `raw_id` | BIGINT (identity) | PK |
| `fips` | VARCHAR(20) | Código FIPS del condado |
| `state_name` | VARCHAR(100) | Estado |
| `county_name` | VARCHAR(160) | Condado |
| `group_code` | VARCHAR(20) | Código del grupo religioso |
| `group_name` | VARCHAR(240) | Nombre completo del grupo |
| `congregations` | VARCHAR(40) | Número de congregaciones |
| `adherents` | VARCHAR(40) | Número de feligreses |
| `adherents_pct_total_adherents` | VARCHAR(40) | % del total de feligreses |
| `adherents_pct_total_population` | VARCHAR(40) | % de la población total |
| `load_batch_id` | VARCHAR(80) | ID de la carga |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

---

### 5.2 Tablas de Dimensión

Las dimensiones son catálogos estables que describen **quién, qué, dónde y cuándo**.

---

#### `dim_state` — 52 filas (50 estados + DC + Puerto Rico)

| Columna | Tipo | Descripción |
|---|---|---|
| `state_abbr` | CHAR(2) PK | Abreviatura oficial (e.g. "TX") |
| `state_name` | VARCHAR(100) UNIQUE | Nombre completo (e.g. "Texas") |
| `region` | VARCHAR(80) | Región del Censo (Northeast, South, Midwest, West) |
| `division` | VARCHAR(80) | División del Censo (más granular que región) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Auto-actualizado por trigger |

**Trigger:** `set_updated_at` — actualiza `updated_at` en cada UPDATE.

---

#### `dim_county` — ~3,100 filas

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) PK | Código FIPS de 5 dígitos (e.g. "48201" = Harris County, TX) |
| `state_abbr` | CHAR(2) FK→dim_state | Estado al que pertenece |
| `county_name` | VARCHAR(160) | Nombre del condado (e.g. "Harris County") |
| `county_type` | VARCHAR(60) | Tipo extraído del nombre ("County", "Parish", "Borough", etc.) |
| `county_search_text` | VARCHAR(320) | Texto para búsqueda: "Harris County, TX" |
| `latitude` | NUMERIC(10,7) | Latitud del centroide del condado |
| `longitude` | NUMERIC(10,7) | Longitud del centroide |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Auto-actualizado por trigger |

**Índices:** `(state_abbr)`, GIN trigram sobre `county_name` para búsqueda rápida aproximada.

**Restricción UNIQUE:** `(state_abbr, county_name)` — no puede haber dos condados con el mismo nombre en el mismo estado.

---

#### `county_alias` — tabla de mapeo de nombres

Resuelve el problema de que distintos CSV usan nombres ligeramente distintos para el mismo condado (e.g., "St. Louis" vs "Saint Louis").

| Columna | Tipo | Descripción |
|---|---|---|
| `alias_id` | BIGINT (identity) PK | PK |
| `fips` | CHAR(5) FK→dim_county | FIPS canónico resuelto |
| `source_file` | VARCHAR(120) | CSV de origen |
| `source_state_raw` | VARCHAR(100) | Nombre del estado tal como viene en el CSV |
| `source_county_name_raw` | VARCHAR(180) | Nombre del condado tal como viene en el CSV |
| `normalized_state` | VARCHAR(100) | Estado normalizado |
| `normalized_county_name` | VARCHAR(180) | Nombre normalizado |
| `match_method` | VARCHAR(20) CHECK | Método de resolución: `exact_fips`, `exact_state_county`, `alias`, `manual`, `unresolved` |
| `confidence_score` | NUMERIC(5,4) | Score de confianza del match (0–1) |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

#### `dim_election` — 3 filas

| Columna | Tipo | Descripción |
|---|---|---|
| `election_id` | SMALLINT (identity) PK | ID de la elección |
| `election_year` | SMALLINT | Año: 2016, 2020 o 2024 |
| `office` | VARCHAR(80) | Cargo: "President" |
| `election_type` | VARCHAR(60) | Tipo: "General" |
| `country` | VARCHAR(80) | País: "United States" |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Datos sembrados:**
- ID 1 → 2016 Presidential General
- ID 2 → 2020 Presidential General
- ID 3 → 2024 Presidential General

---

#### `dim_party` — 4 filas

| Columna | Tipo | Descripción |
|---|---|---|
| `party_id` | SMALLINT (identity) PK | ID del partido |
| `party_name` | VARCHAR(100) UNIQUE | Nombre completo |
| `party_code` | VARCHAR(30) UNIQUE | Código corto: REP, DEM, GRN, UNK |
| `ideology_label` | VARCHAR(80) | Etiqueta ideológica: "Right", "Center-left", "Left" |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

#### `dim_candidate` — 5 filas

| Columna | Tipo | Descripción |
|---|---|---|
| `candidate_id` | INT (identity) PK | ID del candidato |
| `party_id` | SMALLINT FK→dim_party | Partido del candidato |
| `candidate_name` | VARCHAR(160) | Nombre: Trump, Harris, Stein, Biden, Clinton |
| `candidate_search_text` | VARCHAR(260) | Texto para búsqueda: "Donald Trump Republican presidential candidate" |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Nota:** Biden y Clinton se insertan durante el ETL de `load_winner_history()` porque no están en los datos de 2024 pero sí en el historial.

---

#### `dim_indicator` — 44 filas

Catálogo de todos los indicadores demográficos y de densidad disponibles.

| Columna | Tipo | Descripción |
|---|---|---|
| `indicator_id` | SMALLINT (identity) PK | ID del indicador |
| `indicator_code` | VARCHAR(120) UNIQUE | Código machine-readable (e.g. `income_median_household`) |
| `indicator_name` | VARCHAR(220) | Nombre legible (e.g. "Median household income") |
| `category` | VARCHAR(80) | Categoría: Age, Education, Ethnicity, Housing, Income, Population, Geography, Economy, Transportation, Demographics, Employment |
| `unit` | VARCHAR(60) | Unidad: percent, count, USD, ratio, sq mi, minutes, log scale, people/sq mi |
| `source_file` | VARCHAR(120) | CSV de origen |
| `value_type` | VARCHAR(20) CHECK | Tipo: count, percent, currency, ratio, density, area, minutes, index |
| `business_use` | TEXT | Descripción del uso analítico |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Índice:** `(category)` para filtrar por categoría.

**Lista completa de códigos de indicador:**

| Código | Categoría | Unidad |
|---|---|---|
| `age_pct_65_older` | Age | percent |
| `age_pct_under_18` | Age | percent |
| `age_pct_under_5` | Age | percent |
| `edu_bachelors_pct` | Education | percent |
| `edu_hs_or_higher_pct` | Education | percent |
| `emp_nonemployer_estab` | Employment | count |
| `ethnicity_native_pct` | Ethnicity | percent |
| `ethnicity_asian_pct` | Ethnicity | percent |
| `ethnicity_black_pct` | Ethnicity | percent |
| `ethnicity_hispanic_pct` | Ethnicity | percent |
| `ethnicity_pi_pct` | Ethnicity | percent |
| `ethnicity_two_or_more_pct` | Ethnicity | percent |
| `ethnicity_white_pct` | Ethnicity | percent |
| `ethnicity_white_nh_pct` | Ethnicity | percent |
| `housing_homeownership_pct` | Housing | percent |
| `housing_households` | Housing | count |
| `housing_units` | Housing | count |
| `housing_median_value` | Housing | USD |
| `housing_persons_per_hh` | Housing | ratio |
| `income_median_household` | Income | USD |
| `income_per_capita` | Income | USD |
| `misc_foreign_born_pct` | Demographics | percent |
| `misc_land_area_sqmi` | Geography | sq mi |
| `misc_lang_noneng_pct` | Demographics | percent |
| `misc_same_house_1yr_pct` | Demographics | percent |
| `misc_manuf_shipments` | Economy | USD thousands |
| `misc_mean_travel_time_min` | Transportation | minutes |
| `misc_pct_female` | Demographics | percent |
| `misc_veterans` | Demographics | count |
| `population_2020` | Population | count |
| `population_2010` | Population | count |
| `pop_density_census` | Population | people/sq mi |
| `sales_food_services` | Economy | USD thousands |
| `sales_retail` | Economy | USD thousands |
| `firms_total` | Employment | count |
| `firms_women_owned` | Employment | count |
| `firms_men_owned` | Employment | count |
| `firms_minority_owned` | Employment | count |
| `firms_nonminority_owned` | Employment | count |
| `firms_veteran_owned` | Employment | count |
| `firms_nonveteran_owned` | Employment | count |
| `pop_density_population` | Population | count |
| `pop_density_area_sqmi` | Geography | sq mi |
| `pop_density_per_sqmi` | Population | people/sq mi |
| `pop_density_log_density` | Population | log scale |

---

#### `dim_education_level` — 4 filas

| Columna | Tipo | Descripción |
|---|---|---|
| `education_level_id` | SMALLINT (identity) PK | ID del nivel |
| `education_level_code` | VARCHAR(60) UNIQUE | Código: `less_than_high_school`, `high_school_only`, `some_college_or_associate`, `bachelors_or_higher` |
| `education_level_name` | VARCHAR(160) | Nombre legible |
| `level_order` | SMALLINT UNIQUE | Orden ascendente (1 = menor nivel) |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

#### `dim_religious_group` — ~50+ filas

| Columna | Tipo | Descripción |
|---|---|---|
| `group_code` | VARCHAR(20) PK | Código del grupo (e.g. "CATH", "EVAN", "MSLM") |
| `group_name` | VARCHAR(240) UNIQUE | Nombre completo (e.g. "Catholic Church") |
| `tradition` | VARCHAR(120) | Tradición religiosa más amplia (nullable) |
| `group_search_text` | VARCHAR(360) | Texto para búsqueda |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

### 5.3 Tablas de Hechos

Las tablas de hechos almacenan las **mediciones cuantitativas**: votos, porcentajes, métricas demográficas.

---

#### `fact_county_candidate_votes` — ~9,300 filas (3,100 condados × 3 candidatos para la elección 2024)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `election_id` | SMALLINT FK→dim_election | Elección (2024 → ID 3) |
| `candidate_id` | INT FK→dim_candidate | Candidato |
| `votes` | INT | Votos absolutos |
| `vote_pct` | NUMERIC(10,6) CHECK 0–100 | Porcentaje de votos |
| `is_winner` | BOOLEAN | TRUE si este candidato ganó este condado |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp de carga |

**PK compuesta:** `(fips, election_id, candidate_id)`

**Índices:** `(candidate_id)`, `(election_id, candidate_id)`, `(vote_pct)`.

---

#### `fact_county_election_summary` — ~3,100 filas (una por condado por elección)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `election_id` | SMALLINT FK→dim_election | Elección |
| `total_votes` | INT | Total de votos emitidos |
| `winner_candidate_id` | INT FK→dim_candidate | ID del candidato ganador |
| `winner_name_raw` | VARCHAR(160) | Nombre del ganador como string (e.g. "Trump") |
| `margin_votes` | INT | Diferencia absoluta de votos entre los dos primeros |
| `margin_pct` | NUMERIC(10,6) CHECK 0–100 | Diferencia de porcentaje (e.g. 12.34 para 12.34%) |
| `competitiveness_score` | NUMERIC(10,6) CHECK 0–100 | `100 - margin_pct` (100 = empate, 0 = total aplaste) |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, election_id)`

**Índices:** `(election_id, winner_candidate_id)`, `(margin_pct)`, `(competitiveness_score)`.

---

#### `fact_county_election_winner_history` — ~9,300 filas (3,100 condados × 3 elecciones)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `election_id` | SMALLINT FK→dim_election | Elección (2016, 2020, o 2024) |
| `winner_candidate_id` | INT FK→dim_candidate | ID del candidato ganador |
| `winner_name_raw` | VARCHAR(160) | Nombre del ganador como string |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, election_id)`

---

#### `fact_county_metric` — ~140,000 filas (3,100 condados × 44 indicadores)

Tabla de hechos genérica para todos los indicadores demográficos y de densidad. Usa un modelo EAV (Entity–Attribute–Value) pero con dimensión `dim_indicator` para el atributo.

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `indicator_id` | SMALLINT FK→dim_indicator | Indicador (e.g. ID del `income_median_household`) |
| `period_label` | VARCHAR(30) | Período: `'current'` para demografía contemporánea |
| `metric_value` | NUMERIC(20,4) | El valor numérico (e.g. 52000.0000 para ingreso) |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, indicator_id, period_label)`

**Índices:** `(indicator_id, period_label)`, `(indicator_id, metric_value)`.

---

#### `fact_county_education` — ~62,000 filas (3,100 condados × 4 niveles × 5 períodos)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `period_label` | VARCHAR(30) | Período: '1970', '1980', '1990', '2000', '2015-19' |
| `education_level_id` | SMALLINT FK→dim_education_level | Nivel educativo |
| `adults_count` | INT | Número absoluto de adultos en ese nivel |
| `adults_pct` | NUMERIC(10,4) CHECK 0–100 | Porcentaje de adultos en ese nivel |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, period_label, education_level_id)`

---

#### `fact_county_urban_class` — ~6,200 filas (3,100 condados × 2 años: 2003 y 2013)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `classification_year` | SMALLINT | Año de clasificación: 2003 o 2013 |
| `rural_urban_code` | VARCHAR(20) | Código RUCC del USDA (1–9, donde 1 = más urbano) |
| `urban_influence_code` | VARCHAR(20) | Código UIC del USDA (1–12) |
| `urban_category` | VARCHAR(80) | Categoría textual de 2013: "Metro", "Micro", "Small town", "Rural" |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, classification_year)`

---

#### `fact_county_religion` — ~160,000 filas (3,100 condados × ~50 grupos)

| Columna | Tipo | Descripción |
|---|---|---|
| `fips` | CHAR(5) FK→dim_county | Condado |
| `group_code` | VARCHAR(20) FK→dim_religious_group | Grupo religioso |
| `congregations` | INT | Número de congregaciones |
| `adherents` | INT | Número de feligreses |
| `pct_total_adherents` | NUMERIC(10,4) CHECK 0–100 | % del total de feligreses del condado |
| `pct_total_population` | NUMERIC(10,4) CHECK 0–100 | % de la población total del condado |
| `source_file` | VARCHAR(120) | CSV de origen |
| `loaded_at` | TIMESTAMPTZ | Timestamp |

**PK compuesta:** `(fips, group_code)`

**Índices:** `(group_code)`, `(adherents)`, `(pct_total_population)`.

---

### 5.4 Vistas

#### `vw_county_election_2024`

Desnormaliza los resultados de 2024. Pivota los votos por candidato usando filtros condicionales.

```sql
CREATE OR REPLACE VIEW vw_county_election_2024 AS
SELECT
  c.fips,
  c.county_name,
  c.state_abbr,
  s.state_name,
  es.total_votes,
  es.winner_name_raw,
  es.margin_votes,
  es.margin_pct,
  es.competitiveness_score,
  MAX(v.votes)    FILTER (WHERE cand.candidate_name = 'Trump')  AS votes_trump,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Trump')  AS pct_trump,
  MAX(v.votes)    FILTER (WHERE cand.candidate_name = 'Harris') AS votes_harris,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Harris') AS pct_harris,
  MAX(v.votes)    FILTER (WHERE cand.candidate_name = 'Stein')  AS votes_stein,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Stein')  AS pct_stein
FROM dim_county c
JOIN dim_state s ON s.state_abbr = c.state_abbr
JOIN dim_election e ON e.election_year = 2024
  AND e.office = 'President' AND e.election_type = 'General'
LEFT JOIN fact_county_election_summary es ON es.fips = c.fips AND es.election_id = e.election_id
LEFT JOIN fact_county_candidate_votes v   ON v.fips  = c.fips AND v.election_id  = e.election_id
LEFT JOIN dim_candidate cand ON cand.candidate_id = v.candidate_id
GROUP BY c.fips, c.county_name, c.state_abbr, s.state_name,
         es.total_votes, es.winner_name_raw, es.margin_votes,
         es.margin_pct, es.competitiveness_score;
```

**Uso:** el endpoint `GET /api/standard-query/execute` puede consultarla directamente con SQL raw.

---

#### `vw_county_religion_top_group`

Retorna el grupo religioso dominante por condado (mayor número de feligreses).

```sql
CREATE OR REPLACE VIEW vw_county_religion_top_group AS
SELECT DISTINCT ON (fr.fips)
  fr.fips,
  rg.group_code,
  rg.group_name,
  fr.congregations,
  fr.adherents,
  fr.pct_total_population
FROM fact_county_religion fr
JOIN dim_religious_group rg ON rg.group_code = fr.group_code
ORDER BY fr.fips, fr.adherents DESC;
```

`DISTINCT ON (fr.fips)` es una característica específica de PostgreSQL: retorna exactamente una fila por FIPS, la primera según el ORDER BY que va inmediatamente después (adherentes DESC).

---

### 5.5 Trigger de Auditoría

```sql
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON dim_state
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON dim_county
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
```

Se dispara automáticamente ante cualquier UPDATE en `dim_state` o `dim_county` y actualiza el campo `updated_at`.

---

## 6. Query de Cada Gráfica

Esta sección mapea exactamente qué SQL ejecuta cada endpoint de la API y qué componente del frontend lo consume.

---

### 6.1 Dashboard Principal (`pages/Dashboard.jsx`)

---

#### Gráfica: Mapa Coroplético de Estados (`StateMap.jsx`)

**Endpoint:** `GET /api/dashboard/state-map?election_id=3`

**Qué hace:** Calcula el ganador de cada estado sumando votos reales por partido (no por conteo de condados). Construye el `state_fips` de 2 dígitos tomando los primeros 2 caracteres del FIPS del condado.

```sql
WITH party_votes AS (
    SELECT
        LEFT(c.fips, 2)  AS state_fips,
        c.state_abbr,
        st.state_name,
        SUM(CASE WHEN p.party_code = 'DEM' THEN v.votes ELSE 0 END) AS dem_votes,
        SUM(CASE WHEN p.party_code = 'REP' THEN v.votes ELSE 0 END) AS rep_votes
    FROM fact_county_candidate_votes v
    JOIN dim_county    c    ON v.fips         = c.fips
    JOIN dim_state     st   ON c.state_abbr   = st.state_abbr
    JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
    LEFT JOIN dim_party p   ON cand.party_id  = p.party_id
    WHERE v.election_id = :election_id
      AND p.party_code IN ('REP', 'DEM')
    GROUP BY LEFT(c.fips, 2), c.state_abbr, st.state_name
),
county_stats AS (
    SELECT
        LEFT(c.fips, 2)  AS state_fips,
        SUM(s.total_votes)                                              AS total_votes,
        COUNT(*)                                                         AS county_count,
        SUM(CASE WHEN s.competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties
    FROM fact_county_election_summary s
    JOIN dim_county c ON s.fips = c.fips
    WHERE s.election_id = :election_id AND s.total_votes IS NOT NULL
    GROUP BY LEFT(c.fips, 2)
)
SELECT
    pv.state_fips, pv.state_abbr, pv.state_name,
    pv.dem_votes, pv.rep_votes,
    cs.total_votes, cs.county_count, cs.competitive_counties
FROM party_votes pv
LEFT JOIN county_stats cs ON pv.state_fips = cs.state_fips
ORDER BY pv.state_name
```

**Post-procesamiento en Python:** calcula `winner_party` ("REPUBLICAN" o "DEMOCRAT") y `margin_pct` basándose en `rep_votes` vs `dem_votes`.

**Frontend:** `StateMap.jsx` recibe el array y colorea cada estado según `winner_party` + `margin_pct`. El TopoJSON de los estados se matchea por `state_fips` de 2 dígitos.

---

#### Gráfica: Mapa Coroplético de Condados (`ElectionMap.jsx`)

**Endpoint:** `GET /api/dashboard/map?election_id=3`

**Qué hace:** Retorna el resultado de cada condado para 2024, más los ganadores históricos de 2020 y 2016 para permitir comparación temporal en el frontend.

```sql
SELECT
    s.fips,
    c.county_name,
    c.state_abbr,
    s.total_votes,
    s.winner_name_raw,
    ROUND(s.margin_pct::numeric, 4)            AS margin_pct,
    ROUND(s.competitiveness_score::numeric, 4) AS competitiveness_score,
    p.party_code                               AS winner_party,
    h2020.winner_name_raw                      AS winner_2020,
    h2016.winner_name_raw                      AS winner_2016
FROM fact_county_election_summary s
JOIN dim_county c            ON s.fips               = c.fips
LEFT JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
LEFT JOIN dim_party p        ON cand.party_id         = p.party_id
LEFT JOIN (
    SELECT h.fips, h.winner_name_raw
    FROM fact_county_election_winner_history h
    JOIN dim_election e ON h.election_id = e.election_id
    WHERE e.election_year = 2020
) h2020 ON s.fips = h2020.fips
LEFT JOIN (
    SELECT h.fips, h.winner_name_raw
    FROM fact_county_election_winner_history h
    JOIN dim_election e ON h.election_id = e.election_id
    WHERE e.election_year = 2016
) h2016 ON s.fips = h2016.fips
WHERE s.election_id = :election_id
```

---

#### Gráfica: KPI Bar (`KpiBar.jsx`)

**Endpoint:** `GET /api/dashboard/summary?election_id=3`

**Qué hace:** Dos queries separadas que se combinan en un solo JSON.

**Query 1 — totales nacionales:**
```sql
SELECT
    SUM(total_votes)                                              AS total_votes,
    COUNT(*)                                                       AS total_counties,
    SUM(CASE WHEN competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties,
    ROUND(AVG(ABS(margin_pct))::numeric, 2)                       AS avg_abs_margin_pct
FROM fact_county_election_summary
WHERE election_id = :election_id AND total_votes IS NOT NULL
```

**Query 2 — desglose por candidato:**
```sql
SELECT
    cand.candidate_name,
    p.party_code,
    SUM(v.votes)                                                            AS national_votes,
    ROUND(100.0 * SUM(v.votes) / NULLIF(SUM(SUM(v.votes)) OVER (), 0), 2) AS vote_pct
FROM fact_county_candidate_votes v
JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
LEFT JOIN dim_party p   ON cand.party_id  = p.party_id
WHERE v.election_id = :election_id
GROUP BY cand.candidate_name, p.party_code
ORDER BY national_votes DESC
```

`SUM(SUM(v.votes)) OVER ()` es una función de ventana que calcula el total general para calcular el porcentaje.

---

#### Gráfica: Tendencias Multi-Año (`TrendLineChart.jsx` en `TrendsPanel.jsx`)

**Endpoint:** `GET /api/dashboard/trends` (sin parámetros — retorna todos los años)

**Qué hace:** Agrega votos por partido y año electoral para mostrar la evolución del voto republicano vs demócrata de 2016 a 2024.

```sql
SELECT
    e.election_year,
    p.party_code,
    SUM(v.votes)                           AS total_votes,
    ROUND(AVG(v.vote_pct)::numeric, 4)     AS avg_vote_pct,
    COUNT(DISTINCT v.fips)                  AS counties_won
FROM fact_county_candidate_votes v
JOIN dim_election e    ON v.election_id    = e.election_id
JOIN dim_candidate cand ON v.candidate_id  = cand.candidate_id
LEFT JOIN dim_party p  ON cand.party_id    = p.party_id
WHERE p.party_code IN ('REP', 'DEM')
GROUP BY e.election_year, p.party_code
ORDER BY e.election_year, p.party_code
```

**Frontend:** `TrendLineChart.jsx` usa Recharts `LineChart` con una línea roja (REP) y una azul (DEM) sobre el eje X de años.

---

#### Tabla: Estado Resumen (`StateSummaryTable.jsx`)

**Endpoint:** `GET /api/dashboard/state-summary?election_id=3`

**Qué hace:** Agrega resultados a nivel estado. Usa `MODE()` — función estadística de PostgreSQL que retorna el valor más frecuente — para determinar el ganador del estado según los condados.

```sql
SELECT
    c.state_abbr,
    st.state_name,
    st.region,
    SUM(s.total_votes)                                              AS total_votes,
    ROUND(AVG(s.margin_pct)::numeric, 4)                            AS avg_margin_pct,
    COUNT(*)                                                         AS county_count,
    SUM(CASE WHEN s.competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties,
    MODE() WITHIN GROUP (ORDER BY s.winner_name_raw)                AS state_winner
FROM fact_county_election_summary s
JOIN dim_county c  ON s.fips       = c.fips
JOIN dim_state st  ON c.state_abbr = st.state_abbr
WHERE s.election_id = :election_id AND s.total_votes IS NOT NULL
GROUP BY c.state_abbr, st.state_name, st.region
ORDER BY st.state_name
```

---

#### Tabla: Condados Competitivos (`CountyResultsTable.jsx` / `SwingTable.jsx`)

**Endpoint:** `GET /api/dashboard/competitive-counties?election_id=3&limit=25`

```sql
SELECT
    s.fips,
    c.county_name,
    c.state_abbr,
    s.total_votes,
    s.winner_name_raw,
    ROUND(s.margin_pct::numeric, 4)             AS margin_pct,
    ROUND(s.competitiveness_score::numeric, 4)  AS competitiveness_score,
    p.party_code                                 AS winner_party
FROM fact_county_election_summary s
JOIN dim_county c ON s.fips = c.fips
LEFT JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
LEFT JOIN dim_party p ON cand.party_id = p.party_id
WHERE s.election_id = :election_id AND s.competitiveness_score IS NOT NULL
ORDER BY s.competitiveness_score DESC
LIMIT :limit
```

---

#### Tabla: Análisis de Swing (`SwingTable.jsx`)

**Endpoint:** `GET /api/dashboard/swing-analysis?from_election_id=2&to_election_id=3`

**Qué hace:** Calcula el cambio en el porcentaje de voto entre dos elecciones (e.g. 2020→2024) para cada condado y partido. `swing_pct` positivo = ganó terreno; negativo = perdió.

```sql
WITH base AS (
    SELECT v.fips, p.party_code, v.vote_pct, v.election_id
    FROM fact_county_candidate_votes v
    JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
    LEFT JOIN dim_party p ON cand.party_id = p.party_id
    WHERE v.election_id IN (:from_id, :to_id)
      AND p.party_code IN ('REP', 'DEM')
)
SELECT
    a.fips,
    c.county_name,
    c.state_abbr,
    a.party_code,
    ROUND((b.vote_pct - a.vote_pct)::numeric, 4) AS swing_pct
FROM base a
JOIN base b ON a.fips = b.fips AND a.party_code = b.party_code
              AND b.election_id = :to_id
JOIN dim_county c ON a.fips = c.fips
WHERE a.election_id = :from_id
  AND b.vote_pct IS NOT NULL AND a.vote_pct IS NOT NULL
ORDER BY ABS(b.vote_pct - a.vote_pct) DESC
```

---

### 6.2 Página Economic (`pages/Economic.jsx`)

---

#### Gráfica: Quintiles de Ingreso (`IncomeQuintileChart.jsx`)

**Endpoint:** `GET /api/analytics/income/quintile-breakdown?election_id=3`

**Qué hace:** Divide los condados en 5 quintiles iguales por ingreso mediano. Para cada quintil calcula el promedio de voto Trump vs Harris. Usa `NTILE(5)` — función de ventana que distribuye filas en N grupos iguales.

```sql
WITH income_data AS (
    SELECT
        m.fips,
        m.metric_value                                   AS income,
        NTILE(5) OVER (ORDER BY m.metric_value)          AS quintile
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    JOIN dim_county c    ON m.fips = c.fips
    WHERE i.indicator_code = 'income_median_household'
      AND m.period_label   = 'current'
      AND m.metric_value   IS NOT NULL
),
candidate_pcts AS (
    SELECT
        v.fips,
        MAX(CASE WHEN LOWER(cand.candidate_name) LIKE '%trump%'  THEN v.vote_pct END) AS pct_trump,
        MAX(CASE WHEN LOWER(cand.candidate_name) LIKE '%harris%' THEN v.vote_pct END) AS pct_harris
    FROM fact_county_candidate_votes v
    JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
    WHERE v.election_id = :election_id
    GROUP BY v.fips
)
SELECT
    id.quintile,
    ROUND(MIN(id.income))                        AS income_min,
    ROUND(MAX(id.income))                        AS income_max,
    ROUND(AVG(id.income))                        AS income_avg,
    ROUND(AVG(cp.pct_trump)::numeric,  2)        AS avg_pct_trump,
    ROUND(AVG(cp.pct_harris)::numeric, 2)        AS avg_pct_harris,
    COUNT(*)                                     AS county_count
FROM income_data id
JOIN candidate_pcts cp ON id.fips = cp.fips
WHERE cp.pct_trump IS NOT NULL AND cp.pct_harris IS NOT NULL
GROUP BY id.quintile
ORDER BY id.quintile
```

**Interpretación:** ¿Votan diferente los condados ricos vs pobres?

---

#### Gráfica: Proxy de Desigualdad (`InequalityProxyChart.jsx`)

**Endpoint:** `GET /api/analytics/income/inequality-proxy?election_id=3&limit=50`

**Qué hace:** Pivota los indicadores de ingreso mediano y per cápita en un solo CTE, luego calcula `income - per_capita` como proxy de desigualdad interna. Si el ingreso mediano es mucho mayor que el per cápita, indica concentración de ingresos.

```sql
WITH pivoted AS (
    SELECT
        m.fips,
        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
        MAX(CASE WHEN i.indicator_code = 'income_per_capita'       THEN m.metric_value END) AS per_capita
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code IN ('income_median_household', 'income_per_capita')
      AND m.period_label = 'current'
    GROUP BY m.fips
)
SELECT
    c.fips, c.county_name, c.state_abbr,
    ROUND(p.income)                        AS income,
    ROUND(p.per_capita)                    AS per_capita,
    ROUND(p.income - p.per_capita)         AS inequality_proxy,
    s.winner_name_raw, s.margin_pct, s.competitiveness_score, s.total_votes
FROM pivoted p
JOIN dim_county c ON p.fips = c.fips
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE p.income IS NOT NULL AND p.per_capita IS NOT NULL
ORDER BY (p.income - p.per_capita) DESC
LIMIT :limit
```

---

#### Gráfica: Segmentos de Ingreso (`IncomeSegmentChart.jsx`)

**Endpoint:** `GET /api/analytics/income/segments?election_id=3`

**Qué hace:** Clasifica condados en 3 segmentos (Low/Middle/High Income) usando percentiles 30 y 70 como umbrales, luego agrupa por segmento × ganador.

```sql
WITH income_thresholds AS (
    SELECT
        PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY m.metric_value) AS p30,
        PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY m.metric_value) AS p70
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code = 'income_median_household'
      AND m.period_label = 'current' AND m.metric_value IS NOT NULL
),
segmented AS (
    SELECT
        c.fips,
        m.metric_value AS income,
        CASE
            WHEN m.metric_value <  t.p30 THEN 'Low Income'
            WHEN m.metric_value <= t.p70 THEN 'Middle Income'
            ELSE                              'High Income'
        END AS segment,
        CASE WHEN m.metric_value <  t.p30 THEN 1
             WHEN m.metric_value <= t.p70 THEN 2
             ELSE                              3 END AS sort_order,
        ROUND(t.p30) AS threshold_low,
        ROUND(t.p70) AS threshold_high
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    JOIN dim_county c    ON m.fips = c.fips
    CROSS JOIN income_thresholds t
    WHERE i.indicator_code = 'income_median_household'
      AND m.period_label = 'current' AND m.metric_value IS NOT NULL
)
SELECT
    s.segment, s.sort_order,
    ROUND(MIN(s.income)) AS income_min,
    ROUND(MAX(s.income)) AS income_max,
    MIN(s.threshold_low) AS threshold_low,
    MIN(s.threshold_high) AS threshold_high,
    CASE WHEN LOWER(es.winner_name_raw) LIKE '%trump%'  THEN 'Trump'
         WHEN LOWER(es.winner_name_raw) LIKE '%harris%' THEN 'Harris'
         ELSE 'Other' END AS winner,
    COUNT(*) AS county_count,
    COALESCE(SUM(es.total_votes), 0) AS total_votes,
    ROUND(AVG(ABS(es.margin_pct))::numeric, 2) AS avg_margin
FROM segmented s
LEFT JOIN fact_county_election_summary es ON s.fips = es.fips AND es.election_id = :election_id
GROUP BY s.segment, s.sort_order, winner
ORDER BY s.sort_order, winner
```

`CROSS JOIN income_thresholds` aplica los mismos umbrales calculados globalmente a cada fila individual.

---

#### Gráfica: Ingreso vs Población (`IncomePopulationChart.jsx`)

**Endpoint:** `GET /api/analytics/income/population?election_id=3`

**Qué hace:** Pivot de ingreso y población en el mismo CTE, luego segmenta por ingreso (p30/p70) y correlaciona con el ganador electoral.

```sql
WITH thresholds AS (
    SELECT
        PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY m.metric_value) AS p30,
        PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY m.metric_value) AS p70
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code = 'income_median_household'
      AND m.period_label = 'current' AND m.metric_value IS NOT NULL
),
pivoted AS (
    SELECT
        m.fips,
        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
        MAX(CASE WHEN i.indicator_code = 'population_2020'         THEN m.metric_value END) AS population
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code IN ('income_median_household', 'population_2020')
      AND m.period_label = 'current'
    GROUP BY m.fips
)
SELECT
    c.fips, c.county_name, c.state_abbr,
    ROUND(p.income)     AS income,
    ROUND(p.population) AS population,
    CASE WHEN p.income <  t.p30 THEN 'Low Income'
         WHEN p.income <= t.p70 THEN 'Middle Income'
         ELSE                        'High Income' END AS segment,
    s.winner_name_raw, s.margin_pct, s.total_votes
FROM pivoted p
JOIN dim_county c ON p.fips = c.fips
CROSS JOIN thresholds t
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE p.income IS NOT NULL AND p.population IS NOT NULL
ORDER BY p.population DESC
```

---

#### Gráfica: Asequibilidad de Vivienda (`HousingAffordabilityChart.jsx`)

**Endpoint:** `GET /api/analytics/housing/affordability?election_id=3`

**Qué hace:** Calcula el ratio `housing_value / income` (cuántos años de ingreso cuesta la casa mediana). Un ratio alto = menos asequible.

```sql
WITH pivoted AS (
    SELECT
        m.fips,
        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
        MAX(CASE WHEN i.indicator_code = 'housing_median_value'    THEN m.metric_value END) AS housing_value,
        MAX(CASE WHEN i.indicator_code = 'housing_persons_per_hh'  THEN m.metric_value END) AS persons_per_hh
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code IN ('income_median_household','housing_median_value','housing_persons_per_hh')
      AND m.period_label = 'current'
    GROUP BY m.fips
)
SELECT
    c.fips, c.county_name, c.state_abbr,
    ROUND(p.income::numeric, 0)                                    AS income,
    ROUND(p.housing_value::numeric, 0)                             AS housing_value,
    ROUND(p.persons_per_hh::numeric, 2)                            AS persons_per_hh,
    ROUND((p.housing_value / NULLIF(p.income, 0))::numeric, 2)     AS affordability_ratio,
    s.winner_name_raw, s.margin_pct, s.competitiveness_score, s.total_votes
FROM pivoted p
JOIN dim_county c ON p.fips = c.fips
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE p.income IS NOT NULL AND p.housing_value IS NOT NULL
ORDER BY affordability_ratio DESC NULLS LAST
```

`NULLIF(p.income, 0)` protege contra división por cero.

---

#### Gráfica: Estrés Económico Compuesto (`EconomicStressChart.jsx`)

**Endpoint:** `GET /api/analytics/economic/stress?election_id=3&limit=20`

**Qué hace:** Calcula un score de estrés económico de 0–100 como promedio de 4 sub-scores normalizados:
- `1 - ingreso_normalizado` (menor ingreso = más estrés)
- `1 - per_capita_normalizado` (menor per cápita = más estrés)
- `commute_normalizado` (mayor tiempo de viaje = más estrés)
- `1 - homeownership_normalizado` (menor propiedad = más estrés)

```sql
WITH pivoted AS (
    SELECT
        m.fips,
        MAX(CASE WHEN i.indicator_code = 'income_median_household'   THEN m.metric_value END) AS income,
        MAX(CASE WHEN i.indicator_code = 'income_per_capita'         THEN m.metric_value END) AS per_capita,
        MAX(CASE WHEN i.indicator_code = 'misc_mean_travel_time_min' THEN m.metric_value END) AS commute,
        MAX(CASE WHEN i.indicator_code = 'housing_homeownership_pct' THEN m.metric_value END) AS homeownership
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE i.indicator_code IN (
        'income_median_household','income_per_capita',
        'misc_mean_travel_time_min','housing_homeownership_pct'
    ) AND m.period_label = 'current'
    GROUP BY m.fips
),
ranges AS (
    SELECT MIN(income) AS income_min, MAX(income) AS income_max,
           MIN(per_capita) AS pc_min, MAX(per_capita) AS pc_max,
           MIN(commute) AS commute_min, MAX(commute) AS commute_max,
           MIN(homeownership) AS hw_min, MAX(homeownership) AS hw_max
    FROM pivoted
    WHERE income IS NOT NULL AND per_capita IS NOT NULL
      AND commute IS NOT NULL AND homeownership IS NOT NULL
),
scored AS (
    SELECT
        p.fips, p.income, p.per_capita, p.commute, p.homeownership,
        (
            (1 - (p.income - r.income_min) / NULLIF(r.income_max - r.income_min, 0))
          + (1 - (p.per_capita - r.pc_min) / NULLIF(r.pc_max - r.pc_min, 0))
          + ((p.commute - r.commute_min) / NULLIF(r.commute_max - r.commute_min, 0))
          + (1 - (p.homeownership - r.hw_min) / NULLIF(r.hw_max - r.hw_min, 0))
        ) / 4.0 * 100 AS stress_score
    FROM pivoted p CROSS JOIN ranges r
    WHERE p.income IS NOT NULL AND p.per_capita IS NOT NULL
      AND p.commute IS NOT NULL AND p.homeownership IS NOT NULL
)
SELECT
    c.fips, c.county_name, c.state_abbr,
    ROUND(sc.stress_score::numeric, 1) AS stress_score,
    ROUND(sc.income::numeric, 0) AS income,
    ROUND(sc.per_capita::numeric, 0) AS per_capita,
    ROUND(sc.commute::numeric, 1) AS commute_min,
    ROUND(sc.homeownership::numeric, 1) AS homeownership_pct,
    s.winner_name_raw, s.margin_pct, s.competitiveness_score, s.total_votes
FROM scored sc
JOIN dim_county c ON sc.fips = c.fips
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
ORDER BY sc.stress_score DESC
LIMIT :limit
```

---

#### Gráfica: Ingreso vs Competitividad (`IncomeCompetitivenessChart.jsx`)

**Endpoint:** `GET /api/analytics/income/competitiveness?election_id=3`

```sql
SELECT
    c.fips, c.county_name, c.state_abbr,
    m.metric_value          AS income,
    s.competitiveness_score, s.margin_pct, s.total_votes, s.winner_name_raw
FROM fact_county_metric m
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
JOIN dim_county c    ON m.fips = c.fips
JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE i.indicator_code = 'income_median_household'
  AND m.period_label = 'current' AND m.metric_value IS NOT NULL
  AND s.competitiveness_score IS NOT NULL
ORDER BY s.competitiveness_score DESC
```

Scatter plot: eje X = ingreso, eje Y = competitiveness_score, color = ganador.

---

### 6.3 Página Analytics (`pages/Analytics.jsx`)

---

#### Gráfica: Religión Dominante por Condado

**Endpoint:** `GET /api/analytics/religion/top-by-county`

```sql
SELECT DISTINCT ON (r.fips)
    r.fips,
    g.group_code,
    g.group_name,
    g.tradition,
    r.adherents,
    r.pct_total_population
FROM fact_county_religion r
JOIN dim_religious_group g ON r.group_code = g.group_code
WHERE r.adherents IS NOT NULL
ORDER BY r.fips, r.adherents DESC
```

`DISTINCT ON (r.fips)` retorna solo la fila con más adherentes por condado.

---

#### Gráfica: Distribución Educativa por Condado

**Endpoint:** `GET /api/analytics/education/county-summary?election_id=3`

**Qué hace:** Pivota los 4 niveles educativos del período más reciente (2015-19) en columnas separadas, luego une con el resultado electoral.

```sql
SELECT
    c.fips, c.county_name, c.state_abbr,
    MAX(CASE WHEN dl.education_level_code = 'bachelors_or_higher'       THEN fe.adults_pct END) AS pct_bachelors,
    MAX(CASE WHEN dl.education_level_code = 'high_school_only'          THEN fe.adults_pct END) AS pct_hs_only,
    MAX(CASE WHEN dl.education_level_code = 'some_college_or_associate'  THEN fe.adults_pct END) AS pct_some_college,
    MAX(CASE WHEN dl.education_level_code = 'less_than_high_school'     THEN fe.adults_pct END) AS pct_less_than_hs,
    s.margin_pct, s.competitiveness_score, s.total_votes, s.winner_name_raw
FROM dim_county c
JOIN fact_county_education fe ON c.fips = fe.fips
JOIN dim_education_level dl   ON fe.education_level_id = dl.education_level_id
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE fe.period_label = '2015-19'
GROUP BY c.fips, c.county_name, c.state_abbr,
         s.margin_pct, s.competitiveness_score, s.total_votes, s.winner_name_raw
ORDER BY c.state_abbr, c.county_name
```

**Post-procesamiento:** `pct_hs_or_higher = pct_bachelors + pct_hs_only + pct_some_college`.

---

#### Gráfica: Distribución de Edad por Condado

**Endpoint:** `GET /api/analytics/age/county-summary?election_id=3`

```sql
SELECT
    c.fips, c.county_name, c.state_abbr,
    MAX(CASE WHEN i.indicator_code = 'age_pct_under_18' THEN m.metric_value END) AS pct_under_18,
    MAX(CASE WHEN i.indicator_code = 'age_pct_65_older' THEN m.metric_value END) AS pct_65_older,
    s.total_votes
FROM dim_county c
JOIN fact_county_metric m ON c.fips = m.fips
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE i.category = 'Age' AND m.period_label = 'current'
GROUP BY c.fips, c.county_name, c.state_abbr, s.total_votes
ORDER BY c.state_abbr, c.county_name
```

**Post-procesamiento:** `pct_18_64 = max(0, 100 - pct_under_18 - pct_65_older)`.

---

#### Gráfica: Distribución Étnica por Condado

**Endpoint:** `GET /api/analytics/ethnicity/county-summary?election_id=3`

```sql
SELECT
    c.fips, c.county_name, c.state_abbr,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_white_nh_pct'    THEN m.metric_value END) AS pct_white,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_hispanic_pct'    THEN m.metric_value END) AS pct_hispanic,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_black_pct'       THEN m.metric_value END) AS pct_black,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_asian_pct'       THEN m.metric_value END) AS pct_asian,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_native_pct'      THEN m.metric_value END) AS pct_native,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_pi_pct'          THEN m.metric_value END) AS pct_pi,
    MAX(CASE WHEN i.indicator_code = 'ethnicity_two_or_more_pct' THEN m.metric_value END) AS pct_two_or_more,
    s.margin_pct, s.competitiveness_score, s.total_votes
FROM dim_county c
JOIN fact_county_metric m ON c.fips = m.fips
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
LEFT JOIN fact_county_election_summary s ON c.fips = s.fips AND s.election_id = :election_id
WHERE i.category = 'Ethnicity' AND m.period_label = 'current'
GROUP BY c.fips, c.county_name, c.state_abbr,
         s.margin_pct, s.competitiveness_score, s.total_votes
ORDER BY c.state_abbr, c.county_name
```

---

### 6.4 Página Education (`pages/Education.jsx`)

---

#### Gráfica: Segmentos de Persuasión (`PersuasionViolinChart.jsx`)

**Endpoint:** `GET /api/analytics/income/persuasion-segments?election_id=3`

**Qué hace:** Segmenta condados en 4 cuadrantes según su nivel educativo relativo (usando medianas como umbrales):
- **Mass Persuasion**: HS o más alto pero no muchos con título universitario — el votante "persuadible" clásico
- **Informed Electorate**: alto HS Y alto universitario
- **Low Engagement**: bajo en ambas métricas
- **Niche Educated**: pocos con HS pero muchos con universitario (comunidades de inmigrantes con alto nivel)

```sql
WITH edu_pivoted AS (
    SELECT
        fe.fips,
        COALESCE(MAX(CASE WHEN dl.education_level_code = 'bachelors_or_higher'       THEN fe.adults_pct END), 0) AS pct_bachelors,
        COALESCE(MAX(CASE WHEN dl.education_level_code = 'high_school_only'          THEN fe.adults_pct END), 0) AS pct_hs_only,
        COALESCE(MAX(CASE WHEN dl.education_level_code = 'some_college_or_associate' THEN fe.adults_pct END), 0) AS pct_some_college
    FROM fact_county_education fe
    JOIN dim_education_level dl ON fe.education_level_id = dl.education_level_id
    WHERE fe.period_label = '2015-19'
    GROUP BY fe.fips
),
edu_computed AS (
    SELECT
        fips,
        pct_bachelors,
        pct_bachelors + pct_hs_only + pct_some_college AS pct_hs_or_higher
    FROM edu_pivoted WHERE pct_bachelors IS NOT NULL
),
thresholds AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_hs_or_higher) AS hs_median,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_bachelors)    AS bachelor_median
    FROM edu_computed
),
segmented AS (
    SELECT
        e.fips,
        ROUND(e.pct_bachelors::numeric, 2) AS pct_bachelors,
        ROUND(e.pct_hs_or_higher::numeric, 2) AS pct_hs_or_higher,
        CASE
            WHEN e.pct_hs_or_higher >= t.hs_median AND e.pct_bachelors <  t.bachelor_median THEN 'Mass Persuasion'
            WHEN e.pct_hs_or_higher >= t.hs_median AND e.pct_bachelors >= t.bachelor_median THEN 'Informed Electorate'
            WHEN e.pct_hs_or_higher <  t.hs_median AND e.pct_bachelors <  t.bachelor_median THEN 'Low Engagement'
            WHEN e.pct_hs_or_higher <  t.hs_median AND e.pct_bachelors >= t.bachelor_median THEN 'Niche Educated'
        END AS segment
    FROM edu_computed e CROSS JOIN thresholds t
)
SELECT
    c.fips, c.county_name, c.state_abbr,
    ROUND(m.metric_value) AS income,
    sg.segment, sg.pct_bachelors, sg.pct_hs_or_higher,
    s.winner_name_raw, s.margin_pct
FROM segmented sg
JOIN dim_county c ON sg.fips = c.fips
JOIN fact_county_metric m ON sg.fips = m.fips
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
LEFT JOIN fact_county_election_summary s ON sg.fips = s.fips AND s.election_id = :election_id
WHERE i.indicator_code = 'income_median_household'
  AND m.period_label = 'current' AND m.metric_value IS NOT NULL
  AND sg.segment IS NOT NULL
ORDER BY sg.segment, m.metric_value
```

---

### 6.5 Correlación Genérica

**Endpoint:** `GET /api/analytics/correlation?indicator=edu_bachelors_pct&election_id=3`

**Qué hace:** Dos queries:
1. Calcula la correlación de Pearson entre el indicador y el margen electoral.
2. Retorna todos los puntos para dibujar el scatter plot.

```sql
-- Query 1: coeficiente de correlación
SELECT
    corr(m.metric_value, s.margin_pct) AS correlation,
    COUNT(*) AS sample_size
FROM fact_county_metric m
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
JOIN fact_county_election_summary s ON m.fips = s.fips
WHERE i.indicator_code = :indicator_code
  AND s.election_id   = :election_id
  AND m.metric_value  IS NOT NULL
  AND s.margin_pct    IS NOT NULL

-- Query 2: puntos del scatter
SELECT
    m.fips, m.metric_value, s.margin_pct, s.competitiveness_score
FROM fact_county_metric m
JOIN dim_indicator i ON m.indicator_id = i.indicator_id
JOIN fact_county_election_summary s ON m.fips = s.fips
WHERE i.indicator_code = :indicator_code
  AND s.election_id   = :election_id
  AND m.metric_value  IS NOT NULL
  AND s.margin_pct    IS NOT NULL
ORDER BY m.fips
```

`corr()` es una función agregada de PostgreSQL que implementa la correlación de Pearson directamente en SQL.

---

### 6.6 Desgloses Adicionales del Dashboard

#### Party Comparison

**Endpoint:** `GET /api/dashboard/party-comparison?election_id=3`

```sql
SELECT
    p.party_code,
    COUNT(*)                               AS counties_won,
    SUM(s.total_votes)                     AS total_votes_in_won_counties,
    ROUND(AVG(ABS(s.margin_pct))::numeric, 4) AS avg_margin_pct
FROM fact_county_election_summary s
JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
JOIN dim_party p        ON cand.party_id         = p.party_id
WHERE s.election_id = :election_id AND s.winner_candidate_id IS NOT NULL
GROUP BY p.party_code
ORDER BY counties_won DESC
```

#### Region Breakdown

**Endpoint:** `GET /api/dashboard/region-breakdown?election_id=3`

```sql
SELECT
    st.region, p.party_code,
    SUM(v.votes)                        AS total_votes,
    COUNT(DISTINCT c.fips)               AS county_count,
    ROUND(AVG(v.vote_pct)::numeric, 4)  AS avg_vote_pct
FROM fact_county_candidate_votes v
JOIN dim_county c   ON v.fips        = c.fips
JOIN dim_state st   ON c.state_abbr  = st.state_abbr
JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
LEFT JOIN dim_party p ON cand.party_id = p.party_id
WHERE v.election_id = :election_id AND p.party_code IN ('REP', 'DEM')
  AND st.region IS NOT NULL
GROUP BY st.region, p.party_code
ORDER BY st.region, p.party_code
```

---

## 7. Descripción Detallada de Cada Archivo

---

### `db.sql` (488 líneas)

DDL completo de PostgreSQL. Se ejecuta una sola vez al crear el contenedor de base de datos. Contiene en orden:
1. `\c electoral_dashboard` — conecta a la base de datos
2. `CREATE EXTENSION pg_trgm` — habilita búsqueda por trigramas
3. 5 tablas de staging con sus índices
4. 8 tablas de dimensión con sus índices y restricciones
5. 7 tablas de hechos con sus índices
6. 2 vistas
7. `INSERT` de seed data (partidos, candidatos, elecciones, niveles educativos)
8. Trigger `set_updated_at` para `dim_state` y `dim_county`

---

### `docker-compose.yml`

Orquesta 5 servicios:

| Servicio | Imagen | Puerto | Rol |
|---|---|---|---|
| `db` | postgres:16 | 5432 | Base de datos permanente, ejecuta `db.sql` al inicio |
| `init` | backend Dockerfile | — | ETL one-shot, depende de `db` saludable |
| `backend` | backend Dockerfile | 8000 | API FastAPI, depende de `db` e `init` |
| `frontend` | frontend Dockerfile | 80 | SPA React + Nginx proxy |
| `reload` | backend Dockerfile | — | ETL manual (perfil `reload`) |

La salud del contenedor `db` se verifica con `pg_isready` cada 5 segundos, hasta 20 reintentos. Los servicios que dependen de la BD usan `condition: service_healthy`.

---

### `data_cleaning.ipynb`

Notebook Jupyter de ~150 celdas. Estructura por sección:

1. **Importaciones y configuración** — Pandas, NumPy, paths de entrada/salida
2. **Elections** — limpieza de FIPS, escala de porcentajes, imputación, cálculo de margin y competitiveness
3. **Demographics** — renombrado de columnas, reemplazo de -1, imputación por mediana
4. **Population Density** — normalización de FIPS, recálculo de densidad, log-densidad
5. **Education** — filtro de estados/nación, reshape wide→long, clasificación urban/rural
6. **Religion** — strip de %, imputación de adherentes, normalización de encoding
7. **Exportación** — guarda cada CSV limpio en `datasets/cleaned/`

---

### `backend/app/main.py`

Punto de entrada de FastAPI:
- Crea la instancia `app = FastAPI(...)`
- Configura CORS (permite el origen del frontend)
- Registra los 7 routers: `elections`, `counties`, `states`, `analytics`, `dashboard`, `chat_query`, `standard_query`

---

### `backend/app/config.py`

Pydantic `BaseSettings` que lee variables de entorno:
- `DATABASE_URL` — URL asyncpg para SQLAlchemy
- `GROQ_API_KEY` — clave de API para el LLM
- `GROQ_MODEL` — modelo a usar (default: `llama-3.3-70b-versatile`)
- `CORS_ORIGINS` — lista de orígenes permitidos

---

### `backend/app/database.py`

- Crea el engine async con `create_async_engine(DATABASE_URL)`
- Define `AsyncSessionLocal` como factory de sesiones
- Función `get_db()`: generador async que provee una sesión por request y la cierra al terminar (usado como `Depends` en todos los endpoints)

---

### `backend/app/models/dimensions.py`

ORM SQLAlchemy 2.0 para las 8 dimensiones. Cada clase mapea una tabla. Usa `mapped_column()` y anotaciones de tipo Python para las columnas.

---

### `backend/app/models/facts.py`

ORM SQLAlchemy 2.0 para las 7 tablas de hechos. Define `relationship()` hacia las dimensiones con `back_populates` para navegación bidireccional.

---

### `backend/app/services/dashboard_service.py`

Contiene la clase `DashboardService` con 8 métodos:

| Método | Query principal |
|---|---|
| `get_national_summary()` | 2 queries: totales agregados + desglose por candidato |
| `get_trends()` | Votos por partido × año electoral |
| `get_state_summary()` | Agregados por estado con MODE() |
| `get_competitive_counties()` | ORDER BY competitiveness_score DESC |
| `get_map_data()` | Resultados 2024 + winners 2020/2016 por condado |
| `get_party_comparison()` | Conteo de condados ganados por partido |
| `get_region_breakdown()` | Votos por región del Censo |
| `get_state_map_data()` | Votos DEM/REP agregados por estado para el mapa |
| `get_swing_analysis()` | Cambio de vote_pct entre dos elecciones |

---

### `backend/app/services/analytics_service.py`

Clase `AnalyticsService` con 13 métodos para las páginas de análisis demográfico:

| Método | Descripción |
|---|---|
| `get_demographics()` | Todos los indicadores de un condado |
| `get_education()` | Niveles educativos de un condado por período |
| `get_religion()` | Grupos religiosos de un condado |
| `get_top_religion_by_county()` | Grupo dominante por condado (DISTINCT ON) |
| `get_urban_class()` | Clasificación urbano/rural de un condado |
| `get_correlation()` | Pearson + scatter para un indicador vs margen electoral |
| `get_education_county_summary()` | Pivot de 4 niveles educativos × elección |
| `get_age_county_summary()` | Pivot de grupos de edad |
| `get_ethnicity_county_summary()` | Pivot de grupos étnicos |
| `get_income_quintiles()` | NTILE(5) de ingreso × votos por candidato |
| `get_inequality_proxy()` | income - per_capita ordenado DESC |
| `get_income_population()` | Pivot ingreso+población, segmentado por p30/p70 |
| `get_income_segments()` | Segmentos Low/Middle/High × ganador |
| `get_housing_affordability()` | Ratio housing_value/income |
| `get_economic_stress()` | Score compuesto de 4 indicadores normalizados |
| `get_income_competitiveness()` | income vs competitiveness_score |
| `get_persuasion_segments()` | 4 cuadrantes educativos con umbrales de mediana |
| `get_indicators()` | Lista todos los indicadores del catálogo |

---

### `backend/app/routers/`

Cada router es un archivo Python que define los endpoints HTTP usando decoradores `@router.get()`. Solo valida parámetros de query (via `Query()`), delega toda la lógica al service correspondiente.

| Archivo | Prefijo | Endpoints principales |
|---|---|---|
| `dashboard.py` | `/dashboard` | summary, trends, state-summary, competitive-counties, map, party-comparison, region-breakdown, state-map, swing-analysis |
| `analytics.py` | `/analytics` | indicators, /counties/{fips}/demographics, /counties/{fips}/education, /counties/{fips}/religion, religion/top-by-county, education/county-summary, age/county-summary, ethnicity/county-summary, income/*, housing/*, economic/*, correlation |
| `elections.py` | `/elections` | lista elecciones, resultados por condado, historial ganadores, swing counties |
| `counties.py` | `/counties` | lista condados, búsqueda, detalle, historial |
| `states.py` | `/states` | lista estados, detalle, condados de un estado |
| `chat_query.py` | `/chat` | POST /query (NLQ con Groq) |
| `standard_query.py` | `/standard-query` | GET /schema, POST /execute |

---

### `backend/etl/load.py` (524 líneas)

Script de carga ETL. Ver [Paso 3](#paso-3--etl-carga-en-base-de-datos-backendletlloadpy) en el flujo del dato.

Funciones principales:

| Función | Tablas destino |
|---|---|
| `load_states()` | `dim_state` |
| `load_counties()` | `dim_county` |
| `load_elections_2024()` | `fact_county_candidate_votes`, `fact_county_election_summary` |
| `load_winner_history()` | `dim_candidate` (Biden/Clinton), `fact_county_election_winner_history` |
| `load_indicators()` | `dim_indicator` |
| `load_demographics()` | `fact_county_metric` (44 indicadores) |
| `load_pop_density()` | `fact_county_metric` (4 indicadores de densidad) |
| `load_urban_class()` | `fact_county_urban_class` |
| `load_education()` | `fact_county_education` |
| `load_religion()` | `dim_religious_group`, `fact_county_religion` |
| `run_test_queries()` | Ejecuta 10 queries de validación post-carga |

---

### `backend/app/services/nlq/`

Motor de consulta en lenguaje natural. Permite preguntas como "¿Cuáles condados donde Harris perdió por menos de 5 puntos tienen ingreso mayor a 60,000?"

**Flujo:**
1. `llm_parser.py`: envía el texto al LLM de Groq con un prompt de sistema que incluye el esquema de la BD. El LLM retorna un JSON estructurado (`ParsedQuery`).
2. `validator.py`: verifica que los filtros estén en la whitelist, que los FIPS sean válidos, detecta ambigüedades.
3. `query_builder.py`: convierte el `ParsedQuery` a SQL parameterizado (no concatenado, evita inyección).
4. `executor.py`: ejecuta la query segura y retorna filas + metadatos + sugerencias de visualización.
5. `aliases.py`: mapa de variantes de nombre de condado a FIPS canónico.

---

### `frontend/src/pages/Dashboard.jsx`

Página principal. Gestiona:
- Carga de datos del mapa y KPIs al montar
- Estado de selección (estado vs condado) para el panel derecho
- Filtro de elección activa (2016/2020/2024)
- Sincronización con el store de Zustand

Componentes que monta: `KpiBar`, `StateMap`/`ElectionMap`, `TrendsPanel`, `RightPanel`.

---

### `frontend/src/pages/Economic.jsx`

Página de análisis económico. Monta hasta 7 gráficas en tabs:
- Quintiles de ingreso
- Segmentos Low/Middle/High
- Ingreso vs Población
- Asequibilidad de Vivienda
- Proxy de Desigualdad
- Estrés Económico
- Ingreso vs Competitividad

---

### `frontend/src/store/useElectionsStore.js`

Store Zustand con estado mínimo:
```javascript
{
  selectedElection: 3,        // ID de la elección (3 = 2024)
  selectedCounty: null,       // FIPS del condado activo
  selectedState: null,        // Abreviatura del estado activo
  setSelectedElection: fn,
  setSelectedCounty: fn,
  setSelectedState: fn,
}
```

Todos los componentes suscritos se re-renderizan cuando cambia este store.

---

### `frontend/src/services/`

Clientes Axios. Cada archivo agrupa las llamadas de una página:

- `dashboardService.js` — `getMapData()`, `getStateSummary()`, `getTrends()`, `getStateMapData()`, etc.
- `analyticsService.js` — `getIncomeQuintiles()`, `getHousingAffordability()`, `getEthnicityData()`, etc.
- `chatQueryService.js` — `sendQuery(text)` → POST `/api/chat/query`
- `standardQueryService.js` — `getSchema()`, `executeQuery(sql)`

---

### `frontend/nginx.conf`

Configuración Nginx para el contenedor de producción:
- Sirve los archivos estáticos de `dist/` (build de React)
- Proxy reverso: `location /api/ { proxy_pass http://backend:8000; }` — reenvía todas las peticiones API al backend interno

---

### `frontend/vite.config.js`

En desarrollo (fuera de Docker):
```javascript
proxy: {
  '/api': 'http://localhost:8000'
}
```
Elimina el problema de CORS en desarrollo local al redirigir internamente.

---

*Fin de la documentación.*
