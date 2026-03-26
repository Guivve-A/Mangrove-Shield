import React, { useMemo, useRef } from 'react';
import { useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// Utilidades de interpolación
// ============================================================================

/** Interpola linealmente entre dos valores */
function lerp(a: number, b: number, t: number) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Interpola entre dos colores hexadecimales, retorna Color THREE */
function lerpColor(hexA: string, hexB: string, t: number): THREE.Color {
    const ca = new THREE.Color(hexA);
    const cb = new THREE.Color(hexB);
    return ca.lerp(cb, Math.max(0, Math.min(1, t)));
}

// ============================================================================
// Tipos y Generación Procedural
// ============================================================================

interface WorldData {
    flowers: { position: [number, number, number]; color: string; scale: number }[];
    trees: { position: [number, number, number]; scale: number }[];
    mangroves: { position: [number, number, number]; scale: number }[];
    houses: { position: [number, number, number]; rotation: number; scale: number }[];
    clouds: { position: [number, number, number]; scale: number; speed: number }[];
    birds: { y: number; radius: number; speed: number; offset: number }[];
    paths: { position: [number, number, number]; rotation: number; scale: [number, number, number] }[];
}

function generateWorld(seed: number): WorldData {
    let s = seed;
    const rand = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };

    const houses = Array.from({ length: 6 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = rand() * 2.2;
        return {
            position: [Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius] as [number, number, number],
            rotation: rand() * Math.PI * 2,
            scale: 0.6 + rand() * 0.4
        };
    });

    const paths = Array.from({ length: 15 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = rand() * 2.5;
        return {
            position: [Math.cos(angle) * radius, 0.31, Math.sin(angle) * radius] as [number, number, number],
            rotation: rand() * Math.PI,
            scale: [0.5 + rand() * 0.5, 0.5 + rand() * 0.5, 1] as [number, number, number]
        };
    });

    const trees = Array.from({ length: 50 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = 3.2 + rand() * 1.5;
        return {
            position: [Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius] as [number, number, number],
            scale: 0.6 + rand() * 0.6
        };
    });

    const flowers = Array.from({ length: 120 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = 1.0 + rand() * 3.8;
        const colors = ['#ff69b4', '#ffd700', '#9370db', '#ff4500'];
        return {
            position: [Math.cos(angle) * radius, 0.35, Math.sin(angle) * radius] as [number, number, number],
            color: colors[Math.floor(rand() * colors.length)],
            scale: 0.4 + rand() * 0.6
        };
    });

    const mangroves = Array.from({ length: 25 }, () => {
        const angle = rand() * Math.PI * 2;
        const radius = 4.8 + rand() * 0.6;
        return {
            position: [Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius] as [number, number, number],
            scale: 0.6 + rand() * 0.5
        };
    });

    const clouds = Array.from({ length: 6 }, () => ({
        position: [(rand() - 0.5) * 20, 4 + rand() * 3, (rand() - 0.5) * 20] as [number, number, number],
        scale: 0.8 + rand() * 1.2,
        speed: 0.02 + rand() * 0.04
    }));

    const birds = Array.from({ length: 8 }, () => ({
        y: 2 + rand() * 3,
        radius: 2 + rand() * 5,
        speed: 0.5 + rand() * 1.0,
        offset: rand() * Math.PI * 2
    }));

    return { flowers, trees, mangroves, houses, clouds, birds, paths };
}

// ============================================================================
// Componentes 3D
// ============================================================================

function Island({ damage }: { damage: number }) {
    // La isla se hunde gradualmente en el agua cuando sube el daño
    const sinkY = lerp(0, -1.2, damage / 100);
    const grassColor = lerpColor('#7dd87d', '#4a6741', damage / 100).getStyle();
    const sandColor = lerpColor('#e6c79c', '#b8956a', damage / 100).getStyle();

    return (
        <group position={[0, sinkY, 0]}>
            <mesh receiveShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[5, 5, 0.6, 64]} />
                <meshStandardMaterial color={grassColor} roughness={0.8} />
            </mesh>
            <mesh receiveShadow position={[0, -0.15, 0]}>
                <cylinderGeometry args={[5.3, 5.1, 0.4, 64]} />
                <meshStandardMaterial color={sandColor} roughness={1} />
            </mesh>
        </group>
    );
}

function Water({ damage }: { damage: number }) {
    const waterRef = useRef<THREE.Mesh>(null);
    const damageT = damage / 100;

    // Nivel del agua sube gradualmente con el daño
    const baseWaterY = lerp(-0.3, 0.6, damageT);
    const waterColor = lerpColor('#4da6ff', '#1e3a8a', damageT).getStyle();
    const waterOpacity = lerp(0.75, 0.92, damageT);

    useFrame((state) => {
        if (waterRef.current) {
            waterRef.current.position.y = baseWaterY + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
        }
    });

    return (
        <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100, 64, 64]} />
            <meshPhysicalMaterial
                color={waterColor}
                roughness={0.1}
                metalness={0.1}
                transparent
                opacity={waterOpacity}
                transmission={0.4}
            />
        </mesh>
    );
}

// Casa mejorada: cuerpo + techo + ventanas + puerta
function House({ scale, wallColor, roofColor, windowColor, doorColor }: {
    scale: number;
    wallColor: string;
    roofColor: string;
    windowColor: string;
    doorColor: string;
}) {
    const eps = 0.001; // pequeño offset para evitar z-fighting
    return (
        <group scale={scale}>
            {/* Cuerpo principal */}
            <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
                <boxGeometry args={[0.6, 0.6, 0.6]} />
                <meshStandardMaterial color={wallColor} />
            </mesh>

            {/* Techo */}
            <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
                <coneGeometry args={[0.5, 0.5, 4]} />
                <meshStandardMaterial color={roofColor} />
            </mesh>

            {/* Ventana frontal izquierda */}
            <mesh position={[-0.14, 0.35, 0.301 + eps]}>
                <planeGeometry args={[0.13, 0.13]} />
                <meshStandardMaterial color={windowColor} roughness={0.1} metalness={0.3} transparent opacity={0.9} />
            </mesh>

            {/* Ventana frontal derecha */}
            <mesh position={[0.14, 0.35, 0.301 + eps]}>
                <planeGeometry args={[0.13, 0.13]} />
                <meshStandardMaterial color={windowColor} roughness={0.1} metalness={0.3} transparent opacity={0.9} />
            </mesh>

            {/* Puerta frontal */}
            <mesh position={[0, 0.12, 0.301 + eps]}>
                <planeGeometry args={[0.12, 0.22]} />
                <meshStandardMaterial color={doorColor} roughness={0.8} />
            </mesh>

            {/* Ventana lateral derecha */}
            <mesh position={[0.301 + eps, 0.35, 0]}>
                <planeGeometry args={[0.13, 0.13]} />
                <meshStandardMaterial color={windowColor} roughness={0.1} metalness={0.3} transparent opacity={0.9} />
            </mesh>
        </group>
    );
}

function Houses({ data, damage }: { data: WorldData['houses']; damage: number }) {
    const damageT = damage / 100;
    const wallColor = lerpColor('#ffe4c4', '#a0856b', damageT).getStyle();
    const roofColor = lerpColor('#ff6b6b', '#7a3030', damageT).getStyle();
    const windowColor = lerpColor('#87ceeb', '#2a4a5e', damageT).getStyle();
    const doorColor = lerpColor('#8b4513', '#3d1f0a', damageT).getStyle();

    return (
        <group>
            {data.map((h, i) => (
                <group key={i} position={h.position} rotation={[0, h.rotation, 0]}>
                    <House
                        scale={h.scale}
                        wallColor={wallColor}
                        roofColor={roofColor}
                        windowColor={windowColor}
                        doorColor={doorColor}
                    />
                </group>
            ))}
        </group>
    );
}

function InstancedNature({ data, damage }: { data: WorldData; damage: number }) {
    const { trees, mangroves, flowers, paths } = data;
    const damageT = damage / 100;

    const troncoColor = lerpColor('#8b4513', '#4a2800', damageT).getStyle();
    const hojaTreeColor = lerpColor('#2ecc71', '#556b2f', damageT).getStyle();
    const troncoManglarColor = lerpColor('#3b2f2f', '#1a1010', damageT).getStyle();
    const hojaManglarColor = lerpColor('#1e4d2b', '#0a1a0d', damageT).getStyle();
    const caminoColor = '#d6b98c';

    // Manglares se reducen gradualmente
    const mangroveScale = (baseScale: number) => lerp(baseScale, 0.01, damageT);
    // Flores se desvanecen al aumentar el daño
    const flowerOpacity = lerp(1, 0.15, damageT);

    return (
        <group>
            {/* Caminos */}
            <Instances range={paths.length} receiveShadow>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color={caminoColor} roughness={1} />
                {paths.map((p, i) => (
                    <Instance key={`path-${i}`} position={p.position} rotation={[-Math.PI / 2, 0, p.rotation]} scale={p.scale} />
                ))}
            </Instances>

            {/* Árboles - Troncos */}
            <Instances range={trees.length} castShadow receiveShadow>
                <cylinderGeometry args={[0.04, 0.06, 0.4, 8]} />
                <meshStandardMaterial color={troncoColor} />
                {trees.map((t, i) => (
                    <Instance key={`tt-${i}`} position={[t.position[0], t.position[1] + 0.2, t.position[2]]} scale={t.scale} />
                ))}
            </Instances>

            {/* Árboles - Hojas */}
            <Instances range={trees.length} castShadow receiveShadow>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color={hojaTreeColor} roughness={0.6} />
                {trees.map((t, i) => (
                    <Instance key={`tl-${i}`} position={[t.position[0], t.position[1] + 0.5 * t.scale, t.position[2]]} scale={t.scale} />
                ))}
            </Instances>

            {/* Manglares - Troncos (desaparecen gradualmente) */}
            <Instances range={mangroves.length} castShadow receiveShadow>
                <cylinderGeometry args={[0.03, 0.08, 0.5, 8]} />
                <meshStandardMaterial color={troncoManglarColor} />
                {mangroves.map((m, i) => (
                    <Instance
                        key={`mt-${i}`}
                        position={[m.position[0], m.position[1] + 0.25, m.position[2]]}
                        scale={mangroveScale(m.scale)}
                    />
                ))}
            </Instances>

            {/* Manglares - Hojas */}
            <Instances range={mangroves.length} castShadow receiveShadow>
                <sphereGeometry args={[0.25, 12, 12]} />
                <meshStandardMaterial color={hojaManglarColor} roughness={0.7} />
                {mangroves.map((m, i) => (
                    <Instance
                        key={`ml-${i}`}
                        position={[m.position[0], m.position[1] + 0.5 * m.scale, m.position[2]]}
                        scale={mangroveScale(m.scale)}
                    />
                ))}
            </Instances>

            {/* Flores (se desvanecen al dañarse) */}
            <Instances range={flowers.length} castShadow>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial roughness={0.2} transparent opacity={flowerOpacity} />
                {flowers.map((f, i) => (
                    <Instance key={`f-${i}`} position={f.position} color={f.color} scale={f.scale} />
                ))}
            </Instances>
        </group>
    );
}

// ============================================================================
// Aves mejoradas — cuerpo elipsoidal + cabeza + alas que aletean
// ============================================================================

function Bird({ bData, index }: { bData: WorldData['birds'][0]; index: number }) {
    const groupRef = useRef<THREE.Group>(null);
    const wingLRef = useRef<THREE.Mesh>(null);
    const wingRRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const angle = t * bData.speed + bData.offset;

        if (groupRef.current) {
            groupRef.current.position.x = Math.cos(angle) * bData.radius;
            groupRef.current.position.z = Math.sin(angle) * bData.radius;
            groupRef.current.position.y = bData.y + Math.sin(t * 6 + index) * 0.12;
            // Orientar hacia donde vuela
            groupRef.current.rotation.y = -angle + Math.PI / 2;
        }

        // Aleteo suave
        const flapAngle = Math.sin(t * 8 + index) * 0.55;
        if (wingLRef.current) wingLRef.current.rotation.z = flapAngle;
        if (wingRRef.current) wingRRef.current.rotation.z = -flapAngle;
    });

    return (
        <group ref={groupRef}>
            {/* Cuerpo */}
            <mesh castShadow>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color="#2c2c2c" roughness={0.7} />
            </mesh>
            {/* Cabeza */}
            <mesh castShadow position={[0.1, 0.05, 0]}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
            </mesh>
            {/* Pico */}
            <mesh position={[0.155, 0.045, 0]} rotation={[0, 0, -Math.PI / 6]}>
                <coneGeometry args={[0.012, 0.05, 4]} />
                <meshStandardMaterial color="#e8a020" />
            </mesh>
            {/* Ala izquierda */}
            <mesh ref={wingLRef} castShadow position={[0, 0, 0.09]}>
                <boxGeometry args={[0.22, 0.025, 0.1]} />
                <meshStandardMaterial color="#333" roughness={0.8} />
            </mesh>
            {/* Ala derecha */}
            <mesh ref={wingRRef} castShadow position={[0, 0, -0.09]}>
                <boxGeometry args={[0.22, 0.025, 0.1]} />
                <meshStandardMaterial color="#333" roughness={0.8} />
            </mesh>
            {/* Cola */}
            <mesh castShadow position={[-0.1, -0.02, 0]} rotation={[0, 0, Math.PI / 8]}>
                <coneGeometry args={[0.025, 0.09, 4]} />
                <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
        </group>
    );
}

// Wrapper para el grupo de aves — se desvanecen con daño
function Birds({ data, damage }: { data: WorldData; damage: number }) {
    const damageT = damage / 100;
    // Las aves desparecen gradualmente sobre el 60% de daño
    const birdOpacity = Math.max(0, lerp(1, 0, (damage - 30) / 70));
    const visible = birdOpacity > 0.01;

    return (
        <group visible={visible}>
            {data.birds.map((b, i) => (
                <Bird key={`bird-${i}`} bData={b} index={i} />
            ))}
        </group>
    );
}

// Nubes que se oscurecen gradualmente
function Clouds({ data, damage }: { data: WorldData; damage: number }) {
    const cloudsGroup = useRef<THREE.Group>(null);
    const damageT = damage / 100;

    const cloudMainColor = lerpColor('#ffffff', '#475569', damageT).getStyle();
    const cloud2Color = lerpColor('#ffffff', '#64748b', damageT).getStyle();
    const cloud3Color = lerpColor('#ffffff', '#cbd5e1', damageT).getStyle();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (cloudsGroup.current) {
            cloudsGroup.current.children.forEach((cloud, i) => {
                const cData = data.clouds[i];
                cloud.position.x = cData.position[0] + (t * cData.speed * 10) % 30;
                if (cloud.position.x > 15) cloud.position.x -= 30;
            });
        }
    });

    return (
        <group ref={cloudsGroup}>
            {data.clouds.map((c, i) => (
                <group key={`cloud-${i}`} position={c.position} scale={c.scale}>
                    <mesh position={[0, 0, 0]} castShadow>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color={cloudMainColor} transparent opacity={0.8} />
                    </mesh>
                    <mesh position={[0.4, -0.1, 0.2]} castShadow>
                        <sphereGeometry args={[0.4, 16, 16]} />
                        <meshStandardMaterial color={cloud2Color} transparent opacity={0.8} />
                    </mesh>
                    <mesh position={[-0.4, -0.1, -0.1]} castShadow>
                        <sphereGeometry args={[0.45, 16, 16]} />
                        <meshStandardMaterial color={cloud3Color} transparent opacity={0.8} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ============================================================================
// Escena Global WebGL
// ============================================================================

function Scene({ damage }: { damage: number }) {
    const worldData = useMemo(() => generateWorld(42), []);
    const damageT = damage / 100;

    const skyColor = lerpColor('#bae6fd', '#1e293b', damageT).getStyle();
    const fogColor = lerpColor('#bfe3ff', '#334155', damageT).getStyle();
    const ambientIntensity = lerp(0.6, 0.15, damageT);
    const hemisphereIntensity = lerp(0.5, 0.2, damageT);
    const directionalIntensity = lerp(1.8, 0.4, damageT);
    const islandGroupY = lerp(0, -0.5, damageT);

    return (
        <>
            <color attach="background" args={[skyColor]} />
            <fog attach="fog" args={[fogColor, 8, 25]} />

            <ambientLight intensity={ambientIntensity} />
            <hemisphereLight intensity={hemisphereIntensity} groundColor="#4a5568" />
            <directionalLight
                position={[5, 10, 5]}
                intensity={directionalIntensity}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
                shadow-bias={-0.0001}
            />

            <OrbitControls
                maxPolarAngle={1.3}
                minDistance={4}
                maxDistance={12}
                enablePan={false}
                enableDamping={true}
                dampingFactor={0.05}
                autoRotate={false}
            />

            {/* La isla se hunde gradualmente */}
            <group position={[0, islandGroupY, 0]}>
                <Island damage={damage} />
                <Houses data={worldData.houses} damage={damage} />
                <InstancedNature data={worldData} damage={damage} />
            </group>

            {/* El agua sube gradualmente */}
            <Water damage={damage} />

            {/* Aves y nubes dinámicas */}
            <Birds data={worldData} damage={damage} />
            <Clouds data={worldData} damage={damage} />
        </>
    );
}

// ============================================================================
// Componente UI (DOM Wrapper)
// ============================================================================

export function SimulationSection() {
    const [damage, setDamage] = useState(0);

    const getStatusInfo = (val: number) => {
        if (val < 40) return {
            badge: 'ISLA VIVA PROTEGIDA',
            color: 'bg-emerald-500/90 text-white border border-emerald-500/30',
            title: 'Equilibrio Perfecto',
            text: 'Las aves vuelan, las flores de MangroveShield prosperan y el agua está cristalina.'
        };
        if (val < 80) return {
            badge: 'ALERTA AMBIENTAL',
            color: 'bg-amber-500/90 text-white border border-amber-500/30',
            title: 'Fragmentación en progreso',
            text: 'Las nubes oscurecen, el agua sube y la capa de manglares comienza a desaparecer.'
        };
        return {
            badge: 'NIVEL DE INUNDACIÓN CRÍTICO',
            color: 'bg-rose-500/90 text-white border border-rose-500/30',
            title: 'Desastre Total Sin Manglares',
            text: 'La flora se ahoga y el agua inunda la ciudad al perder la barrera costera natural.'
        };
    };

    const info = getStatusInfo(damage);

    return (
        <section id="simulation" className="relative w-full h-[100vh] bg-neutral-900 font-sans select-none">

            {/* Canvas WebGL a pantalla completa */}
            <div className="absolute inset-0 z-0 cursor-move">
                <Canvas shadows camera={{ position: [6, 6, 8], fov: 45 }} gl={{ antialias: true, alpha: false }}>
                    <Scene damage={damage} />
                </Canvas>
            </div>

            {/* Superposiciones UI */}

            {/* Título superior izquierda */}
            <div className="absolute top-10 left-10 md:top-16 md:left-16 z-50 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl max-w-xs shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <p className="text-emerald-600 font-mono text-[10px] tracking-widest uppercase mb-2">Simulación WebGL</p>
                    <h1 className="text-3xl font-inter font-bold text-slate-800 leading-tight mb-2">Mangrove<br />Island 3D</h1>
                    <p className="text-slate-500 text-xs font-light">Mundo vivo estilizado interactivo. Arrastra para orbitar y explora el ecosistema.</p>
                </div>
            </div>

            {/* Tarjeta de información dinámica arriba derecha */}
            <div className="absolute top-10 right-10 md:top-16 md:right-16 z-50 transition-all duration-500 max-w-[320px]">
                <div className="bg-white/95 backdrop-blur-xl border border-neutral-100 p-6 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.1)]">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold mb-4 ${info.color}`}>
                        {info.badge}
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">{info.title}</h2>
                    <p className="text-slate-600 text-sm font-light leading-relaxed mb-4">{info.text}</p>

                    <div className="h-[1px] w-full bg-slate-100 mb-4"></div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                        <span>INTEGRIDAD DEL ECOSISTEMA</span>
                        <span className={`font-bold ${damage > 50 ? 'text-rose-500' : 'text-emerald-500'}`}>{100 - damage}%</span>
                    </div>
                </div>
            </div>

            {/* Slider de interacción centrado abajo */}
            <div className="absolute bottom-10 md:bottom-16 left-1/2 -translate-x-1/2 z-50 w-[90%] md:w-auto">
                <div className="bg-white/95 backdrop-blur-2xl border border-white p-5 rounded-full flex flex-col md:flex-row items-center gap-4 md:gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] pointer-events-auto">

                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-600 uppercase">Salud Óptima</span>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={damage}
                        onChange={(e) => setDamage(Number(e.target.value))}
                        className="w-full md:w-[350px] h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none transition-colors"
                        style={{
                            background: `linear-gradient(to right, #10b981 0%, #3b82f6 50%, #f43f5e 100%)`,
                            opacity: 0.9
                        }}
                    />

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold tracking-widest text-rose-500 uppercase">Daño Ambiental</span>
                        <div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                    </div>

                </div>

                <p className="text-center text-[10px] text-white/70 font-mono tracking-widest mt-4 uppercase hidden md:block mix-blend-difference drop-shadow-md">
                    [ Arrastra para ver la cámara 3D · Rueda para hacer zoom ]
                </p>
            </div>

        </section>
    );
}
