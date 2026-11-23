/* 한 사람 몫의 식탁 — 쯔꾸르풍 웹 엔진
   화면 816×624, 타일 48px, 캐릭터 시트 144×192(3프레임×4방향), 얼굴 576×288(144×144 표정 8칸) */
'use strict';

const TILE = 48, SW = 816, SH = 624;
/* 글꼴 (v2.9): 갈무리 픽셀 글꼴(Galmuri, SIL OFL 1.1, assets/fonts). 픽셀 글꼴은 정해진 크기의 배수에서만 또렷하므로
   ctx.font에 적힌 크기를 가장 가까운 '또렷한 크기'로 맞춘다: Galmuri9 10px, Galmuri11 12·24·36px, Galmuri14 15·30·45·60px. */
const FONT = '"Galmuri11","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const SERIF = FONT;
(function snapPixelFonts() {
  const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  if (!desc || !desc.set) return;
  const cache = new Map();
  const pick = (n) => n <= 11 ? ['Galmuri9', 10, false] : n <= 13 ? ['Galmuri11', 12, true] : n <= 19 ? ['Galmuri14', 15, false]
    : n <= 27 ? ['Galmuri11', 24, true] : n <= 33 ? ['Galmuri14', 30, false]
    : n <= 40 ? ['Galmuri11', 36, true] : n <= 50 ? ['Galmuri14', 45, false] : ['Galmuri14', 60, false];
  function snap(f) {
    let out = cache.get(f); if (out) return out;
    const m = /^(?:italic )?(bold )?(\d+(?:\.\d+)?)px (.*)$/.exec(f);
    out = f;
    if (m && m[3].includes('Galmuri11')) {
      const [fam, size, canBold] = pick(+m[2]);
      out = `${m[1] && canBold ? 'bold ' : ''}${size}px "${fam}","Noto Sans KR",sans-serif`;
    }
    cache.set(f, out); return out;
  }
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, snap(String(v))); },
  });
})();
const DIRS = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
const SAVE_KEY = 'one_persons_table_save_v1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ------------------------------------------------------------------ assets */
const IMG = {};
const ASSET_LIST = {
  characters: ['hero_m', 'hero_f', 'yuri', 'ian', 'momo', 'teacher', 'student_1', 'student_2', 'student_3', 'student_4',
    'hero_m_pose', 'hero_f_pose', 'yuri_pose'],
  faces: ['face_hero_m', 'face_hero_f', 'face_yuri', 'face_ian', 'face_momo', 'face_teacher'],
  cg: ['cg_title', 'cg_prologue_m', 'cg_prologue_f', 'cg_mem_ticket', 'cg_mem_letter', 'cg_mem_lunchbox', 'cg_day3_dream_m', 'cg_day3_dream_f',
    'cg_day4_meal', 'cg_day6_plates', 'cg_day7_table', 'cg_end_bad1', 'cg_end_bad2', 'cg_end_normal', 'cg_end_true', 'cg_end_secret'],
  tilesets: ['tiles_classroom', 'tiles_hallway', 'tiles_cafeteria', 'tiles_chapel', 'tiles_outdoor', 'tiles_basement'],
  icons: ['icon_map', 'icon_ticket', 'icon_hairtie', 'icon_torn_letter', 'icon_attendance', 'icon_empty_plate', 'icon_old_letter', 'icon_ritual_record', 'icon_lunchbox', 'icon_doctrine', 'icon_zero_report'],
};
/* 있으면 쓰고 없으면 건너뛰는 그림 (없어도 경고하지 않음) */
const OPTIONAL_ASSETS = {
  cg: ['cg_day1_dream', 'cg_day2_bed', 'cg_day3_basement_eye', 'cg_day4_special_meal', 'scare_mirror', 'scare_eye', 'scare_meal', 'scare_stairs',
    /* 대본 v2.0 새 CG — 없으면 기존 그림이나 CG 없이 진행 */
    'cg_mem_ribbon', 'cg_mem_firstlunch', 'cg_day3_yuri_awake', 'cg_day6_momo_tag', 'cg_day6_ian_momo', 'cg_day7_momo_gate', 'cg_day7_leftover', 'cg_end_true_lunchbox',
    'cg_title_after'],   // 결말 5개를 모두 본 뒤의 타이틀
  icons: ['icon_ribbon', 'icon_yuri_notes', 'icon_ian_pieces', 'icon_ian_notebook', 'deco_record_box', 'deco_record_box_open', 'deco_tray'],
  characters: ['monster_shadow', 'monster_union', 'monster_union_anim', 'monster_shadow_anim'],
};
/* 단계별 타일셋 (v2.4) — 오염된 학교는 타일셋 그림을 통째로 바꿔서 보여 준다.
   기본 파일(tiles_xxx.png) = DAY 1~3, _s2 = DAY 4~5, _s3 = DAY 6~7, _s4 = DAY 7만(선택, 없으면 _s3).
   칸 번호·배치는 기본 타일셋과 같다. 없는 단계는 바로 아래 단계 그림을 쓴다. */
const TILE_STAGE_OF_DAY = [1, 1, 1, 1, 2, 2, 3, 4];
OPTIONAL_ASSETS.tilesets = ASSET_LIST.tilesets.flatMap(t => [t + '_s2', t + '_s3', t + '_s4']);
function tileStage() { return UI.title ? 1 : (TILE_STAGE_OF_DAY[G.day] || 1); }
function stageSheet(ts) { for (let k = tileStage(); k >= 2; k--) if (IMG[`${ts}_s${k}`]) return `${ts}_s${k}`; return ts; }
/* 변형 칸 (v2.7) — 시트는 8×8칸.
   1단계: 기본·단계 시트 공통. 바닥 변형(32~37), 칠판 변형(38~39), 벽 장식(40~45: 초상화·풍경화·촛대·문장·십자가·찢긴 벽지), 윗벽(46~47).
   2단계: 오염 단계 시트에만 있는 추가 오염 변형(48~63). 같은 핏자국이 칸마다 되풀이되지 않게 한다.
   384×192(4줄) 시트를 넣으면 변형 없이 0~31번만 쓴다. */
const W8 = (base, ...v) => [base, base, base, base, base, base, base, base, ...v];
const TILE_VARIANTS = {
  tiles_classroom: { 0: [0, 0, 0, 32, 33, 34, 35], 16: [16, 16, 36, 37], 1: W8(1, 40, 41, 42, 43, 44, 45), 2: [2, 2, 2, 2, 2, 46, 47], 4: [4, 38, 39] },
  tiles_hallway:   { 0: [0, 0, 0, 32, 33, 34, 35], 1: W8(1, 40, 41, 42, 43, 44, 45), 2: [2, 2, 2, 2, 2, 46, 47] },
  tiles_cafeteria: { 0: [0, 0, 0, 32, 33, 34, 35], 1: W8(1, 42, 42, 43, 45), 2: [2, 2, 2, 2, 2, 46, 47] },
  tiles_chapel:    { 0: [0, 0, 0, 32, 33, 34, 35], 1: W8(1, 40, 41, 42, 42, 43, 44), 2: [2, 2, 2, 2, 2, 46, 47] },
  tiles_basement:  { 0: [0, 0, 0, 32, 33, 34, 35], 1: W8(1, 40, 41, 43) },
  tiles_outdoor:   { 0: [0, 0, 32, 33, 34, 35], 1: [1, 1, 36, 37] },
};
const STAGE_EXTRA = {
  tiles_classroom: { 0: [0, 48, 49, 50, 51, 52, 53, 54], 16: [16, 55, 56, 57], 1: [1, 58, 59, 60, 61], 2: [2, 62, 63] },
  tiles_hallway:   { 0: [0, 48, 49, 50, 51, 52, 53, 54], 1: [1, 58, 59, 60, 61], 2: [2, 62, 63] },
  tiles_cafeteria: { 0: [0, 48, 49, 50, 51, 52, 53, 54], 1: [1, 58, 59, 60, 61], 2: [2, 62, 63] },
  tiles_chapel:    { 0: [0, 48, 49, 50, 51, 52, 53, 54], 1: [1, 58, 59, 60, 61], 2: [2, 62, 63] },
  tiles_basement:  { 0: [0, 48, 49, 50, 51, 52, 53, 54], 1: [1, 58, 59, 60, 61], 2: [2, 62, 63] },
  tiles_outdoor:   { 0: [0, 48, 49, 50, 51, 52, 53, 54], 1: [1, 55, 56, 57], 4: [4, 58, 59, 60, 61] },
};
function stageIdx(ts, idx, mx, my) {
  if (mx === undefined) return idx;
  const key = stageSheet(ts), im = IMG[key];
  if (!im || im.height < TILE * 8) return idx;                       // 변형 칸이 없는 시트
  const v = TILE_VARIANTS[ts] && TILE_VARIANTS[ts][idx];
  if (v) idx = pickVariant(v, mx * 7 + 3, my * 5 + 1);
  if (key !== ts) {
    const e = STAGE_EXTRA[ts] && STAGE_EXTRA[ts][idx];
    if (e) idx = pickVariant(e, mx * 11 + 5, my * 3 + 7);
  }
  return idx;
}
function mapTilesets() {
  const out = new Set();
  for (const v of Object.values((MAP && MAP.legend) || {})) { const d = typeof v === 'function' ? v() : v; if (d && d[0]) out.add(d[0]); }
  return out;
}
/* 이 맵의 타일셋 중 하나라도 단계별 그림이 있으면, 코드로 그리던 얼룩·피·핏줄·살덩이 층은 끈다 */
function mapHasStageArt() {
  for (const t of mapTilesets()) for (const k of [2, 3, 4]) if (IMG[`${t}_s${k}`]) return true;
  return false;
}
function loadAssets() {
  const jobs = [];
  for (const n of GENDERED_CG) for (const g of ['m', 'f']) {
    const k = `${n}_${g}`;
    jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = `assets/cg/${k}.png`; }));
  }
  for (const [dir, names] of Object.entries(OPTIONAL_ASSETS)) for (const n of names)
    jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = () => res(); im.src = `assets/${dir}/${n}.png`; }));
  for (const [dir, names] of Object.entries(ASSET_LIST)) {
    for (const n of names) {
      jobs.push(new Promise(res => {
        const im = new Image();
        im.onload = () => { IMG[n] = im; res(); };
        im.onerror = () => { console.warn('missing asset', dir + '/' + n); res(); };
        im.src = `assets/${dir}/${n}.png`;
      }));
    }
  }
  return Promise.all(jobs);
}

/* 성별별 CG: 아래 목록에 있는 CG는 cg_xxx_m.png / cg_xxx_f.png를 찾아 주인공 성별에 맞춰 사용하고, 없으면 cg_xxx.png를 쓴다.
   다른 CG를 성별별로 나누려면 이 목록에 이름을 추가하고 _m, _f 파일을 넣으면 된다. */
const GENDERED_CG = ['cg_end_bad1', 'cg_end_true', 'cg_end_normal'];
/* CG 위에 게임 글자를 얹는 곳 — 그림의 명패 등 (좌표는 816×624 원본 기준) */
const CG_OVERLAY = {
  cg_day4_meal(c) { // 급식실 명패: 반 + 플레이어 이름
    c.translate(672, 449); c.rotate(-0.045);
    c.fillStyle = 'rgba(48,34,44,0.92)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `15px ${FONT}`; c.fillText('2학년 A반', 0, -12);
    const nm = G.name || '……';
    c.font = `bold ${nm.length > 4 ? 16 : 20}px ${FONT}`; c.fillText(nm, 0, 13);
  },
};
function drawCgOverlay(name, x = 0, y = 0, w = SW, h = SH) {
  const f = CG_OVERLAY[name]; if (!f) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(w / SW, h / SH); f(ctx); ctx.restore();
}
function cgKey(n) { const k = `${n}_${G.gender}`; return IMG[k] ? k : n; }

/* ------------------------------------------------------------------ audio (WebAudio 합성 — 오르골) */
const Sound = {
  ctx: null, master: null, on: true, track: null, timer: null, next: 0, step: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.32 : 0;
      this.master.connect(this.ctx.destination);
      {   // 잔향 — 잡음으로 만든 울림(2.6초)
        const c = this.ctx, len = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb = c.createConvolver(); this.verb.buffer = ir;
        const wet = c.createGain(); wet.gain.value = 0.55; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        this.verb.connect(lp); lp.connect(wet); wet.connect(this.master);
      }
      if (this.pending) { const p = this.pending; this.pending = null; this.bgm(p); }
    } catch (e) { this.ctx = null; }
  },
  silence(ms) {
    if (!this.master) return;
    const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.setValueAtTime(this.on ? 0.32 : 0, t + ms / 1000);
  },
  noise(t, dur, vol, hp = 0) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(), g = c.createGain(); src.buffer = buf; g.gain.value = vol;
    let node = src;
    if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; src.connect(f); node = f; }
    node.connect(g); g.connect(this.master); src.start(t);
  },
  toggle() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.32 : 0;
  },
  tone(freq, t, dur, vol = 0.2, type = 'sine', dest) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  /* ---------------- 음악 (v5.2) — 정해진 가락을 되풀이하지 않고, 화음 진행 위에서 마디마다 새로 지어낸다.
     층: 패드(느린 화음) · 오르골 가락 · 베이스 · 가끔 들리는 주변 소리. 잔향 있음.
     날이 갈수록(DAY 1→7) 음이 조금씩 어긋나고 느려지고 가락이 빠진다. 추격 중에는 낮은 맥박이 깔린다. */
  hz(m, cents = 0) { return 440 * Math.pow(2, (m - 69 + cents / 100) / 12); },
  out() { return this.mus || this.master; },
  // 오르골 한 음 (잔향으로도 보냄)
  box(midi, t, dur, vol, detune = 0, dest) {
    const f = this.hz(midi, detune), d = dest || this.out();
    this.tone(f, t, dur, vol, 'sine', d);
    this.tone(f * 2, t, dur * 0.5, vol * 0.25, 'triangle', d);
    this.tone(f * 3.01, t, dur * 0.18, vol * 0.08, 'sine', d);
  },
  // 느리게 부풀었다 꺼지는 화음 한 음
  pad(midi, t, dur, vol, cents = 0, cut = 900, type = 'triangle') {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.25);
    for (const dc of [-7, 6]) {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(this.hz(midi, cents + dc), t);
      o.connect(lp); o.start(t); o.stop(t + dur * 1.3);
    }
    lp.connect(g); g.connect(this.out());
  },
  // 걸러 낸 잡음 (바람 · 삐걱임)
  air(t, dur, vol, freq, q = 1.2, sweep = 0) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.linearRampToValueAtTime(freq + sweep, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out()); src.start(t);
  },
  CH: { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14] },
  /* beat: 한 박(초) · steps: 한 마디의 박 수 · prog/progB: [근음(미디), 화음] 진행(번갈아 나옴) · scale: 가락이 쓰는 음계(으뜸음 기준)
     pad/box/bass: 층별 음량 · dens: 가락이 얼마나 촘촘한지 · hi: 가락의 가운데 높이 · amb: 주변 소리 */
  TRACKS: {
    title:   { beat: 0.46, steps: 6, key: 57, scale: [0, 2, 3, 5, 7, 8, 10], hi: 79, pad: 0.030, box: 0.105, bass: 0.05, dens: 0.55,
      prog: [[57, 'm'], [53, 'M7'], [48, 'M'], [52, 'M'], [57, 'm'], [50, 'm7'], [53, 'M'], [52, 'sus']],
      progB: [[53, 'M7'], [55, 'M'], [57, 'm'], [57, 'm'], [50, 'm'], [52, 'M'], [57, 'm'], [57, 'sus']] },
    title2:  { beat: 0.56, steps: 6, key: 57, scale: [0, 2, 3, 5, 7, 8, 11], hi: 81, pad: 0.034, box: 0.085, bass: 0.055, dens: 0.4, rot: 0.5,
      prog: [[57, 'm'], [53, 'M7'], [50, 'm6'], [52, 'M'], [57, 'm'], [58, 'M'], [52, 'M'], [57, 'm']],
      progB: [[50, 'm'], [57, 'm'], [53, 'aug'], [52, 'M'], [50, 'm7'], [51, 'dim'], [52, 'M'], [57, 'm']] },
    day:     { beat: 0.30, steps: 6, key: 60, scale: [0, 2, 4, 5, 7, 9, 11], hi: 79, pad: 0.022, box: 0.092, bass: 0.04, dens: 0.72,
      prog: [[60, 'M'], [57, 'm'], [53, 'M'], [55, 'M'], [60, 'M'], [52, 'm'], [53, 'M'], [53, 'm']],
      progB: [[57, 'm'], [53, 'M7'], [60, 'M'], [55, 'sus'], [50, 'm7'], [55, 'M'], [60, 'add9'], [60, 'M']] },
    evening: { beat: 0.42, steps: 6, key: 57, scale: [0, 2, 3, 5, 7, 8, 10], hi: 76, pad: 0.036, box: 0.07, bass: 0.05, dens: 0.45, rot: 0.25, amb: 'creak',
      prog: [[57, 'm'], [50, 'm7'], [55, 'M'], [48, 'M7'], [53, 'M'], [50, 'm'], [52, 'sus'], [52, 'M']],
      progB: [[53, 'M7'], [48, 'M'], [50, 'm7'], [57, 'm'], [53, 'M'], [55, 'M'], [57, 'm'], [52, 'M']] },
    chapel:  { beat: 0.62, steps: 4, key: 50, scale: [0, 2, 3, 5, 7, 8, 10], hi: 74, pad: 0.05, box: 0.045, bass: 0.07, dens: 0.3, organ: true, amb: 'toll',
      prog: [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M'], [43, 'm'], [50, 'm'], [45, 'sus'], [45, 'M']],
      progB: [[50, 'm'], [55, 'm'], [46, 'M7'], [45, 'M'], [53, 'M'], [48, 'M'], [45, 'M'], [50, 'm']] },
    night:   { beat: 0.9, steps: 4, key: 45, scale: [0, 1, 3, 5, 6, 8, 10], hi: 84, pad: 0.03, box: 0.05, bass: 0.06, dens: 0.16, rot: 0.6, amb: 'wind', dark: true,
      prog: [[45, 'm'], [45, 'm'], [46, 'M7'], [45, 'm'], [41, 'M7'], [45, 'm6'], [51, 'dim'], [45, 'sus']],
      progB: [[45, 'm'], [50, 'm'], [45, 'm'], [46, 'aug'], [45, 'm'], [39, 'M'], [40, 'M'], [45, 'm']] },
  },
  RHY: {   // 박마다 음이 날 가능성(0~1). 한 마디에 하나씩 고른다
    6: [[1, 0, .7, .2, .8, .3], [1, .5, 0, .9, 0, .5], [.9, 0, 0, .9, .6, .6], [1, .3, .6, .3, .6, 0], [.8, 0, .5, 0, .2, 0], [0, .8, .8, .9, 0, .4]],
    4: [[1, 0, .6, 0], [.9, .4, 0, .5], [1, 0, 0, .3], [0, .8, 0, .7], [.9, .6, .6, 0]],
  },
  rot() {   // 0(DAY 1) ~ 1(DAY 7) — 날이 갈수록, 방과 후·밤일수록 더 망가짐
    if (UI.title) return 0;
    const d = Math.max(0, Math.min(6, (G.day || 1) - 1)) / 6;
    return Math.min(1, d + (G.phase >= 3 ? 0.08 : 0));
  },
  bgm(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.track === name) return;
    clearInterval(this.timer); this.timer = null; this.track = name;
    const c = this.ctx, t0 = c.currentTime;
    if (this.mus) { const old = this.mus; old.gain.cancelScheduledValues(t0); old.gain.setValueAtTime(old.gain.value, t0); old.gain.linearRampToValueAtTime(0, t0 + (name ? 0.9 : 0.12)); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 1500); }
    this.mus = null;
    const tr = this.TRACKS[name];
    if (!tr) return;
    this.mus = c.createGain(); this.mus.gain.setValueAtTime(0, t0); this.mus.gain.linearRampToValueAtTime(1, t0 + 1.2);
    this.mus.connect(this.master); if (this.verb) { const send = c.createGain(); send.gain.value = 0.4; this.mus.connect(send); send.connect(this.verb); }
    const st = this.st = { bar: 0, last: tr.hi, motif: null, cycle: 0 };
    this.next = t0 + 0.15;
    this.timer = setInterval(() => { while (this.next < this.ctx.currentTime + 0.5) this.bar(tr, st); }, 90);
  },
  bar(tr, st) {
    const rot = Math.min(1, this.rot() + (tr.rot || 0) * 0.5), R = Math.random;
    const beat = tr.beat * (1 + rot * 0.22), dur = beat * tr.steps, t = this.next;
    const prog = (st.cycle % 2 === 1 && tr.progB) ? tr.progB : tr.prog;
    const [root, q] = prog[st.bar % prog.length], iv = this.CH[q];
    const wob = (R() * 2 - 1) * rot * 22 - rot * 10;                 // 마디마다 조금씩 다른 음높이(늘어진 테이프)
    const cut = (tr.dark ? 620 : 1100) - rot * 380;
    // 패드
    iv.forEach((x, i) => this.pad(root + 12 + x, t + i * 0.04, dur, tr.pad * (i ? 0.8 : 1), wob, cut, tr.organ ? 'sawtooth' : 'triangle'));
    if (tr.organ) this.pad(root + 24 + iv[2 % iv.length], t, dur, tr.pad * 0.35, wob, cut * 0.8, 'triangle');
    // 베이스
    this.tone(this.hz(root - 12, wob), t, dur * 0.95, tr.bass, 'sine', this.out());
    if (rot > 0.55 && st.bar % 4 === 3) this.tone(this.hz(root - 6, wob), t + dur * 0.5, dur * 0.6, tr.bass * 0.55 * rot, 'sine', this.out());   // 어긋난 낮은 음
    // 가락 — 음계에서 고른 음들 가운데, 화음 음을 중심으로 조금씩 움직인다
    const pcs = new Set(tr.scale.map(x => (tr.key + x) % 12)), chord = new Set(iv.map(x => (root + x) % 12));
    const pool = []; for (let m = tr.hi - 10; m <= tr.hi + 11; m++) if (pcs.has(m % 12) || chord.has(m % 12)) pool.push(m);
    const near = (m, only) => { let b = pool[0], bd = 99; for (const p of pool) { if (only && !chord.has(p % 12)) continue; const dd = Math.abs(p - m) + R() * 1.5; if (dd < bd) { bd = dd; b = p; } } return b; };
    const pat = this.RHY[tr.steps], pos = st.bar % 4;
    let motif;
    if ((pos === 1 || pos === 2) && st.motif && R() < 0.6) motif = st.motif.map(n => ({ s: n.s, d: n.d + (R() < 0.25 ? (R() < 0.5 ? 1 : -1) : 0) }));   // 앞 마디를 살짝 바꿔 되받기
    else {
      const rh = pat[Math.floor(R() * pat.length)]; motif = []; let d = 0;
      rh.forEach((p, s) => { if (R() < p * (0.45 + tr.dens * 0.75)) { d += [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(R() * 8)]; d = Math.max(-5, Math.min(5, d)); motif.push({ s, d }); } });
      if (pos === 3 && R() < 0.5) motif = motif.slice(0, 2);       // 구절 끝은 비워 둔다
    }
    st.motif = motif;
    const start = pool.indexOf(near(st.last + (st.last > tr.hi + 5 ? -4 : st.last < tr.hi - 5 ? 4 : 0), true));
    let lastNote = st.last;
    for (const n of motif) {
      if (R() < rot * 0.3) continue;                                 // 빠지는 음
      let m = pool[Math.max(0, Math.min(pool.length - 1, start + n.d))];
      if (n.s === 0) m = near(m, true);
      if (R() < rot * 0.14) m += R() < 0.5 ? -1 : 1;                   // 틀린 음
      const cents = wob + (R() * 2 - 1) * rot * 18, tt = t + n.s * beat + (R() * 2 - 1) * 0.012 + (R() < rot * 0.2 ? beat * 0.33 : 0);
      this.box(m, tt, beat * (3 + R() * 2.5), tr.box * (n.s === 0 ? 1 : 0.72 + R() * 0.25), cents);
      if (!tr.dark && n.s === 0 && R() < 0.3) this.box(m - (R() < 0.5 ? 12 : 5), tt + beat * 0.5, beat * 3, tr.box * 0.4, cents);   // 가끔 따라붙는 아랫음
      lastNote = m;
    }
    st.last = lastNote;
    // 주변 소리
    if (tr.amb === 'wind' && st.bar % 2 === 0) this.air(t, dur * 2.2, 0.035 + rot * 0.02, 260 + R() * 240, 0.8, (R() * 2 - 1) * 180);
    if (tr.amb === 'creak' && R() < 0.10 + rot * 0.1) this.air(t + R() * dur, 0.5 + R() * 0.5, 0.02, 700 + R() * 500, 9, 260);
    if (tr.amb === 'toll' && st.bar % 8 === 6) { this.box(root + 12, t, dur * 2.5, 0.07, wob); this.box(root + 19, t + 0.02, dur * 2, 0.03, wob); }
    if (rot > 0.4 && R() < (rot - 0.3) * 0.25) this.air(t + R() * dur, 1.4, 0.014, 1800 + R() * 900, 14, -500);      // 멀리서 긁는 소리
    // 추격 중 — 낮은 맥박
    if (typeof Chase !== 'undefined' && Chase.active) {
      const hot = Chase.mons && Chase.mons.some(m => !m.gone && m.state === 'chase'), gap = hot ? 0.36 : 0.78;
      for (let x = 0; x < dur - 0.05; x += gap) { this.tone(52, t + x, 0.16, hot ? 0.3 : 0.16, 'sine', this.master); this.tone(49, t + x + 0.13, 0.18, hot ? 0.22 : 0.1, 'sine', this.master); }
      if (hot) this.pad(root + 13, t, dur, tr.pad * 0.9, wob, 700, 'sawtooth');
    }
    this.next += dur; st.bar++;
    if (st.bar % prog.length === 0) st.cycle++;
  },
  sfx(name, voice) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01, R = Math.random, wet = this.verb;
    switch (name) {
      case 'blip': {   // 말하는 사람마다 다른 높이·음색, 글자마다 조금씩 다르게
        const V = { face_yuri: [880, 'triangle', 0.085], face_ian: [520, 'triangle', 0.09], face_momo: [415, 'triangle', 0.095], face_teacher: [700, 'triangle', 0.085],
          face_hero_f: [620, 'triangle', 0.085], face_hero_m: [370, 'triangle', 0.1] }[voice] || [300, 'triangle', 0.07];
        this.tone(V[0] * Math.pow(2, [0, 2, 3, 5, 7, -2][Math.floor(R() * 6)] / 12), t, 0.05, V[2], V[1]); break;
      }
      case 'chime': { const set = [[84, 88, 91, 96], [84, 86, 91, 95], [81, 88, 91, 93]][Math.floor(R() * 3)]; set.forEach((n, i) => { this.box(n, t + i * 0.09, 0.9, 0.12, 0, this.master); if (wet) this.box(n, t + i * 0.09, 0.9, 0.05, 0, wet); }); break; }
      case 'bell': { const rot = this.rot(); [76, 72, 74, 67, 67, 74, 76, 72].forEach((n, i) => { const tt = t + i * (0.55 + rot * 0.12) + (i > 3 ? 0.4 : 0), dc = -rot * 35 + (R() * 2 - 1) * rot * 25; this.box(n, tt, 2.2, 0.11, dc, this.master); this.box(n - 12, tt, 2.6, 0.04, dc, this.master); if (wet) this.box(n, tt, 2.2, 0.06, dc, wet); }); break; }
      case 'door': { const k = 0.9 + R() * 0.25; this.tone(140 * k, t, 0.12, 0.12, 'triangle'); this.tone(90 * k, t + 0.05, 0.18, 0.1, 'triangle'); this.noise(t, 0.09, 0.06, 900); if (R() < 0.5) this.air(t + 0.08, 0.35, 0.03, 600 + R() * 300, 10, 220); break; }
      case 'thud': this.tone(56 + R() * 10, t, 0.35, 0.3, 'sine'); this.noise(t, 0.08, 0.08); break;
      case 'select': this.tone(990, t, 0.05, 0.05, 'triangle'); break;
      case 'next': this.tone(330, t, 0.035, 0.022, 'sine'); break;   // 대화창 넘김 — 아주 작게
      case 'cursor': this.tone(740, t, 0.03, 0.03, 'triangle'); break;
      case 'page': this.air(t, 0.16 + R() * 0.06, 0.07, 2600 + R() * 900, 1.4, -1200); break;
      case 'scare': this.noise(t, 0.7, 0.9); this.tone(48, t, 0.8, 0.6, 'sawtooth'); this.tone(1870, t, 0.5, 0.18, 'square'); this.tone(1990, t + 0.02, 0.5, 0.15, 'square'); break;
      case 'static': this.noise(t, 0.18, 0.25, 1800); break;
      case 'heart': this.tone(55, t, 0.18, 0.35, 'sine'); this.tone(52, t + 0.24, 0.2, 0.3, 'sine'); break;
      case 'step': { const k = 0.9 + R() * 0.2; this.tone(70 * k, t, 0.08, 0.12, 'triangle'); this.tone(64 * k, t + 0.19 + R() * 0.05, 0.08, 0.1, 'triangle'); break; }
      case 'clank': this.tone(1240, t, 0.25, 0.08, 'square'); this.tone(860, t + 0.03, 0.3, 0.07, 'square'); this.noise(t, 0.12, 0.2, 2400); break;
      case 'tick': this.tone(2400, t, 0.02, 0.08, 'square'); break;
    }
  },
};

/* ------------------------------------------------------------------ input */
const Input = {
  down: new Set(), edge: new Set(), tap: null,
  init() {
    window.addEventListener('keydown', e => {
      if (UI.nameEntry) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.edge.add(e.code);
      this.down.add(e.code);
      Sound.init();
    });
    window.addEventListener('keyup', e => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('pointerdown', e => {
      Sound.init();
      const r = canvas.getBoundingClientRect();
      this.tap = { x: (e.clientX - r.left) * SW / r.width, y: (e.clientY - r.top) * SH / r.height };
      e.preventDefault();
    });
  },
  hit(code) { return this.edge.has(code); },
  ok() { return this.hit('KeyZ') || this.hit('Enter') || this.hit('Space') || this.hit('NumpadEnter'); },
  cancel() { return this.hit('KeyX') || this.hit('Escape') || this.hit('Backspace'); },
  dirHeld() {
    if (this.down.has('ArrowUp') || this.down.has('KeyW')) return 'up';
    if (this.down.has('ArrowDown') || this.down.has('KeyS')) return 'down';
    if (this.down.has('ArrowLeft') || this.down.has('KeyA')) return 'left';
    if (this.down.has('ArrowRight') || this.down.has('KeyD')) return 'right';
    return null;
  },
  dirHit() {
    if (this.hit('ArrowUp') || this.hit('KeyW')) return 'up';
    if (this.hit('ArrowDown') || this.hit('KeyS')) return 'down';
    if (this.hit('ArrowLeft') || this.hit('KeyA')) return 'left';
    if (this.hit('ArrowRight') || this.hit('KeyD')) return 'right';
    return null;
  },
  takeTap() { const t = this.tap; this.tap = null; return t; },
  endFrame() { this.edge.clear(); },
};

/* ------------------------------------------------------------------ game state */
const G = {
  name: '', gender: 'f', day: 1, phase: 0,
  vars: { memory: 0, yuri_sync: 0, momo_trust: 0, cult_truth: 0 },
  flags: {}, items: [], objective: '',
  map: null, x: 0, y: 0, dir: 'down',
};
const VAR_MAX = 100;

const Entity = (o) => Object.assign({ x: 0, y: 0, ox: 0, oy: 0, dir: 'down', moving: false, anim: 0, speed: 3, parity: false, pose: null, hidden: false, opacity: 1 }, o);
const player = Entity({ isPlayer: true, speed: 3.6 });   // 한 칸 약 0.22초

let MAP = null;          // 현재 맵 정의
let EVENTS = [];         // 현재 맵의 이벤트 인스턴스
let busy = 0;            // 스크립트 실행 중
let path = [];           // 터치 이동 경로
let pendingAction = null;

function heroSheet() { return G.gender === 'm' ? 'hero_m' : 'hero_f'; }
function heroFace() { return G.gender === 'm' ? 'face_hero_m' : 'face_hero_f'; }

/* ------------------------------------------------------------------ text helpers */
function hasBatchim(word) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xAC00 || ch > 0xD7A3) return false;
  return (ch - 0xAC00) % 28 !== 0;
}
function fmt(s) {
  return s.replace(/\{N\|([^|}]*)\|([^}]*)\}/g, (_, a, b) => G.name + (hasBatchim(G.name) ? a : b))
          .replace(/\{N\}/g, G.name);
}
function wrap(text, maxW, font) {
  ctx.font = font;
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW) { line = test; continue; }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxW) { line = word; continue; }
      line = '';
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch;
      }
    }
    out.push(line);
  }
  return out;
}

/* ------------------------------------------------------------------ UI state */
const UI = {
  msg: null, choice: null, black: null, menu: null, toast: null, banner: null,
  fade: 0, tint: { r: 0, g: 0, b: 0, a: 0 }, cg: null, cgAlpha: 0, shake: 0,
  doc: null, title: null, endings: null, nameEntry: null, slots: null, record: null, skip: false, debug: /[?&]debug/.test(location.search),
};
const SPEAKERS = {
  yuri: ['유리', 'face_yuri'], ian: ['이안', 'face_ian'], momo: ['모모', 'face_momo'], teacher: ['선생님', 'face_teacher'],
  all: ['모두', null], s: ['반 친구', null],
};

/* ------------------------------------------------------------------ 대사 빨리 넘기기 (읽은 대사만) */
const READ_KEY = 'one_persons_table_read';
const READ = new Set((() => { try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch (e) { return []; } })());
let readDirty = false;
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function readKey(s) { return hashStr(G.name ? s.split(G.name).join('{N}') : s); }
function isRead(s) { return READ.has(readKey(s)); }
function markRead(s) { const k = readKey(s); if (!READ.has(k)) { READ.add(k); readDirty = true; } }
function flushRead() { if (!readDirty) return; readDirty = false; try { localStorage.setItem(READ_KEY, JSON.stringify([...READ])); } catch (e) {} }
setInterval(flushRead, 3000);
addEventListener('pagehide', flushRead);
addEventListener('visibilitychange', flushRead);
const SKIP_BTN = { x: SW - 116, y: 12, w: 104, h: 40 };
const SKIP_STEP = 70;   // 읽은 대사 한 장을 넘기는 간격(ms)
function skipping() { return UI.skip || Input.down.has('ControlLeft') || Input.down.has('ControlRight'); }
function skipVisible() { return busy && !UI.title && !UI.menu && (UI.msg || UI.black || UI.doc); }
function toggleSkip() { UI.skip = !UI.skip; Sound.sfx('cursor'); }
function stopSkipAtUnread() { if (UI.skip) { UI.skip = false; toast('읽지 않은 대사 — 빨리 넘기기 멈춤'); } }
function msgKey(m) { return (m.name || '') + '|' + m.page + '|' + m.text; }
function docKey(d) { const s = d.spec; return 'D|' + JSON.stringify(s.type === 'book' ? s.pages[d.page] : s).slice(0, 600); }

/* tweens */
const tweens = [];
function tween(obj, key, to, ms) {
  return new Promise(res => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && tweens[i].key === key) { tweens[i].res(); tweens.splice(i, 1); }
    if (ms <= 0) { obj[key] = to; res(); return; }
    tweens.push({ obj, key, from: obj[key], to, ms, t: 0, res });
  });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = Math.min(1, tw.t / tw.ms);
    tw.obj[tw.key] = tw.from + (tw.to - tw.from) * k;
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
const timers = [];
function wait(ms) { return new Promise(res => timers.push({ t: ms, res })); }
function updateTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const r = timers[i].res; timers.splice(i, 1); r(); } }
}

/* ------------------------------------------------------------------ script API */
async function run(fn) {
  busy++; path = [];
  try { await fn(); } catch (e) { console.error(e); }
  finally { busy--; if (!busy && typeof reqCheck === 'function') reqCheck(); }
}
function say(who, text, face = 0, opt = {}) {
  let name = null, faceSheet = null;
  if (who === 'hero') { name = G.name; faceSheet = heroFace(); }
  else if (who && SPEAKERS[who]) { [name, faceSheet] = SPEAKERS[who]; }
  else if (who) name = who;
  if (face === null) faceSheet = null;
  if (opt.faceSheet) faceSheet = opt.faceSheet;
  return showMsg({ name, faceSheet, face, text: fmt(text), style: opt.style || 'normal', side: who === 'hero' ? 'right' : 'left', alt: opt.alt ? fmt(opt.alt) : null });
}
const think = (text) => showMsg({ name: null, faceSheet: null, text: fmt(text), style: 'think' });
const narr = (text) => showMsg({ name: null, faceSheet: null, text: fmt(text), style: 'normal' });
async function narrs(lines) { for (const l of lines) await narr(l); }
function showMsg(m) {
  return new Promise(res => {
    const textX = m.faceSheet ? 192 : 36;
    const lines = wrap(m.text, SW - textX - 52, `21px ${FONT}`);
    const pages = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    UI.msg = Object.assign(m, { pages, page: 0, shown: 0, res, textX, blipT: 0, t: 0 });
  });
}
function ask(options, prompt) {
  return new Promise(res => {
    if (prompt) {
      const lines = wrap(fmt(prompt), SW - 88, `21px ${FONT}`);
      UI.msg = { name: null, faceSheet: null, text: prompt, pages: [lines.slice(0, 3)], page: 0, shown: 1e9, textX: 36, res: null, style: 'normal', sticky: true };
    }
    UI.choice = { options: options.map(fmt), idx: 0, res: (i) => { if (prompt) UI.msg = null; res(i); } };
  });
}
async function fadeOut(ms = 400) { await tween(UI, 'fade', 1, ms); }
async function fadeIn(ms = 400) { await tween(UI, 'fade', 0, ms); }
async function cg(name, ms = 600) { UI.cg = name; await tween(UI, 'cgAlpha', 1, ms); }
async function cgOff(ms = 600) { await tween(UI, 'cgAlpha', 0, ms); UI.cg = null; }
function tint(r, g, b, a, ms = 800) { Object.assign(UI.tint, { r, g, b }); return tween(UI.tint, 'a', a, ms); }
function shake(power = 8) { UI.shake = power; Sound.sfx('thud'); }
function sfx(n) { Sound.sfx(n); }
function bgm(n) { Sound.bgm(n); }
function sepia(on) { canvas.classList.toggle('sepia', !!on); }
function black(lines) {
  return new Promise(res => { UI.black = { lines: lines.map(fmt), idx: 0, alphas: lines.map(() => 0), res, ready: false }; });
}
function banner(text, sub) { UI.banner = { text, sub, t: 0 }; }
function toast(text) { UI.toast = { text, t: 0 }; }
function gain(key, n) {
  const before = G.vars[key];
  G.vars[key] = Math.max(0, Math.min(VAR_MAX, G.vars[key] + n));
  const g = G.flags['_g' + G.day] || (G.flags['_g' + G.day] = {});
  g[key] = (g[key] || 0) + (G.vars[key] - before);
}
function flag(k, v) { if (v === undefined) return !!G.flags[k]; G.flags[k] = v; }
function once(k) { if (G.flags[k]) return false; G.flags[k] = true; return true; }
function count(k) { G.flags[k] = (G.flags[k] || 0) + 1; return G.flags[k]; }
function has(id) { return G.items.includes(id); }
function give(id) {
  if (has(id)) return;
  G.items.push(id); Sound.sfx('chime');
  toast(`${ITEMS[id].name}을(를) 얻었다.`);
}
function objective(text) { G.objective = text; toast('목표 — ' + text); }
function setPhase(p) { G.phase = p; applyAmbience(); autosave(); }
function ev(id) { return EVENTS.find(e => e.id === id); }
function face(e, dir) { e.dir = dir; }
function heroPose(row) { player.pose = row === null ? null : { sheet: heroSheet() + '_pose', row }; }
function evPose(e, sheet, row) { e.pose = sheet ? { sheet, row } : null; }

async function move(e, route, speed) {
  if (typeof e === 'string') e = ev(e);
  const map = { U: 'up', D: 'down', L: 'left', R: 'right' };
  for (const c of route) {
    if (c === ' ') { await wait(200); continue; }
    if (c.toLowerCase() === c && map[c.toUpperCase()]) { e.dir = map[c.toUpperCase()]; await wait(120); continue; } // 소문자 = 방향만 전환
    const d = map[c]; if (!d) continue;
    e.dir = d;
    await stepEntity(e, d, speed);
  }
}
function stepEntity(e, d, speed) {
  return new Promise(res => {
    const [dx, dy] = DIRS[d];
    e.x += dx; e.y += dy; e.ox = -dx * TILE; e.oy = -dy * TILE; e.moving = true; e.onArrive = res; e.parity = !e.parity;
    if (speed) e.speed = speed;
  });
}

async function transfer(mapId, x, y, dir, opt = {}) {
  if (opt.fade !== false) { Sound.sfx('door'); await fadeOut(220); }
  loadMap(mapId);
  player.x = x; player.y = y; player.dir = dir || player.dir; player.ox = player.oy = 0; player.moving = false;
  player.holdLock = true; path = [];
  if (MAP.onLoad) MAP.onLoad();
  applyAmbience();
  if (opt.fade !== false) await fadeIn(220);
  if (MAP.onEnter) await MAP.onEnter();
}
function loadMap(id) {
  MAP = MAPS[id]; G.map = id;
  EVENTS = (MAP.events || []).map(d => Entity(Object.assign({}, d, { x: d.x, y: d.y, dir: d.dir || 'down' })));
}
function applyAmbience() {
  if (!MAP) return;
  const a = MAP.ambience ? MAP.ambience() : ambienceForPhase();
  tint(a.tint[0], a.tint[1], a.tint[2], a.tint[3], 600);
  bgm(a.bgm);
}

/* ------------------------------------------------------------------ 문서 보기 (책 · 장부 · 종이) */
/* doc({type:'book', pages:[{left:[...], right:[...], torn, album, hush, stick, wobble}]})
   stick: 다음 장으로 넘기려 하면 처음 한 번은 책장이 넘어가지 않고 떨린다. wobble: 오른쪽 페이지 글줄이 미세하게 흔들린다(px)
   doc({type:'ledger', title, cols:[[이름,너비]...], rows:[[...]], note})
   doc({type:'paper', title, lines:[...], torn})
   줄 앞 기호: '#' 제목, '!' 붉은 강조, '~' 흐린 글씨 */
function doc(spec) {
  if (!UI.title) markDocSeen(spec);
  return new Promise(res => { UI.doc = { spec, page: 0, res, t: 0 }; Sound.sfx('page'); onDocPage(); });
}
function docPages() { const s = UI.doc.spec; return s.type === 'book' ? s.pages.length : 1; }
function onDocPage() {
  const s = UI.doc.spec;
  if (s.type === 'book' && s.pages[UI.doc.page].hush) bgm(null);
}
function s0(d) { return d.spec.type === 'book' ? d.spec.pages[d.page] : null; }
function updateDoc(dt) {
  const d = UI.doc; d.t += dt; if (d.shake) d.shake = Math.max(0, d.shake - dt);
  const t0 = Input.takeTap(), dir = Input.dirHit(), n = docPages();
  if (t0 && inRect(t0, SKIP_BTN)) { toggleSkip(); return; }
  const t = t0;
  let next = Input.ok() || dir === 'right' || (t && t.x >= SW / 2);
  if (skipping()) {
    if (isRead(docKey(d))) { if (d.t >= SKIP_STEP * 2) { markRead(docKey(d)); if (d.page < n - 1) { d.page++; d.t = 0; onDocPage(); return; } UI.doc = null; d.res(); return; } }
    else stopSkipAtUnread();
  }
  const prev = dir === 'left' || (t && t.x < SW / 2 && d.page > 0);
  if (prev && d.page > 0) { d.page--; d.t = 0; Sound.sfx('page'); return; }
  if (Input.cancel()) next = true;
  if (!next || d.t < 250) return;
  const bp = s0(d);
  if (bp && bp.stick && d.stuckAt !== d.page && !Input.cancel()) { d.stuckAt = d.page; d.t = 0; d.shake = 280; return; }   // 책장이 넘어가지 않는다 (한 번)
  markRead(docKey(d));
  if (d.page < n - 1 && !Input.cancel()) { d.page++; d.t = 0; Sound.sfx('page'); onDocPage(); return; }
  UI.doc = null; d.res();
}
function docLine(line, x, y, w, align = 'left', base = 19) {
  let col = '#2e2630', font = `${base}px ${SERIF}`, s = line;
  if (s.startsWith('#')) { s = s.slice(1).trim(); font = `bold ${base + 4}px ${SERIF}`; col = '#2a1e28'; }
  else if (s.startsWith('!')) { s = s.slice(1); col = '#7a1a26'; font = `bold ${base}px ${SERIF}`; }
  else if (s.startsWith('~')) { s = s.slice(1); col = '#8a7e74'; font = `italic ${base - 2}px ${SERIF}`; }
  ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align;
  ctx.fillText(s, align === 'center' ? x + w / 2 : x, y);
  ctx.textAlign = 'left';
}
function tornEdge(x, y, w, h, side) {
  ctx.fillStyle = 'rgba(8,10,16,1)'; ctx.beginPath();
  if (side === 'right') {
    ctx.moveTo(x + w * 0.12, y);
    for (let i = 0; i <= 18; i++) ctx.lineTo(x + w * (0.08 + ((i * 37) % 7) / 60), y + (h * i) / 18);
    ctx.lineTo(x + w + 4, y + h); ctx.lineTo(x + w + 4, y);
  } else {
    ctx.moveTo(x, y + h * 0.78);
    for (let i = 0; i <= 22; i++) ctx.lineTo(x + (w * i) / 22, y + h * (0.74 + ((i * 53) % 9) / 100));
    ctx.lineTo(x + w, y + h + 4); ctx.lineTo(x, y + h + 4);
  }
  ctx.closePath(); ctx.fill();
}
function drawAlbum(x, y, w) {
  for (let i = 0; i < 6; i++) {
    const fx = x + 16 + (i % 3) * ((w - 32) / 3), fy = y + 18 + Math.floor(i / 3) * 150, fw = (w - 32) / 3 - 14;
    ctx.fillStyle = '#d6cdb8'; ctx.fillRect(fx, fy, fw, 108);
    ctx.fillStyle = '#7c8090'; ctx.fillRect(fx + 6, fy + 6, fw - 12, 96);
    ctx.fillStyle = '#c8bfb4'; ctx.beginPath(); ctx.arc(fx + fw / 2, fy + 42, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c3350'; ctx.beginPath(); ctx.roundRect(fx + fw / 2 - 26, fy + 64, 52, 38, 10); ctx.fill();
    ctx.strokeStyle = '#2e2630'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(fx + fw / 2, fy + 44, 8, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(fx, fy + 116, fw, 18);
  }
}
/* 학교 지도 (v2.3) — 이안에게 받은 지도. 층마다 복도 위로 방이 늘어선 그림. 붉은 점이 지금 있는 곳.
   방 위치는 story.js의 SCHOOL_MAP(복도 문의 x 좌표)을 따른다. 지하는 그려져 있지 않다. */
function drawSchoolMap(now) {
  const w = 700, h = 480, x = (SW - w) / 2, y = 40;
  ctx.fillStyle = '#ece4d2'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#9a8e7a'; ctx.lineWidth = 1; ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
  docLine('#학교 안내도', x, y + 42, w, 'center', 20);
  const here = SCHOOL_MAP.where();
  const cols = 21, gx = x + 50, gw = w - 100, cw = gw / cols;
  SCHOOL_MAP.floors.forEach((f, fi) => {
    const top = y + 82 + fi * 190, rh = 74, cy = top + rh + 8, ch = 34;
    ctx.font = `bold 15px ${SERIF}`; ctx.fillStyle = '#5a4a52'; ctx.fillText(f.name, gx, top - 8);
    // 복도
    ctx.fillStyle = '#d9cfb9'; ctx.fillRect(gx, cy, gw, ch);
    ctx.strokeStyle = '#6a5c56'; ctx.lineWidth = 1.5; ctx.strokeRect(gx + 0.5, cy + 0.5, gw - 1, ch - 1);
    docLine('~' + f.hall, gx, cy + 23, gw, 'center', 14);
    // 방
    f.rooms.forEach(r => {
      const rx = gx + (r.x - (r.w || 2) / 2 + 0.5) * cw, rw = (r.w || 2) * cw - 4;
      const ry = r.below ? cy + ch + 8 : top, rhh = r.below ? 56 : rh;
      ctx.fillStyle = r.mark === false ? 'rgba(0,0,0,0)' : '#f4eee2'; ctx.fillRect(rx, ry, rw, rhh);
      ctx.strokeStyle = '#6a5c56'; ctx.lineWidth = 1.5; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rhh - 1);
      ctx.fillStyle = '#ece4d2'; ctx.fillRect(gx + r.x * cw + 4, r.below ? cy + ch - 2 : cy - 6, cw - 8, 8);   // 문
      ctx.font = `bold 14px ${SERIF}`; ctx.fillStyle = '#2e2630'; ctx.textAlign = 'center';
      ctx.fillText(r.label, rx + rw / 2, ry + rhh / 2 + 5); ctx.textAlign = 'left';
      if (here && here.room === r.id) dot(rx + rw / 2, ry + rhh / 2 + 22);
    });
    if (here && here.floor === fi && here.hallX != null) dot(gx + (here.hallX + 0.5) * cw, cy + ch / 2);
  });
  function dot(px, py) {
    const a = 0.55 + 0.45 * Math.sin(now / 260);
    ctx.fillStyle = `rgba(150,24,36,${a})`; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a1a26'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.stroke();
  }
  docLine(here ? '~붉은 점 — 지금 있는 곳' : '!지금 있는 곳은 이 지도에 그려져 있지 않다.', x, y + h - 26, w, 'center', 15);
}
function renderDoc(now) {
  const d = UI.doc, s = d.spec, n = docPages();
  ctx.fillStyle = 'rgba(6,8,14,0.78)'; ctx.fillRect(0, 0, SW, SH);
  if (s.type === 'book') {
    const p = s.pages[d.page], y = 56, w = 676, h = 440;
    const x = 70 + (d.shake ? Math.round(Math.sin(now / 18) * 3 * d.shake / 280) : 0);
    ctx.fillStyle = '#3a2430'; ctx.beginPath(); ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 12); ctx.fill();
    ctx.strokeStyle = '#a8823e'; ctx.lineWidth = 1; ctx.strokeRect(x - 4.5, y - 4.5, w + 9, h + 9);
    const pg = ctx.createLinearGradient(x, 0, x + w, 0);
    pg.addColorStop(0, '#e2d6bc'); pg.addColorStop(0.08, '#efe6d2'); pg.addColorStop(0.47, '#e6dbc4'); pg.addColorStop(0.5, '#bfb196');
    pg.addColorStop(0.53, '#e6dbc4'); pg.addColorStop(0.92, '#efe6d2'); pg.addColorStop(1, '#e2d6bc');
    ctx.fillStyle = pg; ctx.fillRect(x, y, w, h);
    const half = w / 2, lh = p.lh || 34;
    [['left', x], ['right', x + half]].forEach(([side, px]) => {
      if (side === 'right' && p.album) { drawAlbum(px + 10, y + 30, half - 20); return; }
      const wob = side === 'right' && p.wobble ? p.wobble : 0;   // 오른쪽 페이지 글줄이 미세하게 어긋난다
      (p[side] || []).forEach((l, i) => docLine(l, px + 44 + (wob ? Math.sin(now / 420 + i * 1.7) * wob : 0), y + 64 + i * lh + (wob ? Math.sin(now / 610 + i) * wob * 0.5 : 0), half - 88, p.center ? 'center' : 'left'));
    });
    if (p.torn) tornEdge(x + half, y, half, h, 'right');
    ctx.font = `13px ${SERIF}`; ctx.fillStyle = '#8a7e74'; ctx.textAlign = 'center';
    ctx.fillText(`— ${d.page * 2 + 1} —`, x + half / 2, y + h - 18);
    if (!p.torn) ctx.fillText(`— ${d.page * 2 + 2} —`, x + half * 1.5, y + h - 18);
    ctx.textAlign = 'left';
  } else if (s.type === 'schoolmap') {
    drawSchoolMap(now);
  } else if (s.type === 'ledger') {
    const w = 600, h = 470, x = (SW - w) / 2, y = 44;
    ctx.fillStyle = '#efe9dc'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#9a8e7a'; ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
    docLine('#' + s.title, x, y + 46, w, 'center', 20);
    const rows = s.rows, rh = Math.min(30, (h - 140) / Math.max(1, rows.length));
    let cx = x + 28; const hy = y + 86;
    ctx.fillStyle = '#d8ccb4'; ctx.fillRect(x + 20, hy - 22, w - 40, 30);
    s.cols.forEach(([name, cw]) => { docLine('#' + name, cx, hy, cw, 'left', 13); cx += cw; });
    rows.forEach((r, i) => {
      const ry = hy + 14 + (i + 1) * rh;
      ctx.fillStyle = 'rgba(120,100,80,0.25)'; ctx.fillRect(x + 20, ry + 8, w - 40, 1);
      let cx2 = x + 28;
      r.forEach((cell, j) => { docLine(String(cell), cx2, ry, s.cols[j][1], 'left', 15); cx2 += s.cols[j][1]; });
    });
    if (s.note) docLine('~' + s.note, x, y + h - 22, w, 'center', 15);
  } else {
    const w = 470, h = 460, x = (SW - w) / 2, y = 50;
    ctx.save(); ctx.translate(SW / 2, y + h / 2); ctx.rotate(-0.012); ctx.translate(-SW / 2, -(y + h / 2));
    ctx.fillStyle = '#f2ecdf'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(120,100,80,0.18)'; for (let i = 0; i < 12; i++) ctx.fillRect(x + 30, y + 92 + i * 30, w - 60, 1);
    if (s.title) docLine('#' + s.title, x, y + 54, w, 'center', 19);
    s.lines.forEach((l, i) => docLine(l, x + 40, y + 116 + i * 30, w - 80, 'left', 18));
    if (s.torn) tornEdge(x - 4, y, w + 8, h, 'bottom');
    ctx.restore();
  }
  ctx.font = `14px ${FONT}`; ctx.fillStyle = 'rgba(236,232,242,0.8)'; ctx.textAlign = 'center';
  const last = d.page >= n - 1;
  if (Math.floor(now / 500) % 2 || d.t < 400) ctx.fillText(last ? '결정 키 / 탭 — 닫기' : (d.page > 0 ? '◀ 이전 장    결정 키 / 탭 — 다음 장 ▶' : '결정 키 / 탭 — 다음 장 ▶'), SW / 2, SH - 40);
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ map helpers */
function tileChar(x, y) {
  if (!MAP || y < 0 || y >= MAP.rows.length || x < 0 || x >= MAP.rows[0].length) return null;
  return MAP.rows[y][x];
}
function tileDef(ch) {
  const d = MAP.legend[ch];
  return typeof d === 'function' ? d() : d;
}
function passable(x, y, who) {
  const ch = tileChar(x, y); if (ch === null) return false;
  const d = tileDef(ch); if (!d || !d[2]) return false;
  for (const e of EVENTS) {
    if (e === who || !visible(e) || !blocks(e)) continue;
    if (e.x === x && e.y === y) return false;
  }
  if (who !== player && player.x === x && player.y === y) return false;
  return true;
}
function visible(e) { return !e.hidden && !(e.phantom && G.flags[`ph_${G.map}_${e.id}_${G.day}`]) && (!e.show || e.show()) && (typeof VIS_HOOK !== 'function' || VIS_HOOK(e)); }
function blocks(e) { return e.block !== undefined ? e.block : !!(e.sprite || e.pose); }
function eventAt(x, y) { return EVENTS.find(e => e.x === x && e.y === y && visible(e) && (e.action || e.text)); }

/* ------------------------------------------------------------------ player control */
function tryMove(d) {
  player.dir = d;
  const [dx, dy] = DIRS[d];
  const nx = player.x + dx, ny = player.y + dy;
  if (!passable(nx, ny, player)) return false;
  player.x = nx; player.y = ny; player.ox = -dx * TILE; player.oy = -dy * TILE; player.moving = true; player.parity = !player.parity;
  player.onArrive = onPlayerArrive;
  return true;
}
function onPlayerArrive() {
  const touch = EVENTS.find(e => e.x === player.x && e.y === player.y && visible(e) && e.touch);
  if (touch) { path = []; run(() => touch.touch(touch)); }
}
function interact() {
  const [dx, dy] = DIRS[player.dir];
  const fx = player.x + dx, fy = player.y + dy;
  const e = eventAt(fx, fy);
  if (e) {
    const turns = typeof e.turn === 'function' ? e.turn() : e.turn !== false;
    if (e.sprite && turns && !e.pose) e.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.dir];
    run(async () => { if (e.action) await e.action(e); else await narrs(typeof e.text === 'function' ? e.text() : e.text); });
    return true;
  }
  // 열린 문(밟으면 넘어가는 칸) 앞에서 결정 키·탭 → 설명 대신 그대로 들어간다
  if (passable(fx, fy, player) && EVENTS.some(v => v.x === fx && v.y === fy && v.touch && visible(v))) { tryMove(player.dir); return true; }
  const ch = tileChar(fx, fy);
  const ta = MAP.tileAction && MAP.tileAction[ch];
  if (ta) { run(() => ta(fx, fy)); return true; }
  const tt = MAP.tileText && MAP.tileText[ch];
  if (tt) { run(() => narrs(typeof tt === 'function' ? tt(fx, fy) : tt)); return true; }
  return false;
}
function findPath(tx, ty) {
  const W = MAP.rows[0].length, H = MAP.rows.length;
  const key = (x, y) => y * W + x;
  const prev = new Map([[key(player.x, player.y), null]]);
  const q = [[player.x, player.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const d of ['up', 'down', 'left', 'right']) {
      const [dx, dy] = DIRS[d], nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
      if (!passable(nx, ny, player)) continue;
      if (!(nx === tx && ny === ty) && EVENTS.some(e => e.x === nx && e.y === ny && e.touch && visible(e))) continue; // 문은 지나가지 않음
      prev.set(key(nx, ny), [x, y, d]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const out = []; let k = key(tx, ty);
  while (prev.get(k)) { const [px, py, d] = prev.get(k); out.unshift(d); k = key(px, py); }
  return out;
}
function handleMapTap(t) {
  const cam = camera();
  const tx = Math.floor((t.x + cam.x) / TILE), ty = Math.floor((t.y + cam.y) / TILE);
  if (tx === player.x && ty === player.y) return;
  const target = eventAt(tx, ty) || (MAP.tileAction && MAP.tileAction[tileChar(tx, ty)]) || (MAP.tileText && MAP.tileText[tileChar(tx, ty)]);
  const adj = Math.abs(tx - player.x) + Math.abs(ty - player.y) === 1;
  if (adj && (target || !passable(tx, ty, player))) {
    player.dir = tx > player.x ? 'right' : tx < player.x ? 'left' : ty > player.y ? 'down' : 'up';
    if (target) interact();
    else tryMove(player.dir);
    return;
  }
  if (passable(tx, ty, player)) { const p = findPath(tx, ty); if (p) { path = p; pendingAction = null; } return; }
  // 막힌 칸을 탭: 옆 칸까지 걸어가서 조사
  let best = null;
  for (const d of ['down', 'up', 'left', 'right']) {
    const [dx, dy] = DIRS[d], ax = tx - dx, ay = ty - dy;
    if (!passable(ax, ay, player) && !(ax === player.x && ay === player.y)) continue;
    const p = (ax === player.x && ay === player.y) ? [] : findPath(ax, ay);
    if (p && (!best || p.length < best.p.length)) best = { p, d };
  }
  if (best) { path = best.p; pendingAction = target ? best.d : null; if (!path.length && target) { player.dir = best.d; interact(); } }
}
function updatePlayer(dt) {
  if (player.moving) return;
  let held = Input.dirHeld();
  // 문·계단을 지난 직후에는 방향키를 한 번 뗄 때까지 걷지 않는다 (누르고 있다가 되돌아가는 것 방지)
  if (player.holdLock) { if (held) held = null; else player.holdLock = false; }
  if (held) {
    path = []; pendingAction = null;
    if (held !== player.dir && !player.walking) { player.dir = held; player.hold = 0; player.turning = true; return; }
    if (player.turning) { player.hold += dt; if (player.hold < 90) return; player.turning = false; }
    player.walking = tryMove(held);
    return;
  }
  player.walking = false; player.turning = false; player.hold = 0;
  if (path.length) {
    const d = path.shift();
    if (!tryMove(d)) { path = []; pendingAction = null; }
    return;
  }
  if (pendingAction) { player.dir = pendingAction; pendingAction = null; interact(); return; }
  if (Input.ok()) { interact(); return; }
  if (Input.cancel()) { openMenu(); return; }
  if (Input.hit('KeyM') && hasMap()) { openSchoolMap(); return; }
  const t = Input.takeTap();
  if (t) {
    if (inRect(t, MENU_BTN)) { openMenu(); return; }
    if (hasMap() && inRect(t, MAP_BTN)) { openSchoolMap(); return; }
    handleMapTap(t);
  }
}
function updateEntity(e, dt) {
  if (!e.moving) return;
  const step = e.speed * dt / 16.67;
  if (e.ox) e.ox = Math.sign(e.ox) * Math.max(0, Math.abs(e.ox) - step);
  if (e.oy) e.oy = Math.sign(e.oy) * Math.max(0, Math.abs(e.oy) - step);
  e.anim += dt;
  if (!e.ox && !e.oy) {
    e.moving = false;
    const cb = e.onArrive; e.onArrive = null; if (cb) cb();
  }
}

/* ------------------------------------------------------------------ menu */
const MENU_BTN = { x: SW - 116, y: 12, w: 104, h: 40 };
const MAP_BTN = { x: SW - 228, y: 12, w: 104, h: 40 };
function hasMap() { return G.items && G.items.includes('map') && typeof SCHOOL_MAP !== 'undefined'; }
function openSchoolMap() { run(() => doc({ type: 'schoolmap' })); }
const CMD = { x: 12, y: 86, w: 206, bh: 46 };
const INV = { x: 232, y: 86, w: 572, h: 468, cols: 7, slot: 66, gap: 10 };
function openMenu() {
  Sound.sfx('select');
  UI.menu = { idx: 0, mode: 'main', itemIdx: 0 };
}
const MENU_OPTS = () => ['아이템', '저장', Sound.on ? '소리 끄기' : '소리 켜기', '타이틀로', '닫기'];
const MENU_ICONS = ['bag', 'book', 'sound', 'door', 'close'];
function slotRect(i) {
  const c = i % INV.cols, r = Math.floor(i / INV.cols);
  return { x: INV.x + 24 + c * (INV.slot + INV.gap), y: INV.y + 104 + r * (INV.slot + INV.gap), w: INV.slot, h: INV.slot };
}
const inRect = (t, r) => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h;
function menuAct(i) {
  const m = UI.menu; m.idx = i; Sound.sfx('select');
  if (i === 0) { if (G.items.length) { m.mode = 'items'; m.itemIdx = Math.min(m.itemIdx, G.items.length - 1); } }
  else if (i === 1) { UI.menu = null; openSlots('save'); }
  else if (i === 2) Sound.toggle();
  else if (i === 3) { UI.menu = null; showTitle(); }
  else UI.menu = null;
}
function updateMenu() {
  const m = UI.menu, t = Input.takeTap(), opts = MENU_OPTS();
  if (t) {
    for (let i = 0; i < opts.length; i++) if (inRect(t, { x: CMD.x, y: CMD.y + 20 + i * CMD.bh, w: CMD.w, h: CMD.bh - 6 })) return menuAct(i);
    for (let i = 0; i < G.items.length; i++) if (inRect(t, slotRect(i))) {
      const it = ITEMS[G.items[i]];
      if (m.mode === 'items' && m.itemIdx === i && it && it.doc) { UI.menu = null; run(() => doc(typeof it.doc === 'function' ? it.doc() : it.doc)); return; }
      m.mode = 'items'; m.itemIdx = i; Sound.sfx('cursor'); return;
    }
    if (inRect(t, { x: INV.x + INV.w - 44, y: INV.y + 8, w: 36, h: 36 })) { UI.menu = null; return; }
    if (!inRect(t, INV) && !inRect(t, { x: CMD.x, y: CMD.y, w: CMD.w, h: 20 + opts.length * CMD.bh + 10 })) UI.menu = null;
    return;
  }
  const d = Input.dirHit();
  if (m.mode === 'main') {
    if (d === 'up') { m.idx = (m.idx + opts.length - 1) % opts.length; Sound.sfx('cursor'); }
    if (d === 'down') { m.idx = (m.idx + 1) % opts.length; Sound.sfx('cursor'); }
    if (Input.cancel()) { UI.menu = null; return; }
    if (Input.ok()) menuAct(m.idx);
  } else {
    const n = G.items.length;
    if (d === 'left') m.itemIdx = Math.max(0, m.itemIdx - 1);
    if (d === 'right') m.itemIdx = Math.min(n - 1, m.itemIdx + 1);
    if (d === 'up') m.itemIdx = Math.max(0, m.itemIdx - INV.cols);
    if (d === 'down') m.itemIdx = Math.min(n - 1, m.itemIdx + INV.cols);
    if (d) Sound.sfx('cursor');
    if (Input.ok() && ITEMS[G.items[m.itemIdx]] && ITEMS[G.items[m.itemIdx]].doc) { const it = ITEMS[G.items[m.itemIdx]]; UI.menu = null; run(() => doc(typeof it.doc === 'function' ? it.doc() : it.doc)); return; }
    if (Input.cancel() || Input.ok()) m.mode = 'main';
  }
}

/* ------------------------------------------------------------------ save */
function snapshot() {
  return JSON.stringify({ name: G.name, gender: G.gender, day: G.day, phase: G.phase, vars: G.vars, flags: G.flags,
    items: G.items, objective: G.objective, map: G.map, x: player.x, y: player.y, dir: player.dir, t: Date.now() });
}
function saveGame() { try { localStorage.setItem(SAVE_KEY, snapshot()); return true; } catch (e) { return false; } }
function autosave() { saveGame(); }
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

/* ------------------------------------------------------------------ 저장 칸 (자동 저장 + 5칸) */
const SLOT_N = 5;
const slotKey = (i) => i === 0 ? SAVE_KEY : `one_persons_table_slot_${i}`;
function readSlot(i) { try { const s = localStorage.getItem(slotKey(i)); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveSlot(i) { try { localStorage.setItem(slotKey(i), snapshot()); return true; } catch (e) { return false; } }
function latestSave() {
  let best = null;
  for (let i = 0; i <= SLOT_N; i++) { const s = readSlot(i); if (s && (!best || (s.t || 0) >= (best.t || 0))) best = s; }
  return best;
}
const PHASE_NAMES = ['조회', '오전 · 점심', '방과 후', '밤'];
const SLOT_UI = { x: 128, y: 92, w: 560, row: 72 };
const SLOT_CLOSE = { x: SW - 150, y: SH - 60, w: 110, h: 40 };
function openSlots(mode) { Sound.sfx('select'); UI.slots = { mode, idx: 0, confirm: -1 }; }
function slotIds() { const a = []; for (let i = UI.slots.mode === 'load' ? 0 : 1; i <= SLOT_N; i++) a.push(i); return a; }
function slotAct(k) {
  const S = UI.slots, id = slotIds()[k], data = readSlot(id);
  S.idx = k;
  if (S.mode === 'save') {
    if (data && S.confirm !== k) { S.confirm = k; Sound.sfx('cursor'); return; }
    const ok = saveSlot(id); UI.slots = null; Sound.sfx('select');
    toast(ok ? `기록 ${id}에 저장했어요.` : '이 환경에서는 저장할 수 없어요.');
    return;
  }
  if (!data) { Sound.sfx('cursor'); return; }
  Sound.sfx('select'); UI.slots = null; UI.title = null;
  run(() => loadState(data));
}
function updateSlots() {
  const S = UI.slots, ids = slotIds(), n = ids.length, t = Input.takeTap(), d = Input.dirHit();
  if (d === 'up') { S.idx = (S.idx + n - 1) % n; S.confirm = -1; Sound.sfx('cursor'); }
  if (d === 'down') { S.idx = (S.idx + 1) % n; S.confirm = -1; Sound.sfx('cursor'); }
  if (Input.cancel()) { UI.slots = null; Sound.sfx('select'); return; }
  if (Input.ok()) return slotAct(S.idx);
  if (t) {
    if (inRect(t, SLOT_CLOSE)) { UI.slots = null; Sound.sfx('select'); return; }
    const k = Math.floor((t.y - SLOT_UI.y) / SLOT_UI.row);
    if (t.x >= SLOT_UI.x && t.x <= SLOT_UI.x + SLOT_UI.w && k >= 0 && k < n) {
      if (k !== S.idx) { S.idx = k; S.confirm = -1; }
      slotAct(k);
    }
  }
}
function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}  ${z(d.getHours())}:${z(d.getMinutes())}`;
}
function renderSlots() {
  const S = UI.slots, ids = slotIds();
  ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.fillRect(0, 0, SW, SH);
  ctx.font = `bold 22px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText(S.mode === 'save' ? 'SAVE' : 'LOAD', 40, 58);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.gold;
  ctx.fillText(S.mode === 'save' ? '저장할 칸을 고르세요.' : '이어서 할 기록을 고르세요.', 120, 58);
  ctx.fillStyle = 'rgba(150,146,172,0.4)'; ctx.fillRect(40, 72, SW - 80, 1);
  ids.forEach((id, k) => {
    const y = SLOT_UI.y + k * SLOT_UI.row, data = readSlot(id), sel = k === S.idx;
    panel(SLOT_UI.x, y, SLOT_UI.w, SLOT_UI.row - 8, sel ? 1 : 0.75);
    if (sel) selBand(SLOT_UI.x + 10, y + 10, SLOT_UI.w - 20, SLOT_UI.row - 28);
    ctx.font = `bold 16px ${SERIF}`; ctx.fillStyle = sel ? COL.selText : COL.name;
    ctx.fillText(id === 0 ? '자동 저장' : `기록 ${id}`, SLOT_UI.x + 26, y + 39);
    if (!data) { ctx.font = `15px ${FONT}`; ctx.fillStyle = sel ? COL.selText : COL.dim; ctx.fillText('— 비어 있음 —', SLOT_UI.x + 150, y + 39); return; }
    const where = (MAPS[data.map] && MAPS[data.map].name) || '';
    ctx.font = `16px ${FONT}`; ctx.fillStyle = sel ? COL.selText : COL.text;
    ctx.fillText(`DAY ${data.day} · ${PHASE_NAMES[data.phase] || ''}${where ? ' · ' + where : ''}`, SLOT_UI.x + 150, y + 39);
    ctx.font = `13px ${FONT}`; ctx.fillStyle = sel ? COL.selText : COL.dim; ctx.textAlign = 'right';
    ctx.fillText(S.confirm === k ? '한 번 더 누르면 덮어써요' : `${data.name || ''}  ${fmtTime(data.t)}`, SLOT_UI.x + SLOT_UI.w - 26, y + 39);
    ctx.textAlign = 'left';
  });
  panel(SLOT_CLOSE.x, SLOT_CLOSE.y, SLOT_CLOSE.w, SLOT_CLOSE.h);
  icon('close', SLOT_CLOSE.x + 16, SLOT_CLOSE.y + 12, COL.gold);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.text; ctx.fillText('닫기', SLOT_CLOSE.x + 44, SLOT_CLOSE.y + 26);
}

/* ------------------------------------------------------------------ title & name entry */
function showTitle() {
  sepia(false); UI.msg = UI.choice = UI.black = UI.menu = UI.doc = UI.slots = UI.record = UI.gallery = null; UI.cg = null; UI.cgAlpha = 0; UI.fade = 0; UI.skip = false; UI.banner = null;
  Object.assign(UI.tint, { a: 0 });
  MAP = null; EVENTS = [];
  const has = !!latestSave();
  UI.title = { idx: has ? 1 : 0, hasSave: has, t: 0 };
  bgm(endingsSeen().length ? 'title2' : 'title');
}
function updateTitle(dt) {
  const T = UI.title; T.t += dt;
  const opts = TITLE_OPTS(), n = opts.length, t = Input.takeTap();
  const d = Input.dirHit();
  if (d === 'up') { T.idx = (T.idx + n - 1) % n; Sound.sfx('cursor'); }
  if (d === 'down') { T.idx = (T.idx + 1) % n; Sound.sfx('cursor'); }
  let pick = Input.ok() ? T.idx : -1;
  if (t) { const i = Math.floor((t.y - TITLE_MENU.y - 12) / TITLE_MENU.row); if (i >= 0 && i < n && t.x > TITLE_MENU.x && t.x < TITLE_MENU.x + TITLE_MENU.w) pick = i; }
  if (pick < 0) return;
  T.idx = pick;
  const label = opts[pick];
  if (label.startsWith('OPTION')) { Sound.toggle(); Sound.sfx('select'); return; }
  if (label === 'ENDINGS') { const sv = latestSave(); if (sv && sv.gender) G.gender = sv.gender; Sound.sfx('select'); UI.endings = { idx: 0 }; return; }
  if ((label === 'CONTINUE' || label === 'LOAD') && !T.hasSave) { Sound.sfx('cursor'); return; }
  if (label === 'LOAD') { openSlots('load'); return; }
  if (label === 'RECORD') { const sv = latestSave(); if (sv && sv.gender) G.gender = sv.gender; openRecord(); return; }
  if (label === 'GALLERY') { const sv = latestSave(); if (sv) { G.name = sv.name || G.name; if (sv.gender) G.gender = sv.gender; } Sound.sfx('select'); UI.gallery = { tab: 0, idx: 0, view: null }; return; }
  Sound.sfx('select'); UI.title = null;
  if (label === 'NEW GAME') run(newGame); else if (label === 'EAT') run(() => STORY.eat()); else if (label === 'LAST SEAT') run(() => STORY.lastSeat()); else run(continueGame);
}

/* ------------------------------------------------------------------ 엔딩 목록 */
const END_LIST = { x: 40, y: 92, w: 300, row: 66 };
const END_CLOSE = { x: SW - 150, y: SH - 64, w: 110, h: 40 };
function updateEndings() {
  const E = UI.endings, n = ENDINGS_INFO.length, t = Input.takeTap(), d = Input.dirHit();
  if (d === 'up') { E.idx = (E.idx + n - 1) % n; Sound.sfx('cursor'); }
  if (d === 'down') { E.idx = (E.idx + 1) % n; Sound.sfx('cursor'); }
  if (Input.cancel() || Input.ok()) { UI.endings = null; Sound.sfx('select'); return; }
  if (t) {
    const i = Math.floor((t.y - END_LIST.y) / END_LIST.row);
    if (t.x >= END_LIST.x && t.x <= END_LIST.x + END_LIST.w && i >= 0 && i < n) { E.idx = i; Sound.sfx('cursor'); return; }
    if (inRect(t, END_CLOSE)) { UI.endings = null; Sound.sfx('select'); }
  }
}
function renderEndings() {
  const E = UI.endings, seen = endingsSeen();
  ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.fillRect(0, 0, SW, SH);
  ctx.font = `bold 22px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText('ENDINGS', 40, 58);
  ctx.font = `16px ${SERIF}`; ctx.fillStyle = COL.gold;
  ctx.fillText(`${ENDINGS_INFO.filter(e => seen.includes(e.id)).length} / ${ENDINGS_INFO.length}`, 166, 58);
  ctx.fillStyle = 'rgba(150,146,172,0.4)'; ctx.fillRect(40, 72, SW - 80, 1);
  ENDINGS_INFO.forEach((e, i) => {
    const y = END_LIST.y + i * END_LIST.row, got = seen.includes(e.id), sel = i === E.idx;
    panel(END_LIST.x, y, END_LIST.w, END_LIST.row - 10, sel ? 1 : 0.75);
    if (sel) selBand(END_LIST.x + 10, y + 10, END_LIST.w - 20, END_LIST.row - 30);
    ctx.font = `${got ? 'bold ' : ''}15px ${SERIF}`;
    ctx.fillStyle = sel ? COL.selText : (got ? COL.text : COL.dim);
    const label = got ? `『${e.title}』` : '『 ??? 』';
    ctx.fillText(label, END_LIST.x + 24, y + 34);
  });
  const e = ENDINGS_INFO[E.idx], got = seen.includes(e.id);
  const px = 364, py = 92, pw = 412, ph = 310;
  panel(px, py, pw, ph + 120);
  const ix = px + 16, iy = py + 16, iw = pw - 32, ih = ph - 40;
  ctx.fillStyle = '#0c0e16'; ctx.fillRect(ix, iy, iw, ih);
  if (got && IMG[cgKey(e.cg)]) { ctx.drawImage(IMG[cgKey(e.cg)], ix, iy, iw, ih); drawCgOverlay(e.cg, ix, iy, iw, ih); }
  else { ctx.font = `bold 64px ${SERIF}`; ctx.fillStyle = 'rgba(150,146,172,0.35)'; ctx.textAlign = 'center'; ctx.fillText('?', ix + iw / 2, iy + ih / 2 + 22); ctx.textAlign = 'left'; }
  ctx.strokeStyle = COL.edge; ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
  ctx.font = `bold 16px ${SERIF}`; ctx.fillStyle = got ? COL.name : COL.dim;
  ctx.fillText(got ? `『${e.title}』` : '아직 보지 못한 결말', ix, iy + ih + 32);
  if (got && e.trace) { ctx.font = `italic 14px ${SERIF}`; ctx.fillStyle = COL.gold; ctx.textAlign = 'right'; ctx.fillText(e.trace, ix + iw, iy + ih + 32); ctx.textAlign = 'left'; }
  ctx.font = `15px ${FONT}`; ctx.fillStyle = got ? COL.text : COL.think;
  wrap(got ? e.desc : '힌트 — ' + e.hint, iw, `15px ${FONT}`).forEach((l, k) => ctx.fillText(l, ix, iy + ih + 60 + k * 24));
  panel(END_CLOSE.x, END_CLOSE.y, END_CLOSE.w, END_CLOSE.h);
  icon('close', END_CLOSE.x + 16, END_CLOSE.y + 12, COL.gold);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.text; ctx.fillText('닫기', END_CLOSE.x + 44, END_CLOSE.y + 26);
}

function nameEntry() {
  return new Promise(res => {
    const box = document.getElementById('name-entry');
    const input = document.getElementById('name-input');
    const btn = document.getElementById('name-ok');
    UI.nameEntry = true; box.hidden = false; input.value = ''; setTimeout(() => input.focus(), 50);
    const done = () => {
      const v = input.value.trim().slice(0, 6);
      if (!v) { input.focus(); input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
      box.hidden = true; UI.nameEntry = false; btn.onclick = null; input.onkeydown = null; res(v);
    };
    btn.onclick = done;
    input.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) done(); };
  });
}
async function newGame() {
  Object.assign(G, { name: '', gender: 'f', day: 1, phase: 0, vars: { memory: 0, yuri_sync: 0, momo_trust: 0, cult_truth: 0 }, flags: {}, items: [], objective: '' });
  UI.fade = 1; bgm(null);
  const g = await ask(['여학생', '남학생'], '……당신은 누구였습니까?');
  G.gender = g === 0 ? 'f' : 'm';
  await narr('이름을 적어 주세요.');
  G.name = await nameEntry();
  await STORY.start();
}
async function continueGame() { await loadState(latestSave()); }
async function loadState(s) {
  if (!s) return showTitle();
  Object.assign(G, { name: s.name, gender: s.gender, day: s.day, phase: s.phase, vars: s.vars, flags: s.flags, items: s.items, objective: s.objective });
  UI.fade = 1;
  loadMap(s.map); player.x = s.x; player.y = s.y; player.dir = s.dir; player.pose = null;
  if (MAP.onLoad) MAP.onLoad();
  applyAmbience();
  if (STORY.resume && await STORY.resume()) return;
  await fadeIn(500);
  if (G.objective) toast('목표 — ' + G.objective);
}

/* ------------------------------------------------------------------ update */
function updateMsg(dt) {
  const m = UI.msg; m.t = (m.t || 0) + dt;
  const page = m.pages[m.page], total = page.join('').length;
  if (m.shown < total) {
    m.shown += dt * 0.06;
    m.blipT += dt; if (m.blipT > 70) { m.blipT = 0; Sound.sfx('blip', m.faceSheet); }
  }
  const t = Input.takeTap();
  if (t && inRect(t, SKIP_BTN)) { toggleSkip(); return; }
  let go = Input.ok() || t;
  if (skipping()) {
    if (isRead(msgKey(m))) { m.skipT = (m.skipT || 0) + dt; m.shown = total; if (m.skipT >= SKIP_STEP) go = true; }
    else stopSkipAtUnread();
  }
  if (go) {
    if (m.shown < total) { m.shown = total; return; }
    m.skipT = 0;
    markRead(msgKey(m));
    if (!skipping()) Sound.sfx('next');
    if (m.page < m.pages.length - 1) { m.page++; m.shown = 0; return; }
    UI.msg = null; m.res && m.res();
  }
}
function choiceRect(n) {
  const w = 380, h = n * 46 + 24;
  return { x: SW - w - 24, y: UI.msg ? 452 - h - 10 : (SH - h) / 2, w, h };
}
function updateChoice() {
  const c = UI.choice, n = c.options.length;
  const d = Input.dirHit();
  if (d === 'up') { c.idx = (c.idx + n - 1) % n; Sound.sfx('cursor'); }
  if (d === 'down') { c.idx = (c.idx + 1) % n; Sound.sfx('cursor'); }
  let pick = Input.ok() ? c.idx : -1;
  const t = Input.takeTap();
  if (t) {
    const r = choiceRect(n), i = Math.floor((t.y - r.y - 14) / 46);
    if (t.x >= r.x && t.x <= r.x + r.w && i >= 0 && i < n) pick = i;
  }
  if (pick >= 0) { Sound.sfx('select'); UI.choice = null; c.res(pick); }
}
function updateBlack(dt) {
  const b = UI.black;
  b.alphas[b.idx] = Math.min(1, b.alphas[b.idx] + dt / 700);
  const t = Input.takeTap();
  if (t && inRect(t, SKIP_BTN)) { toggleSkip(); return; }
  let go = Input.ok() || t;
  const key = 'B|' + b.lines[b.idx];
  if (skipping()) {
    if (isRead(key)) { b.skipT = (b.skipT || 0) + dt; b.alphas[b.idx] = 1; if (b.skipT >= SKIP_STEP) go = true; }
    else stopSkipAtUnread();
  }
  if (go) {
    if (b.alphas[b.idx] < 1) { b.alphas[b.idx] = 1; return; }
    b.skipT = 0; markRead(key);
    if (b.idx < b.lines.length - 1) { b.idx++; if (!skipping()) Sound.sfx('page'); return; }
    UI.black = null; b.res();
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  if (busy && !UI.title && (Input.hit('KeyC') || Input.hit('Tab'))) toggleSkip();
  const fast = busy && !UI.title && !UI.choice && !UI.menu && skipping();
  const dtx = fast ? dt * 6 : dt;   // 빨리 넘기는 중에는 연출 대기·이동·페이드도 빠르게
  updateTweens(dtx); updateTimers(dtx);
  if (UI.shake > 0) UI.shake = Math.max(0, UI.shake - dt * 0.02);
  if (UI.glitch > 0) UI.glitch -= dt;
  if (UI.scare) UI.scare.t += dt;
  if (!busy && MAP && !UI.title) updatePhantoms();
  if (typeof Chase !== 'undefined' && Chase.active && !busy && MAP && !UI.title && !UI.menu && !UI.slots) Chase.update(dt);
  if (MAP && !UI.title) for (const e of EVENTS) if (e.watch && visible(e) && !e.moving) {   // 주인공 쪽으로 고개를 돌린다
    const dx = player.x - e.x, dy = player.y - e.y;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  for (const e of EVENTS) updateEntity(e, dtx);
  updateEntity(player, busy ? dtx : dt);
  if (Input.hit('F2')) UI.debug = !UI.debug;
  if (Input.hit('KeyN')) { Sound.toggle(); toast(Sound.on ? '소리 켬' : '소리 끔'); }   // M은 지도

  if (UI.nameEntry) { /* HTML input이 처리 */ }
  else if (UI.doc) updateDoc(dt);
  else if (UI.gallery) updateGallery();
  else if (UI.endings) updateEndings();
  else if (UI.record) updateRecord();
  else if (UI.slots) updateSlots();
  else if (UI.title) updateTitle(dt);
  else if (UI.choice) updateChoice();
  else if (UI.msg && !UI.msg.sticky) updateMsg(dt);
  else if (UI.black) updateBlack(dt);
  else if (UI.menu) updateMenu();
  else if (!busy && MAP) updatePlayer(dt);
  else Input.takeTap();

  if (UI.toast) { UI.toast.t += dt; if (UI.toast.t > 2600) UI.toast = null; }
  if (UI.banner) { UI.banner.t += dt; if (UI.banner.t > 3600) UI.banner = null; }
  render(now);
  Input.endFrame();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ render */
/* v3.0 색: 연보라 · 붉은색 · 검정 + 금은 아주 작은 점에만 */
const COL = {
  panel: 'rgba(8,6,12,0.94)', edge: '#b8aed0', inner: 'rgba(184,174,208,0.25)',
  text: '#e8e2f2', dim: '#6e6680', name: '#c9b8ec', think: '#9e94c0', sel: '#c4283a', selText: '#ff5a64', gold: '#b8aed0', point: '#b89a5a', red: '#c4283a',
};
/* 창 스킨 (v2.9) — 레트로 쯔꾸르풍: 바깥 검은 선 · 금테 2px(위·왼 밝게, 아래·오른 어둡게) · 안쪽 그늘 · 모서리 금 리벳 · 은은한 주사선 */
const SKIN = { out: '#000000', line: '#c8bede', line2: '#5e5672', red: '#c4283a', point: '#b89a5a', top: 'rgba(14,10,20,0.95)', bot: 'rgba(4,3,8,0.96)' };
function camera() {
  if (!MAP) return { x: 0, y: 0 };
  const mw = MAP.rows[0].length * TILE, mh = MAP.rows.length * TILE;
  const px = player.x * TILE + player.ox + TILE / 2, py = player.y * TILE + player.oy + TILE / 2;
  const cx = mw <= SW ? (mw - SW) / 2 : Math.max(0, Math.min(mw - SW, px - SW / 2));
  const cy = mh <= SH ? (mh - SH) / 2 : Math.max(0, Math.min(mh - SH, py - SH / 2));
  return { x: Math.round(cx), y: Math.round(cy) };
}
/* 바닥 변형: 범례에 [타일셋, [번호, 번호, 번호], 통행] 처럼 배열을 주면 칸 위치에 따라 하나를 고른다.
   같은 칸은 언제나 같은 타일이고, 이웃한 칸끼리 반복 무늬가 생기지 않게 섞인다. */
function pickVariant(idx, x, y) {
  if (!Array.isArray(idx)) return idx;
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return idx[(h >>> 0) % idx.length];
}
function drawTile(ts, idx, dx, dy, mx, my) {
  idx = stageIdx(ts, idx, mx, my);
  const im = IMG[stageSheet(ts)]; if (!im) { ctx.fillStyle = '#3a3f55'; ctx.fillRect(dx, dy, TILE, TILE); return; }
  ctx.drawImage(im, (idx % 8) * TILE, Math.floor(idx / 8) * TILE, TILE, TILE, dx, dy, TILE, TILE);
}
function drawEntity(e, cam, isPlayer) {
  const sx = e.x * TILE + e.ox - cam.x, sy = e.y * TILE + e.oy - cam.y;
  ctx.globalAlpha = e.opacity;
  if (e.pose) {
    const im = IMG[e.pose.sheet];
    const f = Math.floor(performance.now() / 600) % 3;
    if (im) { const fw = im.width / 3, fh = im.height / 4, h = Math.round(48 * fh / fw); ctx.drawImage(im, f * fw, e.pose.row * fh, fw, fh, sx, sy + 48 - h, 48, h); }   // 키 큰 포즈 칸도 발끝 기준
  } else {
    const sheet = isPlayer ? heroSheet() : (typeof e.sprite === 'function' ? e.sprite() : e.sprite);
    const im = IMG[sheet];
    if (im) {
      const prog = e.moving ? 1 - (Math.abs(e.ox) + Math.abs(e.oy)) / TILE : 1;
      const stepping = e.moving && prog < 0.55;
      const pat = stepping ? (e.parity ? 0 : 2) : 1;
      const fw = im.width / 3, fh = im.height / 4, h = Math.round(48 * fh / fw);   // 키 큰 시트(48×96 등)는 발끝 기준으로 위로 늘어난다
      ctx.drawImage(im, pat * fw, DIR_ROW[e.dir] * fh, fw, fh, sx, sy + 48 - h - (stepping ? 1 : 0), 48, h);
    }
    if (!isPlayer && e.mark && (typeof e.mark !== 'function' || e.mark())) {   // 부탁할 사람 머리 위 「!」
      const bob = Math.round(Math.sin(performance.now() / 260) * 2), top = sy + 48 - (im ? Math.round(48 * (im.height / 4) / (im.width / 3)) : 48) - 18 + bob;
      ctx.fillStyle = 'rgba(10,8,16,0.85)'; ctx.fillRect(sx + 17, top - 2, 14, 18);
      ctx.strokeStyle = '#c4283a'; ctx.strokeRect(sx + 17.5, top - 1.5, 13, 17);
      ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#ece6f4'; ctx.textAlign = 'center'; ctx.fillText('!', sx + 24, top + 12); ctx.textAlign = 'left';
    }
  }
  ctx.globalAlpha = 1;
}
function pxDiamond(cx, cy, r, light, dark, mid) {
  for (let d = -r; d <= r; d++) { const w = r - Math.abs(d); ctx.fillStyle = d < 0 ? light : dark; ctx.fillRect(cx - w, cy + d, w * 2 + 1, 1); }
  if (mid) { ctx.fillStyle = mid; ctx.fillRect(cx, cy, 1, 1); }
}
/* 창 스킨 (v3.0) — 검은 창 + 가는 연보라 두 겹 선(바깥 1px 밝게, 2px 띄우고 안쪽 1px 어둡게).
   모서리에만 작은 금 점, 큰 창은 위 가운데에 작은 붉은 마름모. */
function panel(x, y, w, h, alpha = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, SKIN.top); g.addColorStop(1, SKIN.bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(200,190,222,0.025)'; for (let yy = y + 6; yy < y + h - 6; yy += 2) ctx.fillRect(x + 6, yy, w - 12, 1);
  const box = (a, b, c, d) => { ctx.fillRect(a, b, c, 1); ctx.fillRect(a, b + d - 1, c, 1); ctx.fillRect(a, b, 1, d); ctx.fillRect(a + c - 1, b, 1, d); };
  ctx.fillStyle = SKIN.line; box(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = SKIN.line2; box(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = SKIN.point;
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) { ctx.fillRect(cx - 1, cy - 1, 3, 3); }
  ctx.fillStyle = SKIN.out;
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(cx, cy, 1, 1);
  if (w >= 300) pxDiamond(x + (w >> 1), y + 1, 2, SKIN.red, '#6a1420');
  ctx.restore();
}
/* 선택 커서 (v3.0): 붉은 점 ● + 아주 옅은 붉은 띠, 글자는 붉게 */
function selBand(x, y, w, h) {
  x = Math.round(x); y = Math.round(y);
  const t = performance.now(), a = 0.10 + 0.05 * Math.sin(t / 260);
  ctx.fillStyle = `rgba(196,40,58,${a.toFixed(3)})`; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(196,40,58,0.55)'; ctx.fillRect(x, y + h - 1, w, 1);
  const cx = x - 8, cy = y + (h >> 1), on = Math.floor(t / 420) % 2 === 0;
  ctx.fillStyle = on ? '#e0303e' : '#9a1e2c';
  ctx.fillRect(cx - 2, cy - 3, 5, 7); ctx.fillRect(cx - 3, cy - 2, 7, 5);
  ctx.fillStyle = '#ff8a90'; ctx.fillRect(cx - 1, cy - 2, 1, 1);
}
const PX_ICONS = {
  calendar: ['..#.....#...', '############', '#..........#', '############', '#.##.##.##.#', '#..........#', '#.##.##.##.#', '#..........#', '#.##.##....#', '############'],
  clock: ['...####...', '.##....##.', '.#..#...#.', '#...#....#', '#...#....#', '#...###..#', '#........#', '.#......#.', '.##....##.', '...####...'],
  bag: ['...####...', '..#....#..', '..#....#..', '##########', '#........#', '#..####..#', '#........#', '#........#', '##########'],
  book: ['##########', '#.#......#', '#.#.####.#', '#.#......#', '#.#.###..#', '#.#......#', '#.#......#', '#.#......#', '##########'],
  sound: ['...#......', '..##..#...', '####...#..', '####.#..#.', '####.#..#.', '####...#..', '..##..#...', '...#......'],
  mute: ['...#......', '..##......', '####.#...#', '####..#.#.', '####...#..', '####..#.#.', '..##.#...#', '...#......'],
  door: ['########', '#......#', '#......#', '#......#', '#....#.#', '#......#', '#......#', '#......#', '########'],
  close: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  menu: ['##########', '..........', '..........', '##########', '..........', '..........', '##########'],
};
function icon(kind, x, y, color) {
  const bm = PX_ICONS[kind === 'sound' && !Sound.on ? 'mute' : kind]; if (!bm) return;
  const ox = Math.round(x + (16 - bm[0].length) / 2), oy = Math.round(y + (16 - bm.length) / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  bm.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(ox + i + 1, oy + j + 1, 1, 1); });
  ctx.fillStyle = color;
  bm.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(ox + i, oy + j, 1, 1); });
}
function hudVisible() { return MAP && !UI.black && !UI.doc && !(UI.cg && UI.cgAlpha > 0.4) && UI.fade < 0.5 && !UI.title; }
function renderHUD() {
  panel(12, 12, 168, 64);
  icon('calendar', 26, 22, COL.gold); icon('clock', 26, 48, COL.gold);
  ctx.font = `bold 17px ${SERIF}`; ctx.fillStyle = COL.text;
  ctx.fillText(`DAY ${G.day}`, 52, 37); ctx.fillText(G.flags.timeFlows || (G.vars.cult_truth >= 80 && performance.now() % 23000 < 700) ? 'AM 08:14' : 'AM 08:13', 52, 63);
  if (!busy && !UI.menu) {
    const b = MENU_BTN; panel(b.x, b.y, b.w, b.h);
    icon('menu', b.x + 16, b.y + 12, COL.gold);
    ctx.font = `bold 15px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText('MENU', b.x + 40, b.y + 26);
    if (hasMap()) {
      const m = MAP_BTN; panel(m.x, m.y, m.w, m.h);
      ctx.font = `bold 15px ${SERIF}`; ctx.fillStyle = COL.text; ctx.textAlign = 'center'; ctx.fillText('지도 (M)', m.x + m.w / 2, m.y + 26); ctx.textAlign = 'left';
    }
  }
}
/* ------------------------------------------------------------------ 방 테두리 · 2칸 벽 (v1.7)
   지도 문자 'T'는 그림 대신 검은 칸이다. 방과 맞닿은 면에는 밝은 천장 테두리 띠를 그린다.
   벽 줄 바로 위의 'T'는 벽의 윗칸이 되어 벽이 2칸 높이로 보인다. 윗칸 그림은 아래 칸 범례의
   네 번째 값(예: [TC, 3, 0, 28])이 있으면 그 번호, 없으면 창문(3번)은 28번, 나머지는 2번이다.
   맵에 tileBorder: true를 주면 예전처럼 'T'를 타일셋 2번 칸으로 그린다. 맵의 rim 값으로 띠 색을 바꾼다. */
const VOID_COL = '#07070c';
const RIM_STYLE = {
  school: { band: '#5e566e', hi: '#9a90b0', lo: '#141018' },
  dark: { band: '#4a4252', hi: '#6a6072', lo: '#120e16' },
};
const WINDOW_UPPER_SETS = ['tiles_classroom', 'tiles_hallway', 'tiles_cafeteria', 'tiles_chapel'];
const BAND = 9;
function rimStyle() { return RIM_STYLE[MAP.rim || 'school'] || RIM_STYLE.school; }
function isUpperWall(x, y) {
  if (tileChar(x, y) !== 'T') return false;
  const b = tileChar(x, y + 1), b2 = tileChar(x, y + 2);
  return b !== null && b !== 'T' && b2 !== null && b2 !== 'T';
}
function roomCell(x, y) { const c = tileChar(x, y); return c !== null && (c !== 'T' || isUpperWall(x, y)); }
function drawUpperWall(x, y, dx, dy) {
  const below = MAP.legend[tileChar(x, y + 1)];
  const d = typeof below === 'function' ? below() : below;
  if (!d) { ctx.fillStyle = VOID_COL; ctx.fillRect(dx, dy, TILE, TILE); return; }
  const base = Array.isArray(d[1]) ? d[1][0] : d[1];
  const idx = d[3] !== undefined ? d[3] : (base === 3 && WINDOW_UPPER_SETS.includes(d[0]) ? 28 : 2);
  drawTile(d[0], idx, dx, dy, x, y);
  const st = rimStyle();
  ctx.fillStyle = st.band; ctx.fillRect(dx, dy, TILE, BAND);
  ctx.fillStyle = st.hi; ctx.fillRect(dx, dy + BAND - 2, TILE, 1);
  ctx.fillStyle = st.lo; ctx.fillRect(dx, dy, TILE, 1);
}
function drawVoid(x, y, dx, dy) {
  ctx.fillStyle = VOID_COL; ctx.fillRect(dx, dy, TILE, TILE);
  const st = rimStyle(), B = BAND;
  const L = roomCell(x - 1, y), R = roomCell(x + 1, y), U = roomCell(x, y - 1), D = roomCell(x, y + 1);
  ctx.fillStyle = st.band;
  if (L) ctx.fillRect(dx, dy, B, TILE);
  if (R) ctx.fillRect(dx + TILE - B, dy, B, TILE);
  if (U) ctx.fillRect(dx, dy, TILE, B);
  if (D) ctx.fillRect(dx, dy + TILE - B, TILE, B);
  // 바깥 모서리
  if (!L && !U && roomCell(x - 1, y - 1)) ctx.fillRect(dx, dy, B, B);
  if (!R && !U && roomCell(x + 1, y - 1)) ctx.fillRect(dx + TILE - B, dy, B, B);
  if (!L && !D && roomCell(x - 1, y + 1)) ctx.fillRect(dx, dy + TILE - B, B, B);
  if (!R && !D && roomCell(x + 1, y + 1)) ctx.fillRect(dx + TILE - B, dy + TILE - B, B, B);
  ctx.fillStyle = st.hi;
  if (L) ctx.fillRect(dx, dy, 1, TILE);
  if (R) ctx.fillRect(dx + TILE - 1, dy, 1, TILE);
  if (U) ctx.fillRect(dx, dy, TILE, 1);
  if (D) ctx.fillRect(dx, dy + TILE - 1, TILE, 1);
  ctx.fillStyle = st.lo;
  if (L) ctx.fillRect(dx + B, dy, 1, TILE);
  if (R) ctx.fillRect(dx + TILE - B - 1, dy, 1, TILE);
  if (U) ctx.fillRect(dx, dy + B, TILE, 1);
  if (D) ctx.fillRect(dx, dy + TILE - B - 1, TILE, 1);
}
/* 아래 가장자리의 출입구(맨 아래 줄의 지나갈 수 있는 칸) 밖으로 짧은 통로를 그린다. 그림일 뿐 걸어 들어갈 수는 없다. */
function drawStubs(cam) {
  const n = MAP.rows.length, W = MAP.rows[0].length, st = rimStyle();
  const fl = tileDef('.') || null;
  for (let x = 0; x < W; x++) {
    const d = tileDef(MAP.rows[n - 1][x]); if (!d || !d[2] || MAP.rows[n - 1][x] === 'T') continue;
    const dx = x * TILE - cam.x, dy = n * TILE - cam.y;
    for (let k = 0; k < 2; k++) { if (fl) drawTile(fl[0], pickVariant(fl[1], x, n + k), dx, dy + k * TILE, x, n + k); }
    const g = ctx.createLinearGradient(0, dy, 0, dy + TILE * 2);
    g.addColorStop(0, 'rgba(7,7,12,0.15)'); g.addColorStop(1, 'rgba(7,7,12,1)');
    ctx.fillStyle = g; ctx.fillRect(dx, dy, TILE, TILE * 2);
    for (const side of [-1, 1]) {
      if (roomCell(x + side, n - 1) && tileChar(x + side, n - 1) !== 'T') continue;
      const bx = side < 0 ? dx - BAND : dx + TILE;
      const gb = ctx.createLinearGradient(0, dy - TILE, 0, dy + TILE * 2);
      gb.addColorStop(0, st.band); gb.addColorStop(0.5, st.band); gb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gb; ctx.fillRect(bx, dy - TILE, BAND, TILE * 3);
    }
  }
}

/* ------------------------------------------------------------------ 오염 · 붕괴 — 날이 갈수록 얼룩, 피, 글씨, 살덩이가 늘어난다 (v1.7)
   한 번 그린 붕괴 층은 맵·날짜별로 저장해 두고 매 프레임 그대로 덮는다. 벽 속의 눈만 매 프레임 그린다. */
const DECAY = [0, 0, 0.03, 0.06, 0.1, 0.15, 0.22, 0.3];   // 날짜별 칸당 얼룩 확률 (인덱스 = DAY)
const BLOOD = [0, 0, 0, 0, 0, 0.07, 0.11, 0.15];          // 날짜별 칸당 핏자국 확률
function decayLevel() { return MAP && !MAP.noDecay && !UI.title ? (DECAY[G.day] || 0) : 0; }
function hash3(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function mapSeed() { let h = 0; for (const c of (G.map || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
const SCRIBBLES = ['남기지 마', '하나', '맛있어?', '잘 먹겠습니다', '우리', '다음에는', '〈N〉'];
// 붉은 글씨 연출 (v1.7에서 뺌 — 다시 쓰려면 RED_WORDS를 true로)
const RED_WORDS = false;
const WALL_WORDS = { 5: '하나가 되자', 6: '남기지 마', 7: '잘 먹겠습니다' };
const FLOOR_WORDS = { 6: '모두 하나가 되었다', 7: '모두 하나가 되었다' };
const FLOOR_WORD_MAPS = { 6: ['classroom', 'hall1', 'hall2', 'library', 'restroom'], 7: ['classroom', 'hall1', 'hall2', 'library', 'restroom', 'basement', 'infirmary', 'dorm', 'office'] };
const FLESH_MAPS = ['hall1', 'hall2', 'basement', 'deepchapel'];
let decayCache = { key: '', cv: null };
function decayKey() { return `${G.map}|${G.day}|${G.name}|${MAP.rows[0].length}x${MAP.rows.length}`; }
function splat(c, cx, cy, r, seed, col = '120,8,16') {
  c.fillStyle = `rgba(${col},0.82)`;
  c.beginPath(); c.ellipse(cx, cy, r, r * 0.8, seed * 6, 0, 7); c.fill();
  for (let i = 0; i < 9; i++) {
    const a = hash3(i, seed * 97 | 0, 3) * 6.28, d = r * (0.7 + hash3(seed * 13 | 0, i, 5) * 1.6), rr = 1 + hash3(i, 7, seed * 31 | 0) * r * 0.35;
    c.beginPath(); c.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, rr, rr, 0, 0, 7); c.fill();
    if (i < 3) { c.lineWidth = rr * 0.9; c.strokeStyle = `rgba(${col},0.7)`; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8); c.stroke(); }
  }
  c.fillStyle = 'rgba(60,0,6,0.5)'; c.beginPath(); c.ellipse(cx - r * 0.2, cy - r * 0.1, r * 0.5, r * 0.35, 0, 0, 7); c.fill();
}
function hand(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = 'rgba(150,12,22,0.8)';
  c.beginPath(); c.ellipse(0, 0, 5 * s, 6 * s, 0, 0, 7); c.fill();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse((-4.5 + i * 3) * s, -9 * s, 1.3 * s, 3.8 * s, (-0.25 + i * 0.15), 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(6 * s, -2 * s, 1.4 * s, 3.4 * s, 0.9, 0, 7); c.fill();
  c.fillRect(-1 * s, 5 * s, 1.2 * s, 6 * s); c.restore();
}
function drips(c, x, y, w, n, seed, maxLen) {
  c.fillStyle = 'rgba(130,8,18,0.85)';
  for (let i = 0; i < n; i++) {
    const xx = x + hash3(i, seed, 11) * w, len = 6 + hash3(seed, i, 13) * maxLen;
    c.fillRect(xx, y, 2, len); c.beginPath(); c.ellipse(xx + 1, y + len, 2, 2.6, 0, 0, 7); c.fill();
  }
}
function bloodText(c, text, x, y, size, seed, alpha = 0.8) {
  c.save(); c.font = `bold ${size}px ${SERIF}`; c.textBaseline = 'alphabetic';
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], w = c.measureText(ch).width;
    c.save(); c.translate(cx + w / 2, y + (hash3(i, seed, 1) - 0.5) * size * 0.18); c.rotate((hash3(seed, i, 2) - 0.5) * 0.28);
    c.fillStyle = `rgba(140,8,18,${alpha})`; c.fillText(ch, -w / 2, 0);
    if (ch !== ' ' && hash3(i, seed, 3) < 0.6) { c.fillRect(-w / 2 + hash3(i, 4, seed) * w, -2, 2, 6 + hash3(i, 5, seed) * size * 0.5); }
    c.restore(); cx += w * 1.02;
  }
  c.restore(); return cx - x;
}
function symbol(c, x, y, r) {
  c.save(); c.strokeStyle = 'rgba(130,8,18,0.85)'; c.lineWidth = 2.4;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  c.beginPath(); c.arc(x - r * 0.32, y, r * 0.52, 0, 7); c.stroke();
  c.beginPath(); c.arc(x + r * 0.32, y, r * 0.52, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
  drips(c, x - r, y + r - 2, r * 2, 4, 9, r * 0.8); c.restore();
}
function veins(c, x, y, len, ang, seed, depth = 0) {
  if (depth > 3 || len < 6) return;
  c.strokeStyle = `rgba(${110 - depth * 10},6,16,${0.8 - depth * 0.12})`; c.lineWidth = 3.2 - depth * 0.7;
  let px = x, py = y; c.beginPath(); c.moveTo(px, py);
  for (let i = 0; i < 4; i++) { ang += (hash3(i, seed, depth) - 0.5) * 0.7; px += Math.cos(ang) * len / 4; py += Math.sin(ang) * len / 4; c.lineTo(px, py); }
  c.stroke();
  veins(c, px, py, len * 0.62, ang - 0.5, seed + 3, depth + 1);
  if (hash3(seed, depth, 7) < 0.7) veins(c, px, py, len * 0.55, ang + 0.6, seed + 5, depth + 1);
}
function flesh(c, dx, dy, x, y) {
  c.fillStyle = 'rgba(176,72,92,0.72)'; c.fillRect(dx, dy, TILE, TILE);
  for (let i = 0; i < 11; i++) {
    const bx = dx + hash3(x * 7 + i, y, 21) * TILE, by = dy + hash3(x, y * 7 + i, 22) * TILE, r = 4 + hash3(i, x, y) * 7;
    c.fillStyle = 'rgba(214,120,138,0.85)'; c.beginPath(); c.ellipse(bx, by, r, r * 0.85, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(110,24,44,0.6)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(250,190,200,0.6)'; c.fillRect(bx - r * 0.4, by - r * 0.45, 2, 2);
  }
}
function buildDecay() {
  const W = MAP.rows[0].length, H = MAP.rows.length, day = G.day, seed = mapSeed();
  const cv = document.createElement('canvas'); cv.width = W * TILE; cv.height = (H + 2) * TILE;
  const c = cv.getContext('2d');
  const floor = (x, y) => { const ch = tileChar(x, y); if (!ch || ch === 'T' || isUpperWall(x, y - 1)) return false; const d = tileDef(ch); return d && d[2]; };
  const wallLow = (x, y) => { const ch = tileChar(x, y); if (!ch || ch === 'T') return false; const d = tileDef(ch); return d && !d[2] && isUpperWall(x, y - 1); };
  const p = DECAY[day] || 0, pb = BLOOD[day] || 0;
  // 살덩이 바닥 (7일째 복도·지하)
  if (day >= 7 && FLESH_MAPS.includes(G.map)) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floor(x, y)) flesh(c, x * TILE, y * TILE, x, y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = MAP.rows[y][x], dx = x * TILE, dy = y * TILE;
    const r = hash3(x, y, seed), r2 = hash3(y, x, seed + 7), r3 = hash3(x + 3, y + 5, seed);
    if (ch === 'T') {
      if (isUpperWall(x, y) && day >= 6 && r < 0.5) veins(c, dx + r2 * TILE, dy + TILE, 34 + r3 * 20, -1.57 + (r2 - 0.5), x * 31 + y);
      continue;
    }
    const d = tileDef(ch); if (!d) continue;
    if (floor(x, y)) {
      if (r < p) {          // 얼룩
        c.globalAlpha = 0.18 + 0.4 * r2 * Math.min(1, p * 4);
        c.fillStyle = r3 < 0.5 ? '#3a0f12' : '#231a14';
        c.beginPath(); c.ellipse(dx + 10 + r2 * 28, dy + 12 + r3 * 24, 6 + r2 * 12, 4 + r3 * 8, r2 * 3, 0, 7); c.fill();
        c.globalAlpha = 1;
      }
      if (hash3(x + 11, y + 17, seed) < pb) splat(c, dx + 12 + r2 * 24, dy + 12 + r3 * 24, 6 + r2 * (day >= 6 ? 14 : 8), x * 13 + y);
      if (day >= 5 && hash3(x, y + 29, seed) < pb * 0.5) hand(c, dx + 10 + r3 * 28, dy + 14 + r2 * 22, 1.1, r2 * 6.28);
    } else {
      // 벽·가구: 금
      if (r < p) {
        c.strokeStyle = 'rgba(10,6,10,0.55)'; c.lineWidth = 1.2;
        c.beginPath(); let cx = dx + 8 + r2 * 30, cy = dy + 2; c.moveTo(cx, cy);
        for (let i = 0; i < 5; i++) { cx += (hash3(i, x, y) - 0.5) * 14; cy += 6 + hash3(y, i, x) * 6; c.lineTo(cx, cy); }
        c.stroke();
      }
      const base = Array.isArray(d[1]) ? d[1][0] : d[1];
      if (wallLow(x, y)) {
        if (base === 3 && day >= 5 && hash3(x, y, seed + 41) < 0.35 + (day - 5) * 0.18) {   // 창문 손자국
          hand(c, dx + 14 + r2 * 10, dy + 16 + r3 * 6, 0.9, -0.3 + r2 * 0.6);
          if (day >= 5) hand(c, dx + 30 + r3 * 6, dy + 10 + r2 * 8, 0.8, 0.4 - r3 * 0.6);
          if (y > 0 && isUpperWall(x, y - 1) && day >= 6) hand(c, dx + 22, dy - 18, 1, r * 0.8);
        }
        if (day >= 5 && r2 < 0.35 + (day - 5) * 0.15) drips(c, dx, dy, TILE, 3 + Math.floor(r3 * 4), x * 7 + y, 10 + day * 3);
        if (day >= 6 && r3 < 0.5) veins(c, dx + r * TILE, dy + TILE, 30 + r2 * 24, -1.57 + (r3 - 0.5) * 0.8, x * 17 + y * 3);
      }
      if (RED_WORDS && day >= 5 && r3 < 0.4 && y <= 2 && r < p * 2) {
        c.font = `bold 11px ${FONT}`; c.fillStyle = 'rgba(120,20,26,0.75)';
        c.fillText(SCRIBBLES[Math.floor(r2 * SCRIBBLES.length)].replace('〈N〉', G.name || ''), dx + 2, dy + 20 + r3 * 20);
      }
    }
  }
  // 윗벽의 큰 글씨 + 문양 (5일째부터)
  if (day >= 5) {
    let runs = [], cur = null;
    for (let x = 0; x < W; x++) {
      if (isUpperWall(x, 0)) { if (!cur) cur = { x, n: 0 }; cur.n++; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    runs = runs.filter(rn => rn.n >= 4).sort((a, b) => b.n - a.n);
    if (runs[0] && !RED_WORDS) symbol(c, (runs[0].x + runs[0].n / 2) * TILE, 26, 16);
    if (runs[0] && RED_WORDS) {
      const rn = runs[0], word = WALL_WORDS[Math.min(7, day)];
      c.save(); c.font = `bold 34px ${SERIF}`; const tw = c.measureText(word).width; c.restore();
      const sx = rn.x * TILE + (rn.n * TILE - tw) / 2 + (hash3(seed, day, 1) - 0.5) * 60;
      bloodText(c, word, sx, 40, 34, seed + day, 0.88);
      if (rn.n >= 9 || runs[1]) {
        const r2 = runs[1] || rn, sxs = (runs[1] ? r2.x + r2.n / 2 : rn.x + 1.2) * TILE;
        symbol(c, sxs, 26, 16);
      }
    }
  }
  // 바닥 글씨와 끈 자국은 따로 그린 뒤 바닥 칸 밖을 지운다
  const outer = c, lay = document.createElement('canvas'); lay.width = cv.width; lay.height = cv.height;
  { const c = lay.getContext('2d');
  // 바닥 가득 붉은 글씨 (6일째부터 정해진 장소)
  if (RED_WORDS && FLOOR_WORDS[day] && (FLOOR_WORD_MAPS[day] || []).includes(G.map)) {
    const word = FLOOR_WORDS[day], size = 30;
    for (let y = 0; y < H; y++) {
      let fl = 0; for (let x = 0; x < W; x++) if (floor(x, y)) fl++;
      if (fl < W * 0.5 || (y % 2)) continue;
      let x0 = TILE * 0.6 - (y * 37 % 90);
      while (x0 < W * TILE) { x0 += bloodText(c, word, x0, y * TILE + 36, size, seed + y * 3 + Math.floor(x0), 0.5) + 40; }
    }
  }
  // 질질 끈 자국 (6일째부터)
  if (day >= 6) {
    const ys = []; for (let y = 0; y < H; y++) { let fl = 0; for (let x = 0; x < W; x++) if (floor(x, y)) fl++; if (fl > W * 0.6) ys.push(y); }
    if (ys.length) {
      const y = ys[Math.floor(hash3(seed, day, 5) * ys.length)];
      c.strokeStyle = 'rgba(110,6,14,0.55)'; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) { c.lineWidth = 6 - k * 1.5; c.beginPath(); c.moveTo(TILE, y * TILE + 22 + k * 6); for (let x = 2; x < W; x++) c.lineTo(x * TILE, y * TILE + 22 + k * 6 + Math.sin(x + k) * 5); c.stroke(); }
    }
  }
  c.globalCompositeOperation = 'destination-in'; c.fillStyle = '#000';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floor(x, y)) c.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  outer.drawImage(lay, 0, 0);
  return cv;
}
function drawDecay(cam, now) {
  if (!decayLevel() || mapHasStageArt()) return;   // v2.4: 단계별 타일셋이 있으면 그림이 대신한다
  const key = decayKey();
  if (decayCache.key !== key) decayCache = { key, cv: buildDecay() };
  ctx.drawImage(decayCache.cv, -cam.x, -cam.y);
}
/* 벽 속의 눈 — 6일째부터 검은 칸에서 눈이 뜨고 주인공을 따라본다 */
function drawEyes(cam, now) {
  if (!decayLevel() || G.day < 6) return;
  const W = MAP.rows[0].length, H = MAP.rows.length, seed = mapSeed();
  const px = player.x * TILE + player.ox + 24, py = player.y * TILE + player.oy + 24;
  const prob = G.day >= 7 ? 0.32 : 0.18;
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    const ch = tileChar(x, y);
    if (ch !== null && (ch !== 'T' || isUpperWall(x, y))) continue;
    if (hash3(x + 50, y + 50, seed + 99) > prob) continue;
    const ex = x * TILE + 12 + hash3(x, y, 3) * 24, ey = y * TILE + 14 + hash3(y, x, 4) * 20;
    const ph = (now / 1000 + hash3(x, y, 5) * 9) % 6, open = ph < 5.6 ? 1 : Math.abs(ph - 5.8) * 5;
    const sx = ex - cam.x, sy = ey - cam.y;
    if (sx < -20 || sy < -20 || sx > SW + 20 || sy > SH + 20) continue;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, Math.max(0.08, Math.min(1, open)));
    ctx.fillStyle = 'rgba(232,208,120,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, 0, 7); ctx.fill();
    const a = Math.atan2(py - ey, px - ex);
    ctx.fillStyle = '#1a0a06'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 3, Math.sin(a) * 1.5, 2.2, 3.4, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
}
// 4일째부터 조명이 가끔 꺼졌다 켜진다
function drawFlicker(now) {
  if (G.day < 4 || !decayLevel()) return;
  const period = 9000 - G.day * 700, t = now % period;
  if (t < 90 || (G.day >= 6 && t > 220 && t < 280)) { ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, SW, SH); }
}

/* ------------------------------------------------------------------ 깜놀 — 점프스케어 · 화면 깨짐 · 소리 끊김
   scare('meal') : assets/cg/scare_meal.png 가 있으면 그 그림, 없으면 코드로 그린 얼굴이 순간 화면을 덮는다. */
async function scare(key, ms = 650) {
  Sound.silence(380); await wait(380);
  UI.scare = { key, t: 0, ms }; Sound.sfx('scare'); UI.shake = 16;
  await wait(ms);
  UI.scare = null; glitch(260);
  await wait(200);
}
function glitch(ms = 220) { UI.glitch = Math.max(UI.glitch || 0, ms); Sound.sfx('static'); }
function renderScare(now) {
  if (UI.glitch > 0) {
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(Math.random() * SH), h = 6 + Math.floor(Math.random() * 40), off = (Math.random() * 2 - 1) * 40;
      try { ctx.drawImage(canvas, 0, y, SW, h, off, y, SW, h); } catch (e) {}
    }
    ctx.fillStyle = `rgba(140,0,16,${0.12 + Math.random() * 0.18})`; ctx.fillRect(0, 0, SW, SH);
  }
  const S = UI.scare; if (!S) return;
  const im = IMG['scare_' + S.key];
  if (im) markCgSeen('scare_' + S.key);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  if (im) { const z = 1 + S.t / S.ms * 0.12; ctx.drawImage(im, SW / 2 - SW * z / 2, SH / 2 - SH * z / 2, SW * z, SH * z); }
  else {
    const z = 1 + S.t / S.ms * 0.25;
    ctx.save(); ctx.translate(SW / 2 + (Math.random() - 0.5) * 10, SH / 2 + 30); ctx.scale(z, z);
    ctx.fillStyle = '#d9d2cc'; ctx.beginPath(); ctx.ellipse(0, 0, 200, 260, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.beginPath(); ctx.ellipse(-72, -40, 38, 52, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(72, -40, 38, 52, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 120, 70, 90, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a0d16'; ctx.beginPath(); ctx.ellipse(0, 150, 40, 40, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = `rgba(120,0,10,${0.15 + Math.random() * 0.2})`; ctx.fillRect(0, 0, SW, SH);
}

/* 다가가면 사라지는 사람 — 이벤트에 phantom: 3 (거리)을 주면 그 거리 안으로 들어올 때 사라진다(그날 한 번) */
function updatePhantoms() {
  for (const e of EVENTS) {
    if (!e.phantom || !visible(e)) continue;
    if (Math.abs(e.x - player.x) + Math.abs(e.y - player.y) <= e.phantom) {
      G.flags[`ph_${G.map}_${e.id}_${G.day}`] = true; Sound.sfx('static');
      if (e.onVanish) run(e.onVanish);
    }
  }
}

function render(now) {
  ctx.save();
  ctx.fillStyle = MAP && !UI.title ? VOID_COL : '#0c0e16'; ctx.fillRect(0, 0, SW, SH);
  if (UI.shake > 0) ctx.translate((Math.random() * 2 - 1) * UI.shake, (Math.random() * 2 - 1) * UI.shake);
  if (UI.title) { renderTitle(now); ctx.restore(); renderOverlay(now); if (UI.endings) renderEndings(); if (UI.slots) renderSlots(); if (UI.record) renderRecord(); if (UI.gallery && !UI.doc) renderGallery(); return; }
  if (MAP) {
    const cam = camera();
    for (let y = 0; y < MAP.rows.length; y++) for (let x = 0; x < MAP.rows[0].length; x++) {
      const ch = MAP.rows[y][x];
      if (ch === 'T' && !MAP.tileBorder) {
        if (isUpperWall(x, y)) drawUpperWall(x, y, x * TILE - cam.x, y * TILE - cam.y); else drawVoid(x, y, x * TILE - cam.x, y * TILE - cam.y);
        continue;
      }
      const d = tileDef(ch); if (!d) continue;
      drawTile(d[0], pickVariant(d[1], x, y), x * TILE - cam.x, y * TILE - cam.y, x, y);
    }
    if (!MAP.tileBorder) drawStubs(cam);
    drawDecay(cam, now);
    for (const e of EVENTS) if (e.deco && visible(e)) e.deco(ctx, e.x * TILE - cam.x, e.y * TILE - cam.y);
    drawEyes(cam, now);
    if (typeof Chase !== 'undefined') Chase.renderBelow(cam, now);
    const ents = EVENTS.filter(e => visible(e) && (e.sprite || e.pose)).concat([player]);
    ents.sort((a, b) => (a.y * TILE + a.oy) - (b.y * TILE + b.oy));
    player.opacity = player.hiddenInChase && typeof Chase !== 'undefined' && Chase.active ? 0.45 : 1;
    for (const e of ents) drawEntity(e, cam, e === player);
    if (typeof reqGlow === 'function') for (const t of reqGlow()) {   // 부탁 목표가 있는 칸이 빛난다 (밝은 바닥에서도 보이게 더하기 합성)
      const cx = t.x * TILE + 24 - cam.x, cy = t.y * TILE + 24 - cam.y, k = 0.6 + 0.4 * Math.sin(now / 420);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 38);
      g.addColorStop(0, `rgba(255,230,170,${0.95 * k})`); g.addColorStop(0.4, `rgba(230,170,255,${0.55 * k})`); g.addColorStop(1, 'rgba(200,160,255,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 40, cy - 40, 80, 80);
      ctx.strokeStyle = `rgba(255,240,200,${0.5 + 0.4 * k})`; ctx.lineWidth = 2;   // 칸 테두리
      ctx.strokeRect(cx - 23, cy - 23, 46, 46); ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {   // 위로 떠오르는 빛 알갱이
        const a = now / 900 + i * 1.6, px = cx + Math.cos(a) * 15, py = cy + 4 - ((now / 28 + i * 13) % 30);
        ctx.fillStyle = `rgba(255,248,220,${0.9 * k})`; ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      ctx.restore();
    }
    if (typeof Chase !== 'undefined') Chase.renderAbove(cam, now);
    if (UI.tint.a > 0) { ctx.fillStyle = `rgba(${UI.tint.r},${UI.tint.g},${UI.tint.b},${UI.tint.a})`; ctx.fillRect(-20, -20, SW + 40, SH + 40); }
    // 가장자리 비네트
    const g = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.35, SW / 2, SH / 2, SH * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(6,6,14,${0.45 + decayLevel() * 0.9})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    drawFlicker(now);
  }
  if (UI.cg && UI.cgAlpha > 0 && IMG[cgKey(UI.cg)]) { ctx.globalAlpha = UI.cgAlpha; ctx.drawImage(IMG[cgKey(UI.cg)], 0, 0, SW, SH); drawCgOverlay(UI.cg); if (UI.cgAlpha > 0.5) markCgSeen(cgKey(UI.cg)); ctx.globalAlpha = 1; }
  if (UI.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${UI.fade})`; ctx.fillRect(-20, -20, SW + 40, SH + 40); }
  ctx.restore();
  if (hudVisible()) renderHUD();
  renderOverlay(now);
  renderScare(now);
}
function renderOverlay(now) {
  if (UI.black) {
    const b = UI.black;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    ctx.font = `22px ${SERIF}`; ctx.textAlign = 'center';
    // 긴 줄은 화면 폭에 맞춰 접는다 (접힌 줄끼리는 간격을 좁게)
    const lh = 42, sub = 30;
    const parts = b.lines.map(l => wrap(l, SW - 96, `22px ${SERIF}`));
    const total = parts.reduce((h, p) => h + lh + (p.length - 1) * sub, 0);
    let y = SH / 2 - total / 2 + 14;
    parts.forEach((p, i) => {
      if (i <= b.idx) { ctx.fillStyle = `rgba(236,230,240,${b.alphas[i]})`; p.forEach((l, j) => ctx.fillText(l, SW / 2, y + j * sub)); }
      y += lh + (p.length - 1) * sub;
    });
    ctx.textAlign = 'left';
  }
  if (UI.banner) {
    const t = UI.banner.t, a = t < 800 ? t / 800 : t > 2800 ? Math.max(0, 1 - (t - 2800) / 800) : 1;
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, SW, 0);
    g.addColorStop(0, 'rgba(14,16,28,0)'); g.addColorStop(0.5, 'rgba(14,16,28,0.88)'); g.addColorStop(1, 'rgba(14,16,28,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 236, SW, 112);
    ctx.fillStyle = '#b8aed0'; ctx.fillRect(SW / 2 - 160, 244, 320, 1); ctx.fillRect(SW / 2 - 160, 339, 320, 1); ctx.fillStyle = '#c4283a'; ctx.fillRect(SW / 2 - 1, 243, 3, 3); ctx.fillRect(SW / 2 - 1, 338, 3, 3);
    ctx.textAlign = 'center'; ctx.fillStyle = COL.text;
    ctx.font = `bold 40px ${SERIF}`; ctx.fillText(UI.banner.text, SW / 2, 296);
    if (UI.banner.sub) { ctx.font = `18px ${SERIF}`; ctx.fillStyle = COL.name; ctx.fillText(UI.banner.sub, SW / 2, 325); }
    ctx.textAlign = 'left'; ctx.restore();
  }
  if (UI.doc) renderDoc(now);
  if (UI.msg) renderMsg(now);
  if (UI.choice) {
    const c = UI.choice, r = choiceRect(c.options.length);
    panel(r.x, r.y, r.w, r.h);
    ctx.font = `19px ${FONT}`;
    c.options.forEach((o, i) => {
      const y = r.y + 14 + i * 46;
      if (i === c.idx) selBand(r.x + 14, y, r.w - 28, 40);
      ctx.fillStyle = i === c.idx ? COL.selText : COL.text;
      ctx.fillText(o, r.x + 30, y + 27);
    });
  }
  if (UI.menu) renderMenu();
  if (UI.slots && !UI.title) renderSlots();
  if (skipVisible()) {
    const b = SKIP_BTN, on = skipping();
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.8;
    panel(b.x, b.y, b.w, b.h);
    if (on) selBand(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.font = `bold 15px ${SERIF}`; ctx.fillStyle = on ? COL.selText : COL.text; ctx.textAlign = 'center';
    ctx.fillText(on ? '▶▶ SKIP' : 'SKIP', b.x + b.w / 2, b.y + 26); ctx.textAlign = 'left'; ctx.restore();
  }
  if (UI.toast) {
    const a = Math.min(1, (2600 - UI.toast.t) / 400, UI.toast.t / 200);
    ctx.font = `16px ${FONT}`; const w = ctx.measureText(UI.toast.text).width + 44;
    ctx.save(); ctx.globalAlpha = a; panel((SW - w) / 2, 18, w, 40);
    ctx.fillStyle = COL.text; ctx.textAlign = 'center'; ctx.fillText(UI.toast.text, SW / 2, 44); ctx.textAlign = 'left'; ctx.restore();
  }
  if (UI.debug) {
    ctx.font = `13px monospace`; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(SW - 236, 300, 228, 118);
    ctx.fillStyle = '#9f9';
    const v = G.vars;
    [`phase ${G.phase}  map ${G.map}`, `pos ${player.x},${player.y}`, `memory     ${v.memory}`, `yuri_sync  ${v.yuri_sync}`,
     `momo_trust ${v.momo_trust}`, `cult_truth ${v.cult_truth}`].forEach((s, i) => ctx.fillText(s, SW - 226, 320 + i * 17));
  }
}
function renderMsg(now) {
  const m = UI.msg, x0 = 12, y0 = 452, w = SW - 24, h = 164;
  panel(x0, y0, w, h);
  if (m.faceSheet && IMG[m.faceSheet]) {
    const im = IMG[m.faceSheet], f = m.face || 0;
    ctx.fillStyle = '#0a080e'; ctx.fillRect(24, 462, 148, 146);
    ctx.drawImage(im, (f % 4) * 144, Math.floor(f / 4) * 144, 144, 144, 26, 463, 144, 144);
    ctx.fillStyle = SKIN.line2; ctx.fillRect(24, 462, 148, 1); ctx.fillRect(24, 607, 148, 1); ctx.fillRect(24, 462, 1, 146); ctx.fillRect(171, 462, 1, 146);
  }
  if (m.name) {   // 이름은 대사창 위 작은 창에
    ctx.font = `bold 24px ${FONT}`;
    const nw = Math.ceil(ctx.measureText(m.name).width), nx = m.faceSheet ? 176 : 22, nh = 40;
    panel(nx, y0 - nh + 6, nw + 40, nh);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(m.name, nx + 21, y0 - 6);
    ctx.fillStyle = COL.name; ctx.fillText(m.name, nx + 20, y0 - 7);
  }
  const ty = y0 + 46;
  ctx.font = `21px ${FONT}`;
  const col = m.style === 'think' ? COL.think : (m.name || m.faceSheet ? COL.text : '#b8b0bc');   // 행동 지문(이름 없는 서술)은 회색
  // 잘못 들은 말: 처음 0.35초 동안 다른 문장이 붉게 비친다
  if (m.alt && m.page === 0 && (m.t || 0) < 350) {
    ctx.fillStyle = '#c23a4a';
    wrap(m.alt, SW - m.textX - 52, `21px ${FONT}`).slice(0, 3).forEach((line, i) => ctx.fillText(line, m.textX + Math.round((Math.random() - 0.5) * 3), ty + i * 34));
    return;
  }
  let left = Math.floor(m.shown);
  m.pages[m.page].forEach((line, i) => {
    const s = line.slice(0, Math.max(0, left)); left -= line.length;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(s, m.textX + 2, ty + i * 34 + 2);    // 픽셀 그림자
    ctx.fillStyle = col; ctx.fillText(s, m.textX, ty + i * 34);
  });
  const total = m.pages[m.page].join('').length;
  if (m.shown >= total && !m.sticky) {   // 넘김 표시: 통통 튀는 ▼
    const bx = SW - 46, by = y0 + h - 26 + (Math.floor(now / 260) % 2) * 2;
    ctx.fillStyle = SKIN.red; for (let i = 0; i < 5; i++) ctx.fillRect(bx - 5 + i, by + i, 11 - i * 2, 1);
  }
}
function renderMenu() {
  const m = UI.menu, opts = MENU_OPTS();
  ctx.fillStyle = 'rgba(8,10,18,0.55)'; ctx.fillRect(0, 0, SW, SH);
  renderHUD();
  // 명령 패널
  panel(CMD.x, CMD.y, CMD.w, 20 + opts.length * CMD.bh + 10);
  opts.forEach((o, i) => {
    const y = CMD.y + 20 + i * CMD.bh;
    const sel = m.mode === 'main' && i === m.idx;
    if (sel) selBand(CMD.x + 12, y, CMD.w - 24, CMD.bh - 6);
    else { ctx.strokeStyle = 'rgba(150,146,172,0.35)'; ctx.strokeRect(CMD.x + 12.5, y + 0.5, CMD.w - 25, CMD.bh - 7); }
    const dis = i === 0 && !G.items.length;
    icon(MENU_ICONS[i], CMD.x + 26, y + 12, sel ? COL.selText : (dis ? COL.dim : COL.gold));
    ctx.font = `18px ${FONT}`; ctx.fillStyle = sel ? COL.selText : (dis ? COL.dim : COL.text);
    ctx.fillText(o, CMD.x + 56, y + 27);
  });
  // 인벤토리
  panel(INV.x, INV.y, INV.w, INV.h);
  ctx.font = `bold 15px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText('INVENTORY', INV.x + 24, INV.y + 34);
  icon('close', INV.x + INV.w - 36, INV.y + 18, COL.dim);
  ctx.fillStyle = 'rgba(150,146,172,0.4)'; ctx.fillRect(INV.x + 20, INV.y + 48, INV.w - 40, 1);
  const rq = typeof reqText === 'function' ? reqText() : '';
  const oy = rq ? 70 : 76;   // 부탁이 있으면 두 줄
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.gold; ctx.fillText('목표', INV.x + 24, INV.y + oy);
  ctx.fillStyle = COL.text; ctx.fillText(G.objective || '—', INV.x + 66, INV.y + oy);
  if (rq) { ctx.font = `14px ${FONT}`; ctx.fillStyle = COL.gold; ctx.fillText('부탁', INV.x + 24, INV.y + 92); ctx.fillStyle = COL.think; ctx.fillText(rq, INV.x + 66, INV.y + 92); }
  const nSlots = INV.cols * 2;
  for (let i = 0; i < nSlots; i++) {
    const r = slotRect(i), id = G.items[i];
    ctx.fillStyle = 'rgba(10,12,22,0.85)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    const sel = m.mode === 'items' && i === m.itemIdx && id;
    ctx.strokeStyle = sel ? COL.sel : 'rgba(150,146,172,0.55)'; ctx.lineWidth = sel ? 3 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); ctx.lineWidth = 1;
    if (id && IMG[ITEMS[id].icon]) ctx.drawImage(IMG[ITEMS[id].icon], r.x + (r.w - 64) / 2, r.y + (r.h - 64) / 2, 64, 64);
  }
  // 설명(종이)
  const px = INV.x + 24, py = INV.y + 290, pw = INV.w - 48, ph = 156;
  ctx.fillStyle = '#e4dccb'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#a89a80'; ctx.strokeRect(px + 4.5, py + 4.5, pw - 9, ph - 9);
  const it = m.mode === 'items' && G.items.length ? ITEMS[G.items[m.itemIdx]] : null;
  if (it) {
    ctx.font = `bold 18px ${SERIF}`; ctx.fillStyle = '#2a2230'; ctx.fillText(it.name, px + 20, py + 34);
    ctx.font = `16px ${FONT}`; ctx.fillStyle = '#3a3240';
    wrap(it.desc, pw - 40, `16px ${FONT}`).forEach((l, i) => ctx.fillText(l, px + 20, py + 66 + i * 26));
    if (it.doc) { ctx.font = `13px ${FONT}`; ctx.fillStyle = '#7a6a58'; ctx.textAlign = 'right'; ctx.fillText('결정 키 / 다시 탭 — 다시 읽기', px + pw - 18, py + ph - 16); ctx.textAlign = 'left'; }
  } else {
    ctx.font = `16px ${FONT}`; ctx.fillStyle = '#6a6070';
    ctx.fillText(G.items.length ? '아이템을 고르면 설명이 보입니다.' : '아무것도 갖고 있지 않다.', px + 20, py + 40);
  }
  ctx.font = `13px ${FONT}`; ctx.fillStyle = COL.dim;
  ctx.fillText('이동: 방향키/WASD·탭    결정: Z/Enter/Space·탭    메뉴: X/Esc    지도: M    소리: N', 18, SH - 16);
}
const TITLE_MENU = { x: 278, y: 290, w: 260, row: 36 };
const TITLE_OPTS = () => ['NEW GAME', 'CONTINUE', 'LOAD', 'ENDINGS'].concat(endingsSeen().length ? ['RECORD'] : [], allEndingsSeen() ? ['GALLERY', 'LAST SEAT'] : [], [`OPTION — SOUND ${Sound.on ? 'ON' : 'OFF'}`], endingsSeen().includes('secret') ? ['EAT'] : []);
const ENDING_KEY = 'one_persons_table_endings';
const LAST_END_KEY = 'one_persons_table_last_end';
function lastEnding() { try { return localStorage.getItem(LAST_END_KEY); } catch (e) { return null; } }
function endingsSeen() { try { return JSON.parse(localStorage.getItem(ENDING_KEY) || '[]'); } catch (e) { return []; } }
function addEnding(id) { try { const a = endingsSeen(); if (!a.includes(id)) a.push(id); localStorage.setItem(ENDING_KEY, JSON.stringify(a)); localStorage.setItem(LAST_END_KEY, id); } catch (e) {} }

/* ------------------------------------------------------------------ 갤러리 (결말 5개를 모두 본 뒤 타이틀에 열린다)
   본 CG·깜놀 그림과 읽은 문서를 브라우저에 남겨 두고 다시 본다. 못 본 것은 ?로 */
const CG_SEEN_KEY = 'one_persons_table_cg_seen', DOC_SEEN_KEY = 'one_persons_table_docs_seen';
function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
let _cgSeen = null;
function cgSeenSet() { if (!_cgSeen) _cgSeen = new Set(lsGet(CG_SEEN_KEY, ['cg_title'])); return _cgSeen; }
function markCgSeen(key) { const S = cgSeenSet(); if (!key || S.has(key)) return; S.add(key); lsSet(CG_SEEN_KEY, [...S]); }
function markDocSeen(spec) {
  try {
    const list = lsGet(DOC_SEEN_KEY, []), k = JSON.stringify(spec).slice(0, 400);
    if (list.some(d => d.k === k)) return;
    list.push({ k, spec }); lsSet(DOC_SEEN_KEY, list);
  } catch (e) {}
}
function allEndingsSeen() { const s = endingsSeen(); return typeof ENDINGS_INFO !== 'undefined' && ENDINGS_INFO.every(e => s.includes(e.id)); }
const GALLERY_CG = ['cg_title', 'cg_title_after', 'cg_prologue', 'cg_day1_dream', 'cg_day2_bed', 'cg_day3_dream', 'cg_day3_yuri_awake', 'cg_day3_basement_eye',
  'cg_day4_special_meal', 'cg_mem_ribbon', 'cg_mem_ticket', 'cg_mem_letter', 'cg_mem_firstlunch', 'cg_mem_lunchbox', 'cg_day6_plates',
  'cg_day6_momo_tag', 'cg_day6_ian_momo', 'cg_day7_momo_gate', 'cg_day7_table', 'cg_day7_leftover',
  'cg_end_bad1', 'cg_end_bad2', 'cg_end_normal', 'cg_end_true', 'cg_end_true_lunchbox', 'cg_end_secret',
  'scare_mirror', 'scare_eye', 'scare_meal', 'scare_stairs'];
function galleryCgs() {
  const out = [];
  for (const n of GALLERY_CG) {
    if (IMG[n + '_f'] || IMG[n + '_m']) { for (const g of ['f', 'm']) if (IMG[`${n}_${g}`]) out.push(`${n}_${g}`); }
    else if (IMG[n]) out.push(n);
  }
  return out;
}
function galleryDocs() { return lsGet(DOC_SEEN_KEY, []).map(d => d.spec); }
function docLabel(spec) {
  if (spec.title) return spec.title;
  const lines = spec.type === 'book' ? [] : (spec.lines || []);
  const first = lines.find(l => typeof l === 'string' && l.replace(/^[#!~]/, '').trim()) || '쪽지';
  const t = first.replace(/^[#!~]/, '').trim();
  return t.length > 26 ? t.slice(0, 26) + '…' : t;
}
const GAL = { x: 40, y: 112, cols: 4, cw: 172, ch: 130, gap: 12, perCg: 12, rowH: 42, perDoc: 10 };
const GAL_TABS = [{ x: 180, y: 34, w: 90, h: 34 }, { x: 280, y: 34, w: 90, h: 34 }];
function galleryCount(Gl) { return Gl.tab === 0 ? galleryCgs().length : galleryDocs().length; }
function galleryOpen(Gl, i) {
  if (Gl.tab === 0) {
    const key = galleryCgs()[i];
    if (key && cgSeenSet().has(key)) { Gl.view = key; Sound.sfx('select'); } else Sound.sfx('cursor');
  } else {
    const spec = galleryDocs()[i];
    if (spec) doc(spec);
  }
}
function updateGallery() {
  const Gl = UI.gallery, t = Input.takeTap(), d = Input.dirHit();
  if (Gl.view) { if (Input.ok() || Input.cancel() || t) { Gl.view = null; Sound.sfx('cursor'); } return; }
  if (Input.cancel()) { UI.gallery = null; Sound.sfx('select'); return; }
  if (Input.hit('Tab') || Input.hit('KeyQ') || Input.hit('KeyE')) { Gl.tab = 1 - Gl.tab; Gl.idx = 0; Sound.sfx('cursor'); return; }
  const n = galleryCount(Gl), cols = Gl.tab === 0 ? GAL.cols : 1;
  if (n) {
    if (d === 'left') { if (Gl.tab === 1) { Gl.tab = 0; Gl.idx = 0; } else Gl.idx = Math.max(0, Gl.idx - 1); Sound.sfx('cursor'); }
    if (d === 'right') { if (Gl.tab === 1) { Gl.tab = 0; Gl.idx = 0; } else Gl.idx = Math.min(n - 1, Gl.idx + 1); Sound.sfx('cursor'); }
    if (d === 'up') { Gl.idx = Math.max(0, Gl.idx - cols); Sound.sfx('cursor'); }
    if (d === 'down') { Gl.idx = Math.min(n - 1, Gl.idx + cols); Sound.sfx('cursor'); }
    if (Input.ok()) { galleryOpen(Gl, Gl.idx); return; }
  }
  if (t) {
    for (let k = 0; k < 2; k++) if (inRect(t, GAL_TABS[k])) { if (Gl.tab !== k) { Gl.tab = k; Gl.idx = 0; Sound.sfx('cursor'); } return; }
    if (inRect(t, END_CLOSE)) { UI.gallery = null; Sound.sfx('select'); return; }
    if (Gl.tab === 0) {
      const page = Math.floor(Gl.idx / GAL.perCg);
      const c = Math.floor((t.x - GAL.x) / (GAL.cw + GAL.gap)), r = Math.floor((t.y - GAL.y) / (GAL.ch + GAL.gap));
      const i = page * GAL.perCg + r * GAL.cols + c;
      if (c >= 0 && c < GAL.cols && r >= 0 && r < 3 && i < n) { if (i === Gl.idx) galleryOpen(Gl, i); else { Gl.idx = i; Sound.sfx('cursor'); } }
    } else {
      const page = Math.floor(Gl.idx / GAL.perDoc), r = Math.floor((t.y - GAL.y) / GAL.rowH), i = page * GAL.perDoc + r;
      if (t.x >= GAL.x && t.x <= SW - GAL.x && r >= 0 && r < GAL.perDoc && i < n) { if (i === Gl.idx) galleryOpen(Gl, i); else { Gl.idx = i; Sound.sfx('cursor'); } }
    }
  }
}
function renderGallery() {
  const Gl = UI.gallery;
  ctx.fillStyle = 'rgba(8,10,18,0.95)'; ctx.fillRect(0, 0, SW, SH);
  if (Gl.view) { const im = IMG[Gl.view]; if (im) ctx.drawImage(im, 0, 0, SW, SH); return; }
  ctx.font = `bold 22px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText('GALLERY', 40, 58);
  ['CG', '기록'].forEach((lb, k) => {
    const R = GAL_TABS[k]; panel(R.x, R.y, R.w, R.h, Gl.tab === k ? 1 : 0.6);
    ctx.font = `${Gl.tab === k ? 'bold ' : ''}15px ${FONT}`; ctx.fillStyle = Gl.tab === k ? COL.selText : COL.dim;
    ctx.textAlign = 'center'; ctx.fillText(lb, R.x + R.w / 2, R.y + 22); ctx.textAlign = 'left';
  });
  ctx.fillStyle = 'rgba(150,146,172,0.4)'; ctx.fillRect(40, 84, SW - 80, 1);
  if (Gl.tab === 0) {
    const cgs = galleryCgs(), seen = cgSeenSet(), page = Math.floor(Gl.idx / GAL.perCg), pages = Math.max(1, Math.ceil(cgs.length / GAL.perCg));
    ctx.font = `14px ${FONT}`; ctx.fillStyle = COL.gold; ctx.textAlign = 'right';
    ctx.fillText(`${cgs.filter(k => seen.has(k)).length} / ${cgs.length}   ·   ${page + 1} / ${pages}쪽`, SW - 40, 58); ctx.textAlign = 'left';
    cgs.slice(page * GAL.perCg, page * GAL.perCg + GAL.perCg).forEach((key, j) => {
      const i = page * GAL.perCg + j, x = GAL.x + (j % GAL.cols) * (GAL.cw + GAL.gap), y = GAL.y + Math.floor(j / GAL.cols) * (GAL.ch + GAL.gap);
      ctx.fillStyle = '#0c0e16'; ctx.fillRect(x, y, GAL.cw, GAL.ch);
      if (seen.has(key) && IMG[key]) ctx.drawImage(IMG[key], x, y, GAL.cw, GAL.ch);
      else { ctx.font = `bold 40px ${SERIF}`; ctx.fillStyle = 'rgba(150,146,172,0.3)'; ctx.textAlign = 'center'; ctx.fillText('?', x + GAL.cw / 2, y + GAL.ch / 2 + 14); ctx.textAlign = 'left'; }
      ctx.strokeStyle = i === Gl.idx ? COL.sel : 'rgba(184,174,208,0.35)'; ctx.lineWidth = i === Gl.idx ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, GAL.cw - 1, GAL.ch - 1); ctx.lineWidth = 1;
    });
  } else {
    const docs = galleryDocs(), page = Math.floor(Gl.idx / GAL.perDoc), pages = Math.max(1, Math.ceil(docs.length / GAL.perDoc));
    ctx.font = `14px ${FONT}`; ctx.fillStyle = COL.gold; ctx.textAlign = 'right';
    ctx.fillText(`읽은 문서 ${docs.length}   ·   ${page + 1} / ${pages}쪽`, SW - 40, 58); ctx.textAlign = 'left';
    if (!docs.length) { ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.dim; ctx.fillText('아직 남은 기록이 없다.', GAL.x, GAL.y + 26); }
    docs.slice(page * GAL.perDoc, page * GAL.perDoc + GAL.perDoc).forEach((spec, j) => {
      const i = page * GAL.perDoc + j, y = GAL.y + j * GAL.rowH, sel = i === Gl.idx;
      panel(GAL.x, y, SW - GAL.x * 2 - 140, GAL.rowH - 6, sel ? 1 : 0.7);
      if (sel) selBand(GAL.x + 8, y + 6, SW - GAL.x * 2 - 156, GAL.rowH - 18);
      ctx.font = `15px ${SERIF}`; ctx.fillStyle = sel ? COL.selText : COL.text;
      ctx.fillText(`${String(i + 1).padStart(2, '0')}  ${docLabel(spec)}`, GAL.x + 18, y + 25);
    });
  }
  ctx.font = `13px ${FONT}`; ctx.fillStyle = COL.think;
  ctx.fillText('방향키 이동 · 확인 보기 · Q/E 탭 · 취소 닫기', 40, SH - 38);
  panel(END_CLOSE.x, END_CLOSE.y, END_CLOSE.w, END_CLOSE.h);
  icon('close', END_CLOSE.x + 16, END_CLOSE.y + 12, COL.gold);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.text; ctx.fillText('닫기', END_CLOSE.x + 44, END_CLOSE.y + 26);
}

/* ------------------------------------------------------------------ 회차 기록부
   하루가 시작될 때와 끝날 때의 상태를 남겨 두고, 엔딩을 하나라도 본 뒤에는 타이틀의 RECORD에서
   도달했던 날을 골라 그날 아침부터 다시 시작할 수 있다. 시작 수치는 ±10씩 고칠 수 있다. */
const RECORD_KEY = 'one_persons_table_record';
const DAY_NAMES = ['인사', '나눔', '동침', '섭취', '기억', '일체', '마지막 식사'];
const VAR_LABELS = [['memory', '기억'], ['yuri_sync', '유리와의 동조'], ['momo_trust', '모모의 신뢰'], ['cult_truth', '진실']];
function readRecord() { try { return JSON.parse(localStorage.getItem(RECORD_KEY) || '{"days":{}}'); } catch (e) { return { days: {} }; } }
function writeRecord(r) { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch (e) {} }
const clone = (o) => JSON.parse(JSON.stringify(o));
function recordDayStart(n) {
  const r = readRecord();
  r.days[n] = { start: { name: G.name, gender: G.gender, vars: clone(G.vars), flags: clone(G.flags), items: G.items.slice() } };
  writeRecord(r);
}
function recordDayEnd(n, endingId) {
  const r = readRecord(); const d = r.days[n]; if (!d) return;
  d.end = { vars: clone(G.vars), items: G.items.slice(), gained: clone(G.flags['_g' + n] || {}) };
  if (endingId) d.end.ending = endingId;
  writeRecord(r);
}
/* 분기점 — 결말을 가르는 선택 직전의 상태를 남겨 두고, RECORD에서 그 시점으로 되돌아간다 (기획서 v3.1 11-4).
   분기점 목록과 다시 시작할 장면은 story.js의 BRANCH_POINTS. */
const BRANCH_KEY = 'one_persons_table_branches';
function readBranches() { try { return JSON.parse(localStorage.getItem(BRANCH_KEY) || '{}'); } catch (e) { return {}; } }
function saveBranch(id) {
  const b = readBranches();
  b[id] = { s: JSON.parse(snapshot()), t: Date.now() };
  try { localStorage.setItem(BRANCH_KEY, JSON.stringify(b)); } catch (e) {}
}
async function branch(id, fn) { saveBranch(id); return fn(); }
const REC = { list: { x: 40, y: 92, w: 220, row: 62 }, px: 280, py: 92, pw: 496, ph: 452 };
function recRows() {   // 선택한 날의 다시 시작할 수 있는 시점: 그날 아침 + 도달한 분기점
  const R = UI.record, n = R.idx + 1, rows = [];
  if (R.rec.days[n]) rows.push({ kind: 'day', label: '그날 아침부터' });
  const br = readBranches();
  for (const bp of (typeof BRANCH_POINTS !== 'undefined' ? BRANCH_POINTS : [])) if (bp.day === n && br[bp.id]) rows.push({ kind: 'branch', bp, label: bp.label });
  return rows;
}
function recRowRect(k) { return { x: REC.px + 20, y: REC.py + 62 + k * 40, w: REC.pw - 40, h: 34 }; }
const REC_CLOSE = { x: SW - 150, y: SH - 60, w: 110, h: 40 };
function openRecord() {
  Sound.sfx('select');
  const r = readRecord();
  let first = 0; for (let n = 7; n >= 1; n--) if (r.days[n]) { first = n - 1; break; }
  UI.record = { idx: first, focus: 'days', row: 0, rec: r };
}
function recStart(k) {
  const R = UI.record, n = R.idx + 1, row = recRows()[k];
  if (!row) { Sound.sfx('cursor'); return; }
  Sound.sfx('select'); UI.record = null; UI.title = null;
  if (row.kind === 'day') { const d = R.rec.days[n]; run(() => startFromDay(n, d.start, clone(d.start.vars))); return; }
  run(() => startFromBranch(row.bp));
}
async function startFromDay(n, st, vars) {
  Object.assign(G, { name: st.name, gender: st.gender, day: n, phase: 0, vars, flags: clone(st.flags), items: st.items.slice(), objective: '' });
  delete G.flags['_g' + n];
  bgm(null); UI.fade = 1;
  await black(['……', `DAY ${n} — ${DAY_NAMES[n - 1]}`, '그날 아침으로.']);
  if (n === 1) { await STORY.start(); return; }
  G.flags.startDay = n; saveGame(); recordDayStart(n);
  await STARTERS[n]();
}
async function startFromBranch(bp) {
  const s = readBranches()[bp.id].s;
  Object.assign(G, { name: s.name, gender: s.gender, day: s.day, phase: s.phase, vars: s.vars, flags: s.flags, items: s.items, objective: s.objective });
  bgm(null); UI.fade = 1; UI.cg = null; UI.cgAlpha = 0; sepia(false);
  if (typeof Chase !== 'undefined') Chase.stop();
  await black(['……', `DAY ${s.day} — ${bp.label}`, '그 순간으로.']);
  loadMap(s.map); player.x = s.x; player.y = s.y; player.dir = s.dir; player.pose = null;
  applyAmbience();
  await fadeIn(500);
  await bp.run();
}
function updateRecord() {
  const R = UI.record, t = Input.takeTap(), d = Input.dirHit();
  if (t) {
    if (inRect(t, REC_CLOSE)) { UI.record = null; Sound.sfx('select'); return; }
    for (let i = 0; i < 7; i++) if (inRect(t, { x: REC.list.x, y: REC.list.y + i * REC.list.row, w: REC.list.w, h: REC.list.row - 8 })) {
      if (R.rec.days[i + 1]) { R.idx = i; R.focus = 'days'; R.row = 0; Sound.sfx('cursor'); } return;
    }
    const rows = recRows();
    for (let k = 0; k < rows.length; k++) if (inRect(t, recRowRect(k))) { if (R.focus === 'rows' && R.row === k) return recStart(k); R.focus = 'rows'; R.row = k; Sound.sfx('cursor'); return; }
    return;
  }
  if (R.focus === 'days') {
    const avail = []; for (let i = 0; i < 7; i++) if (R.rec.days[i + 1]) avail.push(i);
    if (!avail.length) { if (Input.cancel() || Input.ok()) { UI.record = null; Sound.sfx('select'); } return; }
    const p = Math.max(0, avail.indexOf(R.idx));
    if (d === 'up') { R.idx = avail[(p + avail.length - 1) % avail.length]; Sound.sfx('cursor'); }
    if (d === 'down') { R.idx = avail[(p + 1) % avail.length]; Sound.sfx('cursor'); }
    if (Input.ok() || d === 'right') { R.focus = 'rows'; R.row = 0; Sound.sfx('select'); }
    if (Input.cancel()) { UI.record = null; Sound.sfx('select'); }
    return;
  }
  const n = recRows().length;
  if (d === 'up') { R.row = (R.row + n - 1) % n; Sound.sfx('cursor'); }
  if (d === 'down') { R.row = (R.row + 1) % n; Sound.sfx('cursor'); }
  if (Input.ok()) return recStart(R.row);
  if (Input.cancel() || d === 'left') { R.focus = 'days'; Sound.sfx('select'); }
}
function renderRecord() {
  const R = UI.record, rec = R.rec, seen = endingsSeen();
  ctx.fillStyle = 'rgba(8,10,18,0.92)'; ctx.fillRect(0, 0, SW, SH);
  ctx.font = `bold 22px ${SERIF}`; ctx.fillStyle = COL.text; ctx.fillText('RECORD', 40, 58);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.gold; ctx.fillText('회차 기록부 — 선택의 순간으로 되돌아갑니다.', 150, 58);
  ctx.fillStyle = 'rgba(150,146,172,0.4)'; ctx.fillRect(40, 72, SW - 80, 1);
  for (let i = 0; i < 7; i++) {
    const y = REC.list.y + i * REC.list.row, d = rec.days[i + 1], sel = i === R.idx && d;
    panel(REC.list.x, y, REC.list.w, REC.list.row - 8, sel ? 1 : 0.7);
    if (sel) selBand(REC.list.x + 8, y + 8, REC.list.w - 16, REC.list.row - 24);
    ctx.font = `bold 16px ${SERIF}`; ctx.fillStyle = sel ? COL.selText : (d ? COL.name : COL.dim);
    ctx.fillText(`DAY ${i + 1}`, REC.list.x + 20, y + 33);
    ctx.font = `15px ${FONT}`; ctx.fillStyle = sel ? COL.selText : (d ? COL.text : COL.dim);
    ctx.fillText(d ? DAY_NAMES[i] : '???', REC.list.x + 92, y + 33);
    if (d && d.end) { ctx.fillStyle = sel ? COL.selText : COL.gold; ctx.fillText('✓', REC.list.x + REC.list.w - 30, y + 33); }
  }
  panel(REC.px, REC.py, REC.pw, REC.ph);
  const d = rec.days[R.idx + 1];
  if (!d) {
    ctx.font = `16px ${FONT}`; ctx.fillStyle = COL.dim; ctx.fillText('아직 도달하지 못한 날입니다.', REC.px + 24, REC.py + 48);
  } else {
    ctx.font = `bold 17px ${SERIF}`; ctx.fillStyle = COL.name;
    ctx.fillText(`DAY ${R.idx + 1} — ${DAY_NAMES[R.idx]}`, REC.px + 24, REC.py + 36);
    const rows = recRows();
    rows.forEach((row, k) => {
      const r = recRowRect(k), sel = R.focus === 'rows' && R.row === k;
      if (sel) selBand(r.x, r.y, r.w, r.h);
      ctx.font = `15px ${FONT}`; ctx.fillStyle = sel ? COL.selText : (row.kind === 'day' ? COL.gold : COL.text);
      ctx.fillText((row.kind === 'day' ? '◆ ' : '▸ ') + row.label, r.x + 10, r.y + 23);
    });
    let y = Math.max(REC.py + 300, recRowRect(rows.length).y + 26);
    ctx.fillStyle = 'rgba(150,146,172,0.35)'; ctx.fillRect(REC.px + 20, y - 18, REC.pw - 40, 1);
    ctx.font = `13px ${FONT}`; ctx.fillStyle = COL.dim; ctx.fillText('지난번 이 날에 모은 것', REC.px + 24, y);
    y += 24;
    if (!d.end) {
      ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.think; ctx.fillText('— 이 날을 끝까지 보내지 못했다.', REC.px + 24, y);
    } else {
      const newItems = d.end.items.filter(id => !d.start.items.includes(id)).map(id => ITEMS[id] ? ITEMS[id].name : id);
      ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.name;
      wrap('손에 넣은 것 — ' + (newItems.length ? newItems.join(', ') : '없음'), REC.pw - 48, `15px ${FONT}`).slice(0, 2)
        .forEach((l, k) => ctx.fillText(l, REC.px + 24, y + k * 22));
      if (d.end.ending) {
        const e = ENDINGS_INFO.find(x => x.id === d.end.ending);
        ctx.fillStyle = COL.gold; ctx.fillText(`이 날의 끝 — 『${e && seen.includes(e.id) ? e.title : '???'}』`, REC.px + 24, y + 50);
      }
    }
  }
  panel(REC_CLOSE.x, REC_CLOSE.y, REC_CLOSE.w, REC_CLOSE.h);
  icon('close', REC_CLOSE.x + 16, REC_CLOSE.y + 12, COL.gold);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = COL.text; ctx.fillText('닫기', REC_CLOSE.x + 44, REC_CLOSE.y + 26);
}
function renderTitle(now) {
  const T = UI.title;
  const titleKey = allEndingsSeen() && IMG.cg_title_after ? 'cg_title_after' : 'cg_title';   // 결말을 다 보면 주인 없는 식탁으로
  if (IMG[titleKey]) { ctx.drawImage(IMG[titleKey], 0, 0, SW, SH); markCgSeen(titleKey); }
  const g = ctx.createLinearGradient(0, 80, 0, 300);
  g.addColorStop(0, 'rgba(12,14,26,0)'); g.addColorStop(0.5, 'rgba(12,14,26,0.55)'); g.addColorStop(1, 'rgba(12,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 80, SW, 220);
  ctx.textAlign = 'center';
  ctx.font = `bold 54px ${SERIF}`;
  {   // 「한 사람 몫의」는 연보라빛 흰색, 「식탁」만 붉게
    const a = '한 사람 몫의 ', b = '식탁', wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, x0 = Math.round(SW / 2 - (wa + wb) / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000'; ctx.fillText(a + b, x0 + 3, 199);
    ctx.fillStyle = '#ece6f4'; ctx.fillText(a, x0, 196);
    ctx.fillStyle = '#c4283a'; ctx.fillText(b, x0 + wa, 196);
    ctx.textAlign = 'center';
  }
  ctx.font = `15px ${SERIF}`; ctx.fillStyle = COL.name;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText("ONE PERSON'S TABLE", SW / 2 + 3, 232);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#ece6f4'; ctx.fillRect(SW / 2 - 160, 248, 320, 2);
  pxDiamond(SW / 2, 249, 4, '#c4283a', '#6a1420');
  const opts = TITLE_OPTS(), M = TITLE_MENU;
  M.row = opts.length > 7 ? 30 : 36;   // 메뉴가 길어지면 줄 간격을 줄인다
  panel(M.x, M.y, M.w, 24 + opts.length * M.row);
  opts.forEach((o, i) => {
    const y = M.y + 12 + i * M.row;
    if (i === T.idx) selBand(M.x + 14, y, M.w - 28, M.row - 6);
    ctx.font = `${o.startsWith('OPTION') ? 14 : 17}px ${SERIF}`;
    if (o === 'EAT' || o === 'LAST SEAT') ctx.font = `bold 17px ${SERIF}`;
    ctx.fillStyle = i === T.idx ? COL.selText : ((o === 'CONTINUE' || o === 'LOAD') && !T.hasSave ? COL.dim : (o === 'EAT' ? '#c4283a' : o === 'LAST SEAT' ? '#ece6f4' : '#b8aed0'));
    ctx.fillText(o, SW / 2, y + M.row - 14 + (o.startsWith('OPTION') ? 0 : 1));
  });
  ctx.font = `12px ${FONT}`; ctx.fillStyle = 'rgba(60,56,74,0.75)';
  ctx.fillText('v5.3 — 기획서 v2.0 · 스크립트 v2.1', SW / 2, SH - 16);
  // 마지막으로 본 엔딩이 남긴 흔적
  const lastEnd = lastEnding(), info = lastEnd && ENDINGS_INFO.find(e => e.id === lastEnd);
  if (info && info.trace) {
    ctx.font = `italic 16px ${SERIF}`; ctx.fillStyle = `rgba(222,200,156,${0.75 + 0.2 * Math.sin(now / 900)})`;
    ctx.fillText(info.trace, SW / 2, 277);
  }
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ 터치 기기: 가상 방향키 · 가로 안내 */
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
function setupTouch() {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');
  // 방향키·버튼: 누르는 동안 키를 누른 것과 같게 처리
  document.querySelectorAll('#pad button, #abtn button').forEach(btn => {
    const code = btn.dataset.k;
    const press = (e) => {
      e.preventDefault(); Sound.init();
      if (UI.nameEntry) return;
      if (!Input.down.has(code)) Input.edge.add(code);
      Input.down.add(code); btn.classList.add('on');
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const release = (e) => { e.preventDefault(); Input.down.delete(code); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
  // 세로로 들고 있으면 가로 안내
  const rot = document.getElementById('rotate');
  let skipped = false;
  try { skipped = sessionStorage.getItem('rotate_skip') === '1'; } catch (_) {}
  const check = () => rot.classList.toggle('show', !skipped && innerHeight > innerWidth);
  document.getElementById('rotate-skip').onclick = () => { skipped = true; try { sessionStorage.setItem('rotate_skip', '1'); } catch (_) {} check(); };
  addEventListener('resize', check); addEventListener('orientationchange', () => setTimeout(check, 200));
  check();
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  Input.init();
  setupTouch();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  try {
    await Promise.race([
      Promise.all(['24px "Galmuri11"', 'bold 24px "Galmuri11"', '20px "Galmuri9"', '30px "Galmuri14"', '12px "Galmuri11"'].map(f => document.fonts.load(f, '한글 ABC'))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* 폰트를 못 불러오면 시스템 글꼴 사용 */ }
  await loadAssets();
  showTitle();
  requestAnimationFrame(frame);
}
