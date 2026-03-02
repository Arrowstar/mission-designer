'use client';

import React from 'react';
import { useMissionStore } from '../../store/missionStore';

export function MissionPanel() {
    const mission = useMissionStore(s => s.mission);
    const addSpacecraft = useMissionStore(s => s.addSpacecraft);
    const removeSpacecraft = useMissionStore(s => s.removeSpacecraft);
    const activeSpacecraftId = useMissionStore(s => s.activeSpacecraftId);
    const setActiveSpacecraft = useMissionStore(s => s.setActiveSpacecraft);
    const trajectoryResults = useMissionStore(s => s.trajectoryResults);
    const setGraphicsConfig = useMissionStore(s => s.setGraphicsConfig);

    return (
        <div className="fade-in">
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Spacecraft</span>
                    <button className="btn btn-sm btn-primary" onClick={addSpacecraft} id="add-spacecraft-btn">
                        + Add
                    </button>
                </div>

                {mission.spacecraft.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛰️</div>
                        <div className="empty-state-title">No Spacecraft</div>
                        <div className="empty-state-text">
                            Add a spacecraft to begin designing your mission trajectory.
                        </div>
                    </div>
                ) : (
                    mission.spacecraft.map((sc, idx) => {
                        const hasResult = trajectoryResults.has(sc.id);
                        return (
                            <div
                                key={sc.id}
                                className={`card ${activeSpacecraftId === sc.id ? 'active' : ''}`}
                                onClick={() => setActiveSpacecraft(sc.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">{sc.name}</div>
                                        <div className="card-subtitle">
                                            {sc.segments.length} segment{sc.segments.length !== 1 ? 's' : ''} · {sc.tanks.length} tank{sc.tanks.length !== 1 ? 's' : ''} · {sc.engines.length} engine{sc.engines.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {hasResult && <span className="badge badge-success">✓ Prop</span>}
                                        <button
                                            className="btn btn-sm btn-danger btn-icon"
                                            onClick={(e) => { e.stopPropagation(); removeSpacecraft(sc.id); }}
                                            id={`remove-sc-${idx}`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Frame: </span>
                                        <span style={{ color: 'var(--text-accent)' }}>
                                            {sc.initialState.referenceFrame === 'earthInertial' ? 'Earth' : sc.initialState.referenceFrame === 'moonInertial' ? 'Moon' : 'Sun'}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Mass: </span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                                            {(sc.dryMass + sc.tanks.reduce((s, t) => s + t.propellantMass, 0)).toFixed(0)} kg
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                                        <span>{sc.initialState.coordinateType === 'keplerian' ? 'Keplerian' : 'Cartesian'}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {sc.initialState.coordinateType === 'keplerian' ? 'a: ' : 'x: '}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                                            {sc.initialState.coordinateType === 'keplerian'
                                                ? `${sc.initialState.keplerian.a.toFixed(1)} km`
                                                : `${sc.initialState.cartesian.x.toFixed(1)} km`
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Summary stats */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Mission Summary</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="dashboard-card" style={{ padding: '10px 12px', marginBottom: 0 }}>
                        <div className="dashboard-label">Total S/C</div>
                        <div className="dashboard-value accent" style={{ fontSize: '18px' }}>
                            {mission.spacecraft.length}
                        </div>
                    </div>
                    <div className="dashboard-card" style={{ padding: '10px 12px', marginBottom: 0 }}>
                        <div className="dashboard-label">Total Segments</div>
                        <div className="dashboard-value accent" style={{ fontSize: '18px' }}>
                            {mission.spacecraft.reduce((s, sc) => s + sc.segments.length, 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Graphics Options */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Global Graphics</span>
                </div>
                <div className="form-group">
                    <label className="form-label">Plot Reference Frame</label>
                    <select
                        className="form-select"
                        title="Plot Reference Frame"
                        value={mission.graphicsConfig.plotFrame}
                        onChange={e => setGraphicsConfig({ plotFrame: e.target.value as any })}
                    >
                        <option value="earthInertial">Earth Inertial</option>
                        <option value="moonInertial">Moon Inertial</option>
                        <option value="sunInertial">Sun Inertial</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Celestial Bodies</label>
                    <div className="form-row" style={{ marginTop: '4px' }}>
                        <label className="form-checkbox">
                            <input
                                type="checkbox"
                                checked={mission.graphicsConfig.celestialBodies.earth}
                                onChange={e => setGraphicsConfig({ celestialBodies: { ...mission.graphicsConfig.celestialBodies, earth: e.target.checked } })}
                            />
                            Earth
                        </label>
                        <label className="form-checkbox">
                            <input
                                type="checkbox"
                                checked={mission.graphicsConfig.celestialBodies.moon}
                                onChange={e => setGraphicsConfig({ celestialBodies: { ...mission.graphicsConfig.celestialBodies, moon: e.target.checked } })}
                            />
                            Moon
                        </label>
                        <label className="form-checkbox">
                            <input
                                type="checkbox"
                                checked={mission.graphicsConfig.celestialBodies.sun}
                                onChange={e => setGraphicsConfig({ celestialBodies: { ...mission.graphicsConfig.celestialBodies, sun: e.target.checked } })}
                            />
                            Sun
                        </label>
                    </div>
                </div>
                <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="form-checkbox">
                        <input
                            type="checkbox"
                            checked={mission.graphicsConfig.showOrbits}
                            onChange={e => setGraphicsConfig({ showOrbits: e.target.checked })}
                        />
                        Show Celestial Orbits
                    </label>
                </div>
            </div>
        </div>
    );
}
