import XLSX from 'xlsx';

// Read the test Excel file
const workbook = XLSX.readFile('../test_feeder_list.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: false });

// Create normalized cables
const cables = jsonData.map((feeder, idx) => ({
  serialNo: idx + 1,
  cableNumber: feeder['Cable Number'] || `CAB-${idx + 1}`,
  feederDescription: feeder['Feeder Description'] || '',
  fromBus: feeder['From Bus'] || '',
  toBus: feeder['To Bus'] || '',
  voltage: Number(feeder['Voltage (V)'] || 415),
  loadKW: Number(feeder['Load KW'] || 0),
  length: Number(feeder['Length (m)'] || 0),
  deratingFactor: Number(feeder['Derating Factor'] || 0.87),
}));

console.log("=== ALL CABLES ===");
console.log(`Total cables: ${cables.length}`);

// Find transformer buses (buses with TRF in name)
const transformerBuses = new Set(
  cables
    .filter(c => c.toBus.toUpperCase().includes('TRF'))
    .map(c => c.toBus)
);

console.log(`\nTransformer buses found: ${Array.from(transformerBuses).join(', ')}`);
console.log(`Cables connecting to transformer: ${cables.filter(c => transformerBuses.has(c.toBus)).length}`);

// Find all unique fromBuses (equipment/loads)
const equipmentBuses = new Set(
  cables
    .filter(c => !transformerBuses.has(c.fromBus))
    .map(c => c.fromBus)
);

console.log(`\nEquipment/load buses: ${Array.from(equipmentBuses).size}`);

// Check rows 12, 22, 33
console.log("\n=== SPECIFIC ROWS ===");
[12, 22, 33].forEach(rowNum => {
  const cable = cables[rowNum - 1];
  if (cable) {
    console.log(`\nRow ${rowNum}:`);
    console.log(`  From Bus: '${cable.fromBus}' (in equipment set: ${equipmentBuses.has(cable.fromBus)})`);
    console.log(`  To Bus: '${cable.toBus}' (is transformer: ${transformerBuses.has(cable.toBus)})`);
    
    // Try to find a path from this cable's fromBus back to transformer
    const connCable = cables.find(c => c.fromBus === cable.fromBus);
    if (connCable) {
      console.log(`  Connects to: '${connCable.toBus}'`);
    } else {
      console.log(`  NO CABLE FOUND that starts from '${cable.fromBus}'`);
    }
  }
});

// Check which cables have fromBus in [from_12, from_22, from_33]
console.log("\n=== CABLES STARTING FROM SPECIFIC BUSES ===");
['from_12', 'from_22', 'from_33'].forEach(bus => {
  const found = cables.filter(c => c.fromBus === bus);
  console.log(`Cables from '${bus}': ${found.length}`);
  found.forEach(c => {
    console.log(`  -> to '${c.toBus}' (row ${c.serialNo})`);
  });
});
