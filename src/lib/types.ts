// ============================================================
// Core Domain Types for Spacecraft Mission Design Tool
// ============================================================

export type CoordinateType = 'cartesian' | 'keplerian';

export type ReferenceFrame = 'earthInertial' | 'moonInertial' | 'sunInertial';

export type ControlFrame = 'inertial' | 'vnc' | 'vuw';

export type TerminationConditionType = 'duration';

export type ObjectiveType = 'minimizeMass' | 'maximizeMass' | 'minimizeDeltaV';

export type ConstraintType = 'equality' | 'inequalityLTE' | 'inequalityGTE';

export type ConstraintMode = 'absolute' | 'relative';

export type OptimizationAlgorithm = 'LD_SLSQP' | 'LD_MMA' | 'LN_COBYLA' | 'LN_BOBYQA' | 'GN_ISRES';

// ---- Gravitational Parameters (km³/s²) ----
export const MU_EARTH = 398600.4418;
export const MU_MOON = 4902.800066;
export const MU_SUN = 132712440041.93938;

// ---- Celestial Body Radii (km) ----
export const R_EARTH = 6371.0;
export const R_MOON = 1737.4;
export const R_SUN = 695700.0;

// ---- Distance Constants (km) ----
export const EARTH_MOON_DISTANCE = 384400.0;
export const EARTH_SUN_DISTANCE = 149597870.7;

// ============================================================
// Hardware Models
// ============================================================

export interface Tank {
  id: string;
  name: string;
  propellantMass: number; // kg
}

export interface Engine {
  id: string;
  name: string;
  thrust: number;  // N
  isp: number;     // s
  tankIds: string[]; // IDs of tanks this engine draws from
}

// ============================================================
// State Definitions
// ============================================================

export interface CartesianState {
  x: number; y: number; z: number;       // km
  vx: number; vy: number; vz: number;    // km/s
}

export interface KeplerianElements {
  a: number;    // semi-major axis (km)
  e: number;    // eccentricity
  i: number;    // inclination (deg)
  raan: number; // right ascension of ascending node Ω (deg)
  aop: number;  // argument of periapsis ω (deg)
  ta: number;   // true anomaly ν (deg)
}

export interface InitialState {
  epoch: number; // Unix timestamp in seconds
  coordinateType: CoordinateType;
  cartesian: CartesianState;
  keplerian: KeplerianElements;
  referenceFrame: ReferenceFrame;
}

// ============================================================
// Force Model & Thrust Configuration
// ============================================================

export interface ForceModelConfig {
  earthGravity: boolean;
  moonGravity: boolean;
  sunGravity: boolean;
}

export interface ThrustConfig {
  enabled: boolean;
  engineId: string;
  controlFrame: ControlFrame;
  referenceFrame: ReferenceFrame;
  azimuth: number;   // deg - in-plane angle
  elevation: number; // deg - out-of-plane angle
}

export interface TerminationCondition {
  type: TerminationConditionType;
  duration: number; // seconds
}

// ============================================================
// Graphics Configuration
// ============================================================

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface SegmentGraphics {
  color: string;
  lineStyle: LineStyle;
  lineWidth: number;
  plotThrustVector: boolean;
}

export interface GraphicsConfig {
  plotFrame: ReferenceFrame;
  celestialBodies: {
    earth: boolean;
    moon: boolean;
    sun: boolean;
  };
  showOrbits: boolean;
}

// ============================================================
// Segment
// ============================================================

export interface Segment {
  id: string;
  name: string;
  termination: TerminationCondition;
  forceModel: ForceModelConfig;
  thrust: ThrustConfig;
  graphics: SegmentGraphics;
}

// ============================================================
// Spacecraft
// ============================================================

export interface Spacecraft {
  id: string;
  name: string;
  initialState: InitialState;
  dryMass: number;    // kg
  tanks: Tank[];
  engines: Engine[];
  segments: Segment[];
}

// ============================================================
// Optimization Definitions
// ============================================================

export interface OptVariable {
  id: string;
  path: string;         // JSON path into mission, e.g. "spacecraft[0].segments[1].duration"
  label: string;
  lowerBound: number;
  upperBound: number;
}

export interface OptObjective {
  id: string;
  type: ObjectiveType;
  spacecraftId: string;
  segmentId: string; // evaluate at end of this segment
  weight: number;    // for summing into cost
  scaleFactor?: number; // scale factor (Fs = F / scale_factor)
}

export interface OptConstraint {
  id: string;
  constraintType: ConstraintType;
  mode: ConstraintMode;
  // What to constrain
  spacecraftId: string;
  segmentId: string;
  quantity: string; // e.g. 'x', 'y', 'z', 'vx', 'vy', 'vz', 'mass', 'a', 'e', 'i', 'raan', 'aop', 'ta', 'rPeri', 'rApo', 'altPeri', 'altApo'
  referenceFrame: ReferenceFrame;
  // For absolute constraints
  targetValue?: number;
  // For relative constraints
  relativeSpacecraftId?: string;
  relativeSegmentId?: string;
  tolerance: number;
  scaleFactor?: number; // scale factor (Fs = F / scale_factor)
}

export interface OptimizationConfig {
  algorithm: OptimizationAlgorithm;
  maxIterations: number;
  ftolRel: number;
  ftolAbs?: number;
  xtolRel: number;
  xtolAbs?: number;
  stopval?: number;
  variables: OptVariable[];
  objectives: OptObjective[];
  constraints: OptConstraint[];
}

// ============================================================
// Data Output Configuration
// ============================================================

export interface DataSeriesConfig {
  id: string;
  spacecraftId: string; // 'all' or specific ID
  segmentId: string;    // 'all' or specific ID
  quantity: string;     // Constraint-evaluatable string like 'rPeri', 'mass', 'x'
  referenceFrame: ReferenceFrame;
}

export interface PlotConfig {
  id: string;
  title: string;
  seriesIds: string[]; // references DataSeriesIds
}

export interface DataConfig {
  series: DataSeriesConfig[];
  plots: PlotConfig[];
}

// ============================================================
// Mission (Top-Level Container)
// ============================================================

export interface Mission {
  id: string;
  name: string;
  spacecraft: Spacecraft[];
  optimizationConfig: OptimizationConfig;
  graphicsConfig: GraphicsConfig;
  dataConfig: DataConfig;
}

// ============================================================
// Propagation Results
// ============================================================

export interface TrajectoryPoint {
  t: number;      // time (s)
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  mass: number;
}

export interface SegmentResult {
  segmentId: string;
  points: TrajectoryPoint[];
  deltaV: number;  // total ΔV for this segment (km/s)
}

export interface TrajectoryResult {
  spacecraftId: string;
  segments: SegmentResult[];
}

// ============================================================
// Optimization Progress
// ============================================================

export interface OptimizationIteration {
  iteration: number;
  objectiveValue: number;
  constraintViolations: number[];
  maxConstraintViolation: number;
  variables: number[];
}

export type OptimizationStatus = 'idle' | 'running' | 'converged' | 'failed' | 'stopped';

export interface OptimizationResult {
  status: OptimizationStatus;
  iterations: OptimizationIteration[];
  bestObjective: number;
  bestVariables: number[];
  message: string;
}
