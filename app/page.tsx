'use client';

import React from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Menu as MenuIcon, ViewList as LegendIcon } from '@mui/icons-material';
import { useUIStore } from '../stores';
import MapView from '../components/MapView';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';

export default function Home() {
  const { leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen } = useUIStore();

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <LeftSidebar />

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin 0.25s ease',
        }}
      >
        <AppBar
          position="relative"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Toolbar variant="dense">
            <IconButton
              edge="start"
              sx={{ 
                mr: 1,
                color: 'rgba(0, 0, 0, 0.87)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
              aria-label="toggle left sidebar"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              size="small"
            >
              <MenuIcon fontSize="small" />
            </IconButton>

            <Typography variant="subtitle1" component="div" sx={{ flexGrow: 1, fontWeight: 600, color: 'rgba(0, 0, 0, 0.87)' }}>
              Place & Trade Area Data Visualization
            </Typography>

            <Typography variant="caption" sx={{ opacity: 0.7, mr: 1.5, color: 'rgba(0, 0, 0, 0.6)' }}>
              Deck.gl • Mapbox • Material UI
            </Typography>

            <IconButton
              sx={{
                color: 'rgba(0, 0, 0, 0.87)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
              aria-label="toggle right sidebar"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              size="small"
            >
              <LegendIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, position: 'relative' }}>
          <MapView />

          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              zIndex: 1000,
              textAlign: 'center',
            }}
          >
            <Typography variant="caption">
              Sol: Place & Customer Analysis • Sağ: Legend • Harita: Pinpoint'lere tıklayın
            </Typography>
          </Box>
        </Box>
      </Box>

      <RightSidebar />
    </Box>
  );
}