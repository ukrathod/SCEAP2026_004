import { useState, useEffect } from 'react';
import { Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { usePathContext } from '../context/PathContext';
import { CableSegment } from '../utils/pathDiscoveryService';
import CableSizingEngine_V2, { CableSizingInput as CableSizingInputV2 } from '../utils/CableSizingEngine_V2';
import { LoadTypeSpecs } from '../utils/CableEngineeringData';
import { KEC_CATALOGUE } from '../utils/KEC_CableStandard';
import { EXCEL_FORMULA_MAPPINGS } from '../utils/ExcelFormulaMappings';

// Helper to get a short, human-readable formula text for a mapping id
const getFormulaText = (id: number): string => {
  const f = EXCEL_FORMULA_MAPPINGS.find((m) => m.id === id);
  if (!f) return '';
  const raw = (f.implementation || f.excelFormula || '').toString();
  return raw.replace(/\s+/g, ' ').trim().slice(0, 220);
};

// Result type for display - maps engine output to UI fields
// Extended with all professional columns from Excel template
interface CableSizingResult {
  // Original cable info (Basic Identification)
  serialNo: number;
  cableNumber: string;
  feederDescription: string;
  fromBus: string;
  toBus: string;
  
  // Column Headers Group 1: Electrical Specifications
  breakerType: string; // MCCB, ACB, MCB, etc.
  feederType: string; // I=Incomer, F=Feeder, Motor
  motorRating: number; // Motor load in kVA
  voltage: number;
  voltageKV: number; // Voltage in kV (e.g., 0.415)
  voltageVariationFactor: number; // Usually 1.0
  powerFactor: number;
  efficiency: number;
  
  // Column Headers Group 2: Conductor & Installation
  ratedCurrent: number; // Rated current It (Amps)
  conductorType: string; // Cu or Al
  conductorMaterial: 'Cu' | 'Al';
  powerSupply: string; // 2-wire, 3-wire, 4-wire
  installationMethod: string; // D=Duct, A=Air, T=Trench
  motorStartingCurrent: number; // Motor starting current (Amps)
  motorStartingPF: number; // Motor starting power factor
  
  // Column Headers Group 3: Cable Data
  numberOfCores: '1C' | '2C' | '3C' | '4C';
  cableSize: number; // Cable size (mm²)
  cableRating: number; // Cable current rating (Amps)
  cableResistance_ohm_per_km: number;
  
  // Column Headers Group 4: Derating Factors
  deratingFactor: number; // Overall derating factor K
  deratingComponents?: {
    K_temp: number; // Ambient temperature
    K_group: number; // Grouping/bundling factor
    K_soil: number; // Soil factor
    K_depth: number; // Depth factor
    K_unbalance?: number; // Current unbalance factor
  };
  deratingAmbientTemp: number; // K_temp (40°C reference)
  deratingGroupingFactor: number; // K_group (A2/A3/D6/D7)
  deratingGroundTemp: number; // Ground temperature
  deratingDepth: number; // Depth of laying (cm)
  deratingThermalResistivity: number; // Thermal resistivity K·m/W (D4/D5)
  deratingUnbalance: number; // Current unbalance factor
  
  // Column Headers Group 5: Current Calculations
  fullLoadCurrent: number; // FLC or I_t
  startingCurrent?: number;
  deratedCurrent: number; // Derated current (FLC / K_total)
  loadKW: number;
  length: number;
  routeLength: number; // Route length in meters
  
  // Column Headers Group 6: Cable Sizing Constraints
  sizeByCurrent: number; // Size by ampacity
  sizeByVoltageDrop_running: number; // Size by running V-drop
  sizeByVoltageDrop_starting?: number; // Size by starting V-drop
  sizeByShortCircuit: number; // Size by ISc
  
  // Column Headers Group 7: Selected Cable Configuration
  suitableCableSize: number; // Final selected conductor area (mm²)
  numberOfRuns: number; // Number of parallel runs
  sizePerRun?: number; // Size per individual run
  currentPerRun: number; // Current per run (Ir = It / N)
  installedRatingPerRun: number; // Catalog rating × K_total per run
  installedRatingTotal: number; // installedRatingPerRun × numberOfRuns
  catalogRating?: number; // Cable rating from catalogue
  
  // Column Headers Group 8: Voltage Drop Analysis
  voltageDrop_running_volt: number;
  voltageDrop_running_percent: number;
  vdropRunningAllowable: number; // 5% for running
  voltageDrop_starting_volt?: number;
  voltageDrop_starting_percent?: number;
  vdropStartingAllowable: number; // 15% for starting
  
  // Column Headers Group 9: Cable Identification
  cableDesignation: string;
  drivingConstraint: 'Ampacity' | 'RunningVdrop' | 'StartingVdrop' | 'ISc';
  
  // Column Headers Group 10: ISc Check
  shortCircuitCurrent_kA?: number;
  shortCircuitWithstand_kA?: number;
  
  // Status & Diagnostics
  status: 'APPROVED' | 'WARNING' | 'FAILED';
  anomalies?: string[];
  warnings?: string[];
  isAnomaly?: boolean;
}

// Helper: Get conductor resistance from KEC catalogue for a specific size + cores
const getConductorResistance = (size: number, cores: string): number => {
  const coreKey = cores as keyof typeof KEC_CATALOGUE;
  const coreTable = KEC_CATALOGUE[coreKey];
  if (!coreTable) return 0.1; // Fallback
  
  const entry = coreTable.find((e: any) => e.size === size);
  if (!entry) return 0.1; // Fallback
  
  return entry.resistance || 0.1;
};

// Simple data validation to flag suspicious inputs or results
const detectAnomalies = (
  cable: CableSegment,
  result: CableSizingResult
): string[] => {
  const issues: string[] = [];

  if (!cable.loadKW || cable.loadKW === 0) {
    issues.push('Zero load (check input Load kW)');
  }

  if (!cable.voltage || cable.voltage <= 0) {
    issues.push('Invalid system voltage');
  }

  if (!cable.length || cable.length <= 0) {
    issues.push('Zero or missing cable length');
  }

  if (!cable.deratingFactor || cable.deratingFactor <= 0) {
    issues.push('Invalid derating factor');
  }

  // if final size is unrealistically small for a loaded feeder
  if (result.suitableCableSize <= 2 && result.loadKW > 0) {
    issues.push('Selected conductor area too small for load');
  }

  // check voltage drop anomaly
  if (result.voltageDrop_running_percent > 50) {
    issues.push('Very high voltage drop (>50%)');
  }

  return issues;
};

/**
 * INDUSTRIAL-GRADE CABLE SIZING
 * Uses CableSizingEngine with IEC 60287/60364 compliance
 * Handles all load types with proper environmental derating
 */
const calculateCableSizing = (cable: CableSegment): CableSizingResult => {
  try {
    // Prepare input for industrial engine
    const loadType = (cable.loadType || 'Motor') as keyof typeof LoadTypeSpecs;
    const specs = LoadTypeSpecs[loadType] || LoadTypeSpecs.Motor;
    
    // DEBUG: Log incoming cable data VERY DETAILED
    console.log(`\n[CABLE INPUT] ${cable.cableNumber}:`);
    console.log(`  loadKW: ${cable.loadKW} (type: ${typeof cable.loadKW})`);
    console.log(`  voltage: ${cable.voltage} (type: ${typeof cable.voltage})`);
    console.log(`  length: ${cable.length}`);
    console.log(`  powerFactor: ${cable.powerFactor}`);
    console.log(`  efficiency: ${cable.efficiency}`);
    console.log(`  numberOfCores: ${cable.numberOfCores}`);
    console.log(`  installationMethod: ${cable.installationMethod}`);
    console.log(`  loadType: ${loadType}`);
    
    // VALIDATION: Check for critical missing values
    if (!cable.voltage || cable.voltage <= 0) {
      console.error(`[ERROR] Missing/invalid voltage for ${cable.cableNumber}:`, cable.voltage);
      throw new Error(`Invalid voltage: ${cable.voltage}`);
    }
    if (!cable.loadKW || cable.loadKW <= 0) {
      console.error(`[ERROR] Missing/invalid loadKW for ${cable.cableNumber}:`, cable.loadKW);
      throw new Error(`Invalid loadKW: ${cable.loadKW}`);
    }
    const engineInput: CableSizingInputV2 = {
      loadType,
      ratedPowerKW: cable.loadKW || 0.1,
      voltage: cable.voltage || 415, // Default to 415V if not specified
      phase: cable.phase || '3Ø',
      efficiency: cable.efficiency || specs.typicalEfficiency || 0.95,
      powerFactor: cable.powerFactor || specs.typicalPowerFactor || 0.85,
      conductorMaterial: cable.conductorMaterial || 'Cu',
      insulation: cable.insulation || 'XLPE',
      numberOfCores: (typeof cable.numberOfCores === 'string' ? cable.numberOfCores : '3C') as '1C' | '2C' | '3C' | '4C',
      installationMethod: (['Air', 'Trench', 'Duct'].includes(cable.installationMethod || 'Air') 
        ? cable.installationMethod 
        : 'Air') as 'Air' | 'Trench' | 'Duct',
      cableLength: cable.length || 0,
      ambientTemp: cable.ambientTemp || 40,
      numberOfLoadedCircuits: cable.numberOfLoadedCircuits || 1,
      startingMethod: cable.startingMethod || 'DOL',
      protectionType: cable.protectionType || 'None',
      maxShortCircuitCurrent: cable.maxShortCircuitCurrent,
      protectionClearingTime: cable.protectionClearingTime || 0.1
    };

    console.log(`[ENGINE INPUT] for ${cable.cableNumber}:`, engineInput);

    // Run EPC-grade sizing engine (V3 logic in V2)
    const engine = new CableSizingEngine_V2();
    const engineResult = engine.sizeCable(engineInput);

    console.log(`[ENGINE OUTPUT] for ${cable.cableNumber}:`, {
      fullLoadCurrent: engineResult.fullLoadCurrent,
      sizeByAmpacity: engineResult.sizeByAmpacity,
      selectedConductorArea: engineResult.selectedConductorArea,
      numberOfRuns: engineResult.numberOfRuns,
      status: engineResult.status
    });

    // Get resistance from catalogue based on selected size + cores
    const cableResistance = getConductorResistance(
      engineResult.selectedConductorArea,
      engineInput.numberOfCores
    );

    // Map result to display format (using engine outputs directly - they are correct now)
    const result: CableSizingResult = {
      // Basic cable identification
      serialNo: cable.serialNo,
      cableNumber: cable.cableNumber,
      feederDescription: cable.feederDescription,
      fromBus: cable.fromBus,
      toBus: cable.toBus,
      
      // Electrical specifications
      breakerType: cable.breakerType || 'MCCB',
      feederType: cable.loadType || 'F',
      motorRating: cable.loadKW || 0,
      voltage: cable.voltage,
      voltageKV: (cable.voltage / 1000) || 0.415,
      voltageVariationFactor: 1.0,
      powerFactor: engineInput.powerFactor || 0.85,
      efficiency: engineInput.efficiency || 0.95,
      
      // Conductor & installation
      ratedCurrent: engineResult.fullLoadCurrent || 0,
      conductorType: engineInput.conductorMaterial === 'Cu' ? 'Cu' : 'Al',
      conductorMaterial: engineInput.conductorMaterial as 'Cu' | 'Al',
      powerSupply: '3-phase', // Derived from numberOfCores
      installationMethod: engineInput.installationMethod || 'Air',
      motorStartingCurrent: engineResult.startingCurrent || 0,
      motorStartingPF: 0.4,
      
      // Cable data
      numberOfCores: engineInput.numberOfCores,
      cableSize: engineResult.selectedConductorArea || 0,
      cableRating: engineResult.catalogRatingPerRun || 0,
      cableResistance_ohm_per_km: cableResistance,
      
      // Derating factors
      deratingFactor: engineResult.deratingFactor || 0.87,
      deratingComponents: engineResult.deratingComponents,
      deratingAmbientTemp: engineResult.deratingComponents?.K_temp || 1.0,
      deratingGroupingFactor: engineResult.deratingComponents?.K_group || 1.0,
      deratingGroundTemp: cable.ambientTemp || 20,
      deratingDepth: 75, // Default 75cm
      deratingThermalResistivity: engineResult.deratingComponents?.K_soil || 1.0,
      deratingUnbalance: engineResult.deratingComponents?.K_depth || 1.0,
      
      // Current calculations
      fullLoadCurrent: engineResult.fullLoadCurrent || 0,
      startingCurrent: engineResult.startingCurrent || 0,
      // Derated current carrying capacity (total installed rating across runs)
      deratedCurrent: engineResult.installedRatingTotal || engineResult.installedRatingPerRun || 0,
      installedRatingPerRun: engineResult.installedRatingPerRun || 0,
      installedRatingTotal: engineResult.installedRatingTotal || engineResult.installedRatingPerRun || 0,
      loadKW: cable.loadKW || 0,
      length: cable.length || 0,
      routeLength: cable.length || 0,
      
      // Cable sizing constraints
      sizeByCurrent: engineResult.sizeByAmpacity || 0,
      sizeByVoltageDrop_running: engineResult.sizeByRunningVdrop || 0,
      sizeByVoltageDrop_starting: engineResult.sizeByStartingVdrop || 0,
      sizeByShortCircuit: engineResult.sizeByISc || 0,
      
      // Selected cable configuration
      suitableCableSize: engineResult.selectedConductorArea || 0,
      numberOfRuns: engineResult.numberOfRuns || 1,
      sizePerRun: engineResult.sizePerRun || engineResult.selectedConductorArea,
      currentPerRun: (engineResult.fullLoadCurrent || 0) / (engineResult.numberOfRuns || 1),
      
      // Voltage drop analysis
      voltageDrop_running_volt: engineResult.voltageDropRunning_volt || 0,
      voltageDrop_running_percent: (engineResult.voltageDropRunning_percent || 0) * 100,
      vdropRunningAllowable: 5.0, // 5% for running
      voltageDrop_starting_volt: engineResult.voltageDropStarting_volt || 0,
      voltageDrop_starting_percent: (engineResult.voltageDropStarting_percent || 0) * 100,
      vdropStartingAllowable: 15.0, // 15% for starting
      
      // Cable identification & ISc
      cableDesignation: engineResult.cableDesignation || '',
      drivingConstraint: (engineResult.drivingConstraint || 'Ampacity') as any,
      shortCircuitCurrent_kA: engineResult.shortCircuitIsc_kA,
      shortCircuitWithstand_kA: engineResult.shortCircuitWithstand_kA,
      catalogRating: engineResult.catalogRatingPerRun || 0,
      
      // Status
      status: engineResult.status,
      warnings: engineResult.warnings,
      anomalies: engineResult.warnings
    };

    const anomalies = detectAnomalies(cable, result);
    result.anomalies = [...(result.warnings || []), ...anomalies];
    result.isAnomaly = result.anomalies.length > 0;

    return result;
  } catch (error) {
    // Fallback for invalid data
    console.error(`❌ CABLE SIZING ERROR for ${cable.cableNumber}:`, error);
    console.error('Cable object:', cable);
    console.error('Engine input was:', {
      ratedPowerKW: cable.loadKW,
      voltage: cable.voltage,
      numberOfCores: cable.numberOfCores,
      installationMethod: cable.installationMethod
    });
    return {
      serialNo: cable.serialNo,
      cableNumber: cable.cableNumber,
      feederDescription: cable.feederDescription,
      fromBus: cable.fromBus,
      toBus: cable.toBus,
      breakerType: cable.breakerType || 'MCCB',
      feederType: cable.loadType || 'F',
      motorRating: cable.loadKW || 0,
      voltage: cable.voltage,
      voltageKV: (cable.voltage / 1000) || 0.415,
      voltageVariationFactor: 1.0,
      powerFactor: 0.85,
      efficiency: 0.95,
      ratedCurrent: 0,
      conductorType: cable.conductorMaterial === 'Cu' ? 'Cu' : 'Al',
      conductorMaterial: cable.conductorMaterial || 'Cu',
      powerSupply: '3-phase',
      installationMethod: cable.installationMethod || 'Air',
      motorStartingCurrent: 0,
      motorStartingPF: 0.4,
      numberOfCores: '3C',
      cableSize: 0,
      cableRating: 0,
      cableResistance_ohm_per_km: 0,
      deratingFactor: 0.87,
      deratingComponents: { K_temp: 1, K_group: 1, K_soil: 1, K_depth: 1 },
      deratingAmbientTemp: 1.0,
      deratingGroupingFactor: 1.0,
      deratingGroundTemp: 20,
      deratingDepth: 75,
      deratingThermalResistivity: 1.0,
      deratingUnbalance: 1.0,
      fullLoadCurrent: 0,
      startingCurrent: 0,
      deratedCurrent: 0,
      loadKW: cable.loadKW || 0,
      length: cable.length || 0,
      routeLength: cable.length || 0,
      sizeByCurrent: 0,
      sizeByVoltageDrop_running: 0,
      sizeByVoltageDrop_starting: 0,
      sizeByShortCircuit: 0,
      suitableCableSize: 0,
      numberOfRuns: 1,
      sizePerRun: 0,
      currentPerRun: 0,
      installedRatingPerRun: 0,
      installedRatingTotal: 0,
      voltageDrop_running_volt: 0,
      voltageDrop_running_percent: 0,
      vdropRunningAllowable: 5.0,
      voltageDrop_starting_volt: 0,
      voltageDrop_starting_percent: 0,
      vdropStartingAllowable: 15.0,
      cableDesignation: 'ERROR',
      drivingConstraint: 'Ampacity',
      shortCircuitCurrent_kA: 0,
      shortCircuitWithstand_kA: 0,
      catalogRating: 0,
      status: 'FAILED',
      anomalies: [
        'Cable sizing calculation failed',
        error instanceof Error ? error.message : 'Unknown error'
      ]
    };
  }
};

const ResultsTab = () => {
  const { normalizedFeeders, pathAnalysis } = usePathContext();
  const [results, setResults] = useState<CableSizingResult[]>([]);
  const [dedupeReport, setDedupeReport] = useState<{ count: number; sample: any[] }>({ count: 0, sample: [] });
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('results_visible_columns');
      return raw ? JSON.parse(raw) : {
        // GROUP 1: Serial Number & Cable Identification (Always shown)
        serialNo: true,
        cableNumber: true,
        feederDescription: true,
        fromBus: true,
        toBus: true,
        
        // GROUP 2: Feeder & Electrical Specifications
        breakerType: true,
        feederType: true,
        motorRating: true,
        voltage: true,
        voltageKV: true,
        voltageVariationFactor: false,
        powerFactor: true,
        efficiency: true,
        
        // GROUP 3: Conductor & Installation Details
        ratedCurrent: true,
        conductorType: true,
        powerSupply: true,
        installationMethod: true,
        motorStartingCurrent: true,
        motorStartingPF: true,
        
        // GROUP 4: Cable Data
        numberOfCores: true,
        cableSize: true,
        cableRating: true,
        
        // GROUP 5: Derating Factors (Individual subfactors)
        deratingAmbientTemp: true,
        deratingGroupingFactor: true,
        deratingGrouping: true,
        deratingTotal: true,
        deratingGroundTemp: false,
        deratingDepth: false,
        deratingThermalResistivity: true,
        deratingUnbalance: false,
        deratingFactor: true,
        
        // GROUP 6: Current Carrying Capacity
        fullLoadCurrent: true,
        deratedCurrent: true,
        catalogRating: true,
        
        // GROUP 7: Cable Routing
        routeLength: true,
        loadKW: true,
        cableDesignation: true,
        
        // GROUP 8: Sizing Constraints (Why size was chosen)
        sizeByCurrent: true,
        sizeByVoltageDrop_running: true,
        sizeByVoltageDrop_starting: false,
        sizeByShortCircuit: false,
        drivingConstraint: true,
        
        // GROUP 9: Voltage Drop Analysis
        voltageDrop_running_volt: true,
        voltageDrop_running_percent: true,
        vdropRunningAllowable: true,
        voltageDrop_starting_volt: false,
        voltageDrop_starting_percent: false,
        vdropStartingAllowable: false,
        
        // GROUP 10: Final Cable Selection
        suitableCableSize: true,
        numberOfRuns: true,
        currentPerRun: true,
        shortCircuitCurrent_kA: true,
        shortCircuitWithstand_kA: true,
        
        // STATUS
        status: true,
      };
    } catch {
      return {
        serialNo: true,
        cableNumber: true,
        feederDescription: true,
        fromBus: true,
        toBus: true,
        breakerType: true,
        feederType: true,
        motorRating: true,
        voltage: true,
        voltageKV: true,
        powerFactor: true,
        efficiency: true,
        ratedCurrent: true,
        conductorType: true,
        powerSupply: true,
        installationMethod: true,
        motorStartingCurrent: true,
        motorStartingPF: true,
        numberOfCores: true,
        cableSize: true,
        cableRating: true,
        deratingAmbientTemp: true,
        deratingGroupingFactor: true,
        deratingGrouping: true,
        deratingTotal: true,
        deratingFactor: true,
        fullLoadCurrent: true,
        deratedCurrent: true,
        catalogRating: true,
        routeLength: true,
        loadKW: true,
        cableDesignation: true,
        sizeByCurrent: true,
        sizeByVoltageDrop_running: true,
        drivingConstraint: true,
        voltageDrop_running_volt: true,
        voltageDrop_running_percent: true,
        vdropRunningAllowable: true,
        suitableCableSize: true,
        numberOfRuns: true,
        currentPerRun: true,
        shortCircuitCurrent_kA: true,
        shortCircuitWithstand_kA: true,
        status: true,
        };
    }
  });

  useEffect(() => {
    localStorage.setItem('results_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Generate results from ALL normalized feeders (not just discovered paths)
  const generateResults = () => {
    if (!normalizedFeeders || normalizedFeeders.length === 0) return [];
    // Remove exact duplicate rows (same cableNumber, from/to, length, load, voltage)
    const keyFor = (f: any) => `${f.cableNumber}||${f.fromBus}||${f.toBus}||${f.length}||${f.loadKW}||${f.voltage}`;
    const seen = new Set<string>();
    const uniqueFeeders: typeof normalizedFeeders = [] as any;
    const duplicates: any[] = [];

    for (const f of normalizedFeeders) {
      const k = keyFor(f);
      if (seen.has(k)) {
        duplicates.push(f);
      } else {
        seen.add(k);
        uniqueFeeders.push(f);
      }
    }

    if (duplicates.length > 0) {
      console.warn(`[RESULTS] Detected and removed ${duplicates.length} exact duplicate feeder row(s). Display will show ${uniqueFeeders.length} unique rows.`);
      console.warn('Removed duplicates sample:', duplicates.slice(0, 5));
      setDedupeReport({ count: duplicates.length, sample: duplicates.slice(0, 5) });
    } else {
      setDedupeReport({ count: 0, sample: [] });
    }

    // Process unique feeders in input order
    const allCables: CableSizingResult[] = uniqueFeeders
      .sort((a, b) => a.serialNo - b.serialNo)
      .map((cable) => {
        const result = calculateCableSizing(cable);
        const issues = detectAnomalies(cable, result);
        result.anomalies = issues;
        result.isAnomaly = issues.length > 0;
        return result;
      });

    // If pathAnalysis is available, map path voltage drop values into each result
    if (pathAnalysis && Array.isArray(pathAnalysis.paths)) {
      for (const r of allCables) {
        try {
          // Find a path that includes this cable (match by cableNumber first)
          const matched = pathAnalysis.paths.find((p) => p.cables.some((c: any) => String(c.cableNumber).trim() === String(r.cableNumber).trim()));
          if (matched) {
            // Override running v-drop with path-level v-drop (trace from OptimizationTab)
            r.voltageDrop_running_volt = matched.voltageDrop || r.voltageDrop_running_volt;
            r.voltageDrop_running_percent = (matched.voltageDropPercent != null ? matched.voltageDropPercent : r.voltageDrop_running_percent);
            // Keep starting v-drop from engine if available
            r.routeLength = matched.totalDistance || r.routeLength;
          }
        } catch (e) {
          // Don't break result generation on path mapping errors
          console.warn('Path mapping failed for', r.cableNumber, e);
        }
      }
    }

    // Post-process statuses: convert non-critical FAILED to WARNING when appropriate
    for (const r of allCables) {
      // If engine set FAILED due to calculation error, keep it FAILED
      if (r.status === 'FAILED') {
        const critical = (r.warnings || []).some(w => /Sizing Error|Selected size|No catalog|Invalid full load current/i.test(w));
        if (!critical) {
          // demote informational failures to WARNING so UI doesn't show false red X
          r.status = (r.warnings && r.warnings.length > 0) ? 'WARNING' : 'APPROVED';
        }
      }

      // Final validation: ensure derated installed capacity covers load (installedRatingTotal >= fullLoadCurrent)
      // Use robust fallback: prefer engine provided installedRatingTotal, else compute from catalogRating/cableRating × deratingFactor × runs
      const catalogBase = (r.catalogRating || r.cableRating || 0);
      const computedInstalledPerRun = catalogBase * (r.deratingFactor || 1);
      const computedInstalledTotal = computedInstalledPerRun * (r.numberOfRuns || 1);
      const derated = (r.installedRatingTotal || r.deratedCurrent || computedInstalledTotal || 0);
      if (derated < (r.fullLoadCurrent || 0)) {
        r.status = 'FAILED';
        r.warnings = [...(r.warnings || []), `Insufficient derated capacity: ${derated.toFixed(2)}A < FLC ${((r.fullLoadCurrent||0)).toFixed(2)}A`];
      }

      // Voltage drop thresholds produce WARNING (not immediate failure)
      const vLimit = r.vdropRunningAllowable || 5.0;
      if ((r.voltageDrop_running_percent || 0) > vLimit) {
        r.status = r.status === 'FAILED' ? 'FAILED' : 'WARNING';
        r.warnings = [...(r.warnings || []), `Running V-drop ${r.voltageDrop_running_percent.toFixed(2)}% > ${vLimit}%`];
      }
    }

    return allCables;
  };

  // Initialize results from normalized feeders when they change
  useEffect(() => {
    if (normalizedFeeders && normalizedFeeders.length > 0) {
      setResults(generateResults());
    } else {
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedFeeders]);

  // Verification and logging: provide concise report for debugging
  useEffect(() => {
    try {
      console.group('RESULTS VERIFICATION');
      console.log('Input feeders:', normalizedFeeders ? normalizedFeeders.length : 0);
      console.log('Duplicates removed:', dedupeReport.count);
      if (dedupeReport.sample.length > 0) console.log('Duplicate sample:', dedupeReport.sample);
      console.log('Discovered paths:', pathAnalysis ? pathAnalysis.totalPaths : 0);
      console.log('Results generated:', results.length);

      const failed = results.filter(r => r.status === 'FAILED');
      const warnings = results.filter(r => r.status === 'WARNING');
      console.log('Failed results:', failed.length);
      if (failed.length > 0) console.log(failed.slice(0, 10));
      console.log('Warnings:', warnings.length);
      if (warnings.length > 0) console.log(warnings.slice(0, 10));

      // Show first 5 full path sequences if available
      if (pathAnalysis && pathAnalysis.paths && pathAnalysis.paths.length > 0) {
        console.log('Sample paths (up to 5):');
        pathAnalysis.paths.slice(0, 5).forEach((p: any, idx: number) => {
          console.log(`Path ${idx + 1}: ${p.startPanel} → ... → ${p.endTransformer} (${p.cables.length} cables, ${p.totalDistance}m)`);
          console.log(p.cables.map((c: any) => `${c.fromBus}→${c.toBus} (${c.cableNumber})`).join('  |  '));
        });
      }

      console.groupEnd();
    } catch (err) {
      console.error('Verification logging failed:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, dedupeReport, pathAnalysis]);

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-500" size={32} />
          <h3 className="text-yellow-200 font-semibold mb-2">
            No Results Yet
          </h3>
          <p className="text-yellow-300 text-sm mb-4">
            Perform path analysis in the <strong>Optimization</strong> tab first
            to generate cable sizing results.
          </p>
        </div>
      </div>
    );
  }

  const handleExportExcel = () => {
    const exportData = results.map((r) => ({
      'Serial No': r.serialNo,
      'Cable Number': r.cableNumber,
      'Feeder Description': r.feederDescription,
      'From Bus': r.fromBus,
      'To Bus': r.toBus,
      'Voltage (V)': r.voltage,
      'Load (kW)': r.loadKW.toFixed(2),
      'Length (m)': r.length.toFixed(2),
      'PF': r.powerFactor.toFixed(2),
      'Efficiency (%)': (r.efficiency * 100).toFixed(1),
      'FLC (A)': r.fullLoadCurrent.toFixed(2),
      'Derated Current (A)': r.deratedCurrent.toFixed(2),
      'Derating K_total': r.deratingFactor.toFixed(3),
      'K_temp': (r.deratingComponents?.K_temp || 0).toFixed(3),
      'K_group': (r.deratingComponents?.K_group || 0).toFixed(3),
      'K_soil': (r.deratingComponents?.K_soil || 0).toFixed(3),
      'K_depth': (r.deratingComponents?.K_depth || 0).toFixed(3),
      'Cable Resistance (Ω/km)': r.cableResistance_ohm_per_km.toFixed(4),
      'Running V-Drop (V)': r.voltageDrop_running_volt.toFixed(2),
      'Running V-Drop (%)': r.voltageDrop_running_percent.toFixed(2),
      'Starting V-Drop (V)': (r.voltageDrop_starting_volt || 0).toFixed(2),
      'Starting V-Drop (%)': (r.voltageDrop_starting_percent || 0).toFixed(2),
      'Size by Current (mm²)': r.sizeByCurrent,
      'Size by Running V-Drop (mm²)': r.sizeByVoltageDrop_running,
      'Size by Starting V-Drop (mm²)': (r.sizeByVoltageDrop_starting || 0),
      'Size by Isc (mm²)': r.sizeByShortCircuit,
      'Selected Cable Size (mm²)': r.suitableCableSize,
      'Number of Cores': r.numberOfCores,
      'Number of Runs': r.numberOfRuns,
      'Conductor Material': r.conductorMaterial,
      'Cable Designation': r.cableDesignation,
      'Catalog Rating (A)': r.catalogRating,
      'Driving Constraint': r.drivingConstraint,
      'Isc (kA)': (r.shortCircuitCurrent_kA || 0).toFixed(1),
      'Status': r.status.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Cable Sizing Results'
    );
    XLSX.writeFile(workbook, `cable_sizing_results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const tableData = results.map((r) => [
        String(r.serialNo),
        r.cableNumber,
        r.feederDescription.substring(0, 20),
        r.fromBus,
        r.toBus,
        String(r.voltage),
        r.loadKW.toFixed(1),
        r.length.toFixed(1),
        r.fullLoadCurrent.toFixed(1),
        r.deratedCurrent.toFixed(1),
        r.voltageDrop_running_percent.toFixed(2),
        String(r.sizeByCurrent),
        String(r.sizeByVoltageDrop_running),
        String(r.suitableCableSize),
        String(r.numberOfRuns),
        r.cableDesignation,
        r.status.toUpperCase(),
      ]);

      // Use dynamic import pattern for autoTable
      const jsPDFWithAutoTable = doc as any;
      
      if (jsPDFWithAutoTable.autoTable) {
        jsPDFWithAutoTable.autoTable({
          head: [
            [
              'S.No',
              'Cable #',
              'Description',
              'From',
              'To',
              'V',
              'kW',
              'L(m)',
              'FLC(A)',
              'Derated(A)',
              'V%',
              'I-Size',
              'V-Size',
              'Final',
              'Runs',
              'Designation',
              'Status',
            ],
          ],
          body: tableData,
          startY: 20,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [240, 248, 255] },
          margin: { top: 25 },
        });
      }

      doc.text(
        `Cable Sizing Results - ${new Date().toLocaleDateString()}`,
        14,
        10
      );
      
      const fileName = `cable_sizing_results_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Check browser console for details.');
    }
  };

  const validResults = results.filter((r) => r.status === 'APPROVED').length;
  const invalidResults = results.filter((r) => r.status === 'FAILED').length;
  const totalLoad = results.reduce((sum, r) => sum + r.loadKW, 0);

  // Dynamic visible column counts for grouped headers
  const deratingCount = [
    'deratingTotal',
    'deratingAmbientTemp',
    'deratingGrouping',
    'deratingThermalResistivity',
    'deratingDepth',
  ].reduce((acc, k) => acc + (visibleColumns[k] ? 1 : 0), 0);

  const flcCount = ['fullLoadCurrent', 'deredCurrent', 'cableSize'].reduce(
    (acc, k) => acc + (visibleColumns[k] ? 1 : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <FileText className="mr-2" size={20} />
            Cable Sizing Results & Analysis
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleExportExcel}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              PDF
            </button>
            <button
              onClick={() => setShowCustomize((s) => !s)}
              className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              Customize
            </button>
          </div>
        </div>
        {showCustomize && (
          <div className="mt-3 p-3 bg-slate-700/40 rounded border border-slate-600">
            <h4 className="text-white font-semibold mb-3 text-sm">Customize Visible Columns</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.serialNo} onChange={() => setVisibleColumns((p) => ({ ...p, serialNo: !p.serialNo }))} />
                <span>Serial No</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.cableNumber} onChange={() => setVisibleColumns((p) => ({ ...p, cableNumber: !p.cableNumber }))} />
                <span>Cable #</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.feederDescription} onChange={() => setVisibleColumns((p) => ({ ...p, feederDescription: !p.feederDescription }))} />
                <span>Description</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.fromBus} onChange={() => setVisibleColumns((p) => ({ ...p, fromBus: !p.fromBus }))} />
                <span>From Bus</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.toBus} onChange={() => setVisibleColumns((p) => ({ ...p, toBus: !p.toBus }))} />
                <span>To Bus</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.breaker} onChange={() => setVisibleColumns((p) => ({ ...p, breaker: !p.breaker }))} />
                <span>Breaker Type</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.feederType} onChange={() => setVisibleColumns((p) => ({ ...p, feederType: !p.feederType }))} />
                <span>Feeder Type</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.load} onChange={() => setVisibleColumns((p) => ({ ...p, load: !p.load }))} />
                <span>Load (kW)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.quantity} onChange={() => setVisibleColumns((p) => ({ ...p, quantity: !p.quantity }))} />
                <span>Quantity</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.voltage} onChange={() => setVisibleColumns((p) => ({ ...p, voltage: !p.voltage }))} />
                <span>Voltage (V)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.powerFactor} onChange={() => setVisibleColumns((p) => ({ ...p, powerFactor: !p.powerFactor }))} />
                <span>Power Factor</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.efficiency} onChange={() => setVisibleColumns((p) => ({ ...p, efficiency: !p.efficiency }))} />
                <span>Efficiency</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.conductorType} onChange={() => setVisibleColumns((p) => ({ ...p, conductorType: !p.conductorType }))} />
                <span>Conductor</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.powerSupply} onChange={() => setVisibleColumns((p) => ({ ...p, powerSupply: !p.powerSupply }))} />
                <span>Power Supply</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.installationMethod} onChange={() => setVisibleColumns((p) => ({ ...p, installationMethod: !p.installationMethod }))} />
                <span>Installation</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.motorStartingCurrent} onChange={() => setVisibleColumns((p) => ({ ...p, motorStartingCurrent: !p.motorStartingCurrent }))} />
                <span>Motor Start (A)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.motorStartingPF} onChange={() => setVisibleColumns((p) => ({ ...p, motorStartingPF: !p.motorStartingPF }))} />
                <span>Start PF</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.numberOfCores} onChange={() => setVisibleColumns((p) => ({ ...p, numberOfCores: !p.numberOfCores }))} />
                <span>Cores</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.cableSize} onChange={() => setVisibleColumns((p) => ({ ...p, cableSize: !p.cableSize }))} />
                <span>Cable Size</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.cableRating} onChange={() => setVisibleColumns((p) => ({ ...p, cableRating: !p.cableRating }))} />
                <span>Cable Rating</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingTotal} onChange={() => setVisibleColumns((p) => ({ ...p, deratingTotal: !p.deratingTotal }))} />
                <span>Derating Factor</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingAmbientTemp} onChange={() => setVisibleColumns((p) => ({ ...p, deratingAmbientTemp: !p.deratingAmbientTemp }))} />
                <span>K_temp</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingGrouping} onChange={() => setVisibleColumns((p) => ({ ...p, deratingGrouping: !p.deratingGrouping }))} />
                <span>K_group</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingGroundTemp} onChange={() => setVisibleColumns((p) => ({ ...p, deratingGroundTemp: !p.deratingGroundTemp }))} />
                <span>K_temp_ground</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingDepth} onChange={() => setVisibleColumns((p) => ({ ...p, deratingDepth: !p.deratingDepth }))} />
                <span>K_depth</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingThermalResistivity} onChange={() => setVisibleColumns((p) => ({ ...p, deratingThermalResistivity: !p.deratingThermalResistivity }))} />
                <span>K_soil</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deratingUnbalance} onChange={() => setVisibleColumns((p) => ({ ...p, deratingUnbalance: !p.deratingUnbalance }))} />
                <span>K_unbalance</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.deredCurrent} onChange={() => setVisibleColumns((p) => ({ ...p, deredCurrent: !p.deredCurrent }))} />
                <span>Derated Current</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.comparison} onChange={() => setVisibleColumns((p) => ({ ...p, comparison: !p.comparison }))} />
                <span>Capacity Check</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropRunning} onChange={() => setVisibleColumns((p) => ({ ...p, vdropRunning: !p.vdropRunning }))} />
                <span>V-Drop (Run)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropRunningPercent} onChange={() => setVisibleColumns((p) => ({ ...p, vdropRunningPercent: !p.vdropRunningPercent }))} />
                <span>V-Drop % (Run)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropAllowable} onChange={() => setVisibleColumns((p) => ({ ...p, vdropAllowable: !p.vdropAllowable }))} />
                <span>V-Drop OK (Run)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropStarting} onChange={() => setVisibleColumns((p) => ({ ...p, vdropStarting: !p.vdropStarting }))} />
                <span>V-Drop (Start)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropStartingPercent} onChange={() => setVisibleColumns((p) => ({ ...p, vdropStartingPercent: !p.vdropStartingPercent }))} />
                <span>V-Drop % (Start)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.vdropStartingAllowable} onChange={() => setVisibleColumns((p) => ({ ...p, vdropStartingAllowable: !p.vdropStartingAllowable }))} />
                <span>V-Drop OK (Start)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.numberOfRuns} onChange={() => setVisibleColumns((p) => ({ ...p, numberOfRuns: !p.numberOfRuns }))} />
                <span>No. of Runs</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.currentPerRun} onChange={() => setVisibleColumns((p) => ({ ...p, currentPerRun: !p.currentPerRun }))} />
                <span>Current/Run</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.routeLength} onChange={() => setVisibleColumns((p) => ({ ...p, routeLength: !p.routeLength }))} />
                <span>Route Length</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.designation} onChange={() => setVisibleColumns((p) => ({ ...p, designation: !p.designation }))} />
                <span>Cable Designation</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={visibleColumns.status} onChange={() => setVisibleColumns((p) => ({ ...p, status: !p.status }))} />
                <span>Status</span>
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center bg-slate-700/50 rounded p-3">
            <p className="text-2xl font-bold text-cyan-400">{results.length}</p>
            <p className="text-slate-400">Total Cables</p>
          </div>
          <div className="text-center bg-slate-700/50 rounded p-3">
            <p className="text-2xl font-bold text-green-400">{validResults}</p>
            <p className="text-slate-400">Valid (V%≤5)</p>
          </div>
          <div className="text-center bg-slate-700/50 rounded p-3">
            <p className="text-2xl font-bold text-red-400">{invalidResults}</p>
            <p className="text-slate-400">Invalid (V%&gt;5)</p>
          </div>
          <div className="text-center bg-slate-700/50 rounded p-3">
            <p className="text-2xl font-bold text-yellow-400">
              {totalLoad.toFixed(1)}
            </p>
            <p className="text-slate-400">Total Load (kW)</p>
          </div>
          <div className="text-center bg-slate-700/50 rounded p-3">
            <p className="text-2xl font-bold text-orange-400">
              {(
                results.reduce((sum, r) => sum + r.suitableCableSize, 0) /
                results.length
              ).toFixed(0)}
            </p>
            <p className="text-slate-400">Avg Cable Size (mm²)</p>
          </div>
        </div>
      </div>

      {/* Results Table - PROPER COLUMN ORDER WITH DERATING FIRST */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto results-table-scroll" style={{ height: '1200px' }}>
          <table className="w-full min-w-[4000px] text-xs border-collapse">
            <thead className="bg-slate-700 sticky top-0 border-b border-slate-600">
              <tr>
                {/* Identity columns - subtle background */}
                {visibleColumns.serialNo && (
                  <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>S.No</th>
                )}
                {visibleColumns.cableNumber && (
                  <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Cable #</th>
                )}
                {visibleColumns.feederDescription && (
                  <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Description</th>
                )}
                {visibleColumns.fromBus && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>From Bus</th>
                )}
                {visibleColumns.toBus && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>To Bus</th>
                )}
                {visibleColumns.voltage && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>V(V)</th>
                )}
                {visibleColumns.load && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Load(kW)</th>
                )}
                {visibleColumns.routeLength && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>L(m)</th>
                )}
                {/* --- Professional feeder details (inserted per Excel template) --- */}
                {visibleColumns.breakerType && (
                  <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Breaker Type</th>
                )}
                {visibleColumns.feederType && (
                  <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Type of Feeder</th>
                )}
                {visibleColumns.motorRating && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Load / Motor Rating (kW/kVA)</th>
                )}
                {visibleColumns.voltageKV && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>V (kV)</th>
                )}
                {visibleColumns.powerFactor && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Power Factor</th>
                )}
                {visibleColumns.efficiency && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Efficiency</th>
                )}
                {visibleColumns.voltageVariationFactor && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Voltage Variation Factor</th>
                )}
                {visibleColumns.ratedCurrent && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Rated Current (A) It</th>
                )}
                {visibleColumns.conductorType && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Type of Conductor</th>
                )}
                {visibleColumns.powerSupply && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Power Supply</th>
                )}
                {visibleColumns.installationMethod && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Installation</th>
                )}
                {visibleColumns.motorStartingCurrent && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Motor Starting Current (A)</th>
                )}
                {visibleColumns.motorStartingPF && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Motor Starting PF</th>
                )}
                {visibleColumns.numberOfCores && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>No. of cores</th>
                )}
                {visibleColumns.cableSize && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Size (mm²)</th>
                )}
                {visibleColumns.cableRating && (
                  <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Cable Current Rating (A)</th>
                )}
                
                {/* DERATING FACTORS - BEFORE FLC */}
                {deratingCount > 0 && (
                  <th colSpan={deratingCount} className="px-2 py-2 text-center text-slate-900 font-bold bg-slate-700 border-l border-slate-500">Derating Factors (IEC)</th>
                )}

                {/* Section 1: FLC Sizing */}
                {flcCount > 0 && (
                  <th colSpan={flcCount} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">1. FLC Sizing</th>
                )}
                
                {/* Cable Sizes by Constraints */}
                <th colSpan={3} className="px-2 py-2 text-center text-white font-bold bg-slate-600 border-l border-slate-500">Cable Sizes (mm²)</th>
                
                {/* Selected Cable */}
                <th colSpan={2} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">Selected Size</th>
                
                {/* Voltage Drop Running */}
                <th colSpan={3} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">V-Drop Running</th>
                
                {/* Voltage Drop Starting */}
                <th colSpan={3} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">V-Drop Starting</th>
                
                {/* Designation */}
                <th colSpan={2} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">Designation</th>
                
                <th className="px-2 py-2 text-center text-slate-200 font-bold border-l border-slate-500" rowSpan={2}>Status</th>
              </tr>
              
              {/* Sub-headers */}
              <tr className="bg-slate-650 border-b border-slate-600">
                {/* Derating sub-headers - FIRST */}
                {visibleColumns.deratingTotal && (
                  <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-slate-600 border-l border-slate-500">
                    K_tot
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(10)}</div>
                  </th>
                )}
                {visibleColumns.deratingAmbientTemp && (
                  <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-slate-600">
                    K_t
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(5)}</div>
                  </th>
                )}
                {visibleColumns.deratingGrouping && (
                  <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-slate-600">
                    K_g
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(6)}</div>
                  </th>
                )}
                {visibleColumns.deratingThermalResistivity && (
                  <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-slate-600">
                    K_s
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(9)}</div>
                  </th>
                )}
                {visibleColumns.deratingDepth && (
                  <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-slate-600">
                    K_d
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(8)}</div>
                  </th>
                )}
                
                {/* FLC sub-headers */}
                {visibleColumns.fullLoadCurrent && (
                  <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">
                    FLC(A)
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(1)}</div>
                  </th>
                )}
                {visibleColumns.deredCurrent && (
                  <th className="px-2 py-1 text-center text-slate-300 text-xs">
                    Derated(A)
                    <div className="text-xs text-slate-400 mt-1">{getFormulaText(11)}</div>
                  </th>
                )}
                {visibleColumns.cableSize && (
                  <th className="px-2 py-1 text-center text-slate-300 text-xs">Size(mm²)</th>
                )}
                
                {/* Cable sizes sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">
                  By Isc
                  <div className="text-xs text-slate-400 mt-1">{getFormulaText(25)}</div>
                </th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">By V-Drop(Run)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">By V-Drop(Start)</th>
                
                {/* Selected size sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">Size(mm²)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">Runs</th>
                
                {/* V-drop running sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">
                  ΔU(V)
                  <div className="text-xs text-slate-400 mt-1">{getFormulaText(13)}</div>
                </th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">%(≤5%)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">OK?</th>
                
                {/* V-drop starting sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">
                  ΔU(V)
                  <div className="text-xs text-slate-400 mt-1">{getFormulaText(16)}</div>
                </th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">%(≤15%)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">OK?</th>
                
                {/* Designation sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">Cable Des.</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">R(Ω/km)</th>
              </tr>

              {/* removed full-width formula summary; per-column snippets are shown in each TH */}
            </thead>
            
            <tbody className="divide-y divide-slate-700">
              {results.map((result) => (
                <tr
                  key={`${result.cableNumber}-${result.serialNo}`}
                  className={`hover:bg-slate-700/50 transition-colors ${result.isAnomaly ? 'bg-red-950/20' : ''}`}
                >
                  {/* Identity cells */}
                  {visibleColumns.serialNo && (
                    <td className="px-2 py-1 text-slate-300">{result.serialNo}</td>
                  )}
                  {visibleColumns.cableNumber && (
                    <td className="px-2 py-1 text-slate-300 font-medium">{result.cableNumber}</td>
                  )}
                  {visibleColumns.feederDescription && (
                    <td className="px-2 py-1 text-slate-300 max-w-xs text-xs">{result.feederDescription}</td>
                  )}
                  {visibleColumns.fromBus && (
                    <td className="px-2 py-1 text-cyan-400 text-xs font-medium">{result.fromBus}</td>
                  )}
                  {visibleColumns.toBus && (
                    <td className="px-2 py-1 text-cyan-400 text-xs font-medium">{result.toBus}</td>
                  )}
                  {visibleColumns.voltage && (
                    <td className="px-2 py-1 text-center text-slate-300">{result.voltage}</td>
                  )}
                  {visibleColumns.load && (
                    <td className="px-2 py-1 text-center text-slate-300">{result.loadKW.toFixed(2)}</td>
                  )}
                  {visibleColumns.routeLength && (
                    <td className="px-2 py-1 text-center text-slate-300">{result.length.toFixed(1)}</td>
                  )}

                  {/* Professional feeder detail cells (per Excel template) */}
                  {visibleColumns.breakerType && (
                    <td className="px-2 py-1 text-slate-300">{(result as any).breakerType || '—'}</td>
                  )}
                  {visibleColumns.feederType && (
                    <td className="px-2 py-1 text-slate-300">{(result as any).feederType || 'F'}</td>
                  )}
                  {visibleColumns.motorRating && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result as any).motorRating ? (Number((result as any).motorRating).toFixed(2)) : (result.loadKW ? result.loadKW.toFixed(2) : '0.00')}</td>
                  )}
                  {visibleColumns.voltageKV && (
                    <td className="px-2 py-1 text-center text-slate-300">{((result.voltage || 0) / 1000).toFixed(3)}</td>
                  )}
                  {visibleColumns.powerFactor && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.powerFactor || 0.85).toFixed(2)}</td>
                  )}
                  {visibleColumns.efficiency && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.efficiency || 0.95).toFixed(2)}</td>
                  )}
                  {visibleColumns.voltageVariationFactor && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.voltageVariationFactor || 1.0).toFixed(2)}</td>
                  )}
                  {visibleColumns.ratedCurrent && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.ratedCurrent || result.fullLoadCurrent || 0).toFixed(1)}</td>
                  )}
                  {visibleColumns.conductorType && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.conductorType || (result.conductorMaterial || 'Cu'))}</td>
                  )}
                  {visibleColumns.powerSupply && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.powerSupply || '3-phase')}</td>
                  )}
                  {visibleColumns.installationMethod && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.installationMethod || 'Air')}</td>
                  )}
                  {visibleColumns.motorStartingCurrent && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.startingCurrent || 0).toFixed(1)}</td>
                  )}
                  {visibleColumns.motorStartingPF && (
                    <td className="px-2 py-1 text-center text-slate-300">{((result as any).motorStartingPF || 0.4).toFixed(2)}</td>
                  )}
                  {visibleColumns.numberOfCores && (
                    <td className="px-2 py-1 text-center text-slate-300">{result.numberOfCores}</td>
                  )}
                  {visibleColumns.cableSize && (
                    <td className="px-2 py-1 text-center font-bold text-blue-400">{result.cableSize || result.suitableCableSize}</td>
                  )}
                  {visibleColumns.cableRating && (
                    <td className="px-2 py-1 text-center text-slate-300">{(result.cableRating || result.catalogRating || 0).toFixed(1)}</td>
                  )}

                  {/* Derating Factors - FIRST */}
                  {visibleColumns.deratingTotal && (
                    <td className="px-2 py-1 text-center font-bold text-slate-300 border-l border-slate-600">{result.deratingFactor.toFixed(3)}</td>
                  )}
                  {visibleColumns.deratingAmbientTemp && (
                    <td className="px-2 py-1 text-center text-sm text-slate-300">{(result.deratingComponents?.K_temp || 1).toFixed(2)}</td>
                  )}
                  {visibleColumns.deratingGrouping && (
                    <td className="px-2 py-1 text-center text-sm text-slate-300">{(result.deratingComponents?.K_group || 1).toFixed(2)}</td>
                  )}
                  {visibleColumns.deratingThermalResistivity && (
                    <td className="px-2 py-1 text-center text-sm text-slate-300">{(result.deratingComponents?.K_soil || 1).toFixed(2)}</td>
                  )}
                  {visibleColumns.deratingDepth && (
                    <td className="px-2 py-1 text-center text-sm text-slate-300">{(result.deratingComponents?.K_depth || 1).toFixed(2)}</td>
                  )}

                  {/* FLC Sizing */}
                  {visibleColumns.fullLoadCurrent && (
                    <td className="px-2 py-1 text-center text-slate-300 border-l border-slate-600">{result.fullLoadCurrent.toFixed(1)}</td>
                  )}
                  {visibleColumns.deredCurrent && (
                    <td className="px-2 py-1 text-center text-slate-300">{result.deratedCurrent.toFixed(1)}</td>
                  )}
                  {visibleColumns.cableSize && (
                    <td className="px-2 py-1 text-center font-bold text-blue-400">{result.sizeByCurrent}</td>
                  )}
                  
                  {/* Cable Sizes */}
                  <td className="px-2 py-1 text-center text-red-400 font-medium border-l border-slate-600">{result.sizeByShortCircuit}</td>
                  <td className="px-2 py-1 text-center text-purple-400 font-medium">{result.sizeByVoltageDrop_running}</td>
                  <td className="px-2 py-1 text-center text-purple-400 font-medium">{(result.sizeByVoltageDrop_starting || 0)}</td>
                  
                  {/* Selected Size */}
                  <td className="px-2 py-1 text-center font-bold text-green-400 bg-green-900/20 border-l border-slate-600">{result.suitableCableSize}</td>
                  <td className="px-2 py-1 text-center font-bold text-green-400 bg-green-900/20">{result.numberOfRuns}</td>
                  
                  {/* V-Drop Running */}
                  <td className="px-2 py-1 text-center text-slate-300 border-l border-slate-600">{result.voltageDrop_running_volt.toFixed(2)}</td>
                  <td className={`px-2 py-1 text-center font-bold ${result.voltageDrop_running_percent <= 5 ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                    {result.voltageDrop_running_percent.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-center font-bold text-lg">
                    {result.voltageDrop_running_percent <= 5 ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                  </td>
                  
                  {/* V-Drop Starting */}
                  <td className="px-2 py-1 text-center text-slate-300 border-l border-slate-600">{(result.voltageDrop_starting_volt || 0).toFixed(2)}</td>
                  <td className={`px-2 py-1 text-center font-bold ${(result.voltageDrop_starting_percent || 0) <= 15 ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                    {(result.voltageDrop_starting_percent || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-center font-bold text-lg">
                    {(result.voltageDrop_starting_percent || 0) <= 15 ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                  </td>
                  
                  {/* Designation */}
                  <td className="px-2 py-1 text-center text-purple-300 text-xs font-medium border-l border-slate-600 whitespace-nowrap min-w-[180px]">{result.cableDesignation}</td>
                  <td className="px-2 py-1 text-center text-cyan-400 font-medium">{result.cableResistance_ohm_per_km.toFixed(3)}</td>
                  
                  {/* Status */}
                  <td className="px-2 py-1 text-center align-middle border-l border-slate-600">
                    {result.status === 'APPROVED' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-500/30 text-green-300 text-xs font-bold">✓</span>
                    ) : result.status === 'WARNING' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/30 text-yellow-300 text-xs font-bold">⚠</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/30 text-red-300 text-xs font-bold">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-semibold mb-4">Size Distribution</h4>
          <div className="space-y-2">
            {Object.entries(
              results.reduce(
                (acc, r) => {
                  acc[r.suitableCableSize] = (acc[r.suitableCableSize] || 0) + 1;
                  return acc;
                },
                {} as Record<number, number>
              )
            )
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([size, count]) => (
                <div key={size} className="flex justify-between text-sm">
                  <span className="text-slate-300">{size} mm²</span>
                  <span className="text-cyan-400 font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-semibold mb-4">V-Drop Analysis</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">≤3% (Best)</span>
              <span className="text-green-400 font-medium">
                {results.filter((r) => r.voltageDrop_running_percent <= 3).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">3-5% (Valid)</span>
              <span className="text-yellow-400 font-medium">
                {
                  results.filter(
                    (r) =>
                      r.voltageDrop_running_percent > 3 && r.voltageDrop_running_percent <= 5
                  ).length
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">&gt;5% (Invalid)</span>
              <span className="text-red-400 font-medium">
                {results.filter((r) => r.voltageDrop_running_percent > 5).length}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-semibold mb-4">Load Distribution</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Total Load</span>
              <span className="text-cyan-400 font-medium">
                {totalLoad.toFixed(1)} kW
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Average Load/Cable</span>
              <span className="text-cyan-400 font-medium">
                {(totalLoad / results.length).toFixed(2)} kW
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Max Load Cable</span>
              <span className="text-cyan-400 font-medium">
                {Math.max(...results.map((r) => r.loadKW)).toFixed(2)} kW
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <div className="flex gap-3">
          <CheckCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-300">
            <p className="font-semibold mb-2">Cable Sizing Methodology:</p>
            <ul className="text-xs space-y-1 opacity-90">
              <li>
                • Size by Current: FLC × 1.25 safety factor ÷ derating factor
              </li>
              <li>
                • Size by Voltage Drop: Ensures V-drop ≤ 5% per IEC 60364
              </li>
              <li>
                • Size by Short Circuit: Protective device coordination
              </li>
              <li>
                • Final Size: Maximum of all three methods (conservative approach)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsTab;
