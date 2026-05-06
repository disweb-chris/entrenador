# OVERLOAD TRACKER

App de registro de entrenamiento con sobrecarga progresiva real.

## Stack
- React 18 + Vite
- Firebase (Auth + Firestore)

## Setup

### 1. Instalar dependencias
```bash
npm install
```

### 2. Correr en desarrollo
```bash
npm run dev
```

### 3. Build para producción
```bash
npm run build
```

### 4. Reglas de Firestore
Copiar el contenido de `firestore.rules` en Firebase Console → Firestore → Rules.

### 5. Deploy (opcional con Firebase Hosting)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Índices requeridos en Firestore

Ir a Firebase Console → Firestore → Indexes y crear:

| Collection | Fields |
|---|---|
| sessions | uid (ASC), dayKey (ASC), dateKey (DESC) |

## Estructura de datos

```
/users/{uid}
  name, email, createdAt

/sessions/{uid_date_dayKey}
  uid, dateKey, dayKey, updatedAt
  exercises: {
    [nombre]: {
      type: "compound" | "isolation",
      sets: [{ weight, reps, rir, fatigue, done, notes }],
      notes: string,
      restTime: number (segundos)
    }
  }
  sessionNotes: string

/targets/{uid_weekKey}
  uid, weekKey
  targets: { [ejercicio]: { series, reps, peso } }

/restprefs/{uid}
  prefs: { [ejercicio]: segundos }
```

## Formato JSON para importar targets

```json
{
  "semana": "2026-W19",
  "targets": {
    "Jalón cerrado V": { "series": 3, "reps": 12, "peso": 90 },
    "Remo en máquina": { "series": 3, "reps": 14, "peso": 27.5 }
  }
}
```
