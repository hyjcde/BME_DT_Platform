'use client';

import { getMetricMeta, getPreferredMetrics } from '@/data/monitoringMetrics';
import { Testpoint, TimeseriesFrame, useMonitoredData } from '@/context/MonitoredDataContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Droplets,
  Gauge,
  MapPin,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useCallback, useEffect, type ReactNode } from 'react';

interface MonitoredDataPanelProps {
  onTestpointSelect?: (testpoint: Testpoint | null) => void;
  selectedTestpointId?: number | null;
  onTimeChange?: (frameIndex: number, timestamp: string) => void;
}

function formatTimestamp(timestamp: string, includeDate = false): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return includeDate
    ? parsed.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatMetricValue(value: number, metricKey: string, unit: string): string {
  const decimals = metricKey === 'humidity' || metricKey === 'pm10' || metricKey === 'pm25' ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)}${unit}`;
}

function getDeviceIcon(deviceType: string): ReactNode {
  switch (deviceType) {
    case 'HOBO MX':
      return <Thermometer className="w-3 h-3" />;
    case 'Weather Station':
      return <Cloud className="w-3 h-3" />;
    case 'Thermocouple':
      return <Activity className="w-3 h-3" />;
    case 'Radiation Tracker':
      return <Sun className="w-3 h-3" />;
    default:
      return <Radio className="w-3 h-3" />;
  }
}

function getMetricIcon(metricKey: string): ReactNode {
  switch (metricKey) {
    case 'temperature':
    case 'air_temperature':
    case 'globe_temperature':
    case 'surface_temperature':
    case 'dew_point':
      return <Thermometer className="w-3 h-3" />;
    case 'humidity':
      return <Droplets className="w-3 h-3" />;
    case 'wind_speed':
    case 'wind_direction':
      return <Wind className="w-3 h-3" />;
    case 'solar_radiation':
    case 'diffuse_radiation':
    case 'direct_normal_radiation':
    case 'direct_horizontal_radiation':
    case 'light':
      return <Sun className="w-3 h-3" />;
    default:
      return <Gauge className="w-3 h-3" />;
  }
}

function getMeasurementPeriod(timeseries: TimeseriesFrame[]): string {
  if (timeseries.length < 2) return 'N/A';
  return `${formatTimestamp(timeseries[0].timestamp, true)} - ${formatTimestamp(timeseries[timeseries.length - 1].timestamp, true)}`;
}

export default function MonitoredDataPanel({
  onTestpointSelect,
  selectedTestpointId,
  onTimeChange,
}: MonitoredDataPanelProps) {
  const {
    testpoints,
    timeseries,
    currentFrame,
    isPlaying,
    playbackSpeed,
    selectedTestpointId: contextSelectedTestpointId,
    loading,
    error,
    setCurrentFrame,
    setIsPlaying,
    setPlaybackSpeed,
    setSelectedTestpointId,
    getCurrentValue,
  } = useMonitoredData();

  const effectiveSelectedTestpointId = selectedTestpointId ?? contextSelectedTestpointId;

  useEffect(() => {
    if (onTimeChange && timeseries[currentFrame]) {
      onTimeChange(currentFrame, timeseries[currentFrame].timestamp);
    }
  }, [currentFrame, onTimeChange, timeseries]);

  const handleTestpointClick = useCallback((tp: Testpoint) => {
    const nextSelectedId = effectiveSelectedTestpointId === tp.id ? null : tp.id;
    setSelectedTestpointId(nextSelectedId);
    onTestpointSelect?.(nextSelectedId === null ? null : tp);
  }, [effectiveSelectedTestpointId, onTestpointSelect, setSelectedTestpointId]);

  if (loading) {
    return (
      <div className="card-glass h-full flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="text-xs text-slate-400">Loading monitored data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-glass h-full flex items-center justify-center">
        <div className="text-center text-red-400 text-xs">{error}</div>
      </div>
    );
  }

  const visibleTestpoints = testpoints.filter((tp) => Object.keys(tp.statistics).length > 0);
  const selectedTestpoint = visibleTestpoints.find((tp) => tp.id === effectiveSelectedTestpointId) ?? null;

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between bg-linear-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">Field Monitoring</h3>
            <p className="text-[10px] text-slate-500">{visibleTestpoints.length} Active Testpoints</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-green-400">Real Data</span>
        </div>
      </div>

      <div className="px-2 py-2 border-b border-slate-700/30 bg-slate-800/30">
        <div className="flex items-center gap-2 mb-1.5">
          <button onClick={() => setCurrentFrame(0)} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
            <SkipBack className="w-3 h-3" />
          </button>
          <button onClick={() => setCurrentFrame(Math.max(0, currentFrame - 10))} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className={`p-1.5 rounded transition-colors ${isPlaying ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setCurrentFrame(Math.min(timeseries.length - 1, currentFrame + 10))} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-3 h-3" />
          </button>
          <button onClick={() => setCurrentFrame(timeseries.length - 1)} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
            <SkipForward className="w-3 h-3" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-cyan-400 font-mono">
              {timeseries[currentFrame] ? formatTimestamp(timeseries[currentFrame].timestamp, true) : '--'}
            </span>
          </div>
          <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} className="text-[9px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300">
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, timeseries.length - 1)}
          value={currentFrame}
          onChange={(e) => setCurrentFrame(Number(e.target.value))}
          className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
        />
        <div className="flex justify-between text-[8px] text-slate-500 mt-0.5">
          <span>Start</span>
          <span>{currentFrame + 1} / {timeseries.length}</span>
          <span>End</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {visibleTestpoints.map((tp) => {
          const isSelected = effectiveSelectedTestpointId === tp.id;
          const metrics = getPreferredMetrics(tp.device_type, tp.available_metrics ?? Object.keys(tp.statistics));

          return (
            <motion.div
              key={tp.id}
              className={`rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-700/50 border-cyan-500/50'
                  : 'bg-slate-800/40 border-slate-700/30 hover:border-slate-600/50'
              }`}
              onClick={() => handleTestpointClick(tp)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="p-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ backgroundColor: `${tp.color}33`, border: `1px solid ${tp.color}` }}>
                    <span className="text-[9px] font-bold">{tp.id}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white truncate">{tp.location_name}</div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      {getDeviceIcon(tp.device_type)}
                      <span>{tp.device_type}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {metrics.map((metricKey) => {
                    const meta = getMetricMeta(metricKey);
                    const currentValue = getCurrentValue(tp.id, metricKey) ?? tp.current_values[metricKey] ?? null;
                    if (currentValue === null || currentValue === undefined) return null;

                    return (
                      <div key={metricKey} className="bg-slate-900/50 rounded px-1.5 py-1 flex items-center gap-1">
                        <span style={{ color: meta.color }}>{getMetricIcon(metricKey)}</span>
                        <span className="text-[10px] font-mono" style={{ color: meta.color }}>
                          {formatMetricValue(currentValue, metricKey, meta.unit)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedTestpoint && (
          <motion.div
            className="border-t border-slate-700/50 bg-slate-800/50 p-2"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-white">{selectedTestpoint.name} Details</span>
              <span className="text-[9px] text-slate-500">
                {selectedTestpoint.lat.toFixed(5)}°N, {selectedTestpoint.lng.toFixed(5)}°E
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              {Object.entries(selectedTestpoint.statistics).map(([metricKey, stats]) => {
                const meta = getMetricMeta(metricKey);
                return (
                  <div key={metricKey} className="bg-slate-900/50 rounded px-1.5 py-1">
                    <div className="truncate" style={{ color: meta.color }}>{meta.label}</div>
                    <div className="text-slate-300 font-mono">{formatMetricValue(stats.avg, metricKey, stats.unit)}</div>
                    <div className="text-[8px] text-slate-600">
                      [{stats.min.toFixed(1)}-{stats.max.toFixed(1)}]
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-2 py-1.5 border-t border-slate-700/30 bg-slate-900/30">
        <div className="flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-slate-400">HOBO</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-slate-400">Weather</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-slate-400">Thermo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#a855f7' }} />
              <span className="text-slate-400">Radiation</span>
            </div>
          </div>
          <span className="text-slate-500">{getMeasurementPeriod(timeseries)}</span>
        </div>
      </div>
    </div>
  );
}

export type { Testpoint, TimeseriesFrame };

