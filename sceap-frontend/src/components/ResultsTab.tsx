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

// Result type for display - maps engine output to UI fields
interface CableSizingResult {
  // Original cable info
  serialNo: number;
  cableNumber: string;
  feederDescription: string;
  fromBus: string;
  toBus: string;
  loadKW: number;
  voltage: number;
  length: number;
  powerFactor: number;
  efficiency: number;
  deratingFactor: number;
  deratingComponents?: {
    K_temp: number;
    K_group: number;
    K_soil: number;
    K_depth: number;
  };
  conductorMaterial: 'Cu' | 'Al';
  numberOfCores: '1C' | '2C' | '3C' | '4C';
  
  // Load & current calculations
  fullLoadCurrent: number;
  startingCurrent?: number;
  deratedCurrent: number;
  cableResistance_ohm_per_km: number; // From catalogue for selected size (Ω/km)
  
  // Voltage drop values
  voltageDrop_running_volt: number;
  voltageDrop_running_percent: number;
  voltageDrop_starting_volt?: number;
  voltageDrop_starting_percent?: number;
  
  // Cable size constraints
  sizeByCurrent: number; // Size required by ampacity constraint (mm²)
  sizeByVoltageDrop_running: number; // Size required by running V-drop (mm²)
  sizeByVoltageDrop_starting?: number; // Size required by starting V-drop (mm²)
  sizeByShortCircuit: number; // Size required by ISc (mm²)
  
  // Selected cable
  suitableCableSize: number; // Final selected conductor area (mm²)
  numberOfRuns: number; // Number of parallel runs (1, 2, or 3)
  sizePerRun?: number; // If runs > 1, size per individual run
  
  // Cable identification
  cableDesignation: string; // e.g., "3C × 70mm² Cu XLPE" or "2×(3C × 50mm²) Cu XLPE"
  drivingConstraint: 'Ampacity' | 'RunningVdrop' | 'StartingVdrop' | 'ISc';
  
  // Catalog data
  catalogRating: number; // Current rating from catalog at selected size (A)
  
  // ISc check
  shortCircuitCurrent_kA?: number;
  shortCircuitWithstand_kA?: number;
  
  // Status
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
      serialNo: cable.serialNo,
      cableNumber: cable.cableNumber,
      feederDescription: cable.feederDescription,
      fromBus: cable.fromBus,
      toBus: cable.toBus,
      voltage: cable.voltage,
      length: cable.length || 0,
      loadKW: cable.loadKW || 0,
      powerFactor: engineInput.powerFactor || 0.85,
      efficiency: engineInput.efficiency || 0.95,
      deratingFactor: engineResult.deratingFactor || 0.87,
      deratingComponents: engineResult.deratingComponents,
      conductorMaterial: engineInput.conductorMaterial as 'Cu' | 'Al',
      numberOfCores: engineInput.numberOfCores,
      
      // Load & current
      fullLoadCurrent: engineResult.fullLoadCurrent || 0,
      startingCurrent: engineResult.startingCurrent || 0,
      deratedCurrent: engineResult.effectiveCurrentAtRun || 0, // This is I_FL / K_total (required rating)
      cableResistance_ohm_per_km: cableResistance,
      
      // Voltage drop
      voltageDrop_running_volt: engineResult.voltageDropRunning_volt || 0,
      voltageDrop_running_percent: (engineResult.voltageDropRunning_percent || 0) * 100, // Convert to percentage
      voltageDrop_starting_volt: engineResult.voltageDropStarting_volt || 0,
      voltageDrop_starting_percent: (engineResult.voltageDropStarting_percent || 0) * 100,
      
      // Cable size by constraints
      sizeByCurrent: engineResult.sizeByAmpacity || 0,
      sizeByVoltageDrop_running: engineResult.sizeByRunningVdrop || 0,
      sizeByVoltageDrop_starting: engineResult.sizeByStartingVdrop || 0,
      sizeByShortCircuit: engineResult.sizeByISc || 0,
      
      // Selected cable
      suitableCableSize: engineResult.selectedConductorArea || 0,
      numberOfRuns: engineResult.numberOfRuns || 1,
      sizePerRun: engineResult.sizePerRun || engineResult.selectedConductorArea,
      
      // Identification
      cableDesignation: engineResult.cableDesignation || '',
      drivingConstraint: (engineResult.drivingConstraint || 'Ampacity') as any,
      catalogRating: engineResult.catalogRatingPerRun || 0,
      
      // ISc
      shortCircuitCurrent_kA: engineResult.shortCircuitIsc_kA,
      shortCircuitWithstand_kA: engineResult.shortCircuitWithstand_kA,
      
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
      voltage: cable.voltage,
      length: cable.length || 0,
      loadKW: cable.loadKW || 0,
      powerFactor: 0.85,
      efficiency: 0.95,
      deratingFactor: 0.87,
      deratingComponents: { K_temp: 1, K_group: 1, K_soil: 1, K_depth: 1 },
      conductorMaterial: cable.conductorMaterial || 'Cu',
      numberOfCores: '3C',
      fullLoadCurrent: 0,
      deratedCurrent: 0,
      cableResistance_ohm_per_km: 0,
      voltageDrop_running_volt: 0,
      voltageDrop_running_percent: 0,
      sizeByVoltageDrop_running: 0,
      sizeByShortCircuit: 0,
      sizeByCurrent: 0,
      suitableCableSize: 0,
      numberOfRuns: 1,
      cableDesignation: 'ERROR',
      drivingConstraint: 'Ampacity',
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
  const { normalizedFeeders } = usePathContext();
  const [results, setResults] = useState<CableSizingResult[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('results_visible_columns');
      return raw ? JSON.parse(raw) : {
        sizeI: true,
        sizeV: true,
        sizeIsc: true,
        finalSize: true,
        runs: true,
        designation: true,
        breaker: true,
        status: true,
      };
    } catch {
      return {
        sizeI: true,
        sizeV: true,
        sizeIsc: true,
        finalSize: true,
        runs: true,
        designation: true,
        breaker: true,
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

    // Process ALL feeders in input order, not just those in paths
    const allCables: CableSizingResult[] = normalizedFeeders
      .sort((a, b) => a.serialNo - b.serialNo) // Maintain input order by serial number
      .map((cable) => {
        const result = calculateCableSizing(cable);
        const issues = detectAnomalies(cable, result);
        result.anomalies = issues;
        result.isAnomaly = issues.length > 0;
        return result;
      });

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
            <div className="text-sm text-slate-200 font-medium mb-2">Customize Columns</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(visibleColumns).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span className="capitalize">{key}</span>
                </label>
              ))}
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
                <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>S.No</th>
                <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Cable #</th>
                <th className="px-2 py-2 text-left text-slate-200 font-bold" rowSpan={2}>Description</th>
                <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>From Bus</th>
                <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>To Bus</th>
                <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>V(V)</th>
                <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>Load(kW)</th>
                <th className="px-2 py-2 text-center text-slate-200 font-bold" rowSpan={2}>L(m)</th>
                
                {/* DERATING FACTORS - BEFORE FLC */}
                <th colSpan={5} className="px-2 py-2 text-center text-slate-900 font-bold bg-yellow-400 border-l border-slate-500">Derating Factors (IEC)</th>
                
                {/* Section 1: FLC Sizing */}
                <th colSpan={3} className="px-2 py-2 text-center text-white font-bold border-l border-slate-500">1. FLC Sizing</th>
                
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
                <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-yellow-300 border-l border-slate-500">K_tot</th>
                <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-yellow-300">K_t</th>
                <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-yellow-300">K_g</th>
                <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-yellow-300">K_s</th>
                <th className="px-2 py-1 text-center text-slate-900 text-xs font-bold bg-yellow-300">K_d</th>
                
                {/* FLC sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">FLC(A)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">Derated(A)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">Size(mm²)</th>
                
                {/* Cable sizes sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">By Isc</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">By V-Drop(Run)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">By V-Drop(Start)</th>
                
                {/* Selected size sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">Size(mm²)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">Runs</th>
                
                {/* V-drop running sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">ΔU(V)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">%(≤5%)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">OK?</th>
                
                {/* V-drop starting sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">ΔU(V)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">%(≤15%)</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">OK?</th>
                
                {/* Designation sub-headers */}
                <th className="px-2 py-1 text-center text-slate-300 text-xs border-l border-slate-500">Cable Des.</th>
                <th className="px-2 py-1 text-center text-slate-300 text-xs">R(Ω/km)</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-700">
              {results.map((result) => (
                <tr
                  key={`${result.cableNumber}-${result.serialNo}`}
                  className={`hover:bg-slate-700/50 transition-colors ${result.isAnomaly ? 'bg-red-950/20' : ''}`}
                >
                  {/* Identity cells */}
                  <td className="px-2 py-1 text-slate-300">{result.serialNo}</td>
                  <td className="px-2 py-1 text-slate-300 font-medium">{result.cableNumber}</td>
                  <td className="px-2 py-1 text-slate-300 max-w-xs text-xs">{result.feederDescription}</td>
                  <td className="px-2 py-1 text-cyan-400 text-xs font-medium">{result.fromBus}</td>
                  <td className="px-2 py-1 text-cyan-400 text-xs font-medium">{result.toBus}</td>
                  <td className="px-2 py-1 text-center text-slate-300">{result.voltage}</td>
                  <td className="px-2 py-1 text-center text-slate-300">{result.loadKW.toFixed(2)}</td>
                  <td className="px-2 py-1 text-center text-slate-300">{result.length.toFixed(1)}</td>
                  
                  {/* Derating Factors - FIRST */}
                  <td className="px-2 py-1 text-center font-bold bg-yellow-500/20 border-l border-slate-600">{result.deratingFactor.toFixed(3)}</td>
                  <td className="px-2 py-1 text-center text-sm bg-yellow-500/20">{(result.deratingComponents?.K_temp || 1).toFixed(2)}</td>
                  <td className="px-2 py-1 text-center text-sm bg-yellow-500/20">{(result.deratingComponents?.K_group || 1).toFixed(2)}</td>
                  <td className="px-2 py-1 text-center text-sm bg-yellow-500/20">{(result.deratingComponents?.K_soil || 1).toFixed(2)}</td>
                  <td className="px-2 py-1 text-center text-sm bg-yellow-500/20">{(result.deratingComponents?.K_depth || 1).toFixed(2)}</td>
                  
                  {/* FLC Sizing */}
                  <td className="px-2 py-1 text-center text-slate-300 border-l border-slate-600">{result.fullLoadCurrent.toFixed(1)}</td>
                  <td className="px-2 py-1 text-center text-slate-300">{result.deratedCurrent.toFixed(1)}</td>
                  <td className="px-2 py-1 text-center font-bold text-blue-400">{result.sizeByCurrent}</td>
                  
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
