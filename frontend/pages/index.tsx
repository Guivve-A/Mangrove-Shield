import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';

import { CTASection } from '@/components/sections/CTASection';
import { EcosystemSection } from '@/components/sections/EcosystemSection';
import { LongstripSection } from '@/components/sections/LongstripSection';
import { HeroSection } from '@/components/sections/HeroSection';
import { MangroveSection } from '@/components/sections/MangroveSection';
import { MapSection } from '@/components/sections/MapSection';
import { OutcomesSection } from '@/components/sections/OutcomesSection';

import { TeamSection } from '@/components/sections/TeamSection';
import { Navbar } from '@/components/layout/Navbar';
import { IntroLoader } from '@/components/loading/IntroLoader';
import { useIntelligenceData } from '@/hooks/useIntelligenceData';
import { useLiveData } from '@/hooks/useLiveData';
import { initScrollReveal } from '@/src/animations/sceneController';

const IntelligenceMap = dynamic(
  () => import('@/map/IntelligenceMap').then((m) => m.IntelligenceMap),
  { ssr: false },
);

const SimulationSection = dynamic(
  () => import('@/components/sections/SimulationSection').then((m) => m.SimulationSection),
  { ssr: false },
);

export default function HomePage(): JSX.Element {
  const [ready, setReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);
  const mapSentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    isLoading,
    scenario,
    compareScenario,
    stormIntensity,
    terrainMode,
    activeBundle,
    compareBundle,
    metrics,
    selectedZone,
    selectedZoneId,
    setSelectedZoneId,
  } = useIntelligenceData();

  const liveData = useLiveData(!isLoading && introDone);

  // Check if intro already played in this session
  useEffect(() => {
    const alreadyPlayed =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('mangrove-intro-played') === 'true';

    setIntroDone(Boolean(alreadyPlayed));
    setIntroChecked(true);
  }, []);

  const handleIntroComplete = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('mangrove-intro-played', 'true');
    }
    setIntroDone(true);
  };

  // Page fade-in readiness
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Scroll reveal animations
  useEffect(() => {
    if (!ready || !introDone) return;
    const cleanup = initScrollReveal();
    return cleanup;
  }, [ready, introDone]);

  useEffect(() => {
    if (shouldRenderMap || !introDone) {
      return;
    }

    const node = mapSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldRenderMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [introDone, shouldRenderMap]);

  // Avoid rendering until intro state is checked
  if (!introChecked) {
    return (
      <>
        <Head>
          <title>MangroveShield | Flood Risk Intelligence</title>
          <meta
            name="description"
            content="Monitoring mangrove ecosystems and flood vulnerability in Greater Guayaquil, Ecuador."
          />
        </Head>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>MangroveShield | Flood Risk Intelligence</title>
        <meta
          name="description"
          content="Monitoring mangrove ecosystems and flood vulnerability in Greater Guayaquil, Ecuador."
        />
      </Head>

      {!introDone && <IntroLoader onComplete={handleIntroComplete} />}

      <div
        className={
          introDone
            ? 'animate-fade-in transition-opacity duration-700 opacity-100'
            : 'opacity-0 pointer-events-none'
        }
      >
        <Navbar />

        <HeroSection />

        <MangroveSection />

        <LongstripSection liveData={liveData} />

        <EcosystemSection liveData={liveData} />



        <div ref={mapSentinelRef}>
          {!isLoading && shouldRenderMap ? (
            <MapSection
              bundle={activeBundle}
              compareBundle={compareBundle}
              scenario={scenario}
              compareScenario={compareScenario}
              terrainMode={terrainMode}
              stormIntensity={stormIntensity}
              selectedZoneId={selectedZoneId}
              selectedZone={selectedZone}
              onSelectZone={(id) => setSelectedZoneId(id)}
              waterMaskGeoJson={liveData.waterMask.data?.geometry ?? null}
              vulnerabilityGeoJson={liveData.vulnerability.data?.geometry ?? null}
              IntelligenceMap={IntelligenceMap}
            />
          ) : (
            <section id="map" className="relative bg-[var(--bg-dark)]" style={{ minHeight: '100vh' }}>
              <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
                <div className="mx-auto max-w-[var(--content-max)] px-[var(--section-px)] pt-8">
                  <div className="max-w-[430px] rounded-[30px] border border-white/10 bg-ocean-dark/52 p-6 shadow-[0_28px_70px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                    <p className="text-caption text-sat-cyan">
                      Operational Interface
                    </p>
                    <h2 className="mt-3 font-sans text-[30px] font-semibold tracking-[-0.03em] text-white">
                      Live Intelligence Map
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-white/62">
                      Move from model output to geography. Compare flood likelihood, vulnerability, and SAR detection directly in the operational map.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex h-screen w-full items-center justify-center">
                <div className="rounded-full border border-white/10 bg-ocean-dark/70 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 backdrop-blur-md">
                  Loading map engine
                </div>
              </div>
            </section>
          )}
        </div>

        <OutcomesSection />

        <SimulationSection />


        <TeamSection />

        <CTASection />
      </div>
    </>
  );
}
