'use client';

import AIChat from '@/components/AIChat';
import Header from '@/components/Header';
import SimulationResults from '@/components/SimulationResults';
import ThermalAnalysis from '@/components/ThermalAnalysis';
import UAVControl from '@/components/UAVControl';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const DualModeMap = dynamic(() => import('@/components/DualModeMap'), {
  ssr: false,
  loading: () => (
    <div className="card-glass h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-slate-400 text-xs">Loading Map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="h-screen bg-[#080c14] flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 p-1.5 flex gap-1.5 min-h-0 overflow-hidden">
        {/* Left: UAV Control & Thermal Analysis */}
        <motion.div 
          className="w-[220px] shrink-0 flex flex-col gap-1.5"
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <UAVControl />
          </div>
          <div className="h-[200px] shrink-0">
            <ThermalAnalysis />
          </div>
        </motion.div>

        {/* Center: Map */}
        <motion.div 
          className="flex-1 min-w-0"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <DualModeMap />
        </motion.div>

        {/* Right: Simulation Results + AI Chat */}
        <motion.div 
          className="w-[280px] shrink-0 flex flex-col gap-1.5"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {/* Simulation Results */}
          <div className="h-[260px] shrink-0">
            <SimulationResults />
          </div>
          
          {/* AI Chat */}
          <div className="flex-1 min-h-0">
            <AIChat />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
