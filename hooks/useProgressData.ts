import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Place, TradeArea, Zipcode } from '../types';

// Progress tracking state
interface ProgressState {
  places: { progress: number; status: string; loading: boolean };
  tradeAreas: { progress: number; status: string; loading: boolean };
  zipcodes: { progress: number; status: string; loading: boolean };
  overall: number;
}

// Fetch functions with progress tracking
const fetchMyPlace = async (): Promise<Place> => {
  const response = await fetch('/api/my-place');
  if (!response.ok) {
    throw new Error('Failed to fetch my place');
  }
  return response.json();
};

const fetchCompetitors = async (): Promise<Place[]> => {
  const response = await fetch('/api/competitors');
  if (!response.ok) {
    throw new Error('Failed to fetch competitors');
  }
  const competitorsData = await response.json();
  
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

// Trade areas with real chunked progress tracking
const fetchTradeAreasWithProgress = async (
  onProgress: (progress: number, status: string) => void
): Promise<TradeArea[]> => {
  onProgress(5, 'Connecting to trade areas API...');
  
  try {
    // Use streaming endpoint for better performance
    const response = await fetch('/api/trade-areas/stream?batch_size=500');
    
    if (!response.ok) {
      throw new Error('Failed to fetch trade areas');
    }
    
    onProgress(15, 'Reading response headers...');
    
    // Get the total content length if available
    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength) : null;
    
    onProgress(20, 'Starting data download...');
    
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback if streaming not supported
      onProgress(50, 'Processing trade areas data...');
      const data = await response.json();
      console.log('📊 Fallback data type:', typeof data);
      console.log('📊 Fallback data sample:', data);
      const features = Array.isArray(data) ? data : (data.features || data || []); // Handle both array and object responses
      console.log('📊 Fallback features count:', features.length);
      onProgress(100, `Loaded ${features.length} trade areas successfully`);
      return features;
    }
    
    const decoder = new TextDecoder();
    let receivedData = '';
    let receivedBytes = 0;
    
    console.log('📡 Starting to read streaming data...');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      receivedBytes += value.length;
      const chunk = decoder.decode(value, { stream: false });
      receivedData += chunk;
      
      // Debug first few chunks
      if (receivedBytes < 5000) {
        console.log('📡 Chunk received:', chunk.substring(0, 100));
      }
      
      // Calculate progress based on bytes received
      let progress;
      if (totalBytes) {
        progress = Math.min(90, Math.floor((receivedBytes / totalBytes) * 90));
      } else {
        // Estimate based on typical data size (500KB-2MB)
        const estimatedTotal = 1500000; // 1.5MB estimate
        progress = Math.min(90, Math.floor((receivedBytes / estimatedTotal) * 90));
      }
      
      const mbReceived = (receivedBytes / 1024 / 1024).toFixed(1);
      onProgress(Math.max(20, progress), `Downloading trade areas... (${mbReceived}MB)`);
    }
    
    onProgress(95, 'Processing JSON data...');
    
    console.log('📊 Raw received data length:', receivedData.length);
    console.log('📊 First 200 chars:', receivedData.substring(0, 200));
    console.log('📊 Last 200 chars:', receivedData.substring(receivedData.length - 200));
    
    let features;
    try {
      const data = JSON.parse(receivedData);
      features = Array.isArray(data) ? data : (data.features || data || []);
      console.log('📊 Parsed features count:', features.length);
      console.log('📊 Sample feature:', features[0]);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('❌ Problematic data:', receivedData.substring(0, 500));
      throw new Error(`Failed to parse trade areas data: ${parseError}`);
    }
    
    onProgress(100, `Loaded ${features.length} trade areas successfully`);
    return features;
    
  } catch (error) {
    console.error('Trade areas fetch error:', error);
    throw error;
  }
};

const fetchZipcodes = async (): Promise<Zipcode[]> => {
  const response = await fetch('/api/zipcodes');
  if (!response.ok) {
    throw new Error('Failed to fetch zipcodes');
  }
  return response.json();
};

// Hook with real progress tracking
export const useProgressData = () => {
  const [progress, setProgress] = useState<ProgressState>({
    places: { progress: 0, status: 'Not started', loading: false },
    tradeAreas: { progress: 0, status: 'Not started', loading: false },
    zipcodes: { progress: 0, status: 'Not started', loading: false },
    overall: 0,
  });

  // Places query (simplified - progress managed by useEffect)
  const placesQuery = useQuery({
    queryKey: ['places'],
    queryFn: fetchAllPlaces,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Trade areas query with real chunked progress tracking
  const tradeAreasQuery = useQuery({
    queryKey: ['tradeAreas'],
    queryFn: async () => {
      const updateProgress = (progress: number, status: string) => {
        setProgress(prev => ({
          ...prev,
          tradeAreas: { progress, status, loading: progress < 100 }
        }));
      };

      return await fetchTradeAreasWithProgress(updateProgress);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Zipcodes query (simplified - progress managed by useEffect)
  const zipcodesQuery = useQuery({
    queryKey: ['zipcodes'],
    queryFn: fetchZipcodes,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Update progress based on query states (including cached data)
  useEffect(() => {
    // Update places progress based on query state
    if (placesQuery.isSuccess && placesQuery.data) {
      setProgress(prev => ({
        ...prev,
        places: { 
          progress: 100, 
          status: `Loaded ${placesQuery.data.length} places`, 
          loading: false 
        }
      }));
    } else if (placesQuery.isLoading) {
      setProgress(prev => ({
        ...prev,
        places: { progress: 50, status: 'Loading places...', loading: true }
      }));
    }

    // Update trade areas progress only if it's in success state and hasn't been set by the query function
    if (tradeAreasQuery.isSuccess && tradeAreasQuery.data && progress.tradeAreas.progress < 100) {
      setProgress(prev => ({
        ...prev,
        tradeAreas: { 
          progress: 100, 
          status: `Loaded ${tradeAreasQuery.data.length} trade areas`, 
          loading: false 
        }
      }));
    }

    // Update zipcodes progress based on query state
    if (zipcodesQuery.isSuccess && zipcodesQuery.data) {
      setProgress(prev => ({
        ...prev,
        zipcodes: { 
          progress: 100, 
          status: `Loaded ${zipcodesQuery.data.length} zipcodes`, 
          loading: false 
        }
      }));
    } else if (zipcodesQuery.isLoading) {
      setProgress(prev => ({
        ...prev,
        zipcodes: { progress: 50, status: 'Loading zipcodes...', loading: true }
      }));
    }
  }, [
    placesQuery.isSuccess, placesQuery.isLoading, placesQuery.data,
    tradeAreasQuery.isSuccess, tradeAreasQuery.isLoading, tradeAreasQuery.data,
    zipcodesQuery.isSuccess, zipcodesQuery.isLoading, zipcodesQuery.data,
    progress.tradeAreas.progress
  ]);

  // Calculate overall progress
  useEffect(() => {
    const totalProgress = (progress.places.progress + progress.tradeAreas.progress + progress.zipcodes.progress) / 3;
    setProgress(prev => ({
      ...prev,
      overall: Math.round(totalProgress)
    }));
  }, [progress.places.progress, progress.tradeAreas.progress, progress.zipcodes.progress]);

  const isLoading = placesQuery.isLoading || tradeAreasQuery.isLoading || zipcodesQuery.isLoading;
  const isError = placesQuery.isError || tradeAreasQuery.isError || zipcodesQuery.isError;
  const error = placesQuery.error || tradeAreasQuery.error || zipcodesQuery.error;

  return {
    places: placesQuery.data || [],
    tradeAreas: tradeAreasQuery.data || [],
    zipcodes: zipcodesQuery.data || [],
    isLoading,
    isError,
    error,
    progress,
    loadingProgress: progress.overall,
    loadingStates: {
      places: progress.places.loading,
      tradeAreas: progress.tradeAreas.loading,
      zipcodes: progress.zipcodes.loading,
    }
  };
};
