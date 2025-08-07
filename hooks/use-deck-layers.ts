import React from 'react';
import { ScatterplotLayer, PolygonLayer, IconLayer } from 'deck.gl';
import { useUIStore } from '../stores';
import { useHomeZipcodes } from './use-data';
import { useProgressData } from './use-progress-data';
import { COLORS, isValidCoordinate } from '../lib/utils';
import { Place } from '../types';

export const useDeckLayers = (onPlaceClick?: (place: Place, x: number, y: number) => void) => {
  const { places, tradeAreas, zipcodes } = useProgressData();
  const { data: homeZipcodes = [] } = useHomeZipcodes();

  const myPlace = places.length > 0 ? places[0] : null;
  const { 
    placeAnalysis,
    customerAnalysis,
    visibleTradeAreas,
    visibleHomeZipcodes,
    setSelectedPlace,
    setHoveredPlace,
  } = useUIStore();

  const layers = React.useMemo(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      console.log('=== Rendering Layers ===', {
        placesCount: places?.length,
        myPlace,
        customerAnalysis,
        placeAnalysis,
        visibleTradeAreas,
        tradeAreasCount: tradeAreas.length,
      });
    }
    
    // Validate data before proceeding
    if (!Array.isArray(tradeAreas)) {
      console.error('❌ tradeAreas is not an array:', typeof tradeAreas, tradeAreas);
      return [];
    }
    
    if (!Array.isArray(places)) {
      console.error('❌ places is not an array:', typeof places, places);
      return [];
    }
    
    if (!Array.isArray(zipcodes)) {
      console.error('❌ zipcodes is not an array:', typeof zipcodes, zipcodes);
      return [];
    }
    
    const layerList = [];

    // Filter places based on Place Analysis settings
    const filteredPlaces = places.filter(place => {
      if (!placeAnalysis.isVisible) return false;
      
      // Industry filter
      if (placeAnalysis.selectedIndustries.length > 0 && 
          !placeAnalysis.selectedIndustries.includes(place.industry)) {
        return false;
      }

      // Radius filter (distance from myPlace)
      if (myPlace && place.id !== myPlace.id) {
        const distance = calculateDistance(
          myPlace.latitude, myPlace.longitude,
          place.latitude, place.longitude
        );
        if (distance > placeAnalysis.radius) {
          return false;
        }
      }

      return true;
    });

    // Home Zipcodes Layer (shown only if selected in Customer Analysis)
    if (customerAnalysis.dataType === 'Home Zipcodes' && 
        customerAnalysis.isVisible && 
        visibleHomeZipcodes.placeId) {
      
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('=== Home Zipcodes Layer Conditions Met ===', {
          placeId: visibleHomeZipcodes.placeId,
          available: homeZipcodes.map(hz => hz.pid || hz.place_id)
        });
      }
      
      const activeHomeZipcodes = homeZipcodes.find(
        hz => hz.place_id === visibleHomeZipcodes.placeId
      );

      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('Found activeHomeZipcodes:', activeHomeZipcodes);
      }

      if (activeHomeZipcodes && zipcodes.length > 0) {
        // Convert locations array to object format - case study uses Location[] format
        let locationsObj: { [id: string]: number } = {};
        if (Array.isArray(activeHomeZipcodes.locations)) {
          // Convert array format to object format with strict guards
          for (const item of activeHomeZipcodes.locations as Array<Record<string, number | string>>) {
            const keys = Object.keys(item as Record<string, number | string>);
            if (keys.length === 0) continue;
            const key = keys[0] as keyof typeof item;
            const raw = (item as Record<string, number | string>)[key as string];
            const numeric = typeof raw === 'string' ? parseFloat(raw) : raw;
            if (typeof numeric === 'number' && Number.isFinite(numeric)) {
              locationsObj[key as string] = numeric;
            }
          }
        } else {
          // Fallback for backward compatibility
          locationsObj = activeHomeZipcodes.locations as { [id: string]: number };
        }
        
        if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log('Processed locations object:', locationsObj);
        }

        // Create polygons with percentile-based coloring
        const homeZipcodePolygons = zipcodes
          .filter(zipcode => zipcode.id in locationsObj)
          .map(zipcode => ({
            ...zipcode,
            percentile: locationsObj[zipcode.id] || 0,
          }));

        if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log(`Found ${homeZipcodePolygons.length} matching home zipcode polygons`);
        }

        layerList.push(
          new PolygonLayer({
            id: 'home-zipcodes',
            data: homeZipcodePolygons,
            pickable: true,
            stroked: true,
            filled: true,
            wireframe: false,
            lineWidthMinPixels: 1,
            getPolygon: (d: any) => {
              const polygon = d.polygon;
              if (!polygon) return [];
              if (polygon.type === 'Polygon') return polygon.coordinates[0];
              if (polygon.type === 'MultiPolygon') return polygon.coordinates[0][0];
              return [];
            },
            getFillColor: (d: any) => getHomeZipcodeColor(d.percentile),
            getLineColor: [128, 128, 128, 200],
            getLineWidth: 1,
            updateTriggers: {
              getFillColor: [customerAnalysis, visibleHomeZipcodes],
            },
            onHover: (info: any) => setHoveredPlace(info.object),
            onClick: (info: any) => console.log('Home Zipcode clicked:', info.object),
          })
        );
      }
    }

    // Trade Areas Layer (shown only if selected in Customer Analysis)
    if (customerAnalysis.dataType === 'Trade Area' && customerAnalysis.isVisible) {
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('=== Trade Area Layer Conditions Met ===', {
          selected: customerAnalysis.selectedTradeAreas,
          entries: Object.entries(visibleTradeAreas)
        });
      }
      
      Object.entries(visibleTradeAreas).forEach(([placeId, visibleAreas]) => {
        if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log(`Processing placeId: ${placeId}, visibleAreas:`, visibleAreas);
        }
        
        if (visibleAreas.length === 0) {
          console.log(`No visible areas for place ${placeId}`);
          return;
        }

        // Filter by both: areas visible for this place AND selected percentages in UI
        const activeAreas = visibleAreas.filter(area => 
          customerAnalysis.selectedTradeAreas.includes(area)
        );
        
        if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log(`Active areas for place ${placeId}:`, activeAreas);
        }
        
        if (activeAreas.length === 0) {
          console.log(`No active areas for place ${placeId} after filtering by selected percentages`);
          return;
        }

        const placeTradeAreas = tradeAreas.filter(
          ta => String(ta.pid) === String(placeId) && activeAreas.includes(ta.trade_area)
        );
        
        if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log(`Found ${placeTradeAreas.length} trade areas for place ${placeId}`);
        }
        
        // Debug: Check the actual structure of trade area data
        if (placeTradeAreas.length > 0) {
          if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
            // eslint-disable-next-line no-console
            console.log('Sample trade area object:', placeTradeAreas[0]);
          }
        }

        placeTradeAreas.forEach(tradeArea => {
          // Validate trade area data before creating layer
          if (!tradeArea || typeof tradeArea !== 'object') {
            console.error('Invalid trade area object:', tradeArea);
            return;
          }
          
          if (tradeArea.pid === undefined || tradeArea.pid === null) {
            console.error('Trade area missing pid:', tradeArea);
            return;
          }
          
          if (tradeArea.trade_area === undefined || tradeArea.trade_area === null) {
            console.error('Trade area missing trade_area field:', tradeArea);
            return;
          }
          
          if (!tradeArea.polygon) {
            console.error('Trade area missing polygon data:', tradeArea);
            return;
          }

          // Parse polygon to check structure
          let polygonData;
          try {
            polygonData = typeof tradeArea.polygon === 'string' ? JSON.parse(tradeArea.polygon) : tradeArea.polygon;
          } catch (e) {
            console.error('Failed to parse polygon for trade area:', tradeArea.trade_area, e);
            return;
          }
          
          if (!polygonData || !polygonData.type) {
            console.error('Invalid polygon structure for trade area:', tradeArea.trade_area, polygonData);
            return;
          }
          
          if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
            // eslint-disable-next-line no-console
            console.log(`Creating polygon layer for trade area ${tradeArea.trade_area}`);
          }
          
          layerList.push(
            new PolygonLayer({
              id: `trade-area-${placeId}-${tradeArea.trade_area}`,
              data: [tradeArea].filter(Boolean), // Filter out any null/undefined values
              pickable: true,
              stroked: true,
              filled: true,
              wireframe: false,
              lineWidthMinPixels: 2,
              getPolygon: (d: any) => {
                const polygon = d.polygon;
                if (!polygon) return [];
                if (polygon.type === 'Polygon') return polygon.coordinates[0];
                if (polygon.type === 'MultiPolygon') return polygon.coordinates[0][0];
                return [];
              },
              getFillColor: getTradeAreaColor(tradeArea.trade_area),
              getLineColor: getTradeAreaBorderColor(tradeArea.trade_area),
              getLineWidth: 2,
              updateTriggers: {
                getFillColor: [customerAnalysis, visibleTradeAreas],
              },
              onHover: (info: any) => setHoveredPlace(info.object),
              onClick: (info: any) => console.log('Trade Area clicked:', info.object),
            })
          );
        });
      });
    }

    // Regular Places (Pinpoints) Layer - excluding myPlace (first item in array)
    const regularPlaces = filteredPlaces.slice(1).filter(place => {
      // Convert string coordinates to numbers
      const lng = typeof place.longitude === 'string' ? parseFloat(place.longitude) : place.longitude;
      const lat = typeof place.latitude === 'string' ? parseFloat(place.latitude) : place.latitude;
      return isValidCoordinate(lng, lat);
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      console.log('Regular places after filtering:', regularPlaces.length);
    }
    
    // Convert myPlace coordinates to numbers for validation
    const myPlaceLng = myPlace && typeof myPlace.longitude === 'string' ? parseFloat(myPlace.longitude) : myPlace?.longitude;
    const myPlaceLat = myPlace && typeof myPlace.latitude === 'string' ? parseFloat(myPlace.latitude) : myPlace?.latitude;
    
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      const lngNum = typeof myPlaceLng === 'number' ? myPlaceLng : NaN;
      const latNum = typeof myPlaceLat === 'number' ? myPlaceLat : NaN;
      console.log('myPlace coords valid:', myPlace ? isValidCoordinate(lngNum, latNum) : false);
    }
    
    if (regularPlaces.length > 0) {
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('Creating ScatterplotLayer for', regularPlaces.length, 'places');
      }
      layerList.push(
        new ScatterplotLayer({
          id: 'places',
          data: regularPlaces,
          pickable: true,
          opacity: 1,
          stroked: true,
          filled: true,
          radiusScale: 1,
          radiusMinPixels: 8,
          radiusMaxPixels: 20,
          lineWidthMinPixels: 2,
          getPosition: (d: Place) => {
            // Convert string coordinates to numbers
            const lng = typeof d.longitude === 'string' ? parseFloat(d.longitude) : d.longitude;
            const lat = typeof d.latitude === 'string' ? parseFloat(d.latitude) : d.latitude;
            if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
              // eslint-disable-next-line no-console
              console.log('Getting position for place');
            }
            return [lng, lat];
          },
          getRadius: 12,
          getFillColor: [102, 102, 102, 255],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          onHover: (info: any) => setHoveredPlace(info.object),
          onClick: (info: any) => {
            if (info.object && onPlaceClick) {
              onPlaceClick(info.object, info.x, info.y);
            }
          },
        })
      );
    } else {
      console.log('❌ No regular places to render');
    }

    // My Place Icon Layer - with home icon for better visibility
    if (
      myPlace &&
      typeof myPlaceLng === 'number' &&
      typeof myPlaceLat === 'number' &&
      isValidCoordinate(myPlaceLng, myPlaceLat)
    ) {
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('Creating MyPlace icon layer');
      }
      layerList.push(
        new IconLayer({
          id: 'my-place-icon',
          data: [myPlace],
          pickable: true,
          iconAtlas: 'data:image/svg+xml;base64,' + btoa(`
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="#FF4500" stroke="#FFFFFF" stroke-width="1"/>
            </svg>
          `),
          iconMapping: {
            home: { x: 0, y: 0, width: 64, height: 64 }
          },
          getIcon: () => 'home',
          getPosition: (d: Place) => {
            // Convert string coordinates to numbers
            const lng = typeof d.longitude === 'string' ? parseFloat(d.longitude) : d.longitude;
            const lat = typeof d.latitude === 'string' ? parseFloat(d.latitude) : d.latitude;
            if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
              // eslint-disable-next-line no-console
              console.log('Getting position for myPlace');
            }
            return [lng, lat];
          },
          getSize: 40, // Large size for visibility
          getColor: [255, 69, 0, 255], // Orange-red color
          updateTriggers: {
            getPosition: [myPlace],
          },
          onHover: (info: any) => setHoveredPlace(info.object),
          onClick: (info: any) => {
            if (info.object && onPlaceClick) {
              onPlaceClick(info.object, info.x, info.y);
            }
          },
        })
      );
    } else {
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        // eslint-disable-next-line no-console
        console.log('Cannot create myPlace layer');
      }
    }

    return layerList;
  }, [
    places,
    tradeAreas,
    homeZipcodes,
    zipcodes,
    myPlace,
    placeAnalysis,
    customerAnalysis,
    visibleTradeAreas,
    visibleHomeZipcodes,
    setSelectedPlace,
    setHoveredPlace,
    onPlaceClick,
  ]);

  return layers;
};

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d;
}

function getTradeAreaColor(percentage: number): [number, number, number, number] {
  switch (percentage) {
    case 70: return [255, 107, 107, 120]; // Smallest area, reduced opacity red
    case 50: return [78, 205, 196, 100]; // Medium area, reduced opacity teal  
    case 30: return [69, 183, 209, 80]; // Largest area, lowest opacity blue
    default: return [128, 128, 128, 60];
  }
}

function getTradeAreaBorderColor(percentage: number): [number, number, number, number] {
  switch (percentage) {
    case 70: return [255, 0, 0, 255];     // Red border
    case 50: return [0, 150, 150, 255];   // Teal border
    case 30: return [0, 100, 200, 255];   // Blue border
    default: return [128, 128, 128, 255];
  }
}

function getHomeZipcodeColor(percentile: number): [number, number, number, number] {
  if (percentile >= 80) return [139, 0, 0, 200];     // Dark red (80-100)
  if (percentile >= 60) return [205, 92, 92, 180];   // Indian red (60-80)
  if (percentile >= 40) return [255, 165, 0, 160];   // Orange (40-60)
  if (percentile >= 20) return [255, 215, 0, 140];   // Gold (20-40)
  return [144, 238, 144, 120];                       // Light green (0-20)
}
