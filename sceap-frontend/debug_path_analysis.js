const XLSX = require('xlsx');

// Read the test Excel file
const workbook = XLSX.readFile('../test_feeder_list.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

// Parse as objects (similar to how SizingTab does it)
const jsonData = XLSX.utils.sheet_to_json(worksheet, {
  defval: '',
  blankrows: false
});

// Show first 5 rows with their structure
console.log("=== FIRST 5 ROWS FROM EXCEL ===");
jsonData.slice(0, 5).forEach((row, idx) => {
  console.log(`Row ${idx}:`, Object.keys(row));
  console.log(`  From Bus: '${row['From Bus']}', To Bus: '${row['To Bus']}'`);
});

// Check rows 11, 21, 32 (0-indexed = 12, 22, 33)
console.log("\n=== ROWS 12, 22, 33 (INDEX 11, 21, 32) ===");
[11, 21, 32].forEach(idx => {
  const row = jsonData[idx];
  if (row) {
    console.log(`\nRow ${idx + 1} (SL#${idx + 1}):`);
    console.log(`  From Bus: '${row['From Bus']}'`);
    console.log(`  To Bus: '${row['To Bus']}'`);
    console.log(`  Description: '${row['Feeder Description']}'`);
  }
});

// Filter according to normalizeFeeders logic
console.log("\n=== FILTERING TEST (normalizeFeeders) ===");
const filtered = jsonData.filter((f) => 
  f['From Bus'] || f['fromBus'] || f['From bus']
);
console.log(`Total rows: ${jsonData.length}`);
console.log(`Filtered rows: ${filtered.length}`);

// Show which rows got filtered out
const missing = [];
jsonData.forEach((row, idx) => {
  if (!filtered.includes(row)) {
    missing.push(idx);
  }
});

if (missing.length > 0) {
  console.log(`\nMissing rows (0-indexed): ${missing.join(', ')}`);
  console.log(`Missing rows (1-indexed): ${missing.map(i => i + 1).join(', ')}`);
}
