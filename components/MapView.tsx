'use client';

import React from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { useUIStore } from '../stores';
import { useAllData, useMyPlace } from '../hooks/useData';
import { useProgressData } from '../hooks/useProgressData';
import { useDeckLayers } from '../hooks/useDeckLayers';
import { MAP_STYLES, MAPBOX_TOKEN } from '../lib/utils';
import { Box, CircularProgress, Alert, Chip, LinearProgress, Typography } from '@mui/material';
import { Place } from '../types';
import { PlaceTooltip } from './PlaceTooltip';

const MapView: React.FC = React.memo(() => {
  const [tooltipInfo, setTooltipInfo] = React.useState<{
    place: Place;
    x: number;
    y: number;
  } | null>(null);

  const { isLoading, error, progress } = useProgressData();
  const { data: myPlace } = useMyPlace();
  const {
    viewState,
    setViewState,
    visibleTradeAreas,
    setVisibleTradeAreas,
    visibleHomeZipcodes,
    setVisibleHomeZipcodes,
    customerAnalysis,
  } = useUIStore();

  const handlePlaceClick = React.useCallback((place: Place, x: number, y: number) => {
    setTooltipInfo({ place, x, y });
  }, []);

  const layers = useDeckLayers(handlePlaceClick);

  React.useEffect(() => {
    if (!myPlace) return;
    const ui = useUIStore.getState();

    if (customerAnalysis.dataType === 'Trade Area' && !visibleTradeAreas[myPlace.id]) {
      ui.setVisibleTradeAreas(myPlace.id, customerAnalysis.selectedTradeAreas);
    }
    if (customerAnalysis.dataType === 'Home Zipcodes' && !visibleHomeZipcodes.placeId) {
      ui.setVisibleHomeZipcodes(myPlace.id);
    }

    const id = setTimeout(() => ui.updateLegend(), 80);

    if (
      myPlace.longitude &&
      myPlace.latitude &&
      viewState.longitude === -122.4194 &&
      viewState.latitude === 37.7749
    ) {
      ui.setViewState({
        longitude: myPlace.longitude,
        latitude: myPlace.latitude,
        zoom: 13,
      });
    }
    return () => clearTimeout(id);
  }, [
    myPlace,
    customerAnalysis.dataType,
    customerAnalysis.selectedTradeAreas,
    visibleTradeAreas,
    visibleHomeZipcodes,
    viewState.longitude,
    viewState.latitude,
  ]);

  React.useEffect(() => {
    if (!myPlace) return;
    if (customerAnalysis.dataType === 'Home Zipcodes') {
      setVisibleHomeZipcodes(myPlace.id);
    } else {
      setVisibleTradeAreas(myPlace.id, customerAnalysis.selectedTradeAreas);
    }
  }, [
    myPlace,
    customerAnalysis.dataType,
    customerAnalysis.selectedTradeAreas,
    setVisibleTradeAreas,
    setVisibleHomeZipcodes,
  ]);

  const handleViewStateChange = React.useCallback(({ viewState: vs }: any) => {
    setViewState(vs);
  }, [setViewState]);

  if (isLoading) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          px: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'center', color: 'text.primary' }}>
            Loading Map Data...
          </Typography>
          
          <LinearProgress 
            variant="determinate" 
            value={progress.overall} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              mb: 2,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
              }
            }} 
          />
          
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 3 }}>
            {progress.overall}% Complete
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Places & Competitors</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {progress.places.progress}%
                </Typography>
                {progress.places.loading && (
                  <CircularProgress size={16} thickness={4} sx={{ color: 'warning.main' }} />
                )}
                <Chip 
                  size="small" 
                  label={progress.places.loading ? "Loading..." : "✓ Loaded"} 
                  color={progress.places.loading ? "warning" : "success"}
                  variant="outlined"
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Trade Areas</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {progress.tradeAreas.progress}%
                </Typography>
                {progress.tradeAreas.loading && (
                  <CircularProgress size={16} thickness={4} sx={{ color: 'warning.main' }} />
                )}
                <Chip 
                  size="small" 
                  label={progress.tradeAreas.loading ? "Loading..." : "✓ Loaded"} 
                  color={progress.tradeAreas.loading ? "warning" : "success"}
                  variant="outlined"
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Zipcodes</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {progress.zipcodes.progress}%
                </Typography>
                {progress.zipcodes.loading && (
                  <CircularProgress size={16} thickness={4} sx={{ color: 'warning.main' }} />
                )}
                <Chip 
                  size="small" 
                  label={progress.zipcodes.loading ? "Loading..." : "✓ Loaded"} 
                  color={progress.zipcodes.loading ? "warning" : "success"}
                  variant="outlined"
                />
              </Box>
            </Box>
            
            {/* Status messages */}
            <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {progress.tradeAreas.loading ? progress.tradeAreas.status : 
                 progress.places.loading ? progress.places.status :
                 progress.zipcodes.loading ? progress.zipcodes.status :
                 'All data loaded successfully!'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 520 }}>
          Error loading data: {error?.message || 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100vh' }}>
      <DeckGL
        initialViewState={{
          longitude: viewState.longitude,
          latitude: viewState.latitude,
          zoom: viewState.zoom,
          pitch: viewState.pitch,
          bearing: viewState.bearing,
        } as any}
        onViewStateChange={handleViewStateChange}
        controller
        layers={layers}
        getTooltip={({ object }: any) => {
          if (!object) return null;
          if (object.pid && object.trade_area) {
            return { text: `Trade Area ${object.trade_area}% — Place ${object.pid}` };
          }
          if (object.place_id) {
            return { text: `Home Zipcode — Place ${object.place_id}` };
          }
          return null;
        }}
      >
        <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAP_STYLES.light} reuseMaps />
      </DeckGL>

      {tooltipInfo && (
        <Box
          sx={{
            position: 'absolute',
            left: tooltipInfo.x,
            top: tooltipInfo.y - 8,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000,
          }}
        >
          <PlaceTooltip place={tooltipInfo.place} onClose={() => setTooltipInfo(null)} />
        </Box>
      )}

      <Box
        className="glass-dark"
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 12,
          transform: 'translateX(-50%)',
          color: '#fff',
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Chip label="Trade Area" size="small" color="primary" variant="filled" />
        <Chip label="Home Zipcodes" size="small" color="secondary" variant="filled" />
      </Box>
    </Box>
  );
});

export default MapView;