'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Circle as CircleIcon,
  Stop as StopIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useUIStore } from '../stores';

const SIDEBAR_WIDTH = 340;

const RightSidebar: React.FC = React.memo(() => {
  const rightSidebarOpen = useUIStore(s => s.rightSidebarOpen);
  const setRightSidebarOpen = useUIStore(s => s.setRightSidebarOpen);
  const legendData = useUIStore(s => s.legendData);
  const customerAnalysis = useUIStore(s => s.customerAnalysis);

  React.useEffect(() => {
    const id = setTimeout(() => useUIStore.getState().updateLegend(), 80);
    return () => clearTimeout(id);
  }, [customerAnalysis.dataType, customerAnalysis.selectedTradeAreas]);

  const TradeAreaLegend = React.useMemo(() => {
    if (!legendData || legendData.type !== 'Trade Area') return null;
    return (
      <Card sx={{ mb: 1.25 }} elevation={0} className="glass">
        <CardContent sx={{ py: 1.25 }}>
          <Typography
            variant="subtitle1"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <StopIcon color="primary" fontSize="small" />
            Trade Area Legend
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Gösterilen yüzdeler: %30, %50, %70
          </Typography>

          <List dense>
            {legendData.items.map((item: any, i: number) => (
              <ListItem key={i} sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <CircleIcon
                    sx={{ color: item.color, opacity: item.opacity || 1, fontSize: 16 }}
                  />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                  primary={`${item.label} Trade Area`}
                  secondary={
                    item.value === 70
                      ? 'En küçük polygon (yüksek yoğunluk)'
                      : item.value === 50
                      ? 'Orta polygon'
                      : 'En geniş polygon (düşük yoğunluk)'
                  }
                />
                <Chip
                  label={`${item.value}%`}
                  size="small"
                  sx={{
                    backgroundColor: item.color,
                    color: '#fff',
                    opacity: item.opacity || 1,
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            En geniş: %70 • En küçük: %30
          </Typography>
        </CardContent>
      </Card>
    );
  }, [legendData]);

  const HomeZipcodesLegend = React.useMemo(() => {
    if (!legendData || legendData.type !== 'Home Zipcodes') return null;
    return (
      <Card sx={{ mb: 1.25 }} elevation={0} className="glass">
        <CardContent sx={{ py: 1.25 }}>
          <Typography
            variant="subtitle1"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CircleIcon color="secondary" fontSize="small" />
            Home Zipcodes Legend
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Percentile 5 gruba ayrılmıştır
          </Typography>

          <List dense>
            {legendData.items.map((item: any, i: number) => (
              <ListItem key={i} sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <CircleIcon sx={{ color: item.color, fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                  primary={`Percentile ${item.label}`}
                  secondary={`Aralık: ${item.value}`}
                />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Aynı anda yalnızca bir place.
          </Typography>
        </CardContent>
      </Card>
    );
  }, [legendData]);

  const PlaceLegend = React.useMemo(() => {
    return (
      <Card elevation={0} className="glass">
        <CardContent sx={{ py: 1.25 }}>
          <Typography variant="subtitle1" gutterBottom>
            Place Legend
          </Typography>
          <List dense>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <HomeIcon
                  sx={{
                    color: '#FF4500',
                    fontSize: 18,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
                primary="My Place"
                secondary="Ana analiz noktası - Home icon"
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <CircleIcon sx={{ color: '#667085', fontSize: 14 }} />
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
                primary="Diğer Places"
                secondary="Varsayılan ikon"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    );
  }, []);

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={rightSidebarOpen}
      sx={{
        width: rightSidebarOpen ? SIDEBAR_WIDTH : 0,
        flexShrink: 0,
        zIndex: 1200,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          borderLeft: 'none',
          background: 'transparent',
        },
      }}
    >
      <Box
        className="glass"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'rgba(0, 0, 0, 0.87)' }}>
            Legend
          </Typography>
          <IconButton 
            edge="end" 
            onClick={() => setRightSidebarOpen(false)} 
            size="small"
            sx={{
              color: 'rgba(0, 0, 0, 0.87)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 1.25 }}>
          {customerAnalysis.dataType === 'Trade Area' && TradeAreaLegend}
          {customerAnalysis.dataType === 'Home Zipcodes' && HomeZipcodesLegend}
          {PlaceLegend}

          <Box
            sx={{
              mt: 1.25,
              p: 1,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
              Aktif Veri Türü
            </Typography>
            <Chip
              label={customerAnalysis.dataType}
              color={customerAnalysis.dataType === 'Trade Area' ? 'primary' : 'secondary'}
              size="small"
            />
            {customerAnalysis.dataType === 'Trade Area' && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Seçili: {customerAnalysis.selectedTradeAreas.join(', ')}%
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
});

export default RightSidebar;