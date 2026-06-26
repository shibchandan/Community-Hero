/**
 * IoT Sensor Network Service
 * Receives webhook payloads from smart city sensors.
 * Evaluates thresholds and auto-creates high-severity issues.
 * Includes a /simulate endpoint for demo purposes.
 */

export type SensorType = 'flood' | 'air_quality' | 'noise' | 'temperature' | 'pothole_vibration' | 'streetlight_outage';

export interface SensorPayload {
  sensorId: string;
  sensorType: SensorType;
  value: number;       // The raw sensor reading
  unit: string;        // e.g. '%', 'AQI', 'dB', '°C'
  location: {
    lat: number;
    lng: number;
    address: string;
    area: string;
    city: string;
  };
  timestamp: string;
}

export interface SensorThresholdResult {
  breached: boolean;
  severity: 'low' | 'medium' | 'high';
  issueCategory: 'water' | 'safety' | 'road' | 'streetlight' | 'garbage';
  title: string;
  description: string;
}

// Threshold configuration for each sensor type
const THRESHOLDS: Record<SensorType, {
  warning: number;
  critical: number;
  unit: string;
  category: SensorThresholdResult['issueCategory'];
  titleFn: (v: number, u: string) => string;
  descFn: (v: number, u: string, addr: string) => string;
}> = {
  flood: {
    warning: 60,
    critical: 85,
    unit: '%',
    category: 'water',
    titleFn: (v) => `⚠️ Flood Alert: Drain Capacity at ${v.toFixed(0)}%`,
    descFn: (v, u, addr) => `IoT flood sensor at ${addr} reports drain/canal water level at ${v.toFixed(1)}${u}. Imminent overflow risk detected. Immediate drainage inspection required.`,
  },
  air_quality: {
    warning: 100,
    critical: 200,
    unit: 'AQI',
    category: 'safety',
    titleFn: (v) => `🌫️ Hazardous Air Quality Detected (AQI ${v.toFixed(0)})`,
    descFn: (v, u, addr) => `Air quality sensor at ${addr} has recorded an AQI of ${v.toFixed(0)}${u}. This exceeds safe breathing thresholds. Source investigation and public advisory required.`,
  },
  noise: {
    warning: 70,
    critical: 90,
    unit: 'dB',
    category: 'safety',
    titleFn: (v) => `🔊 Noise Pollution Alert: ${v.toFixed(0)} dB`,
    descFn: (v, u, addr) => `Noise sensor at ${addr} has recorded ${v.toFixed(0)}${u}, exceeding permissible residential limits. Investigation of noise source recommended.`,
  },
  temperature: {
    warning: 42,
    critical: 48,
    unit: '°C',
    category: 'safety',
    titleFn: (v) => `🌡️ Extreme Heat Alert: ${v.toFixed(1)}°C`,
    descFn: (v, u, addr) => `Temperature sensor at ${addr} reads ${v.toFixed(1)}${u}. Extreme heat conditions detected. Emergency cooling shelters and water distribution points activation recommended.`,
  },
  pothole_vibration: {
    warning: 3.5,
    critical: 6.0,
    unit: 'G',
    category: 'road',
    titleFn: (v) => `🚧 Road Damage Detected (${v.toFixed(1)}G impact)`,
    descFn: (v, u, addr) => `Vibration sensor embedded at road surface near ${addr} recorded a ${v.toFixed(1)}${u} impact event, indicating a significant pothole or road break. Urgent road inspection required.`,
  },
  streetlight_outage: {
    warning: 0.5,
    critical: 0.1,
    unit: 'lux',
    category: 'streetlight',
    titleFn: () => `💡 Streetlight Outage Detected`,
    descFn: (v, u, addr) => `Smart streetlight sensor at ${addr} reports luminosity of only ${v.toFixed(2)}${u}, indicating a lamp failure or power outage. Maintenance dispatch required.`,
  },
};

export function evaluateSensorThreshold(payload: SensorPayload): SensorThresholdResult {
  const config = THRESHOLDS[payload.sensorType];
  if (!config) {
    return { breached: false, severity: 'low', issueCategory: 'safety', title: '', description: '' };
  }

  const { value } = payload;
  const addr = payload.location.address || payload.location.area;

  // Streetlight uses inverted logic (lower = worse)
  let breached = false;
  let severity: SensorThresholdResult['severity'] = 'low';

  if (payload.sensorType === 'streetlight_outage') {
    if (value <= config.critical) { breached = true; severity = 'high'; }
    else if (value <= config.warning) { breached = true; severity = 'medium'; }
  } else {
    if (value >= config.critical) { breached = true; severity = 'high'; }
    else if (value >= config.warning) { breached = true; severity = 'medium'; }
  }

  return {
    breached,
    severity,
    issueCategory: config.category,
    title: config.titleFn(value, config.unit),
    description: config.descFn(value, config.unit, addr),
  };
}

// Sensor types for the simulator
const SENSOR_TYPES: SensorType[] = ['flood', 'air_quality', 'noise', 'temperature', 'pothole_vibration', 'streetlight_outage'];

const DEMO_LOCATIONS = [
  { lat: 28.6139, lng: 77.2090, address: 'Connaught Place, Sector 4', area: 'Central Delhi', city: 'Delhi' },
  { lat: 19.0760, lng: 72.8777, address: 'Bandra West, Link Road', area: 'Bandra', city: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, address: 'MG Road, Brigade Gateway', area: 'Bangalore Central', city: 'Bangalore' },
  { lat: 22.5726, lng: 88.3639, address: 'Park Street, Metro Gate 2', area: 'Kolkata Central', city: 'Kolkata' },
];

export function generateSimulatedSensorEvent(breach: boolean = true): SensorPayload {
  const sensorType = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
  const location = DEMO_LOCATIONS[Math.floor(Math.random() * DEMO_LOCATIONS.length)];
  const config = THRESHOLDS[sensorType];
  
  // Generate a value — if breach requested, generate above the critical threshold
  let value: number;
  if (breach) {
    if (sensorType === 'streetlight_outage') {
      value = parseFloat((Math.random() * 0.08).toFixed(3)); // Below critical 0.1 lux
    } else {
      value = parseFloat((config.critical * (1 + Math.random() * 0.3)).toFixed(2));
    }
  } else {
    if (sensorType === 'streetlight_outage') {
      value = parseFloat((500 + Math.random() * 500).toFixed(2));
    } else {
      value = parseFloat((config.warning * 0.5 * Math.random()).toFixed(2));
    }
  }

  return {
    sensorId: `SENSOR-${sensorType.toUpperCase().replace('_', '')}-${Math.floor(Math.random() * 9000 + 1000)}`,
    sensorType,
    value,
    unit: config.unit,
    location,
    timestamp: new Date().toISOString(),
  };
}
