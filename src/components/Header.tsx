'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Cpu, 
  Radio, 
  AlertTriangle,
  Activity,
  Wifi,
  Clock,
  Thermometer,
  CloudSun,
  Database
} from 'lucide-react';

export default function Header() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [systemLoad, setSystemLoad] = useState(42);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setSystemLoad(prev => Math.max(20, Math.min(80, prev + (Math.random() - 0.5) * 10)));
    }, 3000);
    return () => clearInterval(interval);
  }, [mounted]);

  const formatTime = () => {
    if (!currentTime) return '--:--:--';
    return currentTime.toLocaleTimeString('en-US', { hour12: false });
  };

  const formatDate = () => {
    if (!currentTime) return '---';
    return currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <header className="h-12 bg-gradient-to-r from-[#080c14] via-[#0d1117] to-[#080c14] border-b border-[#1e2a3a] flex items-center justify-between px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <motion.div 
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Cpu className="w-4 h-4 text-white" />
        </motion.div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">
            Urban Thermal Digital Twin
          </h1>
          <p className="text-xs text-slate-500">UAV Monitoring System v2.0</p>
        </div>
      </div>

      {/* Center Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/30 rounded border border-slate-700/30">
          <Thermometer className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-sm text-orange-400 font-mono font-medium">38.2°C</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/30 rounded border border-slate-700/30">
          <CloudSun className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-slate-300">Clear</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/30 rounded border border-slate-700/30">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs text-slate-300" suppressHydrationWarning>{mounted ? systemLoad.toFixed(0) : '--'}% CPU</span>
        </div>
      </div>

      {/* Right Status */}
      <div className="flex items-center gap-2">
        {/* Time */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <div className="text-right">
            <div className="text-xs text-slate-500 leading-none" suppressHydrationWarning>{mounted ? formatDate() : '---'}</div>
            <div className="text-sm font-bold text-cyan-400 font-mono" suppressHydrationWarning>{mounted ? formatTime() : '--:--:--'}</div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full">
            <motion.span className="w-2 h-2 rounded-full bg-green-500" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-slate-300">LLM-RAG</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full">
            <motion.span className="w-2 h-2 rounded-full bg-green-500" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
            <Radio className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-slate-300">3 UAVs</span>
          </div>

          <motion.div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 border border-red-500/40 rounded-full"
            animate={{ boxShadow: ['0 0 4px rgba(239, 68, 68, 0.2)', '0 0 10px rgba(239, 68, 68, 0.4)', '0 0 4px rgba(239, 68, 68, 0.2)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.span className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-300">Risk</span>
          </motion.div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/40 rounded-full">
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-300">Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
