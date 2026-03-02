'use client';

import React, { useState, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { DataSeriesConfig, PlotConfig, ReferenceFrame } from '../../lib/types';
import { computeStateQuantity } from '../../lib/orbitalMechanics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateId } from '../../lib/utils';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042'];

const PlotViewer = ({
    plot,
    data,
    labels
}: {
    plot: PlotConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    labels: string[]
}) => {
    return (
        <div style={{ height: '200px', width: '100%', backgroundColor: 'var(--bg-canvas)', borderRadius: '4px', padding: '8px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="t" type="number" domain={['auto', 'auto']} tickFormatter={val => val.toFixed(0)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={val => `t=${val}`} contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    {labels.map((label, idx) => (
                        <Line key={label} type="monotone" dataKey={label} stroke={COLORS[idx % COLORS.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export function DataOutputPanel() {
    const mission = useMissionStore(s => s.mission);
    const results = useMissionStore(s => s.trajectoryResults);
    const addDataSeries = useMissionStore(s => s.addDataSeries);
    const removeDataSeries = useMissionStore(s => s.removeDataSeries);
    const updateDataSeries = useMissionStore(s => s.updateDataSeries);
    const addDataPlot = useMissionStore(s => s.addDataPlot);
    const removeDataPlot = useMissionStore(s => s.removeDataPlot);
    const updateDataPlot = useMissionStore(s => s.updateDataPlot);

    const dataConfig = mission.dataConfig || { series: [], plots: [] };

    const [newSeriesSc, setNewSeriesSc] = useState<string>('all');
    const [newSeriesSeg, setNewSeriesSeg] = useState<string>('all');
    const [newSeriesQty, setNewSeriesQty] = useState<string>('mass');
    const [newSeriesFrame, setNewSeriesFrame] = useState<ReferenceFrame>('earthInertial');

    const handleAddSeries = () => {
        addDataSeries({
            spacecraftId: newSeriesSc,
            segmentId: newSeriesSeg,
            quantity: newSeriesQty,
            referenceFrame: newSeriesFrame,
        });
    };

    const handleAddPlot = () => {
        addDataPlot({
            title: `Plot ${dataConfig.plots.length + 1}`,
            seriesIds: [],
        });
    };

    // CSV Generator
    const handleDownloadCsv = () => {
        if (dataConfig.series.length === 0) {
            alert("No data series defined.");
            return;
        }

        const lines: string[] = [];
        // Header
        const header = ['Time', 'Spacecraft', 'Segment', ...dataConfig.series.map(s => `${s.quantity} (${s.referenceFrame})`)];
        lines.push(header.join(','));

        mission.spacecraft.forEach(sc => {
            const scResult = results.get(sc.id);
            if (!scResult) return;

            scResult.segments.forEach(segResult => {
                const seg = sc.segments.find(s => s.id === segResult.segmentId);
                const segName = seg ? seg.name : segResult.segmentId;

                segResult.points.forEach(pt => {
                    const row = [`${pt.t}`, sc.name, segName];

                    dataConfig.series.forEach(series => {
                        let val = '';
                        if ((series.spacecraftId === 'all' || series.spacecraftId === sc.id) &&
                            (series.segmentId === 'all' || series.segmentId === segResult.segmentId)) {
                            const num = computeStateQuantity(pt, series.quantity, series.referenceFrame);
                            val = isNaN(num) ? '' : num.toString();
                        }
                        row.push(val);
                    });

                    lines.push(row.join(','));
                });
            });
        });

        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'mission_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Plot Data Extraction
    const getPlotData = (plot: PlotConfig) => {
        // Collect timestamps from all series
        const dataMap = new Map<number, Record<string, number>>();

        plot.seriesIds.forEach(seriesId => {
            const series = dataConfig.series.find(s => s.id === seriesId);
            if (!series) return;

            mission.spacecraft.forEach(sc => {
                if (series.spacecraftId !== 'all' && series.spacecraftId !== sc.id) return;
                const scResult = results.get(sc.id);
                if (!scResult) return;

                scResult.segments.forEach(segResult => {
                    if (series.segmentId !== 'all' && series.segmentId !== segResult.segmentId) return;

                    segResult.points.forEach(pt => {
                        const val = computeStateQuantity(pt, series.quantity, series.referenceFrame);
                        if (isNaN(val)) return;

                        if (!dataMap.has(pt.t)) {
                            dataMap.set(pt.t, { t: pt.t });
                        }
                        const entry = dataMap.get(pt.t);
                        if (entry) {
                            const label = `${sc.name} ${series.quantity}`;
                            entry[label] = val;
                        }
                    });
                });
            });
        });

        return Array.from(dataMap.values()).sort((a, b) => a.t - b.t);
    };

    const getSeriesLabels = (plot: PlotConfig) => {
        const labels: string[] = [];
        plot.seriesIds.forEach(seriesId => {
            const series = dataConfig.series.find(s => s.id === seriesId);
            if (!series) return;

            mission.spacecraft.forEach(sc => {
                if (series.spacecraftId !== 'all' && series.spacecraftId !== sc.id) return;
                labels.push(`${sc.name} ${series.quantity}`);
            });
        });
        // Deduplicate
        return Array.from(new Set(labels));
    };

    return (
        <div className="fade-in">
            <div className="section">
                <div className="section-header">
                    <span className="section-title">Data Series</span>
                </div>
                <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                        <select className="form-select" value={newSeriesSc} onChange={e => setNewSeriesSc(e.target.value)}>
                            <option value="all">All Spacecraft</option>
                            {mission.spacecraft.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <select className="form-select" value={newSeriesSeg} onChange={e => setNewSeriesSeg(e.target.value)}>
                            <option value="all">All Segments</option>
                            <option value="current">Specific Segment...</option>
                            {/* Simplification: Just allow all or let them map by name */}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                        <select className="form-select" value={newSeriesQty} onChange={e => setNewSeriesQty(e.target.value)}>
                            <option value="mass">Mass</option>
                            <option value="x">X</option>
                            <option value="y">Y</option>
                            <option value="z">Z</option>
                            <option value="vx">Vx</option>
                            <option value="vy">Vy</option>
                            <option value="vz">Vz</option>
                            <option value="a">Semi-major Axis (a)</option>
                            <option value="e">Eccentricity (e)</option>
                            <option value="i">Inclination (i)</option>
                            <option value="raan">RAAN (Ω)</option>
                            <option value="aop">Arg of Periapsis (ω)</option>
                            <option value="ta">True Anomaly (ν)</option>
                            <option value="rPeri">Radius Periapsis</option>
                            <option value="rApo">Radius Apoapsis</option>
                            <option value="altPeri">Altitude Periapsis</option>
                            <option value="altApo">Altitude Apoapsis</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <select className="form-select" value={newSeriesFrame} onChange={e => setNewSeriesFrame(e.target.value as ReferenceFrame)}>
                            <option value="earthInertial">Earth Inertial</option>
                            <option value="moonInertial">Moon Inertial</option>
                            <option value="sunInertial">Sun Inertial</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddSeries} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>Add Series</button>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dataConfig.series.map(series => (
                        <div key={series.id} className="card" style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px' }}>
                                SC: {series.spacecraftId === 'all' ? 'All' : mission.spacecraft.find(sc => sc.id === series.spacecraftId)?.name} | {series.quantity} ({series.referenceFrame})
                            </span>
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => removeDataSeries(series.id)}>✕</button>
                        </div>
                    ))}
                </div>
                <button className="btn" onClick={handleDownloadCsv} style={{ marginTop: '12px', width: '100%' }} disabled={dataConfig.series.length === 0}>
                    Download CSV
                </button>
            </div>

            <div className="section">
                <div className="section-header">
                    <span className="section-title">Plots</span>
                    <button className="btn btn-sm" onClick={handleAddPlot}>+ Add Plot</button>
                </div>
                {dataConfig.plots.map(plot => (
                    <div key={plot.id} className="card" style={{ padding: '8px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <input
                                className="form-input"
                                value={plot.title}
                                onChange={e => updateDataPlot(plot.id, { title: e.target.value })}
                                style={{ flex: 1, marginRight: '8px' }}
                            />
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => removeDataPlot(plot.id)}>✕</button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {dataConfig.series.map(series => (
                                <label key={series.id} className="form-checkbox" style={{ fontSize: '12px' }}>
                                    <input
                                        type="checkbox"
                                        checked={plot.seriesIds.includes(series.id)}
                                        onChange={e => {
                                            const newIds = e.target.checked
                                                ? [...plot.seriesIds, series.id]
                                                : plot.seriesIds.filter(id => id !== series.id);
                                            updateDataPlot(plot.id, { seriesIds: newIds });
                                        }}
                                    />
                                    {series.quantity}
                                </label>
                            ))}
                        </div>

                        {plot.seriesIds.length > 0 && (
                            <PlotViewer
                                plot={plot}
                                data={getPlotData(plot)}
                                labels={getSeriesLabels(plot)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
