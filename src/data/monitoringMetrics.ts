export interface MetricMeta {
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
}

export interface MetricTab {
  id: string;
  label: string;
  metrics: string[];
}

export const METRIC_META: Record<string, MetricMeta> = {
  temperature: { label: 'Air Temperature', shortLabel: 'Temp', unit: '°C', color: '#fb923c' },
  humidity: { label: 'Relative Humidity', shortLabel: 'Humidity', unit: '%', color: '#22d3ee' },
  light: { label: 'Light', shortLabel: 'Light', unit: 'lux', color: '#facc15' },
  dew_point: { label: 'Dew Point', shortLabel: 'Dew Pt', unit: '°C', color: '#a78bfa' },
  air_temperature: { label: 'Air Temperature', shortLabel: 'Air Temp', unit: '°C', color: '#fb923c' },
  globe_temperature: { label: 'Globe Temperature', shortLabel: 'Globe Temp', unit: '°C', color: '#f97316' },
  surface_temperature: { label: 'Surface Temperature', shortLabel: 'Surface', unit: '°C', color: '#f59e0b' },
  wind_speed: { label: 'Wind Speed', shortLabel: 'Wind', unit: 'm/s', color: '#60a5fa' },
  wind_direction: { label: 'Wind Direction', shortLabel: 'Direction', unit: '°', color: '#38bdf8' },
  solar_radiation: { label: 'Solar Radiation', shortLabel: 'Solar', unit: 'W/m²', color: '#fbbf24' },
  pressure: { label: 'Pressure', shortLabel: 'Pressure', unit: 'kPa', color: '#94a3b8' },
  pm10: { label: 'PM10', shortLabel: 'PM10', unit: 'μg/m³', color: '#f472b6' },
  pm25: { label: 'PM2.5', shortLabel: 'PM2.5', unit: 'μg/m³', color: '#c084fc' },
  diffuse_radiation: { label: 'Diffuse Radiation', shortLabel: 'Diffuse', unit: 'W/m²', color: '#34d399' },
  direct_normal_radiation: { label: 'Direct Normal Radiation', shortLabel: 'DNI', unit: 'W/m²', color: '#f87171' },
  direct_horizontal_radiation: { label: 'Direct Horizontal Radiation', shortLabel: 'DHI', unit: 'W/m²', color: '#2dd4bf' },
};

export const DEVICE_PANEL_METRICS: Record<string, string[]> = {
  'HOBO MX': ['temperature', 'humidity', 'light', 'dew_point'],
  'Weather Station': ['air_temperature', 'humidity', 'wind_speed', 'solar_radiation'],
  'Thermocouple': ['surface_temperature'],
  'Radiation Tracker': ['solar_radiation', 'diffuse_radiation', 'direct_normal_radiation'],
};

export const DEVICE_DIALOG_TABS: Record<string, MetricTab[]> = {
  'HOBO MX': [
    { id: 'thermal', label: 'Thermal', metrics: ['temperature', 'dew_point'] },
    { id: 'humidity', label: 'Humidity', metrics: ['humidity'] },
    { id: 'light', label: 'Light', metrics: ['light'] },
  ],
  'Weather Station': [
    { id: 'thermal', label: 'Thermal', metrics: ['air_temperature', 'globe_temperature'] },
    { id: 'wind', label: 'Wind', metrics: ['wind_speed', 'wind_direction'] },
    { id: 'radiation', label: 'Radiation', metrics: ['solar_radiation'] },
    { id: 'airquality', label: 'Air Quality', metrics: ['pm25', 'pm10'] },
    { id: 'pressure', label: 'Pressure', metrics: ['pressure', 'humidity'] },
  ],
  'Thermocouple': [
    { id: 'surface', label: 'Surface Temp', metrics: ['surface_temperature'] },
  ],
  'Radiation Tracker': [
    { id: 'radiation', label: 'Radiation', metrics: ['solar_radiation', 'diffuse_radiation', 'direct_normal_radiation', 'direct_horizontal_radiation'] },
  ],
};

export function getMetricMeta(metricKey: string): MetricMeta {
  return METRIC_META[metricKey] ?? {
    label: metricKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    shortLabel: metricKey.replace(/_/g, ' '),
    unit: '',
    color: '#94a3b8',
  };
}

export function getPreferredMetrics(deviceType: string, availableMetrics: string[]): string[] {
  const preferred = DEVICE_PANEL_METRICS[deviceType] ?? [];
  const filteredPreferred = preferred.filter((metric) => availableMetrics.includes(metric));
  if (filteredPreferred.length > 0) {
    return filteredPreferred;
  }
  return availableMetrics.slice(0, 4);
}

export function getMetricTabs(deviceType: string, availableMetrics: string[]): MetricTab[] {
  const configuredTabs = DEVICE_DIALOG_TABS[deviceType] ?? [];
  const filteredTabs = configuredTabs
    .map((tab) => ({
      ...tab,
      metrics: tab.metrics.filter((metric) => availableMetrics.includes(metric)),
    }))
    .filter((tab) => tab.metrics.length > 0);

  if (filteredTabs.length > 0) {
    return filteredTabs;
  }

  return availableMetrics.slice(0, 4).map((metric) => ({
    id: metric,
    label: getMetricMeta(metric).shortLabel,
    metrics: [metric],
  }));
}
