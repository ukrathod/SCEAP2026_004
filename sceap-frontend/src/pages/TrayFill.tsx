import { useState } from 'react';
import { PageHeader, DataTable } from '../components/Dashboard';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface TrayData {
  id: number;
  name: string;
  length: number;
  width: number;
  fillRatio: number;
  capacity: number;
  status: string;
  issues: number;
}

const TrayFill = () => {
  const [trays, setTrays] = useState<TrayData[]>([
    { id: 1, name: 'Tray-01', length: 10, width: 0.3, fillRatio: 0.85, capacity: 20, status: 'High', issues: 2 },
    { id: 2, name: 'Tray-02', length: 15, width: 0.3, fillRatio: 0.92, capacity: 25, status: 'Critical', issues: 1 },
    { id: 3, name: 'Tray-03', length: 8, width: 0.3, fillRatio: 0.67, capacity: 18, status: 'Normal', issues: 0 },
    { id: 4, name: 'Tray-04', length: 12, width: 0.3, fillRatio: 0.78, capacity: 22, status: 'High', issues: 1 },
    { id: 5, name: 'Tray-05', length: 20, width: 0.3, fillRatio: 0.45, capacity: 30, status: 'Low', issues: 0 }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return 'text-red-400';
      case 'High': return 'text-yellow-400';
      case 'Normal': return 'text-green-400';
      case 'Low': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Critical':
      case 'High':
        return <AlertTriangle size={16} className="text-red-400" />;
      case 'Normal':
        return <CheckCircle size={16} className="text-green-400" />;
      default:
        return <TrendingUp size={16} className="text-blue-400" />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Tray Fill Monitoring"
        subtitle="Monitor cable tray utilization and identify optimization opportunities"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Trays</p>
              <p className="text-2xl font-bold text-white">{trays.length}</p>
            </div>
            <TrendingUp size={24} className="text-cyan-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Overloaded</p>
              <p className="text-2xl font-bold text-red-400">
                {trays.filter(t => t.fillRatio > 0.9).length}
              </p>
            </div>
            <AlertTriangle size={24} className="text-red-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Underutilized</p>
              <p className="text-2xl font-bold text-yellow-400">
                {trays.filter(t => t.fillRatio < 0.5).length}
              </p>
            </div>
            <TrendingUp size={24} className="text-yellow-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Avg Fill Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {(trays.reduce((sum, t) => sum + t.fillRatio, 0) / trays.length * 100).toFixed(1)}%
              </p>
            </div>
            <CheckCircle size={24} className="text-green-400" />
          </div>
        </div>
      </div>

      {/* Tray Fill Visualization */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Tray Fill Status</h3>
        <div className="space-y-4">
          {trays.map((tray) => (
            <div key={tray.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
              <div className="flex items-center gap-4">
                {getStatusIcon(tray.status)}
                <div>
                  <h4 className="text-white font-medium">{tray.name}</h4>
                  <p className="text-slate-400 text-sm">
                    {tray.length}m × {tray.width}m • Capacity: {tray.capacity} cables
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`font-semibold ${getStatusColor(tray.status)}`}>
                    {(tray.fillRatio * 100).toFixed(1)}%
                  </p>
                  <p className="text-slate-400 text-sm">
                    {Math.round(tray.fillRatio * tray.capacity)}/{tray.capacity} cables
                  </p>
                </div>

                <div className="w-32">
                  <div className="w-full bg-slate-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        tray.fillRatio > 0.9 ? 'bg-red-500' :
                        tray.fillRatio > 0.75 ? 'bg-yellow-500' :
                        tray.fillRatio > 0.5 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${tray.fillRatio * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Tray Details</h3>
        <DataTable
          columns={['Name', 'Length (m)', 'Width (m)', 'Fill Ratio', 'Capacity', 'Status', 'Issues']}
          data={trays.map(tray => ({
            name: tray.name,
            length: tray.length.toString(),
            width: tray.width.toString(),
            fillRatio: `${(tray.fillRatio * 100).toFixed(1)}%`,
            capacity: tray.capacity.toString(),
            status: tray.status,
            issues: tray.issues.toString()
          }))}
        />
      </div>
    </div>
  );
};

export default TrayFill;