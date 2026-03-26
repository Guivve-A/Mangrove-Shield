import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronRight, Radar, Trees, Waves, AlertTriangle } from 'lucide-react';
import type { LiveData } from '@/hooks/useLiveData';

interface LongstripSectionProps {
  liveData: LiveData;
}

interface DetectionSection {
  number: string;
  title: string;
  desc: string;
  cardTitle: string;
  bg: string;
  icon: React.ReactNode;
  metric: string;
  graphic: 'sar' | 'environment' | 'ecosystem' | 'anomaly' | 'stress';
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Syncing';
  return `${Math.round(value * 100)}%`;
}

function formatCount(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Syncing';
  return `${value}`;
}

export function LongstripSection({ liveData }: LongstripSectionProps): JSX.Element {
  const weather = liveData.weather.data;
  const waterMask = liveData.waterMask.data;
  const ecosystem = liveData.ecosystemHealth.data;
  const anomalies = liveData.anomalies.data;
  const vulnerability = liveData.vulnerability.data;

  const sections = useMemo<DetectionSection[]>(
    () => [
      {
        number: '01',
        title: 'Monitoreo Satelital de Inundaciones (SAR Water-Mask)',
        desc: 'El sistema utiliza datos de radar de apertura sintética (SAR) para generar una máscara hídrica en tiempo real. Esto permite detectar cambios en la extensión del agua independientemente de la nubosidad, contrastando el escaneo actual con líneas base históricas para identificar desbordamientos.',
        cardTitle: 'Monitoreo Satelital de Inundaciones',
        bg: '/assets/detection/detection-stage-01-sar.webp',
        icon: <Radar className="w-5 h-5 text-white/85" />,
        metric: waterMask?.scene.scene_id ? `Scene ${waterMask.scene.scene_id}` : 'Radar feed active',
        graphic: 'sar',
      },
      {
        number: '02',
        title: 'Análisis Dinámico de Salud del Ecosistema (VCI/NDVI)',
        desc: 'A través de series temporales de índices de vegetación, la plataforma detecta anomalías en el mangle. Utiliza inferencia matemática para diferenciar entre ciclos estacionales normales y estrés fitosanitario real, activando alertas cuando los valores caen por debajo del umbral de resiliencia.',
        cardTitle: 'Análisis Dinámico de Salud',
        bg: '/assets/detection/detection-stage-02-environment.webp',
        icon: <Waves className="w-5 h-5 text-white/85" />,
        metric: weather
          ? `Rain ${weather.weather_now.rain_mm_h} mm/h • Tide ${formatPercent(weather.proxies.tidal_stage_proxy)}`
          : 'Weather feed active',
        graphic: 'environment',
      },
      {
        number: '03',
        title: 'Cálculo de Vulnerabilidad Multiparamétrica',
        desc: 'El motor integra variables de clima en vivo (lluvia, viento) con datos de mareas. Mediante algoritmos de ponderación, calcula un índice de riesgo que identifica zonas críticas donde la combinación de factores meteorológicos y geográficos supera la capacidad de absorción del ecosistema.',
        cardTitle: 'Cálculo de Vulnerabilidad',
        bg: '/assets/detection/detection-stage-03-mangroves.webp',
        icon: <Trees className="w-5 h-5 text-white/85" />,
        metric: ecosystem ? `Health ${formatPercent(ecosystem.health_index)}` : 'Coverage layer active',
        graphic: 'ecosystem',
      },
      {
        number: '04',
        title: 'Detección de Anomalías Espaciales',
        desc: 'La API de anomalías procesa datos geolocalizados para encontrar desviaciones estadísticas en puntos específicos del mapa. Esto no solo detecta inundaciones, sino también cambios estructurales en el terreno o pérdida de cobertura forestal detectada en los últimos ciclos de escaneo.',
        cardTitle: 'Detección de Anomalías',
        bg: '/assets/detection/detection-stage-04-anomaly.webp',
        icon: <AlertTriangle className="w-5 h-5 text-white/85" />,
        metric: anomalies ? `${formatCount(anomalies.anomalies.length)} flagged` : 'Anomaly engine active',
        graphic: 'anomaly',
      },
      {
        number: '05',
        title: 'Predicción y Triggers de Alerta',
        desc: 'El sistema no solo visualiza; ejecuta una lógica de "triggers" (activadores) que compara la telemetría actual con configuraciones de seguridad. Si los milímetros de lluvia o el nivel de marea alcanzan puntos críticos definidos matemáticamente, el sistema automatiza el estado de alerta en el mapa de inteligencia.',
        cardTitle: 'Predicción y Triggers',
        bg: '/assets/detection/detection-stage-05-stress.webp',
        icon: <Activity className="w-5 h-5 text-white/85" />,
        metric: vulnerability ? `Stress ${vulnerability.vulnerability_index_100}/100` : 'Stress index active',
        graphic: 'stress',
      },
    ],
    [weather, waterMask, ecosystem, anomalies, vulnerability]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const textRefs = useRef<Array<HTMLDivElement | null>>([]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardMousePos, setCardMousePos] = useState({ x: -1000, y: -1000 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCardMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visibleEntries.length) return;

        const nextIndex = Number(visibleEntries[0].target.getAttribute('data-index'));
        setActiveIndex(nextIndex);
      },
      {
        rootMargin: '-35% 0px -35% 0px',
        threshold: [0.2, 0.35, 0.5, 0.65],
      }
    );

    const refs = textRefs.current;
    refs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      refs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <section id="longstrip" className="relative min-h-screen bg-[#07141d] text-white selection:bg-white/20 [clip-path:inset(0)]">
      <div id="mangrove-longstrip" className="pointer-events-none absolute top-0 h-px w-px" />

      {/* Fondos fijos que cambian */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {sections.map((section, i) => (
          <div
            key={section.number}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
            style={{ opacity: activeIndex === i ? 1 : 0 }}
          >
            <img
              src={section.bg}
              alt={section.title}
              className="h-full w-full object-cover scale-[1.03]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,18,0.10)_0%,rgba(4,12,18,0.18)_24%,rgba(4,12,18,0.34)_58%,rgba(4,12,18,0.56)_100%),linear-gradient(90deg,rgba(4,12,18,0.74)_0%,rgba(4,12,18,0.58)_18%,rgba(4,12,18,0.36)_38%,rgba(4,12,18,0.18)_58%,rgba(4,12,18,0.14)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_0.7px,transparent_0.7px)] bg-[size:16px_16px] opacity-[0.03] mix-blend-soft-light" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.05]" />
          </div>
        ))}
      </div>

      {/* --- NUEVO TÍTULO HERO CENTRADO CON LÍNEAS --- */}
      <div className="relative z-20 w-full flex justify-center items-center min-h-[55vh] pt-[10vh] px-4">
        <div className="w-full max-w-[90%] md:max-w-5xl text-center relative py-10 md:py-14">
          {/* Línea horizontal superior */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/40"></div>

          <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-sans font-normal tracking-wide uppercase leading-[1.1] text-white drop-shadow-md">
            Capacidades De  <br /> Detección
          </h1>

          {/* Línea horizontal inferior */}
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/40"></div>
        </div>
      </div>

      {/* Layout principal */}
      <div className="relative flex flex-col md:flex-row pt-40">
        {/* Columna izquierda (Sidebar de texto) */}
        <div className="relative z-20 w-full md:w-[42%] pl-6 sm:pl-10 md:pl-16 lg:pl-[10%] xl:pl-[12%] pr-10">
          {sections.map((section, i) => {
            const isActive = activeIndex === i;
            const isPast = i < activeIndex;

            return (
              <div
                key={section.number}
                data-index={i}
                ref={(el) => {
                  textRefs.current[i] = el;
                }}
                className={`flex items-start gap-5 pt-10 transition-all duration-700 ease-out ${i === 0 ? 'min-h-[45vh]' : 'min-h-[60vh]'
                  }`}
                style={{
                  opacity: isActive ? 1 : isPast ? 0.08 : 0.24,
                  transform: `translateY(${isActive ? '0px' : isPast ? '-18px' : '18px'})`,
                  filter: isActive ? 'blur(0px)' : 'blur(0.25px)',
                }}
              >
                <span className="mt-1 min-w-[4.3rem] font-mono text-[clamp(24px,3vw,34px)] tracking-[-0.02em] text-inherit">
                  {section.number}.
                </span>

                <div className="min-w-0">
                  <h3 className="max-w-[18ch] font-[var(--font-inter)] text-[clamp(30px,3.05vw,58px)] font-semibold leading-[0.98] tracking-[-0.05em] text-inherit">
                    {section.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>

        {/* Columna derecha sticky (Tarjeta) */}
        <div className="hidden md:flex md:w-[58%] justify-start pl-[120px] pr-20">
          <div className="sticky top-0 h-screen w-full flex items-center justify-start">
            {/* NUEVO WRAPPER: Añade perspectiva y agrupa las capas */}
            <div className="relative w-full max-w-[880px] group perspective-1000">

              {/* Capa de fondo 2 (Visualmente más lejana) */}
              <div className="absolute top-[-16px] right-[-16px] w-full h-full bg-white/5 border border-white/10 rounded-[30px] backdrop-blur-sm -z-20 transition-transform duration-700 ease-out group-hover:translate-x-2 group-hover:-translate-y-2"></div>

              {/* Capa de fondo 1 (Media) */}
              <div className="absolute top-[-8px] right-[-8px] w-full h-full bg-white/10 border border-white/10 rounded-[30px] backdrop-blur-md -z-10 transition-transform duration-700 ease-out group-hover:translate-x-1 group-hover:-translate-y-1"></div>

              {/* TU CONTENEDOR ORIGINAL MODIFICADO */}
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                className="relative min-h-[420px] overflow-hidden rounded-[30px] border border-white/20 bg-white/10 shadow-[0_28px_100px_-50px_rgba(0,0,0,0.5)] backdrop-blur-[22px] transition-all duration-500"
              >
                {/* NUEVO: Glow Tracker (Linterna interactiva) */}
                <div
                  className="absolute pointer-events-none rounded-full blur-[80px] opacity-0 transition-opacity duration-300 group-hover:opacity-50 z-0"
                  style={{
                    width: '400px',
                    height: '400px',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
                    left: cardMousePos.x,
                    top: cardMousePos.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                />

                {/* Grid Técnico Decorativo */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                <div className="relative z-10 w-full h-full">
                  <div className="flex min-h-[68px] items-center justify-between border-b border-white/15 px-5 py-4">
                    <div className="text-white/90">{sections[activeIndex].icon}</div>
                    <span className="inline-flex h-9 min-w-[52px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 font-mono text-[11px] font-semibold tracking-[0.14em] text-white/90">
                      {sections[activeIndex].number}
                    </span>
                  </div>

                  <div className="relative p-7">
                    {sections.map((section, i) => (
                      <div
                        key={section.number}
                        className={`absolute inset-x-7 top-7 transition-all duration-700 ease-out ${activeIndex === i
                          ? 'translate-y-0 opacity-100'
                          : 'pointer-events-none translate-y-8 opacity-0'
                          }`}
                      >
                        <h4 className="max-w-[620px] text-[clamp(34px,3.3vw,60px)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
                          {section.cardTitle}
                        </h4>

                        <p className="mt-4 max-w-[620px] text-[clamp(18px,1.12vw,20px)] leading-[1.72] text-white/82">
                          {section.desc}
                        </p>
                      </div>
                    ))}

                    <div className="invisible">
                      <h4 className="max-w-[620px] text-[clamp(34px,3.3vw,60px)] font-semibold leading-[0.98] tracking-[-0.05em]">
                        {sections[activeIndex].cardTitle}
                      </h4>
                      <p className="mt-4 max-w-[620px] text-[clamp(18px,1.12vw,20px)] leading-[1.72]">
                        {sections[activeIndex].desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile card */}
        <div className="mt-8 block md:hidden">
          <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-white/10 backdrop-blur-[18px]">
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-4">
              <div className="text-white/90">{sections[activeIndex].icon}</div>
              <span className="inline-flex h-8 min-w-[46px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 font-mono text-[11px] font-semibold tracking-[0.14em] text-white/90">
                {sections[activeIndex].number}
              </span>
            </div>

            <div className="p-4">
              <h4 className="text-[clamp(28px,8vw,42px)] font-semibold leading-[0.98] tracking-[-0.05em]">
                {sections[activeIndex].cardTitle}
              </h4>
              <p className="mt-3 text-base leading-[1.7] text-white/82">
                {sections[activeIndex].desc}
              </p>

              <div className="relative mt-6 min-h-[260px] border-t border-white/12 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:34px_34px] bg-center pb-[4.4rem]">
                <div className="grid grid-cols-1 gap-4 p-4">
                  {sections[activeIndex].graphic === 'sar' && <SarGraphic metric={sections[activeIndex].metric} />}
                  {sections[activeIndex].graphic === 'environment' && <EnvironmentGraphic weather={weather} />}
                  {sections[activeIndex].graphic === 'ecosystem' && <EcosystemGraphic ecosystem={ecosystem} />}
                  {sections[activeIndex].graphic === 'anomaly' && <AnomalyGraphic anomalies={anomalies} />}
                  {sections[activeIndex].graphic === 'stress' && <StressGraphic vulnerability={vulnerability} />}
                </div>

                <div className="absolute bottom-4 left-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88 backdrop-blur-md">
                  {sections[activeIndex].metric}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SignalBoxProps {
  label: string;
  value: string;
}

function SignalBox({ label, value }: SignalBoxProps) {
  return (
    <div className="group/box relative flex flex-col justify-between p-5 bg-white/5 border border-white/10 rounded-xl cursor-pointer overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:bg-white/10 hover:border-white/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] min-h-[120px]">
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover/box:animate-[shimmer_1.5s_ease-out] z-0 pointer-events-none" />
      <div className="relative z-10 mb-2">
        <span className="text-[10px] uppercase tracking-wider font-mono text-white/60 group-hover/box:text-white transition-colors duration-300">
          {label}
        </span>
      </div>
      <div className="relative z-10 text-lg font-medium text-white tracking-wide">
        {value}
      </div>
      <div className="absolute bottom-0 left-0 h-[2px] bg-white/40 w-0 transition-all duration-500 group-hover/box:w-full"></div>
    </div>
  );
}

function SarGraphic({ metric }: { metric: string }) {
  return (
    <>
      <SignalBox label="Cobertura" value="SAR" />
      <SignalBox label="Estado" value="Live" />
      <SignalBox label="Límite agua" value="Tracked" />
      <SignalBox label="Escena" value={metric.includes('Scene') ? metric.replace('Scene ', '') : 'Pending'} />
    </>
  );
}

function EnvironmentGraphic({ weather }: { weather: LiveData['weather']['data'] }) {
  return (
    <>
      <SignalBox label="Lluvia" value={weather ? `${weather.weather_now.rain_mm_h} mm/h` : 'Syncing'} />
      <SignalBox
        label="Marea"
        value={weather ? `${Math.round(weather.proxies.tidal_stage_proxy * 100)}%` : 'Syncing'}
      />
      <SignalBox
        label="Humedad"
        value={weather ? `${weather.weather_now.humidity_pct}%` : 'Syncing'}
      />
      <SignalBox label="Estado" value="Live" />
    </>
  );
}

function EcosystemGraphic({ ecosystem }: { ecosystem: LiveData['ecosystemHealth']['data'] }) {
  return (
    <>
      <SignalBox label="Cobertura" value="Mangrove" />
      <SignalBox
        label="Health index"
        value={ecosystem ? `${Math.round(ecosystem.health_index * 100)}%` : 'Syncing'}
      />
      <SignalBox label="Protección" value="Active" />
      <SignalBox label="Estado" value="Tracked" />
    </>
  );
}

function AnomalyGraphic({ anomalies }: { anomalies: LiveData['anomalies']['data'] }) {
  return (
    <>
      <SignalBox label="Flags" value={anomalies ? `${anomalies.anomalies.length}` : 'Syncing'} />
      <SignalBox label="Tipo" value="Spatial" />
      <SignalBox label="Motor" value="AI-assisted" />
      <SignalBox label="Estado" value="Monitoring" />
    </>
  );
}

function StressGraphic({ vulnerability }: { vulnerability: LiveData['vulnerability']['data'] }) {
  return (
    <>
      <SignalBox
        label="Stress"
        value={vulnerability ? `${vulnerability.vulnerability_index_100}/100` : 'Syncing'}
      />
      <SignalBox label="Modelo" value="Fusion" />
      <SignalBox label="Lectura" value="Ground truth" />
      <SignalBox label="Estado" value="Ready" />
    </>
  );
}
