import { useState } from 'react';
import { Download, Edit, FileText, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ResultData {
  id: number;
  cableNumber: string;
  feederDescription: string;
  voltage: number;
  efficiency: number;
  pf: number;
  derating: number;
  fullLoadCurrent: number;
  deratedCurrent: number;
  voltageDrop: number;
  voltageDropPercent: number;
  shortCircuitCurrent: number;
  sizeByCurrent: number;
  sizeByVoltageDrop: number;
  sizeByShortCircuit: number;
  suitableCableSize: number;
  breaker: string;
  status: 'calculated' | 'pending' | 'error';
}

const ResultsTab = () => {
  const [results, setResults] = useState<ResultData[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);

  // Mock results data - in real implementation, this would come from the backend
  const mockResults: ResultData[] = [
    {
      id: 1,
      cableNumber: 'CBL-001',
      feederDescription: 'TRF to PMCC-1',
      voltage: 415,
      efficiency: 0.95,
      pf: 0.85,
      derating: 0.87,
      fullLoadCurrent: 125.5,
      deratedCurrent: 109.2,
      voltageDrop: 8.2,
      voltageDropPercent: 2.1,
      shortCircuitCurrent: 15000,
      sizeByCurrent: 25,
      sizeByVoltageDrop: 35,
      sizeByShortCircuit: 25,
      suitableCableSize: 35,
      breaker: 'ACB-125A',
      status: 'calculated'
    },
    {
      id: 2,
      cableNumber: 'CBL-002',
      feederDescription: 'PMCC-1 to MCC-1',
      voltage: 415,
      efficiency: 0.92,
      pf: 0.88,
      derating: 0.85,
      fullLoadCurrent: 95.8,
      deratedCurrent: 81.4,
      voltageDrop: 12.5,
      voltageDropPercent: 3.2,
      shortCircuitCurrent: 12000,
      sizeByCurrent: 16,
      sizeByVoltageDrop: 25,
      sizeByShortCircuit: 16,
      suitableCableSize: 25,
      breaker: 'MCCB-100A',
      status: 'calculated'
    },
    {
      id: 3,
      cableNumber: 'CBL-003',
      feederDescription: 'MCC-1 to MOTOR-1',
      voltage: 415,
      efficiency: 0.89,
      pf: 0.82,
      derating: 0.90,
      fullLoadCurrent: 145.2,
      deratedCurrent: 130.7,
      voltageDrop: 18.7,
      voltageDropPercent: 4.8,
      shortCircuitCurrent: 8500,
      sizeByCurrent: 35,
      sizeByVoltageDrop: 50,
      sizeByShortCircuit: 35,
      suitableCableSize: 50,
      breaker: 'MCCB-160A',
      status: 'calculated'
    }
  ];

  // Initialize with mock data if empty
  useState(() => {
    if (results.length === 0) {
      setResults(mockResults);
    }
  });

  const handleEdit = (id: number) => {
    setEditingRow(id);
  };

  const handleSave = (id: number, updatedData: ResultData) => {
    setResults(prev => prev.map(item =>
      item.id === id ? updatedData : item
    ));
    setEditingRow(null);
  };

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cable Sizing Results');
    XLSX.writeFile(workbook, 'cable_sizing_results.xlsx');
  };

  const handleExportPDF = () => {
    // In a real implementation, this would generate a PDF
    alert('PDF export functionality would be implemented here');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'calculated': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <FileText className="mr-2" size={20} />
            Cable Sizing Results
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleExportExcel}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">{results.length}</p>
            <p className="text-slate-400">Total Cables</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {results.filter(r => r.status === 'calculated').length}
            </p>
            <p className="text-slate-400">Calculated</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {results.filter(r => r.voltageDropPercent > 5).length}
            </p>
            <p className="text-slate-400">High V-Drop</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">
              {results.reduce((sum, r) => sum + r.suitableCableSize, 0) / results.length || 0} mm²
            </p>
            <p className="text-slate-400">Avg Size</p>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Cable #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Voltage (V)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  PF
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Eff (%)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Derating
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  FLC (A)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Derated (A)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  V-Drop (%)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Isc (kA)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Size by Current
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Size by V-Drop
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Size by Isc
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Suitable Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Breaker
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {results.map((result) => (
                <tr key={result.id} className="hover:bg-slate-700">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {editingRow === result.id ? (
                      <input
                        type="text"
                        defaultValue={result.cableNumber}
                        className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white w-full"
                        onBlur={(e) => {
                          const updated = { ...result, cableNumber: e.target.value };
                          handleSave(result.id, updated);
                        }}
                      />
                    ) : (
                      result.cableNumber
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {editingRow === result.id ? (
                      <input
                        type="text"
                        defaultValue={result.feederDescription}
                        className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white w-full"
                        onBlur={(e) => {
                          const updated = { ...result, feederDescription: e.target.value };
                          handleSave(result.id, updated);
                        }}
                      />
                    ) : (
                      result.feederDescription
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {editingRow === result.id ? (
                      <input
                        type="number"
                        defaultValue={result.voltage}
                        className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white w-full"
                        onBlur={(e) => {
                          const updated = { ...result, voltage: parseFloat(e.target.value) };
                          handleSave(result.id, updated);
                        }}
                      />
                    ) : (
                      result.voltage
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.pf}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {(result.efficiency * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.derating}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.fullLoadCurrent.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.deratedCurrent.toFixed(1)}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${
                    result.voltageDropPercent > 5 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {result.voltageDropPercent.toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {(result.shortCircuitCurrent / 1000).toFixed(1)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.sizeByCurrent} mm²
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.sizeByVoltageDrop} mm²
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.sizeByShortCircuit} mm²
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-cyan-400">
                    {result.suitableCableSize} mm²
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                    {result.breaker}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <span className={`capitalize ${getStatusColor(result.status)}`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(result.id)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-medium mb-4">Cable Size Distribution</h4>
          <div className="space-y-2">
            {Object.entries(
              results.reduce((acc, r) => {
                acc[r.suitableCableSize] = (acc[r.suitableCableSize] || 0) + 1;
                return acc;
              }, {} as Record<number, number>)
            ).map(([size, count]) => (
              <div key={size} className="flex justify-between text-sm">
                <span className="text-slate-300">{size} mm²</span>
                <span className="text-cyan-400">{count} cables</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-medium mb-4">Voltage Drop Analysis</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Within 3%</span>
              <span className="text-green-400">
                {results.filter(r => r.voltageDropPercent <= 3).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">3-5%</span>
              <span className="text-yellow-400">
                {results.filter(r => r.voltageDropPercent > 3 && r.voltageDropPercent <= 5).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Above 5%</span>
              <span className="text-red-400">
                {results.filter(r => r.voltageDropPercent > 5).length}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-medium mb-4">Breaker Types</h4>
          <div className="space-y-2">
            {Object.entries(
              results.reduce((acc, r) => {
                const type = r.breaker.split('-')[0];
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-slate-300">{type}</span>
                <span className="text-cyan-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsTab;