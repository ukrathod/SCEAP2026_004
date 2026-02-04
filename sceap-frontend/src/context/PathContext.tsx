import { createContext, useContext, useState, ReactNode } from 'react';
import { PathAnalysisResult, CableSegment } from '../utils/pathDiscoveryService';

interface PathContextType {
  pathAnalysis: PathAnalysisResult | null;
  setPathAnalysis: (analysis: PathAnalysisResult | null) => void;
  normalizedFeeders: CableSegment[] | null;
  setNormalizedFeeders: (feeders: CableSegment[] | null) => void;
  selectedPaths: Set<string>;
  togglePathSelection: (pathId: string) => void;
  clearSelection: () => void;
}

const PathContext = createContext<PathContextType | undefined>(undefined);

export const PathProvider = ({ children }: { children: ReactNode }) => {
  const [pathAnalysis, setPathAnalysis] = useState<PathAnalysisResult | null>(null);
  const [normalizedFeeders, setNormalizedFeeders] = useState<CableSegment[] | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const togglePathSelection = (pathId: string) => {
    const newSelection = new Set(selectedPaths);
    if (newSelection.has(pathId)) {
      newSelection.delete(pathId);
    } else {
      newSelection.add(pathId);
    }
    setSelectedPaths(newSelection);
  };

  const clearSelection = () => {
    setSelectedPaths(new Set());
  };

  return (
    <PathContext.Provider value={{ pathAnalysis, setPathAnalysis, normalizedFeeders, setNormalizedFeeders, selectedPaths, togglePathSelection, clearSelection }}>
      {children}
    </PathContext.Provider>
  );
};

export const usePathContext = () => {
  const context = useContext(PathContext);
  if (!context) {
    throw new Error('usePathContext must be used within PathProvider');
  }
  return context;
};
