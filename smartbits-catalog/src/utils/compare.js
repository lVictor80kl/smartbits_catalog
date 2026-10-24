import { CPU_BENCHMARKS } from '../data/cpuBenchmarks.js';

export function extractNumber(value, { terabyteToGb = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const str = String(value).toLowerCase().replace(',', '.');
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  let num = parseFloat(match[0]);
  if (terabyteToGb && /\btb\b|terabyte/.test(str)) num *= 1024;
  return num;
}

export function cpuTier(cpu) {
  if (!cpu) return null;
  const str = String(cpu).toLowerCase();

  const intel = str.match(/i\s*(\d)/);
  if (intel) return parseInt(intel[1], 10);

  const ryzen = str.match(/ryzen\s*(\d)/);
  if (ryzen) return parseInt(ryzen[1], 10);

  return null;
}

export function percentDiff(base, current) {
  if (
    base === null || base === undefined ||
    current === null || current === undefined ||
    !Number.isFinite(base) || !Number.isFinite(current) || base === 0
  ) {
    return null;
  }
  return ((current - base) / base) * 100;
}

export function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.5) return '0%';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function parseCpu(cpu) {
  if (!cpu) return { tier: null, generation: null, ghz: null, family: null, variant: null };

  const str = String(cpu).toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  const ghzMatch = str.match(/(\d+(?:\.\d+)?)\s*ghz/);
  const ghz = ghzMatch ? parseFloat(ghzMatch[1]) : null;

  const apple = str.match(/(?:^|\bapple\s+)m([1-4])\b/);
  if (apple) {
    const variant = /ultra/.test(str) ? 'ultra' : /max/.test(str) ? 'max' : /pro/.test(str) ? 'pro' : null;
    const chip = parseInt(apple[1], 10);
    return { tier: chip, generation: chip, ghz, family: 'apple', variant };
  }

  const ultra = str.match(/ultra\s*([579])\b/);
  if (ultra) {
    const model = str.match(/ultra\s*[579]\s*(\d{3})/);
    const series = model ? parseInt(model[1][0], 10) : null;
    return { tier: parseInt(ultra[1], 10), generation: series, ghz, family: 'ultra', variant: null };
  }

  const ryzenAi = str.match(/ryzen\s*ai\s*([579])\b/);
  if (ryzenAi) {
    return { tier: parseInt(ryzenAi[1], 10), generation: null, ghz, family: 'ryzen-ai', variant: /hx/.test(str) ? 'hx' : null };
  }

  if (str.includes('snapdragon')) {
    const variant = str.includes('elite') ? 'elite' : 'plus';
    return { tier: null, generation: null, ghz, family: 'snapdragon', variant };
  }

  if (str.includes('celeron')) return { tier: null, generation: null, ghz, family: 'budget', variant: 'celeron' };
  if (str.includes('pentium')) return { tier: null, generation: null, ghz, family: 'budget', variant: 'pentium' };
  if (str.includes('athlon')) return { tier: null, generation: null, ghz, family: 'budget', variant: 'athlon' };

  const coreM = str.match(/\bcore\s*m([357])\b/);
  if (coreM) return { tier: parseInt(coreM[1], 10), generation: null, ghz, family: 'budget', variant: `m${coreM[1]}` };

  let tier = null;
  let family = null;

  const intel = str.match(/i\s*([3579])/);
  if (intel) {
    tier = parseInt(intel[1], 10);
    family = 'intel';
  }

  const ryzen = str.match(/ryzen\s*(?:pro\s+)?([3579])/);
  if (ryzen) {
    tier = parseInt(ryzen[1], 10);
    family = 'amd';
  }

  if (!tier) {
    const coreNew = str.match(/\bcore\s+([3579])\b/);
    if (coreNew) {
      tier = parseInt(coreNew[1], 10);
      family = 'intel';
    }
  }

  let generation = null;
  if (family === 'intel') {
    const model = str.match(/i[3579][\s-]*(\d{4,5})/);
    if (model) {
      const digits = model[1];
      const firstTwo = parseInt(digits.slice(0, 2), 10);
      generation = digits.length >= 5 || (firstTwo >= 10 && firstTwo <= 14)
        ? firstTwo
        : parseInt(digits[0], 10);
    } else {
      const coreModel = str.match(/\bcore\s+[3579]\s*(\d{3})/);
      if (coreModel) generation = coreModel[1][0] === '2' ? 14 : 13;
    }
  } else if (family === 'amd') {
    const tail = (str.match(/ryzen\s*(?:pro\s+)?[3579](.*)$/) || [])[1] || '';
    const model4 = tail.match(/(\d)\d{3}/);
    if (model4) {
      generation = parseInt(model4[1], 10);
    } else {
      const d = tail.match(/(\d)/);
      if (d) generation = parseInt(d[1], 10);
    }
  }

  return { tier, generation, ghz, family, variant: null };
}

const TIER_BASE = { 3: 40, 5: 58, 7: 76, 9: 94 };
const APPLE_BASE = { 1: 78, 2: 84, 3: 88, 4: 92 };
const APPLE_VARIANT_BONUS = { pro: 6, max: 12, ultra: 18 };
const ULTRA_BASE = { 5: 62, 7: 78, 9: 90 };
const RYZEN_AI_BASE = { 5: 62, 7: 78, 9: 90 };
const SNAPDRAGON_BASE = { plus: 66, elite: 80 };
const BUDGET_BASE = { celeron: 28, pentium: 34, athlon: 32, m3: 30, m5: 42, m7: 54 };

function ghzBonus(ghz) {
  if (!ghz) return 0;
  if (ghz >= 4) return 6;
  if (ghz >= 3.5) return 4;
  if (ghz >= 3) return 2;
  return 0;
}

export function cpuPowerScore(cpu) {
  const { tier, generation, ghz, family, variant } = parseCpu(cpu);

  let score = null;
  if (family === 'apple') {
    score = (APPLE_BASE[tier] ?? 80) + (APPLE_VARIANT_BONUS[variant] ?? 0);
  } else if (family === 'ultra') {
    score = (ULTRA_BASE[tier] ?? 70) + (generation === 2 ? 3 : 0) + ghzBonus(ghz);
  } else if (family === 'ryzen-ai') {
    score = (RYZEN_AI_BASE[tier] ?? 70) + (variant === 'hx' ? 4 : 0) + ghzBonus(ghz);
  } else if (family === 'snapdragon') {
    score = (SNAPDRAGON_BASE[variant] ?? 70) + ghzBonus(ghz);
  } else if (family === 'budget') {
    score = (BUDGET_BASE[variant] ?? 30) + ghzBonus(ghz);
  } else if (tier) {
    score = TIER_BASE[tier] ?? 50;
    if (generation) {
      const baseGen = family === 'amd' ? 4 : 8;
      score += Math.max(-12, Math.min(15, (generation - baseGen) * 2.5));
    }
    score += ghzBonus(ghz);
  } else {
    return null;
  }

  return Math.round(Math.max(1, Math.min(100, score)));
}

export function powerLevel(score) {
  if (score === null || score === undefined) {
    return { label: 'Sin datos', className: 'bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-300' };
  }
  if (score >= 85) return { label: 'Máximo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  if (score >= 70) return { label: 'Alto', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  if (score >= 50) return { label: 'Equilibrado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'Básico', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' };
}

export function powerBarClass(score) {
  if (score === null || score === undefined) return 'bg-brand-400';
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function normalizeCpuKey(name) {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\d+(?:\.\d+)?\s*ghz/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*mhz/g, ' ')
    .replace(/\b(?:intel|amd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CPU_STOP_TOKENS = new Set([
  'cpu', 'apu', 'processor', 'mobile', 'genuine',
  'tm', 'r', 'with', 'radeon', 'graphics',
  'nucleos', 'hilos', 'cores', 'threads', 'vpro',
  'hexa', 'quad', 'dual', 'octa', 'cache',
]);

const CPU_VENDOR_PREFIXES = [
  'core ', 'ryzen', 'apple', 'snapdragon', 'celeron',
  'pentium', 'athlon', 'processor ', 'ultra ',
];

function cpuKeyVariants(key) {
  const bases = [key];
  const stripped = key
    .split(' ')
    .filter((t) => t && !CPU_STOP_TOKENS.has(t))
    .join(' ');
  if (stripped && stripped !== key) bases.push(stripped);
  const out = [];
  for (const b of bases) {
    out.push(b);
    if (b.startsWith('processor ')) {
      out.push(b.slice('processor '.length));
    } else {
      out.push(`processor ${b}`);
    }
    if (!CPU_VENDOR_PREFIXES.some((p) => b.startsWith(p))) {
      out.push(`core ${b}`);
    }
  }
  return [...new Set(out)].filter(Boolean);
}

export function cpuBenchmarkScore(cpu) {
  const key = normalizeCpuKey(cpu);
  if (!key) return null;

  const tried = new Set();
  let current = key;
  while (current) {
    for (const k of cpuKeyVariants(current)) {
      if (tried.has(k)) continue;
      tried.add(k);
      const v = CPU_BENCHMARKS[k];
      if (typeof v === 'number') return v;
    }
    const trimmed = current.replace(/\s+\S+$/, '');
    if (trimmed === current) break;
    current = trimmed;
  }
  return null;
}
