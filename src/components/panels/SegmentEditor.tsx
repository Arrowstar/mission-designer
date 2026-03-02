'use client';

import React from 'react';
import { useMissionStore } from '../../store/missionStore';
import {
    Segment,
    ForceModelConfig,
    ThrustConfig,
    ControlFrame,
    ReferenceFrame,
} from '../../lib/types';

export function SegmentEditor() {
    const mission = useMissionStore(s => s.mission);
    const activeSpacecraftId = useMissionStore(s => s.activeSpacecraftId);
    const activeSegmentId = useMissionStore(s => s.activeSegmentId);
    const setActiveSegment = useMissionStore(s => s.setActiveSegment);
    const addSegment = useMissionStore(s => s.addSegment);
    const removeSegment = useMissionStore(s => s.removeSegment);
    const updateSegment = useMissionStore(s => s.updateSegment);
    const addOptimizationVariable = useMissionStore(s => s.addOptimizationVariable);

    const sc = mission.spacecraft.find(s => s.id === activeSpacecraftId);

    if (!sc) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No Spacecraft Selected</div>
                <div className="empty-state-text">Select a spacecraft from the Mission tab to manage its trajectory segments.</div>
            </div>
        );
    }

    const activeSeg = sc.segments.find(s => s.id === activeSegmentId);

    const updateForceModel = (segId: string, updates: Partial<ForceModelConfig>) => {
        const seg = sc.segments.find(s => s.id === segId);
        if (!seg) return;
        updateSegment(sc.id, segId, { forceModel: { ...seg.forceModel, ...updates } });
    };

    const updateThrust = (segId: string, updates: Partial<ThrustConfig>) => {
        const seg = sc.segments.find(s => s.id === segId);
        if (!seg) return;
        updateSegment(sc.id, segId, { thrust: { ...seg.thrust, ...updates } });
    };

    const formatDuration = (seconds: number): string => {
        if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(2)} hr`;
        return `${(seconds / 86400).toFixed(2)} days`;
    };

    // Helper for adding optimization variables
    const OptimizeButton = ({ path, label, value }: { path: string, label: string, value: number }) => {
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
            >
                {isActive ? '✅' : '🎯'}
            </button>
        );
    };

    return (
        <div className="fade-in">
            {/* Segment List */}
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Segments — {sc.name}</span>
                    <button className="btn btn-sm btn-primary" onClick={() => addSegment(sc.id)} id="add-segment-btn">
                        + Add
                    </button>
                </div>
                {sc.segments.map((seg, idx) => (
                    <div
                        key={seg.id}
                        className={`segment-item ${activeSegmentId === seg.id ? 'active' : ''}`}
                        onClick={() => setActiveSegment(seg.id)}
                    >
                        <div className="segment-number">{idx + 1}</div>
                        <div className="segment-info">
                            <div className="segment-name">{seg.name}</div>
                            <div className="segment-detail">{formatDuration(seg.termination.duration)}</div>
                        </div>
                        <span className={`badge ${seg.thrust.enabled ? 'badge-thrust' : 'badge-coast'}`}>
                            {seg.thrust.enabled ? '🔥 Burn' : '🌀 Coast'}
                        </span>
                        <button
                            className="btn btn-sm btn-danger btn-icon"
                            onClick={(e) => { e.stopPropagation(); removeSegment(sc.id, seg.id); }}
                            style={{ width: '22px', height: '22px', fontSize: '10px' }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {/* Segment Detail Editor */}
            {activeSeg && (
                <div className="fade-in" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <div className="form-group">
                        <label className="form-label">Segment Name</label>
                        <input
                            className="form-input"
                            value={activeSeg.name}
                            onChange={e => updateSegment(sc.id, activeSeg.id, { name: e.target.value })}
                        />
                    </div>

                    {/* Termination */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                            Duration (seconds)
                            <OptimizeButton
                                path={`spacecraft[${mission.spacecraft.findIndex(s => s.id === sc.id)}].segments[${sc.segments.findIndex(s => s.id === activeSeg.id)}].termination.duration`}
                                label={`${sc.name} - ${activeSeg.name} Duration`}
                                value={activeSeg.termination.duration}
                            />
                        </label>
                        <input
                            className="form-input"
                            type="number"
                            value={activeSeg.termination.duration}
                            onChange={e => updateSegment(sc.id, activeSeg.id, {
                                termination: { ...activeSeg.termination, duration: parseFloat(e.target.value) || 0 }
                            })}
                        />
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            = {formatDuration(activeSeg.termination.duration)}
                        </div>
                    </div>

                    {/* Force Model */}
                    <div className="section">
                        <div className="section-title" style={{ marginBottom: '8px' }}>Force Model</div>
                        <label className="form-checkbox">
                            <input type="checkbox" checked={activeSeg.forceModel.earthGravity}
                                onChange={e => updateForceModel(activeSeg.id, { earthGravity: e.target.checked })} />
                            Earth Point-Mass Gravity
                        </label>
                        <label className="form-checkbox" style={{ marginTop: '4px' }}>
                            <input type="checkbox" checked={activeSeg.forceModel.moonGravity}
                                onChange={e => updateForceModel(activeSeg.id, { moonGravity: e.target.checked })} />
                            Moon Point-Mass Gravity
                        </label>
                        <label className="form-checkbox" style={{ marginTop: '4px' }}>
                            <input type="checkbox" checked={activeSeg.forceModel.sunGravity}
                                onChange={e => updateForceModel(activeSeg.id, { sunGravity: e.target.checked })} />
                            Sun Point-Mass Gravity
                        </label>
                    </div>

                    {/* Thrust */}
                    <div className="section">
                        <div className="section-title" style={{ marginBottom: '8px' }}>Thrust Configuration</div>
                        <label className="form-checkbox" style={{ marginBottom: '8px' }}>
                            <input type="checkbox" checked={activeSeg.thrust.enabled}
                                onChange={e => updateThrust(activeSeg.id, { enabled: e.target.checked })} />
                            Enable Thrust
                        </label>

                        {activeSeg.thrust.enabled && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Engine</label>
                                    <select
                                        className="form-select"
                                        value={activeSeg.thrust.engineId}
                                        onChange={e => updateThrust(activeSeg.id, { engineId: e.target.value })}
                                    >
                                        <option value="">Select engine...</option>
                                        {sc.engines.map(eng => (
                                            <option key={eng.id} value={eng.id}>{eng.name} ({eng.thrust} N, Isp={eng.isp}s)</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Control Frame</label>
                                        <select
                                            className="form-select"
                                            value={activeSeg.thrust.controlFrame}
                                            onChange={e => updateThrust(activeSeg.id, { controlFrame: e.target.value as ControlFrame })}
                                        >
                                            <option value="inertial">Inertial</option>
                                            <option value="vnc">VNC</option>
                                            <option value="vuw">VUW</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ref Frame</label>
                                        <select
                                            className="form-select"
                                            value={activeSeg.thrust.referenceFrame}
                                            onChange={e => updateThrust(activeSeg.id, { referenceFrame: e.target.value as ReferenceFrame })}
                                        >
                                            <option value="earthInertial">Earth Inertial</option>
                                            <option value="moonInertial">Moon Inertial</option>
                                            <option value="sunInertial">Sun Inertial</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                            Azimuth (°)
                                            <OptimizeButton
                                                path={`spacecraft[${mission.spacecraft.findIndex(s => s.id === sc.id)}].segments[${sc.segments.findIndex(s => s.id === activeSeg.id)}].thrust.azimuth`}
                                                label={`${activeSeg.name} Thrust Azimuth`}
                                                value={activeSeg.thrust.azimuth}
                                            />
                                        </label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            step="0.1"
                                            value={activeSeg.thrust.azimuth}
                                            onChange={e => updateThrust(activeSeg.id, { azimuth: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                                            Elevation (°)
                                            <OptimizeButton
                                                path={`spacecraft[${mission.spacecraft.findIndex(s => s.id === sc.id)}].segments[${sc.segments.findIndex(s => s.id === activeSeg.id)}].thrust.elevation`}
                                                label={`${activeSeg.name} Thrust Elevation`}
                                                value={activeSeg.thrust.elevation}
                                            />
                                        </label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            step="0.1"
                                            value={activeSeg.thrust.elevation}
                                            onChange={e => updateThrust(activeSeg.id, { elevation: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Segment Graphics Options */}
                    <div className="section">
                        <div className="section-title" style={{ marginBottom: '8px' }}>Graphics Options</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Color</label>
                                <input
                                    type="color"
                                    className="form-input"
                                    title="Segment Color"
                                    style={{ padding: '0', height: '32px', cursor: 'pointer' }}
                                    value={activeSeg.graphics.color}
                                    onChange={e => updateSegment(sc.id, activeSeg.id, { graphics: { ...activeSeg.graphics, color: e.target.value } })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Line Style</label>
                                <select
                                    className="form-select"
                                    title="Line Style"
                                    value={activeSeg.graphics.lineStyle}
                                    onChange={e => updateSegment(sc.id, activeSeg.id, { graphics: { ...activeSeg.graphics, lineStyle: e.target.value as any } })}
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Width</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    title="Line Width"
                                    min="1" max="10"
                                    value={activeSeg.graphics.lineWidth}
                                    onChange={e => updateSegment(sc.id, activeSeg.id, { graphics: { ...activeSeg.graphics, lineWidth: parseInt(e.target.value) || 2 } })}
                                />
                            </div>
                        </div>
                        {activeSeg.thrust.enabled && (
                            <div className="form-group" style={{ marginTop: '8px' }}>
                                <label className="form-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={activeSeg.graphics.plotThrustVector}
                                        onChange={e => updateSegment(sc.id, activeSeg.id, { graphics: { ...activeSeg.graphics, plotThrustVector: e.target.checked } })}
                                    />
                                    Plot Thrust Vectors
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
