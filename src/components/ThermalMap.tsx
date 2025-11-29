'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  Video, 
  Camera, 
  Circle,
  MapPin,
  Thermometer,
  Navigation,
  Gauge,
  Maximize2,
  Layers,
  Crosshair
} from 'lucide-react';

// Simulated heat zones for the map - positioned based on the campus image
const heatZones = [
  { id: 1, x: '42%', y: '28%', width: '8%', height: '6%', risk: 'high', temp: 47.3, name: 'Academic Building A' },
  { id: 2, x: '55%', y: '35%', width: '10%', height: '8%', risk: 'medium', temp: 39.8, name: 'Parking Area' },
  { id: 3, x: '28%', y: '45%', width: '6%', height: '5%', risk: 'low', temp: 35.2, name: 'Garden Zone' },
  { id: 4, x: '70%', y: '42%', width: '7%', height: '6%', risk: 'medium', temp: 38.5, name: 'Sports Complex' },
  { id: 5, x: '48%', y: '60%', width: '12%', height: '10%', risk: 'high', temp: 45.1, name: 'Swimming Pool Area' },
];

// UAV positions on the campus
const uavPositions = [
  { id: 'UAV-01', x: 45, y: 30, active: true, heading: 45 },
  { id: 'UAV-02', x: 65, y: 50, active: true, heading: 180 },
  { id: 'UAV-03', x: 25, y: 65, active: false, heading: 90 },
];

export default function ThermalMap() {
  const [currentTemp, setCurrentTemp] = useState(41.1);
  const [coordinates, setCoordinates] = useState({ lat: 22.4167, lng: 114.2069 });
  const [altitude, setAltitude] = useState(118.76);
  const [speed, setSpeed] = useState(3.2);
  const [isRecording, setIsRecording] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);
  const [showThermalOverlay, setShowThermalOverlay] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Simulate real-time data updates
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setCurrentTemp(prev => +(prev + (Math.random() - 0.5) * 0.5).toFixed(1));
      setAltitude(prev => +(prev + (Math.random() - 0.5) * 2).toFixed(2));
      setSpeed(prev => Math.max(0, +(prev + (Math.random() - 0.5) * 0.3).toFixed(1)));
    }, 2000);
    return () => clearInterval(interval);
  }, [mounted]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'rgba(239, 68, 68, 0.55)';
      case 'medium': return 'rgba(249, 115, 22, 0.45)';
      case 'low': return 'rgba(245, 158, 11, 0.35)';
      default: return 'rgba(34, 197, 94, 0.25)';
    }
  };

  const getRiskBorder = (risk: string) => {
    switch (risk) {
      case 'high': return '#ef4444';
      case 'medium': return '#f97316';
      case 'low': return '#eab308';
      default: return '#22c55e';
    }
  };

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden relative">
      {/* Map Header Info */}
      <div className="absolute top-4 left-4 z-20">
        <motion.div 
          className="map-overlay"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">Thermal Infrared Imaging</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Current Temperature:</span>
              <span className={`text-lg font-bold ${currentTemp > 40 ? 'text-red-400' : currentTemp > 35 ? 'text-orange-400' : 'text-green-400'}`} suppressHydrationWarning>
                {mounted ? currentTemp.toFixed(1) : '--.-'}°C
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-green-400 font-mono">
                {coordinates.lat.toFixed(4)}°N, {coordinates.lng.toFixed(4)}°E
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1" suppressHydrationWarning>
                <Navigation className="w-3 h-3" />
                Height: {mounted ? altitude.toFixed(2) : '---'}m
              </span>
              <span className="flex items-center gap-1" suppressHydrationWarning>
                <Gauge className="w-3 h-3" />
                Speed: {mounted ? speed.toFixed(1) : '-.-'}m/s
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <motion.button
          className={`p-2 rounded-lg transition-all ${showThermalOverlay ? 'bg-cyan-500/30 border border-cyan-500' : 'bg-slate-800/80 border border-slate-700'}`}
          onClick={() => setShowThermalOverlay(!showThermalOverlay)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Toggle Thermal Overlay"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
        </motion.button>
        <motion.button
          className="p-2 rounded-lg bg-slate-800/80 border border-slate-700"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4 text-slate-400" />
        </motion.button>
        <motion.button
          className="p-2 rounded-lg bg-slate-800/80 border border-slate-700"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Center View"
        >
          <Crosshair className="w-4 h-4 text-slate-400" />
        </motion.button>
      </div>

      {/* Main Map View */}
      <div className="relative flex-1 overflow-hidden">
        {/* Satellite Image Background */}
        <div className="absolute inset-0">
          <Image
            src="/campus-map.png"
            alt="Campus Satellite View"
            fill
            className="object-cover"
            priority
          />
          {/* Thermal overlay filter */}
          {showThermalOverlay && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-orange-900/20 mix-blend-overlay" />
          )}
          {/* Scanline effect */}
          <div className="absolute inset-0 scanline pointer-events-none" />
        </div>

        {/* Heat Zones */}
        {showThermalOverlay && heatZones.map((zone) => (
          <motion.div
            key={zone.id}
            className="absolute cursor-pointer transition-all duration-300"
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              background: getRiskColor(zone.risk),
              border: `2px solid ${getRiskBorder(zone.risk)}`,
              borderRadius: '4px',
              boxShadow: hoveredZone === zone.id ? `0 0 20px ${getRiskBorder(zone.risk)}` : 'none',
            }}
            animate={{
              opacity: hoveredZone === zone.id ? 1 : 0.8,
              scale: hoveredZone === zone.id ? 1.05 : 1,
            }}
            onMouseEnter={() => setHoveredZone(zone.id)}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {hoveredZone === zone.id && (
              <motion.div
                className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-2 rounded-lg text-xs whitespace-nowrap border border-slate-600"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="font-semibold text-white mb-1">{zone.name}</div>
                <div className="flex items-center gap-2">
                  <span className={`${zone.risk === 'high' ? 'text-red-400' : zone.risk === 'medium' ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {zone.temp}°C
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className={`uppercase text-[10px] font-bold ${zone.risk === 'high' ? 'text-red-400' : zone.risk === 'medium' ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {zone.risk} risk
                  </span>
                </div>
              </motion.div>
            )}
            {/* Pulse animation for high risk */}
            {zone.risk === 'high' && (
              <motion.div
                className="absolute inset-0 rounded border-2 border-red-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}

        {/* UAV Markers */}
        {uavPositions.map((uav, index) => (
          <motion.div
            key={uav.id}
            className="absolute z-10"
            style={{ left: `${uav.x}%`, top: `${uav.y}%` }}
            animate={{ 
              y: uav.active ? [0, -3, 0] : 0,
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              delay: index * 0.3 
            }}
          >
            <div className={`relative ${uav.active ? 'text-cyan-400' : 'text-slate-500'}`}>
              {/* UAV Icon */}
              <motion.div 
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  uav.active 
                    ? 'bg-cyan-500/30 border-2 border-cyan-400' 
                    : 'bg-slate-700/50 border-2 border-slate-500'
                }`}
                style={{ transform: `rotate(${uav.heading}deg)` }}
              >
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-current -translate-y-0.5" />
              </motion.div>
              
              {/* Active UAV pulse */}
              {uav.active && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-400"
                  animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              
              {/* UAV Label */}
              <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap px-1 py-0.5 rounded ${
                uav.active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                {uav.id}
              </span>
            </div>
          </motion.div>
        ))}

        {/* Flight Path Visualization */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 45% 30% Q 55% 40% 65% 50%"
            fill="none"
            stroke="url(#pathGradient)"
            strokeWidth="2"
            strokeDasharray="8,4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.path
            d="M 65% 50% Q 45% 60% 25% 65%"
            fill="none"
            stroke="url(#pathGradient)"
            strokeWidth="2"
            strokeDasharray="8,4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
          />
        </svg>

        {/* Mini Map */}
        <div className="absolute bottom-4 right-4 w-44 h-36 map-overlay overflow-hidden">
          <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
            <span>Flight Overview</span>
            <span className="text-cyan-400 font-mono">3 UAVs</span>
          </div>
          <div className="relative w-full h-28 bg-slate-900/80 rounded border border-slate-700 overflow-hidden">
            {/* Mini satellite view */}
            <Image
              src="/campus-map.png"
              alt="Mini map"
              fill
              className="object-cover opacity-50"
            />
            {/* UAV dots */}
            {uavPositions.map((uav) => (
              <motion.div
                key={uav.id}
                className={`absolute w-2 h-2 rounded-full ${uav.active ? 'bg-cyan-400' : 'bg-red-400'}`}
                style={{ 
                  left: `${uav.x}%`, 
                  top: `${uav.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                animate={uav.active ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
            ))}
            {/* Coverage area indicator */}
            <div className="absolute inset-2 border border-cyan-500/30 rounded" />
          </div>
        </div>

        {/* Temperature Scale */}
        {showThermalOverlay && (
          <div className="absolute bottom-4 left-4 map-overlay">
            <div className="text-[10px] text-slate-400 mb-2">Temperature Scale (°C)</div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-3 rounded thermal-gradient" />
              <div className="flex justify-between w-32 text-[9px] text-slate-500 absolute -bottom-3 left-0">
                <span>20</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-3 border-t border-[#2a3548] flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-3">
          <motion.button 
            className="btn-primary flex items-center gap-2 text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Video className="w-4 h-4" />
            Live Broadcast
          </motion.button>
          <motion.button 
            className="btn-secondary flex items-center gap-2 text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Camera className="w-4 h-4" />
            Screenshots
          </motion.button>
          <motion.button 
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-all ${
              isRecording 
                ? 'bg-red-500/20 border border-red-500 text-red-400' 
                : 'btn-secondary'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsRecording(!isRecording)}
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-red-500 text-red-500 animate-pulse' : ''}`} />
            {isRecording ? 'Recording...' : 'Recording'}
          </motion.button>
        </div>

        {/* Risk Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span className="text-slate-400">High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
            <span className="text-slate-400">Medium Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
            <span className="text-slate-400">Low Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span className="text-slate-400">Normal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
