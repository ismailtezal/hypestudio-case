import { useQuery } from '@tanstack/react-query';
import { Place, TradeArea, HomeZipcodes, Zipcode } from '../types';

// API endpoints
const API_ENDPOINTS = {
  myPlace: '/api/my-place',
  competitors: '/api/competitors',
  places: '/api/places',
  tradeAreas: '/api/trade-areas',
  homeZipcodes: '/api/home-zipcodes',
  zipcodes: '/api/zipcodes',
} as const;

// Fetch functions
const fetchMyPlace = async (): Promise<Place> => {
  const response = await fetch(API_ENDPOINTS.myPlace);
  if (!response.ok) {
    throw new Error('Failed to fetch my place');
  }
  return response.json();
};

const fetchCompetitors = async (): Promise<Place[]> => {
  const response = await fetch(API_ENDPOINTS.competitors);
  if (!response.ok) {
    throw new Error('Failed to fetch competitors');
  }
  const competitorsData = await response.json();
  
  // Transform competitors data to Place format
  return competitorsData.map((competitor: any) => ({
    id: competitor.pid,
    name: competitor.name,
    street_address: competitor.street_address,
    city: competitor.city,
    state: competitor.region,
    logo: competitor.logo,
    longitude: competitor.longitude,
    latitude: competitor.latitude,
    industry: competitor.sub_category,
    isTradeAreaAvailable: competitor.trade_area_activity || false,
    isHomeZipcodesAvailable: competitor.home_locations_activity || false,
  }));
};

const fetchAllPlaces = async (): Promise<Place[]> => {
  const [myPlace, competitors] = await Promise.all([
    fetchMyPlace(),
    fetchCompetitors(),
  ]);
  
  return [myPlace, ...competitors];
};

const fetchTradeAreas = async (): Promise<TradeArea[]> => {
  // Use pagination to avoid timeouts
  const response = await fetch(`${API_ENDPOINTS.tradeAreas}?limit=1000`);
  if (!response.ok) {
    throw new Error('Failed to fetch trade areas');
  }
  const data = await response.json();
  return data.features || data || [];
};

const fetchHomeZipcodes = async (): Promise<HomeZipcodes[]> => {
  const response = await fetch(API_ENDPOINTS.homeZipcodes);
  if (!response.ok) {
    throw new Error('Failed to fetch home zipcodes');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const fetchZipcodes = async (): Promise<Zipcode[]> => {
  const response = await fetch(API_ENDPOINTS.zipcodes);
  if (!response.ok) {
    throw new Error('Failed to fetch zipcodes');
  }
  return response.json();
};

// React Query hooks
export const useMyPlace = () => {
  return useQuery({
    queryKey: ['myPlace'],
    queryFn: fetchMyPlace,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useCompetitors = () => {
  return useQuery({
    queryKey: ['competitors'],
    queryFn: fetchCompetitors,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

export const usePlaces = () => {
  return useQuery({
    queryKey: ['places'],
    queryFn: fetchAllPlaces,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useTradeAreas = () => {
  return useQuery({
    queryKey: ['tradeAreas'],
    queryFn: fetchTradeAreas,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useHomeZipcodes = () => {
  return useQuery({
    queryKey: ['homeZipcodes'],
    queryFn: fetchHomeZipcodes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useZipcodes = () => {
  return useQuery({
    queryKey: ['zipcodes'],
    queryFn: fetchZipcodes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
};

// Combined hook for getting all data with progress tracking
export const useAllData = () => {
  const placesQuery = usePlaces();
  const tradeAreasQuery = useTradeAreas();
  const zipcodesQuery = useZipcodes();
  
  // Calculate loading progress
  const getLoadingProgress = () => {
    const queries = [placesQuery, tradeAreasQuery, zipcodesQuery];
    const completedQueries = queries.filter(query => !query.isLoading && !query.isError).length;
    const totalQueries = queries.length;
    return Math.round((completedQueries / totalQueries) * 100);
  };

  const isLoading = placesQuery.isLoading || tradeAreasQuery.isLoading || zipcodesQuery.isLoading;
  const loadingProgress = isLoading ? getLoadingProgress() : 100;
  
  return {
    places: placesQuery.data || [],
    tradeAreas: tradeAreasQuery.data || [],
    zipcodes: zipcodesQuery.data || [],
    isLoading,
    loadingProgress,
    isError: placesQuery.isError || tradeAreasQuery.isError || zipcodesQuery.isError,
    error: placesQuery.error || tradeAreasQuery.error || zipcodesQuery.error,
    // Individual loading states for detailed progress
    loadingStates: {
      places: placesQuery.isLoading,
      tradeAreas: tradeAreasQuery.isLoading,
      zipcodes: zipcodesQuery.isLoading,
    }
  };
};

// Legacy hook for backwards compatibility
export const useDataFetching = () => {
  const allData = useAllData();
  
  return {
    ...allData,
    // Legacy aliases for backwards compatibility
    competitors: allData.places.filter(place => place.category !== 'user_place'),
    myPlace: allData.places.find(place => place.category === 'user_place') || null,
  };
};
