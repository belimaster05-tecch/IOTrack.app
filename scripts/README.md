# Scripts InvTrack

## Probar flujo completo (recurso → solicitar → aprobar → préstamos)

El script `test-flow.ts` verifica y mejora el flujo de uso de recursos, incluido el caso **varias unidades del mismo recurso** (ej: 5 iPads con numeración #1–#5).

### Requisitos

- Node con `tsx` (ya en devDependencies).
- Variables en `.env.local` (o `.env`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - **`SUPABASE_SERVICE_ROLE_KEY`** (necesaria para este script; con la clave anon, RLS oculta organizaciones y el script no puede leer datos).

Cómo obtener la clave **service_role**: Supabase → tu proyecto Inv-Track → **Settings** → **API** → en "Project API keys" copia **service_role** (secret). Añádela a `.env.local`:
`SUPABASE_SERVICE_ROLE_KEY="eyJ..."`

### Uso

```bash
# Desde la raíz del proyecto
npm run test:flow
```

Con datos de prueba (crea recurso "iPad (test)" y 5 unidades IPAD-001…005):

```bash
npm run test:flow:seed
```

(Requiere `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Inv-Track de Supabase: Settings → API → service_role.)

### Flujo que cubre

1. **Ver recurso** – Usa la primera organización y el primer recurso (o crea uno tipo iPad con `--seed`).
2. **Solicitar** – Crea una solicitud con **cantidad** (ej: 5 unidades).
3. **Aprobar** – Ejecuta la misma lógica que la app: asigna hasta N unidades disponibles y crea N préstamos.
4. **Verificación** – Comprueba que hay N préstamos y N unidades en estado `on_loan`.

### Flujo “varias numeraciones” (ej: 5 iPads #1–#5)

- En la app: en **Solicitar Recursos** eliges un recurso (ej: iPad) y subes la **cantidad** a 5. Se envía una sola solicitud con `quantity: 5`.
- Al **aprobar**, el backend toma hasta 5 unidades disponibles (p. ej. IPAD-001, 002, 003, 004, 005), crea 5 filas en `loans` y marca esas unidades como `on_loan`.
- En **Préstamos** se listan los 5 préstamos; cada uno referencia una unidad con su `serial_number` (numeración).

La columna `quantity` en la tabla `requests` permite este flujo; el script lo usa y lo valida.
