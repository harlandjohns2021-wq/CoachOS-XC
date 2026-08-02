const XC_SEASON_RESET_APPLIED = (() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const LEGACY_KEY = 'coachos_xc_v1';
  const RESET_KEY = 'xccommand_season_reset_2026_08_01_v1';
  const BACKUP_KEY = 'xccommand_backup_before_2026_08_01_reset';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const TEAM_KEY = 'xccommand_team_assignments_v1';
  const SELECTED_TEAM_KEY = 'xccommand_selected_practice_team_v1';

  if (localStorage.getItem(RESET_KEY)) return false;

  const highSchool = [
    ['Tony Hernandez', '6:05'],
    ['Chris Jimnez', ''],
    ['Yaretzi Prado', ''],
    ['Claire Scoggins', '7:00'],
    ['Julian Garcia', ''],
    ['Molly Bloomer', '8:04'],
    ['Paisley Bloomer', '8:14'],
    ['Daena Salazar', '7:31'],
    ['Delainy Torres', '8:32'],
    ['Ivan Olvera', '6:50'],
    ['Lukas Marshall', '6:23'],
    ['Bianca Aguilar', '8:42'],
    ['Aaron Klump', '6:50'],
    ['Gerardo Hernandez', ''],
    ['Katherine Orsorto', ''],
    ['Jackie Arellano', ''],
    ['Jesus Cordova', '']
  ];

  const juniorHigh = [
    ['Cynthia Hernandez', ''],
    ['Nicole Hernandez', '8:18'],
    ['Lia Ayala', '9:09'],
    ['Abel Green', '5:47'],
    ['Aiden Green', '7:51'],
    ['Isaac Ates', ''],
    ['Conner Shumate', '11:00'],
    ['Julian Wario', ''],
    ['McKaelah Segura', ''],
    ['Miranda Lierra', ''],
    ['AJ Green', '8:41'],
    ['Tess Scoggins', '8:31'],
    ['Kynlee Cheek', '10:41'],
    ['Jaelle Rocha', '9:24'],
    ['Sumaya Romero', '9:01'],
    ['Aliyah Torres', '8:00'],
    ['Emmett Thomas', '8:55'],
    ['Zachary Dunn', '8:00'],
    ['Martin Williams', '8:57'],
    ['Roan Clark', '6:38'],
    ['Jameson Nichols', '9:15']
  ];

  function safeJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function slug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function seconds(value) {
    if (!value) return null;
    const [minutes, secs] = value.split(':').map(Number);
    return Number.isFinite(minutes) && Number.isFinite(secs)
      ? minutes * 60 + secs
      : null;
  }

  const previous = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (previous && !localStorage.getItem(BACKUP_KEY)) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(previous));
  }

  const priorSettings = previous?.settings && typeof previous.settings === 'object'
    ? previous.settings
    : {};

  const createdAt = '2026-08-01T19:11:00.000Z';
  const athletes = [];
  const results = [];

  function addRoster(rows, level) {
    rows.forEach(([name, time]) => {
      const athleteId = `${level === 'HS' ? 'hs' : 'jh'}_${slug(name)}`;
      athletes.push({
        id: athleteId,
        name,
        sex: 'Unassigned',
        grade: level,
        teamId: 'all',
        active: true,
        createdAt
      });

      const totalSeconds = seconds(time);
      if (totalSeconds == null) return;
      results.push({
        id: `baseline_${athleteId}`,
        athleteId,
        distance: '1 Mile',
        seconds: totalSeconds,
        date: '2026-08-01',
        source: 'Practice',
        meetName: 'Aug. 1 Mile Benchmark',
        isPR: true,
        createdAt
      });
    });
  }

  addRoster(highSchool, 'HS');
  addRoster(juniorHigh, 'JH');

  const nextState = {
    version: 3,
    settings: {
      teamName: priorSettings.teamName || 'Harts Bluff XC',
      season: '2026 XC',
      coachName: priorSettings.coachName || '',
      aiRole: priorSettings.aiRole || 'head_coach',
      aiAthleteDetail: priorSettings.aiAthleteDetail || 'team_only',
      aiScope: {
        teamTrends: priorSettings.aiScope?.teamTrends ?? true,
        athleteTrends: priorSettings.aiScope?.athleteTrends ?? true,
        workloadBalance: priorSettings.aiScope?.workloadBalance ?? true,
        raceReadiness: priorSettings.aiScope?.raceReadiness ?? true,
        coachQueries: priorSettings.aiScope?.coachQueries ?? true
      }
    },
    athletes,
    results,
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

  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(PRACTICE_KEY);
  localStorage.removeItem(TEAM_KEY);
  localStorage.removeItem(SELECTED_TEAM_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  localStorage.setItem(RESET_KEY, JSON.stringify({
    appliedAt: new Date().toISOString(),
    athletes: athletes.length,
    results: results.length
  }));

  window.location.reload();
  return true;
})();

if (!XC_SEASON_RESET_APPLIED) {
  import('./app-modules.js').catch((error) => {
    console.error('XC Command application modules failed to load.', error);
  });
}
