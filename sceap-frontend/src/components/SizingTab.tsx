import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileText, Calculator, Edit, Trash2, Loader2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { normalizeFeeders, analyzeAllPaths, autoDetectColumnMappings } from '../utils/pathDiscoveryService';
import { usePathContext } from '../context/PathContext';
import { generateDemoData } from '../utils/demoData';
import ColumnMappingModal from './ColumnMappingModal';

// Template generation function with SIMPLE, WORKING hierarchy
const generateFeederTemplate = () => {
  // Use the demo data which is proven to work with the path discovery algorithm
  const templateData = generateDemoData();

  // Filter out empty rows for Excel export
  const cleanData = templateData.filter((row: any) => Object.keys(row).length > 0);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(cleanData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 10 }, // Serial No
    { wch: 12 }, // Cable Number
    { wch: 30 }, // Feeder Description
    { wch: 15 }, // From Bus
    { wch: 15 }, // To Bus
    { wch: 12 }, // Voltage (V)
    { wch: 12 }, // Power Factor
    { wch: 15 }, // Efficiency (%)
    { wch: 15 }, // Derating Factor
    { wch: 12 }, // Breaker Type
    { wch: 10 }, // Load KW
    { wch: 12 }, // Load KVA
    { wch: 12 }, // Cable Type
    { wch: 18 }, // Installation Method
    { wch: 18 }, // Ambient Temp (°C)
    { wch: 18 }, // Ground Temp (°C)
    { wch: 12 }  // Length (m)
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Feeders');

  // Create instructions sheet
  const instructionsData = [
    { 
      'KEY RULE': '★ CRITICAL ★',
      'Description': 'From Bus = WHERE THE LOAD IS (child/destination)',
      'Example': 'If a motor is at "MOTOR-1", From Bus = "MOTOR-1"'
    },
    { 
      'KEY RULE': '★ CRITICAL ★',
      'Description': 'To Bus = WHERE POWER COMES FROM (parent/source)',
      'Example': 'If power comes from "PMCC-1", To Bus = "PMCC-1"'
    },
    { 'KEY RULE': '', 'Description': '', 'Example': '' },
    { 
      'KEY RULE': 'HIERARCHY DIRECTION',
      'Description': 'Cables always go FROM loads (bottom) TO panels (top)',
      'Example': 'MOTOR-1 ← MCC-1 ← PMCC-1 ← MAIN-PANEL ← TRF-MAIN'
    },
    { 'KEY RULE': '', 'Description': '', 'Example': '' },
    { 
      'KEY RULE': 'EXAMPLE PATH',
      'Description': 'Row: From Bus = "MOTOR-1", To Bus = "MCC-1"',
      'Example': 'Means: Power flows from MCC-1 to MOTOR-1'
    },
    { 
      'KEY RULE': 'BUS NAMING',
      'Description': 'Use consistent bus names throughout the sheet',
      'Example': 'TRF-MAIN, MAIN-PANEL, PMCC-1, MCC-1, MOTOR-1, LIGHT-L1'
    },
    { 'KEY RULE': '', 'Description': '', 'Example': '' },
    { 
      'KEY RULE': 'WHAT THE SYSTEM DOES',
      'Description': 'Automatically discovers all cable paths from loads back to transformer',
      'Example': '7 feeders in template = 4 unique paths discovered automatically'
    },
    { 
      'KEY RULE': 'VALIDATION',
      'Description': 'Paths are validated for voltage drop compliance (IEC 60364)',
      'Example': 'Green checkmark ✓ = Valid (V-drop < 5%), Red ✗ = Exceeds limit'
    },
    { 
      'KEY RULE': 'OPTIMIZE PAGE',
      'Description': 'All discovered paths appear in Optimization tab for cable sizing',
      'Example': 'Select appropriate cable size from dropdown for each path'
    }
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
  const instructionWidths = [
    { wch: 20 },
    { wch: 55 },
    { wch: 50 }
  ];
  wsInstructions['!cols'] = instructionWidths;
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCTIONS - Read First');

  // Download the file
  XLSX.writeFile(wb, 'SCEAP_Demo_Template.xlsx');
};

// Generate Catalog Template with core configs
const generateCatalogTemplate = () => {
  const wb = XLSX.utils.book_new();

  // Define core configs and their catalogs
  const coreConfigs = ['2C', '3C', '4C', '1C'];
  const catalogSizes = [
    { area: 2.5, air: 24, trench: 20, duct: 17, r90: 7.41, x: 0.165, dia: 7.9 },
    { area: 4, air: 32, trench: 28, duct: 23, r90: 4.61, x: 0.16, dia: 9.9 },
    { area: 6, air: 41, trench: 36, duct: 29, r90: 3.08, x: 0.156, dia: 11.5 },
    { area: 10, air: 57, trench: 50, duct: 41, r90: 1.83, x: 0.149, dia: 14 },
    { area: 16, air: 76, trench: 68, duct: 56, r90: 1.15, x: 0.144, dia: 16.5 },
    { area: 25, air: 101, trench: 92, duct: 76, r90: 0.727, x: 0.139, dia: 19.2 },
    { area: 35, air: 128, trench: 119, duct: 98, r90: 0.524, x: 0.136, dia: 21.6 },
    { area: 50, air: 158, trench: 148, duct: 123, r90: 0.387, x: 0.133, dia: 24.1 },
    { area: 70, air: 206, trench: 196, duct: 163, r90: 0.268, x: 0.13, dia: 27.5 },
    { area: 95, air: 260, trench: 250, duct: 209, r90: 0.193, x: 0.128, dia: 31 },
    { area: 120, air: 308, trench: 298, duct: 250, r90: 0.153, x: 0.127, dia: 34.5 },
    { area: 150, air: 356, trench: 348, duct: 293, r90: 0.124, x: 0.125, dia: 37.6 },
    { area: 185, air: 410, trench: 403, duct: 342, r90: 0.0991, x: 0.124, dia: 41 },
    { area: 240, air: 489, trench: 485, duct: 415, r90: 0.0754, x: 0.122, dia: 45.7 },
    { area: 300, air: 563, trench: 561, duct: 485, r90: 0.0605, x: 0.121, dia: 50.3 },
    { area: 400, air: 666, trench: 667, duct: 582, r90: 0.0453, x: 0.12, dia: 56.3 }
  ];

  // Create a sheet for each core config
  coreConfigs.forEach(coreConfig => {
    const data = catalogSizes.map(s => ({
      'Size (mm²)': s.area,
      'Number of Cores': coreConfig,
      'Air Rating (A)': s.air,
      'Trench Rating (A)': s.trench,
      'Duct Rating (A)': s.duct,
      'Resistance @ 90°C (Ω/km)': s.r90,
      'Reactance (Ω/km)': s.x,
      'Cable Diameter (mm)': s.dia
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, coreConfig);
  });

  // Add derating factors sheet
  const deratingData = [
    { Factor: 'Temperature', Method: 'Air', Value: 1.0, Description: 'Temperature factor for ambient' },
    { Factor: 'Temperature', Method: 'Trench', Value: 0.9, Description: 'Temperature factor for buried' },
    { Factor: 'Temperature', Method: 'Duct', Value: 0.95, Description: 'Temperature factor for duct' },
    { Factor: 'Grouping', Circuits: 1, Factor_Value: 1.0, Description: '1 circuit' },
    { Factor: 'Grouping', Circuits: 2, Factor_Value: 0.9, Description: '2 circuits' },
    { Factor: 'Grouping', Circuits: 3, Factor_Value: 0.8, Description: '3 circuits' },
    { Factor: 'Grouping', Circuits: 4, Factor_Value: 0.75, Description: '4 circuits' },
  ];
  
  const wsDerat = XLSX.utils.json_to_sheet(deratingData);
  wsDerat['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsDerat, 'Derating Factors');

  XLSX.writeFile(wb, 'CATALOG_TEMPLATE.xlsx');
};

interface FeederData {
  id: number;
  [key: string]: any; // Allow any additional columns from Excel
}

interface CableCatalogue {
  size: number;
  cores?: '1C' | '2C' | '3C' | '4C';
  current: number;
  resistance: number;
  reactance: number;
  [key: string]: any;
}

// Professional Loading Component
const LoadingOverlay = ({ message, progress }: { message: string; progress?: number }) => {
  const loadingMessages = [
    "Analyzing electrical parameters...",
    "Processing feeder configurations...",
    "Validating cable specifications...",
    "Calculating load distributions...",
    "Optimizing cable routing paths...",
    "Ensuring electrical safety standards...",
    "Finalizing engineering calculations..."
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center">
          {/* SCEAP Logo/Brand */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mb-4">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <h3 className="text-white font-semibold text-lg">SCEAP</h3>
            <p className="text-slate-400 text-sm">Smart Cable Engineering & Analysis Platform</p>
          </div>

          {/* Circular Progress */}
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - (progress || 0) / 100)}`}
                  className="text-cyan-500 transition-all duration-300 ease-in-out"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            </div>
          </div>

          {/* Loading Message */}
          <div className="space-y-2">
            <p className="text-white font-medium">{message}</p>
            <p className="text-slate-400 text-sm animate-pulse">
              {loadingMessages[Math.floor(Math.random() * loadingMessages.length)]}
            </p>
            {progress && (
              <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SizingTab = () => {
  const { setPathAnalysis: setContextPathAnalysis, setNormalizedFeeders: setContextNormalizedFeeders } = usePathContext();
  const [feederData, setFeederData] = useState<FeederData[]>([]);
  const [feederHeaders, setFeederHeaders] = useState<string[]>([]);
  const [catalogueData, setCatalogueData] = useState<Record<string, CableCatalogue[]>>({});
  const [activeCatalogueTab, setActiveCatalogueTab] = useState<string>('3C');
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [isLoadingFeeder, setIsLoadingFeeder] = useState(false);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pathAnalysis, setPathAnalysis] = useState<any>(null);
  
  // Column mapping modal state
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [rawExcelHeaders, setRawExcelHeaders] = useState<string[]>([]);
  const [rawExcelRows, setRawExcelRows] = useState<any[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string | null>>({});

  // Default cable catalogue
  const defaultCatalogue: CableCatalogue[] = [
    { size: 1.5, current: 20, resistance: 12.1, reactance: 0.08 },
    { size: 2.5, current: 27, resistance: 7.41, reactance: 0.08 },
    { size: 4, current: 36, resistance: 4.61, reactance: 0.07 },
    { size: 6, current: 46, resistance: 3.08, reactance: 0.07 },
    { size: 10, current: 63, resistance: 1.83, reactance: 0.06 },
    { size: 16, current: 85, resistance: 1.15, reactance: 0.06 },
    { size: 25, current: 115, resistance: 0.727, reactance: 0.05 },
    { size: 35, current: 145, resistance: 0.524, reactance: 0.05 },
    { size: 50, current: 180, resistance: 0.387, reactance: 0.04 },
    { size: 70, current: 225, resistance: 0.268, reactance: 0.04 },
    { size: 95, current: 275, resistance: 0.193, reactance: 0.04 },
    { size: 120, current: 320, resistance: 0.153, reactance: 0.03 },
    { size: 150, current: 370, resistance: 0.124, reactance: 0.03 },
    { size: 185, current: 430, resistance: 0.0991, reactance: 0.03 },
    { size: 240, current: 530, resistance: 0.0754, reactance: 0.03 },
    { size: 300, current: 640, resistance: 0.0601, reactance: 0.02 },
    { size: 400, current: 780, resistance: 0.0470, reactance: 0.02 },
    { size: 500, current: 920, resistance: 0.0366, reactance: 0.02 },
    { size: 630, current: 1100, resistance: 0.0283, reactance: 0.02 }
  ];

  const onFeederDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setIsLoadingFeeder(true);
    setLoadingMessage('Reading Excel file...');

    const reader = new FileReader();

    reader.onloadstart = () => {
      setLoadingMessage('Initializing file reader...');
    };

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 30);
        setLoadingMessage(`Reading file... ${progress}%`);
      }
    };

    reader.onload = (e) => {
      try {
        setLoadingMessage('Parsing Excel data...');

        setTimeout(() => setLoadingMessage('Analyzing worksheet structure...'), 200);
        setTimeout(() => setLoadingMessage('Extracting column headers...'), 400);
        setTimeout(() => setLoadingMessage('Processing data rows...'), 600);

        setTimeout(() => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false
          });

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
          });

          if (jsonData.length === 0) {
            alert('No data found in the Excel file');
            setIsLoadingFeeder(false);
            return;
          }

          // First row is headers
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];

          const validRows = rows.filter(row =>
            row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );

          // Convert to feeder data format with original headers
          const feeders: FeederData[] = validRows.map((row, index) => {
            const feeder: any = { id: index + 1 };
            headers.forEach((header, colIndex) => {
              const originalHeader = header || `Column_${colIndex + 1}`;
              feeder[originalHeader] = row[colIndex] || '';
            });
            return feeder as FeederData;
          });

          // Auto-detect column mappings
          const detectedMappings = autoDetectColumnMappings(headers);

          // Store data and show mapping modal
          setRawExcelHeaders(headers);
          setRawExcelRows(feeders);
          setColumnMappings(detectedMappings);
          setShowMappingModal(true);
          setIsLoadingFeeder(false);

          console.log(`Loaded ${feeders.length} feeders with ${headers.length} columns`);
          console.log('Auto-detected mappings:', detectedMappings);
        }, 800);

      } catch (error) {
        console.error('Error parsing Excel file:', error);
        alert('Error parsing Excel file. Please check the file format and try again.');
        setIsLoadingFeeder(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const onCatalogueDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setIsLoadingCatalogue(true);
    setLoadingMessage('Reading cable catalogue...');

    const reader = new FileReader();

    reader.onloadstart = () => {
      setLoadingMessage('Initializing catalogue reader...');
    };

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 30);
        setLoadingMessage(`Reading catalogue... ${progress}%`);
      }
    };

    reader.onload = (e) => {
      try {
        setLoadingMessage('Parsing catalogue data...');

        setTimeout(() => setLoadingMessage('Analyzing cable specifications...'), 200);
        setTimeout(() => setLoadingMessage('Validating electrical parameters...'), 400);
        setTimeout(() => setLoadingMessage('Processing cable sizes...'), 600);

        setTimeout(() => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false
          });

          setLoadingMessage('Extracting cable data from all sheets...');

          // Helper to get column value with flexible naming
          const getColValue = (row: any, ...variations: string[]): any => {
            for (const v of variations) {
              if (v in row && row[v] !== '' && row[v] !== null) return row[v];
            }
            const lowerKeys = Object.keys(row).reduce((acc: any, k) => {
              acc[k.toLowerCase().trim()] = row[k];
              return acc;
            }, {});
            for (const v of variations) {
              const lower = v.toLowerCase().trim();
              if (lower in lowerKeys && lowerKeys[lower] !== '' && lowerKeys[lower] !== null) return lowerKeys[lower];
            }
            return undefined;
          };

          // Read ALL sheets from the workbook
          const allSheetsData: Record<string, CableCatalogue[]> = {};
          let firstSheetName = '3C'; // Default if nothing else found

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
              blankrows: false
            });

            // Map raw Excel data to CableCatalogue format
            const mappedData = jsonData
              .map((row: any): CableCatalogue | null => {
                const size = getColValue(row, 'Size (mm²)', 'size', 'Size', 'Area', 'area');
                const current = getColValue(row, 'Current (A)', 'current', 'Current', 'Air Rating (A)', 'air', 'rating');
                const resistance = getColValue(row, 'Resistance (Ω/km)', 'Resistance (Ohm/km)', 'resistance', 'Resistance @ 90°C (Ω/km)', 'R', 'resistance (ohm/km)');
                const reactance = getColValue(row, 'Reactance (Ω/km)', 'Reactance (Ohm/km)', 'reactance', 'Reactance', 'X', 'reactance (ohm/km)');
                
                // Only include if has size (required field)
                if (size === undefined || size === '' || size === null) return null;
                
                // Safe number parsing
                const parseNum = (val: any): number => {
                  if (val === undefined || val === null || val === '') return 0;
                  const trimmed = String(val).trim().replace('%', '').replace(',', '');
                  const n = Number(trimmed);
                  return Number.isFinite(n) ? n : 0;
                };
                
                return {
                  size: parseNum(size),
                  current: parseNum(current),
                  resistance: parseNum(resistance),
                  reactance: parseNum(reactance),
                  cores: sheetName as any
                };
              })
              .filter((item): item is CableCatalogue => item !== null && item.size > 0);

            if (mappedData.length > 0) {
              allSheetsData[sheetName] = mappedData;
              
              // Set first non-empty sheet as active
              if (Object.keys(allSheetsData).length === 1) {
                firstSheetName = sheetName;
              }

              console.log(`[CATALOGUE] Sheet "${sheetName}": ${mappedData.length} sizes loaded`);
              console.log(`[CATALOGUE] Sample: ${JSON.stringify(mappedData[0])}`);
            }
          });

          setLoadingMessage('Catalogue processing complete!');

          setTimeout(() => {
            setCatalogueData(allSheetsData);
            setActiveCatalogueTab(firstSheetName);
            setIsLoadingCatalogue(false);

            console.log(`Loaded catalogue with sheets: ${Object.keys(allSheetsData).join(', ')}`);
          }, 500);

        }, 800);

      } catch (error) {
        console.error('Error parsing catalogue Excel file:', error);
        alert('Error parsing catalogue Excel file. Please check the file format and try again.');
        setIsLoadingCatalogue(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const feederDropzone = useDropzone({
    onDrop: onFeederDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const catalogueDropzone = useDropzone({
    onDrop: onCatalogueDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const handleRunSizing = async () => {
    setIsCalculating(true);
    // Implementation will be added
    setTimeout(() => setIsCalculating(false), 2000);
  };

  const handleColumnMappingConfirm = (mappings: Record<string, string | null>) => {
    setShowMappingModal(false);
    
    // Re-map raw feeder rows using the confirmed mappings
    const remappedFeeders: FeederData[] = rawExcelRows.map((row, index) => {
      const feeder: any = { id: index + 1 };
      
      // Preserve all original columns first
      Object.keys(row).forEach(originalHeader => {
        feeder[originalHeader] = row[originalHeader];
      });
      
      // Add standardized field columns based on mappings
      Object.entries(mappings).forEach(([fieldName, excelHeader]) => {
        if (excelHeader) {
          feeder[fieldName] = row[excelHeader] || '';
        }
      });
      
      return feeder as FeederData;
    });

    console.log('[COLUMN MAPPING] Remapped feeders (first row):', remappedFeeders[0]);

    // Normalize feeders using expanded column matching
    const normalizedFeeders = normalizeFeeders(remappedFeeders);
    
    console.log('[NORMALIZATION] Normalized feeders (first 3):', normalizedFeeders.slice(0, 3));
    console.log('[NORMALIZATION] Load kW values:', normalizedFeeders.map(f => ({ cable: f.cableNumber, loadKW: f.loadKW })));
    
    const analysis = analyzeAllPaths(normalizedFeeders);

    setFeederData(remappedFeeders);
    setFeederHeaders(rawExcelHeaders);
    setPathAnalysis(analysis);
    setContextPathAnalysis(analysis);
    setContextNormalizedFeeders(normalizedFeeders); // Store normalized feeders for Results page

    console.log(`✓ Processed ${remappedFeeders.length} feeders`);
    console.log(`✓ Discovered ${analysis.totalPaths} paths`);
    console.log(`✓ Valid paths: ${analysis.validPaths}`);
  };

  const handleColumnMappingCancel = () => {
    setShowMappingModal(false);
    setRawExcelHeaders([]);
    setRawExcelRows([]);
    setColumnMappings({});
  };

  const handleEdit = (id: number) => {
    setEditingRow(id);
  };

  const handleSave = (id: number, updatedData: FeederData) => {
    setFeederData(prev => prev.map(item =>
      item.id === id ? updatedData : item
    ));
    setEditingRow(null);
  };

  const handleDelete = (id: number) => {
    setFeederData(prev => prev.filter(item => item.id !== id));
  };

  // Build catalogue: use custom data if available, otherwise use default
  const defaultCatalogueWithCores = defaultCatalogue.map(c => ({ ...c, cores: '3C' as const }));
  const catalogueSheets: Record<string, CableCatalogue[]> = Object.keys(catalogueData).length > 0 ? catalogueData : {
    '3C': defaultCatalogueWithCores
  };
  const catalogueTabs = Object.keys(catalogueSheets);
  const activeCatalogue = (catalogueSheets[activeCatalogueTab] as CableCatalogue[]) || defaultCatalogueWithCores;

  return (
    <div className="space-y-6">
      {/* Column Mapping Modal */}
      {showMappingModal && (
        <ColumnMappingModal
          excelHeaders={rawExcelHeaders}
          parsedRows={rawExcelRows}
          detectedMappings={columnMappings}
          onConfirm={handleColumnMappingConfirm}
          onCancel={handleColumnMappingCancel}
        />
      )}

      {/* Loading Overlay */}
      {(isLoadingFeeder || isLoadingCatalogue) && (
        <LoadingOverlay message={loadingMessage} />
      )}

      {/* Template Download Section */}
      <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-lg p-6 border border-cyan-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
              <FileText className="mr-2" size={20} />
              SCEAP Feeder List Template
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Download our pre-formatted Excel template with all required columns for accurate cable sizing calculations.
              Fill in your data and upload it back for instant analysis.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="bg-slate-700 px-2 py-1 rounded">17 Required Columns</span>
              <span className="bg-slate-700 px-2 py-1 rounded">Sample Data Included</span>
              <span className="bg-slate-700 px-2 py-1 rounded">Instructions Sheet</span>
              <span className="bg-slate-700 px-2 py-1 rounded">Ready for Calculations</span>
            </div>
          </div>
          <button
            onClick={generateFeederTemplate}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Download size={20} />
            Download Template
          </button>
        </div>
      </div>

      {/* Catalog Template Download Section */}
      <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg p-6 border border-green-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
              <FileText className="mr-2" size={20} />
              Cable Catalog Template
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Download the cable catalog template organized by core configurations (1C, 2C, 3C, 4C). 
              Customize it with your own cable sizes and ratings, then upload it for sizing calculations.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="bg-slate-700 px-2 py-1 rounded">4 Core Config Sheets</span>
              <span className="bg-slate-700 px-2 py-1 rounded">Derating Factors Sheet</span>
              <span className="bg-slate-700 px-2 py-1 rounded">Air/Trench/Duct Ratings</span>
              <span className="bg-slate-700 px-2 py-1 rounded">User-Editable</span>
            </div>
          </div>
          <button
            onClick={generateCatalogTemplate}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Download size={20} />
            Download Catalog Template
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feeder List Upload */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Upload className="mr-2" size={20} />
            Upload Feeder List
          </h3>
          <div
            {...feederDropzone.getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              feederDropzone.isDragActive
                ? 'border-cyan-400 bg-cyan-400/10'
                : 'border-slate-600 hover:border-slate-500'
            } ${isLoadingFeeder ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...feederDropzone.getInputProps()} />
            {isLoadingFeeder ? (
              <>
                <Loader2 size={48} className="mx-auto mb-4 text-cyan-400 animate-spin" />
                <p className="text-cyan-400 mb-2 font-medium">Processing feeder data...</p>
                <p className="text-sm text-slate-500">Please wait while we analyze your file</p>
              </>
            ) : (
              <>
                <FileText size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-slate-300 mb-2">
                  {feederDropzone.isDragActive
                    ? 'Drop the Excel file here...'
                    : 'Drag & drop feeder list Excel file, or click to select'}
                </p>
                <p className="text-sm text-slate-500">
                  Supports .xlsx and .xls files
                </p>
              </>
            )}
          </div>
          {feederData.length > 0 && (
            <p className="mt-4 text-green-400 text-sm">
              ✓ {feederData.length} feeders loaded
            </p>
          )}
        </div>

        {/* Cable Catalogue Upload */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Upload className="mr-2" size={20} />
            Upload Cable Catalogue (Optional)
          </h3>
          <div
            {...catalogueDropzone.getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              catalogueDropzone.isDragActive
                ? 'border-cyan-400 bg-cyan-400/10'
                : 'border-slate-600 hover:border-slate-500'
            } ${isLoadingCatalogue ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...catalogueDropzone.getInputProps()} />
            {isLoadingCatalogue ? (
              <>
                <Loader2 size={48} className="mx-auto mb-4 text-cyan-400 animate-spin" />
                <p className="text-cyan-400 mb-2 font-medium">Processing cable catalogue...</p>
                <p className="text-sm text-slate-500">Please wait while we validate specifications</p>
              </>
            ) : (
              <>
                <FileText size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-slate-300 mb-2">
                  {catalogueDropzone.isDragActive
                    ? 'Drop the catalogue file here...'
                    : 'Drag & drop cable catalogue Excel file, or click to select'}
                </p>
                <p className="text-sm text-slate-500">
                  Optional - Default IEC catalogue will be used if not provided
                </p>
              </>
            )}
          </div>
          {catalogueTabs.length > 0 && (
            <p className="mt-4 text-green-400 text-sm">
              ✓ Custom catalogue loaded ({catalogueTabs.length} core configs)
            </p>
          )}
        </div>
      </div>

      {/* Feeder Data Table */}
      {feederData.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">Feeder Data</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {feederData.length} rows × {feederHeaders.length} columns
                </p>
              </div>
              <button
                onClick={handleRunSizing}
                disabled={isCalculating}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium"
              >
                <Calculator size={20} />
                {isCalculating ? 'Calculating...' : 'Run Cable Sizing Engine'}
              </button>
            </div>
          </div>

          {/* Scrollable container with both horizontal and vertical scrolling */}
          <div className="max-h-96 overflow-auto">
            <div className="min-w-full inline-block align-middle">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700 sticky top-0 z-10">
                  <tr>
                    {feederHeaders.map((header, index) => (
                      <th
                        key={index}
                        className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap bg-slate-700"
                        style={{ minWidth: '120px' }}
                      >
                        {header || `Column ${index + 1}`}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap bg-slate-700 sticky right-0">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {feederData.map((feeder) => (
                    <tr key={feeder.id} className="hover:bg-slate-700">
                      {feederHeaders.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-4 py-4 text-sm text-slate-300 whitespace-nowrap"
                          style={{ minWidth: '120px' }}
                        >
                          {editingRow === feeder.id ? (
                            <input
                              type="text"
                              defaultValue={feeder[header] || ''}
                              className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white w-full min-w-0"
                              onBlur={(e) => {
                                const updated = { ...feeder, [header]: e.target.value };
                                handleSave(feeder.id, updated);
                              }}
                            />
                          ) : (
                            <div className="truncate max-w-xs" title={String(feeder[header] || '')}>
                              {feeder[header] || ''}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-4 text-sm font-medium whitespace-nowrap sticky right-0 bg-slate-800">
                        <button
                          onClick={() => handleEdit(feeder.id)}
                          className="text-cyan-400 hover:text-cyan-300 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(feeder.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Path Discovery Summary */}
      {pathAnalysis && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="mr-2" size={20} />
            Cable Path Analysis (For Sizing & Optimization)
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700/50 rounded p-4">
              <p className="text-slate-400 text-sm">Total Paths</p>
              <p className="text-2xl font-bold text-cyan-400">{pathAnalysis.totalPaths}</p>
            </div>
            <div className="bg-slate-700/50 rounded p-4">
              <p className="text-slate-400 text-sm">Valid Paths</p>
              <p className="text-2xl font-bold text-green-400">{pathAnalysis.validPaths}</p>
            </div>
            <div className="bg-slate-700/50 rounded p-4">
              <p className="text-slate-400 text-sm">Invalid Paths</p>
              <p className="text-2xl font-bold text-red-400">{pathAnalysis.invalidPaths}</p>
            </div>
            <div className="bg-slate-700/50 rounded p-4">
              <p className="text-slate-400 text-sm">Avg V-Drop</p>
              <p className="text-2xl font-bold text-yellow-400">{pathAnalysis.averageVoltageDrop.toFixed(2)}%</p>
            </div>
          </div>

          {pathAnalysis.invalidPaths > 0 && (
            <div className="bg-red-900/20 border border-red-600 rounded p-4 mb-4">
              <div className="flex gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-300">
                  <p className="font-semibold mb-1">⚠️ {pathAnalysis.invalidPaths} path(s) exceed voltage drop limits</p>
                  <p className="text-xs opacity-90">These will need larger cable sizes for compliance with IEC 60364 (≤5% limit)</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-900/20 border border-blue-600 rounded p-4">
            <div className="flex gap-3">
              <CheckCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-300">
                <p className="font-semibold mb-1">✓ Paths discovered & ready for optimization</p>
                <p className="text-xs opacity-90">Switch to the <strong>Optimization</strong> tab to view detailed path chains, select optimal cable sizes, and run the sizing engine</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalogue Preview */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Cable Catalogue</h3>
          <span className="text-sm text-slate-400">
            {activeCatalogue.length} cable sizes available
          </span>
        </div>

        {/* Catalogue Tabs */}
        {catalogueTabs.length > 0 && (
          <div className="flex gap-2 mb-4 border-b border-slate-600 pb-3 overflow-x-auto">
            {catalogueTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCatalogueTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  activeCatalogueTab === tab
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-64 overflow-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap">
                  Size (mm²)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap">
                  Current (A)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap">
                  Resistance (Ω/km)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider whitespace-nowrap">
                  Reactance (Ω/km)
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {activeCatalogue.map((item: CableCatalogue, index: number) => (
                <tr key={index} className="hover:bg-slate-700">
                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{item.size}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{item.current}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{item.resistance}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{item.reactance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SizingTab;