'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Divider,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useUIStore } from '../stores';
import { usePlaces } from '../hooks/use-data';

const SIDEBAR_WIDTH = 360;

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
}> = ({ icon, title }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      color: 'text.primary',
    }}
  >
    {icon}
    <Typography variant="subtitle2" fontWeight={700}>
      {title}
    </Typography>
  </Box>
);

const LeftSidebar: React.FC = React.memo(() => {
  const leftSidebarOpen = useUIStore(s => s.leftSidebarOpen);
  const setLeftSidebarOpen = useUIStore(s => s.setLeftSidebarOpen);
  const placeAnalysis = useUIStore(s => s.placeAnalysis);
  const setPlaceAnalysis = useUIStore(s => s.setPlaceAnalysis);
  const customerAnalysis = useUIStore(s => s.customerAnalysis);
  const setCustomerAnalysis = useUIStore(s => s.setCustomerAnalysis);

  const { data: places = [] } = usePlaces();

  const availableIndustries = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of places) if (p.industry) set.add(p.industry);
    return Array.from(set).sort();
  }, [places]);

  const handleRadiusChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
      setPlaceAnalysis({ radius: safe });
    },
    [setPlaceAnalysis]
  );

  const handlePlaceAnalysisToggle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPlaceAnalysis({ isVisible: event.target.checked });
    },
    [setPlaceAnalysis]
  );

  const setDataType = React.useCallback(
    (v: 'Trade Area' | 'Home Zipcodes') => {
      if (v !== customerAnalysis.dataType) setCustomerAnalysis({ dataType: v });
    },
    [customerAnalysis.dataType, setCustomerAnalysis]
  );

  const toggleTradeArea = React.useCallback(
    (p: number) => {
      const curr = customerAnalysis.selectedTradeAreas;
      const next = curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p];
      setCustomerAnalysis({ selectedTradeAreas: next });
    },
    [customerAnalysis.selectedTradeAreas, setCustomerAnalysis]
  );

  const handleCustomerAnalysisToggle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCustomerAnalysis({ isVisible: event.target.checked });
    },
    [setCustomerAnalysis]
  );

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={leftSidebarOpen}
      sx={{
        width: leftSidebarOpen ? SIDEBAR_WIDTH : 0,
        flexShrink: 0,
        zIndex: 1200,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          borderRight: 'none',
          p: 0,
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
            Controls
          </Typography>
          <IconButton
            edge="end"
            onClick={() => setLeftSidebarOpen(false)}
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
          <Accordion
            defaultExpanded
            disableGutters
            elevation={0}
            sx={{
              mb: 1,
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: 'rgba(17,24,39,0.03)',
                minHeight: 44,
                '& .MuiAccordionSummary-content': { my: 0.5 },
              }}
            >
              <SectionHeader
                icon={<BusinessIcon color="primary" fontSize="small" />}
                title="Place Analysis"
              />
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                "My Place" çevresini sektör ve mesafeye göre filtreleyin.
              </Typography>

              <TextField
                label="Radius (km)"
                type="number"
                value={placeAnalysis.radius}
                onChange={handleRadiusChange}
                inputProps={{ min: 0, step: 0.5 }}
                size="small"
                fullWidth
              />
              <Box sx={{ mt: 1.25 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.primary"
                  gutterBottom
                  display="block"
                >
                  Sektörler
                </Typography>
                <Autocomplete
                  multiple
                  options={availableIndustries}
                  value={placeAnalysis.selectedIndustries}
                  onChange={(_, v) => setPlaceAnalysis({ selectedIndustries: v })}
                  size="small"
                  renderInput={(params) => (
                    <TextField {...(params as any)} placeholder="Sektör seçin..." size="small" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const tagProps = getTagProps({ index });
                      // Spread tagProps last to let it provide the key
                      return (
                        <Chip
                          label={option}
                          size="small"
                          color="default"
                          variant="outlined"
                          {...tagProps}
                        />
                      );
                    })
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {placeAnalysis.selectedIndustries.length > 0
                    ? `${placeAnalysis.selectedIndustries.length} sektör seçildi`
                    : 'Tüm sektörler'}
                </Typography>
              </Box>

              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={placeAnalysis.isVisible}
                    onChange={handlePlaceAnalysisToggle}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="caption">Haritada göster</Typography>}
              />
            </AccordionDetails>
          </Accordion>

          <Accordion
            defaultExpanded
            disableGutters
            elevation={0}
            sx={{
              mb: 1,
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: 'rgba(17,24,39,0.03)',
                minHeight: 44,
                '& .MuiAccordionSummary-content': { my: 0.5 },
              }}
            >
              <SectionHeader
                icon={<PeopleIcon color="secondary" fontSize="small" />}
                title="Customer Analysis"
              />
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Müşteri yoğunluğu yüzdelik dilimlerle görselleştirilir.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label="Trade Area"
                  color={customerAnalysis.dataType === 'Trade Area' ? 'primary' : 'default'}
                  variant={customerAnalysis.dataType === 'Trade Area' ? 'filled' : 'outlined'}
                  size="small"
                  onClick={() => setDataType('Trade Area')}
                />
                <Chip
                  label="Home Zipcodes"
                  color={customerAnalysis.dataType === 'Home Zipcodes' ? 'secondary' : 'default'}
                  variant={customerAnalysis.dataType === 'Home Zipcodes' ? 'filled' : 'outlined'}
                  size="small"
                  onClick={() => setDataType('Home Zipcodes')}
                />
              </Box>

              {customerAnalysis.dataType === 'Trade Area' ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                    Görüntüleme Yüzdeleri
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {[30, 50, 70].map((p) => {
                      const active = customerAnalysis.selectedTradeAreas.includes(p);
                      return (
                        <Chip
                          key={p}
                          label={`${p}%`}
                          color={active ? 'primary' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => toggleTradeArea(p)}
                        />
                      );
                    })}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    En geniş polygon %70, en küçük %30.
                  </Typography>
                </Box>
              ) : (
                <Box
                  className="glass"
                  sx={{
                    mt: 1,
                    p: 1,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Percentile 5 grupta gösterilir. Aynı anda yalnızca bir place.
                  </Typography>
                </Box>
              )}

              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={customerAnalysis.isVisible}
                    onChange={handleCustomerAnalysisToggle}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="caption">Haritada göster</Typography>}
              />
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 1.25 }} />

          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider',
              backgroundColor: 'rgba(17,24,39,0.02)',
            }}
          >
            <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
              Özet
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Radius: {placeAnalysis.radius} km
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Sektörler: {placeAnalysis.selectedIndustries.length || 'Tümü'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Data Type: {customerAnalysis.dataType}
            </Typography>
            {customerAnalysis.dataType === 'Trade Area' && (
              <Typography variant="caption" color="text.secondary" display="block">
                Trade Areas: {customerAnalysis.selectedTradeAreas.join(', ')}%
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
});

export default LeftSidebar;