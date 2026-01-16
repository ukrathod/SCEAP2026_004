import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Cable,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Route,
  Database
} from 'lucide-react';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/cable-sizing', icon: Cable, label: 'Cable Sizing' },
    { path: '/tray-fill', icon: Database, label: 'Tray Fill' },
    { path: '/routing', icon: Route, label: 'Cable Routing' },
    { path: '/terminations', icon: Zap, label: 'Terminations' },
    { path: '/reports', icon: Settings, label: 'Reports' },
  ];

  return (
    <div className={`bg-slate-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-cyan-400">SCEAP 2.0</h1>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded hover:bg-slate-800"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="mt-8">
        <ul className="space-y-2 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} className="mr-3" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;