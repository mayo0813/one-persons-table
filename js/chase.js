/* 한 사람 몫의 식탁 — 은신 · 추격 (기획서 v3.0 10장)
   실패체(제작용 이름 '남은 것')가 지하에서 주인공을 쫓는다.

   Chase.start({ mons:[{ id, x, y, kind:'shadow'|'union', patrol:[[x,y]...], state }], light: 0 (손전등 어둠은 v3.1에서 뺌, 반경을 주면 다시 켜짐),
                 lines:[...], onRestore: () => {...} })
   Chase.checkpoint()        지금 위치·적 상태를 체크포인트로 저장
   Chase.noise(x, y, r)      소리. 반경 안의 적이 조사하러 온다
   Chase.stop()

   상태: patrol(순찰) → suspicious(소리 쪽으로) → search(주변 수색) → chase(추격) → reset(순찰 복귀)
   · 시야: 거리 안 + 가로막는 칸(서가·벽·식탁) 없음. 숨는 칸에 멈춰 있으면 보이지 않는다.
   · 숨는 모습을 들킨 채 숨으면, 적은 그 칸을 뒤진다.
   · 붙잡히면 체크포인트로 돌아간다. 점수는 깎이지 않는다. 연속 3번 붙잡히면 '추격 완화'를 고를 수 있다.
   · 추격 중에는 주인공이 저절로 뛴다. 평소에는 Shift를 누르고 있으면 뛰지만 발소리가 난다.
   그림: assets/characters/monster_shadow.png, monster_union.png 가 있으면 그 그림(한 장, 발끝이 아래 가운데),
   없으면 코드로 그린 실루엣. */
'use strict';

/* 애니메이션 시트 (v5.1, tools/gen_monster_anim.py) — 행 = 동작, 열 = 프레임. 칸 아래 가운데가 발끝.
   실패체: 걷기 4방향 · 대기 · 경계 · 두리번 · 잡기 · 경직 · 출현 · 소멸 / 그림자: 출현 · 소멸(나머지는 그림 한 장) */
const MON_ANIM = {
  union: { img: 'monster_union_anim', w: 90, h: 85, anims: {
    walk_down: [0, 4, 150], walk_left: [1, 4, 150], walk_right: [2, 4, 150], walk_up: [3, 4, 150], idle: [4, 4, 230],
    alert: [5, 3, 170], look: [6, 3, 300], grab: [7, 4, 110], hit: [8, 4, 120], appear: [9, 4, 140], vanish: [10, 4, 140] } },
  shadow: { img: 'monster_shadow_anim', w: 60, h: 84, anims: { appear: [0, 3, 150], vanish: [1, 3, 150] } },
};

const Chase = {
  active: false, mons: [], cfg: null, cp: null, fails: 0, hintT: 0, caughtLock: false, lastNoise: 0,

  start(cfg) {
    this.cfg = Object.assign({ light: 0, lines: [], range: 6 }, cfg);
    this.mons = (cfg.mons || []).map(m => this.makeMon(m));
    this.active = true; this.hintT = 0; this.caughtLock = false;
    this.checkpoint();
  },
  makeMon(m) {
    return Object.assign({ fx: m.x, fy: m.y, tx: m.x, ty: m.y, state: m.state || 'patrol', node: 0, path: [], t: 0, lastSeen: null,
      sawHide: false, burstT: 0, burstCd: 2500, talkT: 1500 + Math.random() * 2000, say: null, sayT: 0, stun: 0, dir: 'down', seed: Math.random() * 100, once: { name: 'appear', t: 0 } }, m);
  },
  stop() { this.active = false; this.mons = []; this.cfg = null; this.cp = null; player.hiddenInChase = false; player.speed = 3.6; },
  mon(id) { return this.mons.find(m => m.id === id); },

  checkpoint() {
    this.cp = { x: player.x, y: player.y, dir: player.dir, flags: JSON.stringify(G.flags),
      mons: this.mons.map(m => ({ id: m.id, x: m.tx, y: m.ty, state: m.state === 'chase' ? 'search' : m.state, node: m.node, stun: m.stun, gone: m.gone })) };
  },
  restore() {
    const c = this.cp; if (!c) return;
    player.x = c.x; player.y = c.y; player.dir = c.dir; player.ox = player.oy = 0; player.moving = false; path = [];
    G.flags = JSON.parse(c.flags);
    for (const s of c.mons) {
      const m = this.mon(s.id); if (!m) continue;
      Object.assign(m, { fx: s.x, fy: s.y, tx: s.x, ty: s.y, state: s.state === 'search' ? 'patrol' : s.state, node: s.node, path: [], t: 0,
        lastSeen: null, sawHide: false, burstT: 0, stun: Math.max(s.stun || 0, 1200), gone: s.gone, once: s.gone ? null : { name: 'appear', t: 0 }, vanished: !!s.gone, stunKind: 'restore' });
    }
    if (this.cfg.onRestore) this.cfg.onRestore();
  },

  /* ---------------------------------------------------------- 지도 */
  hideAt(x, y) { return !!(MAP.hide && MAP.hide.includes(tileChar(x, y))); },
  walk(x, y, goal) {   // 적이 지나갈 수 있는 칸
    const ch = tileChar(x, y); if (ch === null) return false;
    const d = tileDef(ch); if (!d || !d[2]) return false;
    if (this.hideAt(x, y) && !(goal && goal[0] === x && goal[1] === y)) return false;
    return true;
  },
  seeThrough(x, y) { const ch = tileChar(x, y); if (ch === null) return false; const d = tileDef(ch); return !!(d && (d[2] || (MAP.lowTiles || '').includes(ch))); },
  bfs(sx, sy, gx, gy) {
    const W = MAP.rows[0].length, H = MAP.rows.length, key = (x, y) => y * W + x;
    const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === gx && y === gy) break;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
        if (!this.walk(nx, ny, [gx, gy])) continue;
        prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(gx, gy))) return null;
    const out = []; let k = key(gx, gy), cur = [gx, gy];
    while (prev.get(k)) { out.unshift(cur); cur = prev.get(k); k = key(cur[0], cur[1]); }
    return out;
  },
  los(ax, ay, bx, by) {
    let x = ax, y = ay; const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx - dy;
    while (!(x === bx && y === by)) {
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === bx && y === by) break;
      if (!this.seeThrough(x, y)) return false;
    }
    return true;
  },
  playerHidden() { return this.hideAt(player.x, player.y) && !player.moving; },
  sees(m) {
    if (m.gone || m.stun > 0) return false;
    const range = this.cfg.range * (G.flags.easyChase ? 0.65 : 1);
    const dx = player.x - m.tx, dy = player.y - m.ty;
    if (dx * dx + dy * dy > range * range) return false;
    if (this.playerHidden() && !m.sawHide) return false;
    return this.los(m.tx, m.ty, player.x, player.y);
  },

  noise(x, y, r) {
    for (const m of this.mons) {
      if (m.gone || m.state === 'chase') continue;
      if (Math.abs(m.tx - x) + Math.abs(m.ty - y) > r) continue;
      m.state = 'suspicious'; m.goal = [x, y]; m.path = []; m.t = 0;
    }
  },

  /* ---------------------------------------------------------- 갱신 */
  update(dt) {
    if (!this.active || this.caughtLock) return;
    this.hintT += dt;
    const chasing = this.mons.some(m => m.state === 'chase' && !m.gone);
    const runKey = Input.down.has('ShiftLeft') || Input.down.has('ShiftRight');
    player.speed = chasing || runKey ? 4.6 : 3.6;
    if (runKey && player.moving && !chasing && performance.now() - this.lastNoise > 350) { this.lastNoise = performance.now(); this.noise(player.x, player.y, 4); }
    const hidden = this.playerHidden();
    if (hidden && !player.hiddenInChase) {   // 숨는 순간 보고 있던 적은 숨은 칸을 기억한다
      for (const m of this.mons) if (m.state === 'chase' && !m.gone) { const dx = player.x - m.tx, dy = player.y - m.ty; if (dx * dx + dy * dy <= 16 && this.los(m.tx, m.ty, player.x, player.y)) m.sawHide = true; }
    }
    if (!hidden) for (const m of this.mons) m.sawHide = false;
    player.hiddenInChase = hidden;
    for (const m of this.mons) {
      if (m.gone && !m.vanished) { m.vanished = true; m.once = { name: 'vanish', t: 0 }; }
      if (m.once) { m.once.t += dt; if (m.once.t >= this.onceLen(m)) m.once = m.once.name === 'grab' ? m.once : null; }
      if (m.once && (m.once.name === 'appear' || m.once.name === 'grab')) continue;   // 솟아오르는 동안은 멈춰 있다
      this.updateMon(m, dt);
    }
    if (this.cfg.tick) this.cfg.tick(dt);
    for (const m of this.mons) {
      if (m.gone || (m.once && m.once.name === 'appear')) continue;
      const px = player.x + player.ox / TILE, py = player.y + player.oy / TILE;
      if (Math.abs(m.fx - px) < 0.62 && Math.abs(m.fy - py) < 0.62 && (!hidden || m.sawHide)) { this.caught(m); break; }
    }
  },
  speedOf(m) {
    const e = G.flags.easyChase ? 0.8 : 1;
    // v2.3: 추격 속도를 주인공 달리기(4.6)에 거의 맞추고, 몰아칠 때는 앞지른다
    const base = { patrol: 1.9, suspicious: 2.9, search: 2.4, chase: 4.35, reset: 1.9 }[m.state] || 1.9;
    return base * e * (m.burstT > 0 ? 1.45 : 1) * (m.speedMul || 1);
  },
  pickGoal(m) {
    if (m.state === 'chase') return m.lastSeen || [player.x, player.y];
    if (m.state === 'suspicious') return m.goal;
    if (m.state === 'search') {
      const c = m.searchAt || [m.tx, m.ty];
      for (let i = 0; i < 8; i++) {
        const gx = c[0] + Math.round(Math.random() * 4 - 2), gy = c[1] + Math.round(Math.random() * 4 - 2);
        if (this.walk(gx, gy) || (m.sawHide && gx === player.x && gy === player.y)) return [gx, gy];
      }
      return [m.tx, m.ty];
    }
    const p = m.patrol && m.patrol.length ? m.patrol[m.node % m.patrol.length] : [m.tx, m.ty];
    return p;
  },
  say(m, text) { m.say = text; m.sayT = 1700; },
  updateMon(m, dt) {
    if (m.gone) return;
    if (m.stun > 0) { m.stun -= dt; if (m.stun <= 0) m.stunKind = null; return; }
    m.t += dt; m.sayT -= dt;
    m.talkT -= dt;
    if (m.talkT <= 0 && this.cfg.lines.length) {
      m.talkT = 3200 + Math.random() * 2600;
      const d = Math.abs(m.tx - player.x) + Math.abs(m.ty - player.y);
      if (d < 11) { this.say(m, this.cfg.lines[Math.floor(Math.random() * this.cfg.lines.length)]); Sound.sfx('step'); }
    }
    // 시야
    if (this.sees(m)) {
      if (m.state !== 'chase') { m.state = 'chase'; m.path = []; Sound.sfx('static'); this.say(m, ['저기.', '찾았다.', '여기 있네.'][Math.floor(Math.random() * 3)]); UI.shake = Math.max(UI.shake, 4); }
      m.lastSeen = [player.x, player.y]; m.t = 0;
    } else if (m.state === 'chase' && !m.sawHide && !this.playerHidden() && m.t <= 2600) {
      // 시야에서 벗어나도 숨지 않았다면 발소리를 따라 2.6초 동안 계속 쫓는다
      m.lastSeen = [player.x, player.y];
    } else if (m.state === 'chase' && m.t > 1100 && !m.sawHide) {
      m.state = 'search'; m.searchAt = m.lastSeen || [m.tx, m.ty]; m.goal = m.searchAt; m.t = 0; m.path = [];
    }
    if (m.state === 'chase' && m.sawHide) m.searchAt = [player.x, player.y];
    if (m.state === 'search' && m.t > 6500) { m.state = 'patrol'; m.t = 0; m.path = []; m.sawHide = false; }
    // 여러 몸이 잠깐 같은 방향을 고를 때 빨라진다
    if (m.state === 'chase') {
      m.burstCd -= dt; m.burstT -= dt;
      if (m.burstCd <= 0) { m.burstT = 700; m.burstCd = 2400 + Math.random() * 1200; Sound.sfx('heart'); }
    } else m.burstT = 0;
    // 이동
    const sp = this.speedOf(m) * dt / 1000;
    const dx = m.tx - m.fx, dy = m.ty - m.fy, dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      const k = Math.min(1, sp / dist);
      m.fx += dx * k; m.fy += dy * k;
      return;
    }
    // 칸 도착 — 다음 칸 고르기
    const goal = m.state === 'chase' && m.sawHide ? [player.x, player.y] : this.pickGoal(m);
    if (m.tx === goal[0] && m.ty === goal[1]) {
      if (m.state === 'patrol' && m.patrol && m.patrol.length) m.node = (m.node + 1) % m.patrol.length;
      else if (m.state === 'suspicious') { m.state = 'search'; m.searchAt = [m.tx, m.ty]; m.t = 0; }
      else if (m.state === 'search') m.searchGoal = null;
      return;
    }
    const p = this.bfs(m.tx, m.ty, goal[0], goal[1]);
    if (!p || !p.length) {
      if (m.state === 'patrol' && m.patrol) m.node = (m.node + 1) % m.patrol.length;
      else if (m.state === 'suspicious') { m.state = 'search'; m.searchAt = [m.tx, m.ty]; m.t = 0; }
      else if (m.state === 'chase') { /* 막혀 있으면 문 앞에서 기다린다 */ }
      return;
    }
    const [nx, ny] = p[0];
    m.dir = nx > m.tx ? 'right' : nx < m.tx ? 'left' : ny > m.ty ? 'down' : 'up';
    m.tx = nx; m.ty = ny;
  },

  onceLen(m) { const A = MON_ANIM[m.kind], a = A && A.anims[m.once.name]; return a && IMG[A.img] ? a[1] * a[2] : 0; },
  caught(m) {
    this.caughtLock = true;
    run(async () => {
      const A = MON_ANIM[m.kind];
      if (A && A.anims.grab && IMG[A.img]) { m.once = { name: 'grab', t: 0 }; Sound.sfx('heart'); await wait(A.anims.grab[1] * A.anims.grab[2] + 120); }
      Sound.sfx('scare'); UI.shake = 14; glitch(300);
      await fadeOut(500);
      this.fails++;
      for (const x of this.mons) if (x.once && x.once.name === 'grab') x.once = null;
      this.restore();
      await wait(400);
      await fadeIn(500);
      if (this.fails >= 3 && !G.flags.easyChase && !G.flags.easyAsked) {
        G.flags.easyAsked = true;
        const c = await ask(['추격을 완화한다', '그대로 한다'], '세 번 연속으로 붙잡혔어요. 추격을 조금 쉽게 할까요? (적이 덜 멀리 보고, 더 느리게 움직입니다. 결말과 수치에는 영향이 없어요.)');
        if (c === 0) { G.flags.easyChase = true; toast('추격 완화 — 켬'); }
      } else await narr(this.fails === 1 ? '……정신을 차리자 조금 전 그 자리다.' : '……다시, 조금 전 그 자리다.');
      this.caughtLock = false;
    });
  },
  cleared() { this.fails = 0; },

  /* ---------------------------------------------------------- 그리기 */
  renderBelow(cam, now) {},
  drawHides(cam) {   // 숨는 칸 표시 — 어둠 위에, 가까운 칸일수록 선명하게
    for (let y = 0; y < MAP.rows.length; y++) for (let x = 0; x < MAP.rows[0].length; x++) {
      if (!this.hideAt(x, y)) continue;
      const d = Math.hypot(x - player.x, y - player.y);
      const a = this.cfg.light ? Math.max(0.12, Math.min(0.75, (this.cfg.light + 2.5 - d) / 3)) : 0.6;
      const sx = x * TILE - cam.x, sy = y * TILE - cam.y;
      ctx.save(); ctx.strokeStyle = `rgba(200,190,235,${a})`; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 5.5, sy + 5.5, TILE - 11, TILE - 11); ctx.restore();
    }
  },
  renderAbove(cam, now) {
    if (!this.active) return;
    // 손전등 — 주인공 주변만 밝다
    if (this.cfg.light) {
      const px = player.x * TILE + player.ox + 24 - cam.x, py = player.y * TILE + player.oy + 24 - cam.y;
      const r = this.cfg.light * TILE * (0.96 + Math.sin(now / 310) * 0.03 + (Math.random() < 0.01 ? -0.2 : 0));
      const g = ctx.createRadialGradient(px, py, r * 0.25, px, py, r);
      g.addColorStop(0, 'rgba(4,4,10,0)'); g.addColorStop(0.7, 'rgba(4,4,10,0.55)'); g.addColorStop(1, 'rgba(4,4,10,0.94)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    }
    this.drawHides(cam);
    for (const m of this.mons) if (!m.gone || (m.once && m.once.name === 'vanish')) this.drawMon(m, cam, now);
    // 숨는 중
    if (player.hiddenInChase) {
      ctx.font = `bold 15px ${FONT}`; ctx.fillStyle = 'rgba(220,214,240,0.9)'; ctx.textAlign = 'center';
      ctx.fillText('숨는 중', player.x * TILE + player.ox + 24 - cam.x, player.y * TILE + player.oy - 6 - cam.y); ctx.textAlign = 'left';
    }
    if (this.hintT < 9000 && hudVisible()) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (9000 - this.hintT) / 800);
      panel(16, SH - 70, 520, 52);
      ctx.font = `14px ${FONT}`; ctx.fillStyle = COL.text;
      ctx.fillText('점선 칸에 멈춰 있으면 숨는다 · Shift를 누르면 뛴다(발소리가 난다)', 34, SH - 38);
      ctx.restore();
    }
  },
  drawMon(m, cam, now) {
    const sx = m.fx * TILE + 24 - cam.x, sy = m.fy * TILE + 46 - cam.y;
    if (sx < -80 || sx > SW + 80 || sy < -120 || sy > SH + 120) return;
    let a = 1;
    if (this.cfg.light) {   // 어둠 속에서는 눈만 보인다
      const d = Math.hypot(m.fx - (player.x + player.ox / TILE), m.fy - (player.y + player.oy / TILE));
      a = Math.max(0, Math.min(1, (this.cfg.light + 0.4 - d) / 1.6));
    }
    const im = IMG['monster_' + m.kind];
    const fr = this.animFrame(m, now);
    ctx.save();
    if (m.stun > 0 && !fr) ctx.globalAlpha = 0.6;
    if (fr) {
      const A = MON_ANIM[m.kind];
      ctx.globalAlpha *= Math.max(a, 0.12);
      ctx.drawImage(IMG[A.img], fr[1] * A.w, fr[0] * A.h, A.w, A.h, Math.round(sx - A.w / 2), Math.round(sy - A.h + 2), A.w, A.h);
    } else if (im) {   // 그림 한 장: 숨 쉬듯 늘었다 줄고, 실패체는 몸을 비틀며 흔들린다. 왼쪽으로 갈 때는 뒤집어 그림
      ctx.globalAlpha *= Math.max(a, 0.12);
      const t = now / 1000 + m.seed, sync = m.burstT > 0;
      ctx.translate(sx, sy);
      if (m.kind === 'union') ctx.rotate(sync ? Math.sin(t * 40) * 0.025 : Math.sin(t * 1.3) * 0.04);
      else ctx.transform(1, 0, Math.sin(t * 1.6) * 0.06, 1, 0, 0);
      ctx.scale(m.dir === 'left' ? -1 : 1, 1 + Math.sin(t * (m.kind === 'union' ? 2.2 : 1.4)) * 0.02);
      ctx.drawImage(im, -Math.round(im.width / 2), -im.height);
    }
    else if (m.kind === 'shadow') this.drawShadow(sx, sy, now, a, m);
    else this.drawUnion(sx, sy, now, a, m);
    ctx.restore();
    if (m.say && m.sayT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, m.sayT / 400);
      ctx.font = `italic 14px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(232,220,226,0.95)';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
      ctx.fillText(m.say, sx + Math.sin(now / 90) * 1.5, sy - 112); ctx.restore();
    }
  },
  /* 지금 그릴 [행, 열] — 한 번 재생(출현·소멸·잡기) > 경직 > 걷기 > 경계 · 두리번 · 대기. 시트가 없으면 null */
  animFrame(m, now) {
    const A = MON_ANIM[m.kind]; if (!A || !IMG[A.img]) return null;
    if (m.once && A.anims[m.once.name]) { const [r, n, ms] = A.anims[m.once.name]; return [r, Math.min(n - 1, Math.floor(m.once.t / ms))]; }
    const pick = (name) => { const [r, n, ms] = A.anims[name]; return [r, Math.floor((now + m.seed * 977) / ms) % n]; };
    if (m.kind !== 'union') return null;   // 그림자는 출현·소멸 말고는 그림 한 장
    if (m.stun > 0) return pick(m.stunKind === 'restore' ? 'idle' : 'hit');
    const moving = Math.hypot(m.tx - m.fx, m.ty - m.fy) > 0.02;
    if (moving) return pick('walk_' + (m.dir || 'down'));
    if (m.state === 'suspicious' || (m.state === 'chase' && m.t < 500)) return pick('alert');
    if (m.state === 'search') return pick('look');
    return pick('idle');
  },
  // DAY 3 — 그림자·손·눈만
  drawShadow(sx, sy, now, a, m) {
    const t = now / 1000 + m.seed;
    ctx.globalAlpha = 0.85 * Math.max(a, 0.05);
    ctx.fillStyle = '#05040a';
    ctx.beginPath(); ctx.ellipse(sx, sy - 4, 26, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 18, sy - 4);
    for (let i = 0; i <= 10; i++) { const k = i / 10; ctx.lineTo(sx - 18 + 36 * k, sy - 70 - Math.sin(t * 2 + k * 6) * 8 - Math.sin(k * 3.14) * 18); }
    ctx.lineTo(sx + 18, sy - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0a0812'; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {   // 서로 다른 속도로 움직이는 손가락
      const ang = -2.6 + i * 0.75 + Math.sin(t * (1.1 + i * 0.37)) * 0.4, len = 22 + (i % 3) * 9;
      const bx = sx + Math.cos(ang) * 14, by = sy - 46 + Math.sin(ang) * 18;
      ctx.lineWidth = 3.5 - (i % 2);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(ang) * len * 0.6, by + Math.sin(ang) * len * 0.6 - 6, bx + Math.cos(ang + 0.5) * len, by + Math.sin(ang + 0.5) * len); ctx.stroke();
    }
    // 사람 얼굴보다 낮은 곳의 눈 하나
    const open = (Math.sin(t * 0.9) + 1.15) / 2.15;
    ctx.globalAlpha = Math.max(0.35, a);
    ctx.fillStyle = '#e8d890'; ctx.beginPath(); ctx.ellipse(sx + 5, sy - 26, 7, 4.5 * Math.min(1, open), 0, 0, 7); ctx.fill();
    const ang = Math.atan2(player.y * TILE - (m.fy * TILE), player.x * TILE - (m.fx * TILE));
    ctx.fillStyle = '#140804'; ctx.beginPath(); ctx.arc(sx + 5 + Math.cos(ang) * 2.5, sy - 26 + Math.sin(ang) * 1.5, 2.6 * Math.min(1, open), 0, 7); ctx.fill();
  },
  // DAY 6 — 비대칭 몸의 일부
  drawUnion(sx, sy, now, a, m) {
    const t = now / 1000 + m.seed, sync = m.burstT > 0;
    ctx.globalAlpha = Math.max(a, 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 24, 7, 0, 0, 7); ctx.fill();
    const lean = sync ? 0 : Math.sin(t * 1.3) * 6;
    ctx.fillStyle = '#d8d0c8'; ctx.strokeStyle = '#8a7e78'; ctx.lineWidth = 1.5;
    // 다리 — 서로 다른 박자
    for (const [ox, ph] of [[-8, 0], [6, 1.7], [14, 3.1]]) {
      const s = Math.sin(t * (sync ? 9 : 4 + ph)) * 5;
      ctx.beginPath(); ctx.moveTo(sx + ox, sy - 34); ctx.lineTo(sx + ox + s, sy - 14); ctx.lineTo(sx + ox - s * 0.5, sy - 2); ctx.lineWidth = 5; ctx.strokeStyle = '#cfc6be'; ctx.stroke();
    }
    // 몸통
    ctx.fillStyle = '#ddd5cd'; ctx.beginPath(); ctx.ellipse(sx + lean * 0.5, sy - 58, 17, 28, lean * 0.02, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9a8e88'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#b8aca6'; ctx.beginPath(); ctx.ellipse(sx + 3 + lean * 0.5, sy - 52, 7, 9, 0, 0, 7); ctx.fill();   // 움푹한 배
    // 팔 — 다른 방향으로 접히는 관절
    for (const [side, len, ph] of [[-1, 34, 0], [1, 40, 1.2], [1, 26, 2.6], [-1, 22, 4]]) {
      const ang = (sync ? 0.25 : Math.sin(t * (1.4 + ph * 0.3) + ph) * 0.9) + (side < 0 ? 2.4 : 0.7);
      const ex = sx + side * 12 + Math.cos(ang) * len * 0.55, ey = sy - 70 + Math.sin(ang) * len * 0.55;
      const hx = ex + Math.cos(ang - side * 1.4) * len * 0.5, hy = ey + Math.sin(ang - side * 1.4) * len * 0.5;
      ctx.strokeStyle = '#cec4bc'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx + side * 12, sy - 70); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    }
    // 머리 — 몸통과 맞지 않는 위치
    const hx = sx - 9 + (sync ? 9 : Math.sin(t * 0.7) * 4), hy = sy - 94;
    ctx.fillStyle = '#e2dad2'; ctx.beginPath(); ctx.ellipse(hx, hy, 11, 13, 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1214';
    ctx.beginPath(); ctx.arc(hx - 3, hy + 2, 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 10, sy - 66, 2.2, 0, 7); ctx.fill();   // 몸통의 눈
    ctx.fillStyle = '#5a2a2e'; ctx.beginPath(); ctx.ellipse(hx + 5, hy + 7, 3, 1.6, 0.4, 0, 7); ctx.fill();
  },
};
