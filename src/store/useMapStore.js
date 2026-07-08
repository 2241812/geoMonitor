import { create } from 'zustand';

export const useMapStore = create((set, get) => ({
  // ═══════════ CORE VIEW STATE ═══════════
  viewMode: 'watersheds', // 'watersheds' | 'boundaries'
  activeBasemap: 'topo',
  panelState: 'closed', // 'closed' | 'peek' | 'open'
  isLoading: false,
  _drilling: false,
  activeSource: 'namria',

  // ═══════════ BOUNDARY MODE STATE ═══════════
  currentLevel: 0,
  selectedPath: [],
  activeMode: 'boundary', // 'explore' | 'boundary' — sub-mode for boundaries view

  // ═══════════ WATERSHED MODE STATE ═══════════
  hydroDrillLevel: 0, // 0 = Basins, 1 = Sub-watersheds
  hydroSelectedBasin: null,
  hydroSelectedZone: null,
  showStreamOrder: false,
  showSlope: false,
  showSubWatersheds: false,
  showLCM: false,
  hydroShowBoundary: false,

  // ═══════════ DATA & LAYERS (References) ═══════════
  // Note: Storing heavy GeoJSON or Leaflet objects in Zustand is generally discouraged 
  // because React will try to proxy/freeze them. We store them here for global access 
  // but keep them mutable, or manage them via React-Leaflet components directly.
  rawData: {}, 
  watershedIntersections: null,
  zoneIntersections: null,

  // ═══════════ ACTIONS ═══════════
  setViewMode: (mode) => set({ viewMode: mode, hydroDrillLevel: 0, currentLevel: 0, selectedPath: [] }),
  setActiveBasemap: (basemap) => set({ activeBasemap: basemap }),
  setPanelState: (state) => set({ panelState: state }),
  
  // Boundary Actions
  setDrillLevel: (level) => set({ currentLevel: level }),
  pushSelectedPath: (pathObj) => set((state) => ({ selectedPath: [...state.selectedPath, pathObj] })),
  popSelectedPath: () => set((state) => ({ selectedPath: state.selectedPath.slice(0, -1) })),
  clearSelectedPath: () => set({ selectedPath: [], currentLevel: 0 }),

  // Watershed Actions
  setHydroDrillLevel: (level) => set({ hydroDrillLevel: level }),
  selectBasin: (basinInfo) => set({ hydroSelectedBasin: basinInfo, hydroDrillLevel: 1 }),
  deselectBasin: () => set({ hydroSelectedBasin: null, hydroSelectedZone: null, hydroDrillLevel: 0 }),
  selectZone: (zoneInfo) => set({ hydroSelectedZone: zoneInfo }),
  deselectZone: () => set({ hydroSelectedZone: null }),
  toggleStreamOrder: () => set((state) => ({ showStreamOrder: !state.showStreamOrder })),

  // UI State
  setDrilling: (isDrilling) => set({ _drilling: isDrilling }),
  setLoading: (isLoading) => set({ isLoading }),

  // BottomBar Actions
  setActiveSource: (source) => set({ activeSource: source }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  clearSelection: () => set({ selectedPath: [], currentLevel: 0, hydroDrillLevel: 0, hydroSelectedBasin: null, hydroSelectedZone: null }),
}));
