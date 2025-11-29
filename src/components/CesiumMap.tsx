'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Crosshair,
  Globe,
  Map,
  RotateCcw,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react';

interface HeatZone {
  id: number;
  lng: number;
  lat: number;
  radius: number;
  risk: 'high' | 'medium' | 'low';
  temp: number;
  name: string;
}

interface UAVPosition {
  id: string;
  lng: number;
  lat: number;
  altitude: number;
  active: boolean;
  heading: number;
}

// Heat zones positioned around CUHK campus area
const heatZones: HeatZone[] = [
  { id: 1, lng: 114.2065, lat: 22.4195, radius: 80, risk: 'high', temp: 47.3, name: 'Academic Building A' },
  { id: 2, lng: 114.2085, lat: 22.4175, radius: 100, risk: 'medium', temp: 39.8, name: 'Parking Area' },
  { id: 3, lng: 114.2045, lat: 22.4155, radius: 60, risk: 'low', temp: 35.2, name: 'Garden Zone' },
  { id: 4, lng: 114.2105, lat: 22.4165, radius: 70, risk: 'medium', temp: 38.5, name: 'Sports Complex' },
  { id: 5, lng: 114.2075, lat: 22.4135, radius: 90, risk: 'high', temp: 45.1, name: 'Swimming Pool Area' },
];

// UAV positions
const uavPositions: UAVPosition[] = [
  { id: 'UAV-01', lng: 114.2070, lat: 22.4180, altitude: 120, active: true, heading: 45 },
  { id: 'UAV-02', lng: 114.2090, lat: 22.4160, altitude: 100, active: true, heading: 180 },
  { id: 'UAV-03', lng: 114.2050, lat: 22.4145, altitude: 80, active: false, heading: 90 },
];

export default function CesiumMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState(true);
  const [showThermalOverlay, setShowThermalOverlay] = useState(true);
  const [isFlying, setIsFlying] = useState(false);
  const [currentTemp, setCurrentTemp] = useState(41.1);
  const [coordinates, setCoordinates] = useState({ lat: 22.4167, lng: 114.2069 });
  const [altitude, setAltitude] = useState(118.76);
  const [speed, setSpeed] = useState(3.2);
  const [isRecording, setIsRecording] = useState(false);
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

  // Add heat zone visualization
  const addHeatZones = useCallback((viewer: any, Cesium: any) => {
    if (!showThermalOverlay) return;
    
    heatZones.forEach((zone) => {
      const color = zone.risk === 'high' 
        ? Cesium.Color.RED.withAlpha(0.4)
        : zone.risk === 'medium'
        ? Cesium.Color.ORANGE.withAlpha(0.35)
        : Cesium.Color.YELLOW.withAlpha(0.3);

      const outlineColor = zone.risk === 'high'
        ? Cesium.Color.RED
        : zone.risk === 'medium'
        ? Cesium.Color.ORANGE
        : Cesium.Color.YELLOW;

      // Add cylinder for heat zone
      viewer.entities.add({
        name: zone.name,
        position: Cesium.Cartesian3.fromDegrees(zone.lng, zone.lat, 50),
        cylinder: {
          length: 100,
          topRadius: zone.radius,
          bottomRadius: zone.radius,
          material: color,
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: 2,
        },
        label: {
          text: `${zone.name}\n${zone.temp}°C`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -60),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(8, 4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    });
  }, [showThermalOverlay]);

  // Add UAV entities
  const addUAVEntities = useCallback((viewer: any, Cesium: any) => {
    uavPositions.forEach((uav) => {
      const color = uav.active ? Cesium.Color.CYAN : Cesium.Color.GRAY;

      viewer.entities.add({
        name: uav.id,
        position: Cesium.Cartesian3.fromDegrees(uav.lng, uav.lat, uav.altitude),
        point: {
          pixelSize: 14,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: uav.id,
          font: '11px monospace',
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Add flight path for active UAVs
      if (uav.active) {
        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              uav.lng, uav.lat, uav.altitude,
              uav.lng + 0.003, uav.lat + 0.002, uav.altitude,
              uav.lng + 0.005, uav.lat - 0.001, uav.altitude,
            ]),
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.CYAN.withAlpha(0.7),
              dashLength: 16,
            }),
          },
        });
      }
    });
  }, []);

  // Initialize Cesium
  useEffect(() => {
    if (!mounted || !cesiumContainerRef.current) return;

    let isMounted = true;

    const initCesium = async () => {
      try {
        // Dynamically import Cesium
        const Cesium = await import('cesium');
        cesiumRef.current = Cesium;

        // Set base URL for Cesium assets
        (window as any).CESIUM_BASE_URL = '/cesium/';

        // Import Cesium CSS
        await import('cesium/Build/Cesium/Widgets/widgets.css');

        if (!isMounted || !cesiumContainerRef.current) return;

        // Create viewer with Hong Kong satellite basemap
        const basemapProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png',
          credit: new Cesium.Credit('Map from Lands Department'),
        });

        const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
          baseLayer: new Cesium.ImageryLayer(basemapProvider),
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          vrButton: false,
          fullscreenButton: false,
          homeButton: false,
          navigationHelpButton: false,
          geocoder: false,
          sceneModePicker: false,
          selectionIndicator: false,
          infoBox: false,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        // Hide credits
        const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
        if (creditContainer) {
          creditContainer.style.display = 'none';
        }

        viewerRef.current = viewer;

        // Try to add 3D buildings tileset (Hong Kong)
        try {
          const tileset = await Cesium.Cesium3DTileset.fromUrl(
            'https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json?key=3967f8f365694e0798af3e7678509421'
          );
          viewer.scene.primitives.add(tileset);
        } catch (e) {
          console.log('3D tileset loading skipped - API key may be required');
        }

        // Add heat zones and UAVs
        addHeatZones(viewer, Cesium);
        addUAVEntities(viewer, Cesium);

        // Set initial camera position (CUHK campus area)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            114.2069,
            22.4167,
            1200
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-50),
            roll: 0,
          },
          duration: 0,
        });

        // Enable depth testing against terrain
        viewer.scene.globe.depthTestAgainstTerrain = false;

        if (isMounted) {
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to initialize Cesium:', error);
        if (isMounted) {
          setLoadError('Failed to load 3D map. Please refresh the page.');
        }
      }
    };

    initCesium();

    return () => {
      isMounted = false;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [mounted, addHeatZones, addUAVEntities]);

  // Toggle 2D/3D mode
  const toggle3DMode = () => {
    if (!viewerRef.current || !cesiumRef.current) return;
    
    const newMode = !is3DMode;
    setIs3DMode(newMode);
    
    if (newMode) {
      viewerRef.current.scene.morphTo3D(1.0);
    } else {
      viewerRef.current.scene.morphTo2D(1.0);
    }
  };

  // Reset camera view
  const resetView = () => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, 1200),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-50),
        roll: 0,
      },
      duration: 1.5,
    });
  };

  // Start fly through animation
  const toggleFlyThrough = () => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    
    const newFlyingState = !isFlying;
    setIsFlying(newFlyingState);
    
    if (newFlyingState) {
      // Start fly animation - orbit around campus
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, 500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0,
        },
        duration: 2,
        complete: () => {
          // Continuous rotation
          const rotateCamera = () => {
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              viewerRef.current.scene.camera.rotateRight(0.002);
            }
          };
          
          viewerRef.current.clock.onTick.addEventListener(rotateCamera);
          
          // Store the listener for removal
          (viewerRef.current as any)._rotateListener = rotateCamera;
        }
      });
    } else {
      // Stop rotation
      if ((viewerRef.current as any)._rotateListener) {
        viewerRef.current.clock.onTick.removeEventListener((viewerRef.current as any)._rotateListener);
        (viewerRef.current as any)._rotateListener = null;
      }
    }
  };

  // Center view
  const centerView = () => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, 600),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    });
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
            <span className="text-cyan-400 text-sm font-medium">3D Thermal Environment</span>
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
                Alt: {mounted ? altitude.toFixed(0) : '---'}m
              </span>
              <span className="flex items-center gap-1" suppressHydrationWarning>
                <Gauge className="w-3 h-3" />
                Spd: {mounted ? speed.toFixed(1) : '-.-'}m/s
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <motion.button
          className={`p-2.5 rounded-lg transition-all ${is3DMode ? 'bg-cyan-500/30 border border-cyan-500' : 'bg-slate-800/80 border border-slate-700'}`}
          onClick={toggle3DMode}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
        >
          {is3DMode ? <Globe className="w-4 h-4 text-cyan-400" /> : <Map className="w-4 h-4 text-slate-400" />}
        </motion.button>
        <motion.button
          className={`p-2.5 rounded-lg transition-all ${showThermalOverlay ? 'bg-orange-500/30 border border-orange-500' : 'bg-slate-800/80 border border-slate-700'}`}
          onClick={() => setShowThermalOverlay(!showThermalOverlay)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Toggle Thermal Overlay"
        >
          <Layers className="w-4 h-4 text-orange-400" />
        </motion.button>
        <motion.button
          className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-600"
          onClick={resetView}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
        </motion.button>
        <motion.button
          className={`p-2.5 rounded-lg transition-all ${isFlying ? 'bg-green-500/30 border border-green-500' : 'bg-slate-800/80 border border-slate-700'}`}
          onClick={toggleFlyThrough}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={isFlying ? 'Stop Fly Through' : 'Start Fly Through'}
        >
          {isFlying ? <Pause className="w-4 h-4 text-green-400" /> : <Play className="w-4 h-4 text-slate-400" />}
        </motion.button>
        <motion.button
          className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-600"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4 text-slate-400" />
        </motion.button>
        <motion.button
          className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-600"
          onClick={centerView}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Top Down View"
        >
          <Crosshair className="w-4 h-4 text-slate-400" />
        </motion.button>
      </div>

      {/* Main 3D Map View */}
      <div className="relative flex-1 overflow-hidden bg-slate-900">
        {/* Loading overlay */}
        {!isLoaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 z-30">
            <div className="text-center">
              <motion.div
                className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-slate-300 text-sm font-medium">Initializing 3D Environment</p>
              <p className="text-slate-500 text-xs mt-1">Loading Cesium Viewer...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 z-30">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-slate-300 text-sm">{loadError}</p>
            </div>
          </div>
        )}

        {/* Cesium Container */}
        <div 
          ref={cesiumContainerRef} 
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Mode indicator */}
        {isLoaded && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <motion.div 
              className="bg-black/70 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-600"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-xs font-medium text-slate-200">
                {is3DMode ? '3D Globe View' : '2D Map View'}
                {isFlying && <span className="text-green-400 ml-2">• Flying</span>}
              </span>
            </motion.div>
          </div>
        )}

        {/* Temperature Scale */}
        {showThermalOverlay && isLoaded && (
          <div className="absolute bottom-4 left-4 map-overlay z-10">
            <div className="text-[10px] text-slate-400 mb-2">Temperature Scale (°C)</div>
            <div className="relative">
              <div className="w-32 h-3 rounded thermal-gradient" />
              <div className="flex justify-between w-32 text-[9px] text-slate-500 mt-1">
                <span>20</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
              </div>
            </div>
          </div>
        )}

        {/* UAV Status Mini Panel */}
        {isLoaded && (
          <div className="absolute bottom-4 right-4 map-overlay z-10">
            <div className="text-[10px] text-slate-400 mb-2 flex items-center justify-between">
              <span>Active UAVs</span>
              <span className="text-cyan-400 font-mono">{uavPositions.filter(u => u.active).length}/{uavPositions.length}</span>
            </div>
            <div className="space-y-1.5">
              {uavPositions.map((uav) => (
                <div key={uav.id} className="flex items-center gap-2 text-[10px]">
                  <motion.div 
                    className={`w-2 h-2 rounded-full ${uav.active ? 'bg-cyan-400' : 'bg-slate-500'}`}
                    animate={uav.active ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className={`font-mono ${uav.active ? 'text-cyan-300' : 'text-slate-500'}`}>{uav.id}</span>
                  <span className="text-slate-500">{uav.altitude}m</span>
                </div>
              ))}
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
