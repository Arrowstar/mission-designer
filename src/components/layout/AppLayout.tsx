'use client';

import React, { useState, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { MissionPanel } from '../panels/MissionPanel';
import { SpacecraftEditor } from '../panels/SpacecraftEditor';
import { SegmentEditor } from '../panels/SegmentEditor';
import { OptimizationPanel } from '../panels/OptimizationPanel';
import { OptimizationDashboard } from '../dashboard/OptimizationDashboard';
import { DataOutputPanel } from '../panels/DataOutputPanel';
import dynamic from 'next/dynamic';

// Dynamically import the 3D viewer (no SSR for Three.js)
const SceneViewer = dynamic(() => import('../viewer/SceneViewer').then(m => ({ default: m.SceneViewer })), {
    ssr: false,
    loading: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Loading 3D Viewer...
        </div>
    ),
});

type LeftTab = 'mission' | 'spacecraft' | 'segments';
type RightTab = 'optimization' | 'dashboard' | 'data';

export function AppLayout() {
    const [leftTab, setLeftTab] = useState<LeftTab>('mission');
    const activeRightTab = useMissionStore(s => s.activeRightTab);
    const setActiveRightTab = useMissionStore(s => s.setActiveRightTab);

    const mission = useMissionStore(s => s.mission);
    const setMission = useMissionStore(s => s.setMission);
    const setMissionName = useMissionStore(s => s.setMissionName);
    const propagateAll = useMissionStore(s => s.propagateAll);
    const isPropagating = useMissionStore(s => s.isPropagating);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSaveMission = () => {
        const dataStr = JSON.stringify(mission, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = mission.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${safeName || 'mission'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleLoadMission = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const loadedMission = JSON.parse(content);
                // Basic validation (optional, can be improved)
                if (loadedMission && typeof loadedMission === 'object' && 'spacecraft' in loadedMission) {
                    setMission(loadedMission);
                } else {
                    alert('Invalid mission file format.');
                }
            } catch (err) {
                console.error('Error parsing mission file:', err);
                alert('Error parsing mission file. Ensure it is a valid JSON.');
            }
            // Reset file input so same file can be loaded again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="app-layout">
            <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleLoadMission}
                id="mission-file-input"
            />
            {/* ===== TOOLBAR ===== */}
            <div className="toolbar">
                <div className="toolbar-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
                    </svg>
                    Mission Designer
                </div>
                <div className="toolbar-divider" />
                <input
                    className="toolbar-mission-name"
                    value={mission.name}
                    onChange={e => setMissionName(e.target.value)}
                    id="mission-name-input"
                />
                <div className="toolbar-actions">
                    <button
                        className="btn"
                        onClick={handleSaveMission}
                        id="save-mission-btn"
                        style={{ marginRight: '8px' }}
                        title="Save Mission to File"
                    >
                        Save
                    </button>
                    <button
                        className="btn"
                        onClick={() => fileInputRef.current?.click()}
                        id="load-mission-btn"
                        style={{ marginRight: '16px' }}
                        title="Load Mission from File"
                    >
                        Load
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={propagateAll}
                        disabled={isPropagating}
                        id="propagate-btn"
                    >
                        {isPropagating ? (
                            <span className="pulse">⟳ Propagating...</span>
                        ) : (
                            <>▶ Propagate</>
                        )}
                    </button>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="main-content">
                {/* Left sidebar */}
                <div className="sidebar">
                    <div className="sidebar-tabs">
                        <button
                            className={`sidebar-tab ${leftTab === 'mission' ? 'active' : ''}`}
                            onClick={() => setLeftTab('mission')}
                            id="tab-mission"
                        >
                            Mission
                        </button>
                        <button
                            className={`sidebar-tab ${leftTab === 'spacecraft' ? 'active' : ''}`}
                            onClick={() => setLeftTab('spacecraft')}
                            id="tab-spacecraft"
                        >
                            Spacecraft
                        </button>
                        <button
                            className={`sidebar-tab ${leftTab === 'segments' ? 'active' : ''}`}
                            onClick={() => setLeftTab('segments')}
                            id="tab-segments"
                        >
                            Segments
                        </button>
                    </div>
                    <div className="sidebar-content">
                        {leftTab === 'mission' && <MissionPanel />}
                        {leftTab === 'spacecraft' && <SpacecraftEditor />}
                        {leftTab === 'segments' && <SegmentEditor />}
                    </div>
                </div>

                {/* Center: 3D Viewer */}
                <div className="viewer-container">
                    <SceneViewer />
                </div>

                {/* Right sidebar */}
                <div className="sidebar sidebar-right">
                    <div className="sidebar-tabs">
                        <button
                            className={`sidebar-tab ${activeRightTab === 'optimization' ? 'active' : ''}`}
                            onClick={() => setActiveRightTab('optimization')}
                            id="tab-optimization"
                        >
                            Optimization
                        </button>
                        <button
                            className={`sidebar-tab ${activeRightTab === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveRightTab('dashboard')}
                            id="tab-dashboard"
                        >
                            Dashboard
                        </button>
                        <button
                            className={`sidebar-tab ${activeRightTab === 'data' ? 'active' : ''}`}
                            onClick={() => setActiveRightTab('data')}
                            id="tab-data"
                        >
                            Data
                        </button>
                    </div>
                    <div className="sidebar-content">
                        {activeRightTab === 'optimization' && <OptimizationPanel />}
                        {activeRightTab === 'dashboard' && <OptimizationDashboard />}
                        {activeRightTab === 'data' && <DataOutputPanel />}
                    </div>
                </div>
            </div>

            {/* ===== STATUS BAR ===== */}
            <div className="status-bar">
                <div className="status-indicator" />
                <span>Ready</span>
                <span>Spacecraft: {mission.spacecraft.length}</span>
                <span>Frame: Earth Inertial</span>
            </div>
        </div>
    );
}
