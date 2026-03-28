// ─── English (default) ───────────────────────────────────────────────────────
const en = {
  nav: {
    capabilities: 'Capabilities',
    predictiveEngine: 'Predictive Engine',
    simulation3d: '3D Simulation',
    team: 'Team',
  },

  hero: {
    cta: 'Learn more',
  },

  longstrip: {
    title: 'Detection Capabilities',
    sections: [
      {
        title: 'Satellite Flood Monitoring (SAR Water-Mask)',
        desc: 'The system uses synthetic aperture radar (SAR) data to generate a real-time water mask. This allows detecting changes in water extent regardless of cloud cover, contrasting the current scan with historical baselines to identify overflow events.',
        cardTitle: 'Satellite Flood Monitoring',
      },
      {
        title: 'Dynamic Ecosystem Health Analysis (VCI/NDVI)',
        desc: 'Through time series of vegetation indices, the platform detects anomalies in the mangrove. It uses mathematical inference to differentiate between normal seasonal cycles and actual phytosanitary stress, triggering alerts when values fall below the resilience threshold.',
        cardTitle: 'Dynamic Health Analysis',
      },
      {
        title: 'Multi-Parameter Vulnerability Calculation',
        desc: "The engine integrates live weather variables (rain, wind) with tidal data. Through weighting algorithms, it calculates a risk index that identifies critical zones where the combination of meteorological and geographical factors exceeds the ecosystem's absorption capacity.",
        cardTitle: 'Vulnerability Calculation',
      },
      {
        title: 'Spatial Anomaly Detection',
        desc: 'The anomaly API processes geolocated data to find statistical deviations at specific map points. This detects not only floods, but also structural terrain changes or forest cover loss detected in the latest scan cycles.',
        cardTitle: 'Anomaly Detection',
      },
      {
        title: 'Alert Prediction and Triggers',
        desc: 'The system not only visualizes; it executes trigger logic that compares current telemetry against safety configurations. If rainfall millimeters or tide levels reach mathematically defined critical points, the system automates the alert status on the intelligence map.',
        cardTitle: 'Prediction and Triggers',
      },
    ],
    signals: {
      coverage: 'Coverage',
      status: 'Status',
      waterEdge: 'Water edge',
      scene: 'Scene',
      rain: 'Rain',
      tide: 'Tide',
      humidity: 'Humidity',
      protection: 'Protection',
      flags: 'Flags',
      type: 'Type',
      engine: 'Engine',
      model: 'Model',
      reading: 'Reading',
    },
  },

  mangrove: {
    projectLabel: 'Guayaquil Resilience Project',
    heading: 'MangroveShield is not just technology. It is critical infrastructure.',
    subheading: "Here are the 5 fundamental reasons for its impact on the estuary's climate resilience.",
    cards: [
      {
        tag: 'EARLY WARNING',
        title: 'Protection of Lives and Assets Against Floods',
        description: 'The system uses satellite radar and real-time data to predict flood vulnerabilities, enabling early warning for vulnerable communities in the estuary.',
        imageAlt: 'Satellite radar and floods',
      },
      {
        tag: 'CONSERVATION',
        title: 'Preservation of Natural Barriers',
        description: 'By monitoring mangrove health through the NDVI index (Sentinel-2), the natural walls that reduce storm surge and extreme wave force by up to 60% are protected.',
        imageAlt: 'Mangroves from above',
      },
      {
        tag: 'LOCAL ECONOMY',
        title: 'Food and Economic Security',
        description: "Guayaquil's mangroves are the 'nursery' of essential crustaceans and fish. Constant monitoring ensures the livelihoods of thousands of gatherers and fishermen.",
        imageAlt: 'Artisan fisherman in estuary',
      },
      {
        tag: 'BLUE CARBON',
        title: 'Climate Change Mitigation',
        description: "Identifies degradation areas for precise interventions, maximizing the estuary's capacity to sequester up to 10 times more carbon than terrestrial tropical forests.",
        imageAlt: 'Dense tropical forest and roots',
      },
      {
        tag: 'OPEN DATA',
        title: 'Evidence-Based Decision Making',
        description: 'MangroveShield democratizes access to geospatial data (SAR, NDVI, tides), enabling collaboration on conservation strategies based on real scientific data.',
        imageAlt: 'Satellite vision of the earth and data',
      },
    ],
  },

  timeline: {
    loading: 'Loading GMW v3.0 data...',
    title: 'Historical Mangrove Change',
    losses: 'Losses',
    netBalance: 'Net Balance',
    gains: 'Gains',
    coverage: 'Coverage',
    loss: 'Loss',
    gain: 'Gain',
    year: 'year',
    playing: 'Playing',
    paused: 'Paused',
    pauseLabel: 'Pause',
    playLabel: 'Play',
    selectYear: (year: number) => `Select year ${year}`,
  },

  health: {
    loading: 'Loading Sentinel-2 telemetry...',
    liveData: 'Live data · Sentinel-2 SR via GEE Pipeline → Firestore',
    calibratedData: 'Calibrated estimate · Sentinel-2 NDVI + NASA AGB v1.3 (literature)',
    compositeLabel: 'Sentinel-2 MSI · 10m · Monthly Composite',
    title: 'Ecosystem Health',
    globalHealthLabel: 'Global health index',
    readingsLabel: 'Readings',
    ndviMean: 'Mean NDVI',
    ndwiMean: 'Mean NDWI',
    period: 'Period',
    resolution: 'Resolution',
    distribution: {
      healthy: 'HEALTHY',
      moderate: 'MODERATE',
      degraded: 'DEGRADED',
      critical: 'CRITICAL',
    },
    indexMeta: {
      biomass: 'BIOMASS',
      canopyHeight: 'CANOPY HEIGHT',
    },
    chart: {
      title: 'NDVI Time Evolution',
      subtitle: '24 months · median composite per municipality',
      anomalies: 'Anomalies',
      healthyThreshold: 'Healthy threshold',
      sourceFooter: 'Source: COPERNICUS/S2_SR_HARMONIZED · NASA ORNL DAAC AGB v1.3',
      scaleLabel: (scale: string) => `CRS: EPSG:4326 · Scale: ${scale}m`,
      sourcesFooter:
        'Sources: Sentinel-2 SR Harmonized (10m) · NASA AGB v1.3, ORNL DAAC (30m) · Simard et al. (2019) Nature Geoscience · Giri et al. (2011) GEB',
      thresholdsLabel: 'NDVI Thresholds:',
      thresholdHealthy: '≥0.85 Healthy',
      thresholdModerate: '≥0.65 Moderate',
      thresholdDegraded: '≥0.40 Degraded',
      thresholdCritical: '<0.40 Critical',
    },
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },

  ecosystem: {
    title: 'Predictive Engine',
    rain: {
      titles: ['ACTIVE', 'RAINFALL'],
      unit: 'MM / HR',
      summaryAwaiting: 'Weather stream is on hold. Use Sync to request an immediate reading.',
      summaryOffline: 'Weather layer is degraded. Panel retains the last available proxy.',
      summaryLive: 'OpenWeather and hydrological proxies track hourly rainfall to anticipate saturation.',
    },
    tide: {
      titles: ['MARINE', 'OSCILLATION'],
      unit: 'METERS',
      summaryAwaiting: 'Coastal queue is inactive. Use Sync to request a sea level reading.',
      summaryOffline: 'Maritime telemetry is degraded. Engine awaiting a new coastal packet.',
      summaryLive: 'The coastal feed queries sea level to detect anomalous amplitude before intrusion.',
    },
    ndvi: {
      titles: ['NDVI', 'COVERAGE'],
      unit: 'INDEX',
      summaryWithStatus: (status: string, trend: string) =>
        `Sentinel-2 tracking mangrove vigor. Status ${status} with ${trend} trend.`,
      summaryAwaiting: 'Satellite layer on standby. Use Sync to request an NDVI reading.',
      summaryOffline: 'Ecosystem layer is degraded. Panel retains the last available index.',
      summaryBooting: 'Ecosystem engine is linking the last available satellite scene.',
    },
  },

  outcomes: {
    badgeLabel: 'System Architecture',
    title: 'Operational Mechanics',
    inspectButton: 'Inspect',
    cards: [
      {
        tag: 'GEOSPATIAL LAYERS',
        description:
          'The map integrates a water mask (water-mask) that highlights current water zones in cyan, along with a SAR satellite detection layer (sar-data) showing the most recent radar-detected flood scan.',
      },
      {
        tag: 'VULNERABILITY',
        description:
          'Circular markers are displayed on the map whose size and color indicate the risk level in specific zones; points range from green (low) to red (critical) based on their Vulnerability Score.',
      },
      {
        tag: 'HUD MONITORING',
        description:
          'A side panel (HUD) shows live readings from the backend, including the exact tide level in meters, accumulated hourly precipitation (mm/h), and the mangrove health index (NDVI).',
      },
      {
        tag: 'SMART THREAT',
        description:
          "The map features a logic engine that evaluates the combination of high tide and intense rainfall to dictate a global 'Threat Level' (Normal, Warning or Critical), displayed through a floating badge with pulse effects.",
      },
      {
        tag: 'SATELLITE CONTROL',
        description:
          'A technical display shows the date and status of the latest Sentinel-2 satellite scan, allowing users to know exactly when the ecosystem health data they are observing was acquired.',
      },
    ],
  },

  flood: {
    loading: 'Loading flood records...',
    liveData: 'Live data · Copernicus EMS + INAMHI via GEE Pipeline → Firestore',
    calibratedData:
      'Calibrated estimate · Copernicus EMS EMSR641/715 · INAMHI · SNGR · Sentinel-1 SAR',
    severity: {
      moderate: 'MODERATE',
      severe: 'SEVERE',
      extreme: 'EXTREME',
    },
    filters: {
      all: 'All',
      moderate: 'Moderate',
      severe: 'Severe',
      extreme: 'Extreme',
    },
    timelineTitle: 'Event Log — 2015–2024',
    timelineSubtitle: 'Size proportional to flooded area · Click for details',
    headlineTitle1: 'Where the mangrove was lost,',
    headlineTitle2: 'flooding follows',
    headlineDesc1: 'of flooded zones in 2023–2024 coincide with',
    headlineDesc2: 'mangrove loss areas post-2010',
    correlationTitle: 'Mangrove–flood correlation per event',
    correlationSubtitle: '% flooded area coinciding with mangrove loss post-2010',
    extremeTitle: 'Extreme events',
    extremeSubtitle: '>70 mm/day · rain + tide + mangrove loss coincidence',
    popup: {
      peakRain: 'Peak rain',
      tideLevel: 'Tide level',
      floodedArea: 'Flooded area',
      affected: 'Affected',
      mangroveCorr: 'Mangrove corr.',
      mmPerDay: 'mm/day',
      lossZones: 'loss zones',
    },
    stats: {
      affected: 'affected',
      estDamage: 'est. damage',
      mgvCorrel: 'mgv correl.',
      peopleLabel: 'people affected · zones without mangrove cover · Feb 2023',
      damageLabel: 'million USD — estimated damages Feb 2023 event',
      riskLabel: 'times greater flood risk without mangrove coverage',
    },
    sourcesTitle: 'Data sources & methodology',
    sources: [
      'Extreme events — Copernicus EMS Rapid Mapping EMSR641 (Feb 2023), EMSR715 (Jan 2024)',
      'Hydrometeorological records — INAMHI Ecuador, daily series 2015–2024',
      'Impact reports — SNGR Risk Management Secretariat, situation reports',
      'SAR water — Sentinel-1 GRD (COPERNICUS/S1_GRD), VV polarization, threshold < -16 dB, GEE',
      'Mangrove loss — GMW v3.0 Bunting et al. (2022) DOI:10.1038/s41597-022-01574-5',
      'Correlation index — freq_inund × (1 − mangrove_cover_2024); critical threshold > 0.70',
      'Factor 3.2× — Spalding et al. (2014) Nature, coastal protection value of mangroves',
      'Bbox — Gran Guayaquil -80.1, -2.4, -79.4, -1.7 · CRS: EPSG:4326',
    ],
  },

  simulation: {
    webglLabel: 'WebGL Simulation',
    title: 'Mangrove\nIsland 3D',
    subtitle: 'Stylized interactive living world. Drag to orbit and explore the ecosystem.',
    status: {
      alive: { badge: 'ALIVE PROTECTED ISLAND', title: 'Perfect Equilibrium', text: 'Birds fly, MangroveShield flowers thrive and the water is crystal clear.' },
      alert: { badge: 'ENVIRONMENTAL ALERT',   title: 'Fragmentation in progress', text: 'Clouds darken, water rises and the mangrove layer begins to disappear.' },
      critical: { badge: 'CRITICAL FLOOD LEVEL', title: 'Total Disaster Without Mangroves', text: 'Flora drowns and water floods the city as the natural coastal barrier is lost.' },
    },
    ecosystemIntegrity: 'ECOSYSTEM INTEGRITY',
    optimalHealth: 'Optimal Health',
    environmentalDamage: 'Environmental Damage',
    hintOrbit: '[ Drag to view the 3D camera · Scroll to zoom ]',
  },

  team: {
    heading: 'Meet our team',
    description: 'ESPOL students passionate about technological innovation, design and environmental conservation.',
    linkedinLabel: 'LinkedIn Profile',
  },
};

// ─── Derive type & Language union ────────────────────────────────────────────
export type Translations = typeof en;
export type Language = 'en' | 'es';

// ─── Spanish ─────────────────────────────────────────────────────────────────
const es: Translations = {
  nav: {
    capabilities: 'Capacidades',
    predictiveEngine: 'Motor Predictivo',
    simulation3d: 'Simulacion3D',
    team: 'Equipo',
  },

  hero: {
    cta: 'Conoce más',
  },

  longstrip: {
    title: 'Capacidades De Detección',
    sections: [
      {
        title: 'Monitoreo Satelital de Inundaciones (SAR Water-Mask)',
        desc: 'El sistema utiliza datos de radar de apertura sintética (SAR) para generar una máscara hídrica en tiempo real. Esto permite detectar cambios en la extensión del agua independientemente de la nubosidad, contrastando el escaneo actual con líneas base históricas para identificar desbordamientos.',
        cardTitle: 'Monitoreo Satelital de Inundaciones',
      },
      {
        title: 'Análisis Dinámico de Salud del Ecosistema (VCI/NDVI)',
        desc: 'A través de series temporales de índices de vegetación, la plataforma detecta anomalías en el mangle. Utiliza inferencia matemática para diferenciar entre ciclos estacionales normales y estrés fitosanitario real, activando alertas cuando los valores caen por debajo del umbral de resiliencia.',
        cardTitle: 'Análisis Dinámico de Salud',
      },
      {
        title: 'Cálculo de Vulnerabilidad Multiparamétrica',
        desc: 'El motor integra variables de clima en vivo (lluvia, viento) con datos de mareas. Mediante algoritmos de ponderación, calcula un índice de riesgo que identifica zonas críticas donde la combinación de factores meteorológicos y geográficos supera la capacidad de absorción del ecosistema.',
        cardTitle: 'Cálculo de Vulnerabilidad',
      },
      {
        title: 'Detección de Anomalías Espaciales',
        desc: 'La API de anomalías procesa datos geolocalizados para encontrar desviaciones estadísticas en puntos específicos del mapa. Esto no solo detecta inundaciones, sino también cambios estructurales en el terreno o pérdida de cobertura forestal detectada en los últimos ciclos de escaneo.',
        cardTitle: 'Detección de Anomalías',
      },
      {
        title: 'Predicción y Triggers de Alerta',
        desc: "El sistema no solo visualiza; ejecuta una lógica de 'triggers' (activadores) que compara la telemetría actual con configuraciones de seguridad. Si los milímetros de lluvia o el nivel de marea alcanzan puntos críticos definidos matemáticamente, el sistema automatiza el estado de alerta en el mapa de inteligencia.",
        cardTitle: 'Predicción y Triggers',
      },
    ],
    signals: {
      coverage: 'Cobertura',
      status: 'Estado',
      waterEdge: 'Límite agua',
      scene: 'Escena',
      rain: 'Lluvia',
      tide: 'Marea',
      humidity: 'Humedad',
      protection: 'Protección',
      flags: 'Flags',
      type: 'Tipo',
      engine: 'Motor',
      model: 'Modelo',
      reading: 'Lectura',
    },
  },

  mangrove: {
    projectLabel: 'Proyecto Resiliencia Guayaquil',
    heading: 'MangroveShield no es solo tecnología. Es infraestructura crítica.',
    subheading:
      'Aquí presentamos las 5 razones fundamentales de su impacto en la resiliencia climática del estuario.',
    cards: [
      {
        tag: 'ALERTA TEMPRANA',
        title: 'Protección de Vidas y Bienes Contra Inundaciones',
        description:
          'El sistema utiliza radar satelital y datos en tiempo real para predecir vulnerabilidades ante inundaciones, permitiendo una alerta temprana para comunidades vulnerables en el estuario.',
        imageAlt: 'Radar satelital e inundaciones',
      },
      {
        tag: 'CONSERVACIÓN',
        title: 'Preservación de Barreras Naturales',
        description:
          'Al monitorear la salud del manglar mediante el índice NDVI (Sentinel-2), se protegen los muros naturales que reducen hasta en un 60% la fuerza de las marejadas y el oleaje extremo.',
        imageAlt: 'Manglares desde arriba',
      },
      {
        tag: 'ECONOMÍA LOCAL',
        title: 'Seguridad Alimentaria y Económica',
        description:
          "Los manglares de Guayaquil son la 'sala de maternidad' de crustáceos y peces esenciales. El monitoreo constante asegura los medios de vida de miles de recolectores y pescadores.",
        imageAlt: 'Pescador artesanal en estuario',
      },
      {
        tag: 'CARBONO AZUL',
        title: 'Mitigación del Cambio Climático',
        description:
          'Identifica áreas de degradación para intervenciones precisas, maximizando la capacidad del estuario para secuestrar hasta 10 veces más carbono que los bosques tropicales terrestres.',
        imageAlt: 'Bosque tropical denso y raíces',
      },
      {
        tag: 'DATOS ABIERTOS',
        title: 'Toma de Decisiones Basada en Evidencia',
        description:
          'MangroveShield democratiza el acceso a datos geoespaciales (SAR, NDVI, mareas), permitiendo colaborar en estrategias de conservación basadas en datos científicos reales.',
        imageAlt: 'Visión satelital de la tierra y datos',
      },
    ],
  },

  timeline: {
    loading: 'Cargando datos GMW v3.0...',
    title: 'Cambio Histórico del Manglar',
    losses: 'Pérdidas',
    netBalance: 'Balance Neto',
    gains: 'Ganancias',
    coverage: 'Cobertura',
    loss: 'Pérdida',
    gain: 'Ganancia',
    year: 'año',
    playing: 'Reproduciendo',
    paused: 'Pausado',
    pauseLabel: 'Pausar',
    playLabel: 'Reproducir',
    selectYear: (year: number) => `Seleccionar año ${year}`,
  },

  health: {
    loading: 'Cargando telemetría Sentinel-2...',
    liveData: 'Datos en vivo · Sentinel-2 SR via GEE Pipeline → Firestore',
    calibratedData: 'Estimación calibrada · Sentinel-2 NDVI + NASA AGB v1.3 (literatura)',
    compositeLabel: 'Sentinel-2 MSI · 10m · Compuesto Mensual',
    title: 'Salud del Ecosistema',
    globalHealthLabel: 'Índice de salud global',
    readingsLabel: 'Lecturas',
    ndviMean: 'NDVI medio',
    ndwiMean: 'NDWI medio',
    period: 'Periodo',
    resolution: 'Resolución',
    distribution: {
      healthy: 'SANO',
      moderate: 'MODERADO',
      degraded: 'DEGRADADO',
      critical: 'CRÍTICO',
    },
    indexMeta: {
      biomass: 'BIOMASA',
      canopyHeight: 'ALTURA DOSEL',
    },
    chart: {
      title: 'Evolución Temporal NDVI',
      subtitle: '24 meses · compuesto mediana por municipio',
      anomalies: 'Anomalías',
      healthyThreshold: 'Umbral sano',
      sourceFooter: 'Fuente: COPERNICUS/S2_SR_HARMONIZED · NASA ORNL DAAC AGB v1.3',
      scaleLabel: (scale: string) => `CRS: EPSG:4326 · Escala: ${scale}m`,
      sourcesFooter:
        'Fuentes: Sentinel-2 SR Harmonized (10m) · NASA AGB v1.3, ORNL DAAC (30m) · Simard et al. (2019) Nature Geoscience · Giri et al. (2011) GEB',
      thresholdsLabel: 'Umbrales NDVI:',
      thresholdHealthy: '≥0.85 Sano',
      thresholdModerate: '≥0.65 Moderado',
      thresholdDegraded: '≥0.40 Degradado',
      thresholdCritical: '<0.40 Crítico',
    },
    months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  },

  ecosystem: {
    title: 'Motor Predictivo',
    rain: {
      titles: ['PRECIPITACION', 'ACTIVA'],
      unit: 'MM / HR',
      summaryAwaiting:
        'El stream meteorologico esta en espera. Usa Sync para solicitar una lectura inmediata.',
      summaryOffline:
        'La capa meteorologica esta degradada. El panel conserva el ultimo proxy disponible.',
      summaryLive:
        'OpenWeather y los proxies hidrologicos siguen la lluvia horaria para anticipar saturacion.',
    },
    tide: {
      titles: ['OSCILACION', 'MARITIMA'],
      unit: 'METROS',
      summaryAwaiting:
        'La cola costera esta inactiva. Usa Sync para pedir una lectura de nivel del mar.',
      summaryOffline:
        'La telemetria maritima esta degradada. El motor espera un nuevo paquete costero.',
      summaryLive:
        'El feed costero consulta el nivel del mar para detectar amplitud anomala antes de la intrusion.',
    },
    ndvi: {
      titles: ['COBERTURA', 'NDVI'],
      unit: 'INDICE',
      summaryWithStatus: (status: string, trend: string) =>
        `Sentinel-2 sigue el vigor del manglar. Estado ${status} con tendencia ${trend}.`,
      summaryAwaiting: 'La capa satelital esta en espera. Usa Sync para solicitar una lectura NDVI.',
      summaryOffline:
        'La capa ecosistemica esta degradada. El panel conserva el ultimo indice disponible.',
      summaryBooting: 'El motor ecosistemico esta enlazando la ultima escena satelital disponible.',
    },
  },

  outcomes: {
    badgeLabel: 'Arquitectura del Sistema',
    title: 'Mecánica Operativa',
    inspectButton: 'Inspeccionar',
    cards: [
      {
        tag: 'CAPAS GEOESPACIALES',
        description:
          'El mapa integra una máscara de agua (water-mask) que resalta las zonas hídricas actuales en un tono cian, junto con una capa de detección satelital SAR (sar-data) que muestra el escaneo más reciente de inundaciones detectadas por radar.',
      },
      {
        tag: 'VULNERABILIDAD',
        description:
          "Se despliegan marcadores circulares sobre el mapa cuyo tamaño y color indican el nivel de riesgo en zonas específicas; los puntos varían desde verde (bajo) hasta rojo (crítico) según su 'Vulnerability Score'.",
      },
      {
        tag: 'MONITOREO HUD',
        description:
          'Un panel lateral (HUD) muestra lecturas en vivo provenientes del backend, incluyendo el nivel de marea exacto en metros, la precipitación acumulada por hora (mm/h) y el índice de salud del manglar (NDVI).',
      },
      {
        tag: 'AMENAZA INTELIGENTE',
        description:
          "El mapa cuenta con un motor de lógica que evalúa la combinación de marea alta y lluvias intensas para dictar un 'Nivel de Amenaza' global (Normal, Warning o Critical), visualizado mediante un distintivo flotante con efectos de pulso.",
      },
      {
        tag: 'CONTROL SATELITAL',
        description:
          'Se incluye una visualización técnica que muestra la fecha y el estado del último escaneo del satélite Sentinel-2, permitiendo al usuario saber exactamente cuándo se adquirieron los datos de salud ecosistémica que está observando.',
      },
    ],
  },

  flood: {
    loading: 'Cargando registros de inundación...',
    liveData: 'Datos en vivo · Copernicus EMS + INAMHI via GEE Pipeline → Firestore',
    calibratedData:
      'Estimación calibrada · Copernicus EMS EMSR641/715 · INAMHI · SNGR · Sentinel-1 SAR',
    severity: {
      moderate: 'MODERADO',
      severe: 'SEVERO',
      extreme: 'EXTREMO',
    },
    filters: {
      all: 'Todos',
      moderate: 'Moderados',
      severe: 'Severos',
      extreme: 'Extremos',
    },
    timelineTitle: 'Registro de Eventos — 2015–2024',
    timelineSubtitle: 'Tamaño proporcional a área inundada · Click para detalles',
    headlineTitle1: 'Donde se perdió el manglar,',
    headlineTitle2: 'llega la inundación',
    headlineDesc1: 'de las zonas inundadas en 2023–2024 coinciden con',
    headlineDesc2: 'áreas de pérdida de manglar post-2010',
    correlationTitle: 'Correlación manglar–inundación por evento',
    correlationSubtitle: '% área inundada coincidente con pérdida manglar post-2010',
    extremeTitle: 'Eventos extremos',
    extremeSubtitle: '>70 mm/día · coincidencia lluvia + marea + pérdida manglar',
    popup: {
      peakRain: 'Lluvia pico',
      tideLevel: 'Nivel de marea',
      floodedArea: 'Área inundada',
      affected: 'Afectados',
      mangroveCorr: 'Correlac. manglar',
      mmPerDay: 'mm/día',
      lossZones: 'zonas pérdida',
    },
    stats: {
      affected: 'afectados',
      estDamage: 'daños est.',
      mgvCorrel: 'correl. mgv',
      peopleLabel: 'personas afectadas · zonas sin cobertura manglar · Feb 2023',
      damageLabel: 'millones USD — daños estimados evento Feb 2023',
      riskLabel: 'veces más riesgo de inundación sin cobertura de manglar',
    },
    sourcesTitle: 'Fuentes de datos & metodología',
    sources: [
      'Eventos extremos — Copernicus EMS Rapid Mapping EMSR641 (Feb 2023), EMSR715 (Ene 2024)',
      'Registros hidrometeorológicos — INAMHI Ecuador, series diarias 2015–2024',
      'Reportes de afectación — SNGR Secretaría de Gestión de Riesgos, informes de situación',
      'Agua SAR — Sentinel-1 GRD (COPERNICUS/S1_GRD), VV polarización, umbral < -16 dB, GEE',
      'Pérdida manglar — GMW v3.0 Bunting et al. (2022) DOI:10.1038/s41597-022-01574-5',
      'Índice correlación — freq_inund × (1 − cobertura_manglar_2024); umbral crítico > 0.70',
      'Factor 3.2× — Spalding et al. (2014) Nature, coastal protection value of mangroves',
      'Bbox — Gran Guayaquil -80.1, -2.4, -79.4, -1.7 · CRS: EPSG:4326',
    ],
  },

  simulation: {
    webglLabel: 'Simulación WebGL',
    title: 'Mangrove\nIsland 3D',
    subtitle: 'Mundo vivo estilizado interactivo. Arrastra para orbitar y explora el ecosistema.',
    status: {
      alive:    { badge: 'ISLA VIVA PROTEGIDA',       title: 'Equilibrio Perfecto',              text: 'Las aves vuelan, las flores de MangroveShield prosperan y el agua está cristalina.' },
      alert:    { badge: 'ALERTA AMBIENTAL',           title: 'Fragmentación en progreso',        text: 'Las nubes oscurecen, el agua sube y la capa de manglares comienza a desaparecer.' },
      critical: { badge: 'NIVEL DE INUNDACIÓN CRÍTICO', title: 'Desastre Total Sin Manglares',  text: 'La flora se ahoga y el agua inunda la ciudad al perder la barrera costera natural.' },
    },
    ecosystemIntegrity: 'INTEGRIDAD DEL ECOSISTEMA',
    optimalHealth: 'Salud Óptima',
    environmentalDamage: 'Daño Ambiental',
    hintOrbit: '[ Arrastra para ver la cámara 3D · Rueda para hacer zoom ]',
  },

  team: {
    heading: 'Conoce nuestro equipo',
    description: 'Estudiantes de ESPOL apasionados por la innovación tecnológica, el diseño y la conservación ambiental.',
    linkedinLabel: 'Perfil de LinkedIn',
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────
export const translations: Record<Language, Translations> = { en, es };
