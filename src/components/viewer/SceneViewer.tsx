'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { R_EARTH, R_MOON, R_SUN } from '../../lib/types';
import { transformState } from '../../lib/referenceFrames';
import { thrustDirectionInertial } from '../../lib/controlFrames';

// Scale factor: render coordinates in 1000s of km for comfortable viewing
const SCALE = 1 / 1000; // 1 unit = 1000 km
const SUN_VISUAL_SCALE = 5; // Scale sun purely for visual visibility in the 3D view

function getBodyPosition(bodyFrame: string, plotFrame: string, epoch: number): [number, number, number] {
    const state = transformState({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, bodyFrame, plotFrame, epoch);
    return [state.x * SCALE, state.z * SCALE, state.y * SCALE]; // swap Y/Z for Three.js
}

function Earth({ plotFrame, epoch, visible }: { plotFrame: string, epoch: number, visible: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((_, delta) => {
        if (meshRef.current) meshRef.current.rotation.y += delta * 0.1;
    });

    const pos = getBodyPosition('earthInertial', plotFrame, epoch);

    if (!visible) return null;

    return (
        <group position={pos}>
            <mesh ref={meshRef}>
                <sphereGeometry args={[R_EARTH * SCALE, 64, 64]} />
                <meshStandardMaterial
                    color="#1a4fa0"
                    emissive="#0a2060"
                    emissiveIntensity={0.3}
                    roughness={0.8}
                />
            </mesh>
            {/* Atmosphere glow */}
            <mesh>
                <sphereGeometry args={[R_EARTH * SCALE * 1.02, 32, 32]} />
                <meshBasicMaterial
                    color="#4488ff"
                    transparent
                    opacity={0.08}
                    side={THREE.BackSide}
                />
            </mesh>
            <Html position={[0, R_EARTH * SCALE + 0.8, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#7ba4ff',
                    fontSize: '10px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    textShadow: '0 0 8px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap',
                }}>
                    Earth
                </div>
            </Html>
        </group>
    );
}

function Moon({ plotFrame, epoch, visible }: { plotFrame: string, epoch: number, visible: boolean }) {
    const pos = getBodyPosition('moonInertial', plotFrame, epoch);

    if (!visible) return null;

    return (
        <group position={pos}>
            <mesh>
                <sphereGeometry args={[R_MOON * SCALE, 32, 32]} />
                <meshStandardMaterial color="#888888" roughness={0.9} />
            </mesh>
            <Html position={[0, R_MOON * SCALE + 0.5, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#aab0c0',
                    fontSize: '9px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    textShadow: '0 0 8px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap',
                }}>
                    Moon
                </div>
            </Html>
        </group>
    );
}

function Sun({ plotFrame, epoch, visible }: { plotFrame: string, epoch: number, visible: boolean }) {
    const pos = getBodyPosition('sunInertial', plotFrame, epoch);

    if (!visible) return null;

    // Provide a directional light originating from the Sun, targeting the origin (where the main focus usually is)
    // We'll also provide a point light so things near the sun get illuminated evenly.
    return (
        <group position={pos}>
            <mesh>
                {/* Scale the sun visually so it's not invisible at large distances */}
                <sphereGeometry args={[R_SUN * SCALE * SUN_VISUAL_SCALE, 64, 64]} />
                <meshBasicMaterial color="#ffea00" />
            </mesh>
            <pointLight intensity={1.5} color="#ffea00" distance={0} decay={0} />
            <Html position={[0, R_SUN * SCALE * SUN_VISUAL_SCALE + 50, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#ffdd00',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    textShadow: '0 0 8px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap',
                }}>
                    Sun
                </div>
            </Html>
        </group>
    );
}

function CelestialOrbit({ bodyFrame, plotFrame, period, color, visible }: { bodyFrame: string, plotFrame: string, period: number, color: string, visible: boolean }) {
    const points = useMemo(() => {
        if (!visible || bodyFrame === plotFrame) return [];
        const pts: THREE.Vector3[] = [];
        const steps = 180;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * period;
            const state = transformState({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, bodyFrame, plotFrame, t);
            pts.push(new THREE.Vector3(state.x * SCALE, state.z * SCALE, state.y * SCALE));
        }
        return pts;
    }, [bodyFrame, plotFrame, period, visible]);

    if (!visible || bodyFrame === plotFrame) return null;

    return (
        <Line
            points={points}
            color={color}
            lineWidth={1}
            transparent
            opacity={0.3}
            dashed={true}
            dashSize={5}
            gapSize={5}
        />
    );
}

function ReferenceAxes() {
    const size = 15;
    return (
        <group>
            <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), size, 0xff4444, 0.5, 0.3]} />
            <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), size, 0x44ff44, 0.5, 0.3]} />
            <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), size, 0x4488ff, 0.5, 0.3]} />
        </group>
    );
}

function TrajectoryPaths({ plotFrame, isGhost = false }: { plotFrame: string, isGhost?: boolean }) {
    const trajectoryResults = useMissionStore(s => isGhost ? s.ghostTrajectoryResults : s.trajectoryResults);
    const mission = useMissionStore(s => s.mission);

    const scData = useMemo(() => {
        const map = new Map<string, { refFrame: string, spacecraft: any }>();
        mission.spacecraft.forEach(sc => {
            map.set(sc.id, { refFrame: sc.initialState.referenceFrame, spacecraft: sc });
        });
        return map;
    }, [mission.spacecraft]);

    const geometries = useMemo(() => {
        const geoms: any[] = [];

        trajectoryResults.forEach((result) => {
            const scInfo = scData.get(result.spacecraftId);
            if (!scInfo) return;
            const refFrame = scInfo.refFrame;

            result.segments.forEach((segResult) => {
                const seg = scInfo.spacecraft.segments.find((s: any) => s.id === segResult.segmentId);
                const graphics = seg?.graphics || { color: '#ffffff', lineStyle: 'solid', lineWidth: 2, plotThrustVector: false };

                const pts: THREE.Vector3[] = [];
                segResult.points.forEach(p => {
                    const state = { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz };
                    const transformed = transformState(state, refFrame, plotFrame, p.t);
                    pts.push(new THREE.Vector3(transformed.x * SCALE, transformed.z * SCALE, transformed.y * SCALE));
                });

                const thrustArrows: { pos: THREE.Vector3, dir: THREE.Vector3 }[] = [];
                if (!isGhost && graphics.plotThrustVector && seg?.thrust.enabled) {
                    const step = Math.max(1, Math.floor(segResult.points.length / 15)); // ~15 arrows max
                    for (let j = 0; j < segResult.points.length; j += step) {
                        const p = segResult.points[j];
                        const stateCF = [p.x, p.y, p.z, p.vx, p.vy, p.vz];
                        const dirPF = thrustDirectionInertial(seg.thrust.azimuth, seg.thrust.elevation, seg.thrust.controlFrame, stateCF);

                        const posPF = { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0 };
                        const lengthMultiplier = 5000;
                        const posDirPF = {
                            x: p.x + dirPF[0] * lengthMultiplier,
                            y: p.y + dirPF[1] * lengthMultiplier,
                            z: p.z + dirPF[2] * lengthMultiplier,
                            vx: 0, vy: 0, vz: 0
                        };

                        const tPos = transformState(posPF, refFrame, plotFrame, p.t);
                        const tPosDir = transformState(posDirPF, refFrame, plotFrame, p.t);

                        const p1 = new THREE.Vector3(tPos.x * SCALE, tPos.z * SCALE, tPos.y * SCALE);
                        const p2 = new THREE.Vector3(tPosDir.x * SCALE, tPosDir.z * SCALE, tPosDir.y * SCALE);
                        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();

                        thrustArrows.push({ pos: p1, dir });
                    }
                }

                const renderColor = isGhost ? '#aaaaaa' : graphics.color;
                const renderStyle = isGhost ? 'dashed' : graphics.lineStyle;
                const renderWidth = isGhost ? 1 : graphics.lineWidth;
                const renderOpacity = isGhost ? 0.3 : 0.9;

                geoms.push({
                    points: pts,
                    color: renderColor,
                    style: renderStyle,
                    width: renderWidth,
                    segId: segResult.segmentId,
                    arrows: thrustArrows,
                    opacity: renderOpacity
                });
            });
        });

        return geoms;
    }, [trajectoryResults, scData, plotFrame, isGhost]);

    return (
        <>
            {geometries.map((g, i) => {
                if (g.points.length < 2) return null;
                const isDashed = g.style === 'dashed' || g.style === 'dotted';
                const dashSize = g.style === 'dotted' ? 0.3 : 1.5;
                const gapSize = g.style === 'dotted' ? 0.6 : 1.5;

                return (
                    <group key={`${g.segId}-${i}`}>
                        <Line
                            points={g.points}
                            color={g.color}
                            lineWidth={g.width}
                            dashed={isDashed}
                            dashSize={dashSize}
                            gapSize={gapSize}
                            transparent
                            opacity={g.opacity}
                        />
                        {g.arrows.map((arr: any, idx: number) => (
                            <arrowHelper
                                key={`arrow-${idx}`}
                                args={[arr.dir, arr.pos, 5, g.color, 1.5, 1]}
                            />
                        ))}
                    </group>
                );
            })}
        </>
    );
}

function ViewerOverlay() {
    const trajectoryResults = useMissionStore(s => s.trajectoryResults);

    if (trajectoryResults.size === 0) return null;

    let totalPoints = 0;
    let totalDeltaV = 0;
    trajectoryResults.forEach(result => {
        result.segments.forEach(seg => {
            totalPoints += seg.points.length;
            totalDeltaV += seg.deltaV;
        });
    });

    return (
        <div className="viewer-overlay">
            <div style={{ marginBottom: '4px' }}>
                <span>Trajectories: </span>
                <span className="viewer-overlay-value">{trajectoryResults.size}</span>
            </div>
            <div style={{ marginBottom: '4px' }}>
                <span>Points: </span>
                <span className="viewer-overlay-value">{totalPoints.toLocaleString()}</span>
            </div>
            <div>
                <span>Total ΔV: </span>
                <span className="viewer-overlay-value">{totalDeltaV.toFixed(4)} km/s</span>
            </div>
        </div>
    );
}

export function SceneViewer() {
    const graphicsConfig = useMissionStore(s => s.mission.graphicsConfig);
    const plotFrame = graphicsConfig.plotFrame;
    const bodies = graphicsConfig.celestialBodies;
    const showOrbits = graphicsConfig.showOrbits;

    const T_MOON = 2360592.0;
    const T_EARTH = 365.25 * 86400.0;

    return (
        <>
            <Canvas
                camera={{ position: [20, 15, 20], fov: 50, near: 0.01, far: 500000 }}
                style={{ background: '#050810' }}
                gl={{ antialias: true, alpha: false }}
            >
                <ambientLight intensity={0.2} />

                {/* Provide a default directional light ONLY if the sun is NOT visible.
                    Otherwise the Sun component provides the lighting. */}
                {!bodies.sun && (
                    <directionalLight position={[50, 30, 50]} intensity={1.0} />
                )}

                <Stars radius={200} depth={100} count={3000} factor={3} saturation={0.2} fade />

                <Earth plotFrame={plotFrame} epoch={0} visible={bodies.earth} />
                <Moon plotFrame={plotFrame} epoch={0} visible={bodies.moon} />
                <Sun plotFrame={plotFrame} epoch={0} visible={bodies.sun} />

                <CelestialOrbit bodyFrame="earthInertial" plotFrame={plotFrame} period={T_EARTH} color="#4488ff" visible={showOrbits && bodies.earth} />
                <CelestialOrbit bodyFrame="moonInertial" plotFrame={plotFrame} period={T_MOON} color="#888888" visible={showOrbits && bodies.moon} />
                <CelestialOrbit bodyFrame="sunInertial" plotFrame={plotFrame} period={T_EARTH} color="#ffdd00" visible={showOrbits && bodies.sun} />

                <ReferenceAxes />
                <TrajectoryPaths plotFrame={plotFrame} />
                <TrajectoryPaths plotFrame={plotFrame} isGhost={true} />

                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    minDistance={2}
                    maxDistance={200000}
                />

                {/* Grid for reference */}
                <gridHelper args={[100, 40, '#1a2040', '#0d1225']} rotation={[0, 0, 0]} />
            </Canvas>
            <ViewerOverlay />
        </>
    );
}
