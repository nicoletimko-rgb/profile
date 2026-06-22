/* ============================================================
   BTA SPORTS — DEMO DATA
   Mock data modeled on the real app screens. American odds +
   BTA model probabilities. "Edge" = BTA win prob − implied
   market prob; the whole demo is built around surfacing edge.
   ============================================================ */

/* ---------- odds helpers ---------- */
// American odds -> implied probability (0..1)
function impliedProb(odds) {
  return odds < 0 ? (-odds) / (-odds + 100) : 100 / (odds + 100);
}
// probability (0..1) -> fair American odds
function probToAmerican(p) {
  p = Math.min(0.985, Math.max(0.015, p));
  return p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);
}
function fmtOdds(o) { return o > 0 ? '+' + o : '' + o; }
// combine a list of probabilities (independent) -> parlay prob
function parlayProb(ps) { return ps.reduce((a, p) => a * p, 1); }

const USER = { name: 'Charlie', initial: 'C' };

/* ---------- teams (colors drive the gradient game cards) ---------- */
const TEAMS = {
  MIA: { name: 'Marlins',   city: 'Miami',        c1: '#00a3e0', c2: '#0477bf' },
  PHI: { name: 'Phillies',  city: 'Philadelphia', c1: '#e81828', c2: '#a4131f' },
  KC:  { name: 'Royals',    city: 'Kansas City',  c1: '#004687', c2: '#0a2f54' },
  WAS: { name: 'Nationals', city: 'Washington',   c1: '#ab0003', c2: '#7a0002' },
  TOR: { name: 'Blue Jays', city: 'Toronto',      c1: '#134a8e', c2: '#1d2d5c' },
  BOS: { name: 'Red Sox',   city: 'Boston',       c1: '#bd3039', c2: '#7d1f25' },
  CWS: { name: 'White Sox', city: 'Chicago',      c1: '#27251f', c2: '#0d0d0d' },
  NYY: { name: 'Yankees',   city: 'New York',     c1: '#0c2340', c2: '#152a47' },
  NYM: { name: 'Mets',      city: 'New York',     c1: '#002d72', c2: '#ff5910' },
  CIN: { name: 'Reds',      city: 'Cincinnati',   c1: '#c6011f', c2: '#7d0413' },
  SF:  { name: 'Giants',    city: 'San Francisco',c1: '#fd5a1e', c2: '#b23a12' },
  ATL: { name: 'Braves',    city: 'Atlanta',      c1: '#ce1141', c2: '#13274f' },
  CHC: { name: 'Cubs',      city: 'Chicago',      c1: '#0e3386', c2: '#cc3433' },
  ARI: { name: 'D-backs',   city: 'Arizona',      c1: '#a71930', c2: '#5c1320' },
  // FIFA
  FRA: { name: 'France',    city: 'FRA', c1: '#1d3faa', c2: '#13265f' },
  SEN: { name: 'Senegal',   city: 'SEN', c1: '#159b62', c2: '#0c6b43' },
  IRQ: { name: 'Iraq',      city: 'IRQ', c1: '#1f8a4c', c2: '#0f5e32' },
  NOR: { name: 'Norway',    city: 'NOR', c1: '#c8102e', c2: '#7d0a1d' },
  ARG: { name: 'Argentina', city: 'ARG', c1: '#6cace4', c2: '#2f6fb0' },
  DZA: { name: 'Algeria',   city: 'DZA', c1: '#0a7d3e', c2: '#06542a' },
};

/* ---------- games (MLB + FIFA) ----------
   Each market carries BTA model prob + market American odds for
   both sides; edge is derived live in the UI. */
const GAMES = {
  MLB: [
    {
      id: 'mia-phi', away: 'MIA', home: 'PHI', time: '6:40 PM', day: 'TODAY',
      btaRunLine: 'PHI -1.5', btaOU: 9.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.5302, odds: 146 }, home: { btaProb: 0.4698, odds: -174 } },
        runline:   { line: 1.5, away: { btaProb: 0.6218, odds: -160 }, home: { btaProb: 0.3782, odds: 124 } },
        total:     { line: 9.5, under: { btaProb: 0.55, odds: -205 }, over: { btaProb: 0.45, odds: 158 } },
      },
    },
    {
      id: 'kc-was', away: 'KC', home: 'WAS', time: '6:45 PM', day: 'TODAY',
      btaRunLine: 'KC -1.5', btaOU: 8.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.5810, odds: -128 }, home: { btaProb: 0.4190, odds: 118 } },
        runline:   { line: 1.5, away: { btaProb: 0.3640, odds: 135 }, home: { btaProb: 0.6360, odds: -165 } },
        total:     { line: 8.5, under: { btaProb: 0.5210, odds: -115 }, over: { btaProb: 0.4790, odds: -105 } },
      },
    },
    {
      id: 'tor-bos', away: 'TOR', home: 'BOS', time: '6:45 PM', day: 'TODAY',
      btaRunLine: 'BOS -1.5', btaOU: 9.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.4710, odds: 120 }, home: { btaProb: 0.5290, odds: -142 } },
        runline:   { line: 1.5, away: { btaProb: 0.6680, odds: -190 }, home: { btaProb: 0.3320, odds: 158 } },
        total:     { line: 9.5, under: { btaProb: 0.4880, odds: -110 }, over: { btaProb: 0.5120, odds: -110 } },
      },
    },
    {
      id: 'cws-nyy', away: 'CWS', home: 'NYY', time: '7:05 PM', day: 'TODAY',
      btaRunLine: 'NYY -1.5', btaOU: 8.0, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.3380, odds: 188 }, home: { btaProb: 0.6620, odds: -224 } },
        runline:   { line: 1.5, away: { btaProb: 0.5510, odds: -120 }, home: { btaProb: 0.4490, odds: 100 } },
        total:     { line: 8.0, under: { btaProb: 0.5640, odds: -130 }, over: { btaProb: 0.4360, odds: 110 } },
      },
    },
    {
      id: 'nym-cin', away: 'NYM', home: 'CIN', time: '7:10 PM', day: 'TODAY',
      btaRunLine: 'NYM -1.5', btaOU: 9.0, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.5560, odds: -118 }, home: { btaProb: 0.4440, odds: 108 } },
        runline:   { line: 1.5, away: { btaProb: 0.3410, odds: 142 }, home: { btaProb: 0.6590, odds: -172 } },
        total:     { line: 9.0, under: { btaProb: 0.4690, odds: 104 }, over: { btaProb: 0.5310, odds: -124 } },
      },
    },
    {
      id: 'sf-atl', away: 'SF', home: 'ATL', time: '7:15 PM', day: 'TODAY',
      btaRunLine: 'ATL -1.5', btaOU: 8.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.4520, odds: 126 }, home: { btaProb: 0.5480, odds: -150 } },
        runline:   { line: 1.5, away: { btaProb: 0.6610, odds: -185 }, home: { btaProb: 0.3390, odds: 152 } },
        total:     { line: 8.5, under: { btaProb: 0.5080, odds: -108 }, over: { btaProb: 0.4920, odds: -112 } },
      },
    },
  ],
  FIFA: [
    {
      id: 'fra-sen', away: 'FRA', home: 'SEN', time: '3:00 PM', day: 'TODAY',
      btaRunLine: 'FRA -0.5', btaOU: 2.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.4937, odds: -220 }, home: { btaProb: 0.2426, odds: 600 }, draw: { btaProb: 0.2637, odds: 360 } },
        runline:   { line: 0.5, away: { btaProb: 0.6240, odds: -150 }, home: { btaProb: 0.3760, odds: 124 } },
        total:     { line: 2.5, under: { btaProb: 0.5390, odds: -120 }, over: { btaProb: 0.4610, odds: 100 } },
      },
    },
    {
      id: 'irq-nor', away: 'IRQ', home: 'NOR', time: '6:00 PM', day: 'TODAY',
      btaRunLine: 'NOR -0.5', btaOU: 2.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.2210, odds: 410 }, home: { btaProb: 0.5560, odds: -180 }, draw: { btaProb: 0.2230, odds: 300 } },
        runline:   { line: 0.5, away: { btaProb: 0.4180, odds: 110 }, home: { btaProb: 0.5820, odds: -135 } },
        total:     { line: 2.5, under: { btaProb: 0.4720, odds: 104 }, over: { btaProb: 0.5280, odds: -122 } },
      },
    },
    {
      id: 'arg-dza', away: 'ARG', home: 'DZA', time: '9:00 PM', day: 'TODAY',
      btaRunLine: 'ARG -1.5', btaOU: 3.5, status: 'PRE',
      markets: {
        moneyline: { away: { btaProb: 0.7120, odds: -320 }, home: { btaProb: 0.1380, odds: 850 }, draw: { btaProb: 0.1500, odds: 480 } },
        runline:   { line: 1.5, away: { btaProb: 0.5410, odds: -125 }, home: { btaProb: 0.4590, odds: 105 } },
        total:     { line: 3.5, under: { btaProb: 0.5120, odds: -110 }, over: { btaProb: 0.4880, odds: -110 } },
      },
    },
  ],
  NFL: [], // season countdown screen handles NFL
};

/* ---------- player props (modeled on the real app) ---------- */
const PROPS = {
  MLB: [
    {
      id: 'bohm', name: 'Alec Bohm', team: 'PHI', match: 'vs MIA', time: '06/16 @ 6:40PM',
      lines: [
        { stat: 'Hits',      line: 0.5, over: { btaProb: 0.5590, odds: -240 }, under: { btaProb: 0.4410, odds: null } },
        { stat: 'Home Runs', line: 0.5, over: { btaProb: 0.1088, odds: 920 }, under: { btaProb: 0.8912, odds: null } },
        { stat: 'RBIs',      line: 0.5, over: { btaProb: 0.3400, odds: 155 }, under: { btaProb: 0.6600, odds: null } },
        { stat: 'Runs',      line: 0.5, over: { btaProb: 0.3820, odds: 138 }, under: { btaProb: 0.6180, odds: null } },
      ],
    },
    {
      id: 'luzardo', name: 'Jesús Luzardo', team: 'PHI', match: 'vs MIA', time: '06/16 @ 6:40PM',
      lines: [
        { stat: 'Strikeouts', line: 6.5, over: { btaProb: 0.3182, odds: -102 }, under: { btaProb: 0.6817, odds: -122 } },
        { stat: 'Earned Runs', line: 2.5, over: { btaProb: 0.4410, odds: 118 }, under: { btaProb: 0.5590, odds: -140 } },
        { stat: 'Hits Allowed', line: 5.5, over: { btaProb: 0.4880, odds: -105 }, under: { btaProb: 0.5120, odds: -115 } },
      ],
    },
    {
      id: 'judge', name: 'Aaron Judge', team: 'NYY', match: 'vs CWS', time: '06/16 @ 7:05PM',
      lines: [
        { stat: 'Hits',         line: 0.5, over: { btaProb: 0.6410, odds: -280 }, under: { btaProb: 0.3590, odds: null } },
        { stat: 'Home Runs',    line: 0.5, over: { btaProb: 0.2240, odds: 320 }, under: { btaProb: 0.7760, odds: null } },
        { stat: 'Total Bases',  line: 1.5, over: { btaProb: 0.5520, odds: -135 }, under: { btaProb: 0.4480, odds: 115 } },
        { stat: 'RBIs',         line: 0.5, over: { btaProb: 0.4710, odds: 122 }, under: { btaProb: 0.5290, odds: -148 } },
      ],
    },
    {
      id: 'soto', name: 'Juan Soto', team: 'NYM', match: 'vs CIN', time: '06/16 @ 7:10PM',
      lines: [
        { stat: 'Hits',        line: 0.5, over: { btaProb: 0.6120, odds: -210 }, under: { btaProb: 0.3880, odds: null } },
        { stat: 'Walks',       line: 0.5, over: { btaProb: 0.5840, odds: -160 }, under: { btaProb: 0.4160, odds: 130 } },
        { stat: 'Total Bases', line: 1.5, over: { btaProb: 0.5010, odds: -110 }, under: { btaProb: 0.4990, odds: -110 } },
      ],
    },
  ],
  FIFA: [
    {
      id: 'mbappe', name: 'Kylian Mbappé', team: 'FRA', match: 'vs SEN', time: '06/16 @ 3:00PM',
      lines: [
        { stat: 'Anytime Goal', line: 0.5, over: { btaProb: 0.5840, odds: -120 }, under: { btaProb: 0.4160, odds: 100 } },
        { stat: 'Shots on Target', line: 1.5, over: { btaProb: 0.6210, odds: -150 }, under: { btaProb: 0.3790, odds: 125 } },
        { stat: 'Assists', line: 0.5, over: { btaProb: 0.3120, odds: 180 }, under: { btaProb: 0.6880, odds: -220 } },
      ],
    },
    {
      id: 'seck', name: 'Abdoulaye Seck', team: 'SEN', match: 'vs FRA', time: '06/16 @ 3:00PM',
      lines: [
        { stat: 'Player Assists', line: 0.5, over: { btaProb: 0.0709, odds: 2200 }, under: { btaProb: 0.9291, odds: null } },
        { stat: 'Goal Anytime',   line: 0.5, over: { btaProb: 0.0799, odds: 2000 }, under: { btaProb: 0.9201, odds: null } },
      ],
    },
  ],
};

/* ---------- Fantasy IQ — DFS pool (DraftKings classic MLB) ---------- */
const DFS = {
  site: 'DraftKings', sport: 'MLB', cap: 50000, slots: 8,
  // simplified DK classic build (2 P + 6 hitters). Salaries tuned so a
  // strong all-stud lineup is feasible at ~$49.4k — the optimizer should find it.
  positions: ['P', 'P', 'C', '1B', 'OF', 'OF', 'SS', 'OF'],
  pool: [
    { pos: 'P',  name: 'Tarik Skubal',     team: 'DET', salary: 9800, proj: 22.4 },
    { pos: 'P',  name: 'Zack Wheeler',     team: 'PHI', salary: 9000, proj: 20.8 },
    { pos: 'P',  name: 'Jesús Luzardo',    team: 'PHI', salary: 7600, proj: 17.1 },
    { pos: 'P',  name: 'Dylan Cease',      team: 'SD',  salary: 7000, proj: 15.8 },
    { pos: 'C',  name: 'William Contreras',team: 'MIL', salary: 4200, proj: 9.3 },
    { pos: 'C',  name: 'J.T. Realmuto',    team: 'PHI', salary: 3800, proj: 8.4 },
    { pos: '1B', name: 'Bryce Harper',     team: 'PHI', salary: 5000, proj: 10.9 },
    { pos: '1B', name: 'Vladimir Guerrero',team: 'TOR', salary: 4800, proj: 10.2 },
    { pos: '1B', name: 'Matt Olson',       team: 'ATL', salary: 4400, proj: 9.6 },
    { pos: 'OF', name: 'Aaron Judge',      team: 'NYY', salary: 5600, proj: 12.8 },
    { pos: 'OF', name: 'Juan Soto',        team: 'NYM', salary: 5400, proj: 11.6 },
    { pos: 'OF', name: 'Kyle Tucker',      team: 'CHC', salary: 5000, proj: 10.7 },
    { pos: 'OF', name: 'Corbin Carroll',   team: 'ARI', salary: 4600, proj: 9.8 },
    { pos: 'OF', name: 'Luis Robert Jr.',  team: 'CWS', salary: 4200, proj: 8.9 },
    { pos: 'SS', name: 'Bobby Witt Jr.',   team: 'KC',  salary: 5400, proj: 12.2 },
    { pos: 'SS', name: 'Gunnar Henderson', team: 'BAL', salary: 5000, proj: 11.1 },
    { pos: 'SS', name: 'Elly De La Cruz',  team: 'CIN', salary: 4800, proj: 10.6 },
  ],
};

/* ---------- best bets ticker (Bloomberg style) ----------
   Built live in app.js from every market's edge, but we keep a
   couple of hand-curated "lead" plays here for flavor. */
const FEATURED_PICKS = [
  { tag: 'TOP EDGE', label: 'CWS/NYY Under 8.0', sub: 'Total Runs', btaProb: 0.5640, odds: -130, sport: 'MLB' },
  { tag: 'VALUE',    label: 'KC Moneyline',      sub: 'Royals ML',  btaProb: 0.5810, odds: -128, sport: 'MLB' },
  { tag: 'LONGSHOT', label: 'Judge HR',          sub: 'Over 0.5',   btaProb: 0.2240, odds: 320,  sport: 'MLB' },
];
