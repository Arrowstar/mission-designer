// ============================================================
// Mission State Store (Zustand)
// ============================================================

import { create } from 'zustand';
import {
    Mission,
    Spacecraft,
    Segment,
    Tank,
    Engine,
    TrajectoryResult,
    OptimizationResult,
    OptimizationIteration,
    OptimizationStatus,
    OptimizationConfig,
    GraphicsConfig,
    DataSeriesConfig,
    PlotConfig,
} from '../lib/types';
import { propagateSpacecraft } from '../lib/propagator';
import { generateId } from '../lib/utils';

// ---- Default Factories ----

function createDefaultTank(): Tank {
    return { id: generateId(), name: 'Main Tank', propellantMass: 1000 };
}

function createDefaultEngine(): Engine {
    return { id: generateId(), name: 'Main Engine', thrust: 10000, isp: 300, tankIds: [] };
}

function createDefaultSegment(): Segment {
    return {
        id: generateId(),
        name: 'Coast',
        termination: { type: 'duration', duration: 3600 },
        forceModel: { earthGravity: true, moonGravity: false, sunGravity: false },
        thrust: {
            enabled: false,
            engineId: '',
            controlFrame: 'inertial',
            referenceFrame: 'earthInertial',
            azimuth: 0,
            elevation: 0,
        },
        graphics: {
            color: '#5b8cff',
            lineStyle: 'solid',
            lineWidth: 2,
            plotThrustVector: false,
        }
    };
}

function createDefaultSpacecraft(): Spacecraft {
    const tank = createDefaultTank();
    const engine = { ...createDefaultEngine(), tankIds: [tank.id] };
    return {
        id: generateId(),
        name: 'Spacecraft 1',
        initialState: {
            epoch: 1740787200, // Roughly March 2025 default
            coordinateType: 'keplerian',
            cartesian: { x: 6778, y: 0, z: 0, vx: 0, vy: 7.668, vz: 0 },
            keplerian: { a: 6778, e: 0.0, i: 28.5, raan: 0, aop: 0, ta: 0 },
            referenceFrame: 'earthInertial',
        },
        dryMass: 500,
        tanks: [tank],
        engines: [engine],
        segments: [createDefaultSegment()],
    };
}

function createDefaultMission(): Mission {
    return {
        id: generateId(),
        name: 'New Mission',
        spacecraft: [createDefaultSpacecraft()],
        optimizationConfig: {
            algorithm: 'LD_SLSQP',
            maxIterations: 200,
            ftolRel: 1e-6,
            xtolRel: 1e-6,
            variables: [],
            objectives: [],
            constraints: [],
        },
        graphicsConfig: {
            plotFrame: 'earthInertial',
            celestialBodies: {
                earth: true,
                moon: true,
                sun: false,
            },
            showOrbits: true,
        },
        dataConfig: {
            series: [],
            plots: [],
        },
    };
}

// ---- Store Interface ----

interface MissionStore {
    mission: Mission;
    trajectoryResults: Map<string, TrajectoryResult>;
    ghostTrajectoryResults: Map<string, TrajectoryResult>;
    optimizationResult: OptimizationResult | null;
    optimizationStatus: OptimizationStatus;
    optimizationIterations: OptimizationIteration[];
    optimizationLog: string[];
    isPropagating: boolean;
    isOptimizing: boolean;
    activeSpacecraftId: string | null;
    activeSegmentId: string | null;
    activeRightTab: 'optimization' | 'dashboard' | 'data';

    // Mission actions
    setMission: (mission: Mission) => void;
    setMissionName: (name: string) => void;
    setGraphicsConfig: (config: Partial<GraphicsConfig>) => void;

    // Spacecraft actions
    addSpacecraft: () => void;
    removeSpacecraft: (id: string) => void;
    updateSpacecraft: (id: string, updates: Partial<Spacecraft>) => void;
    setActiveSpacecraft: (id: string | null) => void;

    // Tank actions
    addTank: (scId: string) => void;
    removeTank: (scId: string, tankId: string) => void;
    updateTank: (scId: string, tankId: string, updates: Partial<Tank>) => void;

    // Engine actions
    addEngine: (scId: string) => void;
    removeEngine: (scId: string, engineId: string) => void;
    updateEngine: (scId: string, engineId: string, updates: Partial<Engine>) => void;

    // Segment actions
    addSegment: (scId: string) => void;
    removeSegment: (scId: string, segId: string) => void;
    updateSegment: (scId: string, segId: string, updates: Partial<Segment>) => void;
    setActiveSegment: (id: string | null) => void;

    // UI actions
    setActiveRightTab: (tab: 'optimization' | 'dashboard' | 'data') => void;

    // Optimization config actions
    setOptimizationConfig: (config: OptimizationConfig) => void;
    addOptimizationVariable: (path: string, label: string, currentValue: number) => void;
    applyOptimizationResult: (variables: { path: string }[], values: number[]) => void;

    // Data output config actions
    addDataSeries: (config: Omit<DataSeriesConfig, 'id'>) => void;
    removeDataSeries: (id: string) => void;
    updateDataSeries: (id: string, updates: Partial<DataSeriesConfig>) => void;
    addDataPlot: (config: Omit<PlotConfig, 'id'>) => void;
    removeDataPlot: (id: string) => void;
    updateDataPlot: (id: string, updates: Partial<PlotConfig>) => void;

    // Propagation
    propagateAll: () => void;

    // Optimization
    setOptimizationStatus: (status: OptimizationStatus) => void;
    addOptimizationIteration: (iter: OptimizationIteration) => void;
    setOptimizationResult: (result: OptimizationResult | null) => void;
    clearOptimizationHistory: () => void;
    setIsOptimizing: (v: boolean) => void;
    addOptimizationLog: (line: string) => void;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
    mission: createDefaultMission(),
    trajectoryResults: new Map(),
    ghostTrajectoryResults: new Map(),
    optimizationResult: null,
    optimizationStatus: 'idle',
    optimizationIterations: [],
    optimizationLog: [],
    isPropagating: false,
    isOptimizing: false,
    activeSpacecraftId: null,
    activeSegmentId: null,
    activeRightTab: 'optimization',

    setMission: (mission) => set({ mission }),
    setMissionName: (name) => set((state) => ({
        mission: { ...state.mission, name },
    })),
    setGraphicsConfig: (config) => set((state) => ({
        mission: {
            ...state.mission,
            graphicsConfig: { ...state.mission.graphicsConfig, ...config },
        },
    })),

    addSpacecraft: () => set((state) => {
        const sc = createDefaultSpacecraft();
        sc.name = `Spacecraft ${state.mission.spacecraft.length + 1}`;
        return {
            mission: {
                ...state.mission,
                spacecraft: [...state.mission.spacecraft, sc],
            },
            activeSpacecraftId: sc.id,
        };
    }),

    removeSpacecraft: (id) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.filter(sc => sc.id !== id),
        },
        activeSpacecraftId: state.activeSpacecraftId === id ? null : state.activeSpacecraftId,
    })),

    updateSpacecraft: (id, updates) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === id ? { ...sc, ...updates } : sc
            ),
        },
    })),

    setActiveSpacecraft: (id) => set({ activeSpacecraftId: id, activeSegmentId: null }),

    addTank: (scId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? { ...sc, tanks: [...sc.tanks, createDefaultTank()] } : sc
            ),
        },
    })),

    removeTank: (scId, tankId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? { ...sc, tanks: sc.tanks.filter(t => t.id !== tankId) } : sc
            ),
        },
    })),

    updateTank: (scId, tankId, updates) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? {
                    ...sc,
                    tanks: sc.tanks.map(t => t.id === tankId ? { ...t, ...updates } : t),
                } : sc
            ),
        },
    })),

    addEngine: (scId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? { ...sc, engines: [...sc.engines, createDefaultEngine()] } : sc
            ),
        },
    })),

    removeEngine: (scId, engineId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? { ...sc, engines: sc.engines.filter(e => e.id !== engineId) } : sc
            ),
        },
    })),

    updateEngine: (scId, engineId, updates) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? {
                    ...sc,
                    engines: sc.engines.map(e => e.id === engineId ? { ...e, ...updates } : e),
                } : sc
            ),
        },
    })),

    addSegment: (scId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? {
                    ...sc,
                    segments: [...sc.segments, { ...createDefaultSegment(), name: `Segment ${sc.segments.length + 1}` }],
                } : sc
            ),
        },
    })),

    removeSegment: (scId, segId) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? { ...sc, segments: sc.segments.filter(s => s.id !== segId) } : sc
            ),
        },
    })),

    updateSegment: (scId, segId, updates) => set((state) => ({
        mission: {
            ...state.mission,
            spacecraft: state.mission.spacecraft.map(sc =>
                sc.id === scId ? {
                    ...sc,
                    segments: sc.segments.map(s => s.id === segId ? { ...s, ...updates } : s),
                } : sc
            ),
        },
    })),

    setActiveSegment: (id) => set({ activeSegmentId: id }),

    setActiveRightTab: (tab) => set({ activeRightTab: tab }),

    setOptimizationConfig: (config) => set((state) => ({
        mission: { ...state.mission, optimizationConfig: config },
    })),

    addOptimizationVariable: (path: string, label: string, currentValue: number) => set((state) => {
        const config = state.mission.optimizationConfig;

        // Don't add if path already exists
        if (config.variables.some(v => v.path === path)) {
            return state;
        }

        // Calculate reasonable bounds based on current value
        const margin = Math.abs(currentValue) * 0.5 + 1; // At least bounds of +/- 1

        const newVar = {
            id: generateId(),
            path,
            label,
            lowerBound: currentValue - margin,
            upperBound: currentValue + margin,
        };

        return {
            mission: {
                ...state.mission,
                optimizationConfig: {
                    ...config,
                    variables: [...config.variables, newVar],
                }
            }
        };
    }),

    applyOptimizationResult: (variables, values) => set((state) => {
        // Deep clone the mission so we can mutate paths
        const updated = JSON.parse(JSON.stringify(state.mission));
        const setByPath = (obj: unknown, path: string, value: unknown) => {
            const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let current = obj as any;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        };
        for (let i = 0; i < variables.length; i++) {
            setByPath(updated, variables[i].path, values[i]);
        }
        return { mission: updated };
    }),

    addDataSeries: (config) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                series: [...(state.mission.dataConfig?.series || []), { ...config, id: generateId() }],
            },
        },
    })),

    removeDataSeries: (id) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                series: (state.mission.dataConfig?.series || []).filter(s => s.id !== id),
                plots: (state.mission.dataConfig?.plots || []).map(p => ({
                    ...p,
                    seriesIds: p.seriesIds.filter(sid => sid !== id),
                })),
            },
        },
    })),

    updateDataSeries: (id, updates) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                series: (state.mission.dataConfig?.series || []).map(s => s.id === id ? { ...s, ...updates } : s),
            },
        },
    })),

    addDataPlot: (config) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                plots: [...(state.mission.dataConfig?.plots || []), { ...config, id: generateId() }],
            },
        },
    })),

    removeDataPlot: (id) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                plots: (state.mission.dataConfig?.plots || []).filter(p => p.id !== id),
            },
        },
    })),

    updateDataPlot: (id, updates) => set((state) => ({
        mission: {
            ...state.mission,
            dataConfig: {
                ...(state.mission.dataConfig || { series: [], plots: [] }),
                plots: (state.mission.dataConfig?.plots || []).map(p => p.id === id ? { ...p, ...updates } : p),
            },
        },
    })),

    propagateAll: () => {
        set({ isPropagating: true });
        try {
            const results = new Map<string, TrajectoryResult>();
            const { mission } = get();
            for (const sc of mission.spacecraft) {
                if (sc.segments.length > 0) {
                    const result = propagateSpacecraft(sc);
                    results.set(sc.id, result);
                }
            }
            set({ trajectoryResults: results, isPropagating: false, ghostTrajectoryResults: new Map() });
        } catch (e) {
            console.error('Propagation error:', e);
            set({ isPropagating: false });
        }
    },

    setOptimizationStatus: (status) => set({ optimizationStatus: status }),
    addOptimizationIteration: (iter) => set((state) => {
        const nextGhost = new Map(state.ghostTrajectoryResults);
        if (iter.activeTrajectories) {
            for (const t of iter.activeTrajectories) {
                nextGhost.set(t.spacecraftId, t);
            }
        }
        return {
            optimizationIterations: [...state.optimizationIterations, iter],
            ghostTrajectoryResults: nextGhost,
        };
    }),
    setOptimizationResult: (result) => set({ optimizationResult: result, ghostTrajectoryResults: new Map() }),
    clearOptimizationHistory: () => set({ optimizationIterations: [], optimizationResult: null, optimizationLog: [], ghostTrajectoryResults: new Map() }),
    setIsOptimizing: (v) => set({ isOptimizing: v }),
    addOptimizationLog: (line) => set((state) => ({
        optimizationLog: [...state.optimizationLog, line],
    })),
}));

export { createDefaultSegment, createDefaultSpacecraft };
