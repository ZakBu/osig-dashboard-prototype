export type WasteFilters = {
  availablePeriod: { from: string | null; to: string | null };
  carriers: string[];
  origins: string[];
  wasteTypes: Array<{ code: string; name: string }>;
};

export type Metric = { value: number; previous: number; changePct: number | null };
export type NullableMetric = { value: number | null; previous: number | null; changePct: number | null };
export type AnalyticsRankingRow = { name: string; trips: number; mass: number | null; vehicles: number };
export type CarrierEfficiencyAverage = AnalyticsRankingRow & { carriers: number };
export type WasteDashboard = {
  period: { from: string; to: string };
  comparisonPeriod: { from: string; to: string };
  dataThrough: string | null;
  metrics: {
    trips: Metric;
    completedShare: Metric & { changePp: number | null; completedTrips: number; totalTrips: number };
    receptionSites: Metric;
    carriers: Metric;
    originSites: Metric;
    vehicles: Metric;
    mass: Metric & { value: number | null; previous: number | null; unit: "t"; completedTrips: number; knownMassTrips: number; coveragePct: number | null };
  };
  statusStructure: Array<{ status: string; value: number; previous: number; sharePct: number; changePct: number | null }>;
  wasteStructure: Array<{ code: string; name: string; tons: number; trips: number; sharePct: number }>;
  trends: {
    trips: Array<{ bucket: string; value: number }>;
    mass: Array<{ bucket: string; value: number | null; completedTrips: number; knownMassTrips: number; coveragePct: number | null }>;
  };
  analytics: {
    metrics: {
      averageMass: NullableMetric;
      tripsPerVehicle: NullableMetric;
      wasteTop5Share: NullableMetric;
      receptionTop5Share: NullableMetric;
      originTop5Share: NullableMetric;
      carrierTop5Share: NullableMetric;
    };
    rankings: {
      carriers: AnalyticsRankingRow[];
      origins: AnalyticsRankingRow[];
      receptions: AnalyticsRankingRow[];
    };
    intensity: Array<{ day: string; hour: number; trips: number }>;
    carrierEfficiency: AnalyticsRankingRow[];
    carrierEfficiencyAverage: CarrierEfficiencyAverage | null;
    carrierEfficiencyTopAverage: CarrierEfficiencyAverage | null;
    trends: Record<"averageMass" | "tripsPerVehicle" | "wasteTop5Share" | "receptionTop5Share" | "originTop5Share" | "carrierTop5Share", Array<{ day: string; value: number | null }>>;
  };
};

export type WasteSelection = { carriers: string[]; origins: string[]; wasteCodes: string[] };

export function wasteFiltersPath(period: { from: string; to: string }, selection: WasteSelection) {
  const query = new URLSearchParams({ from: period.from, to: period.to });
  selection.carriers.forEach((value) => query.append("carriers", value));
  selection.origins.forEach((value) => query.append("origins", value));
  selection.wasteCodes.forEach((value) => query.append("wasteCodes", value));
  return `/api/waste/filters?${query.toString()}`;
}

export type WasteTrip = {
  tripNo: string;
  submittedAt: string;
  status: string;
  vehicle: string | null;
  driver: string | null;
  originObject: string | null;
  originName: string | null;
  destinationObject: string | null;
  destinationName: string | null;
  carrier: string | null;
  maxMass: number | null;
  cargoMass: number | null;
  cargoMassRaw: string | null;
  wasteCode: string | null;
  wasteType: string | null;
};

export type WasteTripsPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: WasteTrip[];
};

const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function latestPeriod(max: string, days = 7, min?: string | null) {
  const end = new Date(`${max}T00:00:00Z`);
  const calculated = iso(new Date(end.getTime() - (days - 1) * DAY));
  return { from: min && calculated < min ? min : calculated, to: max };
}

export function formatNumber(value: number | null, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
}

export function formatUpdated(value: string | null) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(`${normalized}+03:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date).replace(",", "");
}

export const WASTE_COLORS = ["#43be6b", "#4d78c6", "#c7b348", "#c44b4d", "#a55de8", "#31aeba", "#ef8b42", "#7d8a9d"];
export const STATUS_COLORS = ["#43be6b", "#4d78c6", "#c7b348", "#c44b4d", "#a55de8", "#31aeba", "#ef8b42", "#7d8a9d", "#d267a5", "#72a64c"];

export function statusColor(status: string) {
  const normalized = status.trim().toLocaleLowerCase("ru");
  const known: Record<string, string> = {
    "завершен": "#43be6b",
    "перевозка": "#ef8b42",
    "в пути": "#ef8b42",
    "подача": "#d8bd36",
    "разгрузка подтверждена": "#4d8ee8",
    "разгрузка": "#6f78dc",
    "на объекте приема": "#31aeba",
    "на взвешивание": "#4d78c6",
    "запланирован": "#a55de8",
    "отменено": "#d45155",
    "отменен": "#d45155",
    "отклонен при проверке": "#e46778",
  };
  if (known[normalized]) return known[normalized];
  let hash = 0;
  for (const char of status) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return STATUS_COLORS[hash % STATUS_COLORS.length];
}

export function trendLabel(bucket: string, granularity: "day" | "hour") {
  if (granularity === "hour") return bucket.slice(11, 16);
  const [, month, day] = bucket.slice(0, 10).split("-");
  return `${day}.${month}`;
}
