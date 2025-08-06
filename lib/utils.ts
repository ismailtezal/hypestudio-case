// utils.ts

// Mapbox configuration
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Map style URLs (add a clean, high-performance light style if needed)
export const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  // Optional: a custom minimal style you host to reduce label clutter
  cleanLight:
    'mapbox://styles/mapbox/light-v11', // replace with custom style if available
} as const;

// Modern design palette (aligned with theme)
export const PALETTE = {
  primary: '#4F46E5', // indigo-600
  primaryDark: '#3730A3', // indigo-800
  secondary: '#06B6D4', // cyan-500
  secondaryDark: '#0E7490', // cyan-700

  textPrimary: '#111827', // gray-900
  textSecondary: '#6B7280', // gray-500
  border: 'rgba(17, 24, 39, 0.08)',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F3F4F6',
  gray50: '#F7F7FA',
} as const;

// Utility to convert hex + alpha to [r,g,b,a] or hex with opacity
export const hexToRgba = (hex: string, alpha = 1): [number, number, number, number] => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, Math.max(0, Math.min(1, alpha))];
};

export const withOpacity = (hex: string, alpha: number) => {
  const [r, g, b, a] = hexToRgba(hex, alpha);
  return [r, g, b, Math.round(a * 255)] as [number, number, number, number];
};

// Data visualization color system (deck.gl prefers number arrays)
export const COLORS = {
  ui: {
    primary: PALETTE.primary,
    secondary: PALETTE.secondary,
    textPrimary: PALETTE.textPrimary,
    textSecondary: PALETTE.textSecondary,
    border: PALETTE.border,
  },

  // Marker and polygons (deck.gl RGBA arrays)
  place: {
    myPlace: withOpacity('#FF3B30', 0.95),
    others: withOpacity('#667085', 0.9),
  },

  competitors: {
    // UI (hex) + deck (rgba) pairing for flexibility
    restaurantHex: '#ff6b6b',
    retailHex: '#4ecdc4',
    serviceHex: '#45b7d1',
    healthcareHex: '#96ceb4',
    defaultHex: '#6c5ce7',

    restaurant: withOpacity('#ff6b6b', 0.9),
    retail: withOpacity('#4ecdc4', 0.9),
    service: withOpacity('#45b7d1', 0.9),
    healthcare: withOpacity('#96ceb4', 0.9),
    default: withOpacity('#6c5ce7', 0.9),
  },

  // Trade areas: align with theme accents, consistent opacities
  tradeArea: {
    // 30, 50, 70 — use distinct hues with clarity
    p30: withOpacity('#4F46E5', 0.35), // primary
    p50: withOpacity('#06B6D4', 0.28), // secondary
    p70: withOpacity('#10B981', 0.22), // teal/green
    stroke: withOpacity('#111827', 0.25),
  },

  heatmap: [
    withOpacity('#0198BD', 0.78),
    withOpacity('#49E3CE', 0.78),
    withOpacity('#D8FEB5', 0.78),
    withOpacity('#FEEDB1', 0.78),
    withOpacity('#FEAD54', 0.78),
    withOpacity('#D1374E', 0.78),
  ],

  zipcode: {
    fill: withOpacity('#FFFFFF', 0.35),
    stroke: withOpacity('#808080', 0.8),
    selected: withOpacity('#FFD700', 0.6), // gold
  },
} as const;

// Layer Z-index ordering (deck.gl draw order is layer order; still keep semantic map)
export const LAYER_ORDER = {
  zipcodes: 1,
  tradeAreas: 2,
  heatmap: 3,
  competitors: 4,
  place: 5,
  selected: 6,
} as const;

// Animation and interaction settings (match theme easing)
export const ANIMATION = {
  transitionDuration: 280,
  easingFunction: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
  hoverScale: 1.12,
  selectedScale: 1.3,
} as const;

// Formatters
export const formatDistance = (distance: number): string => {
  if (!Number.isFinite(distance)) return '';
  if (distance < 1) return `${Math.round(distance * 1000)}m`;
  return `${distance.toFixed(1)}km`;
};

export const formatPercentage = (percentage: number, digits = 0): string => {
  if (!Number.isFinite(percentage)) return '';
  return `${percentage.toFixed(digits)}%`;
};

export const formatAddress = (competitor: {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string | number;
}): string => {
  const parts = [competitor.address, competitor.city, competitor.state, competitor.zip_code]
    .filter(Boolean)
    .map(String);
  return parts.join(', ');
};

// Coordinate helpers
export const isValidCoordinate = (lng: number, lat: number): boolean => {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90 &&
    !Number.isNaN(lng) &&
    !Number.isNaN(lat)
  );
};

export const calculateBounds = (
  coordinates: Array<[number, number]>
): [[number, number], [number, number]] => {
  const valid = coordinates.filter(([lng, lat]) => isValidCoordinate(lng, lat));
  if (valid.length === 0) {
    // Default SF bounds as fallback
    return [[-122.5, 37.7], [-122.3, 37.8]];
  }
  const lngs = valid.map((c) => c[0]);
  const lats = valid.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};

// Export utilities with safety guards
export const exportToCSV = (data: any[], filename: string): void => {
  if (!Array.isArray(data) || data.length === 0) return;
  const headers = Array.from(
    new Set(data.flatMap((row) => Object.keys(row ?? {})))
  );

  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => escapeCell(row?.[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || 'export'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJSON = (data: any, filename: string): void => {
  const json = JSON.stringify(data ?? {}, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || 'export'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};