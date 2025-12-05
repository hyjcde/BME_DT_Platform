'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Droplets,
  MapPin,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Sun,
  Thermometer,
  Wind
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Types
interface TestpointStatistics {
  min: number;
  max: number;
  avg: number;
  unit: string;
  count: number;
}

interface Testpoint {
  id: number;
  name: string;
  location_name: string;
  lat: number;
  lng: number;
  device_type: string;
  color: string;
  current_values: Record<string, number>;
  statistics: Record<string, TestpointStatistics>;
}

interface TimeseriesFrame {
  timestamp: string;
  testpoints: Record<string, {
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    solar_radiation: number | null;
  }>;
}

interface MonitoredDataPanelProps {
  onTestpointSelect?: (testpoint: Testpoint | null) => void;
  selectedTestpointId?: number | null;
  onTimeChange?: (frameIndex: number, timestamp: string) => void;
}

export default function MonitoredDataPanel({
  onTestpointSelect,
  selectedTestpointId,
  onTimeChange
}: MonitoredDataPanelProps) {
  const [testpoints, setTestpoints] = useState<Testpoint[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load data
  useEffect(() => {
    setMounted(true);
    
    const loadData = async () => {
      try {
        const [testpointsRes, timeseriesRes] = await Promise.all([
          fetch('/data/testpoints.json'),
          fetch('/data/timeseries.json')
        ]);

        if (!testpointsRes.ok || !timeseriesRes.ok) {
          throw new Error('Failed to load monitored data');
        }

        const testpointsData = await testpointsRes.json();
        const timeseriesData = await timeseriesRes.json();

        setTestpoints(testpointsData);
        setTimeseries(timeseriesData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load monitored data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Playback animation
  useEffect(() => {
    if (!isPlaying || timeseries.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= timeseries.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, timeseries.length, playbackSpeed]);

  // Notify parent of time changes
  useEffect(() => {
    if (onTimeChange && timeseries[currentFrame]) {
      onTimeChange(currentFrame, timeseries[currentFrame].timestamp);
    }
  }, [currentFrame, timeseries, onTimeChange]);

  const handleTestpointClick = useCallback((tp: Testpoint) => {
    if (onTestpointSelect) {
      onTestpointSelect(selectedTestpointId === tp.id ? null : tp);
    }
  }, [onTestpointSelect, selectedTestpointId]);

  // Get current values for a testpoint at current frame
  const getCurrentValue = useCallback((testpointId: number, param: string) => {
    if (timeseries.length === 0) return null;
    const frame = timeseries[currentFrame];
    if (!frame) return null;
    const tpData = frame.testpoints[testpointId.toString()];
    if (!tpData) return null;
    return tpData[param as keyof typeof tpData];
  }, [timeseries, currentFrame]);

  // Parse timestamp to display format
  const formatTimestamp = (ts: string) => {
    // Handle the timestamp format "45948.3818287037 09:09"
    const parts = ts.split(' ');
    if (parts.length >= 2) {
      return parts[1]; // Return time part
    }
    return ts;
  };

  // Calculate measurement period
  const getMeasurementPeriod = () => {
    if (timeseries.length < 2) return 'N/A';
    // Try to extract dates
    const firstTs = timeseries[0]?.timestamp || '';
    const lastTs = timeseries[timeseries.length - 1]?.timestamp || '';
    const firstTime = formatTimestamp(firstTs);
    const lastTime = formatTimestamp(lastTs);
    return `${firstTime} - ${lastTime}`;
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'HOBO MX': return <Thermometer className="w-3 h-3" />;
      case 'Weather Station': return <Cloud className="w-3 h-3" />;
      case 'Thermocouple': return <Activity className="w-3 h-3" />;
      case 'Radiation Tracker': return <Sun className="w-3 h-3" />;
      default: return <Radio className="w-3 h-3" />;
    }
  };

  const getDeviceColor = (deviceType: string) => {
    switch (deviceType) {
      case 'HOBO MX': return '#3b82f6';
      case 'Weather Station': return '#22c55e';
      case 'Thermocouple': return '#f59e0b';
      case 'Radiation Tracker': return '#a855f7';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="card-glass h-full flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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

  const selectedTestpoint = testpoints.find(tp => tp.id === selectedTestpointId);

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">Field Monitoring</h3>
            <p className="text-[10px] text-slate-500">{testpoints.length} Testpoints</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.span 
            className="w-2 h-2 rounded-full bg-green-500" 
            animate={{ scale: [1, 1.3, 1] }} 
            transition={{ duration: 2, repeat: Infinity }} 
          />
          <span className="text-[10px] text-green-400">Live</span>
        </div>
      </div>

      {/* Time Control Bar */}
      <div className="px-2 py-2 border-b border-slate-700/30 bg-slate-800/30">
        <div className="flex items-center gap-2 mb-1.5">
          <button 
            onClick={() => setCurrentFrame(0)}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button 
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 10))}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 rounded transition-colors ${isPlaying ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => setCurrentFrame(Math.min(timeseries.length - 1, currentFrame + 10))}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <button 
            onClick={() => setCurrentFrame(timeseries.length - 1)}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <SkipForward className="w-3 h-3" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-cyan-400 font-mono">
              {timeseries[currentFrame] ? formatTimestamp(timeseries[currentFrame].timestamp) : '--:--'}
            </span>
          </div>
          <select 
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="text-[9px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
        
        {/* Timeline slider */}
        <input
          type="range"
          min={0}
          max={timeseries.length - 1}
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

      {/* Testpoint List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {testpoints.filter(tp => Object.keys(tp.statistics).length > 0).map((tp) => {
          const isSelected = selectedTestpointId === tp.id;
          const currentTemp = getCurrentValue(tp.id, 'temperature') ?? tp.current_values.temperature;
          const currentRH = getCurrentValue(tp.id, 'humidity') ?? tp.current_values.relative_humidity;
          const deviceColor = getDeviceColor(tp.device_type);
          
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
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div 
                    className="w-5 h-5 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: deviceColor + '33', border: `1px solid ${deviceColor}` }}
                  >
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
                
                {/* Values */}
                <div className="grid grid-cols-2 gap-1.5">
                  {currentTemp !== null && currentTemp !== undefined && (
                    <div className="bg-slate-900/50 rounded px-1.5 py-1 flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] font-mono text-orange-400" suppressHydrationWarning>
                        {mounted ? currentTemp.toFixed(1) : '--'}°C
                      </span>
                    </div>
                  )}
                  {currentRH !== null && currentRH !== undefined && (
                    <div className="bg-slate-900/50 rounded px-1.5 py-1 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-400" suppressHydrationWarning>
                        {mounted ? currentRH.toFixed(0) : '--'}%
                      </span>
                    </div>
                  )}
                  {tp.statistics.wind_speed && (
                    <div className="bg-slate-900/50 rounded px-1.5 py-1 flex items-center gap-1">
                      <Wind className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-mono text-blue-400">
                        {tp.statistics.wind_speed.avg.toFixed(1)}m/s
                      </span>
                    </div>
                  )}
                  {tp.statistics.solar_radiation && (
                    <div className="bg-slate-900/50 rounded px-1.5 py-1 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-yellow-400" />
                      <span className="text-[10px] font-mono text-yellow-400">
                        {tp.statistics.solar_radiation.avg.toFixed(0)}W/m²
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Testpoint Detail */}
      <AnimatePresence>
        {selectedTestpoint && (
          <motion.div
            className="border-t border-slate-700/50 bg-slate-800/50 p-2"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-white">
                {selectedTestpoint.name} Details
              </span>
              <span className="text-[9px] text-slate-500">
                {selectedTestpoint.lat.toFixed(5)}°N, {selectedTestpoint.lng.toFixed(5)}°E
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              {Object.entries(selectedTestpoint.statistics).slice(0, 6).map(([param, stats]) => (
                <div key={param} className="bg-slate-900/50 rounded px-1.5 py-1">
                  <div className="text-slate-500 capitalize truncate">{param.replace(/_/g, ' ')}</div>
                  <div className="text-slate-300 font-mono">
                    {stats.avg?.toFixed(1)} {stats.unit}
                  </div>
                  <div className="text-[8px] text-slate-600">
                    [{stats.min?.toFixed(1)}-{stats.max?.toFixed(1)}]
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Stats */}
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
          <span className="text-slate-500">{getMeasurementPeriod()}</span>
        </div>
      </div>
    </div>
  );
}

// Export testpoint type for use in other components
export type { Testpoint, TimeseriesFrame };

