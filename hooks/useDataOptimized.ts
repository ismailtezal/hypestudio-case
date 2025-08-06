import { useQuery, useQueries } from '@tanstack/react-query';
import { Place, TradeArea, HomeZipcodes, Zipcode } from '../types';

// Cache configuration for performance
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 2,
};

// API endpoints
const API_ENDPOINTS = {
  myPlace: '/api/my-place',
  competitors: '/api/competitors',
  places: '/api/places',
  tradeAreas: '/api/trade-areas',
  homeZipcodes: '/api/home-zipcodes',
  zipcodes: '/api/zipcodes',
} as const;

// Helper function to build query string
const buildQueryString = (params: Record<string, any>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });
  return searchParams.toString();
};

// Optimized fetch functions with error handling
const fetchMyPlace = async (): Promise<Place> => {
  const response = await fetch(API_ENDPOINTS.myPlace);
  if (!response.ok) {
    throw new Error(`Failed to fetch my place: ${response.status}`);
  }
  const data = await response.json();
  return data.myPlace;
};

const fetchCompetitors = async (): Promise<Place[]> => {
  const response = await fetch(API_ENDPOINTS.competitors);
  if (!response.ok) {
    throw new Error(`Failed to fetch competitors: ${response.status}`);
  }
  const competitorsData = await response.json();
  
  // Transform competitors data to Place format
  return competitorsData.competitors?.map((competitor: any) => ({
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
    category: 'competitor',
  })) || [];
};

const fetchAllPlaces = async (filters?: { 
  industry?: string; 
  bounds?: string; 
  limit?: number; 
  offset?: number; 
}): Promise<Place[]> => {
  const queryString = filters ? buildQueryString(filters) : '';
  const url = `${API_ENDPOINTS.places}${queryString ? `?${queryString}` : ''}`;
  
  const [myPlaceResponse, placesResponse] = await Promise.all([
    fetchMyPlace(),
    fetch(url).then(res => {
      if (!res.ok) throw new Error(`Failed to fetch places: ${res.status}`);
      return res.json();
    })
  ]);

  const competitors = placesResponse.places || [];
  return [myPlaceResponse, ...competitors];
};

// Optimized hooks with React Query
export const useMyPlace = () => {
  return useQuery({
    queryKey: ['my-place'],
    queryFn: fetchMyPlace,
    ...CACHE_CONFIG,
    staleTime: 15 * 60 * 1000, // My place changes less frequently
  });
};

export const useCompetitors = () => {
  return useQuery({
    queryKey: ['competitors'],
    queryFn: fetchCompetitors,
    ...CACHE_CONFIG,
  });
};

export const usePlaces = (filters?: { 
  industry?: string; 
  bounds?: string; 
  limit?: number; 
  offset?: number; 
}) => {
  return useQuery({
    queryKey: ['places', filters],
    queryFn: () => fetchAllPlaces(filters),
    ...CACHE_CONFIG,
  });
};

export const useTradeAreas = (filters?: { pid?: number; trade_area?: number }) => {
  const queryString = filters ? buildQueryString(filters) : '';
  
  return useQuery({
    queryKey: ['trade-areas', filters],
    queryFn: async () => {
      const url = `${API_ENDPOINTS.tradeAreas}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch trade areas: ${response.status}`);
      const data = await response.json();
      return data.features;
    },
    ...CACHE_CONFIG,
    staleTime: 10 * 60 * 1000, // Trade areas change less frequently
  });
};

export const useHomeZipcodes = (pid?: number) => {
  return useQuery({
    queryKey: ['home-zipcodes', pid],
    queryFn: async () => {
      const url = `${API_ENDPOINTS.homeZipcodes}${pid ? `?pid=${pid}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch home zipcodes: ${response.status}`);
      const data = await response.json();
      return data.features;
    },
    enabled: !!pid, // Only fetch when pid is provided
    ...CACHE_CONFIG,
  });
};

export const useZipcodes = () => {
  return useQuery({
    queryKey: ['zipcodes'],
    queryFn: async () => {
      const response = await fetch(API_ENDPOINTS.zipcodes);
      if (!response.ok) throw new Error(`Failed to fetch zipcodes: ${response.status}`);
      const data = await response.json();
      return data.features;
    },
    ...CACHE_CONFIG,
    staleTime: 30 * 60 * 1000, // Zipcodes change very infrequently
  });
};

// Combined hook for all data with parallel fetching
export const useAllData = () => {
  const [placesQuery, tradeAreasQuery, zipcodesQuery] = useQueries({
    queries: [
      {
        queryKey: ['places'],
        queryFn: () => fetchAllPlaces(),
        ...CACHE_CONFIG,
      },
      {
        queryKey: ['trade-areas'],
        queryFn: async () => {
          const response = await fetch(API_ENDPOINTS.tradeAreas);
          if (!response.ok) throw new Error('Failed to fetch trade areas');
          const data = await response.json();
          return data.features;
        },
        ...CACHE_CONFIG,
      },
      {
        queryKey: ['zipcodes'],
        queryFn: async () => {
          const response = await fetch(API_ENDPOINTS.zipcodes);
          if (!response.ok) throw new Error('Failed to fetch zipcodes');
          const data = await response.json();
          return data.features;
        },
        ...CACHE_CONFIG,
      },
    ],
  });

  return {
    places: placesQuery.data || [],
    tradeAreas: tradeAreasQuery.data || [],
    zipcodes: zipcodesQuery.data || [],
    isLoading: placesQuery.isLoading || tradeAreasQuery.isLoading || zipcodesQuery.isLoading,
    error: placesQuery.error || tradeAreasQuery.error || zipcodesQuery.error,
    refetch: () => {
      placesQuery.refetch();
      tradeAreasQuery.refetch();
      zipcodesQuery.refetch();
    },
  };
};
