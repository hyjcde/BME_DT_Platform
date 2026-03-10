'use client';

import { type RecordedFlightPath } from '@/data/recordedFlightPaths';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Line, Text, Billboard, useGLTF, useProgress, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Coordinate mapping ───
// After the campus model loads, its bounding-box is stored here so that
// percentage / geo coordinates can be mapped onto the model's real extent.

interface ModelBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  sizeX: number; sizeY: number; sizeZ: number;
}

const DEFAULT_BOUNDS: ModelBounds = {
  minX: -10, maxX: 10, minY: 0, maxY: 5, minZ: -10, maxZ: 10,
  sizeX: 20, sizeY: 5, sizeZ: 20,
};

function percentToWorld(
  x: number, y: number, altitude: number | undefined, bounds: ModelBounds,
): [number, number, number] {
  const wx = bounds.minX + (x / 100) * bounds.sizeX;
  const wz = bounds.minZ + (y / 100) * bounds.sizeZ;
  const wy = altitude ? bounds.maxY + altitude * 0.5 : bounds.maxY + 5;
  return [wx, wy, wz];
}

const MAP_BOUNDS = { minLng: 114.195, maxLng: 114.220, minLat: 22.410, maxLat: 22.430 };

function geoToPercent(lng: number, lat: number) {
  return {
    x: ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100,
    y: ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100,
  };
}

function geoToWorld(lng: number, lat: number, altitude: number | undefined, bounds: ModelBounds): [number, number, number] {
  const pos = geoToPercent(lng, lat);
  return percentToWorld(pos.x, pos.y, altitude, bounds);
}

// ─── Types ───

interface FlightPathData {
  id: string;
  color: string;
  label: string;
  type: 'coarse' | 'fine' | 'standby';
  points: { x: number; y: number }[];
  currentPosition: { x: number; y: number };
  status: 'active' | 'standby' | 'returning';
  battery: number;
  altitude: number;
  isAgentGenerated?: boolean;
  agentPathName?: string;
}

interface TestpointData {
  id: number;
  name: string;
  location_name: string;
  lat: number;
  lng: number;
  device_type: string;
  color: string;
  current_values: Record<string, number>;
  statistics: Record<string, unknown>;
}

interface ThreeMapProps {
  flightPaths?: FlightPathData[];
  recordedFlightPaths?: RecordedFlightPath[];
  showFlightPaths?: boolean;
  testpoints?: TestpointData[];
  showTestpoints?: boolean;
  selectedTestpointId?: number | null;
  onSelectTestpoint?: (id: number) => void;
  getCurrentValue?: (testpointId: number, param: string) => number | null;
  timeOfDay?: number; // 0-24 decimal hours (e.g. 9.15 = 09:09)
}

const DEVICE_COLORS: Record<string, string> = {
  'HOBO MX': '#3b82f6',
  'Weather Station': '#22c55e',
  'Thermocouple': '#f59e0b',
  'Radiation Tracker': '#a855f7',
};

// ─── Campus Model (GLB with Draco compression) ───

const DRACO_CDN = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const MODEL_PATH = '/cuhk-campus.glb';

function CampusModel({ onBoundsReady }: { onBoundsReady: (b: ModelBounds) => void }) {
  const { scene } = useGLTF(MODEL_PATH, DRACO_CDN);
  const { camera, controls } = useThree();
  const groupRef = useRef<THREE.Group>(null!);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    scene.position.sub(center);

    // After centering, the new bounding box is symmetric around origin
    const halfX = size.x / 2;
    const halfZ = size.z / 2;
    onBoundsReady({
      minX: -halfX, maxX: halfX,
      minY: -size.y / 2, maxY: size.y / 2,
      minZ: -halfZ, maxZ: halfZ,
      sizeX: size.x, sizeY: size.y, sizeZ: size.z,
    });

    const fitDistance = maxDim * 1.2;
    camera.position.set(fitDistance * 0.6, fitDistance * 0.5, fitDistance * 0.6);
    camera.lookAt(0, 0, 0);
    const orbitControls = controls as { target?: THREE.Vector3 } | undefined;
    if (orbitControls?.target) {
      orbitControls.target.set(0, 0, 0);
    }

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    console.log(`Campus model loaded: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);
  }, [scene, camera, controls, onBoundsReady]);

  return <primitive ref={groupRef} object={scene} />;
}

useGLTF.preload(MODEL_PATH, DRACO_CDN);

function ModelLoader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid #06b6d4',
        borderRadius: 12,
        padding: '20px 32px',
        textAlign: 'center',
        minWidth: 260,
      }}>
        <div style={{ color: '#06b6d4', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Loading CUHK Campus
        </div>
        <div style={{
          width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden', marginBottom: 6,
        }}>
          <div style={{
            width: `${progress}%`, height: '100%', background: '#06b6d4', borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>
          {progress.toFixed(0)}%
        </div>
      </div>
    </Html>
  );
}

// ─── Waypoint marker ───

function WaypointMarker({ position, color, index, isAgent, scale }: {
  position: [number, number, number]; color: string; index: number; isAgent: boolean; scale: number;
}) {
  const r = (isAgent ? 0.18 : 0.14) * scale;
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[r, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <Line points={[[0, 0, 0], [0, -position[1], 0]]} color={color} lineWidth={1} transparent opacity={0.3} />
      <Billboard position={[0, r * 2.5, 0]}>
        <Text fontSize={r * 1.3} color="white" anchorX="center" anchorY="bottom" outlineWidth={r * 0.2} outlineColor="black">
          {index + 1}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── UAV marker ───

function UAVMarker({ position, color, label, isAgent, scale }: {
  position: [number, number, number]; color: string; label: string; isAgent: boolean; scale: number;
}) {
  const r = 0.22 * scale;
  const ringRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 3) * 0.3;
    ringRef.current.scale.set(s, s, s);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 - Math.sin(t * 3) * 0.3;
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[r, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r * 1.4, r * 1.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, r * 2.5, 0]}>
        <Text fontSize={r} color={color} anchorX="center" anchorY="bottom" outlineWidth={r * 0.2} outlineColor="black" font={undefined}>
          {label}
        </Text>
        {isAgent && (
          <Text fontSize={r * 0.6} color="#a855f7" anchorX="center" anchorY="bottom" position={[0, r * 1.2, 0]} outlineWidth={r * 0.15} outlineColor="black">
            AGENT
          </Text>
        )}
      </Billboard>
    </group>
  );
}

// ─── Flight path visual ───

function FlightPathVisual({ path, bounds }: { path: FlightPathData; bounds: ModelBounds }) {
  const isAgent = !!path.isAgentGenerated;
  const color = isAgent ? '#a855f7' : path.color;
  const markerScale = Math.max(bounds.sizeX, bounds.sizeZ) / 80;
  const linePoints = useMemo(() =>
    path.points.map(p => new THREE.Vector3(...percentToWorld(p.x, p.y, path.altitude, bounds))),
    [path.points, path.altitude, bounds]);
  const uavPos = useMemo<[number, number, number]>(
    () => percentToWorld(path.currentPosition.x, path.currentPosition.y, path.altitude, bounds),
    [path.currentPosition, path.altitude, bounds]);

  if (path.points.length === 0) return null;
  const ds = markerScale * 0.3;
  return (
    <group>
      {linePoints.length >= 2 && <Line points={linePoints} color={color} lineWidth={isAgent ? 3 : 2} dashed dashSize={ds} gapSize={ds * 0.5} />}
      {path.points.map((p, i) => (
        <WaypointMarker key={`${path.id}-wp-${i}`} position={percentToWorld(p.x, p.y, path.altitude, bounds)} color={color} index={i} isAgent={isAgent} scale={markerScale} />
      ))}
      <UAVMarker position={uavPos} color={color} label={path.label} isAgent={isAgent} scale={markerScale} />
    </group>
  );
}

function FlightPaths({ paths, bounds }: { paths: FlightPathData[]; bounds: ModelBounds }) {
  return <group>{paths.map(path => <FlightPathVisual key={path.id} path={path} bounds={bounds} />)}</group>;
}

function RecordedFlightPathVisual({ path, bounds }: { path: RecordedFlightPath; bounds: ModelBounds }) {
  const scale = Math.max(bounds.sizeX, bounds.sizeZ) / 80;
  const linePoints = useMemo(
    () => path.points.map((point) => new THREE.Vector3(...geoToWorld(point.lng, point.lat, point.altitude, bounds))),
    [path.points, bounds],
  );
  const sampleStride = Math.max(1, Math.floor(path.points.length / 18));
  const sampledPoints = useMemo(
    () => path.points.filter((_, index) => index === 0 || index === path.points.length - 1 || index % sampleStride === 0),
    [path.points, sampleStride],
  );
  const startPoint = path.points[0];
  const endPoint = path.points[path.points.length - 1];
  const labelPoint = path.points[Math.floor(path.points.length / 2)] ?? startPoint;

  if (!startPoint || !endPoint || !labelPoint || linePoints.length < 2) return null;

  return (
    <group>
      <Line
        points={linePoints}
        color={path.color}
        lineWidth={2.4}
        dashed
        dashSize={scale * 0.65}
        gapSize={scale * 0.35}
        transparent
        opacity={0.92}
      />

      {sampledPoints.map((point) => (
        <mesh
          key={`${path.id}-sample-${point.index}`}
          position={geoToWorld(point.lng, point.lat, point.altitude, bounds)}
        >
          <sphereGeometry args={[0.08 * scale, 12, 12]} />
          <meshStandardMaterial color={path.color} emissive={path.color} emissiveIntensity={0.45} />
        </mesh>
      ))}

      <mesh position={geoToWorld(startPoint.lng, startPoint.lat, startPoint.altitude, bounds)}>
        <sphereGeometry args={[0.18 * scale, 16, 16]} />
        <meshStandardMaterial color={path.color} emissive={path.color} emissiveIntensity={0.8} />
      </mesh>

      <mesh position={geoToWorld(endPoint.lng, endPoint.lat, endPoint.altitude, bounds)}>
        <octahedronGeometry args={[0.2 * scale, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={path.color} emissiveIntensity={0.7} />
      </mesh>

      <Billboard position={geoToWorld(labelPoint.lng, labelPoint.lat, labelPoint.altitude + 10, bounds)}>
        <Text
          fontSize={0.18 * scale}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.035 * scale}
          outlineColor={path.color}
        >
          {`${path.id} · ${path.pointCount} pts`}
        </Text>
      </Billboard>
    </group>
  );
}

function RecordedFlightPaths({ paths, bounds }: { paths: RecordedFlightPath[]; bounds: ModelBounds }) {
  return <group>{paths.map((path) => <RecordedFlightPathVisual key={path.id} path={path} bounds={bounds} />)}</group>;
}

// ─── Testpoint marker (clickable) ───

function TestpointMarker({ tp, isSelected, onClick, currentTemp, bounds }: {
  tp: TestpointData;
  isSelected: boolean;
  onClick: () => void;
  currentTemp: number | null;
  bounds: ModelBounds;
}) {
  const color = DEVICE_COLORS[tp.device_type] || '#6b7280';
  const pos = geoToPercent(tp.lng, tp.lat);
  const worldPos = percentToWorld(pos.x, pos.y, undefined, bounds);
  const s = Math.max(bounds.sizeX, bounds.sizeZ) / 80;
  const poleHeight = 1.8 * s;
  const markerY = poleHeight;
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const baseR = 0.22 * s;
  const sphereR = isSelected ? baseR * 1.36 : hovered ? baseR * 1.18 : baseR;

  return (
    <group position={[worldPos[0], worldPos[1], worldPos[2]]}>
      <Line points={[[0, 0.05 * s, 0], [0, poleHeight, 0]]} color={color} lineWidth={isSelected ? 3 : 2} />

      <mesh
        position={[0, markerY, 0]}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[sphereR, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.7 : hovered ? 0.5 : 0.3}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, markerY, 0]}>
          <ringGeometry args={[baseR * 1.6, baseR * 1.9, 32]} />
          <meshBasicMaterial color="white" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Billboard position={[0, markerY + baseR * 1.8, 0]}>
        <Text
          fontSize={(isSelected ? 0.28 : 0.22) * s}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.04 * s}
          outlineColor={color}
        >
          {tp.id}
        </Text>
      </Billboard>

      {(hovered || isSelected) && (
        <Billboard position={[0, markerY + (isSelected ? 0.85 : 0.7) * s * 1.5, 0]}>
          <Text fontSize={0.15 * s} color="#94a3b8" anchorX="center" anchorY="bottom" outlineWidth={0.03 * s} outlineColor="black" maxWidth={3 * s}>
            {tp.location_name}
          </Text>
          {currentTemp != null && (
            <Text fontSize={0.17 * s} color="#fb923c" anchorX="center" anchorY="bottom" position={[0, 0.22 * s, 0]} outlineWidth={0.03 * s} outlineColor="black">
              {currentTemp.toFixed(1)}°C
            </Text>
          )}
        </Billboard>
      )}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03 * s, 0]}>
          <circleGeometry args={[0.5 * s, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}

function TestpointMarkers({ testpoints, selectedId, onSelect, getCurrentValue, bounds }: {
  testpoints: TestpointData[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  getCurrentValue: (id: number, param: string) => number | null;
  bounds: ModelBounds;
}) {
  const filtered = useMemo(() =>
    testpoints.filter(tp => tp.statistics && Object.keys(tp.statistics).length > 0),
    [testpoints]);

  return (
    <group>
      {filtered.map(tp => (
        <TestpointMarker
          key={tp.id}
          tp={tp}
          isSelected={selectedId === tp.id}
          onClick={() => onSelect(tp.id)}
          currentTemp={
            getCurrentValue(tp.id, 'temperature') ??
            getCurrentValue(tp.id, 'air_temperature') ??
            getCurrentValue(tp.id, 'globe_temperature') ??
            getCurrentValue(tp.id, 'surface_temperature') ??
            tp.current_values?.temperature ??
            tp.current_values?.air_temperature ??
            tp.current_values?.globe_temperature ??
            tp.current_values?.surface_temperature ??
            null
          }
          bounds={bounds}
        />
      ))}
    </group>
  );
}

// ─── Time-of-day lighting ───
// Maps 0-24 hour to sky color, sun color, sun position, ambient intensity, etc.

function getTimeOfDayLighting(hour: number) {
  // Clamp to 0-24
  const h = ((hour % 24) + 24) % 24;

  if (h >= 6 && h < 8) {
    // Dawn → morning
    const t = (h - 6) / 2;
    return {
      skyColor: lerpColor('#1a1a3e', '#87CEEB', t),
      fogColor: lerpColor('#2a2a4e', '#b0d4e8', t),
      sunColor: lerpColor('#ff8844', '#fffaf0', t),
      sunIntensity: 0.8 + t * 1.2,
      ambientIntensity: 0.3 + t * 0.5,
      sunAngle: -60 + t * 60, // low to mid
      envPreset: 'park' as const,
    };
  } else if (h >= 8 && h < 17) {
    // Daytime
    return {
      skyColor: '#87CEEB',
      fogColor: '#b0d4e8',
      sunColor: '#fffaf0',
      sunIntensity: 2.0,
      ambientIntensity: 0.8,
      sunAngle: 70,
      envPreset: 'park' as const,
    };
  } else if (h >= 17 && h < 19) {
    // Sunset
    const t = (h - 17) / 2;
    return {
      skyColor: lerpColor('#87CEEB', '#ff7b54', t),
      fogColor: lerpColor('#b0d4e8', '#cc6644', t),
      sunColor: lerpColor('#fffaf0', '#ff6633', t),
      sunIntensity: 2.0 - t * 1.2,
      ambientIntensity: 0.8 - t * 0.4,
      sunAngle: 70 - t * 60,
      envPreset: 'sunset' as const,
    };
  } else if (h >= 19 && h < 20) {
    // Dusk
    const t = h - 19;
    return {
      skyColor: lerpColor('#ff7b54', '#1a1a3e', t),
      fogColor: lerpColor('#cc6644', '#111122', t),
      sunColor: '#ff6633',
      sunIntensity: 0.8 - t * 0.6,
      ambientIntensity: 0.4 - t * 0.2,
      sunAngle: 10 - t * 20,
      envPreset: 'night' as const,
    };
  } else {
    // Night (20-6)
    return {
      skyColor: '#0a0e1a',
      fogColor: '#080c16',
      sunColor: '#4466aa',
      sunIntensity: 0.15,
      ambientIntensity: 0.15,
      sunAngle: -30,
      envPreset: 'night' as const,
    };
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 0xff, ga = (pa >> 8) & 0xff, ba2 = pa & 0xff;
  const rb = (pb >> 16) & 0xff, gb = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const bl = Math.round(ba2 + (bb - ba2) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function DynamicLighting({ hour }: { hour: number }) {
  const lighting = useMemo(() => getTimeOfDayLighting(hour), [hour]);

  const sunPos = useMemo<[number, number, number]>(() => {
    const rad = (lighting.sunAngle * Math.PI) / 180;
    return [Math.cos(rad) * 800, Math.sin(rad) * 800, 300];
  }, [lighting.sunAngle]);

  return (
    <>
      <color attach="background" args={[lighting.skyColor]} />
      <fog attach="fog" args={[lighting.fogColor, 2000, 8000]} />
      <ambientLight intensity={lighting.ambientIntensity} color="#ffffff" />
      <directionalLight
        position={sunPos}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-300, 200, -400]} intensity={lighting.ambientIntensity * 0.4} color={lighting.skyColor} />
      <hemisphereLight args={[lighting.skyColor, '#f0e6d3', lighting.ambientIntensity * 0.5]} />
    </>
  );
}

// ─── Main component ───

export default function ThreeMap({
  flightPaths = [],
  recordedFlightPaths = [],
  showFlightPaths = true,
  testpoints = [],
  showTestpoints = true,
  selectedTestpointId = null,
  onSelectTestpoint,
  getCurrentValue,
  timeOfDay = 12,
}: ThreeMapProps) {
  const [modelBounds, setModelBounds] = useState<ModelBounds>(DEFAULT_BOUNDS);

  const handleBoundsReady = useCallback((b: ModelBounds) => {
    setModelBounds(b);
  }, []);

  const handleSelectTestpoint = useCallback((id: number) => {
    onSelectTestpoint?.(id);
  }, [onSelectTestpoint]);

  const getValueSafe = useCallback((id: number, param: string) => {
    return getCurrentValue ? getCurrentValue(id, param) : null;
  }, [getCurrentValue]);

  const lighting = useMemo(() => getTimeOfDayLighting(timeOfDay), [timeOfDay]);

  return (
    <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [200, 150, 200], fov: 50, near: 0.1, far: 10000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <DynamicLighting hour={timeOfDay} />

        <Suspense fallback={<ModelLoader />}>
          <CampusModel onBoundsReady={handleBoundsReady} />
        </Suspense>

        {showFlightPaths && <FlightPaths paths={flightPaths} bounds={modelBounds} />}
        {showFlightPaths && recordedFlightPaths.length > 0 && (
          <RecordedFlightPaths paths={recordedFlightPaths} bounds={modelBounds} />
        )}

        {showTestpoints && testpoints.length > 0 && (
          <TestpointMarkers
            testpoints={testpoints}
            selectedId={selectedTestpointId}
            onSelect={handleSelectTestpoint}
            getCurrentValue={getValueSafe}
            bounds={modelBounds}
          />
        )}

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1} maxDistance={8000} maxPolarAngle={Math.PI / 2 + 0.1} />
        <Environment preset={lighting.envPreset} />
      </Canvas>
    </div>
  );
}
