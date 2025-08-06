'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Tooltip,
  Divider,
} from '@mui/material';
import { Place } from '../types';
import { useUIStore } from '../stores';
import { useTradeAreas, useHomeZipcodes } from '../hooks/useData';

interface PlaceTooltipProps {
  place: Place;
  onClose: () => void;
}

export const PlaceTooltip: React.FC<PlaceTooltipProps> = React.memo(
  ({ place, onClose }) => {
    const {
      customerAnalysis,
      visibleTradeAreas,
      visibleHomeZipcodes,
      setVisibleTradeAreas,
      setVisibleHomeZipcodes,
    } = useUIStore();

    const { data: tradeAreas = [] } = useTradeAreas();
    const { data: homeZipcodes = [] } = useHomeZipcodes();

    const hasTradeAreaData = React.useMemo(
      () => !!place.isTradeAreaAvailable && tradeAreas.some((ta) => ta.pid === place.id),
      [place.isTradeAreaAvailable, place.id, tradeAreas]
    );

    const hasHomeZipcodesData = React.useMemo(
      () => !!place.isHomeZipcodesAvailable && homeZipcodes.some((hz) => hz.place_id === place.id),
      [place.isHomeZipcodesAvailable, place.id, homeZipcodes]
    );

    const currentTradeAreas = visibleTradeAreas[place.id] || [];
    const isTradeAreaVisible = currentTradeAreas.length > 0;
    const isHomeZipcodesVisible = visibleHomeZipcodes.placeId === place.id;

    const handleTradeAreaToggle = React.useCallback(() => {
      if (isTradeAreaVisible) {
        setVisibleTradeAreas(place.id, []);
      } else {
        setVisibleTradeAreas(place.id, customerAnalysis.selectedTradeAreas);
      }
    }, [
      isTradeAreaVisible,
      place.id,
      customerAnalysis.selectedTradeAreas,
      setVisibleTradeAreas,
    ]);

    const handleHomeZipcodesToggle = React.useCallback(() => {
      if (isHomeZipcodesVisible) {
        setVisibleHomeZipcodes(null);
      } else {
        setVisibleHomeZipcodes(place.id);
      }
    }, [isHomeZipcodesVisible, place.id, setVisibleHomeZipcodes]);

    return (
      <Card
        elevation={3}
        sx={{
          minWidth: 280,
          maxWidth: 360,
          borderRadius: 2,
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(17,24,39,0.06)',
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {place.name}
          </Typography>

          <Typography variant="caption" color="text.secondary" display="block">
            {place.street_address}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {place.city}, {place.state}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 1 }}
          >
            Industry: {place.industry}
          </Typography>

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {customerAnalysis.dataType === 'Trade Area' && (
              <Tooltip
                title={!hasTradeAreaData ? 'Bu place için trade area verisi yok' : ''}
                placement="top"
                arrow
              >
                <span>
                  <Button
                    variant={isTradeAreaVisible ? 'contained' : 'outlined'}
                    color="primary"
                    fullWidth
                    disabled={!hasTradeAreaData}
                    onClick={handleTradeAreaToggle}
                    size="small"
                  >
                    {isTradeAreaVisible ? 'Hide Trade Area' : 'Show Trade Area'}
                  </Button>
                </span>
              </Tooltip>
            )}

            {customerAnalysis.dataType === 'Home Zipcodes' && (
              <Tooltip
                title={!hasHomeZipcodesData ? 'Bu place için home zipcodes verisi yok' : ''}
                placement="top"
                arrow
              >
                <span>
                  <Button
                    variant={isHomeZipcodesVisible ? 'contained' : 'outlined'}
                    color="secondary"
                    fullWidth
                    disabled={!hasHomeZipcodesData}
                    onClick={handleHomeZipcodesToggle}
                    size="small"
                  >
                    {isHomeZipcodesVisible ? 'Hide Home Zipcodes' : 'Show Home Zipcodes'}
                  </Button>
                </span>
              </Tooltip>
            )}

            <Button variant="text" size="small" onClick={onClose} sx={{ mt: 0.25 }}>
              Close
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }
);