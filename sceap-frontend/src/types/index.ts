// Domain Models
export interface Project {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  status: string;
  cables?: Cable[];
  trays?: Tray[];
  cableRoutes?: CableRoute[];
  reports?: Report[];
}

export interface Cable {
  id: number;
  projectId: number;
  name: string;
  type: string;
  crossSection: number;
  length: number;
  current: number;
  voltage: number;
  standard: string;
  status: string;
  project?: Project;
  cableRoutes?: CableRoute[];
  terminations?: Termination[];
}

export interface Tray {
  id: number;
  projectId: number;
  name: string;
  type: string;
  length: number;
  width: number;
  fillRatio: number;
  capacity: number;
  project?: Project;
  cableRoutes?: CableRoute[];
}

export interface CableRoute {
  id: number;
  cableId: number;
  trayId: number;
  sequence: number;
  distance: number;
  cable?: Cable;
  tray?: Tray;
}

export interface Termination {
  id: number;
  cableId: number;
  fromEquipment: string;
  toEquipment: string;
  terminationType: string;
  completedAt?: string;
  cable?: Cable;
}

export interface DrumSpool {
  id: number;
  cableType: string;
  crossSection: number;
  length: number;
  quantity: number;
  location: string;
}

export interface Raceway {
  id: number;
  projectId: number;
  name: string;
  type: string;
  length: number;
  fillRatio: number;
  project?: Project;
}

export interface Report {
  id: number;
  projectId: number;
  title: string;
  type: string;
  content: string;
  generatedAt: string;
  project?: Project;
}

// API Request/Response Types
export interface FLCRequest {
  power: number;
  voltage: number;
  powerFactor?: number;
}

export interface VoltageDropRequest {
  current: number;
  length: number;
  resistance: number;
  reactance: number;
  voltage: number;
}

export interface RouteRequest {
  cableId: number;
  startTrayId: number;
  endTrayId: number;
}

// UI Component Props
export interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export interface DataTableProps {
  columns: string[];
  data: any[];
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
}

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}