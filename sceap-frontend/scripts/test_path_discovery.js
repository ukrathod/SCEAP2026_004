import { readFileSync } from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { normalizeFeeders, analyzeAllPaths } from '../src/utils/pathDiscoveryService';

const file = path.resolve('/workspaces/SCEAP2026_003/test_feeder_list.xlsx');
console.log('Reading', file);
const workbook = XLSX.readFile(file);
const sheet = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '' });
console.log('Rows:', data.length);
const normalized = normalizeFeeders(data);
console.log('Normalized feeders:', normalized.length);
const analysis = analyzeAllPaths(normalized);
console.log('Paths found:', analysis.totalPaths);
console.log('Sample path:', analysis.paths[0] ? { pathId: analysis.paths[0].pathId, cables: analysis.paths[0].cables.map(c=>c.cableNumber)} : 'none');
