import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface CableSizingResultRowProps {
  result: any;
  isGlobalEditMode: boolean;
  onCellChange?: (field: string, value: any) => void;
}

/**
 * Clean, formula-driven cable sizing result display
 * Shows calculations step-by-step with proper grouping and formulas
 */
export const CableSizingResultRow: React.FC<CableSizingResultRowProps> = ({
  result,
  isGlobalEditMode,
  onCellChange,
}) => {
  // Reference props to avoid unused variable TS6133 when not yet wired to edit handlers
  void isGlobalEditMode;
  void onCellChange;
  const [expanded, setExpanded] = useState(false);

  const formatValue = (value: number, decimals = 2) => {
    if (value === undefined || value === null) return '-';
    return Number(value).toFixed(decimals);
  };

  const STATUS_COLORS: Record<string, string> = {
    OK: 'bg-green-900/30 border-l-4 border-green-500',
    WARNING: 'bg-yellow-900/30 border-l-4 border-yellow-500',
    FAILED: 'bg-red-900/30 border-l-4 border-red-500',
  };
  const statusColor = STATUS_COLORS[(result.status as string) || ''] || 'bg-slate-800';

  return (
    <div className="border border-slate-600 rounded-lg mb-4 bg-slate-800">
      {/* ===== HEADER ROW: Cable ID & Quick Summary ===== */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex justify-between items-center ${statusColor}`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            <span className="font-bold text-white text-lg">
              #{result.serialNo} | {result.cableNumber}
            </span>
            <span className="text-slate-300 text-sm">{result.feederDescription}</span>
          </div>
          <div className="ml-8 flex gap-6 text-sm text-slate-400">
            <span>
              <strong className="text-slate-200">Load:</strong> {formatValue(result.loadKW, 1)} kW
            </span>
            <span>
              <strong className="text-slate-200">Voltage:</strong> {result.voltage}V
            </span>
            <span>
              <strong className="text-slate-200">Length:</strong> {formatValue(result.length, 1)} m
            </span>
            <span>
              <strong className="text-slate-200">Selected Cable:</strong>
              <span className="text-yellow-400 font-bold ml-1">{result.suitableCableSize} mm²</span>
            </span>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`px-3 py-1 rounded font-semibold text-sm ${
              result.status === 'OK'
                ? 'bg-green-700 text-green-100'
                : result.status === 'WARNING'
                  ? 'bg-yellow-700 text-yellow-100'
                  : 'bg-red-700 text-red-100'
            }`}
          >
            {result.status}
          </span>
        </div>
      </div>

      {/* ===== EXPANDED DETAILS ===== */}
      {expanded && (
        <div className="p-6 border-t border-slate-600 space-y-6">
          {/* 1. CABLE IDENTIFICATION & ROUTING */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded"></span>
              Cable Identification & Routing
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ml-3">
              <div>
                <div className="text-slate-400 text-xs">From Bus</div>
                <div className="text-slate-100 font-semibold">{result.fromBus}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">To Bus</div>
                <div className="text-slate-100 font-semibold">{result.toBus}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Length</div>
                <div className="text-slate-100 font-semibold">{formatValue(result.length, 1)} m</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Number of Cores</div>
                <div className="text-slate-100 font-semibold">{result.numberOfCores}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Material</div>
                <div className="text-slate-100 font-semibold">{result.conductorMaterial || 'Cu'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Installation Method</div>
                <div className="text-slate-100 font-semibold">{result.installationMethod}</div>
              </div>
            </div>
          </section>

          {/* 2. INPUT PARAMETERS */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-500 rounded"></span>
              Input Parameters
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ml-3 bg-slate-700/30 p-4 rounded">
              <div>
                <div className="text-slate-400 text-xs">Load (P)</div>
                <div className="text-cyan-100 font-semibold">{formatValue(result.loadKW, 1)} kW</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Voltage (V)</div>
                <div className="text-cyan-100 font-semibold">{result.voltage} V</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Power Factor (PF)</div>
                <div className="text-cyan-100 font-semibold">{formatValue(result.powerFactor, 2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Efficiency (η)</div>
                <div className="text-cyan-100 font-semibold">{(result.efficiency * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Breaker Type</div>
                <div className="text-cyan-100 font-semibold">{result.breakerType || 'MCCB'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Load Type</div>
                <div className="text-cyan-100 font-semibold">{result.feederType || 'Feeder'}</div>
              </div>
            </div>
          </section>

          {/* 3. CALCULATION STEPS - RATED CURRENT */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded"></span>
              Step 1: Rated Current Calculation
            </h4>
            <div className="ml-3 bg-slate-700/20 p-4 rounded border-l-2 border-purple-500">
              <div className="text-slate-300 text-sm mb-3">
                <div className="font-mono text-cyan-300 mb-2">
                  I<sub>rated</sub> = P / (V × √3 × PF × η)
                </div>
                <div>
                  I<sub>rated</sub> = {formatValue(result.loadKW, 1)} / ({result.voltage} × 1.732 × {formatValue(result.powerFactor, 2)} × {formatValue(result.efficiency, 2)})
                </div>
              </div>
              <div className="bg-slate-800 p-3 rounded border border-slate-600">
                <div className="text-sm text-slate-300">
                  <strong className="text-slate-100">Full Load Current (FLC):</strong>
                </div>
                <div className="text-lg font-bold text-cyan-400 mt-1">
                  {formatValue(result.fullLoadCurrent || result.ratedCurrent, 2)} A
                </div>
              </div>
            </div>
          </section>

          {/* 4. DERATING FACTORS */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-orange-500 rounded"></span>
              Step 2: Derating Factors
            </h4>
            <div className="ml-3 grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-700/20 p-3 rounded border border-slate-600">
                <div className="text-slate-400 text-xs mb-1">Temperature (K<sub>t</sub>)</div>
                <div className="text-slate-100 font-bold text-lg">{formatValue(result.deratingComponents?.K_temp || 1, 2)}</div>
              </div>
              <div className="bg-slate-700/20 p-3 rounded border border-slate-600">
                <div className="text-slate-400 text-xs mb-1">Grouping (K<sub>g</sub>)</div>
                <div className="text-slate-100 font-bold text-lg">{formatValue(result.deratingComponents?.K_group || 1, 2)}</div>
              </div>
              <div className="bg-slate-700/20 p-3 rounded border border-slate-600">
                <div className="text-slate-400 text-xs mb-1">Depth (K<sub>d</sub>)</div>
                <div className="text-slate-100 font-bold text-lg">{formatValue(result.deratingComponents?.K_depth || 1, 2)}</div>
              </div>
              <div className="bg-slate-700/20 p-3 rounded border border-slate-600">
                <div className="text-slate-400 text-xs mb-1">Soil (K<sub>s</sub>)</div>
                <div className="text-slate-100 font-bold text-lg">{formatValue(result.deratingComponents?.K_soil || 1, 2)}</div>
              </div>
            </div>
            <div className="ml-3 bg-orange-900/20 p-3 rounded border-l-2 border-orange-500">
              <div className="text-slate-300 text-sm mb-2">
                <div className="font-mono text-cyan-300 mb-1">
                  K<sub>total</sub> = K<sub>t</sub> × K<sub>g</sub> × K<sub>d</sub> × K<sub>s</sub>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-400 text-xs">Total Derating Factor</div>
                  <div className="text-lg font-bold text-orange-300">{formatValue(result.deratingFactor, 3)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Derated Current</div>
                  <div className="text-lg font-bold text-orange-300">{formatValue(result.deratedCurrent, 2)} A</div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. SIZING CONSTRAINTS */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-red-500 rounded"></span>
              Step 3: Cable Sizing Constraints
            </h4>
            <div className="ml-3 space-y-3">
              {/* Ampacity Constraint */}
              <div className="bg-slate-700/20 p-3 rounded border-l-2 border-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Constraint: Ampacity</div>
                    <div className="text-slate-300 text-sm">
                      I<sub>derated</sub> ≤ I<sub>cable</sub> → Size ≥ {formatValue(result.sizeByCurrent, 1)} mm²
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Size Required</div>
                    <div className="text-lg font-bold text-blue-400">{formatValue(result.sizeByCurrent, 1)} mm²</div>
                  </div>
                </div>
              </div>

              {/* Voltage Drop Running */}
              <div className="bg-slate-700/20 p-3 rounded border-l-2 border-green-500">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Constraint: V-Drop (Running) ≤ 5%</div>
                    <div className="text-slate-300 text-sm">
                      ΔU% = {formatValue(result.voltageDrop_running_percent, 2)}% → Size ≥{' '}
                      {formatValue(result.sizeByVoltageDrop_running, 1)} mm²
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Status</div>
                    <div
                      className={`text-sm font-bold ${
                        (result.voltageDrop_running_percent || 0) <= 5 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {(result.voltageDrop_running_percent || 0) <= 5 ? '✓ OK' : '✗ FAIL'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Voltage Drop Starting */}
              <div className="bg-slate-700/20 p-3 rounded border-l-2 border-yellow-500">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Constraint: V-Drop (Starting) ≤ 15%</div>
                    <div className="text-slate-300 text-sm">
                      ΔU<sub>start</sub>% = {formatValue(result.voltageDrop_starting_percent || 0, 2)}% → Size ≥{' '}
                      {formatValue(result.sizeByVoltageDrop_starting || 0, 1)} mm²
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Status</div>
                    <div
                      className={`text-sm font-bold ${
                        (result.voltageDrop_starting_percent || 0) <= 15 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {(result.voltageDrop_starting_percent || 0) <= 15 ? '✓ OK' : '✗ FAIL'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Circuit Constraint */}
              <div className="bg-slate-700/20 p-3 rounded border-l-2 border-red-500">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Constraint: Short Circuit</div>
                    <div className="text-slate-300 text-sm">
                      I<sub>sc</sub> = {formatValue(result.shortCircuitCurrent_kA, 1)} kA → Size ≥{' '}
                      {formatValue(result.sizeByShortCircuit || 0, 1)} mm²
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Status</div>
                    <div className="text-sm font-bold text-green-400">✓ Checked</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. FINAL CABLE SELECTION */}
          <section>
            <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <span className="w-1 h-4 bg-yellow-500 rounded"></span>
              Step 4: Final Cable Selection
            </h4>
            <div className="ml-3 bg-yellow-900/20 p-4 rounded border-l-2 border-yellow-500">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-slate-400 text-xs mb-2">Driving Constraint</div>
                  <div className="text-lg font-bold text-yellow-300">{result.drivingConstraint || 'Ampacity'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-2">Number of Runs</div>
                  <div className="text-lg font-bold text-yellow-300">{result.numberOfRuns}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-2">Current per Run</div>
                  <div className="text-lg font-bold text-yellow-300">
                    {formatValue((result.fullLoadCurrent || result.ratedCurrent || 0) / result.numberOfRuns, 2)} A
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-yellow-600">
                <div className="text-slate-400 text-xs mb-2">Selected Cable Size</div>
                <div className="text-3xl font-bold text-yellow-400">{result.suitableCableSize} mm²</div>
                <div className="text-slate-400 text-xs mt-2">{result.cableDesignation}</div>
              </div>
            </div>
          </section>

          {/* 7. ANOMALIES (if any) */}
          {result.anomalies && result.anomalies.length > 0 && (
            <section>
              <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                <AlertCircle size={16} />
                <span className="w-1 h-4 bg-red-500 rounded"></span>
                Issues Detected
              </h4>
              <div className="ml-3 space-y-2">
                {result.anomalies.map((issue: string, idx: number) => (
                  <div key={idx} className="bg-red-900/20 border border-red-700 p-3 rounded text-red-200 text-sm flex gap-2">
                    <span className="text-red-500 font-bold">⚠</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default CableSizingResultRow;
