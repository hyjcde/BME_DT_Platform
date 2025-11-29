'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Battery, 
  Plane,
  Eye,
  Search,
  Home,
  PlayCircle,
  Settings,
  AlertOctagon,
  Zap,
  Wifi,
  Thermometer,
  Clock,
  TrendingUp,
  Activity,
  Navigation
} from 'lucide-react';

interface UAV {
  id: string;
  name: string;
  status: 'active' | 'standby' | 'charging';
  battery: number;
  signal: number;
  role: string;
  color: string;
  altitude: number;
  speed: number;
  temp: number;
}

const uavList: UAV[] = [
  { id: 'UAV-01', name: 'Thermal Host', status: 'active', battery: 85, signal: 4, role: 'COARSE SCAN', color: '#3b82f6', altitude: 120, speed: 3.2, temp: 38 },
  { id: 'UAV-02', name: 'Fine Detection', status: 'active', battery: 72, signal: 3, role: 'FINE DETECT', color: '#ef4444', altitude: 80, speed: 2.1, temp: 42 },
  { id: 'UAV-03', name: 'Patrol Unit', status: 'standby', battery: 96, signal: 5, role: 'STANDBY', color: '#22c55e', altitude: 100, speed: 0, temp: 35 },
];

export default function UAVControl() {
  const [selectedUAV, setSelectedUAV] = useState('UAV-01');
  const [missionMode, setMissionMode] = useState<string>('auto');
  const [mounted, setMounted] = useState(false);
  
  const [flightParams, setFlightParams] = useState({
    altitude: 118.76,
    flightSpeed: 3.2,
    windSpeed: 2.1,
    remainingTime: 23,
    coverage: 76,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setFlightParams(prev => ({
        ...prev,
        altitude: +(prev.altitude + (Math.random() - 0.5) * 2).toFixed(2),
        flightSpeed: Math.max(0, +(prev.flightSpeed + (Math.random() - 0.5) * 0.3).toFixed(1)),
        coverage: Math.min(100, +(prev.coverage + Math.random() * 0.2).toFixed(1)),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [mounted]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'standby': return 'bg-yellow-500';
      case 'charging': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-400';
    if (level > 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBatteryBg = (level: number) => {
    if (level > 60) return 'bg-green-500';
    if (level > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderSignalBars = (strength: number) => (
    <div className="flex items-end gap-0.5 h-3.5">
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm ${bar <= strength ? 'bg-green-400' : 'bg-slate-600'}`}
          style={{ height: `${bar * 18}%` }}
        />
      ))}
    </div>
  );

  const selectedUAVData = uavList.find(u => u.id === selectedUAV);

  return (
    <div className="space-y-2">
      {/* Multi-UAV Control Header */}
      <div className="card-glass p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Plane className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Multi-UAV Control</h3>
              <p className="text-[10px] text-slate-500">3 Units Online</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <Wifi className="w-3.5 h-3.5" />
            <span>Connected</span>
          </div>
        </div>
        
        {/* UAV List */}
        <div className="space-y-1.5">
          {uavList.map((uav) => (
            <motion.div
              key={uav.id}
              className={`p-2 rounded-lg cursor-pointer transition-all border ${
                selectedUAV === uav.id 
                  ? 'border-cyan-500/60 bg-cyan-500/10' 
                  : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
              }`}
              onClick={() => setSelectedUAV(uav.id)}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: uav.color, boxShadow: `0 0 6px ${uav.color}60` }}
                  />
                  <span className="text-xs font-bold text-white">{uav.id}</span>
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(uav.status)} ${uav.status === 'active' ? 'animate-pulse' : ''}`} />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{uav.role}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Battery className={`w-3.5 h-3.5 ${getBatteryColor(uav.battery)}`} />
                  <div className="w-10 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getBatteryBg(uav.battery)} rounded-full`} style={{ width: `${uav.battery}%` }} />
                  </div>
                  <span className={`text-xs ${getBatteryColor(uav.battery)}`}>{uav.battery}%</span>
                </div>
                {renderSignalBars(uav.signal)}
                <div className="flex items-center gap-1 text-orange-400">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span className="text-xs">{uav.temp}°</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Selected UAV Status */}
      {selectedUAVData && (
        <motion.div 
          className="card-glass p-3"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          key={selectedUAV}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: selectedUAVData.color }} />
            <Activity className="w-3.5 h-3.5" style={{ color: selectedUAVData.color }} />
            <span className="text-xs font-semibold text-white">{selectedUAVData.id} Status</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/60 rounded-lg p-2">
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Altitude</div>
              <div className="text-sm font-bold text-cyan-400 font-mono" suppressHydrationWarning>
                {selectedUAVData.altitude}m
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2">
              <div className="text-[10px] text-slate-500 uppercase mb-0.5">Speed</div>
              <div className="text-sm font-bold text-green-400 font-mono" suppressHydrationWarning>
                {selectedUAVData.speed}m/s
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mission Control */}
      <div className="card-glass p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-blue-500 rounded-full" />
          <Settings className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-white">Mission Control</span>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'auto', icon: PlayCircle, label: 'Auto', color: '#06b6d4' },
            { id: 'manual', icon: Eye, label: 'Manual', color: '#3b82f6' },
            { id: 'fine', icon: Search, label: 'Fine Detect', color: '#f97316' },
            { id: 'return', icon: Home, label: 'Return', color: '#22c55e' },
          ].map(({ id, icon: Icon, label, color }) => (
            <motion.button
              key={id}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                missionMode === id 
                  ? 'border-opacity-60' 
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
              style={missionMode === id ? { 
                backgroundColor: `${color}15`,
                borderColor: `${color}80`,
                color: color,
              } : {}}
              onClick={() => setMissionMode(id)}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Flight Parameters */}
      <div className="card-glass p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-green-500 rounded-full" />
          <Zap className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-semibold text-white">Flight Parameters</span>
        </div>
        
        <div className="space-y-1.5">
          {[
            { label: 'Altitude', value: `${flightParams.altitude.toFixed(1)}m`, icon: Navigation, color: '#06b6d4' },
            { label: 'Speed', value: `${flightParams.flightSpeed}m/s`, icon: TrendingUp, color: '#22c55e' },
            { label: 'Wind', value: `${flightParams.windSpeed}m/s`, icon: Activity, color: '#3b82f6' },
            { label: 'Time Left', value: `${flightParams.remainingTime}min`, icon: Clock, color: '#eab308' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
              <span className="text-xs font-mono font-medium" style={{ color }} suppressHydrationWarning>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Coverage Progress */}
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Area Coverage</span>
            <span className="text-xs font-bold text-cyan-400" suppressHydrationWarning>{flightParams.coverage.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${flightParams.coverage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Emergency Control */}
      <div className="card-glass p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-red-500 rounded-full" />
          <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs font-semibold text-white">Emergency</span>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          <motion.button
            className="bg-red-500/20 border border-red-500/50 text-red-400 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <AlertOctagon className="w-4 h-4" />
            E-Stop
          </motion.button>
          
          <motion.button
            className="bg-orange-500/20 border border-orange-500/50 text-orange-400 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(249, 115, 22, 0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Plane className="w-4 h-4 rotate-90" />
            Land
          </motion.button>
        </div>
      </div>
    </div>
  );
}
