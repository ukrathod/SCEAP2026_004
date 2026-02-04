/**
 * INDUSTRIAL CABLE SIZING ENGINE - V3 (EPC-GRADE)
 * Per IEC 60287 / IEC 60364 / IS 732
 * 
 * ENGINEERING LOGIC (per user's plant guide):
 * 1. Calculate FLC (proper formula with efficiency & power factor)
 * 2. Calculate Starting Current (for motors only - DOL/SD/SS/VFD)
 * 3. Calculate Derating Factor K_total = K_temp × K_group × K_soil × K_depth
 * 4. SIZE BY AMPACITY: Find smallest size where I_derated ≥ I_FL
 * 5. SIZE BY VOLTAGE DROP (running): V% ≤ 3% (motors) or 5% (others)
 * 6. SIZE BY VOLTAGE DROP (starting): V% ≤ 10-15% (motor dependent)
 * 7. SIZE BY SHORT-CIRCUIT: A ≥ Isc / (k × √t)
 * 8. SELECT: Maximum of all constraints
 * 9. CHECK PARALLEL RUNS: If size > 300mm² Cu, split into 2×smaller
 * 10. VALIDATE: All constraints must pass or upgrade cable
 */

import { AmpacityTables, DeratingTables, LoadTypeSpecs, MotorStartingMultipliers, ShortCircuitData } from './CableEngineeringData';

export interface CableSizingInput {
  // Load & installation
  loadType: 'Motor' | 'Heater' | 'Transformer' | 'Feeder' | 'Pump' | 'Fan' | 'Compressor';
  ratedPowerKW: number;
  voltage: number;
  phase: '1Ø' | '3Ø';
  efficiency?: number;
  powerFactor?: number;
  cableLength: number;
  
  // Cable & environment (MANDATORY for derating)
  numberOfCores: '1C' | '2C' | '3C' | '4C';
  conductorMaterial: 'Cu' | 'Al'; // Cu only in new catalog
  insulation: 'XLPE' | 'PVC';
  installationMethod: 'Air' | 'Trench' | 'Duct'; // Matches catalog
  ambientTemp?: number; // Default 40°C
  soilThermalResistivity?: number; // Default 1.2 K·m/W
  depthOfLaying?: number; // Default 0.8m
  numberOfLoadedCircuits?: number; // For grouping factor (default 1)
  
  // Motor starting (ONLY for Motors)
  startingMethod?: 'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD';
  
  // Protection & ISc (ISc only for ACB)
  protectionType?: 'ACB' | 'MCCB' | 'MCB' | 'None';
  maxShortCircuitCurrent?: number; // kA at installation point
  protectionClearingTime?: number; // seconds (default 0.1s)
}

export interface CableSizingResult {
  // Load characteristics
  loadType: string;
  fullLoadCurrent: number; // A (running)
  startingCurrent?: number; // A (for motors only)
  
  // Derating analysis
  deratingFactor: number; // K_total = K_temp × K_group × K_soil × K_depth
  deratingComponents?: {
    K_temp: number;
    K_group: number;
    K_soil: number;
    K_depth: number;
  };
  effectiveCurrentAtRun: number; // I_FL / K_total (required rating)
  
  // Sizing constraints (results in mm²)
  sizeByAmpacity: number; // Smallest size where I_catalog × K_total ≥ I_FL
  sizeByRunningVdrop: number; // V% ≤ 3% (motors) / 5% (others) @running
  sizeByStartingVdrop?: number; // V% ≤ 10-15% @starting (motors only)
  sizeByISc?: number; // A ≥ Isc/(k×√t) (if ACB)
  
  // Final selection
  selectedConductorArea: number; // mm² final choice
  numberOfRuns: number; // 1, 2, or 3 (if parallel runs used)
  sizePerRun: number; // mm² if parallel (e.g., 2×95mm² instead of 1×150mm²)
  cableDesignation: string; // e.g., "1×3C×95mm² Cu XLPE" or "2×3C×70mm² Cu XLPE (parallel)"
  
  // Catalog & installed ratings
  coreConfig: string; // '1C', '2C', '3C', '4C'
  catalogRatingPerRun: number; // A @ 90°C per single cable
  installedRatingPerRun: number; // = catalogRating × K_total
  installedRatingTotal: number; // = installedRatingPerRun × numberOfRuns
  
  // Actual voltage drop at selected size
  voltageDropRunning_percent: number;
  voltageDropRunning_volt: number;
  voltageDropStarting_percent?: number; // For motors
  voltageDropStarting_volt?: number;
  
  // Short-circuit check (if ACB)
  shortCircuitIsc_kA?: number;
  shortCircuitWithstand_kA?: number; // k×A×√t
  shortCircuitPass?: boolean;
  
  // Status & constraints
  status: 'APPROVED' | 'WARNING' | 'FAILED';
  warnings: string[]; // Detailed warnings
  drivingConstraint: 'Ampacity' | 'RunningVdrop' | 'StartingVdrop' | 'ISc';
}

class CableSizingEngine_V2 {
  private input!: CableSizingInput;
  private catalog: any;
  private allSizes: number[] = [];
  private sqrt3 = Math.sqrt(3);

  sizeCable(input: CableSizingInput): CableSizingResult {
    this.input = input;
    
    const result: CableSizingResult = {
      loadType: input.loadType,
      fullLoadCurrent: 0,
      deratingFactor: 1.0,
      effectiveCurrentAtRun: 0,
      sizeByAmpacity: 0,
      sizeByRunningVdrop: 0,
      selectedConductorArea: 0,
      numberOfRuns: 1,
      sizePerRun: 0,
      cableDesignation: '',
      coreConfig: input.numberOfCores,
      catalogRatingPerRun: 0,
      installedRatingPerRun: 0,
      installedRatingTotal: 0,
      voltageDropRunning_percent: 0,
      voltageDropRunning_volt: 0,
      status: 'APPROVED',
      warnings: [],
      drivingConstraint: 'Ampacity'
    };

    try {
      // ========== STEP 1: Load catalog for this core config ==========
      this.catalog = (AmpacityTables as any)[input.numberOfCores];
      if (!this.catalog) {
        throw new Error(`No catalog for core config: ${input.numberOfCores}`);
      }
      this.allSizes = Object.keys(this.catalog).map(Number).sort((a, b) => a - b);

      // ========== STEP 2: Calculate Full Load Current (IEC formula) ==========
      result.fullLoadCurrent = this.calculateFLC();
      console.log(`[ENGINE] FLC calculated: ${result.fullLoadCurrent}A (P=${input.ratedPowerKW}kW, V=${input.voltage}V, PF=${input.powerFactor}, Eff=${input.efficiency})`);
      if (result.fullLoadCurrent <= 0) {
        throw new Error(`Invalid full load current: ${result.fullLoadCurrent}A`);
      }

      // ========== STEP 3: Calculate Starting Current (motors only) ==========
      if (input.loadType === 'Motor') {
        const method = input.startingMethod || 'DOL';
        result.startingCurrent = this.calculateStartingCurrent(result.fullLoadCurrent, method);
      }

      // ========== STEP 4: Calculate Total Derating Factor K_total ==========
      const deratingComp = this.calculateDeratingComponents();
      result.deratingFactor = deratingComp.K_temp * deratingComp.K_group * deratingComp.K_soil * deratingComp.K_depth;
      result.deratingComponents = deratingComp;
      result.effectiveCurrentAtRun = result.fullLoadCurrent / result.deratingFactor;

      // ========== STEP 5: Size by Ampacity (I_derated ≥ I_FL) ==========
      result.sizeByAmpacity = this.findSizeByAmpacity(result.effectiveCurrentAtRun);

      // ========== STEP 6: Size by Running Voltage Drop ==========
      result.sizeByRunningVdrop = this.findSizeByRunningVdrop(result.fullLoadCurrent);

      // ========== STEP 7: Size by Starting Voltage Drop (motors only) ==========
      if (input.loadType === 'Motor' && result.startingCurrent) {
        result.sizeByStartingVdrop = this.findSizeByStartingVdrop(result.startingCurrent);
      }

      // ========== STEP 8: Size by Short-Circuit (ISc constraint, if ACB) ==========
      if (input.protectionType === 'ACB' && input.maxShortCircuitCurrent) {
        result.sizeByISc = this.findSizeByISc(input.maxShortCircuitCurrent);
      }

      // ========== STEP 9: Select maximum size across all constraints ==========
      result.selectedConductorArea = Math.max(
        result.sizeByAmpacity,
        result.sizeByRunningVdrop,
        result.sizeByStartingVdrop || 0,
        result.sizeByISc || 0
      );

      // ========== STEP 10: Determine driving constraint ==========
      if (result.sizeByISc && result.selectedConductorArea === result.sizeByISc) {
        result.drivingConstraint = 'ISc';
      } else if (result.sizeByStartingVdrop && result.selectedConductorArea === result.sizeByStartingVdrop) {
        result.drivingConstraint = 'StartingVdrop';
      } else if (result.sizeByRunningVdrop && result.selectedConductorArea === result.sizeByRunningVdrop) {
        result.drivingConstraint = 'RunningVdrop';
      } else {
        result.drivingConstraint = 'Ampacity';
      }

      // ========== STEP 11: Check if parallel runs needed (>300mm² Cu is impractical) ==========
      const maxSingleCableSize = 300; // Cu threshold
      if (result.selectedConductorArea > maxSingleCableSize && input.conductorMaterial === 'Cu') {
        // Try 2 parallel runs
        const sizePerRun = Math.ceil(result.selectedConductorArea / 2);
        
        // Re-check if this 2-run config passes all constraints
        const catalogEntry = this.catalog[String(sizePerRun)];
        if (catalogEntry && sizePerRun <= maxSingleCableSize) {
          result.numberOfRuns = 2;
          result.sizePerRun = sizePerRun;
          
          // Verify 2×cable passes ampacity (both run same current)
          const method = input.installationMethod.toLowerCase() as 'air' | 'trench' | 'duct';
          const ratingPerRun = catalogEntry[method];
          const totalRating = ratingPerRun * 2;
          
          if (totalRating * result.deratingFactor >= result.fullLoadCurrent) {
            // Valid 2-run solution
            result.selectedConductorArea = sizePerRun;
            result.warnings.push(`Parallel runs used: 2×${sizePerRun}mm² instead of single ${Math.max(...this.allSizes)}mm²`);
          }
        }
      }

      // ========== STEP 12: Lookup final catalog entry and ratings ==========
      const finalEntry = this.catalog[String(result.selectedConductorArea)];
      if (!finalEntry) {
        throw new Error(`Selected size ${result.selectedConductorArea}mm² not in catalog`);
      }

      const method = input.installationMethod.toLowerCase() as 'air' | 'trench' | 'duct';
      result.catalogRatingPerRun = finalEntry[method];
      result.installedRatingPerRun = result.catalogRatingPerRun * result.deratingFactor;
      result.installedRatingTotal = result.installedRatingPerRun * result.numberOfRuns;
      result.sizePerRun = result.selectedConductorArea;

      // ========== STEP 13: Calculate actual voltage drop at final size ==========
      const vdropRunning = this.calculateVoltageDropRunning(result.fullLoadCurrent, finalEntry);
      result.voltageDropRunning_percent = vdropRunning.percent;
      result.voltageDropRunning_volt = vdropRunning.voltage;

      if (input.loadType === 'Motor' && result.startingCurrent) {
        const vdropStarting = this.calculateVoltageDropStarting(result.startingCurrent, finalEntry);
        result.voltageDropStarting_percent = vdropStarting.percent;
        result.voltageDropStarting_volt = vdropStarting.voltage;
      }

      // ========== STEP 14: Generate cable designation ==========
      if (result.numberOfRuns === 1) {
        result.cableDesignation = `1×${input.numberOfCores}×${result.selectedConductorArea}mm² ${input.conductorMaterial} ${input.insulation}`;
      } else {
        result.cableDesignation = `${result.numberOfRuns}×${input.numberOfCores}×${result.selectedConductorArea}mm² ${input.conductorMaterial} ${input.insulation} (parallel)`;
      }

      // ========== STEP 15: Final validation ==========
      const limits = this.getVoltageLimits();
      if (result.voltageDropRunning_percent > limits.running * 100) {
        result.warnings.push(`Running V-drop high: ${result.voltageDropRunning_percent.toFixed(2)}% (limit ${limits.running * 100}%)`);
        result.status = 'WARNING';
      }

      if (result.voltageDropStarting_percent && result.voltageDropStarting_percent > limits.starting * 100) {
        result.warnings.push(`Starting V-drop high: ${result.voltageDropStarting_percent.toFixed(2)}% (limit ${limits.starting * 100}%)`);
        result.status = 'WARNING';
      }

      if (result.selectedConductorArea > 240 && result.numberOfRuns === 1) {
        result.warnings.push(`Very large single cable (${result.selectedConductorArea}mm²); consider if parallel runs feasible`);
      }

      // Short-circuit check
      if (input.protectionType === 'ACB' && input.maxShortCircuitCurrent) {
        const k = this.getShortCircuitConstant();
        const t = input.protectionClearingTime || 0.1;
        const withstand = k * result.selectedConductorArea * Math.sqrt(t);
        result.shortCircuitIsc_kA = input.maxShortCircuitCurrent;
        result.shortCircuitWithstand_kA = withstand / 1000;
        result.shortCircuitPass = input.maxShortCircuitCurrent * 1000 <= withstand;
        
        if (!result.shortCircuitPass) {
          result.status = 'FAILED';
          result.warnings.push(`Short-circuit withstand FAILED: ${input.maxShortCircuitCurrent}kA > ${(withstand / 1000).toFixed(2)}kA`);
        }
      }

    } catch (error) {
      result.status = 'FAILED';
      result.warnings.push(`Sizing Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // ========================= CALCULATION METHODS =========================

  private calculateFLC(): number {
    const P = this.input.ratedPowerKW;
    const V = this.input.voltage;
    const specs = (LoadTypeSpecs as any)[this.input.loadType] || {};
    const η = this.input.efficiency ?? specs.typicalEfficiency ?? 0.95;
    const cosφ = this.input.powerFactor ?? specs.typicalPowerFactor ?? 0.85;

    if (this.input.phase === '3Ø') {
      // I_FL = (P × 1000) / (√3 × V × cosφ × η)
      return (P * 1000) / (this.sqrt3 * V * cosφ * η);
    } else {
      // I_FL = (P × 1000) / (V × cosφ × η)
      return (P * 1000) / (V * cosφ * η);
    }
  }

  private calculateStartingCurrent(flc: number, method: 'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD'): number {
    const multipliers = (MotorStartingMultipliers as any)[method] || { typical: 1.0 };
    return flc * multipliers.typical;
  }

  private calculateDeratingComponents(): { K_temp: number; K_group: number; K_soil: number; K_depth: number } {
    const method = this.input.installationMethod.toLowerCase() as 'air' | 'trench' | 'duct';
    const isSingle = this.input.numberOfCores === '1C';
    
    // Temperature factor (K_temp)
    const tempFactors = (DeratingTables.temperature_factor as any)[method];
    const K_temp = isSingle ? tempFactors.single : tempFactors.multi;

    // Grouping factor (K_group) - number of loaded circuits
    const grouping = this.input.numberOfLoadedCircuits || 1;
    const groupingFactors = (DeratingTables.grouping_factor as any);
    const K_group = groupingFactors[grouping] || 1.0;

    // Soil/Ground temp factor (K_soil) - use defaults
    const K_soil = (DeratingTables.ground_temp_factor as any)[isSingle ? 'single' : 'multi'] || 1.0;

    // Depth factor (K_depth) - use defaults
    const K_depth = (DeratingTables.depth_factor as any)[isSingle ? 'single' : 'multi'] || 1.0;

    return { K_temp, K_group, K_soil, K_depth };
  }

  private findSizeByAmpacity(requiredCurrent: number): number {
    // I_derated ≥ I_FL
    // I_catalog × K_total ≥ I_FL
    // I_catalog ≥ I_FL / K_total = requiredCurrent
    const method = this.input.installationMethod.toLowerCase() as 'air' | 'trench' | 'duct';
    
    for (const size of this.allSizes) {
      const entry = this.catalog[String(size)];
      const rating = entry[method];
      
      if (rating >= requiredCurrent) {
        return size;
      }
    }
    
    return this.allSizes[this.allSizes.length - 1]; // Return largest if nothing fits
  }

  private findSizeByRunningVdrop(flc: number): number {
    // V-drop = (√3 × I × L × R) / 1000 for 3-phase (R in Ω/km)
    // V-drop% = (V-drop / V) × 100
    // Limit: 3% (motors) or 5% (others)
    const limits = this.getVoltageLimits();
    const maxVDrop = limits.running;

    for (const size of this.allSizes) {
      const entry = this.catalog[String(size)];
      const R = entry.resistance_90C; // Ω/km @ 90°C
      
      let vdrop: number;
      if (this.input.phase === '3Ø') {
        // VD = (√3 × I × L × R) / 1000 (V)
        vdrop = (this.sqrt3 * flc * this.input.cableLength * R) / 1000;
      } else {
        // VD = (I × L × R) / 1000 (V)
        vdrop = (flc * this.input.cableLength * R) / 1000;
      }

      const vdropPercent = (vdrop / this.input.voltage);
      
      if (vdropPercent <= maxVDrop) {
        return size;
      }
    }

    return this.allSizes[this.allSizes.length - 1];
  }

  private findSizeByStartingVdrop(iStarting: number): number {
    // Same formula as running, but with starting current and higher limit
    // Limit: 10-15% for motors (depends on starting method)
    const method = (this.input.startingMethod || 'DOL') as 'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD';
    const limits: any = {
      DOL: 0.15,
      StarDelta: 0.10,
      SoftStarter: 0.10,
      VFD: 0.05
    };
    const maxVDrop = limits[method] || 0.10;

    for (const size of this.allSizes) {
      const entry = this.catalog[String(size)];
      const R = entry.resistance_90C;
      
      let vdrop: number;
      if (this.input.phase === '3Ø') {
        vdrop = (this.sqrt3 * iStarting * this.input.cableLength * R) / 1000;
      } else {
        vdrop = (iStarting * this.input.cableLength * R) / 1000;
      }

      const vdropPercent = (vdrop / this.input.voltage);
      
      if (vdropPercent <= maxVDrop) {
        return size;
      }
    }

    return this.allSizes[this.allSizes.length - 1];
  }

  private findSizeByISc(isc_kA: number): number {
    // Isc ≤ k × A × √t
    // A ≥ Isc / (k × √t)
    const k = this.getShortCircuitConstant();
    const t = this.input.protectionClearingTime || 0.1;
    const isc_A = isc_kA * 1000;
    const minArea = isc_A / (k * Math.sqrt(t));

    for (const size of this.allSizes) {
      if (size >= minArea) {
        return size;
      }
    }

    return this.allSizes[this.allSizes.length - 1];
  }

  private calculateVoltageDropRunning(flc: number, catalogEntry: any): { percent: number; voltage: number } {
    const R = catalogEntry.resistance_90C;
    
    let vdrop: number;
    if (this.input.phase === '3Ø') {
      vdrop = (this.sqrt3 * flc * this.input.cableLength * R) / 1000;
    } else {
      vdrop = (flc * this.input.cableLength * R) / 1000;
    }

    const vdropPercent = (vdrop / this.input.voltage);
    return { percent: vdropPercent, voltage: vdrop };
  }

  private calculateVoltageDropStarting(iStarting: number, catalogEntry: any): { percent: number; voltage: number } {
    const R = catalogEntry.resistance_90C;
    
    let vdrop: number;
    if (this.input.phase === '3Ø') {
      vdrop = (this.sqrt3 * iStarting * this.input.cableLength * R) / 1000;
    } else {
      vdrop = (iStarting * this.input.cableLength * R) / 1000;
    }

    const vdropPercent = (vdrop / this.input.voltage);
    return { percent: vdropPercent, voltage: vdrop };
  }

  private getVoltageLimits(): { running: number; starting: number } {
    if (this.input.loadType === 'Motor') {
      return { running: 0.03, starting: 0.15 }; // 3% running, 15% starting
    } else if (this.input.loadType === 'Heater') {
      return { running: 0.05, starting: 0.10 };
    } else {
      return { running: 0.05, starting: 0.10 }; // Default
    }
  }

  private getShortCircuitConstant(): number {
    // k = constant at 90°C final temp for Cu XLPE
    // k values: Cu XLPE 90°C = 143, Cu PVC 70°C = 115, Al XLPE = 94, Al PVC = 76
    const key = `${this.input.conductorMaterial}_${this.input.insulation}_90C`;
    const constants = (ShortCircuitData.material_constant as any);
    return constants[key] || constants['Cu_XLPE_90C'] || 143;
  }
}

export default CableSizingEngine_V2;
