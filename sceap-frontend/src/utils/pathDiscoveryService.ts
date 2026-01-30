/**
 * Path Discovery Service - Core utility for extracting and validating cable paths
 * Used by both Sizing and Optimization pages
 */

export interface CablePath {
  pathId: string;
  startEquipment: string;
  startEquipmentDescription: string;
  startPanel: string;
  endTransformer: string;
  cables: CableSegment[];
  totalDistance: number;
  totalVoltage: number;
  cumulativeLoad: number;
  voltageDrop: number;
  voltageDropPercent: number;
  isValid: boolean;
  validationMessage: string;
}

export interface CableSegment {
  serialNo: number;
  cableNumber: string;
  feederDescription: string;
  fromBus: string;
  toBus: string;
  voltage: number;
  loadKW: number;
  length: number;
  deratingFactor: number;
  resistance?: number;
  reactance?: number;
  // NEW FIELDS FOR PROFESSIONAL CABLE SIZING
  numberOfCores?: number; // 1C, 2C, 3C, 4C, 5C
  conductorMaterial?: 'Cu' | 'Al'; // Copper or Aluminum
  systemPhase?: '1Ø' | '3Ø'; // Single or Three Phase
}

export interface PathAnalysisResult {
  totalPaths: number;
  validPaths: number;
  invalidPaths: number;
  paths: CablePath[];
  averageVoltageDrop: number;
  criticalPaths: CablePath[]; // Paths exceeding 5% V-drop limit
}

/**
 * Normalize feeder data from Excel
 * Maps various column naming conventions to standard properties
 */
export const normalizeFeeders = (rawFeeders: any[]): CableSegment[] => {
  return rawFeeders
    .filter((f: any) => f['From Bus'] || f['fromBus'] || f['From bus'])
    .map((feeder: any) => ({
      serialNo: feeder['Serial No'] || feeder['serialNo'] || 0,
      cableNumber: feeder['Cable Number'] || feeder['cableNumber'] || '',
      feederDescription: feeder['Feeder Description'] || feeder['feederDescription'] || feeder['Description'] || '',
      fromBus: feeder['From Bus'] || feeder['fromBus'] || '',
      toBus: feeder['To Bus'] || feeder['toBus'] || '',
      voltage: Number(feeder['Voltage (V)'] || feeder['voltage'] || 415),
      loadKW: Number(feeder['Load KW'] || feeder['loadKW'] || 0),
      length: Number(feeder['Length (m)'] || feeder['length'] || 0),
      deratingFactor: Number(feeder['Derating Factor'] || feeder['deratingFactor'] || 0.87),
      resistance: Number(feeder['Resistance'] || feeder['resistance'] || 0),
      reactance: Number(feeder['Reactance'] || feeder['reactance'] || 0),
      // NEW: Read number of cores from Excel if available, default to 4C for 3-phase
      numberOfCores: Number(feeder['Number of Cores'] || feeder['numberOfCores'] || feeder['Core'] || 4),
      // NEW: Read conductor material, default to Copper
      conductorMaterial: (feeder['Material'] || feeder['conductorMaterial'] || 'Cu').toUpperCase() === 'AL' ? 'Al' : 'Cu',
      // NEW: Determine system phase (default 3Ø for 415V systems)
      systemPhase: feeder['Phase'] || feeder['systemPhase'] || (Number(feeder['Voltage (V)'] || 415) >= 400 ? '3Ø' : '1Ø')
    }));
};

/**
 * Calculate voltage drop for a cable segment
 * V-drop = (I × R × L) / 1000 for single phase
 * For three-phase: V-drop = (√3 × I × R × L) / 1000
 */
export const calculateSegmentVoltageDrop = (
  segment: CableSegment,
  cableResistance: number
): number => {
  if (!segment.loadKW || !segment.length || !cableResistance) return 0;

  // Calculate current: I = (P × 1000) / (√3 × V × PF × Efficiency)
  // Assuming PF = 0.85, Efficiency = 0.95
  const pf = 0.85;
  const efficiency = 0.95;
  const sqrt3 = 1.732;

  const current = (segment.loadKW * 1000) / (sqrt3 * segment.voltage * pf * efficiency);

  // Apply derating factor
  const derated_current = current / segment.deratingFactor;

  // V-drop = (√3 × I × R × L) / 1000
  const vdrop = (sqrt3 * derated_current * cableResistance * segment.length) / 1000;

  return vdrop;
};

/**
 * Discover all paths from equipment/loads back to transformer
 * Uses breadth-first search to find the shortest path
 * ENHANCED: Automatically detects transformer if not explicitly named with 'TRF'
 */
export const discoverPathsToTransformer = (cables: CableSegment[]): CablePath[] => {
  const paths: CablePath[] = [];
  
  // FIRST: Try to find explicit transformer buses (containing 'TRF')
  let transformerBuses = new Set(
    cables
      .filter(c => c.toBus.toUpperCase().includes('TRF'))
      .map(c => c.toBus)
  );

  // SECOND: If no explicit transformer found, find the top-level bus(es)
  // Top-level bus = a toBus that is NOT a fromBus in any other cable
  // This bus is the "root" or transformer of the hierarchy
  if (transformerBuses.size === 0) {
    const toBuses = new Set(cables.map(c => c.toBus));
    const fromBuses = new Set(cables.map(c => c.fromBus));
    
    // Find buses that are destinations but never sources
    const topLevelBuses = Array.from(toBuses).filter(bus => !fromBuses.has(bus));
    
    if (topLevelBuses.length > 0) {
      console.warn(`No 'TRF' named transformer found. Auto-detected top-level bus(es): ${topLevelBuses.join(', ')}`);
      transformerBuses = new Set(topLevelBuses);
    } else {
      console.error('CRITICAL: No transformer or top-level bus found in cable data');
      console.error('All cables appear to form a cycle with no clear root/source');
      console.error('Please ensure your data has a hierarchy: loads → panels → transformer');
      return [];
    }
  }

  // Find all unique "FromBus" (equipment/loads)
  const equipmentBuses = new Set(
    cables
      .filter(c => !transformerBuses.has(c.fromBus))
      .map(c => c.fromBus)
  );

  // For each equipment, trace path back to transformer
  let pathCounter = 1;
  for (const equipment of equipmentBuses) {
    const path = tracePathToTransformer(equipment, cables, transformerBuses);
    if (path.cables.length > 0) {
      path.pathId = `PATH-${String(pathCounter).padStart(3, '0')}`;
      pathCounter++;
      paths.push(path);
    }
  }

  return paths;
};

/**
 * Trace a single path from equipment back to transformer using BFS
 */
const tracePathToTransformer = (
  startEquipment: string,
  cables: CableSegment[],
  transformerBuses: Set<string>
): CablePath => {
  const visited = new Set<string>();
  const queue: { bus: string; path: CableSegment[] }[] = [
    { bus: startEquipment, path: [] }
  ];

  let finalPath: CablePath = {
    pathId: '',
    startEquipment,
    startEquipmentDescription: '',
    startPanel: startEquipment,
    endTransformer: '',
    cables: [],
    totalDistance: 0,
    totalVoltage: 0,
    cumulativeLoad: 0,
    voltageDrop: 0,
    voltageDropPercent: 0,
    isValid: false,
    validationMessage: 'Path not found'
  };

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentBus = current.bus;

    if (visited.has(currentBus)) continue;
    visited.add(currentBus);

    // Find cable where fromBus = currentBus
    const connectingCable = cables.find(c => c.fromBus === currentBus);

    if (!connectingCable) {
      continue;
    }

    const newPath = [...current.path, connectingCable];

    // Check if we reached transformer
    if (transformerBuses.has(connectingCable.toBus)) {
      const totalDistance = newPath.reduce((sum, c) => sum + c.length, 0);
      const totalVoltage = newPath[0]?.voltage || 415;
      const cumulativeLoad = newPath[0]?.loadKW || 0;

      // Calculate voltage drop (simplified - using first cable's resistance)
      // In real scenario, you'd sum up individual segment drops
      const voltageDrop = calculateSegmentVoltageDrop(newPath[0], 0.1);
      const voltageDropPercent = (voltageDrop / totalVoltage) * 100;

      // Get equipment description from the last cable in the path (connects to transformer)
      const lastCable = newPath[newPath.length - 1];
      const equipmentDescription = lastCable?.feederDescription || '';

      finalPath = {
        pathId: '',
        startEquipment,
        startEquipmentDescription: equipmentDescription,
        startPanel: newPath[newPath.length - 1]?.fromBus || startEquipment,
        endTransformer: connectingCable.toBus,
        cables: newPath,
        totalDistance,
        totalVoltage,
        cumulativeLoad,
        voltageDrop,
        voltageDropPercent,
        isValid: voltageDropPercent <= 5, // IEC 60364 limit
        validationMessage:
          voltageDropPercent <= 5
            ? `V-drop: ${voltageDropPercent.toFixed(2)}% (Valid)`
            : `V-drop: ${voltageDropPercent.toFixed(2)}% (Exceeds 5% limit - cable size too small)`
      };
      break;
    }

    // Continue searching
    queue.push({ bus: connectingCable.toBus, path: newPath });
  }

  return finalPath;
};

/**
 * Analyze all paths and generate summary report
 */
export const analyzeAllPaths = (cables: CableSegment[]): PathAnalysisResult => {
  if (!cables || cables.length === 0) {
    console.error('ERROR: No cable data provided to analyzeAllPaths');
    return {
      totalPaths: 0,
      validPaths: 0,
      invalidPaths: 0,
      paths: [],
      averageVoltageDrop: 0,
      criticalPaths: []
    };
  }

  const paths = discoverPathsToTransformer(cables);

  // VALIDATION: Warn if no paths discovered despite having cable data
  if (paths.length === 0 && cables.length > 0) {
    console.error('⚠️ CRITICAL DATA INTEGRITY WARNING ⚠️');
    console.error(`System loaded ${cables.length} cables but discovered 0 paths`);
    console.error('REASONS:');
    console.error('1. No cables found connecting to a top-level bus (transformer)');
    console.error('2. All cables form a cycle with no root/source');
    console.error('3. Data structure does not match expected electrical hierarchy');
    console.error('\nEXPECTED FORMAT:');
    console.error('  - Each row = one cable connecting FROM a load TO a panel/source');
    console.error('  - Loads → Panels → Transformer (hierarchical structure)');
    console.error('  - At least one cable must have a toBus that is NEVER a fromBus');
    console.error('  - Example: from_bus="MOTOR-1", to_bus="MCC-PANEL" (MCC is parent)');
  }

  const validPaths = paths.filter(p => p.isValid);
  const invalidPaths = paths.filter(p => !p.isValid);
  const criticalPaths = paths.filter(p => p.voltageDropPercent > 3); // Warning threshold

  const averageVoltageDrop =
    paths.length > 0
      ? paths.reduce((sum, p) => sum + p.voltageDropPercent, 0) / paths.length
      : 0;

  return {
    totalPaths: paths.length,
    validPaths: validPaths.length,
    invalidPaths: invalidPaths.length,
    paths,
    averageVoltageDrop,
    criticalPaths
  };
};
