'use client';

import React from 'react';
import { useMissionStore } from '../../store/missionStore';
import {
    Spacecraft,
    CartesianState,
    KeplerianElements,
    InitialState,
    ReferenceFrame,
    CoordinateType,
    Tank,
    Engine,
} from '../../lib/types';

const OptimizeButton = ({ path, label, value }: { path: string, label: string, value: number }) => {
    const mission = useMissionStore(s => s.mission);
    const addOptimizationVariable = useMissionStore(s => s.addOptimizationVariable);
    const isActive = mission.optimizationConfig.variables.some(v => v.path === path);

    return (
        <button
            className="btn btn-sm btn-icon"
            onClick={() => !isActive && addOptimizationVariable(path, label, value)}
            title={isActive ? 'Already added as variable' : 'Add as Optimization Variable'}
            style={{
                marginLeft: '8px',
                background: isActive ? 'rgba(46, 204, 113, 0.15)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--accent-success)' : 'var(--border-subtle)'}`,
                color: isActive ? 'var(--accent-success)' : 'var(--accent-warning)',
                padding: '0 6px',
                cursor: isActive ? 'default' : 'pointer',
            }}
            disabled={isActive}
        >
            {isActive ? '✅' : '🎯'}
        </button>
    );
};

export function SpacecraftEditor() {
    const mission = useMissionStore(s => s.mission);
    const activeSpacecraftId = useMissionStore(s => s.activeSpacecraftId);
    const updateSpacecraft = useMissionStore(s => s.updateSpacecraft);
    const addTank = useMissionStore(s => s.addTank);
    const removeTank = useMissionStore(s => s.removeTank);
    const updateTank = useMissionStore(s => s.updateTank);
    const addEngine = useMissionStore(s => s.addEngine);
    const removeEngine = useMissionStore(s => s.removeEngine);
    const updateEngine = useMissionStore(s => s.updateEngine);
    const addOptimizationVariable = useMissionStore(s => s.addOptimizationVariable);

    const sc = mission.spacecraft.find(s => s.id === activeSpacecraftId);

    if (!sc) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">🛰️</div>
                <div className="empty-state-title">No Spacecraft Selected</div>
                <div className="empty-state-text">Select a spacecraft from the Mission tab to edit its properties.</div>
            </div>
        );
    }

    const updateInitialState = (updates: Partial<InitialState>) => {
        updateSpacecraft(sc.id, { initialState: { ...sc.initialState, ...updates } });
    };

    const updateCartesian = (key: keyof CartesianState, value: number) => {
        updateInitialState({ cartesian: { ...sc.initialState.cartesian, [key]: value } });
    };

    const updateKeplerian = (key: keyof KeplerianElements, value: number) => {
        updateInitialState({ keplerian: { ...sc.initialState.keplerian, [key]: value } });
    };

    const scIdx = mission.spacecraft.findIndex(s => s.id === sc.id);

    return (
        <div className="fade-in">
            {/* Name */}
            <div className="form-group">
                <label className="form-label">Spacecraft Name</label>
                <input
                    className="form-input"
                    value={sc.name}
                    onChange={e => updateSpacecraft(sc.id, { name: e.target.value })}
                    id="sc-name-input"
                />
            </div>

            {/* Dry Mass */}
            <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Dry Mass (kg)
                    <OptimizeButton path={`spacecraft[${scIdx}].dryMass`} label={`${sc.name} Dry Mass`} value={sc.dryMass} />
                </label>
                <input
                    className="form-input"
                    type="number"
                    value={sc.dryMass}
                    onChange={e => updateSpacecraft(sc.id, { dryMass: parseFloat(e.target.value) || 0 })}
                    id="sc-dry-mass"
                />
            </div>

            {/* Initial Epoch */}
            <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Initial Epoch
                    <OptimizeButton
                        path={`spacecraft[${scIdx}].initialState.epoch`}
                        label={`${sc.name} Initial Epoch`}
                        value={sc.initialState.epoch}
                    />
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        type="datetime-local"
                        value={new Date((sc.initialState.epoch || Math.floor(Date.now() / 1000)) * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                        onChange={e => {
                            if (!e.target.value) return;
                            const d = new Date(e.target.value);
                            updateInitialState({ epoch: Math.floor(d.getTime() / 1000) });
                        }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {sc.initialState.epoch} s (Unix)
                    </span>
                </div>
            </div>

            {/* Reference Frame */}
            <div className="form-group">
                <label className="form-label">Reference Frame</label>
                <select
                    className="form-select"
                    value={sc.initialState.referenceFrame}
                    onChange={e => updateInitialState({ referenceFrame: e.target.value as ReferenceFrame })}
                    id="sc-ref-frame"
                >
                    <option value="earthInertial">Earth Inertial (ECI)</option>
                    <option value="moonInertial">Moon Inertial (MCI)</option>
                    <option value="sunInertial">Sun Inertial (SCI)</option>
                </select>
            </div>

            {/* Coordinate Type Toggle */}
            <div className="form-group">
                <label className="form-label">Coordinate Type</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        className={`btn btn-sm ${sc.initialState.coordinateType === 'cartesian' ? 'btn-primary' : ''}`}
                        onClick={() => updateInitialState({ coordinateType: 'cartesian' as CoordinateType })}
                        id="coord-cartesian"
                    >
                        Cartesian
                    </button>
                    <button
                        className={`btn btn-sm ${sc.initialState.coordinateType === 'keplerian' ? 'btn-primary' : ''}`}
                        onClick={() => updateInitialState({ coordinateType: 'keplerian' as CoordinateType })}
                        id="coord-keplerian"
                    >
                        Keplerian
                    </button>
                </div>
            </div>

            {/* State Inputs */}
            {sc.initialState.coordinateType === 'cartesian' ? (
                <div className="section">
                    <div className="section-title" style={{ marginBottom: '8px' }}>Cartesian State</div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                x (km)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.x`} label={`${sc.name} initial x`} value={sc.initialState.cartesian.x} />
                            </label>
                            <input className="form-input" type="number" value={sc.initialState.cartesian.x}
                                onChange={e => updateCartesian('x', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                y (km)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.y`} label={`${sc.name} initial y`} value={sc.initialState.cartesian.y} />
                            </label>
                            <input className="form-input" type="number" value={sc.initialState.cartesian.y}
                                onChange={e => updateCartesian('y', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                z (km)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.z`} label={`${sc.name} initial z`} value={sc.initialState.cartesian.z} />
                            </label>
                            <input className="form-input" type="number" value={sc.initialState.cartesian.z}
                                onChange={e => updateCartesian('z', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                vx (km/s)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.vx`} label={`${sc.name} initial vx`} value={sc.initialState.cartesian.vx} />
                            </label>
                            <input className="form-input" type="number" step="0.001" value={sc.initialState.cartesian.vx}
                                onChange={e => updateCartesian('vx', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                vy (km/s)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.vy`} label={`${sc.name} initial vy`} value={sc.initialState.cartesian.vy} />
                            </label>
                            <input className="form-input" type="number" step="0.001" value={sc.initialState.cartesian.vy}
                                onChange={e => updateCartesian('vy', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                vz (km/s)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.cartesian.vz`} label={`${sc.name} initial vz`} value={sc.initialState.cartesian.vz} />
                            </label>
                            <input className="form-input" type="number" step="0.001" value={sc.initialState.cartesian.vz}
                                onChange={e => updateCartesian('vz', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="section">
                    <div className="section-title" style={{ marginBottom: '8px' }}>Keplerian Elements</div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                a (km)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.a`} label={`${sc.name} initial a`} value={sc.initialState.keplerian.a} />
                            </label>
                            <input className="form-input" type="number" value={sc.initialState.keplerian.a}
                                onChange={e => updateKeplerian('a', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                e
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.e`} label={`${sc.name} initial e`} value={sc.initialState.keplerian.e} />
                            </label>
                            <input className="form-input" type="number" step="0.001" value={sc.initialState.keplerian.e}
                                onChange={e => updateKeplerian('e', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                i (°)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.i`} label={`${sc.name} initial i`} value={sc.initialState.keplerian.i} />
                            </label>
                            <input className="form-input" type="number" step="0.1" value={sc.initialState.keplerian.i}
                                onChange={e => updateKeplerian('i', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                Ω (°)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.raan`} label={`${sc.name} initial Ω`} value={sc.initialState.keplerian.raan} />
                            </label>
                            <input className="form-input" type="number" step="0.1" value={sc.initialState.keplerian.raan}
                                onChange={e => updateKeplerian('raan', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                ω (°)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.aop`} label={`${sc.name} initial ω`} value={sc.initialState.keplerian.aop} />
                            </label>
                            <input className="form-input" type="number" step="0.1" value={sc.initialState.keplerian.aop}
                                onChange={e => updateKeplerian('aop', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                ν (°)
                                <OptimizeButton path={`spacecraft[${scIdx}].initialState.keplerian.ta`} label={`${sc.name} initial ν`} value={sc.initialState.keplerian.ta} />
                            </label>
                            <input className="form-input" type="number" step="0.1" value={sc.initialState.keplerian.ta}
                                onChange={e => updateKeplerian('ta', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                </div>
            )}

            {/* ===== TANKS ===== */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Fuel Tanks</span>
                    <button className="btn btn-sm" onClick={() => addTank(sc.id)} id="add-tank-btn">+ Add</button>
                </div>
                {sc.tanks.map((tank: Tank, idx: number) => (
                    <div key={tank.id} className="card" style={{ padding: '8px 10px' }}>
                        <div className="card-header" style={{ marginBottom: '6px' }}>
                            <input
                                className="form-input"
                                style={{ maxWidth: '140px', padding: '3px 6px', fontSize: '11px' }}
                                value={tank.name}
                                onChange={e => updateTank(sc.id, tank.id, { name: e.target.value })}
                            />
                            <button
                                className="btn btn-sm btn-danger btn-icon"
                                onClick={() => removeTank(sc.id, tank.id)}
                                style={{ width: '24px', height: '24px' }}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Propellant Mass (kg)</label>
                            <input
                                className="form-input"
                                type="number"
                                value={tank.propellantMass}
                                onChange={e => updateTank(sc.id, tank.id, { propellantMass: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== ENGINES ===== */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Engines</span>
                    <button className="btn btn-sm" onClick={() => addEngine(sc.id)} id="add-engine-btn">+ Add</button>
                </div>
                {sc.engines.map((engine: Engine, idx: number) => (
                    <div key={engine.id} className="card" style={{ padding: '8px 10px' }}>
                        <div className="card-header" style={{ marginBottom: '6px' }}>
                            <input
                                className="form-input"
                                style={{ maxWidth: '140px', padding: '3px 6px', fontSize: '11px' }}
                                value={engine.name}
                                onChange={e => updateEngine(sc.id, engine.id, { name: e.target.value })}
                            />
                            <button
                                className="btn btn-sm btn-danger btn-icon"
                                onClick={() => removeEngine(sc.id, engine.id)}
                                style={{ width: '24px', height: '24px' }}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Thrust (N)</label>
                                <input className="form-input" type="number" value={engine.thrust}
                                    onChange={e => updateEngine(sc.id, engine.id, { thrust: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Isp (s)</label>
                                <input className="form-input" type="number" value={engine.isp}
                                    onChange={e => updateEngine(sc.id, engine.id, { isp: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Propellant Source</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {sc.tanks.map(tank => (
                                    <label key={tank.id} className="form-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={engine.tankIds.includes(tank.id)}
                                            onChange={e => {
                                                const newTankIds = e.target.checked
                                                    ? [...engine.tankIds, tank.id]
                                                    : engine.tankIds.filter(id => id !== tank.id);
                                                updateEngine(sc.id, engine.id, { tankIds: newTankIds });
                                            }}
                                        />
                                        {tank.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
