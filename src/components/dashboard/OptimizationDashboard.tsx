'use client';

import React, { useRef, useEffect } from 'react';
import { useMissionStore } from '../../store/missionStore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import { scaleVariable } from '../../lib/optimizationScaling';

export function OptimizationDashboard() {
    const iterations = useMissionStore(s => s.optimizationIterations);
    const optimizationStatus = useMissionStore(s => s.optimizationStatus);
    const optimizationResult = useMissionStore(s => s.optimizationResult);
    const isOptimizing = useMissionStore(s => s.isOptimizing);
    const mission = useMissionStore(s => s.mission);
    const optimizationLog = useMissionStore(s => s.optimizationLog);

    const logRef = useRef<HTMLPreElement>(null);

    // Auto-scroll log to bottom when new lines arrive
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [optimizationLog.length]);

    const config = mission.optimizationConfig;

    const statusColor = {
        idle: 'var(--text-muted)',
        running: 'var(--accent-warning)',
        converged: 'var(--accent-success)',
        failed: 'var(--accent-danger)',
        stopped: 'var(--accent-warning)',
    }[optimizationStatus];

    const statusLabel = {
        idle: 'Idle',
        running: 'Running...',
        converged: 'Converged ✓',
        failed: 'Failed ✕',
        stopped: 'Stopped',
    }[optimizationStatus];

    // Chart data
    const chartData = iterations.map(iter => ({
        iteration: iter.iteration,
        objective: iter.objectiveValue,
        maxViolation: iter.maxConstraintViolation ?? 0,
    }));

    // Best values
    const bestObj = iterations.length > 0
        ? Math.min(...iterations.map(i => i.objectiveValue))
        : NaN;

    // Constraint violations from latest iteration
    const latestViolations = iterations.length > 0
        ? iterations[iterations.length - 1].constraintViolations
        : [];

    // Latest variable values (unscaled) from the most recent iteration
    const latestVars = iterations.length > 0
        ? iterations[iterations.length - 1].variables
        : [];

    // Build scaled variable bar chart data
    const variableBarData = config.variables.map((v, i) => {
        const currentValue = latestVars[i] ?? 0;
        const scaled = scaleVariable(currentValue, v.lowerBound, v.upperBound);
        // Build short label from path
        const pathParts = v.path.split('.');
        const shortLabel = pathParts[pathParts.length - 1] || v.path;
        return {
            name: shortLabel,
            scaled: Math.max(0, Math.min(1, scaled)), // clamp to [0,1] for display
            rawScaled: scaled, // unclamped for color logic
        };
    });

    // Color for variable bar: red/orange near bounds, blue/green mid-range
    const getBarColor = (scaled: number): string => {
        if (scaled <= 0.05 || scaled >= 0.95) return '#ff4d6a'; // red - at bound
        if (scaled <= 0.15 || scaled >= 0.85) return '#ff9f43'; // orange - near bound
        return '#5b8cff'; // blue - healthy range
    };

    return (
        <div className="fade-in">
            {/* Status */}
            <div className="dashboard-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="dashboard-label">Status</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: statusColor }}>
                            {statusLabel}
                            {isOptimizing && <span className="pulse" style={{ marginLeft: '4px' }}>●</span>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="dashboard-label">Iterations</div>
                        <div className="dashboard-value accent" style={{ fontSize: '20px' }}>
                            {iterations.length}
                        </div>
                    </div>
                </div>
                {isOptimizing && (
                    <div className="opt-progress-bar">
                        <div className="opt-progress-fill pulse" style={{ width: '100%' }} />
                    </div>
                )}
            </div>

            {/* Best Objective */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div className="dashboard-card" style={{ marginBottom: 0 }}>
                    <div className="dashboard-label">Best Objective</div>
                    <div className="dashboard-value" style={{ fontSize: '16px' }}>
                        {isNaN(bestObj) ? '—' : bestObj.toExponential(4)}
                    </div>
                </div>
                <div className="dashboard-card" style={{ marginBottom: 0 }}>
                    <div className="dashboard-label">Constraints</div>
                    <div className="dashboard-value" style={{ fontSize: '16px' }}>
                        {latestViolations.length > 0
                            ? latestViolations.filter(v => v > 0.01).length === 0
                                ? <span style={{ color: 'var(--accent-success)' }}>Satisfied</span>
                                : <span style={{ color: 'var(--accent-danger)' }}>{latestViolations.filter(v => v > 0.01).length} violated</span>
                            : '—'
                        }
                    </div>
                </div>
            </div>

            {/* Objective Chart */}
            {chartData.length > 1 && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '8px' }}>Objective vs. Iteration</div>
                    <div style={{ width: '100%', height: 180 }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData}>
                                <CartesianGrid stroke="rgba(100,120,180,0.1)" strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="iteration"
                                    tick={{ fill: '#5a6580', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                />
                                <YAxis
                                    tick={{ fill: '#5a6580', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                    tickFormatter={v => typeof v === 'number' ? v.toExponential(1) : v}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,20,35,0.95)',
                                        border: '1px solid rgba(100,120,180,0.2)',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        color: '#e8ecf4',
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="objective"
                                    stroke="#5b8cff"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#5b8cff' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Constraint Violation Chart */}
            {chartData.length > 1 && mission.optimizationConfig.constraints.length > 0 && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '8px' }}>Max Constraint Violation vs. Iteration</div>
                    <div style={{ width: '100%', height: 180 }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData}>
                                <CartesianGrid stroke="rgba(100,120,180,0.1)" strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="iteration"
                                    tick={{ fill: '#5a6580', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                />
                                <YAxis
                                    tick={{ fill: '#5a6580', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                    tickFormatter={v => typeof v === 'number' && v > 0 ? v.toExponential(1) : '0'}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,20,35,0.95)',
                                        border: '1px solid rgba(100,120,180,0.2)',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        color: '#e8ecf4',
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="maxViolation"
                                    stroke="var(--accent-danger)"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: 'var(--accent-danger)' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Scaled Variable Bar Chart */}
            {latestVars.length > 0 && config.variables.length > 0 && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '8px' }}>Variable Bounds</div>
                    <div style={{ width: '100%', height: Math.max(100, variableBarData.length * 32 + 40) }}>
                        <ResponsiveContainer>
                            <BarChart
                                data={variableBarData}
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                            >
                                <CartesianGrid stroke="rgba(100,120,180,0.1)" strokeDasharray="3 3" horizontal={false} />
                                <XAxis
                                    type="number"
                                    domain={[0, 1]}
                                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                                    tick={{ fill: '#5a6580', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                    tickFormatter={(v: number) => {
                                        if (v === 0) return 'Lower';
                                        if (v === 1) return 'Upper';
                                        return (v * 100).toFixed(0) + '%';
                                    }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: '#8a94a8', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(100,120,180,0.2)' }}
                                    width={80}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,20,35,0.95)',
                                        border: '1px solid rgba(100,120,180,0.2)',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        color: '#e8ecf4',
                                    }}
                                    formatter={(value: number | undefined) => [((value ?? 0) * 100).toFixed(1) + '%', 'Position']}
                                />
                                <ReferenceLine x={0.5} stroke="rgba(100,120,180,0.3)" strokeDasharray="3 3" />
                                <Bar dataKey="scaled" radius={[0, 4, 4, 0]} barSize={16}>
                                    {variableBarData.map((entry, index) => (
                                        <Cell key={index} fill={getBarColor(entry.rawScaled)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Constraint Violations Table */}
            {latestViolations.length > 0 && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '8px' }}>Constraint Violations</div>
                    <table className="constraint-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Violation</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {latestViolations.map((v, i) => (
                                <tr key={i}>
                                    <td style={{ color: 'var(--text-muted)' }}>C{i + 1}</td>
                                    <td>{isNaN(v) ? 'NaN' : v.toExponential(3)}</td>
                                    <td>
                                        {v < 0.01
                                            ? <span className="badge badge-success">OK</span>
                                            : <span className="badge badge-error">Violated</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Iteration Log */}
            {optimizationLog.length > 0 && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '8px' }}>Optimizer Output</div>
                    <pre
                        ref={logRef}
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            lineHeight: '1.6',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-input)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            maxHeight: '180px',
                            overflow: 'auto',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }}
                    >
                        {optimizationLog.join('\n')}
                    </pre>
                </div>
            )}

            {/* Result Message */}
            {optimizationResult && (
                <div className="dashboard-card">
                    <div className="dashboard-label" style={{ marginBottom: '4px' }}>Result</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {optimizationResult.message}
                    </div>
                    {optimizationResult.bestVariables.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <div className="dashboard-label" style={{ marginBottom: '4px' }}>Best Variables</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--text-primary)',
                                background: 'var(--bg-input)',
                                padding: '8px',
                                borderRadius: 'var(--radius-sm)',
                                maxHeight: '100px',
                                overflow: 'auto',
                            }}>
                                {optimizationResult.bestVariables.map((v, i) => (
                                    <div key={i}>x[{i}] = {v.toExponential(6)}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {iterations.length === 0 && optimizationStatus === 'idle' && (
                <div className="empty-state" style={{ paddingTop: '24px' }}>
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No Optimization Data</div>
                    <div className="empty-state-text">
                        Set up variables, objectives, and constraints in the Optimization tab, then click Run.
                    </div>
                </div>
            )}
        </div>
    );
}
