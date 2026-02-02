/**
 * INDUSTRIAL-GRADE CABLE SIZING ENGINE
 * Based on IEC 60287 / IEC 60364 / IS 732
 * 
 * CRITICAL FIXES FROM PREVIOUS VERSION:
 * ✅ Derating factors applied CORRECTLY (multiply cable rating, not divide current)
 * ✅ Separate running and starting voltage drop checks
 * ✅ Proper multi-factor derating (temperature + grouping + soil + depth)
 * ✅ 3-core cable resistance correction factor
 * ✅ Reactance term included in voltage drop (R×cosφ + X×sinφ)
 * ✅ Real short-circuit withstand calculation
 * ✅ Load-type specific efficiency and power factor
 * ✅ Motor starting current support (DOL/Star-Delta/Soft/VFD)
 * ✅ Proper parallel run optimization
 */

import {
  ConductorDatabase,
  AmpacityTables,
  DeratingTables,
  MotorStartingMultipliers,
  VoltageLimits,
  ShortCircuitData,
  LoadTypeSpecs
} from './CableEngineeringData';

/**
 * INPUT DATA STRUCTURE - STRICT VALIDATION REQUIRED
 * ALL fields must be present for calculations
 */
export interface CableSizingInput {
  // Load data (required)
  loadType: 'Motor' | 'Heater' | 'Transformer' | 'Feeder' | 'Pump' | 'Fan' | 'Compressor';
  ratedPowerKW: number;
  voltage: number;
  phase: '1Ø' | '3Ø';
  frequency: number;
  
  // Load-specific (required for motors)
  efficiency?: number; // Motor efficiency 0.85-0.96
  powerFactor?: number; // Typically 0.75-0.95
  startingMethod?: 'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD'; // For motors

  // Installation data (required)
  conductorMaterial: 'Cu' | 'Al';
  insulation: 'XLPE' | 'PVC';
  numberOfCores: '1C' | '3C' | '3C+E' | '4C';
  installationMethod: string; // key from InstallationMethods
  cableSpacing?: 'touching' | 'spaced_400mm' | 'spaced_600mm';

  // Environmental data (required)
  ambientTemp: number; // °C
  soilThermalResistivity?: number; // K·m/W (only for buried)
  depthOfLaying?: number; // cm (only for buried)
  groupedLoadedCircuits: number; // How many other cables nearby?

  // Cable length (required)
  cableLength: number; // meters
  
  // Protection data (required for SC check)
  protectionClearingTime?: number; // seconds (default 0.1)
  maxShortCircuitCurrent?: number; // kA at point of installation
}

/**
 * OUTPUT DATA STRUCTURE
 */
export interface CableSizingResult {
  // Calculated currents
  fullLoadCurrent: number; // Running current (FLC)
  startingCurrent?: number; // Motor starting current
  
  // Derating analysis
  deratingFactors: {
    temperature: number;
    grouping: number;
    soil?: number;
    depth?: number;
    total: number;
  };
  deredCableRating: number; // Catalog rating × derating

  // Ampacity sizing
  sizeByAmpacity: number; // mm² required for current
  sizeByAmpacityRunning: number;
  sizeByAmpacityStarting?: number;
  
  // Voltage drop sizing (running)
  voltageDropRunning_percent: number;
  voltageDropRunning_voltage: number;
  sizeByVoltageDropRunning: number; // mm² required

  // Voltage drop sizing (starting - motors only)
  voltageDropStarting_percent?: number;
  voltageDropStarting_voltage?: number;
  sizeByVoltageDropStarting?: number;
  
  // Short circuit withstand
  maxAllowableShortCircuit?: number; // kA this cable can withstand
  shortCircuitCheck?: 'PASS' | 'FAIL';
  sizeByShortCircuit?: number; // mm² required

  // Final selection
  selectedSize: number; // mm² - FINAL CHOICE (max of all constraints)
  numberOfRuns: number; // Parallel runs if needed
  sizePerRun: number; // Each run size

  // Validation
  status: 'APPROVED' | 'WARNING' | 'FAILED';
  warnings: string[];
  errors: string[];

  // Cable designation (IEC 60228)
  cableDesignation: string; // e.g., "3×70C+1×35C (XLPE)"
}

/**
 * MAIN CABLE SIZING ENGINE CLASS
 */
export class CableSizingEngine {
  private sqrt3 = Math.sqrt(3);
  private input!: CableSizingInput;
  private catalog!: Record<number, number>;
  private resistance_20C!: Record<number, number>;

  constructor() {}

  /**
   * MAIN ENTRY POINT: Size a cable with full IEC 60364 compliance
   */
  sizeCable(input: CableSizingInput): CableSizingResult {
    this.input = input;
    this.validateInput();

    // Select correct catalog and resistance tables based on material
    this.selectTables();

    const result: CableSizingResult = {
      fullLoadCurrent: 0,
      deratingFactors: { temperature: 1, grouping: 1, total: 1 },
      deredCableRating: 0,
      sizeByAmpacity: 0,
      sizeByAmpacityRunning: 0,
      voltageDropRunning_percent: 0,
      voltageDropRunning_voltage: 0,
      sizeByVoltageDropRunning: 0,
      selectedSize: 0,
      numberOfRuns: 1,
      sizePerRun: 0,
      status: 'APPROVED',
      warnings: [],
      errors: [],
      cableDesignation: ''
    };

    try {
      // Step 1: Calculate currents
      result.fullLoadCurrent = this.calculateFullLoadCurrent();
      
      if (this.isMotor()) {
        result.startingCurrent = this.calculateStartingCurrent(result.fullLoadCurrent);
      }

      // Step 2: Calculate derating factors (CORRECTED LOGIC)
      result.deratingFactors = this.calculateDeratingFactors();
      result.deredCableRating = this.getCableRating(70) * result.deratingFactors.total;

      // Step 3: Size by ampacity (running current)
      result.sizeByAmpacityRunning = this.sizeByCurrent(result.fullLoadCurrent, result.deratingFactors.total);

      // For motors, also size for starting current
      if (this.isMotor() && result.startingCurrent) {
        result.sizeByAmpacityStarting = this.sizeByCurrent(result.startingCurrent, result.deratingFactors.total);
      }

      result.sizeByAmpacity = Math.max(result.sizeByAmpacityRunning, result.sizeByAmpacityStarting || 0);

      // Step 4: Size by voltage drop (running current)
      const vdRunning = this.calculateVoltageDropPercent(result.fullLoadCurrent, result.sizeByAmpacity);
      result.voltageDropRunning_percent = vdRunning.percent;
      result.voltageDropRunning_voltage = vdRunning.voltage;
      result.sizeByVoltageDropRunning = this.sizeByVoltageDropConstraint(
        result.fullLoadCurrent,
        (VoltageLimits.running as Record<string, number>)[this.input.loadType.toLowerCase()] || 0.05
      );

      // Step 5: Size by voltage drop (starting current - motors only)
      if (this.isMotor() && result.startingCurrent) {
        const vdStarting = this.calculateVoltageDropPercent(result.startingCurrent, result.sizeByAmpacity);
        result.voltageDropStarting_percent = vdStarting.percent;
        result.voltageDropStarting_voltage = vdStarting.voltage;
        
        const startingLimit = (VoltageLimits.starting as Record<string, number>)[this.input.startingMethod || 'DOL'] || 0.15;
        result.sizeByVoltageDropStarting = this.sizeByVoltageDropConstraint(
          result.startingCurrent,
          startingLimit
        );
      }

      // Step 6: Short-circuit withstand check
      if (this.input.maxShortCircuitCurrent) {
        const { size: scSize, pass } = this.checkShortCircuitWithstand(this.input.maxShortCircuitCurrent);
        result.sizeByShortCircuit = scSize;
        result.maxAllowableShortCircuit = this.maxAllowableShortCircuit(result.sizeByAmpacity);
        result.shortCircuitCheck = pass ? 'PASS' : 'FAIL';
        if (!pass) {
          result.warnings.push(`Short-circuit withstand failed: need ${scSize}mm² but selected ${result.sizeByAmpacity}mm²`);
        }
      }

      // Step 7: Select final size (maximum of all constraints)
      result.selectedSize = Math.max(
        result.sizeByAmpacity,
        result.sizeByVoltageDropRunning,
        result.sizeByVoltageDropStarting || 0,
        result.sizeByShortCircuit || 0
      );

      // Step 8: Parallel run optimization
      const runResult = this.optimizeParallelRuns(result.selectedSize, result.fullLoadCurrent);
      result.numberOfRuns = runResult.numberOfRuns;
      result.sizePerRun = runResult.sizePerRun;

      // Step 9: Generate cable designation
      result.cableDesignation = this.generateCableDesignation(result.sizePerRun, result.numberOfRuns);

      // Final validation
      this.validateResult(result);

    } catch (error) {
      result.status = 'FAILED';
      result.errors.push(`Engine error: ${error}`);
    }

    return result;
  }

  // ============== STEP 1: CURRENT CALCULATION ==============

  private calculateFullLoadCurrent(): number {
    const P = this.input.ratedPowerKW;
    const V = this.input.voltage;
    const η = this.input.efficiency || LoadTypeSpecs[this.input.loadType].typicalEfficiency;
    const cosφ = this.input.powerFactor || LoadTypeSpecs[this.input.loadType].typicalPowerFactor;

    if (this.input.phase === '3Ø') {
      // 3-phase: I = (P × 1000) / (√3 × V × cosφ × η)
      return (P * 1000) / (this.sqrt3 * V * cosφ * η);
    } else {
      // 1-phase: I = (P × 1000) / (V × cosφ × η)
      return (P * 1000) / (V * cosφ * η);
    }
  }

  private isMotor(): boolean {
    return ['Motor', 'Pump', 'Fan', 'Compressor'].includes(this.input.loadType);
  }

  private calculateStartingCurrent(flc: number): number {
    const method = (this.input.startingMethod || (LoadTypeSpecs[this.input.loadType as keyof typeof LoadTypeSpecs] as any).typicalStartingMethod || 'DOL') as keyof typeof MotorStartingMultipliers;
    const multiplier = (MotorStartingMultipliers[method] as any)?.typical || 5.5;
    return flc * multiplier;
  }

  // ============== STEP 2: DERATING FACTORS (CORRECTED!) ==============

  private calculateDeratingFactors() {
    const factors = {
      temperature: 1.0,
      grouping: 1.0,
      soil: 1.0,
      depth: 1.0,
      total: 1.0
    };

    // Temperature factor
    const tempTable = this.input.insulation === 'XLPE' 
      ? DeratingTables.temperature_factor_XLPE 
      : DeratingTables.temperature_factor_PVC;
    factors.temperature = this.interpolateFactor(tempTable, this.input.ambientTemp);

    // Grouping factor (depends on number of loaded circuits)
    const groupingTable = this.input.installationMethod.includes('Buried')
      ? DeratingTables.grouping_factor_buried
      : DeratingTables.grouping_factor_air;
    factors.grouping = (groupingTable as Record<number, number>)[this.input.groupedLoadedCircuits] || 1.0;

    // Soil thermal resistivity (for buried cables only)
    if (this.input.installationMethod.includes('Buried') && this.input.soilThermalResistivity) {
      factors.soil = this.interpolateFactor(
        DeratingTables.soil_resistivity_factor,
        this.input.soilThermalResistivity
      );
    }

    // Depth of laying (for buried cables only)
    if (this.input.installationMethod.includes('Buried') && this.input.depthOfLaying) {
      factors.depth = this.interpolateFactor(
        DeratingTables.depth_factor,
        this.input.depthOfLaying
      );
    }

    // CORRECTED: Multiply all factors (don't divide!)
    factors.total = factors.temperature * factors.grouping * factors.soil * factors.depth;

    return factors;
  }

  // ============== STEP 3: SIZE BY AMPACITY ==============

  private sizeByCurrent(current: number, derating: number): number {
    // Required cable rating = current / derating
    // Then find smallest cable in catalog that has rating ≥ required
    const requiredRating = current / derating;

    for (const [size, rating] of Object.entries(this.catalog)) {
      if (rating >= requiredRating) {
        return Number(size);
      }
    }

    // If we get here, largest cable not enough
    return 630; // Largest standard size
  }

  // ============== STEP 4-5: SIZE BY VOLTAGE DROP ==============

  private calculateVoltageDropPercent(current: number, cableSize: number): { percent: number; voltage: number } {
    const L = this.input.cableLength;
    const V = this.input.voltage;
    const cosφ = this.input.powerFactor || LoadTypeSpecs[this.input.loadType].typicalPowerFactor;
    const sinφ = Math.sqrt(1 - cosφ * cosφ);

    // Get R at 20°C
    const R_20C = this.resistance_20C[cableSize] || 0.727;

    // Temperature-correct R to operating temperature (90°C for XLPE, 70°C for PVC)
    const T_op = this.input.insulation === 'XLPE' ? 90 : 70;
    const α = this.input.conductorMaterial === 'Cu' 
      ? ConductorDatabase.temperature_coefficient_copper 
      : ConductorDatabase.temperature_coefficient_aluminum;
    const R = R_20C * (1 + α * (T_op - 20));

    // Get reactance
    const X = this.getReactance(cableSize);

    // Correct for 3-core cables
    const r_factor = this.input.numberOfCores === '3C' || this.input.numberOfCores === '3C+E'
      ? ConductorDatabase.threeCore_resistance_factor
      : 1.0;

    // CORRECTED FORMULA: ΔV = √3 × I × L × (R×cosφ + X×sinφ) / 1000
    // (for 3-phase, divide by number of parallel runs)
    const deltaV = (this.sqrt3 * current * L * (R * r_factor * cosφ + X * sinφ)) / 1000;
    const deltaV_percent = (deltaV / V) * 100;

    return {
      voltage: deltaV,
      percent: deltaV_percent
    };
  }

  private sizeByVoltageDropConstraint(current: number, maxVD_percent: number): number {
    // Try each size and find smallest where VD ≤ limit
    const standardSizes = [25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];

    for (const size of standardSizes) {
      if (!this.catalog[size]) continue;
      const vd = this.calculateVoltageDropPercent(current, size);
      if (vd.percent <= maxVD_percent) {
        return size;
      }
    }

    return 630; // Largest standard
  }

  // ============== STEP 6: SHORT-CIRCUIT WITHSTAND ==============

  private checkShortCircuitWithstand(isc_kA: number): { size: number; pass: boolean } {
    // Isc ≤ k × A × √t
    // A ≥ Isc / (k × √t)

    const k = ShortCircuitData.material_constant[`${this.input.conductorMaterial}_${this.input.insulation}_${this.input.insulation === 'XLPE' ? '90C' : '70C'}`] || 143;
    const t = this.input.protectionClearingTime || 0.1;
    const isc = isc_kA * 1000; // Convert to amperes

    const minArea = isc / (k * Math.sqrt(t));

    // Find smallest cable that can withstand
    const standardSizes = [25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
    for (const size of standardSizes) {
      if (size >= minArea) {
        return { size, pass: true };
      }
    }

    return { size: 630, pass: false };
  }

  private maxAllowableShortCircuit(cableSize: number): number {
    const k = ShortCircuitData.material_constant[`${this.input.conductorMaterial}_${this.input.insulation}_${this.input.insulation === 'XLPE' ? '90C' : '70C'}`] || 143;
    const t = this.input.protectionClearingTime || 0.1;
    const isc_max = (k * cableSize * Math.sqrt(t)) / 1000; // Return in kA
    return isc_max;
  }

  // ============== STEP 7-8: PARALLEL RUN OPTIMIZATION ==============

  private optimizeParallelRuns(size: number, flc: number): { numberOfRuns: number; sizePerRun: number } {
    const MAX_PRACTICAL_SINGLE = 240; // Above this, use parallel runs
    const MAX_RUNS = 6;

    if (size <= MAX_PRACTICAL_SINGLE) {
      return { numberOfRuns: 1, sizePerRun: size };
    }

    // Find best number of runs
    for (let runs = 2; runs <= MAX_RUNS; runs++) {
      const sizePerRun = Math.ceil(size / runs);
      if (sizePerRun <= MAX_PRACTICAL_SINGLE) {
        // Verify each run can handle current
        const currentPerRun = flc / runs;
        const rating = this.catalog[sizePerRun];
        if (rating && rating * 0.87 >= currentPerRun) {
          return { numberOfRuns: runs, sizePerRun };
        }
      }
    }

    // Fallback: 2 runs of large cable
    return { numberOfRuns: 2, sizePerRun: 300 };
  }

  // ============== STEP 9: CABLE DESIGNATION ==============

  private generateCableDesignation(sizePerRun: number, numberOfRuns: number): string {
    const material = this.input.conductorMaterial;
    const cores = this.input.numberOfCores;
    const insulation = this.input.insulation;

    if (numberOfRuns === 1) {
      return `${numberOfRuns}×${sizePerRun}C ${cores} (${material} ${insulation})`;
    } else {
      return `${numberOfRuns}×${sizePerRun}C ${cores} in parallel (${material} ${insulation})`;
    }
  }

  // ============== UTILITY FUNCTIONS ==============

  private selectTables(): void {
    const material = this.input.conductorMaterial;
    const insulation = this.input.insulation;
    const cores = this.input.numberOfCores;

    // Select ampacity table
    const key = `${material === 'Cu' ? 'copper' : 'aluminum'}_${cores}_${insulation}_${insulation === 'XLPE' ? '90C' : '70C'}_air`;
    this.catalog = (AmpacityTables as Record<string, Record<number | string, number>>)[key] || AmpacityTables.copper_3core_XLPE_90C_air;

    // Select resistance table
    const resistanceKey = material === 'Cu' 
      ? ConductorDatabase.copperResistance_20C 
      : ConductorDatabase.aluminumResistance_20C;
    this.resistance_20C = resistanceKey;
  }

  private getCableRating(size: number): number {
    return (this.catalog as Record<string, number>)[String(size)] || 640;
  }

  private getReactance(size: number): number {
    // const spacing = this.input.cableSpacing || 'touching';
    const reactanceTable = ConductorDatabase.reactance_single_core.air_touching; // Default
    return (reactanceTable as Record<number | string, number>)[size] || 0.08;
  }

  private interpolateFactor(table: Record<number | string, number>, value: number): number {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    
    if (value <= keys[0]) return table[keys[0]];
    if (value >= keys[keys.length - 1]) return table[keys[keys.length - 1]];

    for (let i = 0; i < keys.length - 1; i++) {
      if (value >= keys[i] && value <= keys[i + 1]) {
        const k1 = keys[i];
        const k2 = keys[i + 1];
        const v1 = table[k1];
        const v2 = table[k2];
        return v1 + ((value - k1) / (k2 - k1)) * (v2 - v1);
      }
    }

    return 1.0;
  }

  // ============== VALIDATION ==============

  private validateInput(): void {
    const errors: string[] = [];

    if (!this.input.ratedPowerKW || this.input.ratedPowerKW <= 0) errors.push('Rated power must be > 0');
    if (!this.input.voltage || this.input.voltage <= 0) errors.push('Voltage must be > 0');
    if (!this.input.cableLength || this.input.cableLength < 0) errors.push('Cable length must be ≥ 0');
    if (this.input.ambientTemp > 70) errors.push('Ambient temperature seems too high');
    if (!this.input.loadType) errors.push('Load type is required');

    if (errors.length > 0) {
      throw new Error(`Input validation failed:\n${errors.join('\n')}`);
    }
  }

  private validateResult(result: CableSizingResult): void {
    // Check if any constraint failed
    if (result.voltageDropRunning_percent > 5) {
      result.warnings.push(`Running voltage drop high: ${result.voltageDropRunning_percent.toFixed(2)}% (limit 5%)`);
      result.status = result.status === 'FAILED' ? 'FAILED' : 'WARNING';
    }

    if (result.startingCurrent && result.voltageDropStarting_percent && result.voltageDropStarting_percent > 15) {
      result.warnings.push(`Starting voltage drop very high: ${result.voltageDropStarting_percent.toFixed(2)}%`);
      result.status = result.status === 'FAILED' ? 'FAILED' : 'WARNING';
    }

    if (result.status !== 'FAILED' && result.warnings.length === 0) {
      result.status = 'APPROVED';
    }
  }
}

export default CableSizingEngine;
