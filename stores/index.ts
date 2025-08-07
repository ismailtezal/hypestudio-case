import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  ViewState, 
  Place, 
  TradeArea, 
  HomeZipcodes, 
  Zipcode,
  PlaceAnalysisSettings,
  CustomerAnalysisSettings,
  VisibleTradeAreas,
  VisibleHomeZipcodes,
  LegendData,
  PercentileThreshold
} from '../types';

interface DataStore {
  places: Place[];
  tradeAreas: TradeArea[];
  homeZipcodes: HomeZipcodes[];
  zipcodes: Zipcode[];
  myPlace: Place | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPlaces: (data: Place[]) => void;
  setTradeAreas: (data: TradeArea[]) => void;
  setHomeZipcodes: (data: HomeZipcodes[]) => void;
  setZipcodes: (data: Zipcode[]) => void;
  setMyPlace: (place: Place) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadAllData: () => Promise<void>;
}

interface UIStore {
  viewState: ViewState;
  
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  
  // Place Analysis (Accordion 1)
  placeAnalysis: PlaceAnalysisSettings;
  
  // Customer Analysis (Accordion 2)
  customerAnalysis: CustomerAnalysisSettings;
  
  // Visibility states
  visibleTradeAreas: VisibleTradeAreas;
  visibleHomeZipcodes: VisibleHomeZipcodes;
  
  // Legend data
  legendData: LegendData | null;
  
  // Selected place for interactions
  selectedPlace: Place | null;
  hoveredPlace: Place | null;
  
  // Actions
  setViewState: (viewState: Partial<ViewState>) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setPlaceAnalysis: (settings: Partial<PlaceAnalysisSettings>) => void;
  setCustomerAnalysis: (settings: Partial<CustomerAnalysisSettings>) => void;
  setVisibleTradeAreas: (placeId: string, tradeAreas: number[]) => void;
  setVisibleHomeZipcodes: (placeId: string | null) => void;
  setSelectedPlace: (place: Place | null) => void;
  setHoveredPlace: (place: Place | null) => void;
  updateLegend: () => void;
  resetFilters: () => void;
  initialize: () => void;
}

const defaultViewState: ViewState = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

const defaultPlaceAnalysis: PlaceAnalysisSettings = {
  radius: 5, // km
  selectedIndustries: [],
  isVisible: true,
};

const defaultCustomerAnalysis: CustomerAnalysisSettings = {
  dataType: 'Trade Area',
  selectedTradeAreas: [30, 50, 70],
  isVisible: true,
};

export const useDataStore = create<DataStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      places: [],
      tradeAreas: [],
      homeZipcodes: [],
      zipcodes: [],
      myPlace: null,
      isLoading: false,
      error: null,
      
      // Actions
      setPlaces: (data) => set({ places: data }),
      setTradeAreas: (data) => set({ tradeAreas: data }),
      setHomeZipcodes: (data) => set({ homeZipcodes: data }),
      setZipcodes: (data) => set({ zipcodes: data }),
      setMyPlace: (place) => set({ myPlace: place }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      loadAllData: async () => {
        set({ isLoading: true, error: null });
        console.log('loadAllData is deprecated. Use TanStack Query hooks instead.');
        set({ isLoading: false });
      },
    }),
    { name: 'data-store' }
  )
);

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      viewState: defaultViewState,
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      placeAnalysis: defaultPlaceAnalysis,
      customerAnalysis: defaultCustomerAnalysis,
      visibleTradeAreas: {},
      visibleHomeZipcodes: { placeId: null },
      legendData: null,
      selectedPlace: null,
      hoveredPlace: null,
      
      // Actions
      setViewState: (newViewState) =>
        set((state) => ({
          viewState: { ...state.viewState, ...newViewState },
        })),
      
      setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
      
      setPlaceAnalysis: (settings) =>
        set((state) => ({
          placeAnalysis: { ...state.placeAnalysis, ...settings },
        })),
      
      setCustomerAnalysis: (settings) =>
        set((state) => {
          const newSettings = { ...state.customerAnalysis, ...settings };
          
          if (settings.dataType === 'Home Zipcodes') {
            return {
              customerAnalysis: newSettings,
              visibleTradeAreas: {},
              visibleHomeZipcodes: { placeId: null },
            };
          }
          
          if (settings.dataType === 'Trade Area') {
            return {
              customerAnalysis: newSettings,
              visibleHomeZipcodes: { placeId: null },
            };
          }
          
          return { customerAnalysis: newSettings };
        }),
      
      setVisibleTradeAreas: (placeId, tradeAreas) =>
        set((state) => ({
          visibleTradeAreas: {
            ...state.visibleTradeAreas,
            [placeId]: tradeAreas,
          },
        })),
      
      setVisibleHomeZipcodes: (placeId) => {
        // Case study requirement: Only one place can show home zipcodes at a time
        set({ visibleHomeZipcodes: { placeId } });
        get().updateLegend();
      },
      
      setSelectedPlace: (place) => set({ selectedPlace: place }),
      setHoveredPlace: (place) => set({ hoveredPlace: place }),
      
      updateLegend: () => {
        const state = get();
        const { customerAnalysis, visibleTradeAreas, visibleHomeZipcodes } = state;
        
        if (customerAnalysis.dataType === 'Trade Area') {
          // Fixed percentile areas: 30%, 50%, 70%
          set({
            legendData: {
              type: 'Trade Area',
              items: [
                { color: '#45B7D1', label: '30%', value: 30, opacity: 0.4 },
                { color: '#4ECDC4', label: '50%', value: 50, opacity: 0.6 },
                { color: '#FF6B6B', label: '70%', value: 70, opacity: 0.8 },
              ],
            },
          });
        } else {
          // Home Zipcodes: Dynamic percentile thresholds (5 groups)
          // This would need actual data calculation
          set({
            legendData: {
              type: 'Home Zipcodes',
              items: [
                { color: '#90EE90', label: '0-20', value: '0-4.5%' },
                { color: '#FFD700', label: '20-40', value: '4.5%-25%' },
                { color: '#FFA500', label: '40-60', value: '25%-29%' },
                { color: '#CD5C5C', label: '60-80', value: '29%-32.6%' },
                { color: '#8B0000', label: '80-100', value: '32.6%-45%' },
              ],
            },
          });
        }
      },
      
      resetFilters: () => set({
        placeAnalysis: defaultPlaceAnalysis,
        customerAnalysis: defaultCustomerAnalysis,
        visibleTradeAreas: {},
        visibleHomeZipcodes: { placeId: null },
      }),
      
      initialize: () => {
        // Initialize legend with default Trade Area data
        get().updateLegend();
      },
    }),
    { name: 'ui-store' }
  )
);

// Initialize the store
useUIStore.getState().initialize();
