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
  numberOfCores?: '1C' | '2C' | '3C' | '3C+E' | '4C'; // Conductor cores
  conductorMaterial?: 'Cu' | 'Al'; // Copper or Aluminum
  phase?: '1Ø' | '3Ø'; // Single or Three Phase
  loadType?: 'Motor' | 'Heater' | 'Transformer' | 'Feeder' | 'Pump' | 'Fan' | 'Compressor';
  efficiency?: number; // 0.0-1.0, for motors typically 0.85-0.96
  powerFactor?: number; // 0.7-1.0, for motors typically 0.75-0.92
  startingMethod?: 'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD'; // Motor starting method
  insulation?: 'XLPE' | 'PVC'; // Cable insulation type
  installationMethod?: string; // e.g., 'Air - Ladder tray (touching)'
  cableSpacing?: 'touching' | 'spaced_400mm' | 'spaced_600mm';
  ambientTemp?: number; // °C
  soilThermalResistivity?: number; // K·m/W for buried cables
  depthOfLaying?: number; // cm for buried cables
  groupedLoadedCircuits?: number; // Number of other loaded circuits nearby
  numberOfLoadedCircuits?: number; // Number of loaded circuits (for derating)
  protectionType?: 'ACB' | 'MCCB' | 'MCB' | 'None'; // ISc check only for ACB
  maxShortCircuitCurrent?: number; // kA, for ISc check
  protectionClearingTime?: number; // seconds, for ISc calculation
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
 * Helper: Flexible column lookup with multiple naming variations
 * Tries exact match first, then case-insensitive, then key contains
 */
const getColumnValue = (row: any, ...variations: string[]): any => {
  // Try exact match first (important for standardized field names like 'loadKW')
  for (const v of variations) {
    if (v in row && row[v] !== undefined && row[v] !== null && row[v] !== '') {
      return row[v];
    }
  }
  
  // Try case-insensitive match
  const lowerRow = Object.keys(row).reduce((acc: any, key) => {
    acc[key.toLowerCase().trim()] = row[key];
    return acc;
  }, {});
  
  for (const v of variations) {
    const lower = v.toLowerCase().trim();
    if (lower in lowerRow && lowerRow[lower] !== undefined && lowerRow[lower] !== null && lowerRow[lower] !== '') {
      return lowerRow[lower];
    }
  }
  
  // Try partial match (key contains variation)
  const rowKeys = Object.keys(row);
  for (const v of variations) {
    const partial = rowKeys.find(k => k.toLowerCase().includes(v.toLowerCase()));
    if (partial && row[partial] !== undefined && row[partial] !== null && row[partial] !== '') {
      return row[partial];
    }
  }
  
  return undefined;
};

/**
 * Auto-detect column mappings from Excel headers using flexible matching
 * Returns a mapping of standardized field names to Excel column headers
 */
export const autoDetectColumnMappings = (headers: string[]): Record<string, string> => {
  const mappings: Record<string, string> = {};
  const headerMap = new Map<string, string>(); // normalized -> original
  
  headers.forEach(h => {
    const norm = h.toLowerCase().trim();
    headerMap.set(norm, h);
  });

  const fieldSynonyms: Record<string, string[]> = {
    serialNo: ['serial no', 's.no', 'sno', 'index', 'no', 'serial', 'num', 'number'],
    cableNumber: ['cable number', 'cable no', 'cable #', 'cable', 'feeder', 'feeder id', 'feed no', 'id'],
    feederDescription: ['feeder description', 'description', 'name', 'desc', 'feeder name', 'equipment name'],
    fromBus: ['from bus', 'from', 'source', 'load', 'equipment', 'start', 'origin'],
    toBus: ['to bus', 'to', 'destination', 'panel', 'target', 'end'],
    voltage: ['voltage (v)', 'voltage', 'v (v)', 'v', 'nominal voltage', 'rated voltage', 'supply voltage'],
    loadKW: ['load (kw)', 'load kw', 'kw', 'power', 'p', 'load', 'power (kw)'],
    length: ['length (m)', 'length', 'l (m)', 'l', 'distance', 'cable length', 'route length'],
    powerFactor: ['power factor', 'pf', 'cos φ', 'cos phi', 'power factor (pf)', 'cos'],
    efficiency: ['efficiency (%)', 'efficiency', 'eff', 'eff (%)', 'efficiency %'],
    deratingFactor: ['derating factor', 'derating', 'k', 'factor', 'derating k'],
    ambientTemp: ['ambient temp (°c)', 'ambient temp', 'temp', 'ambient temperature', 'temperature', 'ambient (°c)'],
    installationMethod: ['installation method', 'installation', 'method', 'type', 'cable installation'],
    numberOfLoadedCircuits: ['grouped loaded circuits', 'circuits', 'groups', 'grouped circuits', 'number of circuits'],
    protectionType: ['breaker type', 'protection type', 'breaker', 'protection', 'circuit breaker'],
    maxShortCircuitCurrent: ['short circuit current (ka)', 'isc', 'isc (ka)', 'short circuit', 'sc current', 'trip time (ms)']
  };

  for (const [field, synonyms] of Object.entries(fieldSynonyms)) {
    for (const syn of synonyms) {
      const norm = syn.toLowerCase().trim();
      if (headerMap.has(norm)) {
        mappings[field] = headerMap.get(norm)!;
        break; // Use first match
      }
    }
  }

  return mappings;
};

/**
 * Normalize feeder data from Excel
 * Maps various column naming conventions to standard properties
 */
export const normalizeFeeders = (rawFeeders: any[]): CableSegment[] => {
  return rawFeeders
    .filter((f: any) => {
      // Check if row has at least From Bus data
      const fromBus = getColumnValue(f, 'From Bus', 'From', 'Source', 'Load', 'Equipment', 'from bus', 'from', 'source');
      return fromBus && String(fromBus).trim() !== '';
    })
    .map((feeder: any) => {
      // Helper to safely get numeric values with fallback
      const getNumber = (value: any, fallback = 0): number => {
        if (value === null || value === undefined || value === '') return fallback;
        const trimmed = String(value).trim().replace('%', '').replace(',', '').trim();
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : fallback;
      };

      // Helper to safely get string values
      const getString = (value: any, fallback = ''): string => {
        return String(value || fallback).trim();
      };

      // Parse numberOfCores - can be string like "3C+E" or number like 4
      let numberOfCores: '1C' | '2C' | '3C' | '3C+E' | '4C' | undefined;
      const ncValue = getColumnValue(
        feeder,
        'Number of Cores', 'numberOfCores', 'Core', 'Cores', 'core', 'Cable Type'
      ) || '3C';
      if (typeof ncValue === 'string') {
        numberOfCores = ncValue as any;
      } else if (typeof ncValue === 'number') {
        const coreMap: Record<number, '1C' | '2C' | '3C' | '3C+E' | '4C'> = { 1: '1C', 2: '2C', 3: '3C', 4: '4C' };
        numberOfCores = coreMap[ncValue] || '3C';
      }

      // Get voltage for phase detection
      const voltage = getNumber(
        getColumnValue(feeder, 'Voltage (V)', 'Voltage', 'V (V)', 'V', 'voltage (v)', 'rated voltage', 'nominal voltage'),
        415
      );
      
      // DEBUG: Log voltage extraction
      const cableNum = getString(getColumnValue(feeder, 'cableNumber', 'Cable Number', 'Cable No', 'Cable', 'Feeder', 'cable number', 'cable no', 'feeder id'), '');
      console.log(`[NORMALIZEFEEDERS] Cable ${cableNum}: voltage=${voltage}`);

      return {
        serialNo: getNumber(getColumnValue(feeder, 'serialNo', 'Serial No', 'S.No', 'SNo', 'serial no', 'index', 'no'), 0),
        cableNumber: getString(getColumnValue(feeder, 'cableNumber', 'Cable Number', 'Cable No', 'Cable', 'Feeder', 'cable number', 'cable no', 'feeder id'), ''),
        feederDescription: getString(
          getColumnValue(feeder, 'feederDescription', 'Feeder Description', 'Description', 'Name', 'feeder description', 'desc'),
          ''
        ),
        fromBus: getString(getColumnValue(feeder, 'fromBus', 'From Bus', 'From', 'Source', 'Load', 'Equipment', 'from bus', 'from', 'source'), ''),
        toBus: getString(getColumnValue(feeder, 'toBus', 'To Bus', 'To', 'Destination', 'Panel', 'to bus', 'to', 'destination'), ''),
        voltage,
        loadKW: getNumber(getColumnValue(feeder, 'loadKW', 'Load (kW)', 'Load KW', 'Load', 'Power', 'kW', 'load (kw)', 'power (kw)'), 0),
        length: getNumber(getColumnValue(feeder, 'length', 'Length (m)', 'Length', 'L', 'Distance', 'length (m)', 'cable length'), 0),
        deratingFactor: getNumber(
          getColumnValue(feeder, 'deratingFactor', 'Derating Factor', 'Derating', 'K', 'derating factor', 'derating k'),
          0.87
        ),
        resistance: getNumber(getColumnValue(feeder, 'resistance', 'Resistance', 'R', 'resistance'), 0),
        reactance: getNumber(getColumnValue(feeder, 'reactance', 'Reactance', 'X', 'reactance'), 0),
        numberOfCores,
        conductorMaterial: getString(
          getColumnValue(feeder, 'conductorMaterial', 'Material', 'Conductor', 'material'),
          'Cu'
        ).toUpperCase() === 'AL' ? 'Al' : 'Cu',
        phase: (getString(getColumnValue(feeder, 'phase', 'Phase', 'phase'), '') as '1Ø' | '3Ø') || (voltage >= 400 ? '3Ø' : '1Ø'),
        loadType: (getString(getColumnValue(feeder, 'loadType', 'Load Type', 'Type', 'load type', 'type'), 'Motor')) as any,
        // Handle percent-formatted efficiency and power factor (e.g., 92 for 92%)
        efficiency: (() => {
          const v = getNumber(getColumnValue(feeder, 'efficiency', 'Efficiency', 'Efficiency (%)', 'Eff', 'efficiency', 'eff'), 0.92);
          return v > 1 ? v / 100 : v;
        })(),
        powerFactor: (() => {
          const v = getNumber(getColumnValue(feeder, 'powerFactor', 'Power Factor', 'PF', 'power factor', 'pf'), 0.85);
          return v > 1 ? v / 100 : v;
        })(),
        startingMethod: (getString(getColumnValue(feeder, 'startingMethod', 'Starting Method', 'Starting', 'starting method'), 'DOL')) as any,
        insulation: (getString(getColumnValue(feeder, 'insulation', 'Insulation', 'insulation'), 'XLPE')) as any,
        installationMethod: getString(getColumnValue(feeder, 'installationMethod', 'Installation Method', 'Installation', 'installation method', 'method'), 'Air'),
        cableSpacing: (getString(getColumnValue(feeder, 'cableSpacing', 'Cable Spacing', 'Spacing', 'cable spacing'), 'touching')) as any,
        ambientTemp: getNumber(getColumnValue(feeder, 'ambientTemp', 'Ambient Temp (°C)', 'Ambient Temp', 'Temp', 'ambient temp', 'temperature'), 40),
        soilThermalResistivity: getNumber(getColumnValue(feeder, 'soilThermalResistivity', 'Soil Thermal Resistivity (K·m/W)', 'Soil Resistivity', 'soil resistivity'), 1.2),
        depthOfLaying: getNumber(getColumnValue(feeder, 'depthOfLaying', 'Depth of Laying (cm)', 'Depth', 'depth'), 60),
        numberOfLoadedCircuits: getNumber(getColumnValue(feeder, 'numberOfLoadedCircuits', 'Grouped Loaded Circuits', 'Circuits', 'grouped circuits'), 1),
        // If no SC value provided in sheet, leave undefined so engine skips SC check
        maxShortCircuitCurrent: (() => {
          const raw = getColumnValue(feeder, 'maxShortCircuitCurrent', 'Short Circuit Current (kA)', 'ISc', 'Isc', 'short circuit', 'sc current', 'trip time (ms)');
          if (raw === undefined || raw === null || raw === '') return undefined;
          const n = getNumber(raw);
          return Number.isFinite(n) ? n : undefined;
        })(),
        // NEW: Protection type determines if ISc check is applied (ISc only for ACB)
        protectionType: (getString(getColumnValue(feeder, 'protectionType', 'Breaker Type', 'Protection Type', 'Breaker', 'breaker type', 'protection'), 'None')) as 'ACB' | 'MCCB' | 'MCB' | 'None'
      };
    });
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
  
  // Normalize bus names for robust matching (trim + uppercase)
  const normalizeBus = (b: string) => String(b || '').trim().toUpperCase();

  // FIRST: Try to find explicit transformer buses (containing 'TRF')
  let transformerBuses = new Set(
    cables
      .filter(c => normalizeBus(c.toBus).includes('TRF'))
      .map(c => normalizeBus(c.toBus))
  );

  // SECOND: If no explicit transformer found, find the top-level bus(es)
  // Top-level bus = a toBus that is NOT a fromBus in any other cable
  // This bus is the "root" or transformer of the hierarchy
  if (transformerBuses.size === 0) {
    const toBuses = new Set(cables.map(c => normalizeBus(c.toBus)));
    const fromBuses = new Set(cables.map(c => normalizeBus(c.fromBus)));
    
    // Find buses that are destinations but never sources
    const topLevelBuses = Array.from(toBuses).filter(bus => !fromBuses.has(bus));
    
    if (topLevelBuses.length > 0) {
      console.warn(`No 'TRF' named transformer found. Auto-detected top-level bus(es): ${topLevelBuses.join(', ')}`);
      transformerBuses = new Set(topLevelBuses.map(normalizeBus));
    } else {
      console.error('CRITICAL: No transformer or top-level bus found in cable data');
      console.error('All cables appear to form a cycle with no clear root/source');
      console.error('Please ensure your data has a hierarchy: loads → panels → transformer');
      return [];
    }
  }

  // Build maps keyed by normalized bus names for reliable lookups
  const cablesByFromBus = new Map<string, CableSegment[]>();
  for (const c of cables) {
    const key = normalizeBus(c.fromBus);
    if (!cablesByFromBus.has(key)) cablesByFromBus.set(key, []);
    cablesByFromBus.get(key)!.push(c);
  }

  // Find all unique "FromBus" (equipment/loads) using normalized names
  const equipmentBuses = Array.from(cablesByFromBus.keys()).filter(k => !transformerBuses.has(k));

  // For each equipment, trace path back to transformer
  let pathCounter = 1;
  for (const equipmentNorm of equipmentBuses) {
    // Map normalized equipment name back to original (use first matching cable)
    const sampleCable = cables.find(c => normalizeBus(c.fromBus) === equipmentNorm)!;
    const equipment = sampleCable ? sampleCable.fromBus : equipmentNorm;
    const path = tracePathToTransformer(equipment, cables, transformerBuses, normalizeBus);
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
  transformerBuses: Set<string>,
  normalizeBus: (b: string) => string
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

    // Find all cables where fromBus = currentBus (case-insensitive)
    const outgoing = cables.filter(c => normalizeBus(c.fromBus) === normalizeBus(currentBus));
    if (outgoing.length === 0) continue;

    for (const connectingCable of outgoing) {
      const newPath = [...current.path, connectingCable];

      // Check if we reached transformer
      if (transformerBuses.has(normalizeBus(connectingCable.toBus))) {
      const totalDistance = newPath.reduce((sum, c) => sum + c.length, 0);
        const totalVoltage = newPath[0]?.voltage || 415;
        const cumulativeLoad = newPath.reduce((sum, c) => sum + (c.loadKW || 0), 0);

        // Calculate voltage drop as sum of segment drops using resistance from segments where available
        const totalVdrop = newPath.reduce((sum, seg) => {
          const r = seg.resistance || 0.1;
          return sum + calculateSegmentVoltageDrop(seg, r);
        }, 0);
        const voltageDropPercent = (totalVdrop / totalVoltage) * 100;

        // Get equipment description from the first cable in the path (start)
        const equipmentDescription = newPath[0]?.feederDescription || '';

        finalPath = {
          pathId: '',
          startEquipment,
          startEquipmentDescription: equipmentDescription,
          startPanel: newPath[0]?.fromBus || startEquipment,
          endTransformer: connectingCable.toBus,
          cables: newPath,
          totalDistance,
          totalVoltage,
          cumulativeLoad,
          voltageDrop: totalVdrop,
          voltageDropPercent,
          isValid: true, // All discovered paths are valid - V-drop is a design choice, not a failure
          validationMessage:
            voltageDropPercent <= 5
              ? `✓ V-drop: ${voltageDropPercent.toFixed(2)}% (IEC 60364 Compliant)`
              : `⚠ V-drop: ${voltageDropPercent.toFixed(2)}% (Exceeds 5% - Upgrade cable size for compliance)`
        };
        // return the first valid path found for this equipment
        return finalPath;
    }
      // Continue searching from this outgoing cable's toBus
      queue.push({ bus: connectingCable.toBus, path: newPath });
    }
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
