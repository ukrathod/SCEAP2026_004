/**
 * INDUSTRIAL-GRADE CABLE SIZING DATA TABLES
 * Based on IEC 60287 / IEC 60364 / IS 732
 * For thermal power plants, EPCs, and consultancies
 * 
 * These tables are the source of truth for all cable calculations
 * Never hardcode or assume values from outside these tables
 */

/**
 * SECTION 1: CONDUCTOR DATA
 * All conductors at 90°C (XLPE) / 70°C (PVC) per IEC 60228
 */

export const ConductorDatabase = {
  // Copper single-core cable resistance @ 20°C (Ω/km)
  // Will be temperature-corrected to operating temp
  copperResistance_20C: {
    1: 18.51,
    1.5: 12.1,
    2.5: 7.41,
    4: 4.61,
    6: 3.08,
    10: 1.83,
    16: 1.15,
    25: 0.727,
    35: 0.524,
    50: 0.387,
    70: 0.268,
    95: 0.193,
    120: 0.153,
    150: 0.124,
    185: 0.0991,
    240: 0.0754,
    300: 0.0601,
    400: 0.047,
    500: 0.0366,
    630: 0.0283
  },

  // Aluminum single-core cable resistance @ 20°C (Ω/km)
  aluminumResistance_20C: {
    6: 5.15,
    10: 3.08,
    16: 1.91,
    25: 1.2,
    35: 0.868,
    50: 0.64,
    70: 0.443,
    95: 0.32,
    120: 0.253,
    150: 0.206,
    185: 0.164,
    240: 0.125,
    300: 0.1,
    400: 0.077,
    500: 0.0606,
    630: 0.0469
  },

  // Reactance for single-core cables (Ω/km) @ 50Hz
  // Varies by installation method and spacing
  reactance_single_core: {
    // Cables in air, touching
    air_touching: {
      1: 0.095,
      1.5: 0.094,
      2.5: 0.093,
      4: 0.092,
      6: 0.091,
      10: 0.088,
      16: 0.085,
      25: 0.081,
      35: 0.079,
      50: 0.077,
      70: 0.075,
      95: 0.073,
      120: 0.072,
      150: 0.071,
      185: 0.070,
      240: 0.069,
      300: 0.068,
      400: 0.067,
      500: 0.066,
      630: 0.065
    },
    // Cables in air, spaced 400mm
    air_spaced_400mm: {
      1: 0.105,
      1.5: 0.104,
      2.5: 0.103,
      4: 0.102,
      6: 0.101,
      10: 0.098,
      16: 0.095,
      25: 0.091,
      35: 0.089,
      50: 0.087,
      70: 0.085,
      95: 0.083,
      120: 0.082,
      150: 0.081,
      185: 0.080,
      240: 0.079,
      300: 0.078,
      400: 0.077,
      500: 0.076,
      630: 0.075
    },
    // Cables buried, direct in ground
    buried: {
      1: 0.083,
      1.5: 0.082,
      2.5: 0.081,
      4: 0.080,
      6: 0.079,
      10: 0.076,
      16: 0.073,
      25: 0.069,
      35: 0.067,
      50: 0.065,
      70: 0.063,
      95: 0.061,
      120: 0.060,
      150: 0.059,
      185: 0.058,
      240: 0.057,
      300: 0.056,
      400: 0.055,
      500: 0.054,
      630: 0.053
    }
  },

  // 3-core cable resistance adjustment (multiply single-core by factor)
  // 3-core cables have proximity effect increasing resistance
  threeCore_resistance_factor: 1.05, // 5% increase due to proximity

  // Temperature coefficient for resistance
  // R(T) = R(20) × [1 + α × (T - 20)]
  temperature_coefficient_copper: 0.00393, // /°C
  temperature_coefficient_aluminum: 0.00403 // /C
};

/**
 * SECTION 2: CURRENT CARRYING CAPACITY TABLES
 * Based on IEC 60364-5-52 and local standards
 * These are CABLE CATALOG RATINGS (not yet derated)
 */

export const AmpacityTables = {
  // Cu 3-core XLPE cable, 90°C, in air (touching) - IEC standard
  copper_3core_XLPE_90C_air: {
    1: 13,
    1.5: 18,
    2.5: 25,
    4: 33,
    6: 43,
    10: 61,
    16: 80,
    25: 110,
    35: 145,
    50: 180,
    70: 225,
    95: 275,
    120: 320,
    150: 370,
    185: 430,
    240: 530,
    300: 640,
    400: 790,
    500: 930,
    630: 1120
  },

  // Cu 3-core PVC cable, 70°C, in air (touching)
  copper_3core_PVC_70C_air: {
    1: 11,
    1.5: 15,
    2.5: 20,
    4: 27,
    6: 36,
    10: 50,
    16: 65,
    25: 90,
    35: 120,
    50: 150,
    70: 185,
    95: 225,
    120: 260,
    150: 305,
    185: 355,
    240: 435,
    300: 520
  },

  // Al 3-core XLPE cable, 90°C, in air (touching)
  aluminum_3core_XLPE_90C_air: {
    10: 46,
    16: 61,
    25: 84,
    35: 110,
    50: 137,
    70: 170,
    95: 210,
    120: 245,
    150: 285,
    185: 330,
    240: 405,
    300: 490,
    400: 600,
    500: 710,
    630: 850
  },

  // Cu 4-core cable (3-phase + neutral), XLPE, 90°C, in air
  copper_4core_XLPE_90C_air: {
    1: 13,
    1.5: 18,
    2.5: 25,
    4: 33,
    6: 43,
    10: 61,
    16: 80,
    25: 110,
    35: 145,
    50: 180,
    70: 225,
    95: 275,
    120: 320,
    150: 370,
    185: 430,
    240: 530,
    300: 640
  }
};

/**
 * SECTION 3: DERATING FACTORS
 * These are MULTIPLICATIVE factors to reduce cable rating
 * Final capacity = Catalog rating × Ktotal
 * Where: Ktotal = K_temp × K_group × K_soil × K_depth
 */

export const DeratingTables = {
  // Temperature derating for XLPE (90°C max operating temp)
  // For different ambient temperatures
  temperature_factor_XLPE: {
    20: 1.00,
    25: 0.98,
    30: 0.96,
    35: 0.94,
    40: 0.91,
    45: 0.87,
    50: 0.82,
    55: 0.76,
    60: 0.69
  },

  // Temperature derating for PVC (70°C max operating temp)
  temperature_factor_PVC: {
    20: 1.00,
    25: 0.97,
    30: 0.94,
    35: 0.90,
    40: 0.85,
    45: 0.79,
    50: 0.71,
    55: 0.61
  },

  // Grouping factor - number of loaded circuits
  // For cables in air (tray/ladder/conduit)
  grouping_factor_air: {
    1: 1.00, // Single cable, no grouping
    2: 0.95,
    3: 0.90,
    4: 0.85,
    5: 0.82,
    6: 0.80,
    9: 0.75,
    12: 0.71
  },

  // Grouping factor - for buried cables
  grouping_factor_buried: {
    1: 1.00,
    2: 0.88,
    3: 0.82,
    4: 0.77,
    5: 0.75,
    6: 0.73
  },

  // Soil thermal resistivity factor (for buried cables)
  // Typical: 1.2 K·m/W (dry soil)
  soil_resistivity_factor: {
    0.5: 1.35, // Very moist/conductive
    0.8: 1.15, // Damp soil
    1.0: 1.05, // Average moist
    1.2: 1.00, // Standard reference
    1.5: 0.93, // Dry soil
    2.0: 0.82, // Very dry soil
    2.5: 0.71
  },

  // Depth of laying factor (for buried cables, cm)
  depth_factor: {
    30: 1.10, // 30cm deep
    50: 1.03,
    60: 1.00, // Reference depth
    70: 0.97,
    90: 0.93,
    100: 0.91
  }
};

/**
 * SECTION 4: STARTING CURRENT MULTIPLIERS
 * For motor starting calculations
 */

export const MotorStartingMultipliers = {
  // Starting current as multiple of Full Load Current
  DOL: { min: 6.0, max: 7.0, typical: 6.5 }, // Direct-on-line
  StarDelta: { min: 2.0, max: 3.0, typical: 2.5 }, // Star-Delta
  SoftStarter: { min: 2.0, max: 4.0, typical: 3.0 }, // Electronic soft starter
  VFD: { min: 1.0, max: 1.2, typical: 1.1 } // Variable frequency drive
};

/**
 * SECTION 5: VOLTAGE DROP LIMITS (IEC 60364)
 */

export const VoltageLimits = {
  // Running voltage drop
  running: {
    motor_branch: 0.03, // 3%
    motor_feeder: 0.03,
    resistive_load: 0.05, // 5%
    lighting: 0.03,
    general: 0.05
  },

  // Starting voltage drop (motors only)
  starting: {
    DOL: 0.15, // 15% max
    StarDelta: 0.10, // 10% max
    SoftStarter: 0.10,
    VFD: 0.05 // VFD limits it
  },

  // Total from source to load
  total: {
    transformer_to_furthest: 0.08 // 8% limit
  }
};

/**
 * SECTION 6: SHORT-CIRCUIT WITHSTAND
 * Cable must withstand Isc for clearing time t
 * Isc ≤ k × A × √t
 */

export const ShortCircuitData = {
  // Constant k for different materials and insulation
  // At 90°C initial, 250°C final temp (XLPE)
  material_constant: {
    'Cu_XLPE_90C': 143,
    'Cu_PVC_70C': 115,
    'Al_XLPE_90C': 94,
    'Al_PVC_70C': 76,
    // Legacy keys for compatibility
    copper_XLPE_90C: 143,
    copper_PVC_70C: 115,
    aluminum_XLPE_90C: 94,
    aluminum_PVC_70C: 76
  } as Record<string, number>,

  // Typical protection clearing times (seconds)
  protection_clearing_time: {
    instantaneous_breaker: 0.02, // 20ms
    fast_breaker: 0.04, // 40ms
    standard_breaker: 0.1, // 100ms
    delayed_breaker: 0.5, // 500ms
    fuse: 0.02 // 20ms
  }
};

/**
 * SECTION 7: LOAD TYPE SPECIFICATIONS
 */

export const LoadTypeSpecs = {
  Motor: {
    efficiencyRange: { min: 0.85, max: 0.96 },
    typicalEfficiency: 0.92,
    powerFactorRange: { min: 0.75, max: 0.92 },
    typicalPowerFactor: 0.85,
    needsStartingCheck: true,
    typicalStartingMethod: 'DOL',
    icon: '⚙️'
  },

  Heater: {
    efficiencyRange: { min: 0.98, max: 1.0 },
    typicalEfficiency: 0.99,
    powerFactorRange: { min: 0.99, max: 1.0 },
    typicalPowerFactor: 1.0,
    needsStartingCheck: false,
    icon: '🔥'
  },

  Transformer: {
    efficiencyRange: { min: 0.95, max: 0.99 },
    typicalEfficiency: 0.97,
    powerFactorRange: { min: 0.95, max: 0.98 },
    typicalPowerFactor: 0.95,
    needsStartingCheck: false,
    icon: '🔌'
  },

  Feeder: {
    efficiencyRange: { min: 0.99, max: 1.0 },
    typicalEfficiency: 1.0,
    powerFactorRange: { min: 0.8, max: 1.0 },
    typicalPowerFactor: 0.90,
    needsStartingCheck: false,
    icon: '📡'
  },

  'Pump': {
    efficiencyRange: { min: 0.80, max: 0.92 },
    typicalEfficiency: 0.88,
    powerFactorRange: { min: 0.80, max: 0.90 },
    typicalPowerFactor: 0.85,
    needsStartingCheck: true,
    typicalStartingMethod: 'StarDelta',
    icon: '💧'
  },

  'Fan': {
    efficiencyRange: { min: 0.80, max: 0.92 },
    typicalEfficiency: 0.88,
    powerFactorRange: { min: 0.80, max: 0.90 },
    typicalPowerFactor: 0.85,
    needsStartingCheck: true,
    typicalStartingMethod: 'StarDelta',
    icon: '💨'
  },

  'Compressor': {
    efficiencyRange: { min: 0.75, max: 0.90 },
    typicalEfficiency: 0.85,
    powerFactorRange: { min: 0.75, max: 0.85 },
    typicalPowerFactor: 0.80,
    needsStartingCheck: true,
    typicalStartingMethod: 'VFD',
    icon: '🌪️'
  }
};

/**
 * SECTION 8: INSTALLATION METHOD FACTORS
 */

export const InstallationMethods = {
  'Air - Ladder tray (touching)': {
    grouping_table: 'grouping_factor_air',
    reactance_table: 'air_touching',
    code: 'A1',
    factor: 1.0
  },
  'Air - Ladder tray (spaced 400mm)': {
    grouping_table: 'grouping_factor_air',
    reactance_table: 'air_spaced_400mm',
    code: 'A2',
    factor: 1.05
  },
  'Air - Conduit (single)': {
    grouping_table: 'grouping_factor_air',
    reactance_table: 'air_touching',
    code: 'C',
    factor: 0.95
  },
  'Air - Conduit (multi)': {
    grouping_table: 'grouping_factor_air',
    reactance_table: 'air_touching',
    code: 'C3',
    factor: 0.85
  },
  'Buried - Direct in ground': {
    grouping_table: 'grouping_factor_buried',
    reactance_table: 'buried',
    code: 'D1',
    factor: 1.0
  },
  'Buried - In duct': {
    grouping_table: 'grouping_factor_buried',
    reactance_table: 'buried',
    code: 'D2',
    factor: 0.95
  }
};

/**
 * SECTION 9: CABLE DESIGNATION STANDARDS (IEC 60228/60811)
 * For generating proper cable part numbers
 */

export const CableStandards = {
  // Conductor material codes
  material: {
    Cu: 'Copper',
    Al: 'Aluminum'
  },

  // Insulation type codes
  insulation: {
    XLPE: 'Cross-linked polyethylene (90°C)',
    PVC: 'Polyvinyl chloride (70°C)',
    EPR: 'Ethylene propylene rubber (60°C)'
  },

  // Sheath codes
  sheath: {
    PVC: 'PVC sheath',
    LSZH: 'Low smoke zero halogen',
    None: 'No sheath'
  },

  // Standard color coding
  phase_colors: {
    R: 'Red (L1)',
    Y: 'Yellow (L2)',
    B: 'Blue (L3)',
    N: 'Black (Neutral)',
    E: 'Green/Yellow (Earth)'
  }
};

export default {
  ConductorDatabase,
  AmpacityTables,
  DeratingTables,
  MotorStartingMultipliers,
  VoltageLimits,
  ShortCircuitData,
  LoadTypeSpecs,
  InstallationMethods,
  CableStandards
};
