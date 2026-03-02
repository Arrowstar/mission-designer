'use client';

import React, { useRef, useState } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { OptimizerOptionsDialog } from './OptimizerOptionsDialog';
import {
    OptVariable,
    OptObjective,
    OptConstraint,
    OptimizationAlgorithm,
    ObjectiveType,
    ConstraintType,
    ConstraintMode,
    ReferenceFrame,
} from '../../lib/types';
import { generateId } from '../../lib/utils';
import { runOptimization } from '../../lib/optimizer';
import { getVariableUnit } from '../../lib/optimizationScaling';

export function OptimizationPanel() {
    const mission = useMissionStore(s => s.mission);
    const config = mission.optimizationConfig;
    const setOptimizationConfig = useMissionStore(s => s.setOptimizationConfig);
    const setOptimizationStatus = useMissionStore(s => s.setOptimizationStatus);
    const addOptimizationIteration = useMissionStore(s => s.addOptimizationIteration);
    const setOptimizationResult = useMissionStore(s => s.setOptimizationResult);
    const clearOptimizationHistory = useMissionStore(s => s.clearOptimizationHistory);
    const addOptimizationLog = useMissionStore(s => s.addOptimizationLog);
    const isOptimizing = useMissionStore(s => s.isOptimizing);
    const setIsOptimizing = useMissionStore(s => s.setIsOptimizing);
    const propagateAll = useMissionStore(s => s.propagateAll);
    const setActiveRightTab = useMissionStore(s => s.setActiveRightTab);
    const applyOptimizationResult = useMissionStore(s => s.applyOptimizationResult);

    const [showOptions, setShowOptions] = useState(false);

    const stopFlagRef = useRef(false);

    // Helper to update config
    const updateConfig = (updates: Partial<typeof config>) => {
        setOptimizationConfig({ ...config, ...updates });
    };

    // Variable CRUD

    const updateVariable = (id: string, updates: Partial<OptVariable>) => {
        updateConfig({
            variables: config.variables.map(v => v.id === id ? { ...v, ...updates } : v),
        });
    };

    const removeVariable = (id: string) => {
        updateConfig({ variables: config.variables.filter(v => v.id !== id) });
    };

    // Objective CRUD
    const addObjective = () => {
        const newObj: OptObjective = {
            id: generateId(),
            type: 'minimizeDeltaV',
            spacecraftId: mission.spacecraft[0]?.id ?? '',
            segmentId: mission.spacecraft[0]?.segments[0]?.id ?? '',
            weight: 1,
        };
        updateConfig({ objectives: [...config.objectives, newObj] });
    };

    const updateObjective = (id: string, updates: Partial<OptObjective>) => {
        updateConfig({
            objectives: config.objectives.map(o => o.id === id ? { ...o, ...updates } : o),
        });
    };

    const removeObjective = (id: string) => {
        updateConfig({ objectives: config.objectives.filter(o => o.id !== id) });
    };

    // Constraint CRUD
    const addConstraint = () => {
        const newCon: OptConstraint = {
            id: generateId(),
            constraintType: 'equality',
            mode: 'absolute',
            spacecraftId: mission.spacecraft[0]?.id ?? '',
            segmentId: mission.spacecraft[0]?.segments[0]?.id ?? '',
            quantity: 'a',
            referenceFrame: 'earthInertial',
            targetValue: 42164,
            tolerance: 1e-3,
        };
        updateConfig({ constraints: [...config.constraints, newCon] });
    };

    const updateConstraint = (id: string, updates: Partial<OptConstraint>) => {
        updateConfig({
            constraints: config.constraints.map(c => c.id === id ? { ...c, ...updates } : c),
        });
    };

    const removeConstraint = (id: string) => {
        updateConfig({ constraints: config.constraints.filter(c => c.id !== id) });
    };

    // Run optimization
    const handleRun = async () => {
        stopFlagRef.current = false;
        clearOptimizationHistory();
        setIsOptimizing(true);
        setOptimizationStatus('running');
        setActiveRightTab('dashboard');

        const result = await runOptimization(
            mission,
            config,
            (iter) => addOptimizationIteration(iter),
            () => stopFlagRef.current,
            (line) => addOptimizationLog(line),
        );

        setOptimizationResult(result);
        setOptimizationStatus(result.status);
        setIsOptimizing(false);

        // Push optimized variable values back to the mission
        if (result.bestVariables && result.bestVariables.length > 0) {
            applyOptimizationResult(config.variables, result.bestVariables);
        }

        // Re-propagate with updated mission
        propagateAll();
    };

    const handleStop = () => {
        stopFlagRef.current = true;
    };

    // Resolve a variable path to a human-readable label: "[Spacecraft] - [Segment] - [Quantity]"
    const getVariableDisplayLabel = (path: string): string => {
        // Parse spacecraft index
        const scMatch = path.match(/^spacecraft\[(\d+)\]/);
        if (!scMatch) return path;
        const scIdx = parseInt(scMatch[1]);
        const sc = mission.spacecraft[scIdx];
        if (!sc) return path;

        const rest = path.slice(scMatch[0].length + 1); // skip the dot

        // Check if it's a segment-level property
        const segMatch = rest.match(/^segments\[(\d+)\]\.?(.*)/);
        if (segMatch) {
            const segIdx = parseInt(segMatch[1]);
            const seg = sc.segments[segIdx];
            const segName = seg?.name || `Segment ${segIdx + 1}`;
            const quantity = segMatch[2];

            // Map known quantity suffixes to friendly names
            const quantityLabels: Record<string, string> = {
                'termination.duration': 'Duration',
                'thrust.azimuth': 'Thrust Azimuth',
                'thrust.elevation': 'Thrust Elevation',
            };
            const quantityLabel = quantityLabels[quantity] || quantity;
            return `${sc.name} - ${segName} - ${quantityLabel}`;
        }

        // Spacecraft-level properties
        const scQuantityLabels: Record<string, string> = {
            'dryMass': 'Dry Mass',
            'initialState.cartesian.x': 'Initial x',
            'initialState.cartesian.y': 'Initial y',
            'initialState.cartesian.z': 'Initial z',
            'initialState.cartesian.vx': 'Initial vx',
            'initialState.cartesian.vy': 'Initial vy',
            'initialState.cartesian.vz': 'Initial vz',
            'initialState.keplerian.a': 'Initial a',
            'initialState.keplerian.e': 'Initial e',
            'initialState.keplerian.i': 'Initial i',
            'initialState.keplerian.raan': 'Initial Ω',
            'initialState.keplerian.aop': 'Initial ω',
            'initialState.keplerian.ta': 'Initial ν',
        };
        const quantityLabel = scQuantityLabels[rest] || rest;
        return `${sc.name} - ${quantityLabel}`;
    };

    return (
        <div className="fade-in">
            {/* Algorithm Settings */}
            <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div className="section-title" style={{ marginBottom: '4px' }}>Algorithm Engine</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {config.algorithm === 'LN_COBYLA' ? 'COBYLA (Derivative-free)' :
                            config.algorithm === 'LN_BOBYQA' ? 'BOBYQA (Derivative-free)' :
                                config.algorithm === 'LD_SLSQP' ? 'SLSQP (Gradient-based)' :
                                    config.algorithm === 'LD_MMA' ? 'MMA (Gradient-based)' :
                                        config.algorithm === 'GN_ISRES' ? 'ISRES (Global)' : config.algorithm}
                        {' '}&middot; {config.maxIterations} Max Iterations
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowOptions(true)}>
                    ⚙️ Options
                </button>
            </div>

            {showOptions && <OptimizerOptionsDialog onClose={() => setShowOptions(false)} />}


            {/* Variables */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Variables ({config.variables.length})</span>
                </div>
                {config.variables.map(v => (
                    <div key={v.id} className="card" style={{ padding: '8px 10px' }}>
                        <div className="card-header" style={{ marginBottom: '4px' }}>
                            <span style={{
                                flex: 1,
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {getVariableDisplayLabel(v.path)}
                            </span>
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => removeVariable(v.id)}
                                style={{ width: '22px', height: '22px', fontSize: '10px', flexShrink: 0 }}>✕</button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    Lower {getVariableUnit(v.path) ? `(${getVariableUnit(v.path)})` : ''}
                                </label>
                                <input className="form-input" type="number" value={v.lowerBound}
                                    onChange={e => updateVariable(v.id, { lowerBound: parseFloat(e.target.value) })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    Upper {getVariableUnit(v.path) ? `(${getVariableUnit(v.path)})` : ''}
                                </label>
                                <input className="form-input" type="number" value={v.upperBound}
                                    onChange={e => updateVariable(v.id, { upperBound: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Objectives */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Objectives ({config.objectives.length})</span>
                    <button className="btn btn-sm" onClick={addObjective} id="add-objective-btn">+ Add</button>
                </div>
                {config.objectives.map(obj => (
                    <div key={obj.id} className="card" style={{ padding: '8px 10px' }}>
                        <div className="card-header" style={{ marginBottom: '4px' }}>
                            <select className="form-select" style={{ maxWidth: '140px', padding: '2px 6px', fontSize: '11px' }}
                                value={obj.type}
                                onChange={e => updateObjective(obj.id, { type: e.target.value as ObjectiveType })}>
                                <option value="minimizeDeltaV">Minimize ΔV</option>
                                <option value="minimizeMass">Minimize Mass</option>
                                <option value="maximizeMass">Maximize Mass</option>
                            </select>
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => removeObjective(obj.id)}
                                style={{ width: '22px', height: '22px', fontSize: '10px' }}>✕</button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Spacecraft</label>
                                <select className="form-select" value={obj.spacecraftId}
                                    onChange={e => updateObjective(obj.id, { spacecraftId: e.target.value })}>
                                    {mission.spacecraft.map(sc => (
                                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">At Segment End</label>
                                <select className="form-select" value={obj.segmentId}
                                    onChange={e => updateObjective(obj.id, { segmentId: e.target.value })}>
                                    {(mission.spacecraft.find(s => s.id === obj.spacecraftId)?.segments ?? []).map((seg, i) => (
                                        <option key={seg.id} value={seg.id}>{seg.name || `Seg ${i + 1}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Weight</label>
                                <input className="form-input" type="number" step="0.1" value={obj.weight}
                                    onChange={e => updateObjective(obj.id, { weight: parseFloat(e.target.value) || 1 })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Scale Factor</label>
                                <input className="form-input" type="number" step="0.1" value={obj.scaleFactor ?? 1}
                                    onChange={e => updateObjective(obj.id, { scaleFactor: parseFloat(e.target.value) || 1 })} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Constraints */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Constraints ({config.constraints.length})</span>
                    <button className="btn btn-sm" onClick={addConstraint} id="add-constraint-btn">+ Add</button>
                </div>
                {config.constraints.map(con => (
                    <div key={con.id} className="card" style={{ padding: '8px 10px' }}>
                        <div className="card-header" style={{ marginBottom: '4px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <select className="form-select" style={{ maxWidth: '80px', padding: '2px 4px', fontSize: '10px' }}
                                    value={con.constraintType}
                                    onChange={e => updateConstraint(con.id, { constraintType: e.target.value as ConstraintType })}>
                                    <option value="equality">=</option>
                                    <option value="inequalityLTE">≤</option>
                                    <option value="inequalityGTE">≥</option>
                                </select>
                                <select className="form-select" style={{ maxWidth: '90px', padding: '2px 4px', fontSize: '10px' }}
                                    value={con.mode}
                                    onChange={e => updateConstraint(con.id, { mode: e.target.value as ConstraintMode })}>
                                    <option value="absolute">Absolute</option>
                                    <option value="relative">Relative</option>
                                </select>
                            </div>
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => removeConstraint(con.id)}
                                style={{ width: '22px', height: '22px', fontSize: '10px' }}>✕</button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Quantity</label>
                                <select className="form-select" value={con.quantity}
                                    onChange={e => updateConstraint(con.id, { quantity: e.target.value })}>
                                    <option value="x">x</option><option value="y">y</option><option value="z">z</option>
                                    <option value="vx">vx</option><option value="vy">vy</option><option value="vz">vz</option>
                                    <option value="mass">mass</option>
                                    <option value="a">a (SMA)</option><option value="e">e</option><option value="i">i</option>
                                    <option value="raan">Ω (RAAN)</option><option value="aop">ω (AoP)</option><option value="ta">ν (TA)</option>
                                    <option value="rPeri">rPeri (Periapsis Radius)</option><option value="rApo">rApo (Apoapsis Radius)</option>
                                    <option value="altPeri">altPeri (Periapsis Altitude)</option><option value="altApo">altApo (Apoapsis Altitude)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ref Frame</label>
                                <select className="form-select" value={con.referenceFrame}
                                    onChange={e => updateConstraint(con.id, { referenceFrame: e.target.value as ReferenceFrame })}>
                                    <option value="earthInertial">Earth</option>
                                    <option value="moonInertial">Moon</option>
                                    <option value="sunInertial">Sun</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Spacecraft</label>
                                <select className="form-select" value={con.spacecraftId}
                                    onChange={e => updateConstraint(con.id, { spacecraftId: e.target.value })}>
                                    {mission.spacecraft.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Segment</label>
                                <select className="form-select" value={con.segmentId}
                                    onChange={e => updateConstraint(con.id, { segmentId: e.target.value })}>
                                    {(mission.spacecraft.find(s => s.id === con.spacecraftId)?.segments ?? []).map((seg, i) => (
                                        <option key={seg.id} value={seg.id}>{seg.name || `Seg ${i + 1}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {con.mode === 'absolute' ? (
                            <div className="form-group">
                                <label className="form-label">Target Value</label>
                                <input className="form-input" type="number" value={con.targetValue ?? 0}
                                    onChange={e => updateConstraint(con.id, { targetValue: parseFloat(e.target.value) })} />
                            </div>
                        ) : (
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Rel. Spacecraft</label>
                                    <select className="form-select" value={con.relativeSpacecraftId ?? ''}
                                        onChange={e => updateConstraint(con.id, { relativeSpacecraftId: e.target.value })}>
                                        {mission.spacecraft.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rel. Segment</label>
                                    <select className="form-select" value={con.relativeSegmentId ?? ''}
                                        onChange={e => updateConstraint(con.id, { relativeSegmentId: e.target.value })}>
                                        {(mission.spacecraft.find(s => s.id === con.relativeSpacecraftId)?.segments ?? []).map((seg, i) => (
                                            <option key={seg.id} value={seg.id}>{seg.name || `Seg ${i + 1}`}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tolerance</label>
                                <input className="form-input" type="number" step="1e-4" value={con.tolerance}
                                    onChange={e => updateConstraint(con.id, { tolerance: parseFloat(e.target.value) || 1e-3 })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Scale Factor</label>
                                <input className="form-input" type="number" step="0.1" value={con.scaleFactor ?? 1}
                                    onChange={e => updateConstraint(con.id, { scaleFactor: parseFloat(e.target.value) || 1 })} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Run Button */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                {isOptimizing ? (
                    <button className="btn btn-danger" onClick={handleStop} id="stop-opt-btn" style={{ flex: 1 }}>
                        ⏹ Stop
                    </button>
                ) : (
                    <button className="btn btn-success" onClick={handleRun} id="run-opt-btn" style={{ flex: 1 }}>
                        ▶ Run Optimization
                    </button>
                )}
            </div>
        </div>
    );
}
