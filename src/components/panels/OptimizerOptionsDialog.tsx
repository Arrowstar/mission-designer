import React from 'react';
import { useMissionStore } from '../../store/missionStore';
import { OptimizationAlgorithm } from '../../lib/types';

interface OptimizerOptionsDialogProps {
    onClose: () => void;
}

export function OptimizerOptionsDialog({ onClose }: OptimizerOptionsDialogProps) {
    const mission = useMissionStore(s => s.mission);
    const config = mission.optimizationConfig;
    const setOptimizationConfig = useMissionStore(s => s.setOptimizationConfig);

    const updateConfig = (updates: Partial<typeof config>) => {
        setOptimizationConfig({ ...config, ...updates });
    };

    return (
        <div className="dialog-overlay fade-in">
            <div className="dialog-content" style={{ maxWidth: '450px' }}>
                <div className="dialog-header">
                    <h2>Optimizer Options</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>
                <div className="dialog-body">
                    <div className="form-group">
                        <label className="form-label">Algorithm</label>
                        <select
                            className="form-select"
                            value={config.algorithm}
                            onChange={e => updateConfig({ algorithm: e.target.value as OptimizationAlgorithm })}
                            id="dlg-opt-algorithm"
                        >
                            <option value="LN_COBYLA">COBYLA (Derivative-free)</option>
                            <option value="LN_BOBYQA">BOBYQA (Derivative-free)</option>
                            <option value="LD_SLSQP">SLSQP (Gradient-based)</option>
                            <option value="LD_MMA">MMA (Gradient-based)</option>
                            <option value="GN_ISRES">ISRES (Global)</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Max Iterations</label>
                            <input className="form-input" type="number" value={config.maxIterations}
                                onChange={e => updateConfig({ maxIterations: parseInt(e.target.value) || 100 })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Stop Value</label>
                            <input className="form-input" type="number" step="0.01" value={config.stopval ?? ''}
                                placeholder="disabled"
                                onChange={e => {
                                    const v = e.target.value;
                                    updateConfig({ stopval: v === '' ? undefined : parseFloat(v) });
                                }} />
                        </div>
                    </div>

                    <div className="section-title mt-3 mb-2">Tolerances</div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">F Tol (rel)</label>
                            <input className="form-input" type="number" step="1e-7" value={config.ftolRel}
                                onChange={e => updateConfig({ ftolRel: parseFloat(e.target.value) || 1e-6 })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">X Tol (rel)</label>
                            <input className="form-input" type="number" step="1e-7" value={config.xtolRel}
                                onChange={e => updateConfig({ xtolRel: parseFloat(e.target.value) || 1e-6 })} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">F Tol (abs)</label>
                            <input className="form-input" type="number" step="1e-7" value={config.ftolAbs ?? ''}
                                onChange={e => {
                                    const v = e.target.value;
                                    updateConfig({ ftolAbs: v === '' ? undefined : parseFloat(v) || undefined });
                                }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">X Tol (abs)</label>
                            <input className="form-input" type="number" step="1e-7" value={config.xtolAbs ?? ''}
                                onChange={e => {
                                    const v = e.target.value;
                                    updateConfig({ xtolAbs: v === '' ? undefined : parseFloat(v) || undefined });
                                }} />
                        </div>
                    </div>

                    {config.algorithm === 'LD_SLSQP' && (
                        <>
                            <div className="section-title mt-3 mb-2">SLSQP Specific</div>
                            <div className="form-group">
                                <label className="form-label">Max Step Size (Limit)</label>
                                <input className="form-input" type="number" step="1e-4" value={config.slsqpMaxStepSize ?? ''}
                                    placeholder="disabled"
                                    onChange={e => {
                                        const v = e.target.value;
                                        updateConfig({ slsqpMaxStepSize: v === '' ? undefined : parseFloat(v) });
                                    }} />
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Limits the finite-difference step size or maximum parameter variation per iteration.
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="dialog-footer">
                    <button className="btn btn-primary" onClick={onClose} id="dlg-opt-close-btn">Done</button>
                </div>
            </div>
        </div>
    );
}
