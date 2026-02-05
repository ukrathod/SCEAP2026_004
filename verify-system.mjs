#!/usr/bin/env node

/**
 * COMPREHENSIVE VERIFICATION TEST
 * Full system check: Demo data → Path analysis → Cable sizing → Results
 * Verifies all 17 feeders process correctly with expected outputs
 */

import { CLEAN_DEMO_FEEDERS } from './sceap-frontend/src/utils/cleanDemoData.ts';
import { normalizeFeeders, discoverPathsToTransformer } from './sceap-frontend/src/utils/pathDiscoveryService.ts';
import CableSizingEngine_V2 from './sceap-frontend/src/utils/CableSizingEngine_V2.ts';
import { LoadTypeSpecs } from './sceap-frontend/src/utils/CableEngineeringData.ts';

console.log('\n' + '='.repeat(80));
console.log('🔍 COMPREHENSIVE VERIFICATION TEST - SCEAP 2026');
console.log('='.repeat(80) + '\n');

// Step 1: Validate demo data
console.log('📊 STEP 1: Demo Data Validation');
console.log('-'.repeat(80));
if (!CLEAN_DEMO_FEEDERS || CLEAN_DEMO_FEEDERS.length === 0) {
  console.error('❌ ERROR: No demo feeders found!');
  process.exit(1);
}
console.log(`✓ Demo feeders loaded: ${CLEAN_DEMO_FEEDERS.length} cables`);
console.log(`✓ Total load: ${CLEAN_DEMO_FEEDERS.reduce((sum, f) => sum + (f['Load KW'] || 0), 0).toFixed(2)} kW`);

// Step 2: Normalize and prepare feeders
console.log('\n📈 STEP 2: Normalize and Prepare Data');
console.log('-'.repeat(80));
const normalizedFeeders = normalizeFeeders(CLEAN_DEMO_FEEDERS);
console.log(`✓ Normalized ${normalizedFeeders.length} feeders`);

// Step 3: Path discovery
console.log('\n🔗 STEP 3: Path Discovery to Transformer');
console.log('-'.repeat(80));
const pathAnalysis = discoverPathsToTransformer(normalizedFeeders);
console.log(`✓ Total paths discovered: ${pathAnalysis.totalPaths}`);
console.log(`✓ Valid paths: ${pathAnalysis.validPaths}`);
console.log(`✓ Invalid paths: ${pathAnalysis.invalidPaths}`);
console.log(`✓ Average V-drop: ${pathAnalysis.averageVoltageDrop.toFixed(2)}%`);

// Step 4: Run cable sizing engine for all feeders
console.log('\n⚡ STEP 4: Cable Sizing Engine - All 17 Feeders');
console.log('-'.repeat(80));

const engine = new CableSizingEngine_V2();
let results = [];
let statusSummary = { APPROVED: 0, WARNING: 0, FAILED: 0 };
let vdropStats = { min: 100, max: 0, avg: 0 };
let sizeStats = { min: 9999, max: 0, avg: 0 };

for (let i = 0; i < normalizedFeeders.length; i++) {
  const cable = normalizedFeeders[i];
  const loadType = (cable.loadType || 'Motor');
  
  const input = {
    loadType,
    ratedPowerKW: cable.loadKW || 0.1,
    voltage: cable.voltage || 415,
    phase: cable.phase || '3Ø',
    efficiency: cable.efficiency || LoadTypeSpecs[loadType]?.typicalEfficiency || 0.95,
    powerFactor: cable.powerFactor || LoadTypeSpecs[loadType]?.typicalPowerFactor || 0.85,
    conductorMaterial: cable.conductorMaterial || 'Cu',
    insulation: cable.insulation || 'XLPE',
    numberOfCores: (typeof cable.numberOfCores === 'string' ? cable.numberOfCores : '3C'),
    installationMethod: (cable.installationMethod || 'Air'),
    cableLength: cable.length || 0,
    ambientTemp: cable.ambientTemp || 40,
    numberOfLoadedCircuits: cable.numberOfLoadedCircuits || 1,
    startingMethod: cable.startingMethod || 'DOL',
    protectionType: cable.protectionType || 'None',
    maxShortCircuitCurrent: cable.maxShortCircuitCurrent,
    protectionClearingTime: cable.protectionClearingTime || 0.1
  };
  
  const result = engine.sizeCable(input);
  results.push({
    cableNumber: cable.cableNumber,
    loadKW: cable.loadKW,
    size_mm2: result.selectedConductorArea,
    runs: result.numberOfRuns,
    fLC_A: result.fullLoadCurrent,
    vdrop_pct: (result.voltageDropRunning_percent * 100).toFixed(2),
    vdrop_volt: result.voltageDropRunning_volt.toFixed(2),
    startingVdrop_pct: result.voltageDropStarting_percent ? (result.voltageDropStarting_percent * 100).toFixed(2) : 'N/A',
    status: result.status,
    constraint: result.drivingConstraint,
    isc_ka: (result.shortCircuitCurrent_kA || 0).toFixed(1)
  });
  
  statusSummary[result.status]++;
  vdropStats.min = Math.min(vdropStats.min, result.voltageDropRunning_percent * 100);
  vdropStats.max = Math.max(vdropStats.max, result.voltageDropRunning_percent * 100);
  vdropStats.avg += result.voltageDropRunning_percent * 100;
  sizeStats.min = Math.min(sizeStats.min, result.selectedConductorArea);
  sizeStats.max = Math.max(sizeStats.max, result.selectedConductorArea);
  sizeStats.avg += result.selectedConductorArea;
  
  const icon = result.status === 'APPROVED' ? '✓' : result.status === 'WARNING' ? '⚠' : '✗';
  console.log(`${i+1}. ${cable.cableNumber.padEnd(15)} ${icon} ${result.status.padEnd(9)} Size: ${String(result.selectedConductorArea).padEnd(6)}mm² V-drop: ${(result.voltageDropRunning_percent*100).toFixed(2)}%`);
}
vdropStats.avg /= results.length;
sizeStats.avg /= results.length;

// Step 5: Results Summary
console.log('\n' + '='.repeat(80));
console.log('📋 VERIFICATION RESULTS SUMMARY');
console.log('='.repeat(80));

console.log('\n✅ STATUS DISTRIBUTION:');
console.log(`   APPROVED:  ${statusSummary.APPROVED}/${results.length} (${((statusSummary.APPROVED/results.length)*100).toFixed(1)}%)`);
console.log(`   WARNING:   ${statusSummary.WARNING}/${results.length} (${((statusSummary.WARNING/results.length)*100).toFixed(1)}%)`);
console.log(`   FAILED:    ${statusSummary.FAILED}/${results.length} (${((statusSummary.FAILED/results.length)*100).toFixed(1)}%)`);

console.log('\n⚡ VOLTAGE DROP STATISTICS:');
console.log(`   Min:  ${vdropStats.min.toFixed(2)}%`);
console.log(`   Avg:  ${vdropStats.avg.toFixed(2)}%`);
console.log(`   Max:  ${vdropStats.max.toFixed(2)}%`);
console.log(`   ✓ All within 5% limit: ${vdropStats.max <= 5 ? 'YES' : 'NO'}`);

console.log('\n📏 CABLE SIZE STATISTICS:');
console.log(`   Min:  ${sizeStats.min}mm²`);
console.log(`   Avg:  ${sizeStats.avg.toFixed(1)}mm²`);
console.log(`   Max:  ${sizeStats.max}mm²`);

console.log('\n🔧 CONSTRAINT ANALYSIS:');
const constraints = {};
results.forEach(r => {
  constraints[r.constraint] = (constraints[r.constraint] || 0) + 1;
});
Object.entries(constraints).forEach(([constraint, count]) => {
  console.log(`   ${constraint}: ${count} cables`);
});

// Step 6: Detailed Output Table
console.log('\n' + '='.repeat(80));
console.log('📊 DETAILED CABLE-BY-CABLE RESULTS');
console.log('='.repeat(80) + '\n');
console.log('Cable #         Status   Size(mm²) Runs  FLC(A)  V-Drop(%) S-Drop(%)  ISc(kA) Constraint');
console.log('-'.repeat(100));
results.forEach(r => {
  console.log(`${r.cableNumber.padEnd(15)} ${r.status.padEnd(9)} ${String(r.size_mm2).padEnd(9)} ${String(r.runs).padEnd(5)} ${String(r.fLC_A).padEnd(7)} ${String(r.vdrop_pct).padEnd(10)} ${String(r.startingVdrop_pct).padEnd(10)} ${String(r.isc_ka).padEnd(7)} ${r.constraint}`);
});

// Step 7: Final Validation
console.log('\n' + '='.repeat(80));
console.log('✅ FINAL VERIFICATION STATUS');
console.log('='.repeat(80) + '\n');

let allGood = true;
const checks = [];

checks.push({
  name: 'All feeders processed',
  pass: results.length === 17,
  expected: 17,
  actual: results.length
});

checks.push({
  name: 'No critical failures',
  pass: statusSummary.FAILED === 0,
  expected: 0,
  actual: statusSummary.FAILED
});

checks.push({
  name: 'V-drop within limits',
  pass: vdropStats.max <= 5,
  expected: '≤5%',
  actual: `${vdropStats.max.toFixed(2)}%`
});

checks.push({
  name: 'All sizes valid',
  pass: sizeStats.min > 0 && sizeStats.max < 1000,
  expected: '1-1000mm²',
  actual: `${sizeStats.min}-${sizeStats.max}mm²`
});

checks.push({
  name: 'Path analysis complete',
  pass: pathAnalysis.validPaths > 0,
  expected: '>0',
  actual: pathAnalysis.validPaths
});

checks.forEach(check => {
  const icon = check.pass ? '✓' : '✗';
  console.log(`${icon} ${check.name}`);
  console.log(`  Expected: ${check.expected} | Actual: ${check.actual}`);
  if (!check.pass) allGood = false;
});

console.log('\n' + '='.repeat(80));
if (allGood) {
  console.log('🎉 ALL VERIFICATION CHECKS PASSED!');
  console.log('✓ System is ready for deployment and testing');
} else {
  console.log('⚠️ Some verification checks failed. Review above for details.');
}
console.log('='.repeat(80) + '\n');

process.exit(allGood ? 0 : 1);
