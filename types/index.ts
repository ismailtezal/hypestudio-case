// Core data types for the Place & Trade Area Data Visualization
// Based on Turkish case study specifications

export interface Place {
  id: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  logo: string | null;
  longitude: number;
  latitude: number;
  industry: string;
  isTradeAreaAvailable: boolean;
  isHomeZipcodesAvailable: boolean;
  category?: string; // Optional category field (e.g., 'user_place', 'competitor')
}

export interface Polygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

export interface Zipcode {
  id: string;
  polygon: Polygon | string; // Support both parsed objects and JSON strings
}

export interface Location {
  [id: string]: number; // id zipcode ile matchleme icin kullanilir
}

export interface TradeArea {
  pid: string;
  polygon: Polygon | string; // Support both parsed objects and JSON strings
  trade_area: number; // 30, 50, or 70
}

export interface HomeZipcodes {
  place_id?: string; // Optional for backward compatibility
  pid?: string; // Alternative field name in data
  locations: Location[] | { [id: string]: number }; // Support both array and object formats
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

// UI State Types
export interface PlaceAnalysisSettings {
  radius: number;
  selectedIndustries: string[];
  isVisible: boolean;
}

export interface CustomerAnalysisSettings {
  dataType: 'Trade Area' | 'Home Zipcodes';
  selectedTradeAreas: number[]; // 30, 50, 70
  isVisible: boolean;
}

export interface VisibleTradeAreas {
  [placeId: string]: number[]; // which trade areas (30, 50, 70) are visible for each place
}

export interface VisibleHomeZipcodes {
  placeId: string | null; // only one place can show home zipcodes at a time
}

export interface LegendData {
  type: 'Trade Area' | 'Home Zipcodes';
  items: LegendItem[];
}

export interface LegendItem {
  color: string;
  label: string;
  value: string | number;
  opacity?: number;
}

// Percentile thresholds for Home Zipcodes
export interface PercentileThreshold {
  min: number;
  max: number;
  label: string;
  color: string;
}

export interface AnalyticsData {
  totalPlaces: number;
  visiblePlaces: number;
  selectedRadius: number;
  selectedIndustries: string[];
  tradeAreaStats: {
    totalVisible: number;
    byPercentage: { [key: number]: number };
  };
  homeZipcodesStats: {
    activePlaceId: string | null;
    totalZipcodes: number;
    percentileDistribution: PercentileThreshold[];
  };
}
