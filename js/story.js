/* 한 사람 몫의 식탁 — 프롤로그 · DAY 1~7 · 결말 5종  (기획서 · 시나리오 대본 v3.0 기준)
   일체회의 일곱 단계 의식 — 인사·나눔·동침·섭취·기억·일체·마지막 식사. DAY는 자연 날짜가 아니라 의식의 단계다.
   기준 시각은 오전 8시 13분, 칠판과 문서의 날짜는 언제나 3월 13일. 기숙사에서 잠들면 다음 단계의 교실로 재구성된다.
   유리는 끝까지 교리를 믿는다. 식인은 DAY 4 특별한 식사 전까지 명시하지 않는다.
   phase 0 조회 / 1 오전·점심 / 2 방과 후 / 3 밤 */
'use strict';

const TC = 'tiles_classroom', TH = 'tiles_hallway', TF = 'tiles_cafeteria', TP = 'tiles_chapel', TO = 'tiles_outdoor', TB = 'tiles_basement';

/* 문서가 있는 물건은 메뉴의 아이템에서 다시 읽을 수 있다 (doc). 문서 내용은 아래 장면 코드에 있다. */
/* 학교 지도 (v2.3) — 지도 아이템 · 화면 오른쪽 위 '지도' 버튼 · M 키.
   x는 복도 지도의 문 칸 좌표(복도 너비 21칸). where()는 지금 있는 곳을 돌려준다. */
const SCHOOL_MAP = {
  floors: [
    { name: '2층', hall: '2층 복도', rooms: [
      { id: 'classroom', label: '2학년 A반', x: 4, w: 5 }, { id: 'restroom', label: '화장실', x: 12, w: 3 },
      { id: 'library', label: '도서실', x: 16, w: 4 }, { id: 'stairs2', label: '계단', x: 19.5, w: 2 } ] },
    { name: '1층', hall: '1층 복도', rooms: [
      { id: 'stairs1', label: '계단', x: 1, w: 2 }, { id: 'infirmary', label: '양호실', x: 3, w: 2 },
      { id: 'cafeteria', label: '급식실', x: 6, w: 4 }, { id: 'chapel', label: '예배당', x: 10, w: 3 },
      { id: 'field', label: '운동장', x: 12.5, w: 2 }, { id: 'office', label: '교무실', x: 15, w: 2 },
      { id: 'dorm', label: '기숙사', x: 18.5, w: 3 } ] },
  ],
  where() {
    const m = G.map;
    if (m === 'hall2') return { floor: 0, hallX: Math.min(20, player.x) };
    if (m === 'hall1') return { floor: 1, hallX: Math.min(20, player.x) };
    const alias = { classroom7: 'classroom' }[m] || m;
    for (let fi = 0; fi < this.floors.length; fi++) if (this.floors[fi].rooms.some(r => r.id === alias)) return { floor: fi, room: alias };
    return null;   // 지하 기록실 · 지하 예배당 · 과거의 교실
  },
};

const ITEMS = {
  map:         { name: '학교 지도', icon: 'icon_map', desc: '이안이 손으로 그린 지도. 1층, 2층, 기숙사가 있다. 지하는 그려져 있지 않다. (언제든 화면 위 \'지도\' 버튼이나 M 키로 펼칠 수 있다)', doc: { type: 'schoolmap' } },
  ticket:      { name: '두 개의 식권', icon: 'icon_ticket', desc: '내 이름과 유리의 이름이 적힌 식권 두 장. 두 이름의 글씨가 똑같다.' },
  doctrine:    { name: '교리책 기록', icon: 'icon_doctrine', desc: '『사랑하는 사람을 위한 식사 예절』. 마지막 두 장은 다른 종이로 덧대어져 있다.', doc: () => DOCTRINE_DOC },
  ribbon:      { name: '빨간 리본', get icon() { return iconOf('icon_ribbon', 'icon_hairtie'); }, desc: '끝이 해진 빨간 리본. 내 손으로 유리 머리를 묶어 주던 기억이 나는 물건이다.' },
  hairtie:     { name: '빨간 리본', get icon() { return iconOf('icon_ribbon', 'icon_hairtie'); }, desc: '끝이 해진 빨간 리본. 내 손으로 유리 머리를 묶어 주던 기억이 나는 물건이다.' },
  torn_letter: { name: '찢어진 편지', icon: 'icon_torn_letter', desc: '「네가 나였으면 좋겠어」까지만 남아 있다. 누가 누구에게 쓴 편지인지 알 수 없다.', doc: () => TORN_LETTER_DOC },
  attendance:  { name: '출석부', icon: 'icon_attendance', desc: '지하 기록실의 2학년 A반 출석부. 첫 줄부터 마지막 줄까지 전부 내 이름이다.', doc: () => ATTEND_DOC() },
  empty_plate: { name: '빈 접시', icon: 'icon_empty_plate', desc: '특별한 식사 뒤 손에 쥐어져 있던 흰 접시. 혀로 핥은 것처럼 깨끗하다.' },
  old_letter:  { name: '과거의 편지', icon: 'icon_old_letter', desc: '「네가 나를 잊는 것보다 네가 나를 먹는 게 나아」. 내 글씨다.', doc: () => fmtDoc(OLD_LETTER_DOC) },
  ritual_record: { name: '의식 기록', icon: 'icon_ritual_record', desc: '지하 예배당에 놓여 있던 일체회의 기록. 실패한 합일이 회차마다 적혀 있다.', doc: () => RITUAL_DOC() },
  lunchbox:    { name: '빈 도시락', icon: 'icon_lunchbox', desc: '뚜껑에 두 사람의 이름이 나란히 적힌 도시락통. 안은 비어 있다.' },
  yuri_notes:  { get name() { return `유리의 쪽지 (${(G.flags.notes || []).length}/6)`; }, get icon() { return iconOf('icon_yuri_notes', 'icon_torn_letter'); },
    desc: '도시락 뚜껑 안쪽에 붙어 있던 쪽지. 귀엽다. 가끔 알 수 없는 걸 알고 있다.', doc: () => notesDoc() },
  ian_pieces:  { get name() { return `이안의 수첩 조각 (${pieceList().length}/5)`; }, get icon() { return iconOf('icon_ian_pieces', 'icon_old_letter'); },
    desc: '지난 회차의 이안이 남긴 한 장. 글씨는 전부 같고, 뒤로 갈수록 흔들린다.', doc: () => piecesDoc() },
  ian_notebook: { name: '이안의 수첩', get icon() { return iconOf('icon_ian_notebook', 'icon_doctrine'); }, desc: 'DAY 7 빈 교실에 남겨져 있던 수첩. 마지막 장에 내 이름이 있다.', doc: () => fmtDoc(IAN_NOTEBOOK_DOC) },
  zero_report: { name: '최초의 의식', icon: 'icon_zero_report', desc: '일체회의 최초 의식 기록. 원래의 두 사람은 처음부터 여기 없었다.', doc: () => ZERO_DOC },
};
/* 칠판·문서의 날짜는 언제나 3월 13일 (DAY는 의식의 단계) */
const dateOf = () => '3월 13일';

/* 날짜별 플래그 (날이 바뀌면 새로 시작) */
function dflag(k, v) { return flag(`d${G.day}_${k}`, v); }
function dcount(k) { return count(`d${G.day}_${k}`); }

function ambienceForPhase() {
  if (G.phase === 2) return { tint: [255, 140, 80, 0.17], bgm: 'evening' };
  if (G.phase >= 3) return { tint: [30, 30, 100, 0.34], bgm: 'night' };
  return { tint: [0, 0, 0, 0], bgm: 'day' };
}

const clockText = () => G.phase === 0 || (G.phase === 1 && !dflag('lunchStarted'))
  ? ['시계는 8시 13분을 가리키고 있다.', ...(count('clock') > 1 ? ['……아까부터 계속 8시 13분이다.'] : [])]
  : G.phase === 1 ? ['점심시간인데, 시계는 8시 13분이다.']
  : G.phase === 2 ? ['창밖은 저녁인데, 시계는 8시 13분이다.']
  : ['시계는 8시 13분을 가리키고 있다.', '초침이 움직이는 소리는 들리는데, 바늘은 움직이지 않는다.'];

const BOARD_WORDS = { 1: '사람은 떨어져 있기에 외롭습니다.', 2: '나누면 하나가 됩니다.', 3: '같은 꿈을 꾸는 사람은 같은 사람입니다.',
  4: '남기는 것은 사랑하지 않는다는 증거입니다.', 5: '기억은 나눠 가질 수 있습니다.', 6: '둘은 하나가 됩니다.' };
const boardDate = () => '3월 13일';
const visClassmates = () => G.phase <= 1 && !dflag('lunchStarted');
const visLunch = () => dflag('lunchStarted') && G.phase === 1;
const visClass = () => dflag('inClass');

/* NPC: lines(n, day) → [[who, text, face]] ; n은 그날 말을 건 횟수 */
function npc(id, x, y, sprite, dir, show, lines, opt = {}) {
  return Object.assign({
    id, x, y, sprite, dir, show,
    action: async (e) => {
      const n = dcount('talk_' + id);
      const set = typeof lines === 'function' ? lines(n, G.day) : lines;
      for (const [who, text, f] of set) {
        if (who === 'flag') { if (once(text)) gain('cult_truth', 10); continue; }
        if (who === 'think') await think(text);
        else if (who === 'narr') await narr(text);
        else await say(who === S && G.day === 5 ? mixedName(id) : who, text, f === undefined ? null : f);
      }
      e.dir = dir;
    },
  }, opt);
}
const S = '반 친구';
function mixedName(id) {
  const names = ['유리', '이안', '모모', G.name, '선생님', '반 친구'];
  let h = 0; for (const c of id) h += c.charCodeAt(0);
  return names[h % names.length];
}
/* 날이 갈수록 빈자리가 늘어난다. 7일째에는 학교에 아무도 없다 (keep7 표시가 있는 것만 보임) */
const GONE = {
  4: ['c7', 's1', 'l9'],
  5: ['c7', 's1', 'c3', 's2', 's3', 'l3', 'l7', 'l9'],
  6: ['c1', 'c3', 'c5', 'c7', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'l1', 'l3', 'l5', 'l7', 'l9', 'libgirl'],
};
function VIS_HOOK(e) {
  if (!(e.sprite || e.pose)) return true;
  if (G.day >= 7) return !!e.keep7;
  if ((GONE[G.day] || []).includes(e.id)) return false;
  return true;
}
/* 반 친구 대사: 1~3일째는 평소 대사, 4일째부터 기억이 무너진 대사 */
const decayLine = (base, late) => (n, day) => (day >= 4 && late) ? late : base(n, day);

/* 꽉 찬 교실 (v1.7): 이름 있는 반 친구(c1~c7) 말고도 모든 자리에 학생이 앉아 있다. 결석하면 책상에 흰 접시가 놓인다. */
const SEATS = [
  ['s1', 2, 6, 'student_2', [['think', '(칠판만 보고 있다. 눈을 깜빡이지 않는다.)']]],
  ['s2', 8, 6, 'student_4', [[S, '……'], ['think', '(대답 대신 공책에 같은 글자를 계속 쓰고 있다. 『하나』.)']]],
  ['s3', 12, 6, 'student_1', [[S, '전학생? ……전학생은 매년 오잖아.']]],
  ['s4', 4, 8, 'student_3', [[S, '쉿. 선생님이 보셔.']]],
  ['s5', 6, 8, 'student_1', [[S, '점심 뭐 나와? ……아, 맞다. 늘 같은 거지.']]],
  ['s6', 10, 8, 'student_4', [['think', '(엎드려 있다. 셋을 세면, 옆자리 아이도 똑같이 숨을 쉰다.)']]],
  ['s7', 8, 10, 'student_2', [[S, '너 그 자리 맞아? ……응, 맞네. 원래 거기였지.']]],
];
const SEAT_LATE = [[S, '……'], ['think', '(얼굴이 잘 보이지 않는다. 가까이 가도 초점이 맞지 않는다.)']];
const SEAT_IDS = [['c1', 6, 6], ['c2', 10, 6], ['c3', 2, 8], ['c4', 8, 8], ['c5', 12, 8], ['c6', 4, 10], ['c7', 6, 10]].concat(SEATS.map(a => a.slice(0, 3)));
function drawPlate(c, sx, sy) {
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sx + 24, sy + 20, 13, 6, 0, 0, 7); c.fill();
  c.fillStyle = '#f2f0f4'; c.beginPath(); c.ellipse(sx + 24, sy + 18, 12, 5.5, 0, 0, 7); c.fill();
  c.strokeStyle = '#b8b4c4'; c.lineWidth = 1; c.beginPath(); c.ellipse(sx + 24, sy + 18, 7, 3, 0, 0, 7); c.stroke();
}
/* ================================================================= MAPS */
const MAPS = {
  classroom: {
    name: '2학년 A반',
    rows: [
      'TTTTTTTTTTTTTTTTT',
      'TNWWBBBBBWWCWWNDT',
      'THH.............T',
      'T.......P.......T',
      'T...............T',
      'T.d.d.d.d.d.d..HT',
      'T..............HT',
      'T.d.d.d.d.d.d..HT',
      'T..............HT',
      'T.d.d.d.d.e.d...T',
      'T...............T',
      'TT.............TT',
      'TTTTTTTTTTTTTTTTT',
    ],
    legend: {
      T: [TC, 2, 0], W: [TC, 1, 0], N: [TC, 3, 0], B: [TC, 4, 0], C: [TC, 5, 0], D: [TC, 6, 1],
      '.': [TC, 0, 1], P: [TC, 9, 0], d: [TC, 7, 0], e: [TC, 8, 0], s: [TC, 22, 1], H: [TC, 11, 0], p: [TC, 20, 0],
    },
    tileText: {
      N: () => G.vars.cult_truth >= 50 && count('winLook') % 2 === 1
        ? ['창밖으로…… 지하실이 보인다.', '여기는 2층인데.']
        : ['창밖으로 산이 보인다.', '나무들이 그림처럼 움직이지 않는다.'],
      B: () => ['칠판 — 『' + BOARD_WORDS[Math.min(6, G.day)] + '』', '구석의 날짜는 오늘도 3월 13일이다.'],
      C: () => G.vars.cult_truth >= 80 ? clockText().concat(['……방금, 분침이 한 칸 움직였다가 돌아온 것 같다.']) : clockText(),
      P: ['교탁이다. 출석부는 선생님이 가져갔다.'],
      d: () => G.phase >= 2 ? ['누군가의 책상이다. 의자가 반듯하게 집어넣어져 있다.'] : ['누군가의 책상이다.'],
      H: ['학급 문고다. 책등이 전부 하얗다.'],
      p: ['조화다. 잎에 먼지 하나 없다.'],
    },
    events: [
      { id: 'door', x: 15, y: 1, touch: () => transfer('hall2', 4, 2, 'down') },
      { id: 'plant', x: 13, y: 2, block: true, deco: drawRaisedPlant, text: ['조화다. 잎에 먼지 하나 없다.'] },
      { id: 'teacher', x: 15, y: 2, sprite: 'teacher', dir: 'left', show: () => dflag('teacherIn') },
      { id: 'yuri', x: 12, y: 10, sprite: 'yuri', dir: 'up', show: () => G.day < 7 && (G.phase === 0 || (G.phase === 2 && !dflag('yuriLeft4') && !dflag('yuriLeft5')) || (G.phase >= 3 && G.day <= 2)), action: async (e) => { await yuriClassroom(e); } },
      { id: 'yuriDoor', x: 15, y: 2, sprite: 'yuri', dir: 'down', show: () => dflag('yuriDoor') },
      npc('ian', 4, 6, 'ian', 'up', () => G.phase === 0, []),
      npc('momo', 2, 10, 'momo', 'up', () => G.day === 1 ? visClassmates() : G.phase === 0, (n, day) => day >= 2 && G.vars.momo_trust >= 60
        ? [['momo', '……왔어?', 0], ['narr', '모모가 빈 책상 옆에서 기다리고 있었다.']]
        : day >= 2 && G.vars.momo_trust < 30 ? [['narr', '모모는 이쪽을 보지 않는다.']]
        : n === 1
        ? [['narr', '모모는 손에 쥔 공책에서 시선을 떼지 않는다.'], ['momo', '……왜?', 1], ['hero', '그냥, 이름이 궁금해서.', 3], ['momo', '모모.', 0], ['narr', '모모는 다시 공책을 본다.']]
        : [['momo', '……', 0]], { turn: false }),
      npc('c1', 6, 6, 'student_1', 'up', visClassmates, decayLine((n) => n === 1
        ? [[S, '응? 내 이름? 잠깐만, 명찰 좀 보고.'], [S, '……'], [S, '명찰에 아무것도 안 적혀 있네. 하하.']]
        : [[S, '이름 같은 건 없어도 돼. 어차피 다 같이 쓰는 거니까.']],
        [[S, '봐. 명찰에 이름이 생겼어.'], [S, '{N}. ……너랑 같은 이름이네.'], ['think', '(명찰의 글씨는 내 글씨였다.)']])),
      npc('c2', 10, 6, 'student_3', 'up', visClassmates, decayLine(() =>
        [[S, '여기 급식 진짜 맛있어.'], [S, '매일 똑같은 메뉴인데, 매일 처음 먹는 것처럼 맛있어.']],
        [[S, '요즘 급식이 줄었어.'], [S, '식탁에 빈자리가 생기니까. 빈자리 몫은 어디로 가는 걸까?']])),
      npc('c3', 2, 8, 'student_2', 'up', visClassmates, decayLine((n) => n === 1
        ? [[S, '어제 동생이랑 바다에 갔었어. 모래가 엄청 뜨거웠는데.'], [S, '……'], [S, '아, 나 동생 없는데.'], [S, '그럼 그건 누구 기억이지?']]
        : [[S, '바다 냄새가 아직 나. 너도 맡아져?']],
        [[S, '바다에 간 게…… 누구였더라.'], [S, '너였나? 그럼 그 기억, 나한테 빌려준 거야?']])),
      npc('c4', 8, 8, 'student_4', 'up', visClassmates, (n, day) => day >= 2
        ? [[S, '전학생이 그 자리에 앉는구나.'], [S, '저번 전학생도 그 자리였는데.'], ['think', '(저번 전학생은…… 나다.)']]
        : [[S, '전학생이 그 자리에 앉는구나.'], [S, '저번 전학생도 그 자리였는데.'], ['think', '(저번 전학생은 어디로 갔을까.)']]),
      npc('c5', 12, 8, 'student_2', 'up', visClassmates, decayLine(() =>
        [[S, '선생님 말씀 들었지? 우리는 서로 사랑해야 해.'], [S, '너도. 나도. 남김없이.']],
        [[S, '남김없이. 남김없이. 남김없이.'], [S, '……그 뒤에 뭐라고 했더라. 기억이 안 나.']])),
      npc('c6', 4, 10, 'student_4', 'up', visClassmates, decayLine(() =>
        [['narr', '엎드려 자고 있다.'], [S, '……음냐…… 다 먹었어…… 남김없이……']],
        [['narr', '엎드려 자고 있다.'], [S, '……다 먹었어…… 이제…… 내 차례야……'], ['think', '(어깨가 숨을 쉬지 않는다.)']])),
      npc('c7', 6, 10, 'student_3', 'up', visClassmates, () =>
        [[S, '창밖 산 봤어?'], [S, '내가 입학했을 때도 저 색이었어. 그게 언제였더라.']]),
      ...SEATS.map(([id, x, y, sp, lines]) => npc(id, x, y, sp, 'up', visClassmates, decayLine(() => lines, SEAT_LATE), { turn: false })),
      ...SEAT_IDS.map(([id, x, y]) => ({ id: 'plate_' + id, x, y: y - 1, deco: drawPlate, text: ['흰 접시가 놓여 있다. 아무것도 담겨 있지 않다.', '……이 자리 아이의 얼굴이 기억나지 않는다.'],
        show: () => G.day >= 4 && G.day <= 6 && (GONE[G.day] || []).includes(id) })),
      { id: 'emptyDesk', x: 10, y: 9, action: async () => { await emptyDesk(); } },
      { id: 'ianDesk', x: 4, y: 5, action: async () => { await ianNotebook7(); } },
    ],
  },

  hall2: {
    name: '2층 복도',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTT',
      'TWNWDWNWOWNWRWNWLWNST',
      'T...................T',
      'T...................T',
      'TT.KKK.......KKK...TT',
      'TTTTTTTT.....TTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTT',
    ],
    legend: {
      T: [TH, 2, 0], W: [TH, 1, 0], N: [TH, 3, 0], D: [TH, 4, 1], L: [TH, 4, 1], S: [TH, 5, 1, 29],
      O: [TH, 7, 0], R: () => [TH, 8, G.day >= 2 ? 1 : 0], K: [TH, 11, 0], '.': [TH, 0, 1],
    },
    tileText: {
      N: () => G.phase >= 3 ? ['창밖이 깜깜하다. 유리에 비친 복도가 실제 복도보다 조금 길다.'] : ['복도 창문이다. 운동장에 아무도 없다.'],
      R: () => G.day >= 2 ? ['화장실이다.'] : ['화장실이다. 『청소 중』 팻말이 걸려 있다.'],
      K: ['사물함이다. 이름표가 하나도 붙어 있지 않다.'],
    },
    events: [
      { id: 'toClass', x: 4, y: 1, touch: async () => {
        if (G.day === 5 && G.phase === 2 && !has('old_letter')) { await transfer('pastroom', 15, 2, 'down'); return; }
        await transfer('classroom', 15, 2, 'down');
      } },
      { id: 'toLib', x: 16, y: 1, touch: () => transfer('library', 8, 11, 'up') },
      { id: 'toWc', x: 12, y: 1, touch: () => transfer('restroom', 5, 5, 'up') },
      { id: 'stairs', x: 19, y: 1, touch: async () => {
        if (G.day === 5 && G.phase === 2 && once('d5_stairs')) {
          await transfer('hall2', 18, 2, 'left');
          await scare('stairs', 500);
          await narr('계단을 내려왔는데, 다시 2층 복도다.');
          await think('(분명히 한 층을 내려왔다.)');
          return;
        }
        await transfer('hall1', 1, 2, 'down');
      } },
      { id: 'libSign', x: 17, y: 1, text: ['『도서관』'] },
      /* 조용한 이상 현상: 다가가면 사라지는 사람 */
      { id: 'ph4', x: 19, y: 3, sprite: () => heroSheet(), dir: 'left', phantom: 4, show: () => G.day === 4 && G.phase === 2,
        onVanish: async () => { await think('(복도 끝에 서 있던 건…… 나였다.)'); } },
      { id: 'board', x: 8, y: 1, action: async () => {
        await doc({ type: 'paper', title: '게시판', lines: [
          '#이번 주 급식', '월 · 화 · 수 · 목 · 금 · 토 · 일', '고기 스튜, 흰 빵, 우유', '', '#이번 주 말씀', '나누면 하나가 됩니다.', '',
          flag('lostFoundSeen') ? '~분실물: 없음. 빨간 리본은 주인이 찾아갔습니다.' : '~분실물: 빨간 리본 하나. 주인은 교무실로.'] });
      } },
      { id: 'classSign', x: 5, y: 1, text: ['『2학년 A반』'] },
      { id: 'ian2', x: 9, y: 2, sprite: 'ian', dir: 'left', show: () => G.phase === 1 && !dflag('lunchStarted') && G.day <= 6, action: async (e) => { await ianHall(e); e.dir = 'left'; } },
    ],
  },

  restroom: {
    name: '화장실',
    rows: [
      'TTTTTTTTTTTTT',
      'TWMMMWWSSSSWT',
      'T...........T',
      'T...........T',
      'T...........T',
      'TT.........TT',
      'TTTTTXTTTTTTT',
    ],
    legend: { T: [TH, 2, 0], W: [TH, 1, 0], M: [TH, 13, 0], S: [TH, 14, 0], '.': [TH, 0, 1], X: [TH, 10, 1] },
    tileText: {
      M: ['세면대 거울이다. 수도꼭지를 돌려도 물이 나오지 않는다.'],
      S: ['칸 문이 전부 잠겨 있다.', '안에서는 아무 소리도 나지 않는다.'],
    },
    events: [
      { id: 'exit', x: 5, y: 6, touch: () => transfer('hall2', 12, 2, 'down') },
      { id: 'mirror', x: 3, y: 1, action: async () => { await restroomMirror(); } },
      { id: 'momoW', x: 4, y: 2, sprite: 'momo', dir: 'up', show: () => G.day === 5 && G.phase === 2, action: async (e) => { if (dflag('momoMirror')) await momoMirror(e); else await branch('d5_mirror', () => momoMirror(e)); } },
    ],
  },

  library: {
    name: '도서관',
    rows: [
      'TTTTTTTTTTTTTTTTT',
      'THHHHHHNHHHHHHHHT',
      'T...............T',
      'T.hh.hh...hh.hh.T',
      'T...............T',
      'T.hh.hh...hh.hh.T',
      'T...............T',
      'T....rrbr.......T',
      'T...............T',
      'T...............T',
      'Tp.............pT',
      'TTTT.........TTTT',
      'TTTTTTTTXTTTTTTTT',
    ],
    legend: {
      T: [TC, 2, 0], H: [TC, 10, 0], N: [TC, 3, 0], h: [TC, 11, 0], r: [TC, 12, 0], b: [TC, 13, 0],
      p: [TC, 20, 0], '.': [TC, 0, 1], X: [TC, 18, 1],
    },
    tileText: {
      H: ['책 제목이 전부 『사랑』으로 시작한다.'],
      h: ['책 제목이 전부 『사랑』으로 시작한다.'],
      N: ['창밖으로 산이 보인다. 아까와 똑같은 모양이다.'],
      r: ['열람용 책상이다.'],
      p: ['조화다. 먼지 하나 없다.'],
    },
    events: [
      { id: 'exit', x: 8, y: 12, touch: () => transfer('hall2', 16, 2, 'down') },
      /* 조용한 이상 현상: 다가가면 사라지는 사람 */
      { id: 'ph6', x: 8, y: 3, sprite: 'student_1', dir: 'down', phantom: 3, show: () => G.day === 6 },
      { id: 'album', x: 2, y: 3, action: async () => {
        await doc({ type: 'book', pages: [{ left: ['', '', '#졸업앨범', '', '', '~얼굴은 모두 웃고 있다. 이름 칸은 비어 있다.'], right: [], album: true }] });
      } },
      {
        id: 'cookbook', x: 13, y: 5,
        action: async () => {
          if (!flag('book')) { await narr('요리책이다. 열람대의 책부터 읽어 보자.'); return; }
          await doc({ type: 'book', pages: [
            { left: ['', '#처음 하는 사람을', '#위한 요리', '', G.day >= 4 ? '식재료명 대신 참가자명을 적을 것.' : '재료명 대신 ○○명을 적을 것.', '', '~(잉크가 번져 있다)'], right: [], torn: true },
          ] });
          await narr('마지막 장 몇 장이 뜯겨 있다. 뒤쪽에 학생 이름이 적힌 분류표가 끼워져 있다.');
          if (once('opt_cookbook')) gain('cult_truth', 10);
        },
      },
      { id: 'book', x: 7, y: 7, action: async () => { await readDoctrineBook(); } },
      npc('libgirl', 12, 9, 'student_3', 'left', () => G.phase === 1 || G.phase === 2, (n, day) => n === 1
        ? [[S, '여기 책은 다 읽어 봤어.'], [S, '근데 읽을 때마다 마지막 장이 달라져.'], [S, '……아니다. 내가 달라지는 건가.']].concat(day >= 3 ? [['think', '(어제 나한테 한 말을 그대로 하고 있다. 어제 일은 기억하지 못하는 얼굴로.)']] : [])
        : [[S, '책상 위에 있는 책, 읽어 봤어? 다들 그 책부터 읽어.']]),
    ],
  },

  hall1: {
    name: '1층 복도',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTT',
      'TSWIWWCWWNPWAWNOGWYWT',
      'T...................T',
      'T...................T',
      'TTKK.............p.TT',
      'TTTTTTTTTTETTTTTTTTTT',
    ],
    legend: {
      T: [TH, 2, 0], W: [TH, 1, 0], N: [TH, 3, 0], S: [TH, 5, 1, 29], C: [TH, 4, 1], G: () => [TH, 6, G.day >= 7 ? 1 : 0],
      I: () => [TH, 4, G.day >= 2 ? 1 : 0], P: () => [TH, 4, G.day >= 2 ? 1 : 0], A: () => [TH, 9, G.day >= 2 ? 1 : 0],
      Y: () => [TH, 4, G.phase >= 3 ? 1 : 0], O: () => [TH, 4, G.day >= 2 && G.phase < 3 ? 1 : 0], E: [TH, 9, 0], K: [TH, 11, 0], p: [TH, 12, 0], '.': [TH, 0, 1],
    },
    tileText: {
      N: () => G.phase >= 3 ? ['밖이 깜깜하다.'] : ['창밖으로 운동장이 보인다. 나무 한 그루가 서 있다.'],
      G: () => G.day >= 7 ? ['지하실 문이 열려 있다.'] : ['지하실로 내려가는 문이다. 잠겨 있다.', '문틈으로 따뜻한 바람이 올라온다.', '……무언가 오래 끓인 냄새가 난다.'],
      E: () => G.day >= 7 ? ['정문이다. 아직 열리지 않는다.', '손잡이가 차갑다.'] : ['정문이다. 열리지 않는다.', '유리문 너머로 산이 보인다. 계절이 언제부터 이 색이었는지 기억나지 않는다.'],
      Y: () => G.phase >= 3 ? ['기숙사로 이어지는 문이다.'] : ['기숙사로 이어지는 문이다. 방과 후에 열린다고 적혀 있다.'],
      I: ['양호실이다. 잠겨 있다.'],
      P: ['예배당이다. 잠겨 있다.', '안에서 낮은 노랫소리가 들린다. 가사는 알아들을 수 없다.'],
      A: ['운동장으로 나가는 문이다. 잠겨 있다.'],
      O: () => G.day < 5 ? ['교무실이다. 잠겨 있다.', '안에서 출석을 부르는 소리가 들린다.'] : ['교무실이다. 밤에는 잠겨 있다.'],
      K: ['신발장이다. 신발이 전부 같은 사이즈다.'],
      p: ['조화다.'],
    },
    events: [
      { id: 'stairs', x: 1, y: 1, touch: () => transfer('hall2', 19, 2, 'down') },
      /* 조용한 이상 현상: 다가가면 사라지는 사람 */
      { id: 'ph1', x: 19, y: 3, sprite: 'student_2', dir: 'left', phantom: 3, show: () => G.day === 1 && G.phase >= 3 },
      { id: 'ph7', x: 14, y: 3, sprite: 'student_3', dir: 'up', keep7: true, phantom: 3, show: () => G.day === 7,
        onVanish: async () => { await think('(방금 거기 누가 서 있었다. 오늘 학교에는 아무도 없는데.)'); } },
      { id: 'toInf', x: 3, y: 1, touch: () => transfer('infirmary', 6, 7, 'up') },
      { id: 'toCaf', x: 6, y: 1, touch: async () => { if (G.day >= 7) { await enterFinalCafeteria(); return; } await transfer('cafeteria', 8, 11, 'up'); } },
      { id: 'toChapel', x: 10, y: 1, touch: () => transfer('chapel', 8, 11, 'up') },
      { id: 'toField', x: 12, y: 1, touch: () => transfer('field', 9, 2, 'down') },
      { id: 'toDorm', x: 18, y: 1, touch: () => transfer('dorm', 6, 7, 'up') },
      { id: 'momoG', x: 10, y: 4, sprite: 'momo', dir: 'down', keep7: true, show: () => G.day >= 7 && G.vars.momo_trust >= 60 && !dflag('final'), action: async (e) => { await momoGate(e); } },
      { id: 'toOffice', x: 15, y: 1, touch: async () => { await transfer('office', 6, 7, 'up'); } },
      { id: 'toBasement', x: 16, y: 1, show: () => G.day >= 7, touch: async () => { await transfer('basement', 15, 2, 'down'); if (once('d7_base')) await narr('오늘은 지하실 문이 열려 있다. 아무도 없다.'); } },
      { id: 'infSign', x: 4, y: 1, text: ['『양호실』'] },
      { id: 'cafSign', x: 7, y: 1, text: ['『급식실』'] },
      { id: 'chapelSign', x: 11, y: 1, text: ['『예배당』'] },
      { id: 'fieldSign', x: 13, y: 1, text: ['『운동장』'] },
      { id: 'dormSign', x: 19, y: 1, text: ['『기숙사』'] },
      npc('momo2', 16, 2, 'momo', 'up', () => G.day === 1 && G.phase === 2, (n) => n === 1
        ? [['narr', '모모가 지하실 문 앞에 서 있다.'], ['momo', '……', 0]]
        : [['momo', '……', 0]]),
    ],
  },

  infirmary: {
    name: '양호실',
    rows: [
      'TTTTTTTTTTTTT',
      'TWWNWWWHWNWWT',
      'T.b.b.b.....T',
      'T.f.f.f.....T',
      'T.......dd..T',
      'T...........T',
      'T..........pT',
      'TT.........TT',
      'TTTTTTXTTTTTT',
    ],
    legend: {
      T: [TC, 2, 0], W: [TC, 1, 0], N: [TC, 3, 0], H: [TC, 10, 0], b: [TC, 14, 0], f: [TC, 30, 0], d: [TC, 7, 0],
      p: [TC, 20, 0], '.': [TC, 0, 1], X: [TC, 18, 1],
    },
    tileText: {
      H: ['약장이다. 병마다 라벨이 붙어 있는데, 전부 『소화제』다.'],
      b: ['빈 침대다. 시트가 반듯하다.'], f: ['빈 침대다. 시트가 반듯하다.'],
      d: ['양호 선생님의 책상이다. 아무도 없다.'],
      N: ['창밖으로 운동장이 보인다.'],
      p: ['조화다.'],
    },
    events: [
      { id: 'exit', x: 6, y: 8, touch: () => transfer('hall1', 3, 2, 'down') },
      { id: 'nameBedF', x: 6, y: 3, text: ['침대 머리맡 이름표에 『{N}』이라고 적혀 있다.', '……이 침대에 누운 기억은 없다.'] },
      { id: 'nameBed', x: 6, y: 2, text: ['침대 머리맡 이름표에 『{N}』이라고 적혀 있다.', '……이 침대에 누운 기억은 없다.'] },
      { id: 'record', x: 8, y: 4, action: async () => { await infirmaryRecord(); } },
      { id: 'momoI', x: 5, y: 3, sprite: 'momo', dir: 'left', show: () => G.day === 4 && G.phase === 2,
        action: async (e) => { if (!(await momoTagCheck())) await say('momo', '확인해 봐. 직접.', 0); e.dir = 'left'; } },
    ],
  },

  chapel: {
    name: '예배당',
    rim: 'dark',
    ambience: () => { const a = ambienceForPhase(); return { tint: a.tint, bgm: G.phase >= 3 ? 'night' : 'chapel' }; },
    rows: [
      'TTTTTTTTTTTTTTTTT',
      'TWWSWWWWSWWWWSWWT',
      'T...c.......c...T',
      'T.......A.......T',
      'T...............T',
      'T.PPPPP...PPPPP.T',
      'T...............T',
      'T.PPPPP...PPPPP.T',
      'T...............T',
      'T.PPPPP...PPPPP.T',
      'T...............T',
      'TTTT.........TTTT',
      'TTTTTTTTXTTTTTTTT',
    ],
    legend: {
      T: [TP, 2, 0], W: [TP, 1, 0], S: [TP, 3, 0], c: [TP, 7, 0], A: [TP, 4, 0], P: [TP, 6, 0], '.': [TP, 0, 1], X: [TP, 8, 1],
    },
    tileText: {
      S: ['붉은 스테인드글라스다.', '두 사람이 그릇 하나를 함께 들고 있다. 얼굴이 똑같다.'],
      c: ['촛불이다. 초가 조금도 줄어들지 않는다.'],
      P: ['긴 의자다. 앉는 자리가 하나도 닳지 않았다.'],
    },
    events: [
      { id: 'exit', x: 8, y: 12, touch: () => transfer('hall1', 10, 2, 'down') },
      /* 조용한 이상 현상: 다가가면 사라지는 사람 */
      { id: 'ph2', x: 8, y: 4, sprite: 'student_4', dir: 'up', phantom: 3, show: () => G.day === 2 && G.phase === 2 },
      { id: 'altar', x: 8, y: 3, action: async () => { await chapelAltar(); } },
      { id: 'hymnal', x: 4, y: 9, action: async () => { await hymnalLetter(); } },
      { id: 'teacherC', x: 8, y: 2, sprite: 'teacher', dir: 'down', show: visClass },
      { id: 'yuriC', x: 5, y: 10, sprite: 'yuri', dir: 'up', show: () => dflag('yuriChapel') },
      { id: 'ianC', x: 11, y: 10, sprite: 'ian', dir: 'up', show: visClass },
      { id: 'momoC', x: 14, y: 10, sprite: 'momo', dir: 'up', show: visClass },
      ...[[2, 6, 1], [4, 6, 3], [6, 6, 2], [11, 6, 4], [13, 6, 1], [3, 8, 2], [5, 8, 4], [10, 8, 3], [12, 8, 2], [14, 8, 4]]
        .map(([x, y, k], i) => ({ id: 'cs' + i, x, y, sprite: 'student_' + k, dir: 'up', show: visClass, chapelStudent: true })),
    ],
  },

  field: {
    name: '운동장',
    rows: [
      'UUUUUUUUUUUUUUUUUUUUU',
      'BBBBBBBBBDBBBBBBBBBBB',
      'Vgg...............ggV',
      'Vg........P........gV',
      'V...QQ..............V',
      'V...................V',
      'V...................V',
      'V...................V',
      'Vg..........ssss..YgV',
      'Vgg.........ssss....V',
      'Vbgg...............gV',
      'JFFFFFFFFFFFFFFFFFFFK',
    ],
    legend: {
      U: [TO, 7, 0], B: [TO, 4, 0], D: [TO, 5, 1], F: [TO, 2, 0], V: [TO, 8, 0], J: [TO, 9, 0], K: [TO, 10, 0], g: [TO, 1, 1], '.': [TO, 0, 1], Y: [TO, 3, 0], b: [TO, 6, 0],
      P: [TO, 11, 0], Q: [TO, 12, 0], s: [TO, 13, 1],
    },
    tileText: {
      F: ['철망 너머로 산이 보인다.', '너무 가까워서 그림 같다.'],
      V: ['철망이다. 손가락이 들어갈 틈도 없다.'], J: ['철망 모서리다.'], K: ['철망 모서리다.'],
      b: ['낡은 벤치다.'],
      B: ['학교 건물이다. 창문마다 커튼이 쳐져 있다.'],
      /* v2.3 운동장 — 날마다 조금씩 달라진다 */
      P: () => G.day >= 7 ? ['국기게양대. 줄이 끊어져 바닥에 감겨 있다.']
        : G.day >= 5 ? ['국기게양대 꼭대기에 흰 앞치마가 매달려 있다.', '급식실 앞치마다. 아랫단이 검붉게 젖어서, 바람이 불어도 펄럭이지 않는다.']
        : ['깃발 없는 국기게양대. 줄만 깃대를 두드린다.', '똑. 똑. 바람이 그쳐도 같은 박자로.'],
      Q: () => G.day >= 4 ? ['철봉. 손잡이에 녹이 번져 있다.', '잡았다 놓은 손바닥이 끈적하다. 녹 냄새가 아니다.']
        : ['철봉이다. 손때 묻은 자리가 나란히 두 군데. 한쪽이 조금 작다.'],
      s: ['모래밭이다.'],
    },
    events: [
      { id: 'exit', x: 9, y: 1, touch: () => transfer('hall1', 12, 2, 'down') },
      /* 조용한 이상 현상: 다가가면 사라지는 사람 */
      { id: 'ph3', x: 17, y: 7, sprite: 'student_2', dir: 'down', phantom: 3, show: () => G.day === 3 && G.phase === 2 },
      { id: 'momoF', x: 2, y: 9, sprite: 'momo', dir: 'down', show: () => G.day === 2 && G.phase === 2,
        action: async (e) => { await momoMeal(e); } },
      { id: 'momoF3', x: 2, y: 9, sprite: 'momo', dir: 'down', show: () => G.day === 3 && G.phase === 1 && !dflag('lunch'),
        action: async (e) => { await momoField3(e); e.dir = 'down'; } },
      { id: 'tree', x: 18, y: 8, action: async () => { await fieldTree(); } },
      { id: 'sand', x: 13, y: 8, action: async () => { await fieldSand(); } },
      { id: 'sand2', x: 14, y: 9, action: async () => { await fieldSand(); } },
      /* DAY 5: 체육복 차림의 줄. 다가가면 한꺼번에 사라진다 */
      ...[[6, 5], [8, 5], [10, 5], [6, 7], [8, 7], [10, 7]].map(([x, y], i) => ({ id: 'pe' + i, x, y, sprite: 'student_' + (1 + i % 4), dir: 'up', phantom: 3,
        show: () => G.day === 5 && G.phase === 2, onVanish: fieldDrill })),
    ],
  },

  basement: {
    name: '지하 기록실',
    rim: 'dark',
    hide: ['h'],
    ambience: () => ({ tint: [20, 0, 20, 0.28], bgm: 'night' }),
    /* DAY 3 첫 추격: 위쪽 서가 사이(h)에 숨고, 가운데 통로를 지나, 맨 아래 안쪽 기록실(a)에서 출석부 → 사다리(L)로 */
    rows: [
      'TTTTTTTTTTTTTTTTT',
      'TWLWWWWWIWWWWWWGT',
      'T...............T',
      'T.RRRRhRRRhRRRR.T',
      'T...............T',
      'T.RRRRhRRRhRRRR.T',
      'T...............T',
      'TWWWWW.....WWWWWT',
      'T...............T',
      'T.RRhRR.K.RRhRR.T',
      'T...............T',
      'T.RRhRR...RRhRR.T',
      'T.......a.......T',
      'TT.............TT',
      'TTTTTTTTTTTTTTTTT',
    ],
    legend: {
      T: [TB, 2, 0], W: [TB, 1, 0], I: () => G.day >= 6 ? [TB, 11, 1] : [TB, 7, 0], G: () => [TB, 3, G.day >= 7 ? 1 : 0], R: [TB, 8, 0], a: [TB, 9, 0], K: [TB, 6, 0],
      L: [TB, 10, 1], '.': [TB, 0, 1], h: [TB, 0, 1],
    },
    tileText: {
      R: ['철제 서가. 출석부가 끝도 없이 꽂혀 있다.', '등에 적힌 날짜가 전부 3월 13일이다.'],
      I: () => G.day >= 6 ? ['쇠사슬이 풀려 있다. 문 위에 『예배당』.'] : ['쇠사슬로 감긴 철문이다.', '문 위에 작은 글씨로 『예배당』이라고 적혀 있다.'],
      G: () => G.day >= 7 ? ['1층 복도로 이어지는 문이다. 열려 있다.'] : ['1층 복도로 이어지는 계단 위의 문이다.', '이쪽에서도 잠겨 있다.'],
      K: ['커다란 솥이다. 비어 있다.', '안쪽이 아주 깨끗하게 닦여 있다.'],
      W: ['벽이다.'],
    },
    async onEnter() { await basementArrive(); },
    events: [
      { id: 'ladder', x: 2, y: 1, touch: async () => { await basementLadder(); } },
      { id: 'iron', x: 8, y: 1, show: () => G.day >= 6, touch: () => transfer('deepchapel', 9, 14, 'up') },
      { id: 'upDoor', x: 15, y: 1, show: () => G.day >= 7, touch: () => transfer('hall1', 16, 2, 'down') },
      { id: 'att', x: 8, y: 12, action: async () => { await attendanceBook(); } },
      { id: 'momoB', x: 3, y: 2, sprite: 'momo', dir: 'left', show: () => G.day === 3 && dflag('basement') && !has('attendance'),
        action: async (e) => { if (!(await momoTagCheck())) await say('momo', '가운데 책상. 출석부 봐.', 0); } },
      { id: 'ianB', x: 9, y: 2, sprite: 'ian', dir: 'left', show: () => dflag('ianB') },
    ],
  },

  cafeteria: {
    name: '급식실',
    rows: [
      'TTTTTTTTTTTTTTTTT',
      'TWNWWMWWWWWNWWWWT',
      'Th[ctc].......FFT',
      'T...............T',
      'T.sssss...sssss.T',
      'T.LLLLL...LLLLL.T',
      'T.sssss...sssss.T',
      'T.sssss...sssss.T',
      'T.LLLLL...LLLLL.T',
      'T.sssss...sssss.T',
      'T...............T',
      'TTTT.........TTTT',
      'TTTTTTTTXTTTTTTTT',
    ],
    legend: {
      T: [TF, 2, 0], W: [TF, 1, 0], N: [TF, 3, 0], M: [TF, 8, 0], c: [TF, 13, 0], '[': [TF, 12, 0], ']': [TF, 14, 0],
      t: () => [TF, has('ticket') ? 13 : 15, 0], F: [TF, 7, 0], h: () => [TF, G.day >= 3 && flag('hatch') ? 10 : 0, 1], s: [TF, 0, 1], L: [TF, 4, 0], '.': [TF, 0, 1], X: [TF, 9, 1],
    },
    tileText: {
      M: ['오늘의 메뉴: 고기 스튜, 흰 빵, 우유.', '어제의 메뉴: 고기 스튜, 흰 빵, 우유.', '내일의 메뉴: 고기 스튜, 흰 빵, 우유.'],
      '[': ['배식대 끝이다. 국자가 가지런히 걸려 있다.'],
      ']': ['식판이 쌓여 있다. 두 개씩 짝지어 포개져 있다.'],
      c: () => G.vars.memory >= 50 ? ['배식대다. 스튜 냄새가 난다.', '……어디서 맡아 본 냄새다.'] : ['배식대다. 스튜 냄새가 난다.', '……속이 울렁거린다.'],
      F: ['냉장고다. 열리지 않는다.', '안에서 웅— 하는 소리가 난다.'],
      L: ['긴 식탁이다. 수저가 정확히 짝수로 놓여 있다.'],
      N: ['창밖으로 산이 보인다.'],
    },
    onLoad() {
      if (G.day >= 7 && !dflag('final')) { player.x = 4; player.y = 6; player.dir = 'up'; dflag('finalSeat', true); return; }
      if (G.phase === 1 && !dflag('lunchStarted')) {
        dflag('lunchStarted', true);
        player.x = 4; player.y = 6; player.dir = 'up';
      }
    },
    async onEnter() {
      if (G.day >= 7) { if (!dflag('final')) await finalTable(); return; }
      if (visLunch() && !dflag('lunch')) { if (G.day === 1) await branch('d1_lunch', lunchScene); else if (G.day === 4) await branch('d4_meal', lunchDay); else await branch(`d${G.day}_lunch`, lunchChoice); }
    },
    events: [
      { id: 'exit', x: 8, y: 12, touch: async () => { if (await day2AfterLunch()) return; await transfer('hall1', 6, 2, 'down'); } },
      { id: 'ticket', x: 4, y: 2, action: async () => { await ticketScene(); } },
      { id: 'hatch', x: 1, y: 2, show: () => G.day >= 3 && flag('hatch') && (G.day === 6 ? dflag('basement') : true), touch: () => transfer('basement', 2, 2, 'down') },
      { id: 'fridge1', x: 14, y: 2, action: async () => { await fridge(); } },
      { id: 'fridge2', x: 15, y: 2, action: async () => { await fridge(); } },
      { id: 'momoK', x: 2, y: 3, sprite: 'momo', dir: 'down', show: () => ((G.day === 3 && G.phase === 2 && !has('attendance')) || (G.day === 6 && G.phase === 2)) && !dflag('basement'),
        action: async (e) => { if (G.day === 6) await momoDeepInvite(e); else await branch('d3_momo', () => momoBasementInvite(e)); } },
      { id: 'momoUp', x: 1, y: 4, sprite: 'momo', dir: 'up', show: () => dflag('momoUp') },
      { id: 'momoCorner', x: 15, y: 10, sprite: 'momo', dir: 'left', show: () => G.day === 2 && visLunch(), action: async (e) => { await momoMeal(e); e.dir = 'left'; } },
      { id: 'teacherK', x: 8, y: 3, sprite: 'teacher', dir: 'down', show: () => dflag('mealTeacher') },
      { id: 'yuriF', x: 4, y: 4, sprite: 'yuri', dir: 'down', keep7: true, show: () => G.day >= 7 && dflag('finalSeat'),
        action: async () => { await finalChoice(); } },
      {
        id: 'yuriL', x: 4, y: 4, sprite: 'yuri', dir: 'down', show: visLunch,
        action: async (e) => {
          if (G.day === 1 && !has('ticket')) await say('yuri', '배식대 옆에 식권이 있던데.', 0);
          else await say('yuri', '천천히 먹어.', 0);
          e.dir = 'down';
        },
      },
      npc('l1', 2, 4, 'student_1', 'down', visLunch, [[S, '오늘도 맛있다.']]),
      npc('l2', 6, 4, 'student_3', 'down', visLunch, [[S, '남기면 안 돼. 전학생.']]),
      npc('l3', 3, 6, 'student_2', 'up', visLunch, [[S, '……'], ['think', '(스튜를 한 숟가락씩, 같은 속도로 먹고 있다.)']]),
      npc('l4', 5, 6, 'student_4', 'up', visLunch, [[S, '유리는 맨날 도시락 두 개 싸 와. 맨날.']]),
      npc('l5', 11, 4, 'student_2', 'down', visLunch, [[S, '맛있다.']]),
      npc('l6', 13, 4, 'student_1', 'down', visLunch, [[S, '맛있다.']]),
      npc('l7', 12, 6, 'student_3', 'up', visLunch, [[S, '맛있다.']]),
      npc('l8', 13, 7, 'student_2', 'down', visLunch, [[S, '맛있다. 맛있다.']]),
      npc('l9', 11, 9, 'student_4', 'up', visLunch, [[S, '전학생은 아직 모르는구나. 이게 얼마나 맛있는지.']]),
    ],
  },

  dorm: {
    name: '기숙사',
    rows: [
      'TTTTTTTTTTTTT',
      'TWWNWWWWWNWWT',
      'T.b.......b.T',
      'T.f.......fkT',
      'T....RRR....T',
      'T...........T',
      'Tq.........pT',
      'TT.........TT',
      'TTTTTTXTTTTTT',
    ],
    legend: {
      T: [TC, 2, 0], W: [TC, 1, 0], N: [TC, 3, 0], b: [TC, 15, 0], f: [TC, 31, 0], R: [TC, 17, 1], q: [TC, 19, 0], k: [TC, 23, 0],
      p: [TC, 20, 0], '.': [TC, 16, 1], X: [TC, 21, 1],
    },
    tileText: {
      N: ['창밖이 깜깜하다. 별이 하나도 없다.'],
      p: ['조화다.'],
    },
    async onEnter() {
      if (once('dormFirst')) { await narr('2인실이다. 맞은편 침대는 비어 있는데, 시트가 조금 따뜻하다.'); return; }
      if (G.phase < 3 || dflag('dormEnter')) { if (G.day >= 7 && once('d7_dorm')) await narr('침대 둘과, 정리된 물컵 두 개. 유리의 리본은 없다.'); return; }
      dflag('dormEnter', true);
      if (G.day === 2) await narr('맞은편 침대는 비었지만 이불이 정리되어 있고, 물컵 두 개가 놓여 있다. 한 컵만 물이 반쯤 남아 있다.');
      else if (G.day === 3) await dormNight3();
      else if (G.day === 6) await dormNight6();
    },
    events: [
      { id: 'exit', x: 6, y: 8, touch: () => transfer('hall1', 18, 2, 'down') },
      { id: 'bed', x: 2, y: 2, action: async () => { await sleepScene(); } },
      { id: 'bedF', x: 2, y: 3, action: async () => { await sleepScene(); } },
      { id: 'yuriBed', x: 10, y: 2, pose: { sheet: 'yuri_pose', row: 2 }, block: false, show: () => G.day >= 3 && G.day <= 6 && G.phase >= 3 },
      { id: 'yuriRead', x: 9, y: 3, sprite: 'yuri', dir: 'left', show: () => false },
      { id: 'drawer', x: 11, y: 3, action: async () => { await yuriDrawer(); } },
      {
        id: 'bed2', x: 10, y: 2,
        action: async () => {
          if (G.day >= 3 && G.day <= 6 && G.phase >= 3) { await yuriBedTalk(); return; }
          if (G.day >= 7) { await narr('정리된 침대다.'); return; }
          if (G.day === 2) { await narr('비어 있다. 이불이 정리되어 있다.'); return; }
          if (count('bed2') === 1) await narr('비어 있는 침대다. 시트가 조금 따뜻하다.');
          else await narr('이불이 접혀 있다.');
        },
      },
      { id: 'bed2F', x: 10, y: 3, action: async () => { await ev('bed2').action(); } },
      {
        id: 'mirror', x: 1, y: 6,
        action: async () => {
          if (!flag('mirrorUp')) {
            await narr('책상 위에 거울이 엎어져 있다.');
            const c = await ask(['거울을 세운다', '그대로 둔다']);
            if (c !== 0) return;
            flag('mirrorUp', true);
            await narr('평범하게 비친다. 뒤편에 학교 자산 표식이 붙어 있다.');
            return;
          }
          if (G.day >= 3) { await mirrorSignal(); return; }
          await narr('평범하게 비친다.');
        },
      },
    ],
  },
};

/* ================================================================= 프롤로그 · DAY 1 — 인사 (대본 v3.0 P-01 ~ D1-10) */
const STORY = {
  async start() {
    recordDayStart(1);
    loadMap('classroom');
    player.x = 10; player.y = 10; player.dir = 'up';
    const y = ev('yuri'); y.x = 11; y.y = 10; y.dir = 'left';
    UI.fade = 1;
    await black(['……', '누군가 내 이름을 부르고 있다.', '아주 가까이서. 귀에 숨이 닿을 만큼.']);
    bgm('title');
    UI.cg = cgPick('cg_prologue'); UI.cgAlpha = UI.cg ? 1 : 0;
    await fadeIn(900);
    await say('yuri', '{N}. 일어났어?', 0);
    await say('hero', '……으. 여기 어디야?', 5);
    await say('yuri', '어디긴. 학교지.', 0);
    await say('hero', '학교……?', 3);
    await say('yuri', '응.', 0);
    await say('yuri', '……이번에는 처음이구나.', 5);
    await cgOff(800);
    applyAmbience();
    heroPose(null); player.dir = 'right';
    await think('(이번에는?)');
    await think('(그보다, 내 이름은 어떻게 알지?)');
    await say('yuri', '곧 조회 시작해. 네 자리는 창가에서 두 번째야. 앉아 있어.', 0);
    await move(y, 'Ru');
    player.dir = 'up';
    await homeroom();
  },
  // 이어 하기: 하루가 끝나고 다음 날 아침으로 넘어가는 중에 저장됐다면 그 날을 처음부터 시작
  async resume() {
    if (STARTERS[G.flags.startDay]) { await STARTERS[G.flags.startDay](); return true; }
    return false;
  },
};

async function homeroom() {
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '오늘은 우리 반에 새 친구가 왔어요. 자, 일어나서 인사해 볼까요?', 0);
  const c = await ask(['안녕. 나는 {N|이야|야}. 잘 부탁해.', '……']);
  if (c === 0) await say('hero', '안녕. 나는 {N|이야|야}. 잘 부탁해.', 0);
  else {
    await say('hero', '……', 5);
    await say('teacher', '어머, 부끄러운가 봐요. 괜찮아요. 이 친구는 {N|이에요|예요}. 다들 잘해 주세요.', 0);
  }
  await say('all', '어서 와, {N}.', null);
  await think('(열 명이 넘는 목소리가 한 사람처럼 겹쳤다.)');
  await say('teacher', '우리 학교에서 제일 중요한 건 딱 하나예요. 서로를 사랑하는 것.', 0);
  await say('teacher', '우리는 모두 서로를 사랑하고 있단다. 그렇죠?', 1);
  await say('all', '네.', null);
  await say('teacher', '그럼 출석 부를게요. 이안.', 0);
  await say('ian', '네.', 0);
  await say('teacher', '모모.', 0);
  await say('momo', '……', 0);
  await think('(대답이 없는데, 선생님은 웃으며 넘어갔다.)');
  await say('teacher', '유리.', 0);
  await say('yuri', '네에.', 1);
  await say('teacher', '{N}.', 0);
  await say('hero', '네.', 0);
  await say('teacher', '{N}.', 0);
  await say('hero', '……네? 저 대답했는데요.', 3);
  await say('teacher', '{N}.', 1);
  await say('teacher', '{N}. {N}.', 1);
  await say('yuri', '선생님. 대답했어요.', 3);
  await say('teacher', '……어머, 그랬나요? 그럼 다 왔네요. 오늘도 한 사람도 빠짐없이.', 0);
  await teacherOut();
  const y = ev('yuri');
  y.dir = 'left';
  await say('yuri', '처음 보는 얼굴이네. 전학생이지?', 0);
  await think('(……아까 나를 깨울 때는 처음이 아닌 것처럼 굴었으면서.)');
  await say('yuri', '나는 유리야. 네 옆자리. 앞으로도 계속.', 1);
  const ian = ev('ian');
  await move(ian, 'RDDDDDRRRRRu');
  player.dir = 'down';
  await say('ian', '반가워. 학생회장 이안이야.', 1);
  await say('ian', '우리 학교엔 규칙이 세 개 있어. 이것만 지키면 별일 없을 거야.', 0);
  await say('ian', '하나, 식사는 남기지 않는다.', 0);
  await say('ian', '둘, 밤에는 기숙사 밖으로 나가지 않는다.', 0);
  await say('ian', '셋, 지하실에는 내려가지 않는다.', 0);
  await say('ian', '그리고 이건 학교 지도야. 내가 그린 거라 좀 엉성하지만.', 1);
  give('map');
  await say('ian', '다들 처음엔 길을 잃더라.', 0);
  await say('ian', '……처음엔.', 2);
  await think('(이안은 그 말을 하고 나서 수첩에 뭔가를 적었다.)');
  await move(ian, 'LLLLLUUUUULu');
  await think('(창가 자리 아이는 끝까지 이쪽을 보지 않았다.)');
  player.dir = 'right';
  await say('yuri', '점심은 1층 급식실. 먼저 가서 자리 맡아 둘게.', 0);
  await say('yuri', '같이 먹자. 꼭이야.', 1, { alt: '같이 먹자. 너를.' });
  await move(y, 'RUUUUUUUURRU');
  y.hidden = true;
  player.dir = 'up';
  setPhase(1);
  banner('DAY 1', '인사');
  await wait(1200);
  objective('1층 급식실로 가자');
}

/* D1-07 교리책 — 도입부는 생활 예절처럼 읽힌다. 식인을 직접 말하지 않는다. */
const DOCTRINE_DOC = { type: 'book', pages: [
  { left: ['', '', '#사랑하는 사람을 위한', '#식사 예절', '', '', '~일체회(一體會) 엮음'],
    right: ['#제1장 · 인사', '사랑하는 이의 이름을 부르십시오.', '이름을 부르는 것은 그 사람을', '기억하는 일이며, 사랑의 시작입니다.', '',
      '#제2장 · 나눔', '사랑하는 이와 한 식탁에 앉으십시오.', '내 몫과 네 몫을 가르지 마십시오.', '사랑하는 사이에 따로 남겨 둘 것은', '없습니다.'],
    lh: 31 },
  { left: ['#제3장 · 동침', '사랑하는 이와 같은 꿈을 꾸십시오.', '눈을 감고 잠든 뒤에도', '서로를 잊지 마십시오.', '꿈속에서도 둘은 함께여야 합니다.', '',
      '#제4장 · 섭취', '사랑하는 이가 남긴 것을', '기꺼이 받아들이십시오.', '좋아하는 것만 골라서는', '온전히 사랑할 수 없습니다.', '남긴 것까지 모두 당신의 몫입니다.'],
    right: ['', '', '', '~(여기서부터 종이가', '~손끝에 달라붙는다)'],
    lh: 29, stick: true },
  { hush: true, stick: true,
    left: ['#마지막 장 · 합일', '', '!사랑하는 이를', '!남김없이 받아들이십시오.', '', '!그의 살과 기억과 이름까지.', '',
      '!마침내 둘을 구별할 수', '!없게 되었을 때,', '!비로소 사랑은 완성됩니다.'],
    right: [] },
] };
async function readDoctrineBook() {
  if (flag('book')) {
    if (G.day >= 2 && once('bookReread')) {
      await narr('다시 펼쳐 본다. 어제는 못 본 게 있다. 여백마다 연필 밑줄이 그어져 있다.');
      await narr('마지막 장에만 밑줄이 몇 겹이나 패여 있다. 종이가 일어날 만큼.');
      await narr('그 옆에 작은 글씨. 『이번엔 꼭.』');
      gain('cult_truth', 5);
    } else await narr('『사랑하는 사람을 위한 식사 예절』. 마지막 장은 다시 펼치고 싶지 않다.');
    return;
  }
  await narr('열람 책상 위에 책이 한 권 펼쳐져 있다. 누가 읽다 만 것처럼.');
  await doc(DOCTRINE_DOC);
  applyAmbience();
  await narr('뒷표지에 둥근 문장이 찍혀 있다. 『일체회(一體會)』.');
  await think('(……설마. 비유겠지.)');
  flag('book', true); give('doctrine'); gain('cult_truth', 10);
  if (G.day === 1 && G.phase === 2) objective('교실의 유리에게 가자');
}

/* D1-04 빈 책상 (선택, 기억 +4) / D2-04 낡은 머리끈 (필수, 기억 +10) */
async function emptyDesk() {
  if (!flag('desk')) {
    await narr('아무도 안 앉는 책상이다. 의자만 반듯하게 집어넣어져 있다.');
    await narr('책상 안쪽에 칼끝으로 파 놓은 글씨가 있다.');
    await narr('『{N}』');
    await think('(……내 글씨다. 여기 오늘 처음 왔는데.)');
    flag('desk', true); gain('memory', 4);
    if (G.day < 2) return;
  }
  if (G.day >= 2 && !has('ribbon')) {
    await narr('서랍 안쪽 깊숙이 무언가 걸려 있다.');
    await narr('빛바랜 빨간 리본이다. 군데군데 해져 있다.');
    give('ribbon');
    await wait(300);
    await memory(cgPick('cg_mem_ribbon'), async () => {
      await say('yuri', '이거 묶어 줄래?', 0);
      await say('hero', '혼자 못 묶어?', 3);
      await say('yuri', '혼자서도 묶을 수 있지. 그래도 네가 묶어 주는 게 더 좋아.', 1);
      await say('yuri', '……고마워.', 0);
      await say('yuri', '역시 난 네가 있어야 하나 봐.', 1);
    });
    gain('memory', 10);
    await think('(내 기억인가? 유리의 머리카락 냄새까지 생각난다.)');
    await think('(그렇게 가까이 있었던 적이, 있었나.)');
    afterSchoolHint();
    return;
  }
  await narr('내 이름이 새겨져 있다. 모서리가 닳을 만큼 오래된 자국이다.');
}

/* 회상 공통 — 세피아 + 회상 CG */
async function memory(cgName, body) {
  await fadeOut(500);
  sepia(true); bgm('title');
  UI.cg = cgName; UI.cgAlpha = 1;
  await fadeIn(700);
  await body();
  await fadeOut(600);
  UI.cg = null; UI.cgAlpha = 0; sepia(false);
  applyAmbience();
  await fadeIn(600);
}
/* 있는 그림만 쓴다 (v3.0의 새 CG 이름 → 없으면 예전 CG) */
function cgPick(...names) { for (const n of names) if (n && IMG[cgKey(n)]) return n; return null; }
async function cgShow(names, ms = 900) { const n = cgPick(...names); if (n) await cg(n, ms); return n; }


/* D1-06 두 개의 식권 / 첫 회상 */
async function ticketScene() {
  if (has('ticket') || G.day >= 2) { await narr('배식대다. 스튜 냄새가 배어 있다.'); return; }
  if (!dflag('lunch')) { await narr('배식대다.'); return; }
  await narr('식권 두 장이 가지런히 겹쳐 있다.');
  await narr('한 장에는 내 이름, 다른 한 장에는 유리의 이름.');
  await narr('……두 이름의 글씨가 똑같다.');
  give('ticket');
  await memory('cg_mem_ticket', async () => {
    await say('yuri', '식권이 한 장 남았는데. 같이 먹을래?', 0);
    await say('hero', '나랑? 우리 얘기도 처음 해 보는데.', 3);
    await say('yuri', '응. 너여야 해.', 0);
    await say('hero', '……그래, 뭐. 좋아.', 0);
    await say('yuri', '앞으로도 같이 먹자. 매일.', 1);
    await say('yuri', '이제 다른 데서 먹으면 안 돼. 알았지?', 5);
  });
  gain('memory', 10);
  await think('(방금 그건…… 누구 기억이지?)');
  await say('yuri', '고마워. 덕분에 금방 찾았네.', 1);
  await say('yuri', '방과 후에 할 얘기 있어. 교실에서 기다릴게.', 0);
  await say('yuri', '아, 그 전에 도서관에 들러 봐. 학교에 대해 궁금한 게 있으면 거기서 찾아볼 수 있을 거야.', 0);
  await afternoon(['오후 수업이 끝났다.', '무슨 수업이었는지 하나도 기억나지 않는다.'], 'hall2', 4, 2);
  objective(flag('book') ? '교실의 유리에게 가자' : '도서관에 들렀다가 교실의 유리에게');
}

async function afternoon(lines, map, x, y) {
  await fadeOut(800);
  await black(lines);
  G.phase = 2;
  await transfer(map, x, y, 'down', { fade: false });
  await fadeIn(800);
  setPhase(2);
}

async function yuriClassroom(e) {
  const f = YURI_TALK[G.day];
  if (f) await f(e); else e.dir = 'up';
}

/* D1-09 방과 후 유리 / 하나가 된다는 것 */
async function yuriTalk1(e) {
  if (G.phase >= 3) {
    await say('yuri', '아직 안 잤어?', 0);
    await say('yuri', '얼른 자. 내일 아침에 깨우러 갈게. 매일 그랬던 것처럼.', 1);
    e.dir = 'up'; return;
  }
  if (!flag('book')) {
    await say('yuri', '도서관은? 아직 안 갔구나.', 0);
    await say('yuri', '다녀와. 기다릴게. 기다리는 건 자신 있거든.', 1);
    e.dir = 'up'; return;
  }
  await say('yuri', '왔네.', 1);
  await say('yuri', '그 책, 읽었어?', 0);
  const c = await ask(['좀 이상한 책이던데', '……']);
  if (c === 0) { await say('hero', '좀 이상한 책이던데.', 3); await say('yuri', '이상해? 어째서?', 0); }
  else await say('yuri', '말 안 해도 알아. 마지막 장까지 읽었구나. 얼굴에 다 쓰여 있어.', 1);
  await say('yuri', '마지막 장 있잖아. 사랑하는 이를 남김없이 받아들이라고 했잖아.', 0);
  await say('yuri', '난 그 말이 제일 좋아. 확실하잖아.', 1);
  await say('yuri', '네가 남긴 것까지 전부 내 몫이 되는 거니까.', 5);
  await think('(유리는 그 말을 아주 행복한 얼굴로 했다.)');
  await say('yuri', '있잖아, {N}. 이 학교 어때? 마음에 들어?', 0);
  const d = await ask(['아직 잘 모르겠어', '다들 친절하던데']);
  if (d === 0) { await say('hero', '아직 잘 모르겠어.', 3); await say('yuri', '괜찮아. 금방 좋아질 거야. 매번 그랬어.', 0); }
  else { await say('hero', '다들 친절하던데.', 0); await say('yuri', '그치? 다들 착해. ……착하게 굴지.', 5); }
  await say('yuri', '내일도 같이 먹자.', 1);
  await say('hero', '어, 그래.', 0);
  await say('yuri', '약속했다?', 1);
  await say('yuri', '이번엔 잊어버리면 안 돼.', 5);
  await think('(……이번엔?)');
  await say('yuri', '기숙사는 1층 복도 끝이야. 밤엔 나오면 안 돼. 규칙이거든.', 0);
  await say('yuri', '잘 자. 내일 봐. ……내일 아침에.', 0);
  e.dir = 'up';
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* 암전 중에 CG를 잠깐 띄웠다가 다시 암전 (그림이 없으면 건너뜀) */
async function cgFlash(name, hold = 1600) {
  const n = cgPick(name); if (!n) return;
  UI.cg = n; UI.cgAlpha = 1;
  await fadeIn(900); await wait(hold); await fadeOut(900);
  UI.cg = null; UI.cgAlpha = 0;
}

/* 기숙사 침대 — 잠들면 의식의 다음 단계로 재구성된다 */
async function sleepScene() {
  if (G.phase < 3) { await narr('내 침대다. 아직 잘 시간은 아니다.'); return; }
  const c = await ask(['잔다', '아직'], '잘까?');
  if (c !== 0) return;
  bgm(null);
  await fadeOut(1400);
  await wait(400);
  const d = G.day;
  if (d === 1) {
    await black(['꿈을 꾼다.', '긴 식탁 맞은편에 누군가 앉아 있다.', '달그락.', '숟가락이 접시를 긁는 소리.', '달그락. 달그락.', '아주 천천히. 바닥에 묻은 것까지 긁어 먹으려는 것처럼.']);
    await cgFlash('cg_day1_dream', 1800);
    await black(['"맛있어?"', '대답하려고 했는데,', '입이 어디 있는지 모르겠다.']);
  } else if (d === 2) {
    await cgFlash('cg_day2_bed', 1600);
    await black(['꿈을 꾼다.', '침대가 두 개 있다.', '한쪽 침대에 내가 누워 있다.', '다른 쪽 침대에도,', '……내가 누워 있다.']);
    await black(['"아직도 모르겠어?"', '내 목소리였다.', '……아니, 유리의 목소리였다.']);
  } else if (d === 3) {
    await think('(눈을 떴다. 한밤중이다.)');
    const shown = await cgShow(['cg_day3_yuri_awake'], 900);
    await say('yuri', '깼어?', 0);
    await say('yuri', '자는 거 보고 있었어.', 5);
    await say('hero', '……너는 안 자?', 2);
    await say('yuri', '응. 교리 3장. 사랑하는 이와 같은 꿈을 꾸라고 했잖아. 네가 먼저 잠들면 나도 따라갈 수 있어.', 0);
    await say('yuri', '그러니까 다시 자. 내가 볼게.', 5);
    const a = await ask(['……좀 무서운데', '……그럼 계속 봐']);
    if (a === 0) {
      await say('hero', '……좀 무서운데.', 2);
      await say('yuri', '괜찮아. 무서워하지마.', 0);
      await say('yuri', '눈 감고 있으면 금방 끝나.', 5);
    } else {
      await say('hero', '……그럼 계속 봐.', 5);
      await say('yuri', '응. 원래 그럴 생각이었어.', 1);
      await think('(어둠 속인데도 유리의 얼굴이 빨개지는 게 보였다. 불은 꺼져 있는데.)');
      gain('yuri_sync', 5);
    }
    if (shown) await cgOff(700);
    await black(['꿈을 꾼다.', '긴 식탁이다. 흰 접시가 끝없이 놓여 있다.', '접시는 전부 비어 있다.', '식탁에 앉은 모두가 나를 보고 있다.']);
    await black(['"내일은 특별한 식사야."', '이안의 목소리였다.']);
  } else if (d === 4) {
    await black(['꿈을 꾼다.', '누군가 내 이름을 부른다. 내 목소리로.', '대답하려는데, 유리가 먼저 대답한다.', '"응."']);
  } else if (d === 5) {
    await black(['꿈을 꾼다.', '편지를 쓰고 있다.', '……네가 나를 잊는 것보다,', '쓰다 말고 펜을 내려놓는다. 펜을 쥐고 있던 손이 내 손이 아니다.']);
  } else if (d === 6) {
    await black(['꿈을 꾸지 않는다.', '대신 밤새 식탁 차리는 소리가 들린다.', '접시 두 개. 숟가락 두 개.']);
  } else await black(['불을 끈다.']);
  await wait(500);
  const next = d + 1;
  recordDayEnd(d);
  G.day = next; G.phase = 0; G.objective = ''; G.flags.startDay = next;
  saveGame(); recordDayStart(next);
  await STARTERS[next]();
}

/* ================================================================= DAY 2 — 나눔 (D2-01 ~ D2-08) */
async function startDay2() {
  const y = await wakeInClassroom(['……', '또 누군가 내 이름을 부른다.', '어제와 같은 목소리, 같은 거리.'], true);
  await say('yuri', '{N}. 일어났어?', 0);
  await say('hero', '……어? 나 분명 기숙사에서 잤는데.', 1);
  await say('yuri', '응. 가끔 그래.', 0);
  await say('yuri', '교리 1장. 사랑하는 이의 이름을 부르래. 매일 불러 주면 잊지 않겠지?', 0);
  await say('yuri', '……내가 아니라, 네가.', 5);
  heroPose(null);
  await move(y, 'Ru'); player.dir = 'up';
  await think('(시계는 오늘도 8시 13분이다. 날짜도 3월 13일로 동일하다.)');
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '{N}, 우리 학교에서 처음 자 본 소감은 어때요?', 0);
  const c = await ask(['……이상한 꿈을 꿨어요.', '괜찮았어요.']);
  if (c === 0) {
    await say('hero', '……이상한 꿈을 꿨어요.', 2);
    await say('teacher', '어머, 잘됐네요!', 1);
    await say('teacher', '조금만 있으면 모두랑 같은 꿈을 꾸게 될 거예요.', 1);
  } else {
    await say('hero', '괜찮았어요.', 0);
    await say('teacher', '다행이에요. 다들 첫 일주일이 제일 힘들거든요. 그다음부터는 금방이에요.', 0);
  }
  await say('all', '하하하.', null);
  await think('(다 같이 웃었다. 웃음이 끊기는 순간까지 똑같이.)');
  await say('teacher', '우리는 모두 서로를 사랑하고 있단다.', 1, { alt: '우리는 모두 서로를 먹고 있단다.' });
  await say('teacher', '1교시는 예배당에서 말씀 시간이에요. 다 같이 내려가요.', 0);
  await teacherOut();
  y.dir = 'left'; player.dir = 'right';
  await say('yuri', '잘 잤어? ……아, 못 잤구나.', 0);
  await say('hero', '어떻게 알아?', 3);
  await say('yuri', '……그냥, 잠을 설친 것 같아서.', 5);
  await say('yuri', '아, 내가 잘못 짚었나 봐. 신경 쓰지 마.', 1);
  await think('(유리는 가끔, 아직 일어나지 않은 일을 이미 지나간 일처럼 말한다.)');
  const ian = ev('ian');
  await move(ian, 'RDDDDDRRRRRu'); player.dir = 'down';
  await narr('이안이 수첩을 들여다보고 있다. 눈이 마주치자, 페이지를 몇 장 되넘긴다.');
  await say('ian', '좀 적응됐어? 규칙은 어제 내가 설명했을 거고……', 0);
  await say('ian', '……응, 했다고 적혀 있네.', 2);
  await say('ian', '요즘은 적어 두지 않으면 하루만 지나도 기억이 흐려지거든.', 0);
  await think('(이안의 왼손 손바닥에 볼펜 글씨가 번져 있다. ……내 이름이다.)');
  const d = await ask(['손에 쓴 거, 내 이름이야?', '모른 척한다']);
  if (d === 0) {
    await say('hero', '손에 쓴 거, 내 이름이야?', 3);
    await say('ian', '아. ……봤구나. 씻어도 잘 안 지워지더라.', 3);
    await say('ian', '수첩은 누가 가져갈 수도 있잖아. 손은 못 가져가니까.', 0);
    await say('ian', '웃기지. 회장이란 사람이 전학생 이름을 손바닥에 적고 다니는 거.', 1);
    await say('ian', "비밀로 해 줘. 그것도 적어 둘게. '전학생은 비밀을 지켜 줌.'", 1);
    sfx('tick');
    await think('(딸깍. 만년필 뚜껑 닫히는 소리가 났다.)');
  } else {
    await think('(못 본 척했다. 이안은 왼손을 슬쩍 주머니에 넣었다.)');
  }
  await move(ian, 'LLLLLUUUUULu');
  await chapelClass();
}

/* D2-02 예배당 수업 / 지워진 선 */
async function chapelClass() {
  await fadeOut(600);
  dflag('inClass', true); dflag('yuriChapel', true);
  await transfer('chapel', 4, 10, 'up', { fade: false });
  await wait(300);
  await fadeIn(800);
  await say('teacher', '자, 말씀 시간이에요. 오늘의 말씀은 『나눔』.', 0);
  await say('teacher', '우리는 사랑하는 사람에게 무엇을 줄 수 있을까요?', 0);
  await say(S, '시간이요!', null);
  await say(S, '마음이요.', null);
  await say(S, '생일 선물요.', null);
  await say(S, '같이 찍은 사진이요.', null);
  await say('teacher', '어머, 다 좋은 대답이네요.', 1);
  await say('teacher', '그런데 정답은 딱 하나란다.', 0);
  await say('teacher', '자기 자신.', 1);
  await say('all', '자기 자신.', null);
  EVENTS.filter(e => e.chapelStudent || e.id === 'ianC').forEach(e => { e.dir = 'down'; });
  ev('yuriC').dir = 'left';
  sfx('thud');
  await narr('모두가 한꺼번에 고개를 돌려 나를 본다.');
  await think('(……모모만 돌아보지 않았다.)');
  await say('teacher', '{N|은|는} 어떻게 생각해요?', 0);
  const c = await ask(['……잘 모르겠어요.', '자기 자신이요.']);
  if (c === 0) {
    await say('hero', '……잘 모르겠어요.', 3);
    await say('teacher', '괜찮아요. 곧 알게 돼요. 다들 그랬거든요.', 0);
  } else {
    await say('hero', '자기 자신이요.', 5);
    await say('teacher', '어머나, 참 잘했어요!', 1);
    await think('(입이 먼저 대답했다. 내가 고른 말이 아닌 것 같다.)');
  }
  EVENTS.filter(e => e.chapelStudent || e.id === 'ianC').forEach(e => { e.dir = 'up'; });
  await say('teacher', '나눔의 끝은 합일이에요. 오늘은 여기까지.', 1);
  if (once('d2_class')) gain('cult_truth', 5);
  await say('yuri', '{N}, 점심 같이 먹어야 해. 약속했잖아.', 0);
  await think('(약속은 어제 했다. 그런데 유리는 어제보다 훨씬 오래된 약속처럼 말한다.)');
  await fadeOut(700);
  dflag('inClass', false); dflag('yuriChapel', false);
  await fadeIn(700);
  player.dir = 'up';
  await think('(방금 앉아 있던 자리, 찬송가 사이에 뭔가 끼워져 있다.)');
  delete G.flags.startDay;
  setPhase(1);
  banner('DAY 2', '나눔');
  await wait(1200);
  objective('점심시간 — 급식실로');
}

/* D2-03 찬송가 사이 / 찢어진 편지 */
const TORN_LETTER_DOC = { type: 'paper', torn: true, title: '', lines: [
  '네가 무슨 생각을 하는지 알고 싶었어.', '말로 듣는 거랑 아는 건 다르니까.', '그래서 나는,', '!네가 나였으면 좋겠어.', '그러면 우리는'] };
async function hymnalLetter() {
  if (G.day < 2 || has('torn_letter')) { await narr('찬송가가 꽂혀 있다. 수록된 곡 제목이 전부 『하나』다.'); return; }
  await narr('찬송가 사이에 접힌 종이가 끼워져 있다. 반쯤 찢겨 나간 편지다.');
  await doc(TORN_LETTER_DOC);
  give('torn_letter');
  await memory('cg_mem_letter', async () => {
    await say('yuri', '가끔 네가 무슨 생각을 하는지 궁금해.', 0);
    await say('hero', '물어보면 되잖아. 말해 줄게.', 0);
    await say('yuri', '그건 네가 말해 주는 것뿐이잖아. 말하지 않는 생각도 알고 싶은데.', 3);
    await say('hero', '그럼 어쩌려고?', 3);
    await say('yuri', '네가 나였으면 좋겠어. 그러면 말하지 않아도 알 수 있잖아.', 5);
  });
  gain('memory', 10);
  await think('(나머지는 찢겨 나갔다. 누가 누구에게 쓴 편지인지 알 수 없다.)');
  afterSchoolHint();
}

async function chapelAltar() {
  await narr('제단이다.');
  if (G.day < 2 || dflag('inClass')) return;
  await narr('신의 이름이 있어야 할 자리에 단어 하나가 새겨져 있다.');
  await narr('『우리』');
  if (once('altar')) { await think('(우리. 누구와 누구를 말하는 걸까.)'); gain('cult_truth', 10); }
}

/* D2-06 화장실 거울 — 대사 없이, 거울 속 어깨가 아주 짧게 늦는다. memory 80 이상이면 정상 */
async function restroomMirror() {
  if (G.day === 5) {
    await narr('거울 속에 내가 서 있다. 교복색이 지금과 다르다.');
    await think('(……예전의 나다.)');
    await narr('거울 속의 내가 입모양으로 말한다. 『늦었네.』');
    if (!flag('mirrorDelay') && once('mirror5')) gain('memory', 4);
    return;
  }
  if (flag('mirrorDelay')) { await mirrorSignal(); return; }
  await narr('세면대 거울이다. 거울 속의 내가 나를 보고 있다.');
  if (G.day < 2) return;
  const c = await ask(['고개를 돌려 본다', '그만 본다']);
  if (c !== 0) return;
  await narr('고개를 왼쪽으로 돌렸다.');
  await wait(500);
  sfx('thud');
  await narr('……거울 속의 내가, 한 박자 늦게 고개를 돌렸다.');
  if (once('opt_mirror')) gain('memory', 4);
  if (once('scareMirror')) {
    await narr('거울 속의 내가 입꼬리를 올린다. 나는 웃지 않았는데.');
    await scare('mirror');
    await think('(……아무도 없다. 거울 속에는 숨을 몰아쉬는 나뿐이다.)');
  }
}

/* A-01 양호실 기록 (DAY 2~5, 날마다 +3) */
const CLINIC = { 2: '원인 불명의 기억 상실', 3: '식사 거부', 4: '타인의 기억을 자신의 것으로 주장함', 5: '환자와 보호자의 이름이 같음' };
async function infirmaryRecord() {
  await narr('환자 기록부가 펼쳐져 있다.');
  const rows = [];
  for (let d = 2; d <= Math.min(5, Math.max(2, G.day)); d++) rows.push(['3월 13일', d === 5 ? `${G.name} (보호자: ${G.name})` : G.name, CLINIC[d], '식사']);
  if (G.day >= 6) rows.push(['3월 13일', '', '', '']);
  await doc({ type: 'ledger', title: '환자 기록부', cols: [['날짜', 100], ['이름', 170], ['증상', 250], ['처치', 70]], rows });
  await narr('날짜 칸이 전부 같다. 처치 칸도 전부 같다.');
  if (G.day >= 3) await think('(뒤쪽을 넘겨 본다. 반 아이들 이름이 한 번씩은 다 있다. ……유리 이름만 없다.)');
  if (G.day >= 6) { await narr('오늘 날짜 줄은 비어 있다. 이름 칸까지.'); return; }
  if (G.day >= 2 && once('clinic_day' + G.day)) {
    if (G.day === 4 && G.phase >= 2) await think('(오늘은 진짜로 여기서 깨어났다.)');
    else if (G.day >= 5) await think('(내가 여기서 깨어난 건 어제 한 번뿐이다. 나머지 줄은 기억에 없다.)');
    else await think('(나는 양호실에 온 적이 없다. 한 번도.)');
    gain('memory', 3);
  }
}

/* A-05 모모의 식사 1단계 (DAY 2, 운동장 / 급식실 구석) */
async function momoMeal(e) {
  if (!dflag('momoMeal')) {
    dflag('momoMeal', true);
    await think('(운동장 구석 벤치에 모모가 앉아 있다. 무릎 위에 도시락통이 열려 있다.)');
    await think('(안은 비어 있다. 모모는 빈 도시락통에서 뭔가를 떠먹는 시늉을 하고 있다.)');
    const a = await ask(['뭐 먹어?', '……']);
    if (a === 0) { await say('hero', '뭐 먹어?', 3); await say('momo', '아무것도. 보면 몰라?', 0); }
    else await say('momo', '……뭐. 할 말 있어?', 1);
    await say('momo', '배 안 고파. 뭘 먹을지는 내가 고르고 싶어서 그래.', 0);
    const b = await ask(['빈 도시락인데?', '옆에 앉아도 돼?']);
    if (b === 0) {
      await say('hero', '빈 도시락인데?', 3);
      await say('momo', '그러니까 고른 거라니까. 아무것도.', 0);
      await say('momo', '여기선 뭘 먹든 결국 다 같은 걸 먹게 돼. 그럴 바엔 안 먹는 게 나아.', 0);
      await say('momo', '이건 내 거야. 빈 거라도.', 1);
    } else {
      await say('hero', '옆에 앉아도 돼?', 0);
      await say('momo', '……여기 아무것도 없는데. 나눠 줄 것도 없고.', 2);
      await say('momo', '……앉든가. 막을 이유도 없으니까.', 0);
      await think('(모모가 벤치 끝으로 한 뼘 비켜 앉았다.)');
      await narr('둘이서 빈 도시락통을 사이에 두고 앉아 있었다. 바람 한 점 불지 않았다.');
      if (once('momoSit2')) gain('momo_trust', 3);
    }
    if (dflag('skipLunch')) {
      await say('momo', '……너, 오늘 점심 안 먹었지.', 1);
      await say('momo', '흥. 괜찮은 선택이야.', 5);
    }
    if (once('momoMeal1')) gain('momo_trust', 5);
  } else await say('momo', '또 왔어? 구경났나.', 0);
  e.dir = 'down';
}

/* 점심 (DAY 2·3·5·6) — 유리 도시락 +10 / 급식 / 먹지 않음 모모 +6. DAY 4는 특별한 식사 */
async function lunchChoice() {
  if (G.day === 2) return lunchScene2();
  if (G.day === 3) return lunchScene3();
  return lunchDay();
}

function afterSchoolHint() {
  if (G.day === 2 && G.phase === 2 && has('ribbon') && has('torn_letter')) objective('교실의 유리에게 가자');
}
/* DAY 2 점심 뒤 → 방과 후 (머리끈·편지를 모두 찾았으면 오후가 지나간다) */
async function day2AfterLunch() {
  if (G.day !== 2 || G.phase !== 1 || !dflag('lunch')) return false;
  await afternoon(['오후 수업이 끝났다.', '선생님은 수업 내내 『나눔』이라는 말만 반복했다.'], 'hall1', 6, 2);
  objective('교실의 유리에게 가자');
  return true;
}

/* D2-07 방과 후 / 유리와 기억 */
async function yuriTalk2(e) {
  if (G.phase >= 3) {
    await say('yuri', '먼저 가 있어. 나도 곧 갈게.', 0);
    await think('(어디로?)');
    e.dir = 'up'; return;
  }
  if (!has('ribbon') || !has('torn_letter')) {
    await say('yuri', '왔네.', 1);
    await say('yuri', '근데 오늘은 아직 덜 기억났구나.', 5);
    if (!has('ribbon')) await say('yuri', '네 책상 열어 봤어? 옆자리 말고, 원래 네 자리.', 0);
    if (!has('torn_letter')) await say('yuri', '예배당에도 두고 온 게 있잖아. 네가 앉아 있던 자리에.', 0);
    e.dir = 'up'; return;
  }
  await say('yuri', '왔네.', 1);
  await say('yuri', '오늘 말씀 어땠어?', 0);
  const c = await ask(['자기 자신을 준다는 거, 좀 이상하지 않아?', '……']);
  if (c === 0) {
    await say('hero', '자기 자신을 준다는 거, 좀 이상하지 않아?', 3);
    await say('yuri', '그래? 난 알 것 같은데. 제일 큰 걸 주는 거잖아.', 0);
  } else await say('yuri', '대답 안 해도 돼. 어제도 그랬어.', 0);
  await say('yuri', '그 편지, 읽었구나.', 0);
  await say('yuri', '그땐 몰랐어. 말로 듣는 거랑 직접 겪는 게 그렇게 다른 줄은.', 2);
  await say('hero', '그때라니?', 3);
  await say('yuri', '음, 아무것도 아니야.', 1);
  await say('yuri', '리본도 찾았네. 그거 내 거야.', 0);
  await say('yuri', '……아니, 네 거였나.', 3);
  await say('yuri', '음. 우리 거로 하자.', 1);
  await say('yuri', '있잖아, {N}. 나는 너한테 뭘 줄 수 있을까?', 0);
  const d = await ask(['같이 밥 먹어 주면 돼', '아무것도 안 줘도 돼']);
  if (d === 0) {
    await say('hero', '같이 밥 먹어 주면 돼.', 0);
    await say('yuri', '에이, 그건 이미 하고 있잖아.', 1);
    await say('yuri', '나는 그것보다 더 주고 싶어. 오늘 선생님이 그랬잖아. 제일 큰 건 자기 자신이라고.', 5);
  } else {
    await say('hero', '아무것도 안 줘도 돼.', 0);
    await say('yuri', '……', 3);
    await say('yuri', '그 말, 전에도 들었어. 그때도 안 믿었어.', 5);
  }
  await say('yuri', '오늘 밤엔 꿈을 꿀 거야.', 0);
  await say('yuri', '무서우면 옆 침대 봐. 나 거기 있을게.', 1);
  await think('(기숙사 방에는 침대가 두 개다. 어제 옆 침대는 비어 있었다.)');
  e.dir = 'up';
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* ================================================================= DAY 3 — 동침 (D3-00 ~ D3-11) */
async function startDay3() {
  G.day = 3; G.phase = 0; G.objective = '';
  sepia(false);
  loadMap('classroom');
  player.x = 10; player.y = 10; player.dir = 'up';
  UI.fade = 1;
  bgm('night');
  await black(['꿈을 꾼다.', '어젯밤과 같은 꿈이다. 오늘은 더 선명하다.']);
  UI.cg = cgPick('cg_day3_dream'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1200);
  await narr('침대가 두 개. 한쪽에는 내가, 다른 쪽에는 유리가 누워 있다.');
  await narr('유리가 고개를 돌린다. 그 얼굴이, 내 얼굴과 똑같다.');
  await say('yuri', '아직도 모르는구나.', 5);
  await say('hero', '뭐를?', 3);
  await say('yuri', '너는 이미 내 안에 있는데.', 0);
  await narr('유리가 침대 사이로 손을 내민다. 내 손과 똑같이 생긴 손이다.');
  const c = await ask(['손을 잡는다', '잡지 않는다']);
  if (c === 0) {
    dflag('heldHand', true); gain('yuri_sync', 10);
    await narr('따뜻하다. 내 손과 온도까지 똑같다.');
    await narr('어디까지가 내 손인지 모르겠다.');
  } else await say('yuri', '……괜찮아. 다음에 잡으면 돼. 기회는 많으니까.', 0);
  await fadeOut(900);
  UI.cg = null; UI.cgAlpha = 0;
  await black(['……']);
  applyAmbience();
  await fadeIn(900);
  heroPose(null); player.dir = 'up';
  await think('(……교실이다. 오늘은 아무도 나를 흔들어 깨우지 않았다. 이름을 부르는 목소리만 꿈 끝에서 들렸다.)');
  await think('(유리는 벌써 자기 자리에 앉아 있다. 시계는 8시 13분.)');
  const y = ev('yuri'); y.dir = 'up';
  await momoSeatNote();
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '다들 잘 잤나요?', 0);
  await say('all', '같은 꿈을 꿨어요.', null);
  await say('teacher', '좋은 꿈이었죠?', 1);
  await say('all', '네.', null);
  await think('(……같은 꿈?)');
  await say('teacher', '그럼 출석 부를게요. ……어머, 부를 필요도 없겠네. 오늘도 한 사람도 빠짐없이.', 1);
  await think('(창가 맨 뒷자리 아이 얼굴이 어제와 다르다. 아무도 이상하게 여기지 않는다.)');
  await say('teacher', '오전은 자습이에요. 우리는 모두 서로를 사랑하고 있단다.', 1);
  await teacherOut();
  y.dir = 'left'; player.dir = 'right';
  await say('yuri', '오늘은 나 기억해?', 0);
  const d = await ask(['유리.', '……누구더라?']);
  if (d === 0) {
    await say('hero', '유리.', 0);
    await say('yuri', '응! 기억하네.', 1);
    await say('yuri', '그래야지. 꿈에서도 봤는데.', 1);
  } else {
    await say('hero', '……누구더라?', 3);
    await say('yuri', '……아, 그렇구나.', 3);
    await say('yuri', '괜찮아. 내일 아침에 또 불러 줄게. 기억할 때까지.', 5);
  }
  const ian = ev('ian');
  await move(ian, 'RDDDDDRRRRRu'); player.dir = 'down';
  await narr('이안이 다가와 수첩을 펼친다.');
  await say('ian', '기록에 따르면 너는 전학 온 지 사흘째야.', 0);
  await say('ian', '그런데 좀 이상해. 어젯밤에 수첩 앞쪽을 넘겨 봤거든.', 2);
  await say('ian', '작년 3월 13일에도 전학생이 왔다고 적혀 있어. 재작년에도.', 2);
  await say('ian', '……전부 같은 이름으로.', 3);
  sfx('tick');
  await think('(이안은 나를 한참 보다가, 뚜껑을 딸깍 닫았다.)');
  await move(ian, 'LLLLLUUUUULu');
  const m = ev('momo');
  await think('(이번엔 모모가 먼저 다가왔다.)');
  await moveTo(m, 10, 11, 'up');
  player.dir = 'down';
  await say('momo', '……너도 꿨지. 그 꿈.', 1);
  await say('hero', '꿈?', 3);
  await say('momo', '침대 두 개. 너랑 유리. 둘 다 똑같은 얼굴로 누워 있었잖아.', 0);
  await say('momo', '나도 꿨어. 한 번이 아니야.', 0);
  const e2 = await ask(['……나도 꿨어', '말도 안 돼']);
  if (e2 === 0) {
    await say('hero', '……응. 나도 꿨어.', 0);
    await say('momo', '……', 2);
    await say('momo', '웃기네. 이번엔 바로 믿어?', 5);
    await think('(이번엔?)');
    if (once('trust_momo_dream')) gain('momo_trust', 10);
  } else {
    await say('hero', '말도 안 돼.', 3);
    await say('momo', '어. 매번 딱 그렇게 말하더라. 토씨 하나 안 틀리고.', 0);
  }
  await say('momo', '이 학교는 같은 7일을 반복해.', 0);
  await say('momo', '끝나면 처음으로 돌아가. 그리고 너는 또 전학 와.', 0);
  await say('momo', '다들 잊어. 유리만 빼고. ……난 조금 남아 있고.', 4);
  await say('momo', '방과 후에 급식실로 와. 보여 줄 게 있어.', 0);
  await say('momo', '유리한테는 말하지 마. 절대.', 1);
  m.hidden = true;
  y.dir = 'down'; player.dir = 'right';
  await say('yuri', '모모가 먼저 말을 걸었네. 드문 일인데.', 5);
  await think('(언제부터 뒤에 있었던 걸까.)');
  y.dir = 'up'; player.dir = 'up';
  await beginDay(3, '동침', '점심시간 — 급식실로');
}

/* D3-04 모모의 부탁 / 『출석하지 않은 학생』 */
async function momoBasementInvite(e) {
  if (await momoTagCheck()) return;
  await say('momo', '왔네. 안 올 줄 알았는데.', 0);
  await narr('모모가 배식대 뒤 바닥을 손끝으로 두드린다.');
  sfx('door');
  flag('hatch', true);
  await narr('바닥 한 칸이 들린다. 아래로 사다리가 이어져 있다.');
  await say('momo', '지하실로 가자. 보여 줄 게 있어.', 0);
  const c = await ask(['따라 내려간다', '이안이 지하실엔 내려가지 말랬어']);
  if (c === 1) {
    await say('hero', '이안이 지하실엔 내려가지 말랬어.', 3);
    await say('momo', '세 개의 규칙. 알아.', 0);
    await say('momo', '그럼 그 규칙 누가 만들었는지는 알아?', 1);
    await say('momo', '……모르지. 나도 몰라. 이안도 모를걸.', 0);
    await ask(['……따라 내려간다']);
  }
  if (once('d3_follow')) gain('momo_trust', 10);
  dflag('basement', true);
  objective('지하 기록실 — 가운데 책상의 출석부');
  await transfer('basement', 2, 2, 'down');
}

/* D3-05 지하 기록실 / 다른 목소리 — 손전등, 숨기 연습 */
async function basementArrive() {
  if (G.day === 3 && !has('attendance') && !dflag('basementTalk')) {
    dflag('basementTalk', true);
    Chase.start({ mons: [] });
    const m = ev('momoB'); m.dir = 'right';
    await narr('사다리 아래, 철제 서가. 낡은 종이 냄새.');
    await say('momo', '가운데 책상. 출석부 봐.', 0);
    await wait(400);
    await narr('철문 너머에서 누군가 걷는 소리가 들린다. 발소리가 여러 개인데, 박자는 하나다.');
    await say('momo', '점선 칸. 서가 사이에 붙어 있으면 안 보여.', 1);
    Chase.checkpoint();
  }
}

/* D3-06 출석부 회수 / 괴물 조우 → D3-07 첫 추격 */
const ATTEND_DOC = () => ({ type: 'ledger', title: '2학년 A반 출석부', cols: [['번호', 70], ['이름', 260], ['출석', 90], ['비고', 140]],
  rows: Array.from({ length: 12 }, (_, i) => [i + 1, G.name, '○', i === 11 ? '합일 예정' : '']), note: '날짜: 3월 13일' });
async function attendanceBook() {
  if (has('attendance')) { await narr('출석부가 놓여 있던 자리다. 그 자리에만 먼지가 없다.'); return; }
  await narr('책상 위에 출석부가 한 권 놓여 있다. 『2학년 A반』.');
  await doc(ATTEND_DOC());
  shake(5);
  await narr('……마지막 줄까지, 전부 내 이름이다.');
  give('attendance'); gain('cult_truth', 10);
  const m = ev('momoB'); m.hidden = false;
  const spot = [[7, 12], [9, 12], [8, 11]].find(([x, y]) => passable(x, y, m)) || [9, 11];
  m.x = spot[0]; m.y = spot[1]; m.dir = 'up';
  await say('momo', '다른 반 출석부도 봤어. 거긴 이름이 제각각이야.', 0);
  await say('momo', '이 반만 전부 너야. 열두 줄 다.', 0);
  await say('momo', '……그리고 내 이름은 어느 출석부에도 없었어.', 4);
  await think("(그럼 매일 아침 선생님이 부르는 '모모'는, 어디에 적혀 있는 걸까.)");
  await say('momo', '저 철문 안쪽은 나도 못 들어가 봤어. 열릴 때가 있겠지.', 0);
  await say('momo', '먼저 올라가. 같이 나가면 들켜.', 1);
  m.hidden = true;
  await wait(400);
  sfx('thud'); shake(5);
  await narr('먼 서가가 흔들린다.');
  await scare('eye', 600);
  if (await cgShow(['cg_day3_basement_eye'], 300)) { await wait(700); await cgOff(300); }
  await narr('서가 틈, 사람 얼굴보다 낮은 곳에서 눈 하나가 열린다.');
  Chase.start({
    range: 7,
    lines: ['여기 있었잖아.', '아니, 아까는 없었어.', '그랬나?', '그러면 다시 찾자.', '저기.', '아니, 이쪽.', '같이 가.'],
    mons: [{ id: 'd3', kind: 'shadow', x: 13, y: 4, patrol: [[13, 2], [15, 4], [13, 6], [9, 6], [4, 6], [1, 4], [4, 2], [9, 2]] }],
  });
  objective('사다리로 올라가자');
}
async function basementLadder() {
  if (G.day === 3 && dflag('basement') && !has('attendance')) { await narr('모모가 고개를 젓는다. 출석부를 아직 찾지 못했다.'); player.y = 2; return; }
  if (Chase.active) { Chase.stop(); Chase.cleared(); }
  await transfer('cafeteria', 1, 3, 'down');
  if (G.day === 3 && has('attendance') && once('d3_escape')) await day3Escaped();
}
async function day3Escaped() {
  await narr('바닥 문을 닫는다. 아래에서 두 번 부딪히는 소리. 곧 조용해진다.');
  objective('교실의 유리에게 가자');
}

/* D3-08 냉장고와 이름표 (선택, 진실 +10) — DAY 4 전에는 식재료라고 말하지 않는다 */
async function fridge() {
  if (G.day < 3) { await narr('냉장고다. 열리지 않는다. 안에서 웅— 하는 소리가 난다.'); return; }
  if (once('fridgeOpen')) {
    sfx('door');
    Sound.silence(1400); glitch(260);
    await narr('냉장고 문이 열린다. 음식은 하나도 없다.');
    await narr('대신 칸마다 이름표가 빽빽하게 꽂혀 있다. 학생들 이름표다. ……내 이름표도 있다.');
    gain('cult_truth', 10);
    await narr('모모의 이름표는 여러 장이다. 글씨가 장마다 다르다.');
    await think('(유리 이름표는 …… 없다. 칸을 다 뒤져도.)');
  } else await narr('이름표가 빽빽하다. 냉장고 안인데 하나도 차갑지 않다.');
  if (!flag('momoTag')) {
    const c = await ask(['모모의 이름표를 하나 챙긴다', '그대로 둔다']);
    if (c === 0) { flag('momoTag', true); await narr('모모의 이름표를 하나 주머니에 넣었다. 냉장고에 있었는데 차갑지 않다.'); }
  }
}
/* 모모의 식사 2단계 — 냉장고의 이름표를 모모에게 보여 준다 (DAY 3~6) */
async function momoTagCheck() {
  if (!flag('momoTag') || flag('momoTagShown') || G.day > 6) return false;
  const c = await ask(['이름표를 보여 준다', '그만둔다']);
  if (c !== 0) return false;
  flag('momoTagShown', true);
  await say('momo', '……내 이름표?', 2);
  await narr('모모가 이름표를 한참 들여다본다.');
  await say('momo', '내 글씨 아닌데. 냉장고에 있던 다른 것들도 다 아니었고.', 3);
  await say('momo', "다 '모모'라고 적혀 있는데, 글씨는 전부 달라.", 3);
  await say('momo', '어떤 애는 웃는 모모를 기억하고, 어떤 애는 우는 모모를 기억하겠지.', 4);
  await say('momo', '그걸 다 이어 붙이면 내가 돼. ……그러니까 나는 원래 이렇게 생긴 게 아닐지도 몰라.', 4);
  const d = await ask(['지금 내 앞에 있는 게 모모잖아', '원래 모모는 어떤 애였는데?']);
  if (d === 0) {
    await say('hero', '지금 내 앞에 있는 게 모모잖아.', 0);
    await say('momo', '……쉽게도 말하네.', 2);
    await say('momo', '……', 4);
    await say('momo', '다시 말해 봐. ……아니, 하지 마. 들었어.', 5);
    gain('momo_trust', 5);
  } else {
    await say('hero', '원래 모모는 어떤 애였는데?', 3);
    await say('momo', '몰라. 도망친 애였대. 기록에는 그렇게 적혀 있어.', 0);
    await say('momo', '그거 하나는 마음에 들어.', 5);
  }
  gain('momo_trust', 5);
  return true;
}

/* v2.3 운동장 모래밭 — 발자국이 날마다 바뀐다 (점수 없음) */
async function fieldSand() {
  if (G.day <= 2) { await narrs(['모래 위에 발자국 두 줄이 나란히 나 있다.', '한 줄은 조금 작다. 둘 다 나무 쪽으로 걸어간다.']); return; }
  if (G.day <= 4) { await narrs(['나란히 가던 발자국 두 줄이 모래밭 한가운데서 한 줄로 합쳐진다.', '합쳐진 뒤의 발자국은 두 배로 깊다.']); return; }
  if (G.day <= 6) {
    await narr('발자국은 이제 한 줄뿐이다. 끝에 무언가를 묻었다가 다시 덮은 자리가 있다.');
    if (await ask(['파 본다', '그만둔다']) === 0) {
      sfx('thud');
      await narr('숟가락 두 개가 나온다. 손잡이가 녹아서 하나로 붙어 있다.');
      if (once('sand_spoon')) await think('(누가 이걸 일부러 묻었다. 아무도 못 찾게.)');
      await narr('도로 묻는다.');
    }
    return;
  }
  await narrs(['발자국이 하나도 없다.', '누가 쓸어 놓은 것처럼 모래가 고르다.']);
}
async function fieldDrill() {
  for (let i = 0; i < 6; i++) G.flags[`ph_field_pe${i}_${G.day}`] = true;
  if (!once('d5_drill')) return;
  sfx('bell'); await wait(200);
  await narr('호루라기 소리. 줄 맞춰 서 있던 체육복들이 한꺼번에 없다.');
  await narr('그들이 서 있던 자리마다 모래에 젖은 자국이 남아 있다. 발자국이 아니라 무릎 자국이다.');
  await think('(전부 이쪽을 향해 무릎을 꿇고 있었다.)');
}

/* D3-09 운동장 나무 (선택, 기억 +10) */
async function fieldTree() {
  if (G.day < 3) { await narr('큰 나무다. 줄기에 뭔가 새겨져 있던 자국이 있다. 지금은 읽을 수 없다.'); return; }
  await narr('큰 나무다. 줄기에 글씨가 새겨져 있다. 어제는 읽을 수 없었던 글씨다.');
  await narr('『다음에 만나면 모르는 척하지 않기.』');
  if (once('opt_tree')) {
    await narr('그 아래에 이름 두 개가 새겨져 있던 자국이 있다.');
    await narr('하나는 깎여 나가 읽을 수 없다. 깎여 나간 칼자국이 반듯하다. 망설인 흔적이 하나도 없다.');
    await narr('남은 하나는…… 읽으려고 하면 글자가 흐려진다.');
    gain('memory', 10);
    flag('treeRead', true);
  }
}

/* D3-10 유리의 방과 후 질문 */
async function yuriTalk3(e) {
  if (G.phase >= 3) { e.dir = 'up'; return; }
  if (!has('attendance')) {
    await say('yuri', '왔네.', 1);
    await say('yuri', '……오늘은 할 일이 남은 얼굴이네. 다녀와. 기다릴게.', 0);
    e.dir = 'up'; return;
  }
  await say('yuri', '왔네.', 1);
  await say('yuri', '오늘 모모랑 같이 있었지?', 0);
  const c = await ask(['……응. 지하실에 갔었어', '아니. 혼자 돌아다녔어']);
  if (c === 0) {
    await say('hero', '……응. 지하실에 갔었어.', 0);
    flag('toldYuri', true);
    await say('yuri', '그랬구나.', 0);
    await say('yuri', '모모는 매번 그래. 매번 너를 데려가.', 3);
    await say('yuri', '다음에도 데려가면, 선생님께 말씀드릴게.', 5);
    await say('yuri', '합일을 방해하는 건 죄잖아. 지난번에도 그렇게 했어.', 5);
    await say('yuri', '……왜 그런 표정이야? 나 이상한 말 했어?', 0);
    gain('momo_trust', -20);
    await think('(모모가 유리한테는 말하지 말라고 했는데.)');
  } else {
    await say('hero', '아니. 혼자 돌아다녔어.', 0);
    await say('yuri', '그래?', 0);
    await say('yuri', '……응, 그렇구나.', 5);
    await think('(유리는 웃었다. 믿는 얼굴은 아니었다.)');
  }
  if (flag('treeRead')) {
    await say('yuri', '운동장 나무도 봤구나.', 0);
    await say('yuri', '그거 아직 남아 있었네. 다 깎은 줄 알았는데.', 5);
  }
  await say('yuri', '어젯밤 꿈에서 내가 한 말, 기억나?', 0);
  await say('hero', '……내가 이미 네 안에 있다고.', 2);
  await say('yuri', '응. 그거 사실이야.', 1);
  await say('yuri', '이상하지? 그런데 넌 아직 여기 있네.', 5);
  await think('(유리는 내 얼굴이 아니라, 내가 서 있는 자리를 보고 있었다.)');
  await say('yuri', '오늘 밤엔 옆 침대에 가 있을게. 이번엔 진짜로.', 1);
  e.dir = 'up';
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* D3-11 동침 / 기숙사 */
async function dormNight3() {}

/* ================================================================= 지도 (DAY 4~7에 쓰는 곳) */
const CLASS_ROWS = MAPS.classroom.rows;
/* 지하 예배당 (DAY 6 기록함 퍼즐 · 두 번째 추격 / DAY 7 제단)
   위쪽: 이름 접시 식탁(U = 식탁 아래, 숨는 칸), 기록함 b, 레버 A(l, 모모) · 레버 B(k, 복도 철문 D)
   아래쪽: 서가(h = 숨는 칸), 식판(유인), 옆방 철문 S와 레버 C(m), 빈 도시락이 있는 작은 방(Y), 출구 X */
Object.assign(MAPS, {
  office: {
    name: '교무실',
    rows: [
      'TTTTTTTTTTTTT',
      'TWHWWNWWHWWWT',
      'T..........kT',
      'T.dd.dd.dd..T',
      'T...........T',
      'T.dd.dd.....T',
      'T...........T',
      'TT.........TT',
      'TTTTTTXTTTTTT',
    ],
    legend: { T: [TC, 2, 0], W: [TC, 1, 0], N: [TC, 3, 0], H: [TC, 10, 0], d: [TC, 7, 0], k: [TC, 23, 0], '.': [TC, 0, 1], X: [TC, 18, 1] },
    tileText: {
      d: () => G.day >= 7 ? ['출석부가 펼쳐져 있다. 이름 칸은 비어 있는데, 비고란에 『통합 완료』가 줄줄이 적혀 있다.', '마지막 줄만 비어 있다.']
        : ['선생님 책상이다. 책상마다 같은 출석부가 펼쳐져 있다.'],
      H: ['서류철이 빼곡하다. 등에 전부 『2학년 A반』이라고 적혀 있다.'],
      N: ['창밖으로 운동장이 보인다.'],
    },
    events: [
      { id: 'exit', x: 6, y: 8, touch: () => transfer('hall1', 15, 2, 'down') },
      { id: 'teacherO', x: 9, y: 5, sprite: 'teacher', dir: 'down', show: () => (G.day === 5 || G.day === 6) && G.phase === 2 && !dflag('officeEmpty'),
        action: async (e) => { await teacherName(); e.dir = 'down'; } },
      { id: 'lostBox', x: 11, y: 2, action: async () => { await lostFound(); } },
    ],
  },

  pastroom: {
    name: '2학년 A반 (?)',
    noDecay: true,
    ambience: () => ({ tint: [60, 40, 20, 0.12], bgm: 'title', sepia: true }),
    rows: CLASS_ROWS,
    legend: MAPS.classroom.legend,
    tileText: {
      N: ['벽 색이 바래 있다. 창밖의 산이 초록색이다.'],
      B: ['칠판 구석의 날짜 — 3월 13일.'],
      C: ['초침이 째깍거린다.', '……이 방의 시계만.'],
      d: ['누군가의 책상이다.'],
    },
    async onEnter() {
      if (once('pastEnter')) { await narr('문을 열었는데…… 다른 교실이다.'); await think('(같은 교실이다. 그런데 처음 와 보는 곳이다.)'); }
    },
    events: [
      { id: 'door', x: 15, y: 1, touch: async () => { await transfer('hall2', 4, 2, 'down'); } },
      { id: 'envelope', x: 8, y: 3, action: async () => { await oldLetter(); } },
    ],
  },

  deepchapel: {
    name: '지하 예배당',
    rim: 'dark',
    hide: ['h', 'U'],
    ambience: () => ({ tint: [40, 0, 10, 0.3], bgm: G.day === 6 ? 'night' : 'chapel' }),
    rows: [
      'TTTTTTTTTTTTTTTTTTT',
      'TWlWGWWWWWWWWWWGWWT',
      'T..c.....A.....c..T',
      'T.................T',
      'T..QQQUQQQQUQQ..b.T',
      'T.................T',
      'T..QQUQQQQUQQQ....T',
      'T.................T',
      'TWWWWWWWDWWWkWWWWWT',
      'T.................T',
      'T.RRhRR.....RRhRR.T',
      'T.................T',
      'TWWWSWmT...TWWYWWWT',
      'T......T...T......T',
      'T......T...T.q..q.T',
      'TTTTTTTT.X.TTTTTTTT',
      'TTTTTTTTTTTTTTTTTTT',
    ],
    legend: {
      T: [TP, 2, 0], W: [TP, 1, 0], G: [TP, 3, 0], c: [TP, 7, 0], A: [TP, 4, 0], Q: [TP, 9, 0], U: [TP, 9, 1], '.': [TP, 0, 1], X: [TP, 8, 1],
      l: [TP, 1, 0], k: [TP, 1, 0], m: [TP, 1, 0], b: [TP, 0, 0], h: [TP, 0, 1], R: [TB, 8, 0], q: [TC, 7, 0], Y: [TH, 4, 1],
      D: () => flag('d6_doorD') ? [TB, 7, 0] : [TB, 11, 1],
      S: () => flag('d6_sideClosed') ? [TB, 7, 0] : [TB, 11, 1],
    },
    tileText: {
      Q: () => G.day >= 7 ? ['접시가 치워져 있다. 하나만 남아 있다.'] : ['접시마다 이름이 새겨져 있다. 모르는 이름, 아는 이름, 지워진 이름.'],
      U: ['식탁 아래로 몸을 숨길 수 있을 것 같다.'],
      G: ['붉은 스테인드글라스. 두 사람이 하나의 그릇을 들고 있다.'],
      c: ['촛불이다. 지하인데 바람도 없이 흔들린다.'],
      R: ['서가다. 기록철이 빼곡하다.'],
      q: ['낡은 책상이다.'],
      D: () => flag('d6_doorD') ? ['복도 쪽 철문이 내려와 있다.'] : ['복도로 이어지는 철문이다. 열려 있다.'],
      S: () => flag('d6_sideClosed') ? ['옆방 철문이 닫혀 있다.'] : ['옆방으로 이어지는 철문이다. 열려 있다.'],
    },
    async onEnter() { if (G.day === 6 && !dflag('deepTalk')) await deepArrive(); else if (G.day >= 7 && once('d7_deep')) await narr('지하 예배당에는 아무도 없다.'); },
    events: [
      { id: 'exit', x: 9, y: 15, touch: async () => { await deepExit(); } },
      { id: 'altar', x: 9, y: 2, action: async () => { await deepAltar(); } },
      { id: 'plates', x: 8, y: 4, action: async () => { await namePlates(); } },
      { id: 'platesM', x: 12, y: 6, action: async () => { if (G.day === 6) await momoPlates(); else await narr('접시가 치워져 있다.'); } },
      { id: 'box', x: 16, y: 4, deco: drawRecordBox, action: async () => { if (G.day === 6 && flag('d6_doorD') && !has('ritual_record')) await branch('d6_record', recordBox); else await recordBox(); } },
      { id: 'leverA', x: 2, y: 1, deco: (c, x, y) => drawLever(c, x, y, flag('d6_leverA')), action: async () => { await narr(flag('d6_leverA') ? '모모가 손잡이를 붙잡고 있다.' : '벽에 박힌 손잡이다. 기록함 쪽으로 쇠줄이 이어져 있다.'); } },
      { id: 'leverB', x: 12, y: 7, block: true, deco: (c, x, y) => drawLever(c, x, y + 6, flag('d6_doorD')), action: async () => { await leverB(); } },   // 안쪽(예배당 쪽) 벽 앞에 선 레버
      { id: 'leverC', x: 6, y: 12, deco: (c, x, y) => drawLever(c, x, y, flag('d6_sideClosed')), action: async () => { await leverC(); } },
      { id: 'tray', x: 7, y: 11, block: false, deco: drawTray, show: () => G.day === 6 && !!flag('d6_chase'), action: async () => { await throwTray(); } },
      { id: 'boxD', x: 16, y: 14, action: async () => { await emptyLunchbox(); } },
      { id: 'momoD', x: 10, y: 14, sprite: 'momo', dir: 'up', show: () => G.day === 6 && dflag('deepTalk') && !dflag('momoGone') && !dflag('momoAtLever'),
        action: async (e) => { await say('momo', flag('plates6') ? (flag('momoMeal4') ? '기록함은 식탁 끝에 있어.' : '……아래 줄 식탁에 내 이름 접시도 있더라. 기록함은 식탁 끝.') : '위층 식탁. 접시부터 보자.', 0); e.dir = 'up'; } },
      { id: 'momoL', x: 2, y: 2, sprite: 'momo', dir: 'up', show: () => G.day === 6 && dflag('momoAtLever') && !dflag('momoGone'),
        action: async (e) => { await say('momo', flag('d6_doorD') ? '지금이야. 열어.' : '저쪽 손잡이. 복도 쪽 문부터 닫아.', 0); e.dir = 'up'; } },
      { id: 'momoS', x: 15, y: 13, sprite: 'momo', dir: 'left', show: () => dflag('momoSmall') },
      { id: 'yuriS', x: 9, y: 3, sprite: 'yuri', dir: 'up', keep7: true, show: () => dflag('yuriSecret') },
    ],
  },
});
// 과거의 교실: 학생 없이 책상만
MAPS.pastroom.legend = Object.assign({}, MAPS.classroom.legend);
// DAY 7 교실: 책상 두 개(내 자리와 창가의 빈자리)만 남는다
MAPS.classroom7 = Object.assign({}, MAPS.classroom, {
  rows: CLASS_ROWS.map((r, y) => r.split('').map((ch, x) => (ch === 'd' || ch === 'e') && !((x === 10 && y === 9) || (x === 2 && y === 9) || (x === 4 && y === 5)) ? '.' : ch).join('')),
  events: MAPS.classroom.events.filter(e => ['door', 'yuri', 'ianDesk'].includes(e.id)),
  tileText: Object.assign({}, MAPS.classroom.tileText, {
    B: ['칠판에 3월 13일.', '아래에 『결석자 없음』.'],
    d: ['책상이다. 의자가 반듯하게 집어넣어져 있다.'],
  }),
});

function drawLever(c, sx, sy, down) {
  c.fillStyle = '#2a2430'; c.fillRect(sx + 18, sy + 18, 12, 22);
  c.strokeStyle = '#8a8090'; c.lineWidth = 3; c.beginPath(); c.moveTo(sx + 24, sy + 30);
  c.lineTo(sx + 24 + (down ? 9 : -9), sy + (down ? 42 : 14)); c.stroke();
  c.fillStyle = '#b0242e'; c.beginPath(); c.arc(sx + 24 + (down ? 9 : -9), sy + (down ? 42 : 14), 4, 0, 7); c.fill();
}
/* 교실 화분 — 담임이 지나가는 줄이라 벽 쪽으로 반 칸 올려 그린다 (타일에서 바닥을 빼고 화분만 오려 냄) */
const _plantCut = {};
function drawRaisedPlant(c, sx, sy) {
  const key = stageSheet(TC), im = IMG[key];
  if (!im) return;
  if (!_plantCut[key]) {
    const pi = stageIdx(TC, 20, 13, 2), fi = stageIdx(TC, 0, 13, 2);
    const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
    const g = cv.getContext('2d');
    g.drawImage(im, (fi % 8) * TILE, Math.floor(fi / 8) * TILE, TILE, TILE, 0, 0, TILE, TILE);
    const floor = g.getImageData(0, 0, TILE, TILE).data;
    g.clearRect(0, 0, TILE, TILE);
    g.drawImage(im, (pi % 8) * TILE, Math.floor(pi / 8) * TILE, TILE, TILE, 0, 0, TILE, TILE);
    const d = g.getImageData(0, 0, TILE, TILE);
    for (let i = 0; i < d.data.length; i += 4) {
      const diff = Math.abs(d.data[i] - floor[i]) + Math.abs(d.data[i + 1] - floor[i + 1]) + Math.abs(d.data[i + 2] - floor[i + 2]);
      if (diff < 24) d.data[i + 3] = 0;
    }
    g.putImageData(d, 0, 0); _plantCut[key] = cv;
  }
  c.drawImage(_plantCut[key], sx, sy - 22);
}
function drawRecordBox(c, sx, sy) {
  const im = IMG[has('ritual_record') ? 'deco_record_box_open' : 'deco_record_box'];
  if (im) { c.drawImage(im, sx, sy); return; }
  c.fillStyle = '#3c3a44'; c.fillRect(sx + 6, sy + 10, 36, 32);
  c.strokeStyle = '#7a7684'; c.lineWidth = 2; c.strokeRect(sx + 7, sy + 11, 34, 30);
}
function drawTray(c, sx, sy) {
  const im = IMG.deco_tray;
  if (im) { c.drawImage(im, sx, sy); return; }
  c.fillStyle = '#a8adb8'; c.fillRect(sx + 8, sy + 24, 32, 12);
}

/* sepia가 필요한 장소 */
const _applyAmb = applyAmbience;
applyAmbience = function () {
  _applyAmb();
  if (MAP && MAP.ambience) sepia(!!MAP.ambience().sepia);
  else if (!UI.cg) sepia(false);
};

/* ================================================================= 공통 */
async function wakeInClassroom(lines, yuriBeside = false) {
  sepia(false); UI.cg = null; UI.cgAlpha = 0;
  loadMap('classroom');
  player.x = 10; player.y = 10; player.dir = 'up';
  const y = ev('yuri');
  if (y) { if (yuriBeside) { y.x = 11; y.y = 10; y.dir = 'left'; } else { y.x = 12; y.y = 10; y.dir = 'up'; } }
  UI.fade = 1;
  applyAmbience();
  if (lines && lines.length) await black(lines);
  await fadeIn(900);
  if (!yuriBeside) { heroPose(null); player.dir = 'up'; await momoSeatNote(); }
  return y;
}
async function teacherIn() { await wait(300); sfx('door'); dflag('teacherIn', true); await move(ev('teacher'), 'LLLLLLLd'); }
async function teacherOut() { await move(ev('teacher'), 'RRRRRRRU'); sfx('door'); dflag('teacherIn', false); await wait(300); }
async function beginDay(n, sub, obj) {
  delete G.flags.startDay;
  setPhase(1);
  banner('DAY ' + n, sub);
  await wait(1200);
  objective(obj);
}

/* ================================================================= DAY 4 — 섭취 (D4-01 ~ D4-08) */
async function startDay4() {
  G.day = 4; G.phase = 0; G.objective = '';
  const y = await wakeInClassroom(['꿈을 꾼 것 같다.', '……아니, 아직 꿈에서 깨지 않은 것 같다.']);
  await think('(분명히 기숙사에서 잤는데, 또 교실이다.)');
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '오늘은 특별한 날이에요. 점심 뒤에 특별한 식사가 있거든요.', 1);
  await say('all', '네.', null);
  await say('teacher', '어머, 오늘은 결석이 둘이네요.', 0);
  await think('(빈 책상 두 개 위에 흰 접시가 하나씩 놓여 있다.)');
  await say('teacher', '괜찮아요. 결석한 친구들 몫까지 잘 먹으면 돼요.', 1);
  await say('all', '네.', null);
  await teacherOut();
  y.dir = 'left'; player.dir = 'right';
  await say('yuri', '두 명이나 안 왔네. 그러게.', 0);
  await say('yuri', '선생님 말씀 들었지? 그 애들 몫까지 먹으면 된대.', 1);
  await think('(유리는 빈 책상을 한 번도 보지 않았다. 어제까지 같이 웃던 애들인데.)');
  await say('yuri', '그보다 {N}. 어제 왜 나한테 등 돌리고 잤어?', 0);
  await say('yuri', '……나한테 화났어?', 2);
  const c = await ask(['아니야', '……잘 모르겠어']);
  if (c === 0) { await say('hero', '아니야.', 0); await say('yuri', '다행이다. 그럼 오늘 밤엔 이쪽 보고 자.', 1); }
  else { await say('hero', '……잘 모르겠어.', 3); await say('yuri', '그래? 그럼 아직 화난 건 아닌 거네.', 0); await say('yuri', '다행이다.', 1); }
  const ian = ev('ian');
  await move(ian, 'RDDDDDRRRRRu'); player.dir = 'down';
  await say('ian', '{N}. 잠깐만.', 2);
  await say('ian', '이상한 걸 물어볼게. 어젯밤 꿈에서 내가 뭐라고 했는지 알아?', 2);
  await say('hero', '……내일은 특별한 식사라고.', 2);
  await say('ian', '……그렇구나.', 3);
  await say('ian', '나도 같은 꿈을 꿨어. 내가 그런 말을 하는 걸 들었어.', 2);
  await say('ian', '그런데 난 그런 말을 한 기억이 없어. 수첩에도 없고.', 3);
  await move(ian, 'LLLLLUUUUULu');
  y.dir = 'up'; player.dir = 'up';
  await beginDay(4, '섭취', '점심시간 — 급식실로');
}

/* D4-03 이안과 출석부 대조 / D4-04 이안의 부모 이야기 (2층 복도, 점심 전) */

/* D4-05 특별한 식사 / 이름표 → D4-06 양호실 */
async function specialMeal() {
  dflag('mealTeacher', true);
  await fadeOut(800);
  await black(['오후 수업 대신, 모두 다시 급식실에 모였다.', '식탁마다 흰 접시가 하나씩 놓여 있다.']);
  bgm(null);
  const cgOn = await cgShow(['cg_day4_special_meal', 'cg_day4_meal'], 10);
  await fadeIn(800);
  await say('ian', '오늘은 특별한 식사야.', 0);
  await say('hero', '뭔데?', 3);
  await say('ian', '네가 제일 좋아하는 거.', 1);
  await think('(이안의 목소리인데, 이안의 말투가 아니었다.)');
  await say('yuri', '먹어 봐. 네가 좋아하던 맛이야.', 5);
  await narr('접시 위에 뭔가 놓여 있다. 무엇인지 알아볼 수가 없다.');
  let c = await ask(['이게 뭐야?', '먹는다', '먹지 않는다']);
  if (c === 0) {
    await say('hero', '이게 뭐야?', 2);
    await narr('아무도 대답하지 않는다. 모두 나를 보고 있다. 숨도 안 쉬는 것처럼.');
    c = 1 + await ask(['먹는다', '먹지 않는다']);
  }
  if (once('d4_meal')) gain('cult_truth', 5);
  if (c === 1) {
    dflag('ateMeal', true);
    gain('yuri_sync', 15);
    await narr('숟가락을 든다.');
    await narr('한 입.');
    await scare('meal', 520);
    if (cgOn) { UI.cg = null; UI.cgAlpha = 0; }
    await fadeOut(300);
    await black(['맛이 기억나지 않는다.', '기억나는 건, 모두가 동시에 숟가락을 내려놓는 소리뿐이다.']);
  } else {
    await narr('숟가락을 내려놓았다.');
    shake(8);
    await narr('모두가 동시에 숟가락을 내려놓고 나를 본다.');
    await say('ian', '괜찮아.', 0);
    await say('ian', '너는 원래 먹는 쪽이 아니니까.', 2);
    if (cgOn) { UI.cg = null; UI.cgAlpha = 0; }
    await fadeOut(600);
    await black(['아무도 말하지 않는다.', '그대로 눈앞이 어두워진다.']);
  }
  UI.cg = null; UI.cgAlpha = 0;
  dflag('mealTeacher', false);
  // 양호실
  G.phase = 2;
  await transfer('infirmary', 4, 2, 'down', { fade: false });
  heroPose(1);
  await fadeIn(1000);
  await narr('양호실이다. 손에 뭔가 쥐어져 있다.');
  give('empty_plate');
  await narr('빈 접시다. 혀로 핥은 것처럼 깨끗하다.');
  if (!dflag('ateMeal')) await think('(나는 안 먹었다. 그럼 누가 비운 거지?)');
  heroPose(null); player.x = 3; player.y = 3; player.dir = 'right';
  const m = ev('momoI'); m.dir = 'left';
  await say('momo', '깼어?', 0);
  await think('(침대 옆에 모모가 앉아 있다. 얼마나 있었던 걸까.)');
  await say('momo', '네가 먹은 게 아니야.', 0);
  await say('momo', '먹힌 거지.', 1);
  const b = await ask(['……믿을게', '무슨 소리야']);
  if (b === 0) {
    await say('hero', '……믿을게.', 0);
    if (once('trust_momo_reveal')) gain('momo_trust', 15);
    await say('momo', '……응. 나는 그렇게 기억해.', 2);
    await say('momo', '내 기억이 맞다면 말이지.', 4);
  } else {
    await say('hero', '무슨 소리야.', 3);
    await say('momo', '말 그대로야.', 0);
    await say('momo', '네가 기억 못 한다고 없었던 일이 되는 건 아니잖아.', 1);
  }
  await say('momo', '나도 그 접시에 올라간 적 있어.', 4);
  await say('momo', '유리가 선생님한테 일렀대. 내가 널 데리고 나가려고 한다고.', 4);
  await say('momo', '모두가 숟가락을 들었을 때, 뛰었어.', 0);
  await say('momo', '전부 데리고 나오진 못했어. 그래서 기억도 온전하지 않아. 숨이 찼던 것만 선명해.', 3);
  await say('momo', '그게 좋았어. 살아 있는 것 같아서.', 5);
  await think('(모모가 웃는 걸 처음 봤다. 아주 잠깐이었다.)');
  await say('momo', '……뭘 봐. 유리한테나 가 봐. 오늘 들은 건 잊지 말고.', 1);
  setPhase(2);
  objective('교실의 유리에게 가자');
}

/* D4-08 방과 후 / 유리의 대답 */
async function yuriTalk4(e) {
  if (G.phase >= 3) { e.dir = 'up'; return; }
  await say('yuri', '왔네.', 1);
  if (flag('ianParents')) {
    await say('yuri', '이안한테 부모님 얘기 들었구나.', 0);
    await say('yuri', '부럽다. 그 두 사람은 성공했잖아.', 1);
    await say('yuri', '이안은 그 얘기 할 때마다 슬퍼하더라. 왜인지 모르겠어. 하나가 됐는데.', 3);
  }
  if (dflag('ateMeal')) await say('yuri', '맛있었어?', 5);
  else await say('yuri', '이번에도 안 먹었구나. 괜찮아, 다들 처음엔 그래.', 0);
  await say('yuri', '모모가 뭐래?', 0);
  const c = await ask(['내가 먹힌 쪽이래', '아무 말도 안 했어']);
  if (c === 0) {
    await say('hero', '내가 먹힌 쪽이래.', 2);
    await say('yuri', '……모모는 늘 그렇게 말하더라.', 3);
    await say('yuri', '틀린 말은 아니야. 그런데 왜 그렇게 싫어하는지 모르겠어.', 0);
  } else {
    await say('hero', '아무 말도 안 했어.', 0);
    await say('yuri', '응. 말하기 싫으면 안 해도 돼.', 5);
  }
  await say('yuri', '모모한테 내가 널 먹었다는 얘기를 들었잖아.', 0);
  await say('yuri', '그런데도 넌 매번 돌아와서 내 옆자리에 앉아.', 0);
  await say('yuri', '왜 도망가지 않아?', 3);
  const d = await ask(['모르겠어', '네가 깨우니까']);
  if (d === 1) {
    await say('hero', '네가 깨우니까.', 0);
    await say('yuri', '아, 그래서였구나.', 3);
    await say('yuri', '그럼 내일도 내가 깨워 줄게.', 1);
    await say('yuri', '이름을 부르는 건 사랑의 시작이잖아. 매일 네 이름을 불러 줄게.', 5);
  } else {
    await say('hero', '모르겠어.', 3);
    await say('yuri', '몰라도 괜찮아. 네가 다시 돌아왔잖아.', 0);
    await say('yuri', '그거면 됐어. 난 네가 여기 있는 게 좋아.', 1);
  }
  await say('yuri', '오늘 밤에도 옆 침대에 있을게. 이번엔 등 돌리지 마.', 1);
  e.dir = 'up';
  dflag('yuriLeft4', true);
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* D4-07 유리의 서랍 (DAY 4~6, 기억 +20) */
async function yuriDrawer() {
  if (G.day < 4) { await narr('서랍장이다. 잠겨 있다.'); return; }
  if (flag('opt_yuri_drawer')) { await narr('편지들이 날짜순으로 정리돼 있다. 마지막 문장은 전부 『다음엔 더 잘할게.』'); return; }
  await narr('유리 쪽 서랍장이다. 오늘은 잠겨 있지 않다.');
  await doc(YURI_DRAWER_DOC);
  flag('opt_yuri_drawer', true); gain('memory', 15);
  await think('(누가 누구에게 쓴 건지 알 수 없다. 글씨는…… 내 것 같기도 하다.)');
  await think('(사과는 한 줄도 없다. 다음엔 더 잘하겠다는 다짐뿐이다.)');
  if (G.phase >= 3 && G.day <= 6) await say('yuri', '……읽었어? 그거, 우리 둘 중에 누가 쓴 건지 나도 몰라. 글씨가 같아서.', 5);
}

/* ================================================================= DAY 5 — 기억 (D5-01 ~ D5-09) */
async function startDay5() {
  G.day = 5; G.phase = 0; G.objective = '';
  const y = await wakeInClassroom(['꿈을 꾼다.', '누군가의 기억 속을 걷고 있다.', '……내 기억인지 유리의 기억인지, 이제는 잘 모르겠다.']);
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '출석 부를게요. ……유리.', 1);
  await think('(선생님은 나를 보면서 유리라고 불렀다.)');
  await say('all', '네.', null);
  await think('(반 전체가 한꺼번에 대답했다. 이름이 뒤섞이고 있다.)');
  await teacherOut();
  y.dir = 'left'; player.dir = 'right';
  await say('yuri', '네가 먼저 먹어 달라고 했잖아.', 5);
  await say('hero', '……뭐?', 1);
  await say('yuri', '아, 아직 기억 안 났구나. 지금은 잊어버려. 오늘 안에 생각날 거야.', 0);
  y.dir = 'up';
  const ian = ev('ian');
  await move(ian, 'RDDDDDRRRRRu'); player.dir = 'down';
  await say('ian', '학생회장 모모야.', 0);
  await say('ian', '……아니. 이안. 내 이름 이안 맞지?', 3);
  await narr('이안이 수첩에 자기 이름을 몇 번이고 적는다.');
  await say('ian', '방금 내가 뭐라고 했지? 모모?', 3);
  await say('ian', '이상하네. 그 애 이름을 왜 내 이름처럼 말했지.', 2);
  await say('ian', '……미안한데, 내 이름 한 번만 불러 줄래? 들으면 기억날 것 같아서.', 3);
  const c = await ask(['이안.', '……']);
  if (c === 0) {
    await say('hero', '이안.', 0);
    await say('ian', '……응. 그거다.', 1);
    await say('ian', '고마워. 오늘은 네가 내 수첩이네.', 1);
    if (once('d5_ianName')) gain('memory', 5);
  } else {
    await say('ian', '그래, 괜찮아. 적혀 있으니까.', 0);
    await think('(수첩에 적힌 이름은 세 번째부터 글씨가 흔들렸다.)');
  }
  await move(ian, 'LLLLLUUUUULu');
  player.dir = 'up';
  await beginDay(5, '기억', '점심시간 — 급식실로');
}

/* D5-04 과거의 교실 / 편지와 동의서 */
const OLD_LETTER_DOC = { type: 'paper', title: '', lines: [
  '유리에게.', '나는 네가 나를 잊는 게 제일 무서워.', '!네가 나를 잊는 것보다', '!네가 나를 먹는 게 나아.', '적어도 그때는, 내가 네 안에 있을 테니까.', '~— {N}'] };
function fmtDoc(spec) { return JSON.parse(fmt(JSON.stringify(spec))); }
async function oldLetter() {
  if (has('old_letter')) { await narr('내 자리다. 아니, 내 자리였다.'); return; }
  await narr('내 자리였던 책상이다. 서랍에 편지가 한 통 들어 있다.');
  await doc(fmtDoc(OLD_LETTER_DOC));
  give('old_letter'); gain('memory', 10);
  await think('(내 글씨다.)');
  await think('(나는 당하기만 한 게 아니었다. 나도…… 이걸 원했다.)');
  objective('교실의 유리에게 가자');
}
/* D5-05 모모 / 기억에 없는 선택 (과거의 교실에서 나오면) */
async function momoHall5() {}
/* D5-06 모모의 거울 (선택) */
async function momoMirror(e) {
  if (dflag('momoMirror')) { await say('momo', '……보지 마. 나도 안 볼 거야.', 1); e.dir = 'up'; return; }
  dflag('momoMirror', true);
  await think('(모모가 세면대 거울 앞에 서 있다. 자기 얼굴을 오래 들여다보고 있다.)');
  await say('momo', '야. 나 원래 이렇게 생겼어?', 3);
  const c = await ask(['응', '모르겠어']);
  if (c === 0) {
    await say('hero', '응.', 0);
    await say('momo', '……그래. 네가 그렇다면.', 4);
    await think('(모모는 웃지 않았다.)');
  } else {
    await say('hero', '모르겠어.', 3);
    await say('momo', '……나도.', 4);
    if (once('momoMeal3')) gain('momo_trust', 5);
  }
  await say('momo', '오늘 아침에 이안이 내 이름을 불렀어. 자기 이름 대신.', 3);
  await say('momo', '웃기지. 걔는 나랑 말도 거의 안 하면서.', 0);
  await say('momo', '……근데 그 소리 들으니까, 거울 속 얼굴이 조금 덜 낯설어.', 5);
  e.dir = 'up';
}

/* D5-07 교무실 / 선생님의 이름 (DAY 5~6 방과 후, 진실 +10) */
async function teacherName() {
  if (flag('opt_teacher_name')) { await say('teacher', '우리는 모두 서로를 사랑하고 있단다.', 1); return; }
  await say('hero', '선생님, 성함이 어떻게 되세요?', 3);
  await say('teacher', '우리는 모두 서로를 사랑하고 있단다.', 1);
  await say('hero', '아니, 이름이요.', 3);
  await say('teacher', '……', 2);
  await narr('선생님이 서로 다른 목소리로 여러 이름을 차례로 말한다. 남자 목소리, 여자 목소리, 아이 목소리.');
  await narr('마지막 이름은, 내 이름이었다.');
  await say('teacher', '어머, 미안하구나. 오늘은 그게 제일 위에 있었네.', 1);
  flag('opt_teacher_name', true); flag('teacherNamed', true); gain('cult_truth', 10);
}

/* D5-08 유리 / 우리 기억 */
async function yuriTalk5(e) {
  if (G.phase >= 3) { e.dir = 'up'; return; }
  if (!has('old_letter')) {
    await say('yuri', '아직이야. 네 자리, 원래 자리에 가 봐.', 0);
    await think('(교실 문을 다시 열어 보면……)');
    e.dir = 'up'; return;
  }
  await say('yuri', '이제 기억났어?', 0);
  await say('hero', '뭐를?', 3);
  await say('yuri', '우리 처음 같이 먹은 날.', 1);
  await memory(cgPick('cg_mem_firstlunch', 'cg_mem_lunchbox'), async () => {
    await say('yuri', '그거 남길 거야?', 0);
    await say('hero', '어? 응. 배불러서.', 0);
    await say('yuri', '그럼 내가 먹어도 돼?', 0);
    await say('hero', '……어? 그거 내 숟가락인데.', 1);
    await say('yuri', '응. 그러니까.', 0);
    await narr('유리는 내 숟가락으로, 내가 남긴 걸 남김없이 먹었다.');
    await say('yuri', '……이런 기분이구나.', 5);
    await say('yuri', '……좋네.', 1);
    await say('hero', '뭐가?', 3);
    await say('yuri', '그냥. 네가 먹던 거라서.', 1);
    await say('yuri', '내일부터는 내가 싸 올게. 두 개.', 0);
    await say('yuri', '앞으로는 남기지 마.', 5);
  });
  await think('(그날부터였다. 유리가 도시락을 두 개씩 싸 오기 시작한 건.)');
  if (once('firstLunchMem')) gain('memory', 5);
  flag('firstLunch', true);
  await say('hero', '……이거, 내 기억 맞아? 네 기억이 아니라?', 3);
  await say('yuri', '우리 기억이잖아.', 5);
  const c = await ask(['……그래, 우리 기억이야', '아니. 네 기억이야']);
  if (c === 0) {
    await say('hero', '……그래, 우리 기억이야.', 5);
    if (once('trust_yuri_memory')) gain('yuri_sync', 15);
    await say('yuri', '응.', 1);
  } else {
    await say('hero', '아니. 네 기억이야.', 7);
    await say('yuri', '……그렇게 말할 줄 알았어. 지난번에도 그랬거든.', 5);
  }
  await say('yuri', '그 편지, 네가 쓴 거야.', 0);
  await say('yuri', '네가 나를 잊느니 차라리 나한테 먹히겠다고.', 0);
  await say('yuri', '그러니까 우리 둘 다 교리대로 한 거잖아. 그렇지?', 1);
  const d = await ask(['……응', '그래도 너는 날 먹었어']);
  if (d === 0) { await say('hero', '……응.', 5); await say('yuri', '그치? 다행이다.', 1); }
  else {
    await say('hero', '그래도 너는 날 먹었어.', 7);
    await say('yuri', '응. 알아.', 0);
    await say('yuri', '그게 왜? ……아, 여기서 화내야 하는 거구나.', 3);
  }
  await say('yuri', '그 편지 읽고 무서웠어?', 0);
  await say('yuri', '무서워할 필요 없어. 네가 원한 거잖아. 교리에도 적혀 있고.', 5);
  e.dir = 'up';
  dflag('yuriLeft5', true);
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* ================================================================= DAY 6 — 일체 (D6-01 ~ D6-11) */
async function startDay6() {
  G.day = 6; G.phase = 0; G.objective = '';
  const y = await wakeInClassroom([]);
  await think('(빈자리가 늘었다. 어제 분명 누가 앉아 있던 자리인데, 얼굴이 떠오르지 않는다.)');
  await teacherIn();
  await say('teacher', '좋은 아침이에요, 여러분!', 0);
  await say('all', '좋은 아침입니다, 선생님.', null);
  await say('teacher', '오늘은 출석을 안 부를게요.', 1);
  await say('teacher', '……부를 이름이 얼마 안 남았거든요.', 0);
  await teacherOut();
  y.dir = 'left'; player.dir = 'right';
  await say('yuri', '하루 남았네.', 0);
  await say('yuri', '이번엔 성공하자.', 5);
  y.dir = 'up';
  const m = ev('momo');
  if (m) { player.dir = m.x < player.x ? 'left' : 'down'; m.dir = 'up'; }
  await say('momo', '방과 후. 급식실.', 0);
  await say('momo', '오늘은 끝까지 가. 중간에 돌아서지 마.', 1);
  player.dir = 'up';
  await beginDay(6, '일체', '점심시간 — 급식실로');
}

/* D6-03 모모 / 지하 안쪽 문 */
async function momoDeepInvite(e) {
  await say('momo', '왔네. 오늘은 철문이 열려 있어.', 0);
  await say('momo', '누가 열었는지는 몰라. 우리더러 들어오라는 거겠지. ……가자.', 1);
  dflag('basement', true);
  await transfer('basement', 2, 2, 'down');
  await narr('기록실 안쪽, 철문을 감고 있던 쇠사슬이 바닥에 풀려 있다.');
  objective('기록실 안쪽 철문으로');
}

/* D6-04 지하 예배당 도착 */
async function deepArrive() {
  dflag('deepTalk', true);
  Chase.start({ mons: [] });
  const m = ev('momoD'); m.dir = 'up';
  Sound.silence(1600); UI.fade = 1;
  await wait(500);
  await narr('촛불이 한꺼번에 꺼진다.');
  glitch(300);
  UI.fade = 0;
  await narr('……그리고 한꺼번에 다시 켜진다. 성냥을 든 사람은 아무도 없다.');
  const cgOn = await cgShow(['cg_day6_plates'], 600);
  await narr('긴 식탁 위에 접시가 끝없이 놓여 있다. 접시마다 이름이 새겨져 있다.');
  if (cgOn) await cgOff(500);
  await say('momo', '여기선 기억이 사람보다 오래 남아.', 0);
  await say('momo', '이름이 지워져도 누군가는 그 사람 얘기를 해. 자기 일처럼.', 3);
  await say('momo', '나도 가끔 헷갈려. 내가 겪은 일인지, 누가 남긴 기억인지.', 4);
  await say('hero', '그럼…… 내가 기억하는 건 뭐야?', 3);
  await say('momo', '내가 그걸 어떻게 알아.', 0);
  await say('momo', '……그래서 직접 보러 온 거잖아.', 1);
  const c = await ask(['……그렇구나', '못 믿겠어']);
  if (c === 0) {
    await say('hero', '……그렇구나.', 0);
    if (once('trust_momo_deep')) gain('momo_trust', 15);
    await say('momo', '……너한테 이 말 할 때마다, 사실 내 얘기 같아서 싫었어.', 4);
  } else {
    await say('hero', '못 믿겠어.', 3);
    await say('momo', '그래. 믿지 마. 믿든 안 믿든 접시는 그대로 있으니까.', 0);
  }
  objective('지하 예배당을 조사하자');
}
async function namePlates() {
  if (G.day >= 7) { await narr('접시가 치워져 있다. 하나만 남아 있다.'); return; }
  if (flag('plates6')) { await narr('접시마다 이름이 있다. 같은 이름이 몇 번이고 나온다.'); return; }
  await narr('접시마다 이름이 새겨져 있다.');
  await narr('반 친구들의 이름. 졸업앨범에서 지워져 있던 이름들.');
  await narr('……그리고 내 이름이 새겨진 접시가, 셀 수 없이 많다.');
  flag('plates6', true); gain('cult_truth', 10);
  if (!has('ritual_record')) objective('식탁 끝의 철제 기록함');
  await checkIan();
}
/* D6-05 기록함 퍼즐 — 모모가 레버 A를 잡고, 내가 레버 B로 복도 철문을 닫는 동안 기록함을 연다 */
async function recordBox() {
  if (G.day >= 7) { await narr('철제 기록함이다. 비어 있다.'); return; }
  if (has('ritual_record')) { await narr('기록함은 비어 있다.'); return; }
  if (!flag('plates6')) { await say('momo', '접시부터 보자.', 0); return; }
  if (!flag('d6_leverA')) {
    await narr('긴 식탁 끝의 철제 기록함. 손잡이 둘이 서로 다른 문과 이어져 있다.');
    await say('momo', '내가 이쪽 잡을게. 넌 저쪽 열어.', 0);
    flag('d6_leverA', true); dflag('momoAtLever', true);
    sfx('clank');
    await narr('모모가 벽의 손잡이 하나를 붙잡는다.');
    objective('레버를 내려 복도 쪽 철문을 닫자');
    return;
  }
  if (!flag('d6_doorD')) { await narr('잠겨 있다. 복도 쪽 철문부터 닫아야 열릴 것 같다.'); return; }
  sfx('clank'); shake(3);
  await narr('기록함이 열린다. 안에 두꺼운 기록이 들어 있다.');
  await doc(RITUAL_DOC());
  give('ritual_record'); gain('cult_truth', 10);
  await think('(실패. 실패. 실패. 그리고, 진행 중.)');
  await day6Chase();
}
async function leverB() {
  if (G.day >= 7) { await narr('손잡이가 녹슬어 움직이지 않는다.'); return; }
  if (!flag('d6_leverA')) { await narr('움직이지 않는다. 반대쪽 손잡이와 이어져 있는 것 같다.'); return; }
  if (flag('d6_chase')) { await narr('손잡이가 부러져 있다.'); return; }
  if (player.y > 7) { await narr('손잡이는 벽 안쪽에 있다.'); return; }
  if (flag('d6_doorD')) { await narr('복도 쪽 철문이 내려와 있다.'); return; }
  sfx('clank'); shake(4);
  flag('d6_doorD', true);
  await narr('레버를 내린다. 복도 쪽 철문이 내려앉는다.');
  objective('기록함을 열자');
}
/* D6-08 실패체 / 두 번째 추격 */
async function day6Chase() {
  sfx('thud'); shake(6); await wait(300); sfx('thud'); shake(6);
  await narr('금속 문이 흔들린다.');
  glitch(200);
  await narr('문틈에서 손이 들어온다. 다른 손이 그 손을 떼려 한다.');
  await say('목소리 A', '문 열어.', null);
  await say('목소리 B', '안 돼.', null);
  await say('목소리 C', '기다려.', null);
  sfx('clank'); shake(10);
  flag('d6_doorD', false); flag('d6_chase', true); dflag('momoGone', true);
  await narr('철문이 들려 올라간다. 모모가 반대편 어둠으로 몸을 숨긴다.');
  Chase.start({
    range: 7,
    lines: ['문 열어.', '안 돼.', '기다려.', '이쪽.', '아니, 저쪽.', '같이 가.'],
    tick: () => { if (player.y >= 9 && !flag('d6_cp2')) { flag('d6_cp2', true); Chase.checkpoint(); objective('식판 소리로 실패체를 옆방으로 따돌리자'); } },
    mons: [{ id: 'u6', kind: 'union', x: 8, y: 9, state: 'suspicious', goal: [15, 5],
      patrol: [[4, 3], [14, 3], [17, 5], [14, 7], [4, 7], [1, 5], [4, 9], [16, 9], [16, 11], [9, 11], [2, 11]] }],
  });
  objective('아래층으로 — 식탁 아래(점선 칸)에 숨을 수 있다');
}
/* 금속 식판 — 옆방 쪽으로 던지면 소리 나는 쪽으로 간다 */
async function throwTray() {
  if (!Chase.active) { await narr('빈 금속 식판이다.'); return; }
  sfx('clank');
  await narr('빈 금속 식판을 옆방 쪽으로 던진다. 쇳소리가 길게 울린다.');
  Chase.noise(3, 14, 40);
  objective('실패체가 옆방에 들어가면 — 옆방 문 레버를 내리자');
}
async function leverC() {
  if (G.day >= 7 || !Chase.active) { await narr('벽의 손잡이다. 옆방 철문과 이어져 있다.'); return; }
  const closing = !flag('d6_sideClosed');
  const u = Chase.mon('u6');
  if (closing && u && !u.gone && ((u.tx >= 1 && u.tx <= 6 && u.ty >= 13) || (u.tx === 4 && u.ty === 12))) {
    if (u.ty === 12) { u.tx = 4; u.ty = 13; }
    u.fx = u.tx; u.fy = u.ty;
    sfx('clank'); shake(6);
    flag('d6_sideClosed', true); flag('d6_trapped', true);
    u.state = 'search'; u.t = 0; u.path = [];
    await narr('레버를 내린다. 옆방 철문이 내려앉는다. 안에서 여러 손이 문을 두드린다.');
    Chase.checkpoint();
    objective('빈 도시락 — 오른쪽 작은 방');
    return;
  }
  sfx('clank');
  flag('d6_sideClosed', closing);
  await narr(closing ? '옆방 철문이 내려앉는다. ……안은 비어 있다.' : '옆방 철문이 다시 올라간다.');
}
/* D6-09 빈 도시락 / 그날의 식탁 */
async function emptyLunchbox() {
  if (has('lunchbox') || G.day !== 6) { await narr(has('lunchbox') ? '도시락이 놓여 있던 자리다.' : '낡은 책상이다.'); return; }
  if (!has('ritual_record')) { await narr('낡은 도시락이 놓여 있다. ……기록함부터 열자.'); return; }
  await narr('식탁 끝에 도시락통이 하나 놓여 있다. 뚜껑에 두 사람의 이름이 나란히 적혀 있다.');
  give('lunchbox');
  await memory('cg_mem_lunchbox', async () => {
    await say('yuri', '남기지 않을게.', 0);
    await say('hero', '……응.', 0);
    await say('yuri', '하나도. 약속해.', 1);
    sfx('clank');
    await narr('도시락 뚜껑이 닫히는 소리.');
  });
  gain('memory', 10);
  await think('(첫 번째 의식. 그날 나는 웃고 있었다.)');
  sfx('thud'); await wait(250); sfx('thud');
  const u = Chase.mon('u6');
  if (u && !u.gone && flag('d6_sideClosed') && u.tx <= 6 && u.ty >= 13) {
    sfx('clank'); shake(10);
    flag('d6_sideClosed', false);
    await narr('옆방 철문이 안에서부터 들어 올려진다.');
    u.state = 'chase'; u.stun = 1400; u.path = [];
  }
  Chase.checkpoint();
  objective('출구로!');
}
async function deepExit() {
  if (G.day === 6 && (Chase.active || flag('d6_chase'))) {
    if (!has('lunchbox')) { await narr('아직 빈 도시락을 찾지 못했다.'); player.y = 14; return; }
    if (Chase.active) { Chase.stop(); Chase.cleared(); }
    await transfer('basement', 8, 2, 'down');
    await checkIan();
    return;
  }
  if (G.day === 6 && !has('ritual_record')) { await say('momo', '아직이야. 접시랑 기록부터.', 0); player.y = 14; return; }
  if (Chase.active) Chase.stop();
  await transfer('basement', 8, 2, 'down');
}
/* D6-10 이안 / 수첩을 닫다 → D6-11 마지막 밤 */
async function day6Ian() { await checkIan(); }
async function dormNight6() {}

const YURI_TALK = {
  1: yuriTalk1, 2: yuriTalk2,
  3: (e) => G.phase === 2 ? branch('d3_yuri', () => yuriTalk3(e)) : yuriTalk3(e),
  4: yuriTalk4,
  5: (e) => G.phase === 2 && has('old_letter') ? branch('d5_yuri', () => yuriTalk5(e)) : yuriTalk5(e),
  6: (e) => G.phase === 2 && dflag('ianDeep') ? branch('d6_yuri', () => yuriTalk6(e)) : yuriTalk6(e),
};

/* ================================================================= DAY 7 — 마지막 식사 (D7-01 ~ D7-08, 엔딩, SECRET) */
async function startDay7() {
  G.day = 7; G.phase = 0; G.objective = '';
  await wakeInClassroom(['……', '아무도 나를 흔들어 깨우지 않는다.']);
  await narr('교실이 비어 있다.');
  await think('(책상도, 의자도 그대로인데 아무도 없다. 시계는 여전히 8시 13분.)');
  await narr('어디선가, 아주 멀리서 내 이름을 부르는 소리가 들린다.');
  await say('유리의 목소리', '{N}.', null);
  await say('유리의 목소리', '일어났어? ……학교잖아.', null);
  await say('유리의 목소리', '이번에는, 처음이 아니구나.', null);
  await say('유리의 목소리', '급식실에서 기다릴게. 마지막 식사니까.', null);
  await think('(첫날 아침과 같은 말이다. 단어 하나만 빼고.)');
  await beginDay(7, '마지막 식사', '급식실로');
  saveGame();
}
async function enterFinalCafeteria() {
  const c = await ask(['들어간다', '아직'], '급식실에 들어가면 다시 돌아올 수 없을 것 같다. 들어갈까?');
  if (c !== 0) { player.y = 2; return; }
  saveGame();
  await branch('d7_table', () => transfer('cafeteria', 4, 6, 'up'));
}
async function finalTable() {
  dflag('final', true);
  bgm(null);
  await cgShow(['cg_day7_table'], 1200);
  await narr('식탁에는 접시 두 개와 숟가락 두 개가 놓여 있다.');
  await say('yuri', '왔네. 앉아.', 0);
  await say('hero', '다른 애들은?', 3);
  await say('yuri', '다들 갔어. 이제 우리 둘이야.', 0);
  await say('hero', '모모는?', 3);
  await say('yuri', '그 애는 원래 없었어.', 0);
  await think('(유리가 머리카락을 귀 뒤로 넘겼다.)');
  if (flag('momoGate')) await think('(거짓말이다. 조금 전에 정문에서 봤다.)');
  await say('yuri', '이제 우리 둘뿐이야.', 5);
  await finalChoice();
}
/* D7-04 ~ D7-07 질문 네 가지 — 원하는 순서로, 한 번씩. 수치 변화 없음 */
const FINAL_QA = [
  ['너는 나를 사랑했어?', [['yuri', '응.', 1], ['yuri', '그래서 남기지 않았어. 한 숟가락도.', 5]]],
  ['왜 나를 먹었어?', [['yuri', '교리 마지막 장. 사랑하는 이를 남김없이 받아들이십시오.', 0], ['yuri', '난 너를 사랑하니까. 네 살도 기억도, 전부 내 안에 두고 싶었어.', 1],
    ['yuri', '……아, 하나 더 있다. 네가 다른 사람을 보는 게 싫었어.', 3], ['yuri', '그건 교리에 없는 건데. 이상하지.', 5]]],
  ['나는 네 안에 있었어?', [['yuri', '아침마다 네 이름을 부르면, 안에서 누가 대답했어.', 0], ['yuri', '그게 너였는지, 너인 척하는 나였는지는 몰라. 상관없었어.', 5]]],
  ['이제 그만하고 싶지 않아?', [['yuri', '그만?', 3], ['yuri', '왜? 거의 다 왔는데.', 0], ['yuri', '실패는 완성에 가까워지는 과정이야. 이번이 제일 가까워.', 5]]],
];
async function finalChoice() {
  saveBranch('d7_choice');
  if (!UI.cg) { const n = cgPick('cg_day7_table'); if (n) { UI.cg = n; await tween(UI, 'cgAlpha', 1, 500); } }
  const asked = new Set();
  let leftover = false;
  for (;;) {
    const opts = FINAL_QA.filter(q => !asked.has(q[0])).map(q => q[0]);
    if (flag('firstLunch')) opts.push(LEAVE_OPT);
    opts.push('그만 묻는다');
    const i = await ask(opts);
    const pick = opts[i];
    if (pick === '그만 묻는다') break;
    if (pick === LEAVE_OPT) {
      await say('hero', '남겨도 돼.', 7, { raw: true });
      await say('yuri', '……', 3);
      await say('yuri', '그건 교리에 없는 말이야.', 3);
      await say('yuri', '남기면, 남은 건 누가 가져가?', 2);
      await say('hero', '아무도. 그냥 남는 거야.', 0, { raw: true });
      await say('yuri', '……그러면 남김없이 받아들이지 못한 거잖아. 마지막 장에선 그래야 사랑이 완성된댔는데.', 2);
      await say('hero', '아니야.', 7, { raw: true });
      await think('(유리가 처음으로, 대답을 찾지 못하는 얼굴을 했다.)');
      await narr('유리가 숟가락을 내려놓는다. 접시에 한 숟가락이 남아 있다.');
      const n = cgPick('cg_day7_leftover');
      if (n) { UI.cg = n; UI.cgAlpha = 1; }
      await say('yuri', '……남기면 안 되는데.', 4);
      flag('leftover', true); leftover = true;
      break;
    }
    asked.add(pick);
    await say('hero', pick, 3, { raw: true });
    for (const [who, t, f] of FINAL_QA.find(q => q[0] === pick)[1]) {
      if (who === 'narr') await narr(t); else await say(who, t, f, who === 'hero' ? { raw: true } : {});
    }
    if (asked.size === FINAL_QA.length) {
      await say('yuri', '……다 물어봤네. 이제 내 차례인데.', 0);
      await say('yuri', '아니야, 됐어. 대답 들으면 못 먹을 것 같아.', 5);
      break;
    }
  }
  await narr('숟가락이 앞에 놓여 있다.');
  const v = G.vars;
  const acts = [];
  if (!leftover && v.yuri_sync >= 80) acts.push(['유리를 먹는다', endBad1]);
  if (!leftover && v.yuri_sync >= 50 && v.momo_trust < 30) acts.push(['유리에게 먹힌다', endBad2]);
  acts.push(['식탁에서 일어난다', () => (v.memory >= 80 && v.cult_truth >= 80 && v.momo_trust >= 60) ? endTrue() : endNormal()]);
  const a = await ask(acts.map(x => x[0]));
  await acts[a][1]();
}

async function endCard(id, after) {
  const info = ENDINGS_INFO.find(e => e.id === id);
  recordDayEnd(G.day, id);
  addEnding(id);
  G.flags.timeFlows = false;
  sepia(false); UI.cg = null; UI.cgAlpha = 0;
  await black([`『${info.title}』`]);
  if (after && after.length) {
    await wait(300);
    await black(['그 뒤의 세 사람', ...after]);
  }
  await wait(400);
  await afterEnding();
}

/* 결말 뒤 — 분기점으로 바로 되돌아가기 (마지막 식탁 / DAY 7 아침 / 타이틀) */
function reachableAtTable(v) {
  const out = [];
  if (v.yuri_sync >= 80) out.push('포식자');
  if (v.yuri_sync >= 50 && v.momo_trust < 30) out.push('피식자');
  out.push(v.memory >= 80 && v.cult_truth >= 80 && v.momo_trust >= 60 ? '나와 너의 사이' : '두 사람 몫의 식탁');
  return out;
}
async function afterEnding() {
  const seen = endingsSeen(), br = readBranches(), rec = readRecord();
  const opts = [], acts = [];
  if (br.d7_choice || br.d7_table) {
    const key = br.d7_choice ? 'd7_choice' : 'd7_table', can = reachableAtTable(br[key].s.vars);
    opts.push('마지막 식탁으로 돌아간다'); acts.push(() => startFromBranch(BRANCH_POINTS.find(b => b.id === key)));
    UI.endHint = '마지막 식탁에서 볼 수 있는 결말: ' + can.map(t => `『${t}』`).join(' · ');
  }
  if (rec.days[7]) { opts.push('DAY 7 아침으로 돌아간다'); acts.push(() => startFromDay(7, rec.days[7].start, clone(rec.days[7].start.vars))); }
  opts.push('다른 날의 분기점 고르기 (RECORD)'); acts.push(async () => { showTitle(); openRecord(); });
  opts.push('타이틀로'); acts.push(async () => showTitle());
  bgm(null);
  const lines = [`본 결말 ${seen.length} / ${ENDINGS_INFO.length}`];
  if (UI.endHint) lines.push(UI.endHint);
  if (rec.days[7] && !seen.includes('secret')) lines.push('DAY 7 아침에는 급식실에 가기 전에 다른 곳에 들를 수 있다.');
  UI.endHint = null;
  await black(lines);
  const i = await ask(opts, '어디로 돌아갈까?');
  await acts[i]();
}
/* D7-E01 『포식자』 — 합일의 성공을 확정하지 않는다 */
async function endBad1() {
  await narr('숟가락을 든다.');
  await fadeOut(1000);
  UI.cg = null; UI.cgAlpha = 0;
  await black(['유리의 기억이 흘러들어 온다.', '교리책 여백의 밑줄. 리본을 묶어 주던 내 손. 처음 나눠 먹은 식권.', '백 번이 넘는 3월 13일.', '어디까지가 내 기억이었는지 모르겠다.']);
  UI.cg = cgPick('cg_end_bad1'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1200);
  await say('유리의 목소리', '{N}.', null);
  await say('hero', '……응.', 5, { raw: true });
  await think('(나는 입을 열지 않았다.)');
  await think('(그런데 입 안쪽에서, 누군가 천천히 혀를 움직였다.)');
  await fadeOut(1500);
  await endCard('bad1', ["이안 — 수첩 마지막 장. '전학생'이 지워지고, 그 자리에 '유리'라고 적혀 있다.",
    '모모 — 창가 자리에 빈 도시락통만 놓여 있다.', '유리 — ……']);
}
/* D7-E02 『피식자』 — 반복을 아침 장면으로만 암시한다 */
async function endBad2() {
  await say('yuri', '……고마워. 잘 먹겠습니다.', 1);
  await narr('유리가 숟가락을 든다.');
  await fadeOut(1200);
  UI.cg = null; UI.cgAlpha = 0;
  await black(['다음 날 아침.']);
  UI.cg = cgPick('cg_end_bad2'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1200);
  await narr('유리가 혼자 교실에 앉아 있다. 책상 위에 도시락이 두 개.');
  await narr('유리는 두 개를 모두 먹는다. 천천히, 남김없이.');
  await fadeOut(1500);
  await endCard('bad2', ["이안 — 다음 주 수첩 첫 장. '3월 13일. 전학생이 온다.'",
    '모모 — 3월 13일, 모모는 오늘도 이쪽을 보지 않는다.', '유리 — 도시락은 두 개다.']);
}
/* D7-E03 『두 사람 몫의 식탁』 */
async function endNormal() {
  await narr('식탁에서 일어나 급식실을 나선다.');
  await narr('정문이 열려 있다.');
  if (flag('momoGate')) await think('(문 옆에 빈 도시락통이 하나 놓여 있다. 모모는 보이지 않는다.)');
  await fadeOut(1200);
  UI.cg = null; UI.cgAlpha = 0;
  await black(['학교 밖에는 아무것도 없었다.', '끝없이 이어진 식탁과 의자뿐.']);
  UI.cg = cgPick('cg_end_normal'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1200);
  await narr('빈 의자에 앉자, 맞은편에 나와 똑같이 생긴 사람이 나타난다.');
  await say('???', '늦었네. 기다리고 있었어.', null);
  await fadeOut(1500);
  await endCard('normal', ["이안 — 수첩에 한 줄. '오늘 한 명이 나갔다. 이름은 기억나지 않는다.'",
    flag('momoGate') ? '모모 — 정문 옆의 빈 도시락통.' : '모모 — 지하실 문 앞에 아무도 없다.',
    '유리 — 식탁에 혼자 앉아 있다. 숟가락은 두 개다.']);
}
/* D7-E04 『나와 너의 사이』 — 시계가 8시 14분이 되는 것은 이 결말뿐 */
async function endTrue() {
  await say('hero', '네가 나를 먹었다는 건 안 변해.', 7, { raw: true });
  await say('yuri', '알아.', 0);
  await say('hero', '내가 너한테 먹히고 싶어 했다는 것도.', 4, { raw: true });
  await say('yuri', '응.', 2);
  await say('hero', '그래도 우리는 서로 다른 사람이었어.', 7, { raw: true });
  await narr('식탁에서 일어난다.');
  await wait(600);
  sfx('tick');
  G.flags.timeFlows = true;
  await narr('……째깍.');
  await narr('시계 바늘이 움직이는 소리가 들린다.');
  await fadeOut(1200);
  UI.cg = cgPick('cg_end_true'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1200);
  await narr('정문이 열려 있다. 바람이 들어온다.');
  if (flag('momoGate')) await think('(문 옆에 빈 도시락통이 하나 놓여 있다. 모모는 보이지 않는다.)');
  if (has('ian_notebook')) await think('(주머니 속 수첩이 묵직하다. 이안이 남긴 기록이다.)');
  await narr('문을 나서기 직전, 등 뒤에서 유리가 내 이름을 부른다.');
  await say('yuri', '{N}.', 0);
  await narr('돌아보지 않았다.');
  if (flag('leftover')) {
    await narr('주머니에 쪽지 한 장이 들어 있다. 도시락 뚜껑에 붙어 있던 것과 같은 종이다.');
    await doc(TRUE_NOTE_DOC);
    await think('(돌아보지 않았는데도, 등 뒤에서 유리가 웃고 있다는 걸 알았다.)');
  }
  await fadeOut(1500);
  UI.cg = null; UI.cgAlpha = 0;
  await black(['우리는 서로의 일부가 되지 못했다.', '그럼에도 너는 나를 알고 있었다.']);
  const info = ENDINGS_INFO.find(e => e.id === 'true');
  recordDayEnd(G.day, 'true'); addEnding('true');
  await black([`『${info.title}』`]);
  await wait(300);
  await black(['그 뒤의 세 사람',
    has('ian_notebook') ? "이안 — 수첩 마지막 장. '나는 이안이다. 이젠 기억할 수 있다.'" : '이안 — 수첩 마지막 장이 비어 있다.',
    flag('momoNamed') ? '모모 — 가슴의 이름표를 만지작거린다. 글씨가 하나뿐이다.' : '모모 — 정문 쪽으로 처음 손을 흔든다.']);
  if (flag('leftover')) {
    const n = cgPick('cg_end_true_lunchbox');
    if (n) { UI.cg = n; UI.cgAlpha = 1; await fadeIn(900); }
    await black(['유리 — 다음 날 아침, 유리는 처음으로 도시락을 하나만 싼다. 한 사람 몫.']);
    UI.cg = null; UI.cgAlpha = 0;
  } else await black(['유리 — 유리는 오늘도 도시락 두 개를 싼다. 하나는 그대로 남는다.']);
  G.flags.timeFlows = false;
  sepia(false);
  await wait(400);
  await afterEnding();
}

/* D7-S01 지하 제단 / 제0차 보고서 → D7-S02 접시 하나 */
function secretReady() { return G.vars.memory >= 100 && G.vars.cult_truth >= 100; }
const ZERO_DOC = { type: 'paper', title: '최초의 의식', lines: [
  '이 의식은 두 사람을 하나로 만드는 기술이 아니다.', '!한 사람의 기억을', '!여러 사람에게 나누어 심는 기술이다.',
  '학생들은 모두 누군가의 기억에서 만들어진다.', '원래의 두 사람은 처음부터 여기 없었다.'] };
async function deepAltar() {
  if (G.day < 7) {
    if (has('ritual_record')) await narr('제단이다. 기록이 놓여 있던 자리만 먼지가 없다.');
    else await narr('제단이다. 기록이 놓여 있던 자국이 식탁 끝 기록함 쪽으로 끌려가 있다.');
    return;
  }
  if (dflag('final')) { await narr('제단이다. 아무것도 놓여 있지 않다.'); return; }
  if (!secretReady()) { await narr('제단이다. 아무것도 놓여 있지 않다.'); await think('(아직 덜 기억났다. 그런 느낌이 든다.)'); return; }
  await endSecret();
}

/* RECORD에서 되돌아갈 수 있는 분기점 (결말을 가르는 선택 직전). DAY 3 꿈의 손, DAY 4 손등 상처는 '그날 아침부터'로 */
const BRANCH_POINTS = [
  { id: 'd1_lunch', day: 1, label: '점심 — 유리의 도시락 / 급식', run: () => lunchScene() },
  { id: 'd2_lunch', day: 2, label: '점심 — 도시락 / 급식 / 먹지 않기', run: () => lunchChoice() },
  { id: 'd3_lunch', day: 3, label: '점심 — 도시락 / 급식 / 먹지 않기', run: () => lunchChoice() },
  { id: 'd3_momo', day: 3, label: '모모의 부탁 — 어제랑 똑같은 아침?', run: () => momoBasementInvite(ev('momoK')) },
  { id: 'd3_yuri', day: 3, label: '유리의 질문 — 지하에 갔다고 말할까', run: () => yuriTalk3(ev('yuri')) },
  { id: 'd4_meal', day: 4, label: '점심과 특별한 식사 (양호실의 모모까지)', run: () => lunchDay() },
  { id: 'd5_lunch', day: 5, label: '점심 — 도시락 / 급식 / 먹지 않기', run: () => lunchChoice() },
  { id: 'd5_mirror', day: 5, label: '모모의 거울 — 나 원래 이렇게 생겼어?', run: () => momoMirror(ev('momoW')) },
  { id: 'd5_yuri', day: 5, label: '유리 — 우리 기억', run: () => yuriTalk5(ev('yuri')) },
  { id: 'd6_lunch', day: 6, label: '점심 — 도시락 / 급식 / 먹지 않기', run: () => lunchChoice() },
  { id: 'd6_record', day: 6, label: '기록함 — 합일 의식 기록 (두 번째 추격)', run: () => recordBox() },
  { id: 'd6_yuri', day: 6, label: '유리 — 좋아하니까', run: () => yuriTalk6(ev('yuri')) },
  { id: 'd7_table', day: 7, label: '마지막 식탁', run: () => transfer('cafeteria', 4, 6, 'up') },
  { id: 'd7_choice', day: 7, label: '마지막 식탁 — 질문과 선택', run: async () => { dflag('final', true); await finalChoice(); } },
];

const STARTERS = { 2: startDay2, 3: startDay3, 4: startDay4, 5: startDay5, 6: startDay6, 7: startDay7 };

/* 타이틀의 EAT — 이름과 성별을 그대로 둔 채 처음부터 (결말 기록은 남는다) */
STORY.eat = async function () {
  const s = readSave();
  const name = (s && s.name) || G.name || '……', gender = (s && s.gender) || G.gender || 'f';
  Object.assign(G, { name, gender, day: 1, phase: 0, vars: { memory: 0, yuri_sync: 0, momo_trust: 0, cult_truth: 0 }, flags: {}, items: [], objective: '' });
  bgm(null);
  UI.fade = 1;
  await black(['……', '잘 먹겠습니다.']);
  await STORY.start();
};


/* ================================================================= 수치의 연출 신호 (기획서 v1.2 표) */
/* 화면에 숫자는 보이지 않는다. 학교가 조금씩 다르게 행동한다.
   memory ≥50  배식대 냄새가 '어디서 맡아 본 냄새'로 바뀜
   memory ≥80  거울 속 동작 지연이 사라짐
   yuri_sync ≥50  주인공 말끝에 유리의 말투(~잖아)가 섞임
   yuri_sync ≥80  주인공 대사 일부가 유리 얼굴로 출력, 거울 속 내가 유리의 버릇을 따라 함
   momo_trust <30  모모가 이쪽을 보지 않음(말을 걸어도 돌아보지 않음)
   momo_trust ≥60  아침마다 모모가 교실의 빈 책상(주인공의 원래 자리)에 앉아 있음
   cult_truth ≥50  2층 교실 창밖으로 지하실이 보임
   cult_truth ≥80  화면 시계가 이따금 08:14로 넘어갔다가 돌아옴 */

// 모모는 신뢰가 30 이상일 때만 돌아본다
for (const m of Object.values(MAPS)) for (const e of m.events || []) if (e.sprite === 'momo') e.turn = () => G.vars.momo_trust >= 30;

// 교실을 불러올 때 모모 자리 결정
const _loadMap = loadMap;
loadMap = function (id) {
  if (id === 'classroom' && G.day >= 7) id = 'classroom7';
  _loadMap(id);
  if (id === 'classroom') {
    const m = ev('momo');
    if (m && G.day >= 2 && G.vars.momo_trust >= 60) { m.x = 8; m.y = 10; }   // 빈 책상(내 원래 자리) 옆에서 기다린다
    if (m) { m.homeX = m.x; m.homeY = m.y; }
  }
};
async function moveTo(e, tx, ty, face) {
  let r = '';
  if (e.y !== 11) r += (e.y < 11 ? 'D' : 'U').repeat(Math.abs(11 - e.y));
  r += (tx > e.x ? 'R' : 'L').repeat(Math.abs(tx - e.x));
  if (ty !== 11) r += (ty < 11 ? 'U' : 'D').repeat(Math.abs(11 - ty));
  await move(e, r);
  if (face) e.dir = face;
}
async function momoSeatNote() {
  if (G.day >= 2 && G.day <= 6 && G.vars.momo_trust >= 60 && !dflag('momoSeat')) {
    dflag('momoSeat', true);
    await narr('모모가 빈 책상 옆에서 기다리고 있다.');
  }
}

/* A-03 / D5-09 기숙사 거울 — yuri_sync 80 이상이면 유리의 버릇이 우선, memory 80 이상이면 지연 없음 */
async function mirrorSignal() {
  if (G.vars.yuri_sync >= 80) await narr('무심코 머리카락을 귀 뒤로 넘긴다. ……유리의 버릇이다.');
  else if (G.vars.memory >= 80) await narr('거울 속의 나는 나와 똑같이 움직인다.');
  else await narr('거울 속의 나는 같은 동작을 한다. 손을 내리는 순간, 아주 짧게 늦는다.');
  await narr('손을 멈춘다. 아무 소리도 들리지 않는다.');
}

// 주인공 대사: 유리의 말투와 얼굴이 섞인다
const _say = say;
let heroLines = 0;
say = function (who, text, face = 0, opt = {}) {
  if (who === 'hero' && !opt.raw) {
    let t = fmt(text);
    const v = G.vars;
    if (v.yuri_sync >= 50 && /([^잖]야|었어)\.$/.test(t)) {
      t = t.replace(/([^잖])야\.$/, '$1잖아.').replace(/었어\.$/, '었잖아.');
      if (!dflag('ticNoted')) {
        dflag('ticNoted', true);
        return _say(who, t, face, opt).then(() => think('(……방금 그건, 유리의 말투였다.)'));
      }
    }
    if (v.yuri_sync >= 80 && ++heroLines % 3 === 0 && face !== null) {
      const p = _say(who, t, face, Object.assign({}, opt, { faceSheet: 'face_yuri' }));
      if (!dflag('faceNoted') && !flag('faceNoted')) { flag('faceNoted', true); return p.then(() => think('(……방금, 내 얼굴이 아니었다.)')); }
      return p;
    }
    return _say(who, t, face, opt);
  }
  return _say(who, text, face, opt);
};

/* ================================================================= 엔딩 목록 */
/* DAY 1 점심 — 두 개의 도시락 */
async function lunchScene() {
  await wait(300);
  sfx('bell');
  await narr('점심시간 종이 울렸다.');
  await say('yuri', '{N}, 여기!', 1);
  await say('yuri', '짠. 도시락 싸 왔어. 두 개.', 1);
  await say('hero', '두 개나?', 1);
  await say('yuri', '하나는 네 거야.', 0);
  await say('hero', '나 오늘 처음 왔잖아. 내가 올 줄 어떻게 알았어?', 3);
  await say('yuri', '응. 그래서 네 것도 싸 왔어.', 0);
  await think('(대답이 대답이 아니다.)');
  const c = await ask(['유리의 도시락을 먹는다', '급식을 먹는다']);
  if (c === 0) {
    flag('d1_lunchbox', true);
    await say('yuri', '먹어 봐. 네가 좋아하는 맛이야.', 1);
    await narr('처음 먹어 보는 맛이다.');
    await think('(……그런데 맛있다. 혀보다 몸이 먼저 아는 맛이다.)');
    await narr('도시락 뚜껑 안쪽에 작은 쪽지가 붙어 있다.');
    await yuriNote(1);
    gain('yuri_sync', 10);
    await say('yuri', '와, 다 먹었네.', 1);
    await say('yuri', '하나도 안 남겼어. ……잘했어.', 5);
  } else {
    await narr('오늘 급식은 고기 스튜, 흰 빵, 우유다.');
    await narr('스튜에서 들큼한 냄새가 올라온다.');
    await think('(……무슨 고기지?)');
    const d = await ask(['물어본다', '그냥 먹는다']);
    if (d === 0) {
      await say('hero', '저기, 이 스튜 뭐로 만든 거야?', 3);
      flag('d1_asked', true);
      shake(6);
      await say('all', '아하하하하하하하하.', null);
      await say('all', '……', null);
      await think('(급식실 전체가 동시에 웃고, 동시에 멈췄다.)');
      await say('yuri', '에이, 맛있으면 됐지. 그치?', 1);
    } else {
      await narr('스튜를 한 숟가락 떠 넣는다.');
      await think('(맛이…… 기억나지 않는다. 방금 삼켰는데.)');
    }
    await say('yuri', '그럼 이건 내가 먹을게. 남기면 안 되잖아.', 0);
    await narr('유리는 도시락 두 개를 천천히, 밥알 하나 남기지 않고 비웠다.');
    await think('(먹는 내내 유리는 나를 보고 있었다. 도시락이 아니라.)');
  }
  dflag('lunch', true);
  await say('yuri', '아, 맞다. 배식대에 식권을 두고 왔어.', 3);
  await say('yuri', '가져다줄래? 두 장 다.', 0);
  objective('배식대의 식권을 가져오자');
}

/* 유리의 쪽지 1~6 (v2.0) — 아이템 한 칸에 모아 둔다 ('유리의 쪽지 n/6') */
const YURI_NOTES = {
  1: ['이번에는 네가 좋아하는 것만 넣었어.', '지난번엔 많이 남겼잖아.', '오늘은 다 먹어 줘. ♡', '~— 유리'],
  2: ['어젯밤 2시 14분에 깼지.', '물 마시고 왼쪽으로 누웠어.', '오늘은 오른쪽으로 누워 줘.', '내 침대 쪽.'],
  3: ['아침에 모모랑 무슨 얘기 했어?', '괜찮아. 그냥 궁금해서.', '오늘도 같이 먹어줘서 고마워. ♡'],
  4: ['조금만 먹어.', '이따 특별한 식사가 있으니까.', '먼저 숟가락 내려놓으면 안 돼. 알지?'],
  5: ['이 반찬은 117번째 너가 제일 좋아했던 거.', '116번째 너는 싫다고 했어.', '그래서 116번째는 실패했어.'],
  6: ['마지막 도시락.', '남김없이.'],
};

async function yuriNote(n) {
  const list = G.flags.notes || (G.flags.notes = []);
  await doc({ type: 'paper', title: '', lines: YURI_NOTES[n] });
  if (list.includes(n)) return;
  list.push(n); list.sort();
  if (!has('yuri_notes')) G.items.push('yuri_notes');
  sfx('chime'); toast(`유리의 쪽지 ${n}을(를) 얻었다. (${list.length}/6)`);
}

/* DAY 2 점심 */
async function lunchScene2() {
  await wait(300);
  sfx('bell');
  await narr('점심시간 종이 울렸다.');
  await say('yuri', '{N}, 여기!', 1);
  await say('yuri', '오늘도 두 개 싸 왔어.', 1);
  await say('hero', '……어제도 두 개였지.', 3);
  await say('yuri', '기억하고 있었네?', 1);
  await say('yuri', '내 몫을 네 몫이랑 나누지 않는 거야. 교리 2장, 나눔.', 0);
  const y = ev('yuriL');
  const c = await ask(['유리의 도시락을 먹는다', '급식을 먹는다', '먹지 않는다']);
  if (c === 0) {
    await say('yuri', '먹어 봐.', 0);
    await narr('어제와 같은 맛이다.');
    await think('(……아니다. 어제보다 더 익숙한 맛이다.)');
    await yuriNote(2);
    await think('(어제 유리는 기숙사에 없었다.)');
    gain('yuri_sync', 10);
    await say('yuri', '오늘도 하나도 안 남겼네. 잘했어.', 1);
  } else {
    if (c === 1) {
      await narr('고기 스튜, 흰 빵, 우유. 어제와 똑같은 메뉴다.');
      if (flag('d1_asked')) await think('(어제 뭐로 만든 거냐고 물었을 때, 다들 웃었다. 똑같이.)');
      await narr('스튜를 떠 넣는다.');
      await think('(맛이 기억나지 않는다. 오늘도.)');
      await say('yuri', '급식이 더 좋아? ……괜찮아. 진짜로.', 5);
      await think('(유리는 웃고 있었다. 젓가락 끝은 도시락 바닥을 계속 긁고 있었다.)');
    } else {
      dflag('skipLunch', true);
      await say('yuri', '……안 먹어? 배 안 고파?', 3);
      await think('(배가 고프지 않다.)');
      await think('(마지막으로 배가 고팠던 게 언제였더라.)');
      if (once('lunch_skip_2')) gain('momo_trust', 6);
    }
    await say('yuri', '그럼 이건 내가 먹을게.', 0);
    if (y) evPose(y, 'yuri_pose', 1);
    await narr('유리는 오늘도 도시락 두 개를 천천히, 남김없이 비웠다.');
    if (y) evPose(y, null);
    if (c === 2) await think('(문득, 급식실 어디에도 모모가 없다는 걸 알아차렸다.)');
  }
  await say('yuri', '방과 후에 교실에서 기다릴게.', 0);
  dflag('lunch', true);
  dflag('afterLunch2', true);
  await day2AfterLunch();
}

/* DAY 3 점심 */
async function lunchScene3() {
  await wait(300);
  sfx('bell');
  await narr('점심시간 종이 울렸다.');
  await say('yuri', '{N}, 여기. 오늘도 두 개.', 1);
  await say('yuri', '어젯밤 꿈, 꿨지?', 0);
  await think('(대답도 안 했는데 유리는 고개를 끄덕였다. 당연하다는 듯이.)');
  const y = ev('yuriL');
  const c = await ask(['유리의 도시락을 먹는다', '급식을 먹는다', '먹지 않는다']);
  if (c === 0) {
    await narr('도시락을 연다. 어제와 같은 반찬이 같은 자리에 들어 있다.');
    await think('(젓가락이 먼저 계란말이로 간다. 내가 이걸 좋아했던가?)');
    await yuriNote(3);
    await think('(도시락은 아침에 싸 왔을 텐데. 모모가 말을 건 건 그 뒤였다.)');
    gain('yuri_sync', 10);
    await say('yuri', '역시. 계란말이부터 먹을 줄 알았어.', 1);
    const notes = G.flags.notes || [];
    if ([1, 2, 3].every(n => notes.includes(n))) {
      await say('yuri', '쪽지, 안 버렸구나?', 1);
      await say('yuri', '……버려도 되는데. 아니다, 버리지 마.', 0);
      await think('(유리가 머리카락을 귀 뒤로 넘겼다. 귀 끝이 빨갛다.)');
    }
  } else {
    if (c === 1) {
      await narr('고기 스튜, 흰 빵, 우유.');
      await narr('옆자리 아이들이 같은 속도로 숟가락을 든다. 정신을 차려 보니 나도 박자를 맞추고 있다.');
    } else {
      dflag('skipLunch', true);
      await say('yuri', '오늘도 안 먹어?', 3);
      await think('(배가 고프지 않다. 이제는 그게 이상하지도 않다.)');
      if (once('lunch_skip_3')) gain('momo_trust', 6);
    }
    await say('yuri', '그럼 이건 내가 먹을게.', 0);
    if (y) evPose(y, 'yuri_pose', 1);
    await narr('유리는 오늘도 도시락 두 개를 남김없이 비웠다.');
    if (y) evPose(y, null);
  }
  if (dflag('heldHand')) {
    await say('yuri', '꿈에서 손 잡아 줬지. 따뜻했어.', 1);
    await say('yuri', '다음에는 놓지 말아줘.', 5);
  } else await say('yuri', '꿈에서 이번에도 손 안 잡더라. 매번 그래.', 0);
  await say('yuri', '방과 후에 교실에서 기다릴게.', 0);
  dflag('lunch', true);
  await afternoon(['오후 수업이 끝났다.', '아무도 졸지 않았다. 다들 충분히 잔 사람처럼.'], 'hall1', 6, 2);
  objective('방과 후 — 급식실의 모모에게');
}

/* DAY 3 운동장 — 모모 */
async function momoField3(e) {
  if (await momoTagCheck()) return;
  await say('momo', '방과 후. 급식실. 까먹지 마.', 0);
}

/* 점심 (DAY 4~6 공통) — DAY 4는 이어서 특별한 식사 */
async function lunchDay() {
  const d = G.day;
  await wait(300);
  sfx('bell');
  await narr('점심시간 종이 울렸다.');
  if (d === 4) {
    await say('yuri', '오늘도 두 개.', 1);
    await say('yuri', '조금만 먹어. 이따 특별한 식사가 있으니까.', 0, { alt: '조금만 남겨. 이따 내가 먹게.' });
  } else if (d === 5) {
    await say('yuri', '오늘 반찬, 기억나?', 0);
    await think('(기억난다. 처음 보는 반찬인데, 기억이 난다.)');
  } else {
    await say('yuri', '도시락은 오늘이 마지막이야.', 0);
    await say('yuri', '내일은 식탁에서 먹자. 제대로.', 5);
  }
  const y = ev('yuriL');
  const c = await ask(['유리의 도시락을 먹는다', '급식을 먹는다', '먹지 않는다']);
  if (c === 0) {
    gain('yuri_sync', 10);
    await yuriNote(d);
    if (d === 4) await say('yuri', '네가 먹는 동안엔 나도 안 내려놔.', 5);
    if (d === 5) await think('(……117번째 너?)');
    await narr(d === 6 ? '마지막 도시락을 남김없이 먹었다.' : '도시락을 남김없이 먹었다.');
    await say('yuri', '오늘도 하나도 안 남겼네.', 1);
  } else {
    if (c === 1) {
      await narr('고기 스튜, 흰 빵, 우유.');
      if (d === 5) await say('ian', '맛있다. ……어제도 이 말 했나? 적어 둘걸.', 2);
    } else {
      dflag('skipLunch', true);
      if (once('lunch_skip_' + d)) gain('momo_trust', 6);
      await think('(배가 고프지 않다.)');
    }
    await say('yuri', '그럼 이건 내가 먹을게.', 0);
    if (y) evPose(y, 'yuri_pose', 1);
    await narr('유리는 도시락 두 개를 남김없이 비웠다.');
    if (y) evPose(y, null);
  }
  dflag('lunch', true);
  if (d === 4) { await specialMeal(); return; }
  await say('yuri', '방과 후에 교실에서 기다릴게.', 0);
  if (d === 5) {
    await afternoon(['오후 수업이 끝났다.', '종례 시간, 선생님은 한 사람의 이름으로 여러 학생을 불렀다.', '부름을 받은 학생들은 모두 대답했다.'], 'hall2', 4, 2);
    objective('교실의 유리에게 가자');
  } else {
    await afternoon(['오후 수업이 끝났다.', '빈자리가 아침보다 하나 더 늘어 있었다.'], 'hall1', 6, 2);
    objective('방과 후 — 급식실의 모모에게');
  }
}

/* 유리의 서랍 (DAY 4~) */
const YURI_DRAWER_DOC = { type: 'paper', title: '편지 묶음', lines: [
  '3월 13일 — 또 남겼어. 다음엔 더 잘할게.', '3월 13일 — 오늘도 날 못 알아봤어. 다음엔 더 잘할게.', '3월 13일 — 손을 잡아 줬어. 다음엔 더 잘할게.',
  '3월 13일 — 한 숟가락. 다음엔 더 잘할게.', '3월 13일 — 다음엔 더 잘할게.', '3월 13일 — 다음엔 더 잘할게.', '~보낸 사람도, 받는 사람도 없다.'] };

/* 기숙사의 유리 (DAY 4~6 밤, 옆 침대) */
async function yuriBedTalk() {
  if (G.day === 4) {
    await say('yuri', '왔어?', 0);
    await say('yuri', '오늘 먹었든 안 먹었든 괜찮아. 어차피 접시는 비어 있었잖아.', 5);
  } else if (G.day === 5) {
    await say('yuri', '편지, 찾았구나.', 0);
    await say('yuri', '그 편지 쓴 날 밤에도 우리 이렇게 누워 있었어. 이 침대, 이 자리에.', 1);
  } else if (G.day === 6) {
    await say('yuri', '내일은 깨우러 안 갈게.', 0);
    await say('yuri', '식탁에서 기다릴게. 늦지 마. 마지막 장이니까.', 5);
  } else await say('yuri', '잘 자, {N}.', 0);
}

/* 교무실 분실물 상자 (DAY 2~) */
async function lostFound() {
  if (G.day < 2) { await narr('분실물 상자다. 뚜껑에 『분실물 — 주인은 교무실로』.'); return; }
  if (!has('ribbon')) {
    await narr('분실물 상자다. 뚜껑에 『분실물 — 주인은 교무실로』.');
    await doc({ type: 'ledger', title: '분실물 장부', cols: [['날짜', 140], ['물건', 220], ['주인', 200]], rows: [['3월 13일', '빨간 리본', '']] });
    await narr('상자는 비어 있다. 장부에는 리본 한 줄만 있다.');
    await think('(물건은 없는데 분실물로 적혀 있다. 아직 아무도 잃어버리지 않았는데.)');
    return;
  }
  const owners = ['', G.name, '유리', `${G.name}, 유리`, `유리 (${G.name}에서 고침)`, `${G.name} — 유리 — ${G.name} — 유리`, '우리'];
  const rows = [];
  for (let d = 1; d <= Math.min(7, G.day); d++) rows.push(['3월 13일', '빨간 리본', owners[d - 1] || '']);
  if (flag('lostFoundSeen')) {
    await doc({ type: 'ledger', title: '분실물 장부', cols: [['날짜', 140], ['물건', 220], ['주인', 260]], rows });
    await narr('분실물 장부의 주인 칸이 또 고쳐져 있다.');
    return;
  }
  flag('lostFoundSeen', true);
  await narr('분실물 상자다. 장부가 펼쳐져 있다.');
  await doc({ type: 'ledger', title: '분실물 장부', cols: [['날짜', 140], ['물건', 220], ['주인', 260]], rows, note: '같은 물건이 날마다 다시 적혀 있다. 글씨체는 전부 같다.' });
  await think('(주인 칸의 이름이 날마다 바뀌어 있다.)');
  await narr('주머니 속 리본을 꺼내 상자 위에 올려놓는다.');
  sfx('door');
  await narr('등 뒤에서 선생님 목소리가 들린다.');
  await say('teacher', '어머, 주인을 찾았네요.', 1);
  await say('teacher', '그건 돌려받는 물건이 아니에요.', 0);
  await say('teacher', '둘이 나눠 쓰렴. 원래 그렇게 쓰는 거니까.', 1);
  glitch(320);
  dflag('officeEmpty', true);
  await think('(돌아봤을 때, 교무실에는 아무도 없었다.)');
  await narr('리본은 다시 내 손에 쥐어져 있다.');
  gain('memory', 5);
}

/* 모모와 접시 (아래쪽 식탁) */
async function momoPlates() {
  if (G.day < 6 || !dflag('deepTalk')) { await narr('접시에 이름이 새겨져 있다.'); return; }
  if (flag('momoMeal4')) { await narr('모모의 이름이 새겨진 접시들. 글씨가 전부 다르다.'); return; }
  await narr('모모의 이름이 새겨진 접시가 여러 개 있다. 글씨가 전부 다르다.');
  if (dflag('momoGone')) { await think('(모모가 여기 있었다면……)'); return; }
  const c = await ask(['하나를 모모에게 건넨다', '그대로 둔다']);
  if (c !== 0) return;
  flag('momoMeal4', true);
  const m = ev('momoD') || ev('momoL');
  if (m) m.dir = m.x < player.x ? 'right' : 'left';
  await say('momo', '……', 4);
  await say('momo', '이건 누가 기억한 나야?', 3);
  const d = await ask(['내가 새로 써 줄게', '그건 중요하지 않아']);
  if (d === 0) {
    await say('hero', '내가 새로 써 줄게.', 0);
    await narr("제단 옆에 빈 이름표가 한 장 놓여 있다. '모모'라고 적는다.");
    await think('(내 글씨다.)');
    await say('momo', '……이건 네 글씨네.', 2);
    await narr('모모가 이름표를 한참 들여다본다.');
    await say('momo', '……이건 좀 마음에 든다.', 5);
    await say('momo', '이건 내가 고른 거야. 네가 쓴 거지만, 받기로 한 건 나니까.', 5);
    if (await cgShow(['cg_day6_momo_tag'], 700)) { await wait(1400); await cgOff(600); }
    gain('momo_trust', 10);
    flag('momoNamed', true);
  } else {
    await say('hero', '그건 중요하지 않아.', 7);
    await say('momo', '……그래. 그 말도 나쁘진 않네.', 5);
    gain('momo_trust', 5);
  }
  if (m) m.dir = 'up';
}

/* 합일 의식 기록 */
const RITUAL_DOC = () => ({ type: 'ledger', title: '합일 의식 기록', cols: [['회차', 80], ['참가자', 220], ['결과', 280]],
  rows: [[1, `유리 / ${G.name}`, '실패 — 한 몸 안에 둘이 남음'], [2, `유리 / ${G.name}`, '실패'], [3, `유리 / ${G.name}`, '실패'],
    ['…', '…', '…'], ['?', `유리 / ${G.name}`, '진행 중'], ['', '모모', '도주 — 재구성 불완전']],
  note: '실패는 완성에 가까워지는 과정이다.' });

/* 이안 확인 — 이름표 접시와 의식 기록을 둘 다 봤을 때 (추격 중이 아닐 때) */
async function checkIan() {
  if (G.day !== 6 || dflag('ianDeep') || !flag('plates6') || !has('ritual_record') || Chase.active) return;
  dflag('ianDeep', true);
  dflag('ianB', true);
  const i = ev('ianB');
  sfx('door');
  await narr('계단을 내려오는 발소리.');
  if (i) { i.dir = 'left'; player.dir = 'right'; }
  await say('ian', '규칙 어겼네.', 2);
  await say('ian', '……나도 어겼어. 한 번이 아니더라. 수첩에 적혀 있었어.', 3);
  await say('ian', '일체회는 시간을 되돌리는 게 아니야. 끝나지 않은 의식을 되풀이하는 거지.', 2);
  await say('ian', '끝내는 방법은 두 가지라고 적혀 있어. 한쪽이 다른 쪽을 남김없이 받아들이거나, 둘 다 서로를 놓거나.', 2);
  await say('ian', '다만 그게 진짜 끝인지는 아무도 몰라. 끝까지 가 본 사람이 없거든.', 3);
  if (hasPiece(3)) {
    await say('hero', '규칙 말이야. 원래는 반대였지?', 3);
    await say('ian', '……그걸 어디서.', 3);
    await say('ian', '맞아. 처음엔 경고였어.', 2);
    await say('ian', '하지 말라고 써 둔 건데, 어느새 반드시 해야 하는 규칙이 돼 있더라.', 2);
    await say('ian', '나도 지켰어. 회장이니까.', 3);
  }
  if (pieceCount() >= 5) {
    await say('ian', '……내 쪽지가 다섯 장이나 있었구나.', 3);
    await say('ian', '다 내 글씨체네. 기억은 안 나지만.', 2);
    await say('ian', '……너한테 잘해 주라고 적어 놨네.', 1);
    await say('ian', '이유는 모르겠는데, 나도 동의해.', 1);
  }
  if (flag('momoTag')) {
    await think('(주머니의 이름표를 꺼내 이안의 수첩 옆에 대 본다. ……글씨체가 같다.)');
    await say('hero', '이거, 네 글씨 맞지?', 3);
    await say('ian', '……내 글씨네.', 3);
    await say('ian', '나는 모모를 잘 몰라. 같은 반이라는 것밖에.', 2);
    await say('ian', '근데 손이 기억하네. 이 이름을 몇 번이나 썼는지.', 3);
    sfx('step');
    const cgOn = await cgShow(['cg_day6_ian_momo'], 700);
    await say('momo', '……너였어?', 2);
    await say('ian', '아마도.', 2);
    await say('momo', '왜.', 1);
    await say('ian', '모르겠어. 적어 두지 않으면 네가 없어질 것 같았나 봐.', 3);
    await say('momo', '……나도 기억 안 나. 근데 네 글씨는 남아 있네.', 5);
    if (cgOn) await cgOff(600);
    gain('momo_trust', 5);
  }
  await say('ian', '유리를 만나. 오늘 안에. 내일이면 늦어.', 2);
  dflag('ianB', false);
  objective('교실의 유리에게 가자');
}

/* DAY 6 — 유리와 대화 */
async function yuriTalk6(e) {
  if (G.phase >= 3) { e.dir = 'up'; return; }
  if (!dflag('ianDeep')) { await say('yuri', '모모가 기다리고 있지 않아? 다녀와. 난 여기 있을게.', 0); e.dir = 'up'; return; }
  await say('yuri', '다 봤구나.', 0);
  await say('yuri', '그럼 알겠네. 다 교리대로였어. 처음부터.', 1);
  await say('yuri', '실패해도 괜찮다고 했어. 다음엔 더 잘하면 되니까.', 0);
  const c = await ask(['몇 번이나 실패했는데?', '모모한테는 무슨 짓을 했어?']);
  if (c === 0) {
    await say('hero', '몇 번이나 실패했는데?', 2);
    await say('yuri', '셀 수 없이.', 0);
    await say('yuri', '매번 네가 한 숟가락씩 남겼어. 그래서 실패했어.', 2);
    await say('yuri', '이번엔 안 남길 거야. 너도, 나도.', 5);
  } else {
    await say('hero', '모모한테는 무슨 짓을 했어?', 7);
    await say('yuri', '아무것도. 선생님께 말씀드렸을 뿐이야.', 3);
    await say('yuri', '그 애가 너를 데리고 나가려고 했으니까. 합일을 방해하는 건 죄잖아.', 3);
    await say('yuri', '그 애가 완전하지 않은 건 그 애가 도망쳐서야. 내 탓 아니야.', 0);
    await think('(유리는 정말로 모르는 얼굴이었다. 자기가 뭘 잘못했는지.)');
  }
  await say('hero', '……왜 그렇게까지 해?', 2);
  await say('yuri', '좋아하니까.', 1);
  await say('yuri', '좋아하면 이 정도는 할 수 있는 거 아니야?', 5);
  await say('yuri', '내일은 마지막 장이야.', 0);
  await say('yuri', '도망쳐도 돼. 교리에 도망치지 말라는 말은 없거든.', 0);
  await say('yuri', '그래도 내일 아침에 나는 네 이름을 부를 거야. 어디에 있든.', 5);
  e.dir = 'up';
  dflag('yuriLeft6', true);
  dflag('d6_yuriDone', true);
  setPhase(3);
  objective('기숙사로 가서 자자');
}

/* 이안의 수첩 조각 (①~⑤) */
function pieceList() { return G.flags.pieces || (G.flags.pieces = []); }

function hasPiece(n) { return pieceList().includes(n); }

function pieceCount() { return pieceList().length; }

/* SECRET — 제단의 제0차 보고서 */
async function endSecret() {
  dflag('final', true);
  await narr('제단 위에 접시가 하나 놓여 있다. 『{N}』');
  await narr('접시 밑에 아주 오래된 종이가 깔려 있다. 일체회의 최초 의식 기록이다.');
  await doc(ZERO_DOC);
  give('zero_report');
  await narr('학교의 학생들은 모두 누군가의 기억으로 빚어진 존재였다.');
  await think('(나도. 유리도.)');
  sfx('step');
  dflag('yuriSecret', true);
  const y = ev('yuriS'); if (y) y.dir = 'up'; player.dir = 'down';
  await fadeOut(1000);
  UI.cg = cgPick('cg_end_secret'); UI.cgAlpha = UI.cg ? 1 : 0;
  await fadeIn(1000);
  await say('hero', '너는 진짜 유리야?', 3, { raw: true });
  await say('yuri', '몰라.', 3);
  await say('hero', '그럼 나는?', 3, { raw: true });
  await say('yuri', '그것도 몰라.', 3);
  await say('hero', '그럼 우리가 함께했던 일들은?', 4, { raw: true });
  await say('yuri', '……교리에는, 그런 건 안 적혀 있었어.', 5);
  await narr('두 사람이 앉아 있는 식탁 위에는, 접시가 하나뿐이다.');
  await fadeOut(1500);
  await endCard('secret', ['이안 — 수첩 첫 장이 비어 있다.', '모모 — 냉장고의 이름표가 전부 같은 글씨다. 내 글씨.', '유리 — 잘 먹겠습니다.']);
}

/* ★ 남겨진 수첩 — DAY 7 이안의 책상 */
const IAN_NOTEBOOK_DOC = { type: 'paper', title: '수첩 — 마지막 장', lines: [
  '오늘의 나는 여기 없다.', '대신 이걸 두고 간다.', '!{N}, 너를 봤다.', '!내일의 내가 몰라도.', '~— 이안'] };

async function ianNotebook7() {
  if (G.day < 7) { await narr('이안의 책상이다. 필기구가 자로 잰 듯 놓여 있다.'); return; }
  if (has('ian_notebook')) { await narr('이안의 책상이다. 만년필만 남아 있다.'); return; }
  await narr('이안의 책상 위에 수첩이 덮인 채 놓여 있다. 만년필이 그 위에 가지런히 올려져 있다.');
  await doc(fmtDoc(IAN_NOTEBOOK_DOC));
  give('ian_notebook');
  await think('(이안은 끝까지 적었다. 내가 여기 있었다는 걸.)');
}

/* ★ 모모의 선택 — DAY 7, 모모 신뢰 ≥ 60, 1층 복도 정문 앞 */
async function momoGate(e) {
  if (flag('momoGate')) { await say('momo', '가. 유리가 기다리잖아.', 0); e.dir = 'down'; return; }
  const cgOn = await cgShow(['cg_day7_momo_gate'], 800);
  await say('momo', '……나 아직 있네.', 5);
  await say('momo', '유리가 나 원래 없었다고 했지? 걔 거짓말할 때 머리 넘기는 거, 봤어?', 0);
  await say('momo', '정문은 내가 열어 둘게. 너는 식탁에서, 네가 고른 걸 해.', 0);
  await say('hero', '너는?', 3);
  await say('momo', '난 못 나가. 여기서 만들어졌으니까. 밖엔 나를 기억하는 사람이 없어.', 4);
  const c = await ask(['내가 기억하면 되잖아', '……']);
  if (c === 0) {
    await say('hero', '내가 기억하면 되잖아.', 7);
    await say('momo', '……너 진짜 쉽게 말한다.', 2);
    await say('momo', '그럼 하나만. 나가면, 나를 한 번만 적어 줘. 네 글씨로.', 5);
  } else {
    await say('momo', '괜찮아. 이번엔 내가 골랐어. 도망치는 대신, 남기로.', 5);
  }
  if (flag('momoNamed')) await say('momo', '이름표는 내가 가져갈게. 이건 내 거니까.', 5);
  await say('momo', '가. 유리가 기다리잖아. ……기다리는 건 잘하니까, 걔.', 0);
  if (cgOn) await cgOff(700);
  flag('momoGate', true);
  e.dir = 'down';
}

const LEAVE_OPT = '남겨도 돼.';

/* 결말 『나와 너의 사이』 — 시계가 8시 14분이 되는 것은 이 결말뿐 */
const TRUE_NOTE_DOC = { type: 'paper', title: '', lines: ['남길게.', '!이번 한 번만.', '~— 유리'] };

/* ================================================================= 장소별 조사 (스크립트 v2.0) */
/* ★ 이안의 수첩 조각 ①~⑤ — 지난 회차의 이안이 남긴 한 장씩 (진실 +3, 묶음 아이템) */
const IAN_PIECES = {
  1: ['어제의 내가 오늘의 나에게.', '전학생이 오면 이름을 손바닥에 적어.', '수첩은 누가 가져갈 수도 있으니까.'],
  2: ['부모님 얼굴이 생각나지 않는다.', '식탁에 나란히 앉은 뒷모습만 기억난다.', '두 사람 앞에는 접시가 하나뿐이었다.'],
  3: ['규칙 셋은 내가 만들었다. 처음 쓴 건 이렇다.', '!하나, 식사를 남겨라.', '!둘, 밤에 유리를 혼자 두지 마라.', '!셋, 지하실에 모모가 있다.', '……누가 고쳤는지 모르겠다. 고친 글씨도 내 글씨다.'],
  4: ['모모. 출석부에 없음.', '내가 적지 않으면 모모는 존재하지 않는다.', '그러니까 매일 적는다.', '모모. 모모. 모모.'],
  5: ['오늘의 나에게.', '너는 내일 이걸 잊을 거야.', '괜찮아. 전학생이 기억해 줄 거야.', '~— 이안, 아마도 마지막'],
};
const CIRCLED = ['', '①', '②', '③', '④', '⑤'];
async function ianPiece(n) {
  const list = pieceList();
  await doc({ type: 'paper', title: '', lines: IAN_PIECES[n] });
  if (list.includes(n)) return;
  list.push(n); list.sort();
  if (!has('ian_pieces')) G.items.push('ian_pieces');
  gain('cult_truth', 3);
  sfx('chime'); toast(`이안의 수첩 조각 ${CIRCLED[n]}을(를) 얻었다. (${list.length}/5)`);
}
function piecesDoc() {
  const lines = [];
  for (const n of pieceList()) { if (lines.length) lines.push(''); lines.push('#' + CIRCLED[n]); lines.push(...IAN_PIECES[n]); }
  return { type: 'paper', title: '이안의 수첩 조각', lines };
}
function notesDoc() {
  const lines = [];
  for (const n of (G.flags.notes || [])) { if (lines.length) lines.push(''); lines.push('#쪽지 ' + n); lines.push(...YURI_NOTES[n]); }
  return { type: 'paper', title: '유리의 쪽지', lines };
}
function iconOf(...names) { for (const n of names) if (IMG[n]) return n; return names[names.length - 1]; }

/* 도서관 — 졸업앨범 (조각 ①) / 요리책 */
async function gradAlbum() {
  await doc({ type: 'book', pages: [{ left: ['', '', '#졸업을 축하합니다', '', '', '~우리는 언제나 함께입니다.'], right: [], album: true }] });
  await narr('사진 속 졸업생들은 모두 웃고 있다. 이름 칸은 전부 하얗게 지워져 있다.');
  if (G.day >= 2) await think('(해마다 사진이 다른데, 맨 뒷줄 같은 자리에 같은 얼굴이 있다. ……유리다. 몇 년 전 사진인데 지금이랑 똑같다.)');
  if (!hasPiece(1)) { await narr('페이지 사이에 수첩 한 장이 끼워져 있다.'); await ianPiece(1); }
}
async function cookbook() {
  await doc({ type: 'book', pages: [{ left: ['', '#처음 하는 사람을', '#위한 요리', '', '재료는 신선할수록 좋다.', '손질은 정성껏, 천천히.', '아무것도 버리지 말 것.'], right: [], torn: true }] });
  await narr('뒷부분이 전부 찢겨 나가 있다.');
  if (once('opt_cookbook')) { await narr('찢긴 자리가 깨끗하다. 누군가 아주 조심스럽게 뜯어냈다.'); gain('cult_truth', 10); }
}

/* 2층 복도 — 이안 */
async function ianHall(e) {
  const d = G.day, n = dcount('ianHallTalk');
  if (d >= 4 && !flag('ianParents')) {
    await say('ian', '……너, 합일이 뭔지 알아?', 2);
    await say('ian', '어릴 때 부모님이 합일 의식을 하는 걸 봤어.', 2);
    await say('ian', '두 사람은 하나가 됐다고 했어. 이제 하나도 외롭지 않다고.', 0);
    await say('ian', '그 뒤로 두 사람은 나를 알아보지 못했어.', 3);
    await say('ian', '……행복했을 거야. 그렇게 믿기로 했어.', 1);
    const c = await ask(['그거, 진짜 믿어?', '……그랬을 거야']);
    if (c === 0) {
      await say('hero', '그거, 진짜 믿어?', 3);
      await say('ian', '……', 3);
      await say('ian', '아니.', 2);
      await say('ian', '그래서 적는 거야. 내가 잊어버리면, 그 둘이 날 잊은 거랑 똑같아지니까.', 2);
      gain('cult_truth', 5);
    } else {
      await say('hero', '……그랬을 거야.', 4);
      await say('ian', '응. 고마워. 그 말도 적어 둘게. ……내일의 내가 그 말을 믿을 수 있게.', 1);
    }
    await think('(이안이 수첩을 덮는다. 손이 조금 떨리고 있었다.)');
    flag('ianParents', true); flag('opt_ian_parents', true);
    if (once('ianParentsTruth')) gain('cult_truth', 10);
    return;
  }
  if (d >= 4) { await say('ian', '규칙을 지키면 아무도 사라지지 않아. ……그렇게 적혀 있어. 빈자리가 늘고 있지만.', 2); return; }
  if (d === 3) {
    if (n === 1) { await say('ian', '지하실엔 내려가지 마. 규칙이야.', 2); await say('ian', '……근데 그 규칙, 누가 만들었는지 나도 몰라. 수첩 첫 장부터 적혀 있었거든.', 3); }
    else await say('ian', '7일이 지나면 이 수첩도 처음부터 다시 쓰게 될까. ……앞장에 그렇게 적혀 있어서.', 2);
    return;
  }
  if (d === 2) {
    if (n === 1) { await say('ian', '어제 너는 ' + (flag('d1_lunchbox') ? '유리 도시락을' : '급식을') + ' 먹었지. 적어 뒀어.', 0); await say('ian', '나만 그런 게 아니야. 요즘은 다들 하루면 흐려져.', 2); }
    else await say('ian', '오늘 일도 적어 둘 거야. 내일의 내가 읽을 수 있게. ……내일의 내가, 나라면.', 2);
    return;
  }
  if (n === 1) await say('ian', '게시판은 매주 같은 걸 붙여. 그래도 매주 확인하게 돼. 혹시 바뀌었을까 봐서.', 0);
  else await say('ian', '규칙은 기억하지? 식사는 남기지 않는다. ……그게 제일 중요해.', 0);
}

/* 양호실 — 약장 (조각 ②) */
async function medCabinet() {
  await narr('병마다 라벨이 붙어 있는데 전부 『소화제』다.');
  if (G.day >= 2 && !hasPiece(2)) { await narr('병 뒤에 접힌 종이가 끼워져 있다.'); await ianPiece(2); }
}
/* 예배당 — 긴 의자 (조각 ③) */
async function chapelPew() {
  await narr('앉는 자리가 하나도 닳지 않았다.');
  if (G.day >= 3 && !hasPiece(3)) {
    await narr('의자 밑에 수첩 한 장이 붙어 있다.');
    await ianPiece(3);
    await think('(내가 첫날 들은 규칙은…… 정반대였다.)');
  }
}
/* 지하 기록실 — 서가 (조각 ④) */
async function basementShelf() {
  await narr('출석부가 끝도 없이 꽂혀 있다. 등에 적힌 날짜가 전부 같다.');
  if (G.day >= 3 && !hasPiece(4)) { await narr('출석부 사이에 수첩 한 장이 끼워져 있다.'); await ianPiece(4); }
}
/* 지하 예배당 — 촛불 (조각 ⑤) */
async function deepCandle() {
  await narr('지하인데 바람도 없이 흔들린다.');
  if (G.day === 6 && !hasPiece(5)) { await narr('촛대 밑에 수첩 한 장이 깔려 있다. 촛농이 뚝뚝 떨어져 굳어 있다.'); await ianPiece(5); }
}

function applyLocationV2() {
  const T = (id) => MAPS[id].tileText || (MAPS[id].tileText = {});
  const A = (id) => MAPS[id].tileAction || (MAPS[id].tileAction = {});
  const E = (map, id) => (MAPS[map].events || []).find(e => e.id === id);
  // 2학년 A반
  T('classroom').B = () => G.day >= 7 ? ['칠판이 깨끗하게 지워져 있다. 지운 자국 아래로 글씨가 비친다. 『잘 먹겠습니다』.']
    : ['오늘의 말씀이 적혀 있다. 『' + BOARD_WORDS[Math.min(6, G.day)] + '』'].concat(G.day >= 2 ? ['……매일 같은 필체다. 선생님 글씨가 아니다.'] : [], ['구석의 날짜 — ' + boardDate() + '.']);
  T('classroom').N = () => G.vars.cult_truth >= 50 && count('winLook') % 2 === 1
    ? ['창밖으로…… 지하실이 보인다. 여기는 2층인데.'] : ['창밖으로 산이 보인다. 나무들이 그림처럼 꼼짝도 안 한다.'];
  if (MAPS.classroom7) MAPS.classroom7.tileText = Object.assign({}, MAPS.classroom.tileText, MAPS.classroom7.tileText, { B: MAPS.classroom.tileText.B });
  const momo = E('classroom', 'momo');
  if (momo) momo.action = async (e) => {
    const v = G.vars.momo_trust;
    if (G.day >= 2 && v >= 60) { await say('momo', '……여기, 원래 네 자리야. 알고나 앉아.', 1); await think('(모모는 빈 책상에서 비켜 주지 않았다. 자리를 지키고 있는 것처럼.)'); }
    else if (G.day >= 2 && v < 30) await think('(모모는 이쪽을 한 번도 보지 않는다.)');
    else if (once('momoClassFirst')) { await say('momo', '……', 0); await think('(대답이 없다. 창밖만 보고 있다.)'); }
    else await say('momo', '……뭘 봐. 할 말 없으면 가.', 1);
  };
  // 2층 복도
  T('hall2').N = () => G.phase >= 3 ? ['창밖이 깜깜하다. 유리에 비친 복도가 진짜 복도보다 조금 길다.'] : ['운동장에 아무도 없다.'];
  // 화장실
  T('restroom').S = ['칸 문이 전부 잠겨 있다. 안에서는 숨소리도 들리지 않는다.'];
  // 도서관
  const album = E('library', 'album'); if (album) album.action = async () => { await gradAlbum(); };
  const cook = E('library', 'cookbook'); if (cook) cook.action = async () => { await cookbook(); };
  T('library').N = ['창밖으로 산이 보인다. 아까와 달라진 게 하나도 없다.'];
  // 1층 복도
  T('hall1').E = ['정문이다. 열리지 않는다. 유리문 너머로 산이 보인다. 언제부터 저 색이었는지 기억나지 않는다.'];
  T('hall1').Y = () => G.phase >= 3 ? ['기숙사로 이어지는 문이다.'] : ['『방과 후 개방』이라고 적혀 있다.'];
  T('hall1').A = ['운동장으로 나가는 문이다. 잠겨 있다.'];
  T('hall1').O = () => G.day < 2 ? ['교무실이다. 잠겨 있다.', '안에서 출석 부르는 소리가 들린다.'] : ['교무실이다. 밤에는 잠겨 있다.', '안에서 출석 부르는 소리가 들린다.'];
  const m2 = E('hall1', 'momo2');
  if (m2) m2.action = async (e) => {
    if (once('momo2First')) { await think('(모모가 지하실 문 앞에 서 있다.)'); await say('momo', '……', 0); await say('momo', '……뭘 봐.', 1); }
    else await say('momo', '전학생은 일찍 자. 밤에 돌아다니지 말고.', 0);
    e.dir = 'up';
  };
  // 양호실
  A('infirmary').H = medCabinet;
  T('infirmary').N = ['운동장이 보인다.'];
  const mi = E('infirmary', 'momoI');
  if (mi) mi.action = async (e) => { await say('momo', '유리한테 가 봐. 그리고 오늘 들은 거, 잊지 마. 적어 두든가.', 0); e.dir = 'left'; };
  // 예배당
  A('chapel').P = chapelPew;
  // 지하 기록실
  A('basement').R = basementShelf;
  T('basement').I = () => G.day >= 6 ? ['쇠사슬이 풀려 있다. 문 위에 『예배당』.'] : ['쇠사슬로 친친 감긴 철문이다. 문 위에 작은 글씨로 『예배당』.'];
  A('basement').K = async () => { await narr('커다란 솥이다. 비어 있다. 안쪽이 아주 깨끗하게 닦여 있다.'); await think('(복도 지하실 문틈으로 올라오던 냄새는…… 여기서 난 걸까.)'); };
  // 급식실
  const yl = E('cafeteria', 'yuriL');
  if (yl) yl.action = async (e) => { await say('yuri', G.day === 1 && !has('ticket') ? '식권은 배식대에 있어. 두 장 다 가져와 줘.' : '천천히 먹어. 남기지 말고.', 0); e.dir = 'down'; };
  // 기숙사
  const bed2 = E('dorm', 'bed2');
  if (bed2) bed2.action = async () => {
    if (G.day >= 4 && G.phase >= 3 && G.day <= 6) { await yuriBedTalk(); return; }
    if (G.day === 3 && G.phase >= 3) { await say('yuri', '왔어? 잘 자, {N}. 꿈에서 봐.', 1); return; }
    if (G.day >= 7) { await narr('정리된 침대다.'); return; }
    if (G.day >= 2) { await narr('비어 있다.'); await think('(유리는 곧 온다고 했다.)'); return; }
    if (count('bed2') === 1) await narr('비어 있는 침대다. ……시트가 아직 따뜻하다.');
    else await narr('누군가 방금까지 누워 있었던 것 같다.');
  };
  // 과거의 2학년 A반
  Object.assign(T('pastroom'), {
    N: ['창밖의 산이 초록색이다. 지금과 계절이 다르다.'],
    B: ['낯선 글씨가 적혀 있다. 『사랑하는 사람을 위한 첫 수업』'],
    C: ['시계가 가고 있다. ……여기서는.'],
    P: ['꽃병에 생화가 꽂혀 있다. 조화가 아니다.'],
    d: ['누군가의 책상이다. 낙서가 있다. 『유리 + ……』 뒤는 지워져 있다.'],
  });
  // 지하 예배당
  A('deepchapel').c = deepCandle;
  const md = E('deepchapel', 'momoD');
  if (md) md.action = async (e) => {
    if (flag('plates6') && has('ritual_record')) await say('momo', '이안 얘기 들었지. 가. 유리한테.', 0);
    else if (flag('plates6') && !flag('momoMeal4')) await say('momo', '……아래 줄 식탁에 내 이름 접시도 있더라. 기록함은 식탁 끝.', 0);
    else await say('momo', '천천히 봐. 여기 있는 건 다 누군가였어.', 0);
    e.dir = 'up';
  };
}
applyLocationV2();

const ENDINGS_INFO = [
  { id: 'bad1', title: '포식자', cg: 'cg_end_bad1', trace: '입을 열지 않았다.',
    desc: '유리를 먹었다. 그런데 대답은 내가 하지 않았다.', hint: '유리와 아주 가까워진 채로, 마지막 식탁에서.' },
  { id: 'bad2', title: '피식자', cg: 'cg_end_bad2', trace: '남김없이.',
    desc: '유리에게 먹혔다. 다음 날에도 도시락은 두 개였다. 유리는 둘 다 혼자 먹었다.', hint: '유리와 가깝고, 모모를 믿지 않았다면.' },
  { id: 'normal', title: '두 사람 몫의 식탁', cg: 'cg_end_normal', trace: '"늦었네."',
    desc: '학교를 나섰지만, 밖에도 식탁뿐이었다.', hint: '식탁에서 일어난다. 아직 모르는 것이 많은 채로.' },
  { id: 'true', title: '나와 너의 사이', cg: 'cg_end_true', trace: '째깍.',
    desc: '서로의 일부가 되지 못한 채로, 시계가 움직이기 시작했다.', hint: '기억하고, 진실을 알고, 모모를 믿은 채로 일어난다.' },
  { id: 'secret', title: '식탁의 주인', cg: 'cg_end_secret', trace: '접시는 하나뿐이었다.',
    desc: '처음부터 두 사람은 여기 없었다. 접시는 하나뿐이었다.', hint: '모든 것을 모은 뒤, 식탁에 가기 전에 가장 깊은 곳으로.' },
];

/* ================================================================= 바닥 변형 (세 장을 섞어 쓰기) */
const FLOOR_VARIANTS = {
  tiles_classroom: { 0: [0, 24, 25], 16: [16, 26, 27] },
  tiles_hallway: { 0: [0, 16, 17] },
  tiles_cafeteria: { 0: [0, 16, 17] },
  tiles_chapel: { 0: [0, 16, 17] },
  tiles_basement: { 0: [0, 16, 17] },
  tiles_outdoor: { 0: [0, 16, 17], 1: [1, 18, 19] },
};
for (const m of Object.values(MAPS)) {
  const L = m.legend = Object.assign({}, m.legend);
  for (const k of Object.keys(L)) {
    const v = L[k];
    if (Array.isArray(v) && FLOOR_VARIANTS[v[0]] && FLOOR_VARIANTS[v[0]][v[1]]) L[k] = [v[0], FLOOR_VARIANTS[v[0]][v[1]], v[2]];
  }
}
