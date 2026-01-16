import { useState } from 'react';
import { PageHeader } from '../components/Dashboard';
import { Upload, Download, Calculator, Search, Edit, Eye, FileText } from 'lucide-react';
import SizingTab from '../components/SizingTab';
import OptimizationTab from '../components/OptimizationTab';
import ResultsTab from '../components/ResultsTab';

type TabType = 'sizing' | 'optimization' | 'results';

const CableSizing = () => {
  const [activeTab, setActiveTab] = useState<TabType>('sizing');

  const tabs = [
    { id: 'sizing' as TabType, label: 'Sizing', icon: Calculator },
    { id: 'optimization' as TabType, label: 'Optimization', icon: Search },
    { id: 'results' as TabType, label: 'Results', icon: FileText }
  ];

  return (
    <div>
      <PageHeader
        title="Cable Sizing"
        subtitle="Advanced cable sizing with feeder analysis, path optimization, and comprehensive results"
      />

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg p-1 mb-6 border border-slate-700">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center px-4 py-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon size={16} className="mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'sizing' && <SizingTab />}
        {activeTab === 'optimization' && <OptimizationTab />}
        {activeTab === 'results' && <ResultsTab />}
      </div>
    </div>
  );
};

export default CableSizing;