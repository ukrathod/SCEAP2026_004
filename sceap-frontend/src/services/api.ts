import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth if needed
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// Project API
export const projectApi = {
  getAll: () => api.get('/projects'),
  getById: (id: number) => api.get(`/projects/${id}`),
  create: (project: any) => api.post('/projects', project),
  update: (id: number, project: any) => api.put(`/projects/${id}`, project),
  delete: (id: number) => api.delete(`/projects/${id}`),
};

// Cable Sizing API
export const cableSizingApi = {
  calculate: (cable: any) => api.post('/cablesizing/calculate', cable),
  calculateMultiple: (cables: any[]) => api.post('/cablesizing/calculate-multiple', cables),
  calculateFLC: (request: any) => api.post('/cablesizing/flc', request),
  calculateVoltageDrop: (request: any) => api.post('/cablesizing/voltage-drop', request),
};

// Cable Routing API
export const cableRoutingApi = {
  calculateRoute: (request: any) => api.post('/cablerouting/calculate-route', request),
  getAvailableTrays: (projectId: number) => api.get(`/cablerouting/available-trays/${projectId}`),
  calculateRouteLength: (routes: any[]) => api.post('/cablerouting/route-length', routes),
};

// Tray Fill API
export const trayFillApi = {
  getFillRatio: (trayId: number) => api.get(`/trayfill/fill-ratio/${trayId}`),
  getTraysByFillRatio: (projectId: number, minRatio?: number, maxRatio?: number) =>
    api.get(`/trayfill/trays-by-fill/${projectId}`, { params: { minFillRatio: minRatio, maxFillRatio: maxRatio } }),
  isOverloaded: (trayId: number) => api.get(`/trayfill/overloaded/${trayId}`),
  optimize: (trayId: number) => api.post(`/trayfill/optimize/${trayId}`),
};

// Termination API
export const terminationApi = {
  getByCable: (cableId: number) => api.get(`/termination/cable/${cableId}`),
  create: (termination: any) => api.post('/termination', termination),
  complete: (terminationId: number) => api.post(`/termination/complete/${terminationId}`),
  getPending: (projectId: number) => api.get(`/termination/pending/${projectId}`),
};

export default api;