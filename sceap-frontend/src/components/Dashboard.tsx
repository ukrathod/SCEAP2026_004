import { TrendingUp, Cable, AlertTriangle, CheckCircle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
}

const KPICard = ({ title, value, change, icon: Icon, color }: KPICardProps) => (
  <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className={`text-sm mt-1 ${change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => (
  <div className="mb-8">
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="text-slate-400 mt-2">{subtitle}</p>
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  </div>
);

interface DataTableProps {
  columns: string[];
  data: any[];
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
}

const DataTable = ({ columns, data, onEdit, onDelete }: DataTableProps) => (
  <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
    <table className="w-full">
      <thead className="bg-slate-700">
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              {col}
            </th>
          ))}
          {(onEdit || onDelete) && (
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-700">
        {data.map((item, index) => (
          <tr key={index} className="hover:bg-slate-700">
            {columns.map((col) => (
              <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                {item[col.toLowerCase()]}
              </td>
            ))}
            {(onEdit || onDelete) && (
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="text-cyan-400 hover:text-cyan-300 mr-3"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export { KPICard, PageHeader, DataTable };