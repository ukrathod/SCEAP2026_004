import { useState, useEffect } from 'react';
import { Search, Edit, ArrowRight, Network } from 'lucide-react';

interface PathNode {
  id: string;
  name: string;
  type: 'transformer' | 'panel' | 'equipment' | 'load';
  bus: 'A' | 'B';
  level: number;
}

interface Path {
  id: string;
  nodes: PathNode[];
  totalVoltageDrop: number;
  isValid: boolean;
}

const OptimizationTab = () => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Mock data - in real implementation, this would be generated from feeder data
  useEffect(() => {
    const mockPaths: Path[] = [
      {
        id: 'path-1',
        nodes: [
          { id: 'trf-1', name: 'TRF-415V', type: 'transformer', bus: 'A', level: 1 },
          { id: 'pmcc-1', name: 'PMCC-1', type: 'panel', bus: 'A', level: 2 },
          { id: 'mcc-1', name: 'MCC-1', type: 'panel', bus: 'A', level: 3 },
          { id: 'motor-1', name: 'MOTOR-1 (75kW)', type: 'load', bus: 'A', level: 4 }
        ],
        totalVoltageDrop: 3.2,
        isValid: true
      },
      {
        id: 'path-2',
        nodes: [
          { id: 'trf-1', name: 'TRF-415V', type: 'transformer', bus: 'A', level: 1 },
          { id: 'pmcc-1', name: 'PMCC-1', type: 'panel', bus: 'A', level: 2 },
          { id: 'mcc-2', name: 'MCC-2', type: 'panel', bus: 'A', level: 3 },
          { id: 'motor-2', name: 'MOTOR-2 (55kW)', type: 'load', bus: 'A', level: 4 }
        ],
        totalVoltageDrop: 3.8,
        isValid: true
      },
      {
        id: 'path-3',
        nodes: [
          { id: 'trf-1', name: 'TRF-415V', type: 'transformer', bus: 'B', level: 1 },
          { id: 'pmcc-2', name: 'PMCC-2', type: 'panel', bus: 'B', level: 2 },
          { id: 'db-1', name: 'DB-1', type: 'panel', bus: 'B', level: 3 },
          { id: 'light-1', name: 'LIGHTING-1 (12kW)', type: 'load', bus: 'B', level: 4 }
        ],
        totalVoltageDrop: 2.1,
        isValid: true
      },
      {
        id: 'path-4',
        nodes: [
          { id: 'trf-1', name: 'TRF-415V', type: 'transformer', bus: 'A', level: 1 },
          { id: 'pmcc-1', name: 'PMCC-1', type: 'panel', bus: 'A', level: 2 },
          { id: 'vfd-1', name: 'VFD-1', type: 'equipment', bus: 'A', level: 3 },
          { id: 'motor-3', name: 'MOTOR-3 (90kW)', type: 'load', bus: 'A', level: 4 }
        ],
        totalVoltageDrop: 4.7,
        isValid: false // Exceeds 5% limit
      }
    ];

    setPaths(mockPaths);
  }, []);

  const filteredPaths = paths.filter(path =>
    path.nodes.some(node =>
      node.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'transformer': return 'bg-purple-600';
      case 'panel': return 'bg-blue-600';
      case 'equipment': return 'bg-green-600';
      case 'load': return 'bg-orange-600';
      default: return 'bg-slate-600';
    }
  };

  const getBusColor = (bus: 'A' | 'B') => {
    return bus === 'A' ? 'border-blue-400' : 'border-green-400';
  };

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Network className="mr-2" size={20} />
            Path Optimization
          </h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search equipment or panel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">{paths.length}</p>
            <p className="text-slate-400">Total Paths</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {paths.filter(p => p.isValid).length}
            </p>
            <p className="text-slate-400">Valid Paths</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">
              {paths.filter(p => !p.isValid).length}
            </p>
            <p className="text-slate-400">Invalid Paths</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {(paths.reduce((sum, p) => sum + p.totalVoltageDrop, 0) / paths.length).toFixed(1)}%
            </p>
            <p className="text-slate-400">Avg V-Drop</p>
          </div>
        </div>
      </div>

      {/* Path Visualization */}
      <div className="space-y-4">
        {filteredPaths.map((path) => (
          <div
            key={path.id}
            className={`bg-slate-800 rounded-lg border p-6 cursor-pointer transition-all ${
              selectedPath === path.id ? 'border-cyan-400 bg-slate-700' : 'border-slate-700 hover:border-slate-600'
            } ${!path.isValid ? 'opacity-75' : ''}`}
            onClick={() => setSelectedPath(selectedPath === path.id ? null : path.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h4 className="text-white font-medium">Path {path.id.split('-')[1]}</h4>
                <span className={`px-2 py-1 rounded text-xs ${
                  path.isValid ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                }`}>
                  {path.isValid ? 'Valid' : 'Invalid'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-slate-300 text-sm">Total Voltage Drop</p>
                <p className={`font-bold ${path.isValid ? 'text-green-400' : 'text-red-400'}`}>
                  {path.totalVoltageDrop}%
                </p>
              </div>
            </div>

            {/* Path Flow */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {path.nodes.map((node, index) => (
                <div key={node.id} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`px-3 py-2 rounded-lg border-2 ${getBusColor(node.bus)} ${getNodeColor(node.type)}`}>
                    <div className="text-white text-xs font-medium">{node.name}</div>
                    <div className="text-slate-300 text-xs">Bus {node.bus}</div>
                  </div>
                  {index < path.nodes.length - 1 && (
                    <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Expanded Details */}
            {selectedPath === path.id && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {path.nodes.map((node) => (
                    <div key={node.id} className="bg-slate-700 rounded p-3">
                      <h5 className="text-white font-medium text-sm mb-2">{node.name}</h5>
                      <div className="space-y-1 text-xs">
                        <p className="text-slate-300">Type: <span className="text-white capitalize">{node.type}</span></p>
                        <p className="text-slate-300">Bus: <span className="text-white">{node.bus}</span></p>
                        <p className="text-slate-300">Level: <span className="text-white">{node.level}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h4 className="text-white font-medium mb-4">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded"></div>
            <span className="text-slate-300 text-sm">Transformer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span className="text-slate-300 text-sm">Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span className="text-slate-300 text-sm">Equipment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded"></div>
            <span className="text-slate-300 text-sm">Load</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-400"></div>
              <span className="text-slate-300">Bus A</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-400"></div>
              <span className="text-slate-300">Bus B</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationTab;