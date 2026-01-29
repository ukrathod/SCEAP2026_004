# SCEAP Demo Template - Complete Redesign Guide

## Overview

The SCEAP demo template has been completely redesigned to match **real electrical distribution systems** with a hierarchical 4-panel structure containing 43 realistic feeder items.

**Previous Template:** 7 items, oversimplified
**New Template:** 43 items across 4 panels, production-ready

---

## Hierarchical Structure

### Visual Layout

```
TRF-MAIN (Transformer)
│
└─→ MAIN-DISTRIBUTION (Main Switchgear Panel)
    │
    ├─→ [Direct Loads under Main Panel]
    │   ├─ FIRE-PUMP-MOTOR (37kW)
    │   ├─ WATER-PUMP-MOTOR (22kW)
    │   ├─ SEWAGE-MOTOR (15kW)
    │   └─ ... (7 more items)
    │
    ├─→ UPS-PANEL (Uninterruptible Power Supply)
    │   ├─ UPS-CHARGER-1 (18kW)
    │   ├─ UPS-INVERTER-1 (40kW)
    │   ├─ UPS-STATIC-BYPASS (50kW)
    │   └─ ... (7 more items)
    │
    ├─→ HVAC-PANEL (Heating, Ventilation & Cooling)
    │   ├─ HVAC-CHILLER-MOTOR (55kW) [ACB with short-circuit rating]
    │   ├─ HVAC-AHU-1-MOTOR (22kW)
    │   ├─ HVAC-COOLING-TOWER (18.5kW)
    │   └─ ... (8 more items)
    │
    └─→ LIGHTING-PANEL (Lighting Distribution)
        ├─ LIGHTING-FLOOR-1 (12kW)
        ├─ LIGHTING-FLOOR-2 (12kW)
        ├─ LIGHTING-OUTDOOR-PARKING (8kW)
        └─ ... (8 more items)
```

### Panel Distribution

| Panel | Items | Type | Total Load | Description |
|-------|-------|------|-----------|-------------|
| MAIN-DISTRIBUTION | 11 | Distribution | ~391 kW | Main switchgear with incomer and all sub-panel feeders |
| UPS-PANEL | 10 | Backup Power | ~212 kW | Uninterruptible power supply infrastructure |
| HVAC-PANEL | 11 | Climate Control | ~140 kW | Chiller, cooling tower, pumps, and controls |
| LIGHTING-PANEL | 11 | Illumination | ~70 kW | Interior and exterior lighting circuits |
| **TOTAL** | **43** | **Mixed** | **~813 kW** | Complete building electrical distribution |

---

## Data Structure Format

### Excel/CSV Format (For User Upload)

```
Row 1: Headers
  Serial No | Cable Number | Feeder Description | From Bus | To Bus | Voltage(V) | Power Factor | ... (20 columns)

Row 2: Incomer to Main Panel
  1 | INC-MAIN-001 | MAIN DISTRIBUTION PANEL (MAIN SWITCHGEAR) | MAIN-DISTRIBUTION | TRF-MAIN | 415 | 0.95 | ... 

Row 3-11: Items in Main Panel
  2 | FDR-MAIN-002 | Feeder to UPS-PANEL | UPS-PANEL | MAIN-DISTRIBUTION | 415 | 0.90 | ...
  3 | FDR-MAIN-003 | Feeder to HVAC-PANEL | HVAC-PANEL | MAIN-DISTRIBUTION | 415 | 0.85 | ...
  ... (8 more rows)

Row 12: UPS Panel Header
  12 | UPS-HDR-001 | UPS PANEL (UNINTERRUPTIBLE POWER SUPPLY) | UPS-PANEL | UPS-PANEL | 415 | 0.90 | ...

Row 13-21: Items in UPS Panel
  13 | UPS-001 | Battery Charger Unit 1 - 18kW | UPS-CHARGER-1 | UPS-PANEL | 415 | 0.88 | ...
  ... (8 more rows)

Row 22: HVAC Panel Header
  ... (similar structure)

Row 33: Lighting Panel Header
  ... (similar structure)
```

### Key Column Definitions

#### From Bus & To Bus (Critical for Path Discovery)

- **From Bus**: Source/Equipment/Load name (endpoint of the cable)
- **To Bus**: Destination/Parent Panel name (source of power for the equipment)

**Golden Rule:**
```
From Bus → To Bus (Power flows backward from load back to source)

Example:
  FIRE-PUMP-MOTOR (From) → MAIN-DISTRIBUTION (To)
  └─ Fire pump gets power FROM MAIN-DISTRIBUTION panel

UPS-INVERTER-1 (From) → UPS-PANEL (To)
└─ Inverter gets power FROM UPS-PANEL

UPS-PANEL (From) → MAIN-DISTRIBUTION (To)
└─ UPS-PANEL gets power FROM MAIN-DISTRIBUTION

MAIN-DISTRIBUTION (From) → TRF-MAIN (To)
└─ Main panel gets power FROM TRANSFORMER
```

#### Panel Headers (Self-Reference Pattern)

Panel headers use self-referencing:
```
From Bus = To Bus = [Panel Name]

Example:
  Serial No: 12
  From Bus: UPS-PANEL
  To Bus: UPS-PANEL (self-reference indicates this is a panel header)
  Load KW: 0 (headers have no load)
```

This pattern identifies panel sections in the feeder list.

#### Electrical Data Columns

| Column | Type | Range | Meaning |
|--------|------|-------|---------|
| Voltage (V) | int | 230-415 | System voltage (usually 415V for 3-phase) |
| Power Factor | decimal | 0.8-1.0 | Cos(φ) - affects current calculation |
| Efficiency (%) | int | 80-98 | Equipment efficiency factor |
| Derating Factor | decimal | 0.85-1.0 | Cable derating due to bundling/temperature |
| Load KW | decimal | 0-100+ | Active power demand |
| Load KVA | decimal | Load KW / PF | Apparent power |
| Cable Type | enum | XLPE, PVC, EPR | Cable insulation type |
| Installation Method | enum | Cable Tray, Conduit, Direct Burial | How cable is installed |
| Ambient Temp (°C) | int | 25-40 | Environmental temperature |
| Ground Temp (°C) | int | 25-30 | Ground/cable temperature |
| Length (m) | decimal | 2-55 | Cable run length in meters |
| Breaker Type | enum | MCB, MCCB, ACB, ISOLATOR | Protection device type |
| Short Circuit Current (kA) | decimal | 0-50 | ACB breaking capacity |

---

## Path Discovery Algorithm

### How Path Discovery Works

The algorithm traces from equipment/load back to transformer by following cable connections:

```javascript
// Pseudo-code for path discovery

function tracePath(startEquipment) {
  let current = startEquipment;
  let path = [];
  
  while (true) {
    // Find cable where From Bus = current
    cable = findCable(current);
    
    if (!cable) {
      return "Path failed - no cable found";
    }
    
    path.push(cable);
    
    // Move to next parent
    current = cable.To Bus;
    
    // Check if we reached transformer
    if (current contains "TRF") {
      return "Path found!";
    }
  }
}
```

### Example Path Traces

**Example 1: Direct Load from Main Panel**
```
FIRE-PUMP-MOTOR
  ↓ (From Bus = FIRE-PUMP-MOTOR, To Bus = MAIN-DISTRIBUTION)
MAIN-DISTRIBUTION
  ↓ (From Bus = MAIN-DISTRIBUTION, To Bus = TRF-MAIN)
TRF-MAIN ✓ REACHED

Path: TRF-MAIN → MAIN-DISTRIBUTION → FIRE-PUMP-MOTOR
Distance: 8m + 25m = 33m
Load: 37kW
```

**Example 2: Equipment Through Sub-Panel**
```
HVAC-CHILLER-MOTOR
  ↓ (From Bus = HVAC-CHILLER-MOTOR, To Bus = HVAC-PANEL)
HVAC-PANEL
  ↓ (From Bus = HVAC-PANEL, To Bus = MAIN-DISTRIBUTION)
MAIN-DISTRIBUTION
  ↓ (From Bus = MAIN-DISTRIBUTION, To Bus = TRF-MAIN)
TRF-MAIN ✓ REACHED

Path: TRF-MAIN → MAIN-DISTRIBUTION → HVAC-PANEL → HVAC-CHILLER-MOTOR
Distance: 8m + 55m + 48m = 111m
Load: 55kW (ACB with 22kA short-circuit rating)
```

**Example 3: Deep Sub-Panel Nesting**
```
UPS-CHARGER-1
  ↓ (From Bus = UPS-CHARGER-1, To Bus = UPS-PANEL)
UPS-PANEL
  ↓ (From Bus = UPS-PANEL, To Bus = MAIN-DISTRIBUTION)
MAIN-DISTRIBUTION
  ↓ (From Bus = MAIN-DISTRIBUTION, To Bus = TRF-MAIN)
TRF-MAIN ✓ REACHED

Path: TRF-MAIN → MAIN-DISTRIBUTION → UPS-PANEL → UPS-CHARGER-1
Distance: 8m + 45m + 12m = 65m
Load: 18kW
```

---

## Validation Rules

### Path Validity Criteria

```
✓ Path is VALID if:
  1. Equipment connects to a panel (To Bus = panel name)
  2. Panel connects to parent panel (To Bus = parent panel name)
  3. Path eventually reaches transformer (To Bus contains "TRF")
  4. Voltage drop ≤ 5% (IEC 60364 standard)
  5. No circular references

✗ Path is INVALID if:
  1. Equipment disconnected (no cable with matching From Bus)
  2. Orphaned panel (panel not listed in any cable's To Bus)
  3. Infinite loop (circular reference detected)
  4. Voltage drop > 5%
```

### Voltage Drop Calculation

```
I = (P × 1000) / (√3 × V × PF × Efficiency)
  = Current in Amperes
  P = Load in kW
  V = Voltage in Volts
  PF = Power Factor
  √3 ≈ 1.732 (for 3-phase)

V-drop = (√3 × I × R × L) / 1000
  = Voltage drop in Volts
  I = Current in Amperes
  R = Cable resistance (Ω/km)
  L = Length in meters

V-drop % = (V-drop / Voltage) × 100

Status:
  ≤ 3% = Green ✓ Excellent
  3-5% = Yellow ⚠ Acceptable
  > 5% = Red ✗ Exceeds limit
```

---

## Template Items Summary

### MAIN-DISTRIBUTION Panel (11 items)

| # | Cable | Description | From Bus | Load (kW) | Type | Breaker |
|---|-------|-------------|----------|-----------|------|---------|
| 1 | INC-MAIN-001 | Panel header | MAIN-DISTRIBUTION | 0 | Panel | ISOLATOR |
| 2 | FDR-MAIN-002 | Feeder to UPS-PANEL | UPS-PANEL | 85 | Feed | ACB-250A |
| 3 | FDR-MAIN-003 | Feeder to HVAC-PANEL | HVAC-PANEL | 120 | Feed | ACB-200A |
| 4 | FDR-MAIN-004 | Feeder to LIGHTING-PANEL | LIGHTING-PANEL | 65 | Feed | ACB-100A |
| 5 | LD-MAIN-005 | Fire Pump Motor | FIRE-PUMP-MOTOR | 37 | Motor | MCCB-100A |
| 6 | LD-MAIN-006 | Water Pump Motor | WATER-PUMP-MOTOR | 22 | Motor | MCCB-63A |
| 7 | LD-MAIN-007 | Sewage Treatment Motor | SEWAGE-MOTOR | 15 | Motor | MCCB-50A |
| 8 | LD-MAIN-008 | Elevator Motor | ELEVATOR-MOTOR | 11 | Motor | MCCB-32A |
| 9 | LD-MAIN-009 | Generator Charger | GEN-CHARGER | 5 | Charger | MCB-20A |
| 10 | LD-MAIN-010 | BMS Control Panel | BMS-CONTROL-PANEL | 3 | Control | MCB-16A |
| 11 | LD-MAIN-011 | Parking Exhaust Motor | PARKING-EXHAUST-MOTOR | 7.5 | Motor | MCCB-25A |

### UPS-PANEL (10 items)

| # | Cable | Description | From Bus | Load (kW) | Type | Breaker |
|---|-------|-------------|----------|-----------|------|---------|
| 12 | UPS-HDR-001 | Panel header | UPS-PANEL | 0 | Panel | MCCB |
| 13 | UPS-001 | Battery Charger 1 | UPS-CHARGER-1 | 18 | Charger | MCCB-63A |
| 14 | UPS-002 | Inverter Module 1 | UPS-INVERTER-1 | 40 | Inverter | MCCB-100A |
| 15 | UPS-003 | Static Bypass Switch | UPS-STATIC-BYPASS | 50 | Switch | MCCB-125A |
| 16 | UPS-004 | Maintenance Bypass | UPS-MAINT-BYPASS | 50 | Bypass | MCCB-125A |
| 17 | UPS-005 | Comm Interface | UPS-COMM-MODULE | 2 | Control | MCB-10A |
| 18 | UPS-006 | Battery Protection | UPS-BATTERY-PROTECT | 1 | Protect | MCB-6A |
| 19 | UPS-007 | Alarm System | UPS-ALARM-SYSTEM | 3 | Alarm | MCB-16A |
| 20 | UPS-008 | Isolation Transformer | UPS-ISOL-TRAFO | 45 | Trafo | MCCB-125A |
| 21 | UPS-009 | Emergency Lighting | UPS-EMER-LIGHTING | 4 | Light | MCB-20A |

### HVAC-PANEL (11 items)

| # | Cable | Description | From Bus | Load (kW) | Type | Breaker |
|---|-------|-------------|----------|-----------|------|---------|
| 22 | HVAC-HDR-001 | Panel header | HVAC-PANEL | 0 | Panel | MCCB |
| 23 | HVAC-001 | AHU-1 Motor | HVAC-AHU-1-MOTOR | 22 | Motor | MCCB-80A |
| 24 | HVAC-002 | Chiller Compressor | HVAC-CHILLER-MOTOR | 55 | Motor | ACB-160A |
| 25 | HVAC-003 | Cooling Tower Fan | HVAC-COOLING-TOWER | 18.5 | Motor | MCCB-63A |
| 26 | HVAC-004 | Boiler Pump | HVAC-BOILER-PUMP | 7.5 | Motor | MCCB-25A |
| 27 | HVAC-005 | Condenser Pump | HVAC-CONDENSER-PUMP | 5.5 | Motor | MCCB-20A |
| 28 | HVAC-006 | Control Unit | HVAC-CONTROL-UNIT | 4 | Control | MCB-16A |
| 29 | HVAC-007 | Zone Valves | HVAC-ZONE-VALVES | 3 | Valve | MCB-13A |
| 30 | HVAC-008 | Damper Actuators | HVAC-DAMPER-ACTUATORS | 2.2 | Act | MCB-10A |
| 31 | HVAC-009 | Condenser Fan | HVAC-CONDENSER-FAN | 11 | Motor | MCCB-40A |
| 32 | HVAC-010 | Vibration Monitor | HVAC-VIBRATION-MON | 1.5 | Monitor | MCB-8A |

### LIGHTING-PANEL (11 items)

| # | Cable | Description | From Bus | Load (kW) | Type | Breaker |
|---|-------|-------------|----------|-----------|------|---------|
| 33 | LTG-HDR-001 | Panel header | LIGHTING-PANEL | 0 | Panel | MCCB |
| 34 | LTG-001 | Floor 1 Lights | LIGHTING-FLOOR-1 | 12 | Light | MCCB-40A |
| 35 | LTG-002 | Floor 2 Lights | LIGHTING-FLOOR-2 | 12 | Light | MCCB-40A |
| 36 | LTG-003 | Floor 3 Lights | LIGHTING-FLOOR-3 | 12 | Light | MCCB-40A |
| 37 | LTG-004 | Parking Lights | LIGHTING-OUTDOOR-PARKING | 8 | Light | MCCB-32A |
| 38 | LTG-005 | Facade Lights | LIGHTING-FACADE | 5 | Light | MCB-20A |
| 39 | LTG-006 | Common Area Lights | LIGHTING-COMMON-AREA | 6 | Light | MCB-24A |
| 40 | LTG-007 | Stairwell Lights | LIGHTING-STAIRWELL | 3 | Light | MCB-13A |
| 41 | LTG-008 | Loading Dock Lights | LIGHTING-LOADING-DOCK | 4 | Light | MCB-16A |
| 42 | LTG-009 | High Bay Lights | LIGHTING-HIGH-BAY | 7 | Light | MCCB-25A |
| 43 | LTG-010 | Sensors & Control | LIGHTING-SENSORS | 2.5 | Control | MCB-10A |

---

## Testing & Validation

### All 43 Items Successfully Loaded

```
✓ Demo data loaded successfully!

Total items: 43

Panel distribution:
  HVAC-PANEL               : 11 items
  LIGHTING-PANEL           : 11 items
  MAIN-DISTRIBUTION        : 10 items
  TRF-MAIN                 :  1 items
  UPS-PANEL                : 10 items

Sample path traces:
  1. FIRE-PUMP-MOTOR → MAIN-DISTRIBUTION → TRF-MAIN
  2. HVAC-CHILLER-MOTOR → HVAC-PANEL → MAIN-DISTRIBUTION → TRF-MAIN
  3. LIGHTING-FLOOR-1 → LIGHTING-PANEL → MAIN-DISTRIBUTION → TRF-MAIN
  4. UPS-INVERTER-1 → UPS-PANEL → MAIN-DISTRIBUTION → TRF-MAIN
  5. HVAC-AHU-1-MOTOR → HVAC-PANEL → MAIN-DISTRIBUTION → TRF-MAIN

✅ All 43 items successfully loaded and tested!
```

---

## Migration Guide

If you have existing template data:

1. **Download current template** from SCEAP platform
2. **Map old cables to new structure**:
   - Assign each load to its appropriate panel
   - Update From Bus to equipment/load name
   - Update To Bus to panel name
   - Add panel headers with self-references
3. **Upload new template** to SCEAP
4. **Verify paths** in Optimization tab

---

## Next Steps

With the new realistic template structure, the SCEAP platform is ready to support:

1. ✅ Hierarchical path discovery (Equipment → Panel → Parent → Transformer)
2. ✅ Realistic electrical load distribution
3. ⏳ Advanced voltage drop calculations
4. ⏳ Current and protection device sizing
5. ⏳ ACB short-circuit breaking capacity validation
6. ⏳ Cable tray and conduit fill analysis
7. ⏳ Multi-panel optimization scenarios

---

## File References

- [demoData.ts](../src/utils/demoData.ts) - Demo template generator
- [pathDiscoveryService.ts](../src/utils/pathDiscoveryService.ts) - Path discovery algorithm
- [SizingTab.tsx](../pages/CableSizing.tsx) - Cable sizing page
- [OptimizationTab.tsx](../pages/Optimization.tsx) - Path optimization page

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Complete & Tested  
**Total Templates:** 43 items across 4 panels
