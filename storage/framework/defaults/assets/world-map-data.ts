// This file contains a simplified world map data for ECharts
// It's a simplified version of the world map GeoJSON data

export const world = {
  type: 'FeatureCollection' as const,
  features: [
    // North America
    {
      type: 'Feature' as const,
      id: 'USA',
      properties: { name: 'United States of America' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'CAN',
      properties: { name: 'Canada' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[0, 10], [10, 10], [10, 20], [0, 20], [0, 10]]]], // Simplified coordinates
      },
    },
    // Europe
    {
      type: 'Feature' as const,
      id: 'DEU',
      properties: { name: 'Germany' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-10, 0], [0, 0], [0, 10], [-10, 10], [-10, 0]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'GBR',
      properties: { name: 'United Kingdom' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[-15, 5], [-10, 5], [-10, 15], [-15, 15], [-15, 5]]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'FRA',
      properties: { name: 'France' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[-15, 0], [-5, 0], [-5, 5], [-15, 5], [-15, 0]]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'ESP',
      properties: { name: 'Spain' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-20, -5], [-10, -5], [-10, 0], [-20, 0], [-20, -5]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'NLD',
      properties: { name: 'Netherlands' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[-5, 5], [0, 5], [0, 10], [-5, 10], [-5, 5]]]], // Simplified coordinates
      },
    },
    // Asia
    {
      type: 'Feature' as const,
      id: 'IND',
      properties: { name: 'India' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[20, -10], [30, -10], [30, 0], [20, 0], [20, -10]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'IDN',
      properties: { name: 'Indonesia' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[20, -20], [30, -20], [30, -15], [20, -15], [20, -20]]]], // Simplified coordinates
      },
    },
    {
      type: 'Feature' as const,
      id: 'JPN',
      properties: { name: 'Japan' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[35, 0], [40, 0], [40, 10], [35, 10], [35, 0]]]], // Simplified coordinates
      },
    },
    // Oceania
    {
      type: 'Feature' as const,
      id: 'AUS',
      properties: { name: 'Australia' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [[[[20, -30], [30, -30], [30, -20], [20, -20], [20, -30]]]], // Simplified coordinates
      },
    },
    // South America
    {
      type: 'Feature' as const,
      id: 'BRA',
      properties: { name: 'Brazil' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-10, -20], [0, -20], [0, -10], [-10, -10], [-10, -20]]], // Simplified coordinates
      },
    },
  ],
}
