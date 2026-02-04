import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Eye } from 'lucide-react';

interface ColumnMappingConfig {
  [excelHeader: string]: string | null; // maps Excel header to standardized field name
}

interface ColumnMappingModalProps {
  excelHeaders: string[];
  parsedRows: any[];
  onConfirm: (config: ColumnMappingConfig) => void;
  onCancel: () => void;
  detectedMappings: ColumnMappingConfig;
}

const STANDARD_FIELDS = [
  { name: 'serialNo', label: 'Serial No', examples: ['Serial No', 'S.No', 'SNo', 'Index', 'No'] },
  { name: 'cableNumber', label: 'Cable Number', examples: ['Cable Number', 'Cable No', 'Cable', 'Feeder ID', 'ID'] },
  { name: 'feederDescription', label: 'Feeder Description', examples: ['Feeder Description', 'Description', 'Name', 'Desc'] },
  { name: 'fromBus', label: 'From Bus', examples: ['From Bus', 'From', 'Source', 'Load', 'Equipment'] },
  { name: 'toBus', label: 'To Bus', examples: ['To Bus', 'To', 'Destination', 'Panel', 'Source'] },
  { name: 'voltage', label: 'Voltage (V)', examples: ['Voltage (V)', 'Voltage', 'V (V)', 'V', 'Nominal Voltage'] },
  { name: 'loadKW', label: 'Load (kW)', examples: ['Load (kW)', 'Load KW', 'kW', 'Power', 'P'] },
  { name: 'length', label: 'Length (m)', examples: ['Length (m)', 'Length', 'L (m)', 'L', 'Distance'] },
  { name: 'powerFactor', label: 'Power Factor', examples: ['Power Factor', 'PF', 'Cos φ'] },
  { name: 'efficiency', label: 'Efficiency', examples: ['Efficiency (%)', 'Efficiency', 'Eff'] },
  { name: 'deratingFactor', label: 'Derating Factor', examples: ['Derating Factor', 'Derating', 'K', 'Factor'] },
  { name: 'ambientTemp', label: 'Ambient Temp (°C)', examples: ['Ambient Temp (°C)', 'Ambient Temp', 'Temp'] },
  { name: 'installationMethod', label: 'Installation Method', examples: ['Installation Method', 'Installation', 'Method', 'Type'] },
  { name: 'numberOfLoadedCircuits', label: 'Grouped Loaded Circuits', examples: ['Grouped Loaded Circuits', 'Circuits', 'Groups'] },
  { name: 'protectionType', label: 'Breaker Type', examples: ['Breaker Type', 'Protection Type', 'Breaker', 'Protection'] },
  { name: 'maxShortCircuitCurrent', label: 'Short Circuit Current (kA)', examples: ['Short Circuit Current (kA)', 'ISc', 'Isc', 'SC Current'] }
];

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  excelHeaders,
  parsedRows,
  onConfirm,
  onCancel,
  detectedMappings
}) => {
  const [mappings, setMappings] = useState<ColumnMappingConfig>(detectedMappings);
  const [showPreview, setShowPreview] = useState(false);

  const handleMappingChange = (fieldName: string, excelHeader: string | null) => {
    setMappings(prev => ({
      ...prev,
      [fieldName]: excelHeader
    }));
  };

  const unmappedHeaders = excelHeaders.filter(
    h => !Object.values(mappings).includes(h)
  );

  const criticalFields = ['fromBus', 'toBus', 'cableNumber', 'loadKW', 'voltage', 'length'];
  const criticalFieldsMissing = criticalFields.filter(f => !mappings[f]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-50 border-b border-blue-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Column Mapping</h2>
            <p className="text-sm text-gray-600 mt-1">Match Excel columns to system fields. Critical fields marked with *</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Excel Columns Detected</p>
              <p className="text-2xl font-bold text-blue-600">{excelHeaders.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600">Data Rows</p>
              <p className="text-2xl font-bold text-green-600">{parsedRows.length}</p>
            </div>
          </div>

          {/* Critical Fields Status */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-3">Critical Fields Status</p>
            <div className="flex flex-wrap gap-2">
              {criticalFields.map(f => {
                const field = STANDARD_FIELDS.find(sf => sf.name === f);
                const isMapped = mappings[f];
                return (
                  <span
                    key={f}
                    className={`px-3 py-1 rounded text-sm font-medium flex items-center gap-2 ${
                      isMapped
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isMapped ? '✓' : '✗'} {field?.label}
                  </span>
                );
              })}
            </div>
            {criticalFieldsMissing.length > 0 && (
              <p className="text-xs text-red-700 mt-3">
                Missing: {criticalFieldsMissing.map(f => STANDARD_FIELDS.find(sf => sf.name === f)?.label).join(', ')}
              </p>
            )}
          </div>

          {/* Mapping Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="text-left p-3 font-semibold">System Field</th>
                  <th className="text-left p-3 font-semibold">Mapped Excel Column</th>
                  <th className="text-left p-3 font-semibold">Examples</th>
                </tr>
              </thead>
              <tbody>
                {STANDARD_FIELDS.map(field => {
                  const currentMapping = mappings[field.name];
                  const isCritical = criticalFields.includes(field.name);
                  const isMapped = currentMapping !== null && currentMapping !== undefined;

                  return (
                    <tr
                      key={field.name}
                      className={`border-b border-gray-200 ${
                        isCritical ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-3 font-medium text-gray-900">
                        {isCritical && <span className="text-red-600">* </span>}
                        {field.label}
                      </td>
                      <td className="p-3">
                        <select
                          value={currentMapping || ''}
                          onChange={(e) => handleMappingChange(field.name, e.target.value || null)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${
                            isMapped
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">-- Not Mapped --</option>
                          {excelHeaders.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        {field.examples.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Unmapped Columns Warning */}
          {unmappedHeaders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                Unmapped Excel Columns ({unmappedHeaders.length})
              </p>
              <p className="text-xs text-amber-700">
                {unmappedHeaders.join(', ')} will not be used
              </p>
            </div>
          )}

          {/* Data Preview */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full p-4 bg-gray-100 hover:bg-gray-200 flex items-center gap-2 font-semibold text-gray-900 transition"
            >
              <Eye size={18} />
              {showPreview ? 'Hide' : 'Show'} Data Preview
            </button>
            {showPreview && (
              <div className="overflow-x-auto max-h-48 bg-white">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      {Object.entries(mappings)
                        .filter(([_, v]) => v !== null)
                        .map(([fieldName]) => (
                          <th key={fieldName} className="border p-2 text-left">
                            {STANDARD_FIELDS.find(f => f.name === fieldName)?.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {Object.entries(mappings)
                          .filter(([_, v]) => v !== null)
                          .map(([_, excelHeader]) => (
                            <td key={excelHeader || idx} className="border p-2 text-gray-700">
                              {String(excelHeader && row[excelHeader] ? row[excelHeader] : '-').substring(0, 20)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-300 p-6 flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mappings)}
            disabled={criticalFieldsMissing.length > 0}
            className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition ${
              criticalFieldsMissing.length > 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <CheckCircle size={18} />
            Confirm Mapping
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingModal;
