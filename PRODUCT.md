# Product

## Register

product

## Users

El usuario principal es el propio desarrollador, usando la app en el gym con el teléfono en la mano entre serie y serie. Potencialmente puede escalar a más usuarios (amigos, entrenados). El contexto es físico y exigente: manos posiblemente ocupadas, bajo enfoque cognitivo entre sets, tiempo limitado (60–90 segundos de descanso). La app debe funcionar sin fricción bajo esas condiciones. Para nuevos usuarios que lleguen sin contexto previo, el diseño tiene que ser lo suficientemente intuitivo para no necesitar instrucciones.

## Product Purpose

OVERLOAD es un tracker de entrenamiento orientado a la sobrecarga progresiva. Registra series, peso, repeticiones, RIR (Reps In Reserve) y fatiga por ejercicio, compara automáticamente con sesiones anteriores, y genera informes exportables. El éxito es: el usuario puede registrar su entrenamiento completo sin que la app sea un obstáculo — rápido, directo, sin distracciones.

## Brand Personality

Serio, atlético, preciso. Voz directa y técnica, sin eufemismos ni motivación vacía. El tono es el de un cuaderno de entrenamiento de un atleta serio — no el de una app de fitness masiva con emojis y racha de 7 días.

## Anti-references

- **MyFitnessPal / Hevy**: UX corporativa, cards coloridas, íconos de músculo, gradientes de marca, gamificación superficial.
- **SaaS dashboards genéricos**: grids de métricas, chart widgets flotantes, sidebar con íconos, tipografía Inter/Poppins sobre fondo blanco, estética "herramienta de trabajo de oficina".
- **Apps de fitness influencer**: fotos de cuerpos, gradientes violeta/rosa, badges motivacionales, tono de coach.

## Design Principles

1. **Cada tap cuenta.** El usuario tiene < 90 segundos de descanso. La UI no puede requerir más de 2 taps para registrar un set completo. Reducir fricción es la prioridad #1.
2. **Los datos son la interfaz.** El contenido son ejercicios, pesos y repeticiones. La UI los sirve sin competir con ellos — sin decoración que distraiga, sin jerarquías innecesarias.
3. **Densidad con legibilidad.** Más información por pantalla que una app de fitness masiva, pero nunca a costa de la legibilidad bajo condiciones físicas adversas. Tamaño de fuente y targets táctiles deben resistir el uso en movimiento.
4. **Honestidad en el estado.** El sistema siempre sabe si hay un set hecho, un descanso activo, o una sesión en curso. El UI lo refleja con claridad inmediata, sin ambigüedad.
5. **Escala sin ruido.** El diseño debe poder acomodar nuevos usuarios sin rediseño — onboarding implícito, estados vacíos comunicativos, sin asumir contexto que el usuario no tiene.

## Accessibility & Inclusion

- WCAG 2.1 AA mínimo — contraste ≥ 4.5:1 para texto normal, ≥ 3:1 para texto grande.
- Targets táctiles ≥ 44×44px en todos los controles interactivos.
- `prefers-reduced-motion` debe ser respetado en animaciones del timer y transiciones de estado.
- DM Mono como fuente de datos — verificar legibilidad de cifras (0 vs O, 1 vs l) en pantallas pequeñas bajo iluminación de gym.
