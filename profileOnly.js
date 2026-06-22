/* ============================================================
   BTA SPORTS — APP PROTOTYPE · interactions & rendering
   Pure vanilla JS. Renders every screen from data.js and wires
   the live ticker, Move-the-Line, Risk card and Fantasy IQ.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- odds math ---------- */
  const americanToDecimal = o => o > 0 ? 1 + o / 100 : 1 + 100 / (-o);
  const decimalToAmerican = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : '-' + Math.round(100 / (d - 1));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pct = p => (p * 100).toFixed(2) + '%';
  const pct1 = p => (p * 100).toFixed(1) + '%';
  const edgeOf = side => side.btaProb - impliedProb(side.odds); // points (0..1)

  /* ---------- app state ---------- */
  // like st.session_state in streamlit 
  // ex: state.card.push(newBet) -> Risk Analyzer has another bet
  const state = {
    view: 'profile',
    sport: 'MLB',
    analyzerGameId: 'mia-phi',
    card: [],            // risk analyzer legs
    fantasy: null,       // lineup slots
    audioTimer: null,
  };

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const teamGrad = (away, home) => {
    const a = TEAMS[away], h = TEAMS[home];
    return `background:linear-gradient(100deg, ${a.c1} 0%, ${a.c2} 34%, ${h.c1} 66%, ${h.c2} 100%)`;
  };
  const teamSolid = abbr => { const t = TEAMS[abbr]; return `background:linear-gradient(135deg, ${t.c1}, ${t.c2})`; };

  /* ---------- collect every betable side with its edge ---------- */
  function allEdges() {
    const out = [];
    Object.keys(GAMES).forEach(sport => GAMES[sport].forEach(g => {
      const push = (name, sub, side, odds) => { if (odds == null) return; out.push({ sport, gid: g.id, name, sub, btaProb: side.btaProb, odds, edge: side.btaProb - impliedProb(odds) }); };
      const m = g.markets;
      push(`${g.away} ML`, `${TEAMS[g.away].city} moneyline`, m.moneyline.away, m.moneyline.away.odds);
      push(`${g.home} ML`, `${TEAMS[g.home].city} moneyline`, m.moneyline.home, m.moneyline.home.odds);
      if (m.runline) {
        push(`${g.away} ${m.runline.line > 0 ? '+' : ''}${m.runline.line}`, `${g.away}/${g.home} spread`, m.runline.away, m.runline.away.odds);
        push(`${g.home} -${m.runline.line}`, `${g.away}/${g.home} spread`, m.runline.home, m.runline.home.odds);
      }
      if (m.total) {
        push(`${g.away}/${g.home} U${m.total.line}`, 'Total under', m.total.under, m.total.under.odds);
        push(`${g.away}/${g.home} O${m.total.line}`, 'Total over', m.total.over, m.total.over.odds);
      }
    }));
    Object.keys(PROPS).forEach(sport => PROPS[sport].forEach(p => p.lines.forEach(l => {
      if (l.over.odds != null) out.push({ sport, name: `${p.name.split(' ').pop()} O${l.line} ${l.stat}`, sub: `${p.name} · ${l.stat}`, btaProb: l.over.btaProb, odds: l.over.odds, edge: l.over.btaProb - impliedProb(l.over.odds) });
    })));
    return out;
  }

  /* ============================================================
     BLOOMBERG-STYLE EDGE TICKER
     ============================================================ */
  function buildTicker() {
    const edges = allEdges().filter(e => e.edge > 0).sort((a, b) => b.edge - a.edge);
    const top = edges.slice(0, 18);
    const track = $('#tickerTrack');
    // big move -> green; small move -> grey. Always a filled triangle.
    const render = e => {
      const big = e.edge >= 0.03;
      const cls = big ? 'up' : 'flat';
      return `<span class="tick"><span class="pos ${big ? '' : 'flat'}"></span><b>${e.name}</b>
        <span class="edge ${cls}"><span class="tri">▲</span>${(e.edge * 100).toFixed(1)}%</span>
        <span class="od">${fmtOdds(e.odds)}</span></span>`;
    };
    const half = top.map(render).join('');
    track.innerHTML = half + half; // duplicate for seamless -50% loop
  }

  /* ============================================================
     CLOCK + GREETING
     ============================================================ */
  function greetingWord(h) {
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 22) return 'evening';
    return 'night';
  }
  function tickClock() {
    const now = new Date();
    let h = now.getHours(); const m = now.getMinutes();
    const hh = ((h + 11) % 12) + 1;
    $('#sbTime').textContent = `${hh}:${String(m).padStart(2, '0')}`;
  }

  /* ============================================================
     VIEW: HOME / DASHBOARD
     ============================================================ */
  function renderHome() {
    const v = $('#view-home');
    const now = new Date();
    const word = greetingWord(now.getHours());
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const edges = allEdges().filter(e => e.edge > 0).sort((a, b) => b.edge - a.edge);
    const top = edges.slice(0, 5);
    const avgEdge = top.reduce((s, e) => s + e.edge, 0) / top.length;
    const bestProb = Math.round(edges[0].btaProb * 100);
    const liveCount = GAMES.MLB.length + GAMES.FIFA.length;

    // confidence gauge angle
    const gaugeDeg = Math.round(bestProb / 100 * 360);

    v.innerHTML = `
      <div class="greet">
        <div class="hello">Good ${word}, <span class="wave">👋</span></div>
        <h1>Welcome back, <em>${USER.name}.</em></h1>
        <div class="date">${dateStr} · ${liveCount} games on today's board</div>
      </div>

      <div class="edge-hero glass">
        <div class="eh-top">
          <span class="eh-label">Today's Top Edge</span>
          <span class="eh-chip">▲ Model vs. Market</span>
        </div>
        <div class="eh-body">
          <div class="eh-gauge" style="background:conic-gradient(var(--accent-light) ${gaugeDeg}deg, rgba(255,255,255,0.08) ${gaugeDeg}deg)">
            <div class="g-val"><span class="g-num">${bestProb}%</span><span class="g-sub">Win Prob</span></div>
          </div>
          <div class="eh-meta">
            <h3>${edges[0].name}</h3>
            <p>${edges[0].sub} — BTA gives this <b style="color:#fff">+${(edges[0].edge * 100).toFixed(1)} pts</b>
            of edge over the ${fmtOdds(edges[0].odds)} market price.</p>
          </div>
        </div>
      </div>

      <div class="qstats">
        <div class="qstat glass"><div class="qn">${liveCount}</div><div class="ql">Games today</div></div>
        <div class="qstat glass"><div class="qn yel">+${(avgEdge * 100).toFixed(1)}</div><div class="ql">Avg top-5 edge</div></div>
        <div class="qstat glass"><div class="qn">${edges.length}</div><div class="ql">+EV plays found</div></div>
      </div>

      <div class="sec-head"><h2>Top picks for you</h2><span class="more" data-go="games">All games ›</span></div>
      <div id="homePicks"></div>

      <div class="sec-head"><h2>Featured slate</h2><span class="more" data-go="games">Open ›</span></div>
      <div id="homeGames"></div>
    `;

    const picks = $('#homePicks');
    top.forEach((e, i) => {
      const row = el('div', 'pick glass');
      row.innerHTML = `
        <div class="pk-rank">${i + 1}</div>
        <div class="pk-main"><div class="pk-name">${e.name}</div><div class="pk-sub">${e.sub} · ${e.sport}</div></div>
        <div class="pk-edge"><div class="pe-n">+${(e.edge * 100).toFixed(1)}</div><div class="pe-l">Edge</div></div>
        <div class="pk-od">${fmtOdds(e.odds)}</div>`;
      row.addEventListener('click', () => addLeg({ id: 'pk' + i, team: e.name.split(' ')[0], name: e.name, sub: e.sub, odds: e.odds, btaProb: e.btaProb }, 'Added to Risk Analyzer'));
      picks.appendChild(row);
    });

    const gm = $('#homeGames');
    GAMES.MLB.slice(0, 3).forEach(g => gm.appendChild(gameCard(g)));

    v.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
  }

  /* ============================================================
     GAME CARD (shared by Home + Games)
     ============================================================ */
  function gameCard(g) {
    const m = g.markets.moneyline;
    const aw = Math.round(m.away.btaProb * 100), hm = 100 - aw;
    const bestEdge = Math.max(edgeOf(m.away), edgeOf(m.home));
    const card = el('div', 'game-card');
    card.innerHTML = `
      <div class="gc-grad" style="${teamGrad(g.away, g.home)}">
        ${bestEdge > 0.03 ? `<span class="gc-edge-pill">▲ ${(bestEdge * 100).toFixed(1)}% edge</span>` : ''}
        <div class="gc-side away"><div class="gc-team">${g.away}</div><div class="gc-rec">${TEAMS[g.away].city}</div></div>
        <div class="gc-mid"><div class="gc-time">${g.time}</div><div class="gc-vs">${g.day}</div></div>
        <div class="gc-side home"><div class="gc-team">${g.home}</div><div class="gc-rec">${TEAMS[g.home].city}</div></div>
      </div>
      <div class="gc-foot">
        <span class="gc-pct away">${aw}%</span>
        <span class="gc-bar"><span class="ba" style="width:${aw}%"></span><span class="bh" style="width:${hm}%"></span></span>
        <span class="gc-pct home">${hm}%</span>
      </div>`;
    card.addEventListener('click', () => openAnalyzer(g.id));
    return card;
  }

  /* ============================================================
     VIEW: GAMES
     ============================================================ */
  function renderGames() {
    const v = $('#view-games');
    v.innerHTML = `
      <div class="page-title-row"><div class="page-title">GAMES</div></div>
      <div class="sport-tabs" id="gamesSportTabs"></div>
      <div class="book-row glass">
        <span class="bk-l"><span class="bk-logo" style="background:#1493ff">FD</span> FanDuel</span>
        <span class="bk-r">Exportable Betslip</span>
      </div>
      <div id="gamesList"></div>`;
    sportTabs($('#gamesSportTabs'), s => { state.sport = s; renderGames(); });

    const list = $('#gamesList');
    if (state.sport === 'NFL') { list.appendChild(nflCountdown()); return; }
    const games = GAMES[state.sport];
    let lastDay = null;
    games.forEach(g => {
      if (g.day !== lastDay) { list.appendChild(el('div', 'day-label', g.day)); lastDay = g.day; }
      list.appendChild(gameCard(g));
    });
  }

  function sportTabs(container, onPick) {
    ['MLB', 'NFL', 'FIFA'].forEach(s => {
      const b = el('button', 'sport-tab' + (s === state.sport ? ' active' : ''), s);
      b.addEventListener('click', () => onPick(s));
      container.appendChild(b);
    });
  }

  function nflCountdown() {
    const kickoff = new Date('2026-09-10T13:00:00');
    const diff = Math.max(0, kickoff - new Date());
    const d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), mi = Math.floor(diff % 36e5 / 6e4);
    const wrap = el('div', 'countdown');
    wrap.innerHTML = `
      <div class="cd-eyebrow">The NFL season</div>
      <h2>STARTS IN</h2>
      <div class="cd-grid">
        <div class="cd-unit"><div class="cd-num">${d}</div><div class="cd-lab">Days</div></div>
        <div class="cd-sep">:</div>
        <div class="cd-unit"><div class="cd-num">${h}</div><div class="cd-lab">Hours</div></div>
        <div class="cd-sep">:</div>
        <div class="cd-unit"><div class="cd-num">${mi}</div><div class="cd-lab">Minutes</div></div>
      </div>
      <div class="cd-foot">📅 Season kicks off <b>September 10, 2026</b></div>`;
    return wrap;
  }

  /* ============================================================
     VIEW: GAME ANALYZER  (with live Move-the-Line)
     ============================================================ */
  function openAnalyzer(gid) { state.analyzerGameId = gid; navigate('analyzer'); }

  function findGame(gid) {
    for (const s of Object.keys(GAMES)) { const g = GAMES[s].find(x => x.id === gid); if (g) return { g, sport: s }; }
    return { g: GAMES.MLB[0], sport: 'MLB' };
  }

  function renderAnalyzer() {
    const v = $('#view-analyzer');
    const { g } = findGame(state.analyzerGameId);
    const m = g.markets;
    const isSoccer = !!m.moneyline.draw;

    v.innerHTML = `
      <div class="page-title-row"><div class="page-title">ANALYZER</div></div>

      <div class="analyzer-hero">
        <div class="ah-grad" style="${teamGrad(g.away, g.home)}"></div>
        <div class="ah-row">
          <div class="ah-team"><div class="ah-abbr">${g.away}</div><div class="ah-city">${TEAMS[g.away].city}</div></div>
          <div class="ah-mid"><div class="ah-vs">@</div><div class="ah-time">${g.time}</div></div>
          <div class="ah-team"><div class="ah-abbr">${g.home}</div><div class="ah-city">${TEAMS[g.home].city}</div></div>
        </div>
        <div class="ah-lines">
          <span class="ah-line-chip">BTA Line <b>${g.btaRunLine}</b></span>
          <span class="ah-line-chip">BTA O/U <b>${g.btaOU}</b></span>
          <span class="ah-line-chip">FanDuel Markets</span>
        </div>
      </div>

      <div class="bet-audio glass" id="betAudio">
        <button class="ba-play" id="baPlay" aria-label="Play AI bet analysis">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>
        </button>
        <div class="ba-mid">
          <div class="ba-title">AI Bet Analysis</div>
          <div class="ba-by">Powered by <b>Vokal</b></div>
          <div class="ba-wave">${Array.from({ length: 26 }, () => '<span style="height:' + (20 + Math.random() * 70) + '%"></span>').join('')}</div>
        </div>
        <div class="ba-dur" id="baDur">1:24</div>
      </div>

      <div id="marketBlocks"></div>
    `;

    const blocks = $('#marketBlocks');

    // Moneyline (3-way for soccer)
    blocks.appendChild(marketBlock(isSoccer ? '3-Way Moneyline' : 'Moneyline',
      isSoccer
        ? [oddsCell(g.away, m.moneyline.away, g, 'ml-a'), oddsCell('Draw', m.moneyline.draw, g, 'ml-d'), oddsCell(g.home, m.moneyline.home, g, 'ml-h')]
        : [oddsCell(g.away, m.moneyline.away, g, 'ml-a'), oddsCell(g.home, m.moneyline.home, g, 'ml-h')],
      isSoccer));

    // Run line / spread with slider
    blocks.appendChild(marketBlock(isSoccer ? 'Goal Line' : 'Run Line',
      [oddsCellId(`${g.away} +${m.runline.line}`, m.runline.away, g, 'rl-a'), oddsCellId(`${g.home} -${m.runline.line}`, m.runline.home, g, 'rl-h')]));
    blocks.appendChild(moveLine('runline', g, m.runline.line, 0.5, 0.5, 'spread'));

    // Total with slider
    blocks.appendChild(marketBlock(isSoccer ? 'Total Goals' : 'Total Runs',
      [oddsCellId(`Under ${m.total.line}`, m.total.under, g, 'tot-u'), oddsCellId(`Over ${m.total.line}`, m.total.over, g, 'tot-o')]));
    blocks.appendChild(moveLine('total', g, m.total.line, 0.5, 0.5, 'total'));

    // wire audio + add buttons
    wireAudio();
    wireAddButtons(v, g);
  }

  function marketBlock(title, cells, three) {
    const b = el('div', 'market');
    b.innerHTML = `<div class="market-h">${title}</div>`;
    const grid = el('div', 'market-grid' + (three ? ' three' : ''));
    cells.forEach(c => grid.appendChild(c));
    b.appendChild(grid);
    return b;
  }

  function oddsCell(side, data, g, key) { return oddsCellId(side, data, g, key); }
  function oddsCellId(side, data, g, key) {
    const e = edgeOf(data);
    const c = el('div', 'odds-cell' + (e > 0.03 ? ' best' : ''));
    c.dataset.key = key;
    c.innerHTML = `
      ${e > 0.02 ? `<span class="oc-edge">+${(e * 100).toFixed(1)}%</span>` : ''}
      <div class="oc-side">${side}</div>
      <div class="oc-prob" data-prob>${pct(data.btaProb)}</div>
      <div class="oc-odds ${data.odds > 0 ? 'pos' : 'neg'}" data-odds>${fmtOdds(data.odds)}</div>
      <button class="oc-add" data-add="${side}" data-odds="${data.odds}" data-prob="${data.btaProb}">+ Add</button>`;
    return c;
  }

  // Move-the-Line slider: dragging recomputes prob + fair odds live
  function moveLine(market, g, baseLine, step, sens, kind) {
    const wrap = el('div', 'mtl');
    const min = baseLine - 2, max = baseLine + 2;
    wrap.innerHTML = `
      <div class="mtl-label"><span>Move the Line</span><span class="mtl-now">${kind === 'total' ? 'Line ' : 'Spread '}<b id="mtlVal-${market}">${baseLine}</b></span></div>
      <div class="mtl-track">
        <input type="range" id="mtl-${market}" min="${min}" max="${max}" step="${step}" value="${baseLine}">
      </div>`;
    setTimeout(() => {
      const input = wrap.querySelector('input');
      input.addEventListener('input', () => {
        const line = parseFloat(input.value);
        $('#mtlVal-' + market).textContent = line;
        const deltaSteps = (line - baseLine) / step;
        const md = g.markets[market];
        // total: under prob rises as line rises. spread: away(+) prob rises as line rises.
        const upSide = market === 'total' ? 'under' : 'away';
        const dnSide = market === 'total' ? 'over' : 'home';
        const upBase = md[upSide].btaProb, dnBase = md[dnSide].btaProb;
        const upNew = clamp(upBase + deltaSteps * sens * 0.11, 0.03, 0.97);
        const dnNew = 1 - upNew;
        updateCell(market === 'total' ? 'tot-u' : 'rl-a', upNew, upSide === 'away' ? `${g.away} +${line}` : `Under ${line}`);
        updateCell(market === 'total' ? 'tot-o' : 'rl-h', dnNew, dnSide === 'home' ? `${g.home} -${line}` : `Over ${line}`);
      });
    }, 0);
    return wrap;
  }

  function updateCell(key, prob, sideLabel) {
    const cell = document.querySelector(`#view-analyzer .odds-cell[data-key="${key}"]`);
    if (!cell) return;
    cell.querySelector('[data-prob]').textContent = pct(prob);
    const od = cell.querySelector('[data-odds]');
    const fair = probToAmerican(prob);
    od.textContent = fmtOdds(fair);
    od.className = 'oc-odds ' + (fair > 0 ? 'pos' : 'neg');
    cell.querySelector('.oc-side').textContent = sideLabel;
    const add = cell.querySelector('.oc-add');
    if (add) { add.dataset.odds = fair; add.dataset.prob = prob; add.dataset.add = sideLabel; }
    // edge pill recompute
    const e = prob - impliedProb(fair); // fair odds => ~0 edge; keep subtle
    cell.classList.toggle('best', prob > 0.55);
  }

  function wireAudio() {
    const audio = $('#betAudio'), btn = $('#baPlay'), dur = $('#baDur');
    let playing = false, t = 84;
    btn.addEventListener('click', () => {
      playing = !playing;
      audio.classList.toggle('playing', playing);
      btn.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>';
      clearInterval(state.audioTimer);
      if (playing) {
        state.audioTimer = setInterval(() => {
          t = t <= 0 ? 84 : t - 1;
          dur.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        }, 1000);
      }
    });
  }

  function wireAddButtons(scope, g) {
    scope.querySelectorAll('.oc-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const odds = parseFloat(btn.dataset.odds);
        addLeg({
          id: g.id + '-' + btn.dataset.add,
          team: g.away, away: g.away, home: g.home,
          name: btn.dataset.add, sub: `${g.away} @ ${g.home}`,
          odds, btaProb: parseFloat(btn.dataset.prob),
        });
        btn.textContent = '✓ Added'; btn.classList.add('added');
        setTimeout(() => { btn.textContent = '+ Add'; btn.classList.remove('added'); }, 1400);
      });
    });
  }

  /* ============================================================
     VIEW: PLAYERS
     ============================================================ */
  function renderPlayers() {
    const v = $('#view-players');
    v.innerHTML = `
      <div class="page-title-row"><div class="page-title">PLAYERS</div></div>
      <div class="sport-tabs" id="playersSportTabs"></div>
      <div class="book-row glass">
        <span class="bk-l"><span class="bk-logo" style="background:#1493ff">FD</span> FanDuel</span>
        <span class="bk-r">Exportable Betslip</span>
      </div>
      <div id="playersList"></div>`;
    sportTabs($('#playersSportTabs'), s => { state.sport = s; renderPlayers(); });

    const list = $('#playersList');
    const props = PROPS[state.sport] || [];
    if (!props.length) { list.appendChild(el('div', 'risk-empty', '<p>No player props for this sport yet.</p>')); return; }
    props.forEach((p, idx) => list.appendChild(playerCard(p, idx === 0)));
  }

  function playerCard(p, open) {
    const card = el('div', 'player-card' + (open ? ' open' : ''));
    const head = el('div', 'pc-head');
    head.innerHTML = `
      <div class="pc-grad" style="${teamSolid(p.team)}"></div>
      <div class="pc-info"><div class="pc-name">${p.name} (${p.team})</div><div class="pc-meta">${p.match} · ${p.time}</div></div>
      <span class="pc-chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></span>`;
    head.addEventListener('click', () => card.classList.toggle('open'));
    const body = el('div', 'pc-body');
    p.lines.forEach((l, i) => {
      const block = el('div', 'prop-line');
      block.innerHTML = `<div class="pl-stat">${l.stat} ${l.line}</div>`;
      const grid = el('div', 'market-grid');
      grid.appendChild(oddsCellId(`Under ${l.line}`, { btaProb: l.under.btaProb, odds: l.under.odds ?? probToAmerican(l.under.btaProb) }, null, `pu-${p.id}-${i}`));
      grid.appendChild(oddsCellId(`Over ${l.line}`, { btaProb: l.over.btaProb, odds: l.over.odds ?? probToAmerican(l.over.btaProb) }, null, `po-${p.id}-${i}`));
      block.appendChild(grid);
      body.appendChild(block);
    });
    card.appendChild(head); card.appendChild(body);

    // wire add buttons for this player's props
    setTimeout(() => body.querySelectorAll('.oc-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const odds = parseFloat(btn.dataset.odds);
        addLeg({ id: p.id + '-' + btn.dataset.add, team: p.team, name: `${p.name.split(' ').pop()} ${btn.dataset.add}`, sub: `${p.name} · ${p.match}`, odds, btaProb: parseFloat(btn.dataset.prob) });
        btn.textContent = '✓ Added'; btn.classList.add('added');
        setTimeout(() => { btn.textContent = '+ Add'; btn.classList.remove('added'); }, 1400);
      });
    }), 0);
    return card;
  }

  /* ============================================================
     RISK ANALYZER — build & weigh a card
     ============================================================ */
  function addLeg(leg, toastMsg) {
    if (state.card.find(l => l.id === leg.id)) { showToast('Already on your card'); return; }
    state.card.push(leg);
    updateBadge();
    showToast(toastMsg || `Added ${leg.name} to Risk Analyzer`);
    if (state.view === 'risk') renderRisk();
  }
  function removeLeg(id) { state.card = state.card.filter(l => l.id !== id); updateBadge(); renderRisk(); }
  function clearCard() { state.card = []; updateBadge(); renderRisk(); }

  function updateBadge() {
    const b = $('#riskBadge');
    if (state.card.length) { b.hidden = false; b.textContent = state.card.length; }
    else b.hidden = true;
  }

  function renderRisk() {
    const v = $('#view-risk');
    if (!state.card.length) {
      v.innerHTML = `
        <div class="page-title-row"><div class="page-title">RISK ANALYZER</div></div>
        <div class="risk-empty">
          <div class="re-ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 7h14M7 7l-3 7a3.2 3.2 0 0 0 6 0zM17 7l-3 7a3.2 3.2 0 0 0 6 0z"/></svg></div>
          <h3>Build your bet card</h3>
          <p>Add selections from Games, the Analyzer, or Player Props.
          BTA models the combined win probability, fair odds, and your exposure
          across every leg — before you wager.</p>
        </div>`;
      return;
    }

    const probs = state.card.map(l => l.btaProb);
    const winProb = parlayProb(probs);
    const dec = state.card.reduce((d, l) => d * americanToDecimal(l.odds), 1);
    const am = decimalToAmerican(dec);
    const marketImplied = state.card.reduce((p, l) => p * impliedProb(l.odds), 1);
    const edge = (winProb - marketImplied) * 100;

    v.innerHTML = `
      <div class="page-title-row"><div class="page-title">RISK ANALYZER</div></div>
      <div class="risk-summary">
        <div class="rs-grid">
          <div class="rs-cell">
            <div class="rs-l">Est. Win Probability</div>
            <div class="rs-prob">${pct1(winProb).replace('%', '')}<span>%</span></div>
          </div>
          <div class="rs-cell" style="text-align:right">
            <div class="rs-l">Est. Combined Odds</div>
            <div class="rs-odds">${am}</div>
          </div>
        </div>
        <div class="rs-bar"><span id="rsBar"></span></div>
        <div class="rs-foot">
          <span>${state.card.length} leg${state.card.length > 1 ? 's' : ''} · ${(dec).toFixed(2)}x payout</span>
          <span>Model edge <b>${edge >= 0 ? '+' : ''}${edge.toFixed(1)} pts</b></span>
        </div>
      </div>
      <div id="legList"></div>
      <div class="risk-actions">
        <button class="btn-clear" id="clearCard"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg> Remove All</button>
        <button class="btn-export" id="exportCard"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0-12 4 4m-4-4-4 4M5 21h14"/></svg> Export to FanDuel</button>
      </div>`;

    const legList = $('#legList');
    state.card.forEach((l, i) => {
      const row = el('div', 'bet-leg');
      row.style.animationDelay = (i * 60) + 'ms';
      row.innerHTML = `
        <div class="bl-team" style="${teamSolid(l.team) || ''}">${(l.team || '•').slice(0, 3)}</div>
        <div class="bl-main"><div class="bl-name">${l.name}</div><div class="bl-sub">${l.sub} · BTA ${pct1(l.btaProb)}</div></div>
        <div class="bl-od">${fmtOdds(l.odds)}</div>
        <button class="bl-x" aria-label="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
      row.querySelector('.bl-x').addEventListener('click', () => removeLeg(l.id));
      legList.appendChild(row);
    });

    requestAnimationFrame(() => { $('#rsBar').style.width = Math.round(winProb * 100) + '%'; });
    $('#clearCard').addEventListener('click', clearCard);
    $('#exportCard').addEventListener('click', () => showToast('Betslip exported to FanDuel ✓'));
  }

  /* ============================================================
     FANTASY IQ — DFS optimizer
     ============================================================ */
  function initFantasy() {
    state.fantasy = DFS.positions.map((pos, i) => ({ pos, slot: i, player: null, locked: false }));
  }

  function renderFantasy() {
    if (!state.fantasy) initFantasy();
    const v = $('#view-fantasy');
    const used = state.fantasy.reduce((s, x) => s + (x.player ? x.player.salary : 0), 0);
    const proj = state.fantasy.reduce((s, x) => s + (x.player ? x.player.proj : 0), 0);
    const pctCap = Math.min(100, used / DFS.cap * 100);
    const over = used > DFS.cap;

    v.innerHTML = `
      <div class="page-title-row"><div class="page-title">FANTASY IQ</div></div>
      <div class="book-row glass" style="margin-bottom:4px">
        <span class="bk-l"><span class="bk-logo" style="background:#53d337;color:#0a2e0a">DK</span> DraftKings · Classic</span>
        <span class="bk-r">MLB Main</span>
      </div>

      <div class="fiq-cap glass">
        <div class="fiq-cap-top">
          <span class="fc-l">Salary Cap</span>
          <span class="fc-used" style="${over ? 'color:var(--red)' : ''}">$${used.toLocaleString()} <span style="color:var(--faint);font-size:13px">/ $${DFS.cap.toLocaleString()}</span></span>
        </div>
        <div class="fiq-cap-track"><div class="fiq-cap-fill ${over ? 'over' : ''}" style="width:${pctCap}%"></div></div>
        <div class="fiq-cap-foot">
          <span>Remaining <b>$${(DFS.cap - used).toLocaleString()}</b></span>
          <span class="proj">Projected ${proj.toFixed(1)} pts</span>
        </div>
      </div>

      <div id="fiqSlots"></div>
      <button class="fiq-optimize" id="fiqOptimize">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 6.4 2.6M21 4v5h-5"/></svg>
        ${state.fantasy.some(s => s.player) ? 'Re-Optimize Lineup' : 'Optimize Lineup'}
      </button>`;

    const slots = $('#fiqSlots');
    state.fantasy.forEach((s, i) => slots.appendChild(fantasySlot(s, i)));
    $('#fiqOptimize').addEventListener('click', optimizeLineup);
  }

  function fantasySlot(s, i) {
    const row = el('div', 'fiq-slot' + (s.player ? '' : ' empty') + (s.locked ? ' locked' : ''));
    row.innerHTML = `
      <div class="fs-pos">${s.pos}</div>
      <div class="fs-name">${s.player ? `${s.player.name} <span style="color:var(--faint);font-weight:500">${s.player.team}</span>` : 'Empty slot'}</div>
      <div class="fs-sal">${s.player ? '$' + s.player.salary.toLocaleString() : ''}</div>
      <div class="fs-proj">${s.player ? s.player.proj.toFixed(1) : ''}</div>
      <button class="fs-lock" aria-label="Lock player"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${s.locked ? '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' : '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-1.5"/>'}</svg></button>`;
    row.querySelector('.fs-lock').addEventListener('click', () => {
      if (!s.player) return;
      s.locked = !s.locked; renderFantasy();
    });
    return row;
  }

  function optimizeLineup() {
    const btn = $('#fiqOptimize');
    btn.classList.add('spinning');
    btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 6.4 2.6M21 4v5h-5"/></svg> Optimizing…';

    // cap-aware greedy: keep locked, fill the rest with the highest-projection
    // player that still leaves enough cap to fill every later slot at its
    // cheapest option (salary reservation) — guarantees a feasible lineup.
    setTimeout(() => {
      const locked = state.fantasy.filter(s => s.locked && s.player);
      const usedSalary = locked.reduce((s, x) => s + x.player.salary, 0);
      const usedNames = new Set(locked.map(s => s.player.name));
      let remaining = DFS.cap - usedSalary;

      const minByPos = {};
      DFS.pool.forEach(p => { minByPos[p.pos] = Math.min(minByPos[p.pos] ?? Infinity, p.salary); });

      const open = state.fantasy.filter(s => !(s.locked && s.player));
      open.forEach((s, idx) => {
        const reserve = open.slice(idx + 1).reduce((sum, ls) => sum + (minByPos[ls.pos] || 0), 0);
        const budget = remaining - reserve;
        let candidates = DFS.pool
          .filter(p => p.pos === s.pos && !usedNames.has(p.name) && p.salary <= budget)
          .sort((a, b) => b.proj - a.proj);
        if (!candidates.length) // last resort: cheapest available, keeps a player in the slot
          candidates = DFS.pool.filter(p => p.pos === s.pos && !usedNames.has(p.name)).sort((a, b) => a.salary - b.salary);
        const pick = candidates[0];
        if (pick) { s.player = pick; usedNames.add(pick.name); remaining -= pick.salary; }
      });

      renderFantasy();
      // staggered pop animation
      const rows = $('#fiqSlots').children;
      Array.from(rows).forEach((r, i) => { setTimeout(() => r.classList.add('filling'), i * 70); });
      const ob = $('#fiqOptimize');
      ob.classList.remove('spinning'); ob.classList.add('done');
      ob.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> Lineup Optimized';
      const totalProj = state.fantasy.reduce((s, x) => s + (x.player ? x.player.proj : 0), 0);
      showToast(`Optimal lineup · ${totalProj.toFixed(1)} projected pts`);
      setTimeout(() => { if ($('#fiqOptimize')) { $('#fiqOptimize').classList.remove('done'); $('#fiqOptimize').innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 6.4 2.6M21 4v5h-5"/></svg> Re-Optimize Lineup'; } }, 2600);
    }, 850);
  }

  /* ============================================================
     NAVIGATION + TOAST
     ============================================================ */
  const RENDERERS = { home: renderHome, games: renderGames, analyzer: renderAnalyzer, players: renderPlayers, risk: renderRisk, fantasy: renderFantasy, profile: renderProfile };

  function navigate(view) {
    if (!RENDERERS[view]) view = 'profile';
    state.view = view;
    RENDERERS[view]();
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    document.querySelectorAll('.jump-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#viewport').scrollTop = 0;
    // note: URL is intentionally left untouched so scoped /slug links survive navigation & refresh
  }
  window.navigate = navigate;
  window.RENDERERS = RENDERERS;

  let toastTimer;
  function showToast(msg) {
    const t = $('#toast');
    t.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> ${msg}`;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ============================================================
     SCREENSHOT GALLERY (click the BTA ring mark)
     ============================================================ */
  const GALLERY = [
    { src: 'assets/shots/01-dashboard.png',        title: 'Dashboard',            sub: 'Time-aware greeting + live Bloomberg-style edge ticker' },
    { src: 'assets/shots/02-games-mlb.png',        title: 'Games · MLB',          sub: 'BTA win probability vs. the market, by matchup' },
    { src: 'assets/shots/03-games-fifa.png',       title: 'Games · FIFA',         sub: 'World Cup slate with edge flags' },
    { src: 'assets/shots/04-analyzer-mlb.png',     title: 'Game Analyzer',        sub: 'AI Bet Analysis + interactive Move the Line' },
    { src: 'assets/shots/05-analyzer-fifa.png',    title: 'Game Analyzer · FIFA', sub: '3-way moneyline with model edges' },
    { src: 'assets/shots/06-player-props.png',     title: 'Player Props',         sub: 'Per-player over/under probabilities & odds' },
    { src: 'assets/shots/07-risk-analyzer.png',    title: 'Risk Analyzer',        sub: 'Combined win probability, fair odds & exposure' },
    { src: 'assets/shots/08-fantasy-optimized.png',title: 'Fantasy IQ',           sub: 'Optimized DFS lineup, perfectly under the cap' },
    { src: 'assets/shots/09-nfl-countdown.png',    title: 'NFL Countdown',        sub: 'Season kicks off September 10, 2026' },
  ];
  let galIdx = 0;

  function buildGalleryDots() {
    const d = $('#galDots'); d.innerHTML = '';
    GALLERY.forEach((_, j) => { const b = el('button', 'gal-dot'); b.setAttribute('aria-label', 'Go to screen ' + (j + 1)); b.addEventListener('click', () => showGal(j)); d.appendChild(b); });
    $('#galTotal').textContent = GALLERY.length;
  }
  function showGal(i) {
    galIdx = (i + GALLERY.length) % GALLERY.length;
    const it = GALLERY[galIdx];
    const img = $('#galImg');
    img.style.animation = 'none'; void img.offsetWidth; img.style.animation = ''; // restart entrance anim
    img.src = it.src; img.alt = it.title;
    $('#galTitle').textContent = it.title;
    $('#galSub').textContent = it.sub;
    $('#galIndex').textContent = galIdx + 1;
    [...$('#galDots').children].forEach((d, j) => d.classList.toggle('active', j === galIdx));
  }
  function openGallery() { showGal(0); const g = $('#gallery'); g.hidden = false; g.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  function closeGallery() {
    if (document.body.classList.contains('gallery-only')) return; // scoped tour link stays on the tour
    const g = $('#gallery'); g.hidden = true; g.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  }

  /* ============================================================
     THREE EXPERIENCES + SCOPED LINKS + SECRET NAVIGATION
     ----------------------------------------------------------
     Each secret slug opens ONE experience and locks the visitor to
     it (path /slug or ?k=slug). Only you can move between all three
     with the secret keystroke:  Ctrl/Cmd + Alt + ← / →
     ============================================================ */
  const MODES = {
    'live-9q4x2k':  'demo',     // full interactive demo
    'shots-7k2m8w': 'screens',  // screenshot tour (gallery)
    'zen-3x8p5d':   'focus',    // focused demo (logo + phone only)
  };
  const MODE_ORDER = ['demo', 'screens', 'focus'];
  let mode = 'demo';

  function applyMode(next) {
    mode = next;
    document.body.classList.remove('focus', 'gallery-only');
    const g = $('#gallery');
    if (!g.hidden) { g.hidden = true; g.setAttribute('aria-hidden', 'true'); }
    document.body.style.overflow = '';
    if (next === 'screens') { document.body.classList.add('gallery-only'); openGallery(); }
    else if (next === 'focus') { document.body.classList.add('focus'); }
    // 'demo' = the full experience, nothing extra
  }
  function cycleMode(dir) { applyMode(MODE_ORDER[(MODE_ORDER.indexOf(mode) + dir + MODE_ORDER.length) % MODE_ORDER.length]); }

  function getSlug() {
    let p = decodeURIComponent((location.pathname || '').replace(/^\/+|\/+$/g, ''));
    if (!p) p = new URLSearchParams(location.search).get('k') || '';
    if (!p && location.hash) p = location.hash.replace('#', '');
    return p.trim();
  }

  function wireGallery() {
    buildGalleryDots();
    GALLERY.forEach(g => { const im = new Image(); im.src = g.src; }); // preload
    $('#galPrev').addEventListener('click', () => showGal(galIdx - 1));
    $('#galNext').addEventListener('click', () => showGal(galIdx + 1));
    $('#galleryClose').addEventListener('click', closeGallery);
    $('#gallery').addEventListener('click', e => { if (e.target.id === 'gallery') closeGallery(); });

    document.addEventListener('keydown', e => {
      // SECRET master navigation — only you know this: Ctrl/Cmd + Alt + Arrow
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault(); cycleMode(e.key === 'ArrowRight' ? 1 : -1); return;
      }
      // plain arrows browse the tour when it's showing
      if (!$('#gallery').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowRight') showGal(galIdx + 1);
        else if (e.key === 'ArrowLeft') showGal(galIdx - 1);
      }
    });
  }

  /* ---------- init ---------- */
  function init() {
    buildTicker();
    tickClock(); setInterval(tickClock, 15000);
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => navigate(t.dataset.view)));
    document.querySelectorAll('.jump-btn').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));
    wireGallery();
    const startMode = MODES[getSlug()] || 'demo';   // read the slug BEFORE anything can touch the URL
    navigate('home');                                // render the base app behind everything
    applyMode(startMode);                            // overlay the scoped experience (root -> demo)
  }
  document.addEventListener('DOMContentLoaded', init);


  /* ============================================================
     PROFILE DATA  (merges with / overrides USER from data.js)
     ============================================================ */
  window.PROFILE = window.PROFILE || {
    name:        'nicole.timko',
    displayName: 'Nicole Timko',
    email:       'nicole@btasports.io',
    city:        'Audubon',
    state:       'PA',
    avatarInitials: 'NT',
    avatarColor: 'linear-gradient(145deg,#6fa3ff,#7a5cff)',
    avatarUrl:   '',          // set to an image URL to show a photo
    memberSince: 'April 2024',
    socials: {
      instagram: '@nicole.timko',
      x:         '@nicole_bets',
      tiktok:    '@nicoletimko',
      linkedin:  'nicole-timko',
      youtube:   '',
    },
    favLeagues:  ['MLB', 'NFL', 'NBA'],
    favTeams:    [
      { abbr:'PHS', city:'Philadelphia', name:'Steel',  color:'#e0463f', opp:'NYV', time:'7:10 PM', bta:58, market:51, edge:7,  last10:'6-4', avgFor:5.2, avgAgainst:3.8 },
      { abbr:'NYV', city:'New York',     name:'Volt',   color:'#3a6df0', opp:'BOA', time:'7:05 PM', bta:54, market:49, edge:5,  last10:'5-5', avgFor:4.6, avgAgainst:4.1 },
      { abbr:'CHE', city:'Chicago',      name:'Ember',  color:'#ff8a3d', opp:'TXR', time:'8:10 PM', bta:62, market:55, edge:7,  last10:'7-3', avgFor:5.8, avgAgainst:3.3 },
      { abbr:'SEA', city:'Seattle',      name:'Pines',  color:'#2f7a4f', opp:'MIA', time:'9:40 PM', bta:60, market:53, edge:7,  last10:'7-3', avgFor:5.4, avgAgainst:3.6 },
    ],
    favPlayers: [
      { init:'MB', name:'Marcus Bell',    pos:'1B', team:'Philadelphia Steel', color:'#e0463f', opp:'NYV', time:'7:10 PM', props:[['Hits Over 1.5',26.3],['HR Over 0.5',15.8]] },
      { init:'TC', name:'Tyrese Caldwell',pos:'OF', team:'Chicago Ember',      color:'#ff8a3d', opp:'TXR', time:'8:10 PM', props:[['Hits Over 1.5',28.7],['HR Over 0.5',19.2]] },
      { init:'KN', name:'Kai Nakamura',  pos:'OF', team:'Seattle Pines',       color:'#2f7a4f', opp:'MIA', time:'9:40 PM', props:[['SB Over 0.5',22.8],['Hits Over 1.5',27.5]] },
    ],
    recentBets: [
      { m:'Steel @ Volt',           t:'Moneyline · Steel',             odds:'+110', stake:'$15', status:'win',     payout:'+$16.50' },
      { m:'Ember vs Rattlers',       t:'Run Line · Ember -1.5',         odds:'-105', stake:'$20', status:'win',     payout:'+$19.05' },
      { m:'M. Bell — Steel',         t:'Prop · Hits Over 1.5',          odds:'+165', stake:'$10', status:'loss',    payout:'-$10.00' },
      { m:'Anchor @ Volt',           t:'Moneyline · Anchor',            odds:'+140', stake:'$12', status:'loss',    payout:'-$12.00' },
      { m:'D. Lansing — Volt',       t:'Prop · Total Bases Over 2.5',   odds:'+120', stake:'$10', status:'pending', payout:'—'       },
    ],
    trendingPicks: [
      { name:'Ember ML vs Rattlers',    pct:'68% of community' },
      { name:'Pines/Tide Over 8.5',     pct:'61% of community' },
      { name:'C. Bell Hits Over 1.5',   pct:'54% of community' },
    ],
    achievements: [
      { emoji:'🔥', name:'Hot Streak',    desc:'5 wins in a row',                earned:true  },
      { emoji:'🎯', name:'Sharp Shooter', desc:'60%+ season win rate',            earned:true  },
      { emoji:'💯', name:'Century Club',  desc:'100 bets placed',                 earned:true  },
      { emoji:'📈', name:'Positive ROI',  desc:'10%+ ROI for a season',           earned:true  },
      { emoji:'🐺', name:'Underdog Hunter',desc:'Win 15 bets at +150 or longer',  earned:false, progress:60 },
      { emoji:'🃏', name:'Parlay Master', desc:'Hit a 5-leg parlay',              earned:false, progress:20 },
    ],
    community: {
      followers:  86,
      following: 123,
      likes:      21,
      topPick:   'Steel ML +110',
      topPickLikes: 11,
    },
    stats: {
      roi:     '+12.8%',
      wr:      '58%',
      betsWon:  723,
      Totbets: 1247,
      avgStake:'$15',
    },
    leaderboard: [
      { rank:1, name:'jmercado_bets', wr:'71%', streak:'9-game streak' },
      { rank:2, name:'sharp_sadie',   wr:'66%', streak:'6-game streak' },
      { rank:3, name:'kdrisko',       wr:'63%', streak:'4-game streak' },
      { rank:8, name:'nicole.timko',  wr:'58%', streak:'You'           },
    ],
  };

  function profileToast(msg) {
    // reuse the app's showToast if available, else fall back
    if (typeof showToast === 'function') showToast(msg);
    else {
      const t = $('#toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }
  }

  /* ============================================================
     PROFILE-VIEW CSS  (injected once)
     ============================================================ */
  (function injectStyles() {
    if (document.getElementById('bta-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'bta-profile-styles';
    style.textContent = `
/* ── Profile view wrapper ── */
#view-profile { 
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 30px; 
    font-size: 0.92rem;
}

.screen {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.device.compact .prof-avatar {
  width: 88px;
  height: 110px;
}

.device.compact .prof-header {
  flex-direction: column;
  gap: 10px;
}

/* ── Profile page header ── */

.profile-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 12px;
  padding: 0 4px;
}

.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.profile-page-title {
  margin: 0;

  font-family: 'Saira Condensed', sans-serif;
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;

  color: #fff;
}

.profile-edit-btn {
  height: 30px;
  padding: 0 12px;

  border-radius: 999px;
  border: 1px solid rgba(94,159,255,.2);

  background: rgba(19,35,62,.78);
  color: var(--text-secondary, #9fb3d6);

  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  cursor: pointer;
  transition: all .15s ease;
}

.profile-edit-btn:hover {
  color: #fff;
  border-color: rgba(94,159,255,.45);
}

/* ── Profile header card ── */
.prof-header {
  display: flex; flex-wrap: wrap; gap: 10px;
  padding: 12px; margin-bottom: 10px;
  flex-direction: column;
  align-items: stretch;
}
.prof-info {
  flex: none;
}
.prof-avatar-wrap { position: relative; flex-shrink: 0; }
.prof-avatar {
  width: 88px; height: 110px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Saira Condensed', sans-serif;
  font-weight: 800; font-size: 20px; color: #0a1428;
  border: 2px solid rgba(150,195,255,.55);
  box-shadow: 0 0 22px rgba(79,141,255,.4);
  overflow: hidden;
}
.prof-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 18px; }
.prof-online {
  position: absolute; bottom: -3px; right: -3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--green, #3ddc84); border: 3px solid var(--bg-deep, #050b18);
}
.prof-info { flex: 1 1 200px; min-width: 0; }
.prof-info h1 {
  font-family: 'Saira Condensed', sans-serif; font-weight: 800;
  font-size: 18px; color: #fff; line-height: 1.05; margin: 0 0 4px;
  text-transform: uppercase; letter-spacing: .04em;
}
.prof-handle { font-size: 12px; color: var(--text-muted, #5e7299); margin-bottom: 8px; }
.prof-meta { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-secondary, #9fb3d6); margin: 3px 0; }
.prof-meta svg { width: 13px; height: 13px; flex-shrink: 0; }
.prof-socials { display: flex; gap: 6px; margin: 8px 0; flex-wrap: wrap; }
.social-pill {
  width: 26px; height: 26px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; cursor: pointer;
  border: 1px solid rgba(255,255,255,.12);
  transition: transform .15s ease, box-shadow .15s ease;
  text-decoration: none; font-family: 'Inter', sans-serif;
}
.social-pill:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.4); }
.sp-ig { background: linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7); }
.sp-x  { background: #15181c; }
.sp-tt { background: #1c1c1e; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
.sp-li { background: #0a66c2; }
.sp-yt { background: #ff0000; }
.member-badge {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 6px; padding: 5px 10px; border-radius: 999px;
  background: var(--panel-strong, rgba(19,35,62,.78));
  border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  font-size: 10.5px; color: var(--text-secondary, #9fb3d6); font-weight: 600; letter-spacing: .02em;
}
.member-badge b { color: var(--cyan, #3fd0ff); }

/* community box */
.prof-community {
  flex: 1 1 100%; width: 100%;
  background: rgba(10,20,38,.5); border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  border-radius: 14px; padding: 12px 10px;
}
.prof-community h3 {
  font-size: 11px;
}
.stat-line { font-size: 11.5px; }

.prof-community h3 {
  font-family: 'Saira Condensed', sans-serif; font-size: 13px;
  color: var(--text-primary, #eef3ff); letter-spacing: .06em;
  text-transform: uppercase; margin: 0 0 10px;
}
.stat-line { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12.5px; color: var(--text-secondary, #9fb3d6); }
.stat-line b { color: var(--text-primary, #eef3ff); font-size: 13.5px; }
.stat-line.hl b { color: var(--cyan, #3fd0ff); }
.pick-lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted, #5e7299); margin-top: 6px; }
.pick-val { font-size: 13px; color: #fff; font-weight: 600; margin-top: 2px; }
.pick-val span { color: var(--red, #ff5d5d); }

/* ── Stats strip ── */

.pstats-strip {
  display: flex; flex-direction: row;
  gap: 8px; overflow-x: auto; padding: 2px 0 6px; scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
}
.pstats-strip::-webkit-scrollbar { display: none; }
.pstat-chip {
  flex: 0 0 auto; width: 82px; height: 60px;
  padding: 10px 6px; text-align: center; border-radius: 14px;
  scroll-snap-align: start;
}
.pstat-chip .val { font-family: 'Saira Condensed', sans-serif; font-weight: 700; font-size: 13px; color: #fff; }

.pstat-chip .val.pos { color: var(--green, #3ddc84); text-shadow: 0 0 14px rgba(61,220,132,.4); }
.pstat-chip .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #5e7299); margin-top: 3px; }

/* ── Section heads ── */
.psec-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 10px; padding: 0 2px;
}
.psec-head h2 {
  font-family: 'Saira Condensed', sans-serif; font-size: 17px;
  color: var(--text-primary, #eef3ff); letter-spacing: .06em; text-transform: uppercase; margin: 0;
}
.psec-head .sub { font-size: 11px; color: var(--text-muted, #5e7299); letter-spacing: 0; text-transform: none; }

/* ── Fav teams carousel ── */
.pcarousel-wrap { position: relative; }
.pcarousel-track {
  display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; padding: 4px 4px 14px;
  scrollbar-width: none; cursor: grab; user-select: none;
}
.pcarousel-track::-webkit-scrollbar { display: none; }
.pcarousel-track.dragging { cursor: grabbing; scroll-snap-type: none; }
.pcarousel-track > * { scroll-snap-align: start; flex-shrink: 0; }
.pdots { display: flex; justify-content: center; gap: 6px; margin-top: 2px; }
.pdot { width: 6px; height: 6px; border-radius: 50%; background: rgba(159,179,214,.3); transition: all .25s ease; cursor: pointer; }
.pdot.active { width: 18px; background: var(--cyan, #3fd0ff); box-shadow: 0 0 8px rgba(63,208,255,.6); }
.pnav-arrows { display: flex; gap: 6px; }
.parrow-btn {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  background: var(--panel, rgba(16,29,54,.58));
  color: var(--text-secondary, #9fb3d6); display: flex;
  align-items: center; justify-content: center; cursor: pointer; transition: all .2s ease;
}
.parrow-btn:hover { color: #fff; border-color: var(--border-glow, rgba(94,159,255,.38)); box-shadow: 0 0 14px rgba(79,141,255,.3); }
.parrow-btn svg { width: 14px; height: 14px; }

/* team card */
.pteam-card { width: 185px; padding: 9px; display: flex; flex-direction: column; gap: 10px; }
.pteam-top { display: flex; gap: 10px; align-items: center; }
.pcrest {
  width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Saira Condensed', sans-serif; font-weight: 800; font-size: 14px; color: #fff;
  border: 2px solid rgba(255,255,255,.18);
}
.pteam-name { font-size: 14px; color: #fff; line-height: 1.1; font-family: 'Saira Condensed', sans-serif; text-transform: uppercase; letter-spacing: .03em; }
.pteam-name small { display: block; font-family: 'Inter', sans-serif; text-transform: none; font-size: 10.5px; color: var(--text-muted, #5e7299); letter-spacing: 0; margin-top: 2px; }
.ptri-stat { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; text-align: center; background: rgba(7,14,28,.5); border-radius: 10px; padding: 8px 4px; }
.ptri-stat div .v { font-family: 'Saira Condensed', sans-serif; font-weight: 700; font-size: 15px; color: #fff; }
.ptri-stat div .v.up { color: var(--green, #3ddc84); }
.ptri-stat div .v.dn { color: var(--red, #ff5d5d); }
.ptri-stat div .l { font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted, #5e7299); margin-top: 2px; }
.pmini-stats { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-muted, #5e7299); padding: 0 2px; }
.pmini-stats b { color: var(--text-secondary, #9fb3d6); font-weight: 600; }
.pnext-game { font-size: 11px; color: var(--text-secondary, #9fb3d6); }
.pnext-game b { color: var(--red, #ff5d5d); }

/* player card */
.pplayer-card { width: 185px; padding: 9px; display: flex; flex-direction: column; gap: 10px; }
.pplayer-top { display: flex; gap: 10px; align-items: center; }
.pp-avatar {
  width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Saira Condensed', sans-serif; font-weight: 800; font-size: 14px; color: #06122a;
  border: 2px solid rgba(255,255,255,.2);
}
.pp-name { font-size: 14.5px; color: #fff; line-height: 1.15; font-family: 'Saira Condensed', sans-serif; text-transform: uppercase; letter-spacing: .03em; }
.pp-name small { display: block; font-family: 'Inter', sans-serif; text-transform: none; font-size: 10.5px; color: var(--text-muted, #5e7299); letter-spacing: 0; margin-top: 2px; }
.pp-prop-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 2px; border-bottom: 1px solid rgba(94,159,255,.08); color: var(--text-secondary, #9fb3d6); }
.pp-prop-row:last-child { border-bottom: none; }
.pp-prop-row b { color: var(--cyan, #3fd0ff); font-weight: 700; }

/* ── Recent bets ── */
.pbet-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 14px; margin-bottom: 8px;
}
.pbet-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; font-family: 'Saira Condensed', sans-serif;
}
.pbet-icon.win  { background: rgba(61,220,132,.16); color: var(--green, #3ddc84); border: 1px solid rgba(61,220,132,.35); }
.pbet-icon.loss { background: rgba(255,93,93,.14);  color: var(--red,  #ff5d5d); border: 1px solid rgba(255,93,93,.35);  }
.pbet-icon.pending { background: rgba(255,182,72,.14); color: var(--amber, #ffb648); border: 1px solid rgba(255,182,72,.35); }

.pbet-mid { flex: 1; min-width: 0; }
.pbet-mid .m { font-size: 12px; color: #fff; font-weight: 600; }
.pbet-mid .s { font-size: 11px; color: var(--text-muted, #5e7299); margin-top: 2px; }
.pbet-right { text-align: right; flex-shrink: 0; }
.pbet-right .odds { font-size: 13px; font-weight: 700; color: var(--text-primary, #eef3ff); }
.pbet-right .stake { font-size: 10.5px; color: var(--text-muted, #5e7299); margin-top: 2px; }
.pstatus-tag { font-size: 9.5px; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; }
.pstatus-tag.win  { background: rgba(61,220,132,.15); color: var(--green, #3ddc84); }
.pstatus-tag.loss { background: rgba(255,93,93,.15);  color: var(--red,  #ff5d5d); }
.pstatus-tag.pending { background: rgba(255,182,72,.15); color: var(--amber, #ffb648); }

/* ── Community ── */
.pcomm-grid { display: grid; gap: 12px; overflow-x: auto;}
@media(min-width:680px){ .pcomm-grid { grid-template-columns: 1.1fr 0.9fr; } }

.plb-row {
  display: flex;
  align-items: flex-start;
  width: 185px;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid rgba(94,159,255,.08);
}

.plb-row:last-child {
  border-bottom: none;
}

.plb-mid {
  flex: 1;
  min-width: 0;
}

.plb-name {
  font-size: 13px;
  color: #fff;
  font-weight: 600;
}

.plb-streak {
  font-size: 9px;
  color: var(--text-muted, #5e7299);
  margin-top: 2px;
}

.plb-wr {
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  color: var(--green, #3ddc84);
  white-space: nowrap;
  text-align: right;
  align-self: center; /* fixed spelling */
}

.plb-wr-label {
  font-size: 8px;
  color: var(--text-muted, #5e7299);
  text-transform: uppercase;
  letter-spacing: .04em;
  text-align: right;
  margin-top: 2px;
}

.plb-rank { width: 22px; height: 22px; border-radius: 50%; background: var(--panel-strong, rgba(19,35,62,.78)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-secondary, #9fb3d6); flex-shrink: 0; }
.plb-rank.gold { background: linear-gradient(135deg,#f4c95d,#e89b2e); color: #1a1200; }

.ptrend-pick {
  display: flex;
  width: 180px;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(7,14,28,.5);
  margin-bottom: 6px;
}

.ptrend-pick .name {
  font-size: 11.5px;
  color: var(--text-primary, #eef3ff);
  font-weight: 600;
  line-height: 1.3;
}

.ptrend-pick .pct {
  font-size: 10px;
  color: var(--cyan, #3fd0ff);
  font-weight: 700;
}

/* ── Achievements ── */
.pbadge-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
@media(min-width:540px){ .pbadge-grid { grid-template-columns: repeat(2,1fr); } }
.pbadge-card { padding: 14px 10px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; border-radius: 14px; }
.pbadge-card.locked { opacity: .55; }
.pbadge-emoji { font-size: 18px; }
.pbadge-name  { font-size: 11.5px; font-weight: 700; color: #fff; letter-spacing: .02em; }
.pbadge-desc  { font-size: 9.5px; color: var(--text-muted, #5e7299); line-height: 1.3; }
.pbadge-prog  { width: 100%; height: 4px; border-radius: 4px; background: rgba(94,159,255,.12); margin-top: 4px; overflow: hidden; }
.pbadge-prog .fill { height: 100%; background: linear-gradient(90deg, var(--blue, #4f8dff), var(--cyan, #3fd0ff)); border-radius: 4px; }

/* ── Glass card shared ── */
.pcard {
  position: relative;
  background: linear-gradient(180deg, rgba(24,42,74,.62), rgba(10,19,36,.55));
  border: 1px solid var(--border-glow, rgba(94,159,255,.38));
  border-radius: 26px;
  padding: 10px;
  backdrop-filter: blur(18px) saturate(160%);
  box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 10px 34px rgba(0,0,0,.4), 0 0 26px rgba(79,141,255,.07);
}
.pcard::before {
  content:''; position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(150,195,255,.55), transparent);
}
.psection { margin-top: 14px; }

/* ── EDIT PROFILE MODAL ── */
.ep-overlay {
  position: fixed; inset: 0; background: rgba(3,7,16,.7); backdrop-filter: blur(4px);
  opacity: 0; pointer-events: none; transition: opacity .25s ease; z-index: 300;
}
.ep-overlay.open { opacity: 1; pointer-events: auto; }
.ep-sheet {
  position: fixed; top: 0; right: 0; height: 100%; width: min(480px, 100vw);
  background: linear-gradient(180deg, rgba(11,20,42,.98), rgba(6,12,26,.99));
  border-left: 1px solid var(--border-glow, rgba(94,159,255,.38));
  box-shadow: -24px 0 60px rgba(0,0,0,.6);
  transform: translateX(100%); transition: transform .32s cubic-bezier(.4,0,.2,1);
  z-index: 301; display: flex; flex-direction: column;
}
.ep-sheet.open { transform: translateX(0); }
.ep-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid rgba(94,159,255,.12); flex-shrink: 0;
}
.ep-head h3 { font-family: 'Saira Condensed', sans-serif; font-size: 18px; color: #fff; text-transform: uppercase; letter-spacing: .05em; margin: 0; }
.ep-close {
  width: 34px; height: 34px; border-radius: 50%; background: var(--panel, rgba(16,29,54,.58));
  border: 1px solid var(--border-soft, rgba(94,159,255,.16)); color: var(--text-secondary, #9fb3d6);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s;
}
.ep-close:hover { color: #fff; border-color: var(--border-glow, rgba(94,159,255,.38)); }
.ep-close svg { width: 16px; height: 16px; }
.ep-body { flex: 1; overflow-y: auto; padding: 18px 20px 30px; display: flex; flex-direction: column; gap: 20px; }
.ep-body::-webkit-scrollbar { width: 4px; }
.ep-body::-webkit-scrollbar-thumb { background: rgba(94,159,255,.3); border-radius: 4px; }

/* avatar editor */
.ep-avatar-row { display: flex; align-items: center; gap: 16px; }
.ep-avatar-preview {
  width: 68px; height: 68px; border-radius: 18px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Saira Condensed', sans-serif; font-weight: 800; font-size: 22px; color: #0a1428;
  border: 2px solid rgba(150,195,255,.5); overflow: hidden;
}
.ep-avatar-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
.ep-avatar-btns { display: flex; flex-direction: column; gap: 6px; }
.ep-upload-btn {
  background: linear-gradient(135deg, var(--blue, #4f8dff), var(--cyan, #3fd0ff));
  color: #06122a; font-weight: 700; font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
  border: none; padding: 7px 14px; border-radius: 999px; cursor: pointer; font-family: 'Inter', sans-serif;
}
.ep-clear-btn {
  background: transparent; border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  color: var(--text-secondary, #9fb3d6); font-size: 11px; font-weight: 600;
  padding: 6px 14px; border-radius: 999px; cursor: pointer; font-family: 'Inter', sans-serif;
}

/* field groups */
.ep-group { display: flex; flex-direction: column; gap: 12px; }
.ep-group-title { font-family: 'Saira Condensed', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted, #5e7299); padding-bottom: 4px; border-bottom: 1px solid rgba(94,159,255,.1); }
.ep-field { display: flex; flex-direction: column; gap: 4px; }
.ep-field label { font-size: 11px; color: var(--text-secondary, #9fb3d6); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.ep-input {
  background: rgba(10,20,40,.6); border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #fff; font-family: 'Inter', sans-serif;
  outline: none; transition: border-color .2s;
}
.ep-input:focus { border-color: var(--blue, #4f8dff); box-shadow: 0 0 0 3px rgba(79,141,255,.12); }
.ep-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* league chips */
.ep-league-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.ep-league-chip {
  padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;
  border: 1px solid var(--border-soft, rgba(94,159,255,.16)); cursor: pointer;
  background: rgba(10,20,40,.5); color: var(--text-secondary, #9fb3d6);
  transition: all .2s; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: .04em;
}
.ep-league-chip.on { background: linear-gradient(135deg, rgba(79,141,255,.25), rgba(63,208,255,.15)); border-color: var(--cyan, #3fd0ff); color: #fff; box-shadow: 0 0 10px rgba(63,208,255,.2); }

/* save bar */
.ep-footer {
  padding: 14px 20px; border-top: 1px solid rgba(94,159,255,.12); flex-shrink: 0;
  display: flex; gap: 10px;
}
.ep-save-btn {
  flex: 1; padding: 12px; border-radius: 12px;
  background: linear-gradient(135deg, var(--blue, #4f8dff), var(--cyan, #3fd0ff));
  color: #06122a; font-weight: 700; font-size: 14px; letter-spacing: .03em;
  border: none; cursor: pointer; font-family: 'Inter', sans-serif;
  box-shadow: 0 0 20px rgba(79,141,255,.3); transition: opacity .2s;
}
.ep-save-btn:hover { opacity: .9; }
.ep-cancel-btn {
  padding: 12px 18px; border-radius: 12px;
  background: transparent; border: 1px solid var(--border-soft, rgba(94,159,255,.16));
  color: var(--text-secondary, #9fb3d6); font-weight: 600; font-size: 13px;
  cursor: pointer; font-family: 'Inter', sans-serif; transition: all .2s;
}
.ep-cancel-btn:hover { color: #fff; border-color: var(--border-glow, rgba(94,159,255,.38)); }

/* settings row link */
.setting-row.ep-link { cursor: pointer; transition: background .2s; }
.setting-row.ep-link:hover { background: rgba(79,141,255,.06); }
.setting-row .arrow-ic { color: var(--blue-bright, #79b6ff); }
.setting-row .arrow-ic svg { width: 16px; height: 16px; }
`;
    document.head.appendChild(style);
  })();

  /* ============================================================
     RENDER PROFILE VIEW
     ============================================================ */
  function renderProfile() {
    const v = document.getElementById('view-profile');
    if (!v) return;
    const p = window.PROFILE;

    v.innerHTML = ''; // clear

    /* ── Avatar ── */
    const avatarContent = p.avatarUrl
      ? `<img src="${p.avatarUrl}" alt="${p.displayName}">`
      : p.avatarInitials;
    const avatarStyle = p.avatarUrl ? '' : `style="${p.avatarColor}"`;

    /* ── Socials ── */
    const socialMap = [
      { key:'instagram', cls:'sp-ig', label:'IG', title:'Instagram' },
      { key:'x',         cls:'sp-x',  label:'X',  title:'X (Twitter)' },
      { key:'tiktok',    cls:'sp-tt', label:'TT', title:'TikTok' },
      { key:'linkedin',  cls:'sp-li', label:'in', title:'LinkedIn' },
      { key:'youtube',   cls:'sp-yt', label:'YT', title:'YouTube' },
    ];
    const socialsHtml = socialMap
      .filter(s => p.socials[s.key])
      .map(s => `<span class="social-pill ${s.cls}" title="${s.title}: ${p.socials[s.key]}">${s.label}</span>`)
      .join('');

    /* -- Header Brand --- */
    const pageHeader = document.createElement('div');
    pageHeader.className = 'page-title-row';

    pageHeader.innerHTML = `
        <div class="page-title">USER PROFILE</div>
        <button class="profile-edit-btn">✎ Edit</button>
    `;

    v.appendChild(pageHeader);


    /* ── Header ── */
    const header = document.createElement('div');
    header.className = 'pcard prof-header';
    header.innerHTML = `
      <div class="prof-avatar-wrap">
        <div class="prof-avatar" ${avatarStyle}>${avatarContent}</div>
        <div class="prof-online"></div>
      </div>
      <div class="prof-info">
        <h1>${p.displayName}</h1>
        <div class="prof-handle">@${p.name}</div>
        <div class="prof-socials">${socialsHtml}</div>
        <div class="prof-meta">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4V4z" stroke="currentColor" stroke-width="1.6"/><path d="M4 6l8 7 8-7" stroke="currentColor" stroke-width="1.6"/></svg>
          ${p.email}
        </div>
        <div class="prof-meta">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-7.4 7-12a7 7 0 10-14 0c0 4.6 7 12 7 12z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>
          ${p.city}, ${p.state}
        </div>
        <div class="member-badge">BTA MEMBER SINCE <b>${p.memberSince}</b></div>
      </div>
    `;
    v.appendChild(header);

    /* ── Stats ── */
    const statsWrap = document.createElement('div');
    statsWrap.className = 'psection';
    statsWrap.innerHTML = `
      <div class="pstats-strip">
        <div class="pcard pstat-chip"><div class="val pos">${p.stats.roi}</div><div class="lbl">ROI</div></div>
        <div class="pcard pstat-chip"><div class="val">${p.stats.wr}</div><div class="lbl">Win Rate</div></div>
        <div class="pcard pstat-chip"><div class="val">${p.stats.betsWon}</div><div class="lbl">Bets Won</div></div>
        <div class="pcard pstat-chip"><div class="val">${p.stats.Totbets}</div><div class="lbl">Total Bets</div></div>
        <div class="pcard pstat-chip"><div class="val">${p.stats.avgStake}</div><div class="lbl">Avg Stake</div></div>
      </div>`;
    v.appendChild(statsWrap);

    /* ── Fav Teams ── */
    const teamsSection = document.createElement('div');
    teamsSection.className = 'psection';
    teamsSection.innerHTML = `
      <div class="psec-head">
        <h2>Favorite Teams</h2>
        <div class="pnav-arrows">
          <button class="parrow-btn" data-pteam-prev aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="parrow-btn" data-pteam-next aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="pcarousel-wrap">
        <div class="pcarousel-track" id="pTeamsTrack"></div>
      </div>
      <div class="pdots" id="pTeamsDots"></div>`;
    v.appendChild(teamsSection);

    const teamsTrack = teamsSection.querySelector('#pTeamsTrack');
    p.favTeams.forEach(tm => {
      const edgeCls = tm.edge > 0 ? 'up' : 'dn';
      const card = document.createElement('div');
      card.className = 'pcard pteam-card';
      card.innerHTML = `
        <div class="pteam-top">
          <div class="pcrest" style="background:linear-gradient(145deg,${tm.color},#0a1428)">${tm.abbr}</div>
          <div>
            <div class="pteam-name">${tm.city} ${tm.name}</div>
            <div class="pnext-game">${tm.abbr} @ ${tm.opp} · <b>Tonight ${tm.time}</b></div>
          </div>
        </div>
        <div class="ptri-stat">
          <div><div class="v">${tm.bta}%</div><div class="l">BTA</div></div>
          <div><div class="v">${tm.market}%</div><div class="l">Market</div></div>
          <div><div class="v ${edgeCls}">${tm.edge > 0 ? '+' : ''}${tm.edge}%</div><div class="l">Edge</div></div>
        </div>
        <div class="pmini-stats">
          <span>Last 10 <b>${tm.last10}</b></span>
          <span>For <b>${tm.avgFor}</b></span>
          <span>vs <b>${tm.avgAgainst}</b></span>
        </div>`;
      teamsTrack.appendChild(card);
    });
    setupPCarousel('pTeamsTrack', 'pTeamsDots', '[data-pteam-prev]', '[data-pteam-next]', teamsSection);

    /* ── Fav Players ── */
    const playersSection = document.createElement('div');
    playersSection.className = 'psection';
    playersSection.innerHTML = `
      <div class="psec-head">
        <h2>Favorite Players</h2>
        <div class="pnav-arrows">
          <button class="parrow-btn" data-pplay-prev aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="parrow-btn" data-pplay-next aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="pcarousel-wrap">
        <div class="pcarousel-track" id="pPlayersTrack"></div>
      </div>
      <div class="pdots" id="pPlayersDots"></div>`;
    v.appendChild(playersSection);

    const playersTrack = playersSection.querySelector('#pPlayersTrack');
    p.favPlayers.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'pcard pplayer-card';
      const propsHtml = pl.props.map(([lbl, pct]) =>
        `<div class="pp-prop-row"><span>${lbl}</span><b>${pct.toFixed(1)}%</b></div>`).join('');
      card.innerHTML = `
        <div class="pplayer-top">
          <div class="pp-avatar" style="background:linear-gradient(145deg,${pl.color},#cfe3ff)">${pl.init}</div>
          <div>
            <div class="pp-name">${pl.name}</div>
            <small class="pp-name"><span style="font-family:'Inter',sans-serif;text-transform:none;letter-spacing:0;font-size:10.5px;color:var(--text-muted,#5e7299)">${pl.pos} · ${pl.team}</span></small>
          </div>
        </div>
        <div>${propsHtml}</div>`;
      playersTrack.appendChild(card);
    });
    setupPCarousel('pPlayersTrack', 'pPlayersDots', '[data-pplay-prev]', '[data-pplay-next]', playersSection);

    /* ── Recent Bets (capped at 4) ── */
    const betsSection = document.createElement('div');
    betsSection.className = 'psection';
    const shown = p.recentBets.slice(0, 4);
    const betsInner = shown.map(b => {
      const icon = b.status === 'win' ? 'W' : b.status === 'loss' ? 'L' : '…';
      return `
        <div class="pcard pbet-row">
          <div class="pbet-mid">
            <div class="m">${b.m}</div>
            <div class="s">${b.t}</div>
          </div>
          <div class="pbet-right">
            <div class="odds">${b.odds}</div>
            <div class="stake">${b.stake} stake</div>
          </div>
          <span class="pstatus-tag ${b.status}">${b.status}</span>
        </div>`;
    }).join('');
    betsSection.innerHTML = `
      <div class="psec-head"><h2>Recent Bets</h2><span class="sub">Last ${shown.length}</span></div>
      ${betsInner}`;
    v.appendChild(betsSection);

    /* ── Community ── */
    const commSection = document.createElement('div');
    commSection.className = 'psection';
    const lbHtml = p.leaderboard.map(l => `
      <div class="plb-row">
        <div class="plb-rank${l.rank === 1 ? ' gold' : ''}">${l.rank}</div>

        <div class="plb-mid">
          <div class="plb-name">${l.name}</div>
          <div class="plb-streak">${l.streak}</div>
        </div>

        <div class="plb-mid">
          <div class="plb-wr">${l.wr}</div>
          <div class="plb-wr-label">Win Rate</div>
        </div>
      </div>
    `).join('');
    const trendHtml = p.trendingPicks.slice(0, 3).map(t => `
      <div class="ptrend-pick">
        <div class="name">${t.name}</div>
        <div class="pct">${t.pct}</div>
      </div>
    `).join('');
    commSection.innerHTML = `
      <div class="psec-head"><h2>Community</h2></div>
      <div class="pcomm-grid">
        <div class="pcard" style="padding:14px">
          <div style="font-family:'Saira Condensed',sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;color:var(--text-primary,#eef3ff)">Weekly Leaderboard</div>
          ${lbHtml}
        </div>
        <div class="pcard" style="padding:14px">
          <div style="font-family:'Saira Condensed',sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;color:var(--text-primary,#eef3ff)">Trending Picks</div>
          ${trendHtml}
        </div>
      </div>`;
    v.appendChild(commSection);

    /* ── Achievements ── */
    const achSection = document.createElement('div');
    achSection.className = 'psection';
    const achHtml = p.achievements.map(a => `
      <div class="pcard pbadge-card${a.earned ? '' : ' locked'}">
        <div class="pbadge-emoji">${a.emoji}</div>
        <div class="pbadge-name">${a.name}</div>
        <div class="pbadge-desc">${a.desc}</div>
        ${!a.earned ? `<div class="pbadge-prog"><div class="fill" style="width:${a.progress}%"></div></div>` : ''}
      </div>`).join('');
    const earned = p.achievements.filter(a => a.earned).length;
    achSection.innerHTML = `
      <div class="psec-head"><h2>Achievements</h2><span class="sub">${earned} of ${p.achievements.length} earned</span></div>
      <div class="pbadge-grid">${achHtml}</div>`;
    v.appendChild(achSection);
  }

  /* ============================================================
     CAROUSEL HELPER (self-contained for profile)
     ============================================================ */
  function setupPCarousel(trackId, dotsId, prevSel, nextSel, scope) {
    const track  = scope.querySelector('#' + trackId);
    const dotsEl = scope.querySelector('#' + dotsId);
    const cards  = Array.from(track.children);
    if (!cards.length) return;

    cards.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'pdot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => track.scrollTo({ left: cards[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }));
      dotsEl.appendChild(d);
    });

    function updateDots() {
      const dots = Array.from(dotsEl.children);
      let closest = 0, minDist = Infinity;
      cards.forEach((c, i) => {
        const dist = Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === closest));
    }
    let rafPending = false;
    track.addEventListener('scroll', () => {
      if (!rafPending) { rafPending = true; requestAnimationFrame(() => { updateDots(); rafPending = false; }); }
    });

    // pointer drag
    let isDown = false, startX = 0, startScroll = 0;
    track.addEventListener('pointerdown', e => { isDown = true; startX = e.clientX; startScroll = track.scrollLeft; track.classList.add('dragging'); track.setPointerCapture(e.pointerId); });
    track.addEventListener('pointermove', e => { if (!isDown) return; track.scrollLeft = startScroll - (e.clientX - startX); });
    const endDrag = () => { isDown = false; track.classList.remove('dragging'); };
    track.addEventListener('pointerup',     endDrag);
    track.addEventListener('pointercancel', endDrag);

    scope.querySelector(prevSel).addEventListener('click', () => track.scrollBy({ left: -(cards[0].getBoundingClientRect().width + 12), behavior: 'smooth' }));
    scope.querySelector(nextSel).addEventListener('click', () => track.scrollBy({ left:  (cards[0].getBoundingClientRect().width + 12), behavior: 'smooth' }));

    updateDots();
  }

  /* ============================================================
     EDIT PROFILE MODAL
     ============================================================ */
  function buildEditProfileModal() {
    if (document.getElementById('epSheet')) return; // only once

    const overlay = document.createElement('div');
    overlay.className = 'ep-overlay';
    overlay.id = 'epOverlay';

    const sheet = document.createElement('div');
    sheet.className = 'ep-sheet';
    sheet.id = 'epSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Edit Profile');

    const LEAGUES = ['MLB', 'NFL', 'NBA', 'NHL', 'FIFA', 'WNBA', 'PGA', 'UFC'];

    sheet.innerHTML = `
      <div class="ep-head">
        <h3>Edit Profile</h3>
        <button class="ep-close" id="epClose" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="ep-body" id="epBody">

        <!-- Avatar -->
        <div class="ep-group">
          <div class="ep-group-title">Profile Photo</div>
          <div class="ep-avatar-row">
            <div class="ep-avatar-preview" id="epAvatarPreview" style="background:linear-gradient(145deg,#6fa3ff,#7a5cff)">NT</div>
            <div class="ep-avatar-btns">
              <button class="ep-upload-btn" id="epUploadBtn">Upload Photo</button>
              <button class="ep-clear-btn"  id="epClearBtn">Remove Photo</button>
              <input type="file" id="epFileInput" accept="image/*" style="display:none">
            </div>
          </div>
        </div>

        <!-- Basic info -->
        <div class="ep-group">
          <div class="ep-group-title">Basic Info</div>
          <div class="ep-field">
            <label for="epDisplayName">Display Name</label>
            <input class="ep-input" id="epDisplayName" type="text" maxlength="40" placeholder="Your name">
          </div>
          <div class="ep-field">
            <label for="epUsername">Username</label>
            <input class="ep-input" id="epUsername" type="text" maxlength="30" placeholder="@handle">
          </div>
          <div class="ep-field">
            <label for="epEmail">Email</label>
            <input class="ep-input" id="epEmail" type="email" placeholder="you@example.com">
          </div>
          <div class="ep-row2">
            <div class="ep-field">
              <label for="epCity">City</label>
              <input class="ep-input" id="epCity" type="text" placeholder="City">
            </div>
            <div class="ep-field">
              <label for="epState">State / Region</label>
              <input class="ep-input" id="epState" type="text" maxlength="30" placeholder="State">
            </div>
          </div>
        </div>

        <!-- Socials -->
        <div class="ep-group">
          <div class="ep-group-title">Social Media</div>
          <div class="ep-field">
            <label for="epIg">Instagram</label>
            <input class="ep-input" id="epIg" type="text" placeholder="@username">
          </div>
          <div class="ep-field">
            <label for="epX">X (Twitter)</label>
            <input class="ep-input" id="epX" type="text" placeholder="@username">
          </div>
          <div class="ep-field">
            <label for="epTt">TikTok</label>
            <input class="ep-input" id="epTt" type="text" placeholder="@username">
          </div>
          <div class="ep-field">
            <label for="epLi">LinkedIn</label>
            <input class="ep-input" id="epLi" type="text" placeholder="username or URL">
          </div>
          <div class="ep-field">
            <label for="epYt">YouTube</label>
            <input class="ep-input" id="epYt" type="text" placeholder="channel name or URL">
          </div>
        </div>

        <!-- Favorite Leagues -->
        <div class="ep-group">
          <div class="ep-group-title">Favorite Leagues</div>
          <div class="ep-league-chips" id="epLeagueChips">
            ${LEAGUES.map(lg => `<button class="ep-league-chip" data-league="${lg}">${lg}</button>`).join('')}
          </div>
        </div>

        <!-- Fav Teams (text, comma-separated) -->
        <div class="ep-group">
          <div class="ep-group-title">Favorite Teams</div>
          <div class="ep-field">
            <label for="epFavTeams">Teams (comma-separated)</label>
            <input class="ep-input" id="epFavTeams" type="text" placeholder="e.g. Eagles, Lakers, Yankees">
          </div>
        </div>

        <!-- Fav Players -->
        <div class="ep-group">
          <div class="ep-group-title">Favorite Players</div>
          <div class="ep-field">
            <label for="epFavPlayers">Players (comma-separated)</label>
            <input class="ep-input" id="epFavPlayers" type="text" placeholder="e.g. Saquon Barkley, Mike Trout">
          </div>
        </div>

      </div><!-- /ep-body -->

      <div class="ep-footer">
        <button class="ep-cancel-btn" id="epCancel">Cancel</button>
        <button class="ep-save-btn"   id="epSave">Save Profile</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);

    /* — populate fields from PROFILE — */
    function populateFields() {
      const p = window.PROFILE;
      document.getElementById('epDisplayName').value = p.displayName || '';
      document.getElementById('epUsername').value    = p.name        || '';
      document.getElementById('epEmail').value       = p.email       || '';
      document.getElementById('epCity').value        = p.city        || '';
      document.getElementById('epState').value       = p.state       || '';
      document.getElementById('epIg').value  = p.socials.instagram || '';
      document.getElementById('epX').value   = p.socials.x         || '';
      document.getElementById('epTt').value  = p.socials.tiktok    || '';
      document.getElementById('epLi').value  = p.socials.linkedin  || '';
      document.getElementById('epYt').value  = p.socials.youtube   || '';

      // fav teams / players as comma string
      document.getElementById('epFavTeams').value   = p.favTeams.map(t => `${t.city} ${t.name}`).join(', ');
      document.getElementById('epFavPlayers').value = p.favPlayers.map(pl => pl.name).join(', ');

      // league chips
      document.querySelectorAll('.ep-league-chip').forEach(chip => {
        chip.classList.toggle('on', (p.favLeagues || []).includes(chip.dataset.league));
      });

      // avatar preview
      const prev = document.getElementById('epAvatarPreview');
      if (p.avatarUrl) {
        prev.style.background = '';
        prev.innerHTML = `<img src="${p.avatarUrl}" alt="Avatar">`;
      } else {
        prev.style.background = p.avatarColor;
        prev.textContent = p.avatarInitials;
      }
    }

    /* — open / close — */
    function openEP() { populateFields(); overlay.classList.add('open'); sheet.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeEP() { overlay.classList.remove('open'); sheet.classList.remove('open'); document.body.style.overflow = ''; }

    overlay.addEventListener('click', closeEP);
    document.getElementById('epClose').addEventListener('click', closeEP);
    document.getElementById('epCancel').addEventListener('click', closeEP);

    /* — league chip toggle — */
    document.getElementById('epLeagueChips').addEventListener('click', e => {
      const chip = e.target.closest('.ep-league-chip');
      if (chip) chip.classList.toggle('on');
    });

    /* — avatar upload — */
    document.getElementById('epUploadBtn').addEventListener('click', () => document.getElementById('epFileInput').click());
    document.getElementById('epFileInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const prev = document.getElementById('epAvatarPreview');
        prev.style.background = '';
        prev.innerHTML = `<img src="${ev.target.result}" alt="Avatar">`;
        window.PROFILE._pendingAvatarUrl = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('epClearBtn').addEventListener('click', () => {
      const p = window.PROFILE;
      const prev = document.getElementById('epAvatarPreview');
      prev.style.background = p.avatarColor;
      prev.innerHTML = p.avatarInitials;
      window.PROFILE._pendingAvatarUrl = '';
    });

    /* — save — */
    document.getElementById('epSave').addEventListener('click', () => {
      const p = window.PROFILE;
      p.displayName = document.getElementById('epDisplayName').value.trim() || p.displayName;
      p.name        = document.getElementById('epUsername').value.trim().replace(/^@/, '') || p.name;
      p.email       = document.getElementById('epEmail').value.trim() || p.email;
      p.city        = document.getElementById('epCity').value.trim()  || p.city;
      p.state       = document.getElementById('epState').value.trim() || p.state;
      p.socials.instagram = document.getElementById('epIg').value.trim();
      p.socials.x         = document.getElementById('epX').value.trim();
      p.socials.tiktok    = document.getElementById('epTt').value.trim();
      p.socials.linkedin  = document.getElementById('epLi').value.trim();
      p.socials.youtube   = document.getElementById('epYt').value.trim();

      p.favLeagues = [...document.querySelectorAll('.ep-league-chip.on')].map(c => c.dataset.league);

      if (p._pendingAvatarUrl !== undefined) {
        p.avatarUrl = p._pendingAvatarUrl;
        delete p._pendingAvatarUrl;
      }

      // also sync with USER object if it exists
      if (window.USER) {
        window.USER.name = p.displayName;
        window.USER.handle = p.name;
      }

      closeEP();
      profileToast('Profile saved ✓');

      // re-render profile if currently viewing it
      if (window.appState && window.appState.view === 'profile') renderProfile();
      // also refresh home greeting if visible
      if (document.getElementById('view-home') && document.getElementById('view-home').classList.contains('active')) {
        if (typeof renderHome === 'function') renderHome();
      }
    });

    // expose so Settings can open it
    window.openEditProfile = openEP;
  }

  /* ============================================================
     INJECT VIEW + TAB + SETTINGS ROW + PATCH RENDERERS
     ============================================================ */
  function patchApp() {
    if (window.innerHeight < 800) {
        device.classList.add("compact");
    }
    /* 1. Add view div */
    const viewport = document.getElementById('viewport');
    if (viewport && !document.getElementById('view-profile')) {
      const vp = document.createElement('div');
      vp.className = 'view';
      vp.id = 'view-profile';
      viewport.appendChild(vp);
    }

    /* 2. Add tab to bottom nav */
    const tabs = document.querySelector('.tabs') || document.querySelector('.tab-bar') || document.querySelector('nav');
    if (tabs && !tabs.querySelector('[data-view="profile"]')) {
      const tab = document.createElement('button');
      tab.className = 'tab';
      tab.dataset.view = 'profile';
      tajjjj.setAttribute('aria-label', 'Profile');
      tab.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>
        </svg>
        <span>Profile</span>`;
      tabs.appendChild(tab);
      tab.addEventListener('click', () => {
        if (typeof navigate === 'function') navigate('profile');
      });
    }

    /* 3. Register renderer */
    if (window.RENDERERS) {
      window.RENDERERS.profile = renderProfile;
    }

    /* 4. Patch navigate to know about profile */
    const origNavigate = window.navigate;
    if (origNavigate && !window._profileNavPatched) {
      window._profileNavPatched = true;
      window.navigate = function (view) {
        if (view === 'profile') {
          window.appState = window.appState || {};
          window.appState.view = 'profile';
          renderProfile();
          document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-profile'));
          document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'profile'));
          const vp = document.getElementById('viewport');
          if (vp) vp.scrollTop = 0;
        } else {
          origNavigate(view);
          window.appState = window.appState || {};
          window.appState.view = view;
        }
      };
    }

    /* 5. Add "Edit Profile" row to Settings panel */
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && !settingsPanel.querySelector('[data-ep-row]')) {
      // find the first setting row and insert before it
      const firstRow = settingsPanel.querySelector('.setting-row');
      const epRow = document.createElement('div');
      epRow.className = 'setting-row ep-link';
      epRow.setAttribute('data-ep-row', '');
      epRow.setAttribute('role', 'button');
      epRow.setAttribute('tabindex', '0');
      epRow.innerHTML = `
        <div class="lbl-block">
          <div class="t">Edit Profile</div>
          <div class="d">Photo, username, socials, teams &amp; leagues</div>
        </div>
        <div class="arrow-ic">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>`;
      epRow.addEventListener('click', () => {
        if (typeof window.openEditProfile === 'function') window.openEditProfile();
      });
      epRow.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') epRow.click(); });
      if (firstRow) settingsPanel.insertBefore(epRow, firstRow);
      else settingsPanel.appendChild(epRow);
    }

    /* 6. Build modal */
    buildEditProfileModal();
  }

  /* ============================================================
     INIT — run after DOM + app are ready
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(patchApp, 50));
  } else {
    setTimeout(patchApp, 50);
  }

  navigate("profile")
})();
