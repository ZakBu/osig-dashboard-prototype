/** Контракты данных между API и фронтом. */

export type Summary = {
  snapshotAt: string;
  total: number;
  open: number;
  no_fuel: number;
  closed_other: number;
  index: number;
  prevIndex: number | null;
  deltaPP: number | null;
  openDeltaAbs: number | null;
  openDeltaPct: number | null;
  hasPrev: boolean;
};

export type Critical = { okrug: string; index: number; total: number } | null;

export type OkrugRow = {
  okrug: string;
  total: number;
  open: number;
  no_fuel: number;
  closed_other: number;
  index: number;
};

export type NetRow = {
  net: string;
  total: number;
  open: number;
  no_fuel: number;
  closed_other: number;
  index: number;
};

export type TrendPoint = { key: string; index: number; reports?: number };

export type HeatCell = { dow: number; hour: number; index: number; total: number };

/** Средняя цена по марке топлива (по открытым АЗС). */
export type FuelPrice = { code: string; label: string; color: string; avg: number; count: number };

/** Счётчики [Открыто, Нет топлива, Закрыто (иная)]. */
export type Counts3 = [number, number, number];

/** Счётчики сервиса ГдеБенз за час: общие + разрезы по округам и сетям. */
export type HourlyCounts = {
  c: Counts3;
  okrugs: Record<string, Counts3>;
  nets: Record<string, Counts3>;
};

/** Счётчики очередей за час: [наблюдалось, ур.1, ур.2, ур.3]. */
export type QueueCounts4 = [number, number, number, number];

/** Очереди за час: общие + разрез по сетям. */
export type HourlyQueue = { c: QueueCounts4; nets: Record<string, QueueCounts4> };

/** Счётчики доступности топлива по видам среди ОТКРЫТЫХ АЗС за час:
 *  any — открыта и есть хоть какое-то топливо; g92/g95/gdt — есть данный вид. */
export type Fuel4 = { any: number; g92: number; g95: number; gdt: number };

/** Доступность топлива по видам за час: всего + разрез по сетям. */
export type HourlyFuel = { all: Fuel4; nets: Record<string, Fuel4> };

/** Почасовая точка (МСК): все АЗС (`all`), только с оператором (`op`), очереди (`q`), топливо (`fuel`). */
export type HourlyPoint = { key: string; all: HourlyCounts; op: HourlyCounts; q?: HourlyQueue; fuel?: HourlyFuel };

/** Агрегированная очередь за день (по сети или всем). */
export type QueueDay = { key: string; obs: number; l1: number; l2: number; l3: number; queue: number; share: number };

/** Сеть в фильтре очередей: имя + суммарная очередь за период. */
export type QueueNet = { name: string; obs: number; queue: number; share: number };

/** Точка тренда с тремя категориями (%). */
export type TrendPoint3 = { key: string; open: number; noFuel: number; closed: number; cnt?: Counts3 };

/** Строка 3-way по группе (округ/сеть) за период. */
export type StatusRow = {
  name: string;
  open: number;
  noFuel: number;
  closed: number;
  total: number;
  index: number;
};

/** Функционирующие пистолеты по видам (92 / 95 / 100(=98+100) / ДТ)
 *  прямо из матвью 27166: count_guns_{92,95,100,dt}_group. */
export type NozGroups = { g92: number; g95: number; g100: number; gdt: number };

/** Сводка реестра для набора АЗС (группа torg_net_group). Значения — ПРЯМО из матвью
 *  27166 (витрина считает, мы не пересчитываем): total=count_all_azs, open=count_open_azs,
 *  no_fuel=count_azs_no_fuel, closed_other=count_closed_azs, avail3=count_azs_with_fuel,
 *  bak=count_limit_tank, no_canister=count_limit_canister, queue=count_queue.
 *  Доли (share*) — тоже из матвью. index=share_open_azs. open_full/open_partial/noz_* нет → 0 (UI: «Н/Д»).
 *  guns — пистолеты по видам (92/95+/ДТ) прямо из матвью 27166 (count_guns_*_group); null = «Н/Д». */
export type NetSummary = {
  total: number; open: number; no_fuel: number; closed_other: number; index: number; avail3: number;
  /** Доступность «весь день» из витрины 27166: доступны весь день / НЕ доступны весь день. */
  availAllday: number; nonAvailAllday: number;
  open_full: number | null; open_partial: number | null; noz_full: NozGroups; noz_partial: NozGroups; bak: number; no_canister: number;
  queue: number;
  shareOpen: number | null; shareNoFuel: number | null; shareClosed: number | null; shareQueue: number | null;
  /** Предпосчитанные доли витрины 27166: доступны/не доступны весь день + ограничения в бак/канистры. */
  shareAvailAllday: number | null; shareNonAvailAllday: number | null; shareLimitTank: number | null; shareLimitCanister: number | null;
  guns: NozGroups | null;
  /** Пистолеты по видам на ПОЛНОСТЬЮ / ЧАСТИЧНО обеспеченных АЗС (27166) — для попапа-дриллдауна. */
  gunsFull: NozGroups | null; gunsPartial: NozGroups | null;
  /** Разбивка «закрывались за сутки» по длительности (минимум 3/6/9/12 ч); null = «Н/Д». */
  closed3h: number | null; closed6h: number | null; closed9h: number | null; closed12h: number | null;
};

/** Официальный реестр Москвы: сводка по всем + разрез по сетям. */
export type RegistryData = { region: string; all: NetSummary; nets: Record<string, NetSummary> };

/** Снимок очередей: queue=count_queue, total=count_open_azs, share=share_queue (из матвью). */
export type QueuesData = {
  region: string;
  totalQueue: number;
  nets: Record<string, { queue: number; total: number; share: number | null }>;
};

/** Цена вида топлива по сети: средняя сейчас + изменение за день/период. */
export type PriceInfo = { code: string; avg: number; count: number; dDay: number | null; dWeek: number | null };
/** Цены по сетям: сеть → массив марок. */
export type PricesByNet = Record<string, PriceInfo[]>;

/** Ответ /api/dashboard — реестр (последний срез матвью) + очереди + цены по группам. */
export type DashboardData = { empty: boolean; registry?: RegistryData; queues?: QueuesData; updatedAt?: string; pricesByNet?: PricesByNet };

/** Точка ряда «Доступность топлива» (матвью доступность_топлива): срез = день × час. */
export type AvailPoint = { day: string; hour: number; total: number | null; g92: number | null; g95: number | null; gdt: number | null };

/** Точка ряда очередей во времени (матвью 27166): queue=count_queue, open=count_open_azs. */
export type NetQueuePoint = { day: string; hour: number; queue: number | null; open: number | null };

/** Точка ряда ограничений во времени (матвью 27253): tank=azs_with_restriction_cnt, canister=azs_with_restriction_only_car_cnt. */
export type NetLimitPoint = {
  day: string; hour: number;
  tank: number | null; canister: number | null;
  tankShare: number | null; canisterShare: number | null;
};

/** Отпуск топлива (27200, данные ФНС с ККТ): точка = (дата × сеть × вид). vol — млн литров;
 *  dAbs/dPct — сравнение с прошлой неделей того же дня недели (витрина считает). */
export type SupplyRow = { date: string; dow: string; company: string; fuel: string; vol: number | null; dAbs: number | null; dPct: number | null };
export type SupplyData = { companies: string[]; fuels: string[]; rows: SupplyRow[] };

/**
 * Камерное покрытие по группе сетей (27243 + знаменатель из 27166).
 *  • azs*  — сколько АЗС покрыто камерами данного типа (бублик/доли);
 *  • cam*  — сколько самих камер данного типа (график роста);
 *  • setup — «Камеры 2/3» (обзор наведён на АЗС, пресет).
 */
export type CameraGroupRow = {
  name: string;
  totalAzs: number;
  azsAll: number;
  azsObzor: number;
  azsSetup: number;
  azsGrz: number;
  camAll: number;
  camObzor: number;
  camSetup: number;
  camGrz: number;
  coverShare: number | null;
};
/** Точка тренда — количество КАМЕР по типам (+ all = все виды), по группе, во времени. */
export type CameraTrendPoint = { date: string; group: string; all: number; obzor: number; setup: number; grz: number };
export type CameraData = { rows: CameraGroupRow[]; trend: CameraTrendPoint[]; updatedAt: string | null };

/** Точка ряда цен во времени (матвью 27170): средняя стоимость, руб/л, по видам топлива. */
export type PricePoint = {
  day: string; hour: number;
  p92: number | null; p92p: number | null; p95: number | null; p95p: number | null;
  p100: number | null; p100p: number | null; pdt: number | null; pdtp: number | null;
};

/** Ответ /api/trend — ряды по группам (torg_net_group → ряд). Значения прямо из матвью. */
export type TrendResponse = {
  available: boolean;
  availByGroup: Record<string, AvailPoint[]>;
  queueByGroup: Record<string, NetQueuePoint[]>;
  limitByGroup: Record<string, NetLimitPoint[]>;
  limitUpdatedAt?: string;
  priceByGroup: Record<string, PricePoint[]>;
};

export type Meta = {
  lastSnapshotAt: string | null;
  snapshotCount: number;
  totalStations: number;
  companies: number;
  coveragePct: number;
  regions: string[];
  okrugs: string[];
  nets: string[];
};

/** Разбивка «Полностью/Частично доступны» по комбинациям видов топлива (витрина 27196).
 *  share / fullyShare / partiallyShare — из витрины (*_share / *_percent), не считаем на клиенте. */
export type GunCell = { offered: boolean; avail: boolean; guns: number };
export type GunsComboRow = { key: string; amount: number; share: number | null; g92: GunCell; g95: GunCell; gdt: GunCell };
export type GunsCombo = {
  fully: number;
  partially: number;
  fullyShare: number | null;
  partiallyShare: number | null;
  full: GunsComboRow[];
  partial: GunsComboRow[];
  loadedAt: string | null;
  updated: string | null;
};
