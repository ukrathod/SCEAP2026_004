import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileText, Calculator, Edit, Trash2 } from 'lucide-react';

interface FeederData {
  id: number;
  feederDescription: string;
  busA: string;
  busB: string;
  voltage: number;
  pf: number;
  efficiency: number;
  derating: number;
  breaker: string;
  loadKW: number;
  loadKVA: number;
  [key: string]: any;
}

interface CableCatalogue {
  size: number;
  current: number;
  resistance: number;
  reactance: number;
  [key: string]: any;
}

const SizingTab = () => {
  const [feederData, setFeederData] = useState<FeederData[]>([]);
  const [catalogueData, setCatalogueData] = useState<CableCatalogue[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);

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
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Convert to feeder data format
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      const feeders: FeederData[] = rows.map((row, index) => {
        const feeder: any = { id: index + 1 };
        headers.forEach((header, colIndex) => {
          const key = header.toLowerCase().replace(/\s+/g, '');
          feeder[key] = row[colIndex] || '';
        });
        return feeder as FeederData;
      });

      setFeederData(feeders);
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const onCatalogueDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      setCatalogueData(jsonData as CableCatalogue[]);
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

  const catalogue = catalogueData.length > 0 ? catalogueData : defaultCatalogue;

  return (
    <div className="space-y-6">
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
            }`}
          >
            <input {...feederDropzone.getInputProps()} />
            <FileText size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="text-slate-300 mb-2">
              {feederDropzone.isDragActive
                ? 'Drop the Excel file here...'
                : 'Drag & drop feeder list Excel file, or click to select'}
            </p>
            <p className="text-sm text-slate-500">
              Supports .xlsx and .xls files
            </p>
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
            }`}
          >
            <input {...catalogueDropzone.getInputProps()} />
            <FileText size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="text-slate-300 mb-2">
              {catalogueDropzone.isDragActive
                ? 'Drop the catalogue file here...'
                : 'Drag & drop cable catalogue Excel file, or click to select'}
            </p>
            <p className="text-sm text-slate-500">
              Optional - Default IEC catalogue will be used if not provided
            </p>
          </div>
          {catalogueData.length > 0 && (
            <p className="mt-4 text-green-400 text-sm">
              ✓ Custom catalogue loaded ({catalogueData.length} sizes)
            </p>
          )}
        </div>
      </div>

      {/* Feeder Data Table */}
      {feederData.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Feeder Data</h3>
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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  {Object.keys(feederData[0] || {}).map((key) => (
                    key !== 'id' && (
                      <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </th>
                    )
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {feederData.map((feeder) => (
                  <tr key={feeder.id} className="hover:bg-slate-700">
                    {Object.entries(feeder).map(([key, value]) => (
                      key !== 'id' && (
                        <td key={key} className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                          {editingRow === feeder.id ? (
                            <input
                              type="text"
                              defaultValue={value}
                              className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white w-full"
                              onBlur={(e) => {
                                const updated = { ...feeder, [key]: e.target.value };
                                handleSave(feeder.id, updated);
                              }}
                            />
                          ) : (
                            value
                          )}
                        </td>
                      )
                    ))}
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
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
      )}

      {/* Catalogue Preview */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Cable Catalogue</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Size (mm²)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Current (A)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Resistance (Ω/km)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Reactance (Ω/km)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {catalogue.slice(0, 10).map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm text-slate-300">{item.size}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{item.current}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{item.resistance}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{item.reactance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {catalogue.length > 10 && (
          <p className="text-slate-400 text-sm mt-4">
            Showing first 10 sizes. Total: {catalogue.length} sizes available.
          </p>
        )}
      </div>
    </div>
  );
};

export default SizingTab;