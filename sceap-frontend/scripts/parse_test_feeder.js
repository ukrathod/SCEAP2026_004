import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const candidates = [
  path.resolve(process.cwd(), 'test_feeder_list.xlsx'),
  path.resolve(process.cwd(), '..', 'test_feeder_list.xlsx'),
  path.resolve(process.cwd(), '..', '..', 'test_feeder_list.xlsx'),
  '/workspaces/SCEAP2026_003/test_feeder_list.xlsx',
  '/workspaces/test_feeder_list.xlsx'
];

let file = process.argv[2];
if (!file) {
  file = candidates.find(p => fs.existsSync(p));
}
if (!file) {
  console.error('Could not find test_feeder_list.xlsx. Tried:', candidates.join('\n'));
  process.exit(1);
}

console.log('Reading', file);
const workbook = XLSX.readFile(file, { cellDates: true });

const getColValue = (row, ...variations) => {
  for (const v of variations) {
    if (v in row && row[v] !== '' && row[v] !== null && row[v] !== undefined) return row[v];
  }
  const lowerKeys = Object.keys(row).reduce((acc, k) => {
    acc[k.toLowerCase().trim()] = row[k];
    return acc;
  }, {});
  for (const v of variations) {
    const lower = v.toLowerCase().trim();
    if (lower in lowerKeys && lowerKeys[lower] !== '' && lowerKeys[lower] !== null && lowerKeys[lower] !== undefined) return lowerKeys[lower];
  }
  // partial match
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase();
    for (const v of variations) {
      if (lk.includes(v.toLowerCase())) return row[k];
    }
  }
  return undefined;
};

workbook.SheetNames.forEach(sheetName => {
  const ws = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Sheet: ${sheetName} - rows: ${data.length}`);
  data.slice(0, 20).forEach((row, idx) => {
    const size = getColValue(row, 'Size (mm²)', 'size', 'Size', 'Area', 'area');
    const loadKW = getColValue(row, 'Load (kW)', 'Load KW', 'kW', 'Load', 'Power');
    const cableNo = getColValue(row, 'Cable No', 'Cable Number', 'Cable', 'feeder', 'S.No');
    const fromBus = getColValue(row, 'From Bus', 'From', 'Source');
    const toBus = getColValue(row, 'To Bus', 'To', 'Destination');
    console.log(`#${idx+1} -> cableNo: ${cableNo} | loadKW: ${loadKW} | from: ${fromBus} | to: ${toBus} | size: ${size}`);
  });
});
