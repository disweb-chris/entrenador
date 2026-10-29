# MCP de OVERLOAD

Servidor [MCP](https://modelcontextprotocol.io) que lee y escribe los mismos
datos de Firestore que la app. Reutiliza `src/lib` (rutina, récords,
progresión, estancamiento, parser de rutina), así que lo que devuelve y lo que
guarda tiene la misma forma que si lo hicieras desde la app.

## Herramientas

**Lectura**

| Herramienta | Qué devuelve |
|---|---|
| `sesion_por_fecha` | Sesiones de una fecha, ejercicios en orden de rutina, series hechas y pendientes, volumen, mejor serie |
| `resumen_ultimas_sesiones` | Últimas N sesiones: ejercicios entrenados con peso máx/reps/volumen, salteados, notas |
| `historial_ejercicio` | Progresión de un ejercicio (sólo series hechas), récord y estancamiento |
| `objetivos_semana` | Objetivos de una semana ISO (o los heredados de la anterior, como la app) |
| `rutina` | La rutina por día: foco, ejercicios en orden, tipo, descanso, notas, carga y alternativas |
| `tiempos_descanso` | Descanso de la rutina y el último usado por ejercicio |
| `records_personales` | Mejor serie histórica por 1RM estimado |
| `proxima_sesion` | Qué día toca según la rotación + última vez, objetivo, sugerencia de progresión y estancamiento por ejercicio y por cada alternativa (con su propio historial) |

**Escritura**

| Herramienta | Qué hace |
|---|---|
| `registrar_set` | Marca una serie hecha: completa la siguiente serie pendiente o agrega una. Crea la sesión desde la rutina si no existe y avanza la rotación si es hoy |
| `editar_set` / `eliminar_set` | Corrige o borra una serie |
| `agregar_ejercicio` / `eliminar_ejercicio` / `editar_ejercicio_sesion` | Ejercicios de una sesión |
| `notas_sesion` | Notas generales de la sesión |
| `guardar_objetivos` | Objetivos de una semana (combinar o reemplazar, y quitar) |
| `guardar_rutina_dia` | Reemplaza la rutina de un día (con carga y alternativas), validada con el mismo parser que el editor JSON de la app |

### Cómo elige la sesión al escribir

El id de una sesión es `uid_fecha_día`. Si no pasás `dia`:

1. si esa fecha ya tiene una sola sesión, usa esa;
2. si es hoy y no hay ninguna, usa el día que toca por rotación (el siguiente a `lastWorkedDay`);
3. si es otra fecha sin sesión, pide el `dia`.

`registrar_set` con el nombre de una alternativa la cambia en el lugar de su
principal, igual que el botón de la app (si el principal ya tenía series
hechas, quedan y la alternativa entra al lado).

Los nombres de ejercicio aceptan otras mayúsculas/tildes o parte del nombre
si es único ("press plano" → "Press Plano Máquina"); la respuesta siempre dice
con qué nombre quedó guardado.

## Configuración

| Variable | |
|---|---|
| `ENTRENADOR_UID` | **Requerida.** uid de Firebase Auth del usuario (Firebase Console → Authentication) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio (tal cual o en base64). Sin esto usa `GOOGLE_APPLICATION_CREDENTIALS` o la cuenta del entorno (Cloud Run) |
| `MCP_TOKEN` | **Requerida en HTTP.** Secreto para autorizar las llamadas |
| `FIREBASE_PROJECT_ID` | Default `entrenador-b3153` |
| `PORT` | Default `3000` |

La cuenta de servicio se genera en Firebase Console → Configuración del
proyecto → Cuentas de servicio → *Generar nueva clave privada*. Firebase Admin
se saltea las reglas de Firestore: el servidor filtra todo por
`ENTRENADOR_UID`, y el token es lo único que protege el endpoint. No lo
publiques.

## Correrlo

```bash
cd mcp
npm install
npm test                       # pruebas con un Firestore en memoria
MCP_TOKEN=... ENTRENADOR_UID=... FIREBASE_SERVICE_ACCOUNT="$(cat clave.json)" npm start
```

### Como conector remoto (claude.ai / app de Claude)

Desplegalo en cualquier hosting de Node (el Dockerfile se construye desde la
raíz del repo porque usa `src/lib`). Lo previsto es Cloud Run en el mismo
proyecto de Firebase (ahí no hace falta la clave: usa la cuenta del servicio).

#### Despliegue automático (GitHub Actions)

`.github/workflows/deploy-mcp.yml` corre los tests y redespliega el servicio en
cada push a `main` que toque `mcp/` o `src/lib/`. También se corre a mano
desde Actions → *Deploy MCP to Cloud Run* → *Run workflow*. Necesita:

| En el repo (Settings → Secrets and variables → Actions) | |
|---|---|
| Secret `GCP_SA_KEY` | JSON de una cuenta de servicio de GCP con los roles *Cloud Run Admin*, *Artifact Registry Administrator* y *Service Account User* |
| Secrets `MCP_TOKEN` y `ENTRENADOR_UID` | Opcionales. Sólo hacen falta para crear el servicio la primera vez o para cambiarlos; si no están, el servicio conserva los que tiene |
| Variables `GCP_PROJECT_ID`, `GCP_REGION`, `MCP_SERVICE` | Opcionales. Default: `entrenador-b3153`, `southamerica-east1`, `entrenador-mcp` |

En el proyecto tienen que estar habilitadas las APIs de Cloud Run y Artifact
Registry.

#### A mano

```bash
REGION=southamerica-east1 PROJECT=entrenador-b3153
IMAGE=$REGION-docker.pkg.dev/$PROJECT/entrenador/entrenador-mcp:manual
gcloud auth configure-docker $REGION-docker.pkg.dev
docker build -f mcp/Dockerfile -t $IMAGE . && docker push $IMAGE
gcloud run deploy entrenador-mcp --image $IMAGE --project $PROJECT --region $REGION \
  --allow-unauthenticated --update-env-vars ENTRENADOR_UID=...,MCP_TOKEN=...
```

En Claude → Configuración → Conectores → *Agregar conector personalizado*,
usá la URL con el token en la ruta:

```
https://<tu-servicio>/mcp/<MCP_TOKEN>
```

(También acepta `Authorization: Bearer <MCP_TOKEN>` contra `/mcp`.)

### Local por stdio (Claude Desktop / Claude Code)

```json
{
  "mcpServers": {
    "entrenador": {
      "command": "node",
      "args": ["/ruta/a/entrenador/mcp/src/server.js", "--stdio"],
      "env": { "ENTRENADOR_UID": "...", "GOOGLE_APPLICATION_CREDENTIALS": "/ruta/clave.json" }
    }
  }
}
```

## Validación estricta

Los argumentos se validan en modo estricto: un campo que el servidor no conoce
devuelve un error en vez de descartarse. Si Claude manda algo que el servidor
desplegado todavía no soporta (por ejemplo `alternativas` contra una versión
vieja), se entera en el momento en lugar de recibir un ok y perder el dato.

## Convivencia con la app

Las escrituras van en una transacción sobre el documento de la sesión. La app
tiene la sesión en memoria, así que relee la sesión al volver a primer plano
(si no hay ediciones pendientes). Si estás editando la misma sesión en la app
y desde Claude a la vez, gana la última escritura.

La colección `restprefs` ya no se usa: el descanso vive en la rutina y en
cada sesión, que es lo que lee `tiempos_descanso`.
