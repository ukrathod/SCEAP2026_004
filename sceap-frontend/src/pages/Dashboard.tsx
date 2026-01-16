import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KPICard, PageHeader, DataTable } from '../components/Dashboard';
import { TrendingUp, Cable, AlertTriangle, CheckCircle } from 'lucide-react';

const Dashboard = () => {
  // Mock data - in a real app, this would come from API
  const kpiData = [
    {
      title: 'Total Cables',
      value: '247',
      change: '+12%',
      icon: Cable,
      color: 'bg-blue-600'
    },
    {
      title: 'Active Projects',
      value: '8',
      change: '+2',
      icon: TrendingUp,
      color: 'bg-green-600'
    },
    {
      title: 'Issues Found',
      value: '3',
      change: '-5',
      icon: AlertTriangle,
      color: 'bg-yellow-600'
    },
    {
      title: 'Verified Designs',
      value: '189',
      change: '+18%',
      icon: CheckCircle,
      color: 'bg-cyan-600'
    }
  ];

  const chartData = [
    { name: '1.5mm²', count: 45 },
    { name: '2.5mm²', count: 67 },
    { name: '4mm²', count: 52 },
    { name: '6mm²', count: 38 },
    { name: '10mm²', count: 28 },
    { name: '16mm²', count: 17 }
  ];

  const trayData = [
    { tray: 'Tray-01', fill: '85%', status: 'High', issues: 2 },
    { tray: 'Tray-02', fill: '92%', status: 'Critical', issues: 1 },
    { tray: 'Tray-03', fill: '67%', status: 'Normal', issues: 0 },
    { tray: 'Tray-04', fill: '78%', status: 'High', issues: 1 },
    { tray: 'Tray-05', fill: '45%', status: 'Low', issues: 0 }
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Smart Cable Engineering Automation Platform Overview"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiData.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cable Size Distribution */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Cable Size Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#06B6D4" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tray Fill Status */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Tray Fill Status</h3>
          <div className="space-y-4">
            {trayData.map((tray, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{tray.tray}</span>
                    <span className="text-slate-400">{tray.fill}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full ${
                        tray.status === 'Critical' ? 'bg-red-500' :
                        tray.status === 'High' ? 'bg-yellow-500' :
                        tray.status === 'Normal' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: tray.fill }}
                    ></div>
                  </div>
                </div>
                <div className="ml-4">
                  {tray.issues > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-200">
                      {tray.issues} issues
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">Top Tray Issues</h3>
        <DataTable
          columns={['Tray', 'Fill Ratio', 'Status', 'Issues']}
          data={trayData.map(t => ({
            tray: t.tray,
            fillRatio: t.fill,
            status: t.status,
            issues: t.issues.toString()
          }))}
        />
      </div>
    </div>
  );
};

export default Dashboard;