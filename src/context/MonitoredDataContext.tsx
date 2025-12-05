'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

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

interface MonitoredDataContextType {
  testpoints: Testpoint[];
  timeseries: TimeseriesFrame[];
  currentFrame: number;
  isPlaying: boolean;
  playbackSpeed: number;
  selectedTestpointId: number | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setSelectedTestpointId: (id: number | null) => void;
  getCurrentValue: (testpointId: number, param: string) => number | null;
  getSelectedTestpoint: () => Testpoint | null;
}

const MonitoredDataContext = createContext<MonitoredDataContextType | null>(null);

export function MonitoredDataProvider({ children }: { children: ReactNode }) {
  const [testpoints, setTestpoints] = useState<Testpoint[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedTestpointId, setSelectedTestpointId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
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

  const getCurrentValue = useCallback((testpointId: number, param: string): number | null => {
    if (timeseries.length === 0) return null;
    const frame = timeseries[currentFrame];
    if (!frame) return null;
    const tpData = frame.testpoints[testpointId.toString()];
    if (!tpData) return null;
    return tpData[param as keyof typeof tpData];
  }, [timeseries, currentFrame]);

  const getSelectedTestpoint = useCallback((): Testpoint | null => {
    if (selectedTestpointId === null) return null;
    return testpoints.find(tp => tp.id === selectedTestpointId) || null;
  }, [testpoints, selectedTestpointId]);

  return (
    <MonitoredDataContext.Provider
      value={{
        testpoints,
        timeseries,
        currentFrame,
        isPlaying,
        playbackSpeed,
        selectedTestpointId,
        loading,
        error,
        setCurrentFrame,
        setIsPlaying,
        setPlaybackSpeed,
        setSelectedTestpointId,
        getCurrentValue,
        getSelectedTestpoint,
      }}
    >
      {children}
    </MonitoredDataContext.Provider>
  );
}

export function useMonitoredData() {
  const context = useContext(MonitoredDataContext);
  if (!context) {
    throw new Error('useMonitoredData must be used within MonitoredDataProvider');
  }
  return context;
}

export type { Testpoint, TimeseriesFrame, TestpointStatistics };

