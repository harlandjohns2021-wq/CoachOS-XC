export const STORAGE_SCHEMA_VERSION = 3;

const DEFAULT_SETTINGS = Object.freeze({
  teamName: 'Harts Bluff XC',
  season: '2026 XC',
  coachName: '',
  aiRole: 'head_coach',
  aiAthleteDetail: 'team_only',
  aiScope: {
    teamTrends: true,
    athleteTrends: true,
    workloadBalance: true,
    raceReadiness: true,
    coachQueries: true
  }
});

export function defaultState() {
  return {
    version: STORAGE_SCHEMA_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      aiScope: { ...DEFAULT_SETTINGS.aiScope }
    },
    athletes: [],
    results: [],
    attendance: {},
    practices: [],
    rosterAssignments: {},
    customDistances: [],
    tombstones: {
      athletes: {},
      results: {},
      practices: {}
    }
  };
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function timestampOf(record) {
  if (!record || typeof record !== 'object') return 0;
  const direct = Number(record.updatedAtMs ?? record.deletedAtMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsed = Date.parse(record.updatedAt || record.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return normalizeName(value).replace(/\s+/g, '_') || 'unknown';
}

export function normalizePractice(practice) {
  const value = objectOrEmpty(practice);
  const rosterId = String(value.rosterId || 'all');
  const date = String(value.date || '');
  return {
    ...value,
    id: String(value.id || `${date}|${rosterId}`),
    rosterId,
    updatedAtMs: timestampOf(value)
  };
}

function normalizeTombstoneBucket(bucket) {
  const result = {};
  Object.entries(objectOrEmpty(bucket)).forEach(([key, raw]) => {
    const value = typeof raw === 'number' ? raw : Number(raw?.deletedAtMs ?? raw);
    if (Number.isFinite(value) && value > 0) result[key] = value;
  });
  return result;
}

export function normalizeState(input) {
  const base = defaultState();
  const value = objectOrEmpty(input);
  const settings = objectOrEmpty(value.settings);
  const tombstones = objectOrEmpty(value.tombstones);

  return {
    ...base,
    ...value,
    version: Math.max(STORAGE_SCHEMA_VERSION, Number(value.version) || 0),
    settings: {
      ...base.settings,
      ...settings,
      aiScope: {
        ...base.settings.aiScope,
        ...objectOrEmpty(settings.aiScope)
      }
    },
    athletes: Array.isArray(value.athletes) ? value.athletes.filter(Boolean).map((row) => ({ ...row })) : [],
    results: Array.isArray(value.results) ? value.results.filter(Boolean).map((row) => ({ ...row })) : [],
    attendance: objectOrEmpty(value.attendance),
    practices: Array.isArray(value.practices) ? value.practices.filter(Boolean).map(normalizePractice) : [],
    rosterAssignments: objectOrEmpty(value.rosterAssignments),
    customDistances: Array.isArray(value.customDistances)
      ? [...new Set(value.customDistances.map((item) => String(item || '').trim()).filter(Boolean))]
      : [],
    tombstones: {
      athletes: normalizeTombstoneBucket(tombstones.athletes),
      results: normalizeTombstoneBucket(tombstones.results),
      practices: normalizeTombstoneBucket(tombstones.practices)
    }
  };
}

export function chooseNewest(existing, incoming, preferIncomingOnTie = true) {
  if (!existing) return incoming ? { ...incoming } : null;
  if (!incoming) return { ...existing };
  const existingTime = timestampOf(existing);
  const incomingTime = timestampOf(incoming);
  if (incomingTime > existingTime) return { ...incoming };
  if (incomingTime < existingTime) return { ...existing };
  return preferIncomingOnTie ? { ...existing, ...incoming } : { ...incoming, ...existing };
}

function mergeTombstones(remote, local) {
  const result = { athletes: {}, results: {}, practices: {} };
  for (const bucket of Object.keys(result)) {
    const keys = new Set([
      ...Object.keys(remote?.[bucket] || {}),
      ...Object.keys(local?.[bucket] || {})
    ]);
    for (const key of keys) {
      result[bucket][key] = Math.max(
        Number(remote?.[bucket]?.[key]) || 0,
        Number(local?.[bucket]?.[key]) || 0
      );
    }
  }
  return result;
}

function isDeleted(bucket, key, record) {
  if (!key) return false;
  const deletedAt = Number(bucket?.[key]) || 0;
  return deletedAt > 0 && deletedAt >= timestampOf(record);
}

function resultIdentity(result) {
  if (result?.id) return `id:${result.id}`;
  return [
    'value',
    result?.athleteId || '',
    result?.date || '',
    result?.distance || '',
    Number(result?.seconds) || 0,
    result?.source || '',
    result?.meetName || ''
  ].join('|');
}

function practiceIdentity(practice) {
  return String(practice?.id || `${practice?.date || ''}|${practice?.rosterId || 'all'}`);
}

function mergeSettings(remoteSettings, localSettings) {
  const remote = objectOrEmpty(remoteSettings);
  const local = objectOrEmpty(localSettings);
  const merged = {
    ...remote,
    ...local,
    aiScope: {
      ...objectOrEmpty(remote.aiScope),
      ...objectOrEmpty(local.aiScope)
    }
  };
  for (const key of ['teamName', 'season', 'coachName']) {
    if (!String(local[key] ?? '').trim() && String(remote[key] ?? '').trim()) merged[key] = remote[key];
  }
  return merged;
}

export function mergeStates(remoteInput, localInput) {
  const remote = normalizeState(remoteInput);
  const local = normalizeState(localInput);
  const tombstones = mergeTombstones(remote.tombstones, local.tombstones);

  const athletes = [];
  const athleteByName = new Map();
  const athleteById = new Map();
  const idRemap = new Map();

  const addAthlete = (candidate, preferIncomingOnTie) => {
    const copy = { ...candidate };
    const nameKey = normalizeName(copy.name);
    const existing = (copy.id && athleteById.get(copy.id)) || (nameKey && athleteByName.get(nameKey));
    if (existing) {
      const merged = chooseNewest(existing, copy, preferIncomingOnTie);
      const canonicalId = existing.id || copy.id || `athlete_${slug(merged.name)}`;
      Object.assign(existing, merged, { id: canonicalId });
      if (copy.id) idRemap.set(copy.id, canonicalId);
      athleteById.set(canonicalId, existing);
      if (nameKey) athleteByName.set(nameKey, existing);
      return;
    }
    copy.id = copy.id || `athlete_${slug(copy.name)}`;
    athletes.push(copy);
    athleteById.set(copy.id, copy);
    if (nameKey) athleteByName.set(nameKey, copy);
    idRemap.set(copy.id, copy.id);
  };

  remote.athletes.forEach((row) => addAthlete(row, false));
  local.athletes.forEach((row) => addAthlete(row, true));

  const survivingAthletes = athletes.filter((athlete) => {
    const byId = isDeleted(tombstones.athletes, athlete.id, athlete);
    const byName = isDeleted(tombstones.athletes, `name:${normalizeName(athlete.name)}`, athlete);
    return !byId && !byName;
  });
  const survivingIds = new Set(survivingAthletes.map((athlete) => athlete.id));
  const remapAthleteId = (id) => idRemap.get(id) || id;

  const resultsMap = new Map();
  const addResult = (candidate, preferIncomingOnTie) => {
    const copy = { ...candidate, athleteId: remapAthleteId(candidate.athleteId) };
    const key = resultIdentity(copy);
    const merged = chooseNewest(resultsMap.get(key), copy, preferIncomingOnTie);
    if (merged) resultsMap.set(key, merged);
  };
  remote.results.forEach((row) => addResult(row, false));
  local.results.forEach((row) => addResult(row, true));

  const results = [...resultsMap.entries()]
    .filter(([key, result]) => {
      if (isDeleted(tombstones.results, key, result)) return false;
      if (result.id && isDeleted(tombstones.results, result.id, result)) return false;
      return !result.athleteId || survivingIds.has(result.athleteId);
    })
    .map(([, result]) => result);

  const attendance = {};
  const mergeAttendance = (source) => {
    Object.entries(objectOrEmpty(source)).forEach(([date, day]) => {
      attendance[date] ||= {};
      Object.entries(objectOrEmpty(day)).forEach(([athleteId, status]) => {
        const mappedId = remapAthleteId(athleteId);
        if (survivingIds.has(mappedId)) attendance[date][mappedId] = status;
      });
    });
  };
  mergeAttendance(remote.attendance);
  mergeAttendance(local.attendance);

  const practicesMap = new Map();
  const addPractice = (candidate, preferIncomingOnTie) => {
    const copy = normalizePractice(candidate);
    const key = practiceIdentity(copy);
    practicesMap.set(key, chooseNewest(practicesMap.get(key), copy, preferIncomingOnTie));
  };
  remote.practices.forEach((row) => addPractice(row, false));
  local.practices.forEach((row) => addPractice(row, true));
  const practices = [...practicesMap.entries()]
    .filter(([key, practice]) => !isDeleted(tombstones.practices, key, practice))
    .map(([, practice]) => practice);

  return normalizeState({
    ...remote,
    ...local,
    version: STORAGE_SCHEMA_VERSION,
    settings: mergeSettings(remote.settings, local.settings),
    athletes: survivingAthletes,
    results,
    attendance,
    practices,
    rosterAssignments: {
      ...remote.rosterAssignments,
      ...local.rosterAssignments
    },
    customDistances: [
      ...new Set([...remote.customDistances, ...local.customDistances])
    ],
    tombstones
  });
}

export function markDeleted(stateInput, bucket, key, deletedAtMs = Date.now()) {
  const state = normalizeState(stateInput);
  if (!['athletes', 'results', 'practices'].includes(bucket)) return state;
  state.tombstones[bucket][key] = Math.max(
    Number(state.tombstones[bucket][key]) || 0,
    Number(deletedAtMs) || Date.now()
  );
  return state;
}

export function resultKey(result) {
  return resultIdentity(result);
}

export function practiceKey(practice) {
  return practiceIdentity(practice);
}
