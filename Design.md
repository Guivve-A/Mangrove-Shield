---
name: design
description: Diseño UI/UX para páginas web basadas en datos (dashboards, timelines, analíticas) con enfoque minimalista. Usar cuando necesites: (1) reestructurar la disposición/jerarquía de métricas y gráficos, (2) definir una cuadrícula estricta y reglas de proximidad/contraste/repetición, (3) convertir texto en visualizaciones, (4) proponer componentes y microinteracciones para exploración temporal.
---

# Design (Skill) — Disposición de Datos Web Minimalista

## Cómo usar
1) Copia el **Prompt Base** y pega en tu modelo favorito.  
2) Rellena las variables entre corchetes `[]`.  
3) Exige que la respuesta salga en el formato “Salida esperada”.

## Prompt Base (copia y pega)
```text
Actúa como un diseñador UI/UX senior especializado en productos de datos. Tu tarea es rediseñar por completo la estructura visual y la disposición de información para una página web sobre:

TEMA: [TEMÁTICA DE LOS DATOS]
AUDIENCIA: [TIPO DE USUARIO: público general / técnico / tomadores de decisión]
OBJETIVO PRINCIPAL DE LA PÁGINA: [qué decisión/insight debe permitir]
TONO VISUAL: minimalista, limpio, alto orden visual, sin saturación.

CONTEXTO DE DATOS (resúmelo en 1–2 líneas y úsalo para definir jerarquías):
- Resumen global (KPIs): [lista de KPIs globales]
- Serie temporal / timeline: [unidad temporal, rango]
- Métricas por punto temporal: [lista de métricas por año/mes/etc.]
- Métricas derivadas permitidas: [p. ej., acumulados, variaciones, rankings]
- Acciones/interacción requeridas: [p. ej., selector de año, autoplay, click en gráfico, tooltips]

REGLAS NO NEGOCIABLES (pilares de diseño):
1) Proximidad: agrupa en tarjetas/bloques cercanos solo lo que responde a la misma pregunta del usuario.
2) Alineación: usa una cuadrícula estricta (12 columnas) y alinea títulos, métricas y ejes; evita overlays “flotantes” sin anclaje.
3) Repetición: reutiliza los mismos patrones de tarjeta, espaciados y estilos (títulos, subtítulos, cifras, leyendas) en toda la página.
4) Contraste/Jerarquía: en CADA sección elige 1 métrica principal (hero metric) y resáltala SOLO con (a) mayor tamaño y peso, o (b) un color de acento; el resto debe verse claramente secundario.
5) Legibilidad: usa SOLO tipografías sans-serif (sin subrayados). Máx. 2 pesos (regular/bold). Activa números tabulares si aplica.
6) Apoyo visual: no uses párrafos largos. Máx. 2 líneas de texto por bloque; el resto debe ser gráfico/diagrama/ilustración o microcopys.

PALETA Y TOKENS (define y respeta consistencia):
- Fondo: [color base]
- Superficies/tarjetas: [color + borde sutil]
- Texto: [primario, secundario, tertiary]
- Acentos: [Acento 1 = “positivo/cobertura”, Acento 2 = “negativo/pérdida”, Acento 3 = “neutro/alerta”]
- Regla: el acento solo se usa para el hero metric de cada sección + elementos interactivos (focus/selección).

SALIDA ESPERADA (formato obligatorio):
A) Arquitectura de página (secciones en orden):
   - Para cada sección: propósito (1 línea), hero metric (1), métricas secundarias (2–4), visualización principal (1), interacción (si aplica).
B) Layout por breakpoints (mobile / tablet / desktop):
   - Desktop: define una grilla 12-col con proporciones (ej. 7/5, 8/4). Indica alineaciones y gutters.
   - Mobile: especifica orden vertical y qué se colapsa/oculta.
C) Componentes reutilizables:
   - “KPI Card”, “Selected Point Panel”, “Timeline Control”, “Chart Card”, “Legend/Key”, “Data Provenance”.
   - Para cada componente: contenido, jerarquía tipográfica, estados (default/hover/active/disabled), y ejemplo de microcopy.
D) Sustituciones de texto → visual:
   - Lista de 3–6 reemplazos concretos (p. ej., “explicación larga” → “diagrama simple + 1 frase”).
E) Checklist de implementación (UI):
   - 8–12 checks accionables para que un dev implemente el layout sin ambigüedades.
F) Validación por pilares (muy breve):
   - 1–2 bullets por: Proximidad, Alineación, Repetición, Contraste/Jerarquía, Legibilidad, Apoyo visual.

IMPORTANTE:
- Evita duplicar la misma métrica en dos lugares visibles a la vez.
- Prioriza exploración: el usuario debe entender “qué pasó”, “cuándo”, “cuánto” en menos de 10 segundos.
- No incluyas código. Entrega un blueprint claro y ejecutable.
```

## Salida esperada (plantilla)
- Si quieres, pega aquí el esquema de tu sección (KPIs, charts, filtros) y relleno el prompt con tus datos reales.

## Ejemplo listo — MangroveTimelineSection (Gran Guayaquil)
```text
Actúa como un diseñador UI/UX senior especializado en productos de datos. Rediseña por completo la disposición de información para una sección web de “cambio histórico de manglar” (estilo dashboard minimalista).

TEMA: Cambio histórico de cobertura de manglar (Gran Guayaquil) 2014–2024
AUDIENCIA: tomadores de decisión + público general informado
OBJETIVO PRINCIPAL: entender rápidamente la tendencia (cobertura total), la pérdida acumulada y el balance (ganancia vs pérdida), y explorar un año específico con contexto.
TONO VISUAL: minimalista, limpio, oscuro (navy) con acentos controlados.

CONTEXTO DE DATOS:
- Resumen global (KPIs):
  - total_loss_ha (pérdidas totales 2014–2024, ha)
  - total_gain_ha (ganancias totales 2014–2024, ha)
  - net_change_ha (balance neto 2014–2024, ha)
- Serie temporal (por año 2014–2024):
  - year
  - total_ha (cobertura total, ha)
  - loss_ha (pérdida del año, ha)
  - gain_ha (ganancia del año, ha)
  - delta_ha (cambio neto del año, ha)
  - loss_rate_pct (tasa de pérdida anual, %)
- Métricas derivadas permitidas:
  - cumulative_loss (suma acumulada de loss_ha)
  - “mejor año / peor año” por delta_ha
- Interacciones requeridas:
  - Control tipo timeline (selección de año + play/pause)
  - Click en el gráfico → cambia el año seleccionado
  - Tooltip claro en el gráfico
  - Panel de “año seleccionado” con comparación vs año previo
- Proveniencia de datos:
  - badge según _source: firestore (en vivo) / calibrated_estimate (estimación) / api

REGLAS DE DISEÑO (no negociables):
1) Proximidad: agrupa en 3–4 bloques: (a) Resumen global, (b) Exploración por año, (c) Tendencia/series, (d) Fuentes/metodología (compacto).
2) Alineación: grilla 12-col estricta; evita stats “flotantes” sin anclaje; todo debe vivir dentro de tarjetas alineadas.
3) Repetición: mismas tarjetas, mismas escalas tipográficas, mismas leyendas y estilos de ejes.
4) Contraste: por bloque elige 1 hero metric:
   - Resumen global: net_change_ha (o total_loss_ha si el enfoque es alerta)
   - Exploración por año: delta_ha del año seleccionado
   - Tendencia: total_ha (línea/área) como foco; cumulative_loss como secundario
   El hero metric debe destacarse y lo demás mantenerse secundario.
5) Tipografía: solo sans-serif (sin monospace, sin subrayados). Usa números tabulares.
6) No texto largo: máximo 2 líneas de texto por tarjeta; prioriza gráficos (línea/área, barras, mini-sparklines, donut simple).

PALETA (consistente):
- Fondo: #0a1628
- Superficie tarjeta: #0d1a2e con borde blanco al 8–10%
- Texto: blanco 85% (primario), 55% (secundario), 30% (terciario)
- Acentos: cobertura = verde/emerald; pérdida = rojo; ganancia = cian; alerta/neutral = ámbar
- Regla: el acento se usa solo en hero metric + elementos activos/seleccionados.

SALIDA ESPERADA (formato obligatorio):
A) Arquitectura de página (secciones en orden) con propósito, hero metric, secundarias, visual principal e interacción.
B) Layout por breakpoints:
   - Desktop: 12-col; propone una composición tipo “8/4” o “7/5” para (visual principal / panel de año seleccionado).
   - Mobile: orden vertical; el control de año siempre visible; evita overlays.
C) Componentes reutilizables:
   - KPI Summary Row (3 cards)
   - Selected Year Panel (card con delta_ha como hero + loss/gain + loss_rate_pct)
   - Timeline Control (con play/pause integrado y estados)
   - Trend Chart Card (área total_ha + línea cumulative_loss; leyenda compacta)
   - Data Provenance (badge)
   - Sources/Method (colapsable o micro-footer)
D) Sustituciones texto→visual: al menos 4.
E) Checklist de implementación UI (10 checks).
F) Validación por pilares (muy breve): 1–2 bullets por pilar.

IMPORTANTE:
- No dupliques la misma cifra (por ejemplo total_ha) en 2 lugares prominentes simultáneamente.
- El usuario debe captar tendencia + impacto en 10 segundos.
- No incluyas código.
```
