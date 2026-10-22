(() => {
  'use strict';

  /* ========================================================
     常量
     ======================================================== */
  const FRAME = 14;                    // 方框边长（格）
  const MIN_SIDE = 3;                  // 矩形最小边长，避免出现细条
  const MAX_RECTS = 9;                 // 初始矩形上限
  const ANSWER_PASSWORD = '1024';      // 查看答案的默认密码
  const STORE_KEY = 'ai1024-advanced-pack-v1';
  const VALID_COUNTS = [4, 5, 6, 8, 10, 12, 14, 16];
  const TONES = ['#ecd4a4', '#dfbe86', '#f1ddb7', '#d3ae76', '#e7caa0', '#c9a269'];
  const EPS = 1e-7;

  /* ========================================================
     状态
     ======================================================== */
  const state = {
    seed: 0,
    target: 10,
    pieces: [],
    placements: {},   // id -> { x, y }
    rotations: {},    // id -> 0..3
    wasSolved: false,
    unlocked: false
  };

  let pieceById = new Map();
  let drag = null;
  let toastTimer = null;
  let pointerPos = null;
  let autoScrollDir = 0;
  let autoScrollFrame = null;

  const els = {};

  /* ========================================================
     伪随机
     ======================================================== */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
  }

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function randomSeed() {
    return (Math.random() * 0x7fffffff) | 0;
  }

  /* ========================================================
     几何
     ======================================================== */
  function roundNum(value) {
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 1e-6 ? rounded : Math.round(value * 1e6) / 1e6;
  }

  function dedupe(poly) {
    const out = [];
    poly.forEach(point => {
      const x = roundNum(point[0]);
      const y = roundNum(point[1]);
      const last = out[out.length - 1];
      if (!last || Math.abs(last[0] - x) > 1e-6 || Math.abs(last[1] - y) > 1e-6) {
        out.push([x, y]);
      }
    });
    while (out.length > 1) {
      const first = out[0];
      const last = out[out.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
        out.pop();
      } else {
        break;
      }
    }
    return out;
  }

  function polygonArea(poly) {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
  }

  function polygonCentroid(poly) {
    let twice = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const cross = a[0] * b[1] - b[0] * a[1];
      twice += cross;
      cx += (a[0] + b[0]) * cross;
      cy += (a[1] + b[1]) * cross;
    }
    if (Math.abs(twice) < 1e-9) {
      let sx = 0;
      let sy = 0;
      poly.forEach(point => {
        sx += point[0];
        sy += point[1];
      });
      return [sx / poly.length, sy / poly.length];
    }
    return [cx / (3 * twice), cy / (3 * twice)];
  }

  function normalizePolygon(poly) {
    const clean = dedupe(poly);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    clean.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });

    return {
      poly: clean.map(([x, y]) => [x - minX, y - minY]),
      w: maxX - minX,
      h: maxY - minY,
      ox: minX,
      oy: minY
    };
  }

  // 用一条经过 a、b 的直线把凸多边形切成两块
  function splitPolygon(poly, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const sideOf = point => dx * (point[1] - a[1]) - dy * (point[0] - a[0]);

    function half(sign) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const current = poly[i];
        const next = poly[(i + 1) % poly.length];
        const dc = sideOf(current) * sign;
        const dn = sideOf(next) * sign;

        if (dc >= -EPS) out.push(current);
        if ((dc > EPS && dn < -EPS) || (dc < -EPS && dn > EPS)) {
          const t = dc / (dc - dn);
          out.push([
            current[0] + (next[0] - current[0]) * t,
            current[1] + (next[1] - current[1]) * t
          ]);
        }
      }
      return dedupe(out);
    }

    return [half(1), half(-1)];
  }

  function projectPolygon(poly, axisX, axisY) {
    let min = Infinity;
    let max = -Infinity;
    poly.forEach(([x, y]) => {
      const value = x * axisX + y * axisY;
      if (value < min) min = value;
      if (value > max) max = value;
    });
    return [min, max];
  }

  // 分离轴定理：返回两块是否真的重叠（贴边不算）
  function polygonsOverlap(a, b) {
    const polys = [a, b];
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        let axisX = -(p2[1] - p1[1]);
        let axisY = p2[0] - p1[0];
        const length = Math.hypot(axisX, axisY);
        if (length < EPS) continue;
        axisX /= length;
        axisY /= length;

        const [amin, amax] = projectPolygon(a, axisX, axisY);
        const [bmin, bmax] = projectPolygon(b, axisX, axisY);
        if (amax <= bmin + 1e-6 || bmax <= amin + 1e-6) return false;
      }
    }
    return true;
  }

  /* ========================================================
     出题：矩形 → 随机分裂
     ======================================================== */
  function makeRects(count, random) {
    const rects = [{ x: 0, y: 0, w: FRAME, h: FRAME }];
    let guard = 0;

    while (rects.length < count && guard++ < 800) {
      const options = [];
      rects.forEach((rect, index) => {
        if (rect.w >= MIN_SIDE * 2) {
          options.push({ index, axis: 'v', weight: rect.w * rect.h * rect.w });
        }
        if (rect.h >= MIN_SIDE * 2) {
          options.push({ index, axis: 'h', weight: rect.w * rect.h * rect.h });
        }
      });
      if (!options.length) return null;

      let total = 0;
      options.forEach(option => { total += option.weight; });
      let ticket = random() * total;
      let chosen = options[options.length - 1];
      for (const option of options) {
        ticket -= option.weight;
        if (ticket <= 0) {
          chosen = option;
          break;
        }
      }

      const rect = rects[chosen.index];
      let parts;
      if (chosen.axis === 'v') {
        const cut = randInt(random, MIN_SIDE, rect.w - MIN_SIDE);
        parts = [
          { x: rect.x, y: rect.y, w: cut, h: rect.h },
          { x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }
        ];
      } else {
        const cut = randInt(random, MIN_SIDE, rect.h - MIN_SIDE);
        parts = [
          { x: rect.x, y: rect.y, w: rect.w, h: cut },
          { x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }
        ];
      }
      rects.splice(chosen.index, 1, ...parts);
    }

    return rects.length === count ? rects : null;
  }

  // 保证每种分裂方式至少出现一次，其余随机
  function makeModes(count, random) {
    const modes = [];
    const seeds = ['tri', 'diag', 'trap'];
    for (let i = 0; i < Math.min(count, seeds.length); i++) modes.push(seeds[i]);
    const pool = ['tri', 'diag', 'trap', 'tri', 'trap'];
    while (modes.length < count) {
      modes.push(pool[Math.floor(random() * pool.length)]);
    }
    return shuffle(modes, random);
  }

  // 三种切法：两个三角形 / 三角形+梯形 / 两个梯形
  function splitRect(rect, mode, random) {
    const x0 = rect.x;
    const y0 = rect.y;
    const w = rect.w;
    const h = rect.h;
    const corners = [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + h],
      [x0, y0 + h]
    ];

    let a;
    let b;

    if (mode === 'diag') {
      if (random() < 0.5) {
        a = [x0, y0];
        b = [x0 + w, y0 + h];
      } else {
        a = [x0 + w, y0];
        b = [x0, y0 + h];
      }
    } else if (mode === 'tri') {
      const cut = randInt(random, 2, w - 1);
      const corner = randInt(random, 0, 3);
      if (corner === 0) {
        a = [x0, y0];
        b = [x0 + cut, y0 + h];
      } else if (corner === 1) {
        a = [x0 + w, y0];
        b = [x0 + cut, y0 + h];
      } else if (corner === 2) {
        a = [x0 + w, y0 + h];
        b = [x0 + cut, y0];
      } else {
        a = [x0, y0 + h];
        b = [x0 + cut, y0];
      }
    } else {
      if (random() < 0.5) {
        const t1 = randInt(random, 1, w - 1);
        let t2 = randInt(random, 1, w - 2);
        if (t2 >= t1) t2 += 1;
        a = [x0 + t1, y0];
        b = [x0 + t2, y0 + h];
      } else {
        const t1 = randInt(random, 1, h - 1);
        let t2 = randInt(random, 1, h - 2);
        if (t2 >= t1) t2 += 1;
        a = [x0, y0 + t1];
        b = [x0 + w, y0 + t2];
      }
    }

    const parts = splitPolygon(corners, a, b)
      .filter(poly => poly.length >= 3 && polygonArea(poly) >= 0.5);

    return parts.length === 2 ? parts : null;
  }

  function makePiece(poly) {
    const info = normalizePolygon(poly);
    return {
      id: 0,
      label: '',
      poly: info.poly,
      w: info.w,
      h: info.h,
      sol: { x: info.ox, y: info.oy },
      shapes: [null, null, null, null]
    };
  }

  function buildPieces(rects, target, random) {
    const splitCount = target - rects.length;
    if (splitCount < 0 || splitCount > rects.length) return null;

    const order = rects.map((_, index) => index);
    shuffle(order, random);
    const chosen = new Set(order.slice(0, splitCount));
    const modes = makeModes(splitCount, random);
    let modeIndex = 0;
    const pieces = [];

    rects.forEach((rect, index) => {
      const corners = [
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x + rect.w, rect.y + rect.h],
        [rect.x, rect.y + rect.h]
      ];

      if (!chosen.has(index)) {
        pieces.push(makePiece(corners));
        return;
      }

      const mode = modes[modeIndex++];
      const parts = splitRect(rect, mode, random);
      if (!parts) {
        pieces.push(makePiece(corners));
        return;
      }
      parts.forEach(poly => pieces.push(makePiece(poly)));
    });

    if (pieces.length !== target) return null;

    pieces.forEach((piece, index) => {
      piece.id = index + 1;
      piece.label = String(index + 1);
    });
    return pieces;
  }

  function generatePuzzle(seed, target) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const random = mulberry32((seed + attempt * 7919) >>> 0);
      const minRects = Math.ceil(target / 2);
      const maxRects = Math.min(target - 1, MAX_RECTS);
      const rectCount = maxRects >= minRects ? randInt(random, minRects, maxRects) : minRects;
      if (rectCount < 1) continue;

      const rects = makeRects(rectCount, random);
      if (!rects) continue;

      const pieces = buildPieces(rects, target, random);
      if (!pieces) continue;

      return { seed, target, pieces };
    }
    return null;
  }

  /* ========================================================
     拼图状态
     ======================================================== */
  function shapeOf(piece, rotation) {
    if (!piece.shapes[rotation]) {
      let poly = piece.poly;
      for (let i = 0; i < rotation; i++) {
        poly = poly.map(([x, y]) => [-y, x]);
      }
      piece.shapes[rotation] = normalizePolygon(poly);
    }
    return piece.shapes[rotation];
  }

  function canPlace(id, x, y) {
    const piece = pieceById.get(id);
    if (!piece || !Number.isInteger(x) || !Number.isInteger(y)) return false;

    const shape = shapeOf(piece, state.rotations[id] || 0);
    if (x < 0 || y < 0 || x + shape.w > FRAME || y + shape.h > FRAME) return false;

    const placedPoly = shape.poly.map(([px, py]) => [px + x, py + y]);

    for (const key of Object.keys(state.placements)) {
      const otherId = Number(key);
      if (otherId === id) continue;
      const other = pieceById.get(otherId);
      const otherPos = state.placements[otherId];
      if (!other || !otherPos) continue;
      const otherShape = shapeOf(other, state.rotations[otherId] || 0);
      const otherPoly = otherShape.poly.map(([px, py]) => [px + otherPos.x, py + otherPos.y]);
      if (polygonsOverlap(placedPoly, otherPoly)) return false;
    }

    return true;
  }

  function isSolved() {
    return state.pieces.length > 0 && state.pieces.every(piece => Boolean(state.placements[piece.id]));
  }

  /* ========================================================
     渲染
     ======================================================== */
  function renderBoard() {
    const parts = [];

    // viewBox 必须用方框坐标，否则图形会按 1 单位 = 1 像素绘制，全部缩在左上角
    els.board.setAttribute('viewBox', `0 0 ${FRAME} ${FRAME}`);
    els.board.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    for (let i = 1; i < FRAME; i++) {
      parts.push(`<line class="grid-line" x1="${i}" y1="0" x2="${i}" y2="${FRAME}"></line>`);
      parts.push(`<line class="grid-line" x1="0" y1="${i}" x2="${FRAME}" y2="${i}"></line>`);
    }

    state.pieces.forEach(piece => {
      const pos = state.placements[piece.id];
      if (!pos) return;

      const shape = shapeOf(piece, state.rotations[piece.id] || 0);
      const points = shape.poly
        .map(([x, y]) => `${x + pos.x},${y + pos.y}`)
        .join(' ');
      const center = polygonCentroid(shape.poly);
      const cx = center[0] + pos.x;
      const cy = center[1] + pos.y;
      const fontSize = Math.max(0.55, Math.min(1.7, Math.min(shape.w, shape.h) * 0.42));
      const tone = TONES[piece.id % TONES.length];

      parts.push(`<g class="board-piece" data-piece-id="${piece.id}" tabindex="0" role="button" aria-label="第 ${piece.label} 块">
        <polygon class="piece-poly" fill="${tone}" points="${points}"></polygon>
        <text class="piece-label" x="${cx}" y="${cy}" font-size="${fontSize}">${piece.label}</text>
      </g>`);
    });

    const solved = isSolved();
    els.board.innerHTML = parts.join('');
    els.board.classList.toggle('is-solved', solved);
    els.boardWrap.classList.toggle('is-solved', solved);
  }

  function trayShapeSvg(piece, shape) {
    // 所有托盘块使用同一比例，尺寸关系与棋盘上一致
    const scale = 12;
    const width = shape.w * scale;
    const height = shape.h * scale;
    const center = polygonCentroid(shape.poly);
    const fontSize = Math.max(0.5, Math.min(1.8, Math.min(shape.w, shape.h) * 0.4));
    const points = shape.poly.map(([x, y]) => `${x},${y}`).join(' ');
    const tone = TONES[piece.id % TONES.length];

    return `<svg viewBox="0 0 ${shape.w} ${shape.h}" width="${width}" height="${height}" aria-hidden="true">
      <polygon points="${points}" fill="${tone}" stroke="rgba(80,58,32,.6)" stroke-width="1.2" vector-effect="non-scaling-stroke"></polygon>
      <text class="shape-label" x="${center[0]}" y="${center[1]}" font-size="${fontSize}">${piece.label}</text>
    </svg>`;
  }

  function renderTray() {
    const remaining = state.pieces.filter(piece => !state.placements[piece.id]);

    if (!remaining.length) {
      els.tray.innerHTML = '<p class="tray-empty">所有块都已经进框，方框正好铺满。</p>';
      return;
    }

    els.tray.innerHTML = remaining.map(piece => {
      const shape = shapeOf(piece, state.rotations[piece.id] || 0);
      return `<button class="tray-piece" type="button" data-piece-id="${piece.id}"
        aria-label="第 ${piece.label} 块，拖动进框，单击旋转 90 度">${trayShapeSvg(piece, shape)}</button>`;
    }).join('');
  }

  function renderStats() {
    const placed = Object.keys(state.placements).length;
    const total = state.pieces.length;
    const solved = isSolved();

    els.placed.textContent = String(placed);
    els.total.textContent = String(total);
    els.progress.textContent = `已放入 ${placed} / ${total}`;
    els.boardState.textContent = solved ? '已复原' : '拼图中';
    els.boardState.dataset.state = solved ? 'solved' : 'playing';
    els.clear.disabled = placed === 0;
  }

  function renderSolution() {
    const parts = [];
    for (let i = 1; i < FRAME; i++) {
      parts.push(`<line class="grid-line" x1="${i}" y1="0" x2="${i}" y2="${FRAME}"></line>`);
      parts.push(`<line class="grid-line" x1="0" y1="${i}" x2="${FRAME}" y2="${i}"></line>`);
    }

    state.pieces.forEach(piece => {
      const shape = shapeOf(piece, 0);
      const points = shape.poly
        .map(([x, y]) => `${x + piece.sol.x},${y + piece.sol.y}`)
        .join(' ');
      const center = polygonCentroid(shape.poly);
      const cx = center[0] + piece.sol.x;
      const cy = center[1] + piece.sol.y;
      const fontSize = Math.max(0.5, Math.min(1.5, Math.min(shape.w, shape.h) * 0.36));
      const tone = TONES[piece.id % TONES.length];

      parts.push(`<g>
        <polygon class="solution-poly" fill="${tone}" points="${points}"></polygon>
        <text class="piece-label" x="${cx}" y="${cy}" font-size="${fontSize}">${piece.label}</text>
      </g>`);
    });

    els.solutionFrame.innerHTML = `<svg viewBox="0 0 ${FRAME} ${FRAME}" role="img" aria-label="这一局的原始切法">${parts.join('')}</svg>`;
  }

  function renderAll() {
    renderBoard();
    renderTray();
    renderStats();
    if (state.unlocked) renderSolution();

    const solved = isSolved();
    if (solved && !state.wasSolved) toast('拼回来了，严丝合缝。');
    state.wasSolved = solved;
  }

  /* ========================================================
     拖拽与旋转
     ======================================================== */
  function pointInside(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // 拖到屏幕边缘时自动滚动，避免棋盘与托盘不在同一屏时拖不过去
  function stopAutoScroll() {
    autoScrollDir = 0;
    if (autoScrollFrame) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  }

  function autoScrollTick() {
    if (!drag || autoScrollDir === 0) {
      autoScrollFrame = null;
      return;
    }
    window.scrollBy(0, autoScrollDir * 18);
    refreshGhostValidity();
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function updateAutoScroll(clientY) {
    const edge = 100;
    const dir = clientY < edge ? -1 : (window.innerHeight - clientY < edge ? 1 : 0);
    if (dir === autoScrollDir) return;
    stopAutoScroll();
    if (dir !== 0) {
      autoScrollDir = dir;
      autoScrollFrame = requestAnimationFrame(autoScrollTick);
    }
  }

  function refreshGhostValidity() {
    if (!drag || !drag.ghost || !pointerPos) return;

    const boardRect = els.board.getBoundingClientRect();
    const cell = boardRect.width / FRAME;

    if (!pointInside(pointerPos.x, pointerPos.y, boardRect)) {
      drag.ghost.classList.remove('is-valid', 'is-invalid');
      return;
    }

    const x = Math.round((pointerPos.x - drag.grabX * cell - boardRect.left) / cell);
    const y = Math.round((pointerPos.y - drag.grabY * cell - boardRect.top) / cell);
    const valid = canPlace(drag.id, x, y);
    drag.ghost.classList.toggle('is-valid', valid);
    drag.ghost.classList.toggle('is-invalid', !valid);
  }

  function makeGhost(piece, shape) {
    const boardRect = els.board.getBoundingClientRect();
    const cell = boardRect.width / FRAME;
    const center = polygonCentroid(shape.poly);
    const fontSize = Math.max(0.5, Math.min(1.8, Math.min(shape.w, shape.h) * 0.4));

    const ghost = document.createElement('div');
    ghost.className = 'adv-ghost';
    ghost.style.width = `${shape.w * cell}px`;
    ghost.style.height = `${shape.h * cell}px`;
    ghost.innerHTML = `<svg viewBox="0 0 ${shape.w} ${shape.h}" preserveAspectRatio="none">
      <polygon points="${shape.poly.map(([x, y]) => `${x},${y}`).join(' ')}"
        fill="${TONES[piece.id % TONES.length]}" stroke="rgba(80,58,32,.65)"
        stroke-width="1.2" vector-effect="non-scaling-stroke"></polygon>
      <text class="shape-label" x="${center[0]}" y="${center[1]}" font-size="${fontSize}">${piece.label}</text>
    </svg>`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function startDrag(event, id, fromBoard, element) {
    if (event.button > 0) return;
    const piece = pieceById.get(id);
    if (!piece) return;

    const boardRect = els.board.getBoundingClientRect();
    const cell = boardRect.width / FRAME;
    const shape = shapeOf(piece, state.rotations[id] || 0);
    let grabX;
    let grabY;

    if (fromBoard) {
      const pos = state.placements[id];
      if (!pos) return;
      grabX = (event.clientX - boardRect.left) / cell - pos.x;
      grabY = (event.clientY - boardRect.top) / cell - pos.y;
    } else {
      const svg = element.querySelector('svg');
      const rect = svg.getBoundingClientRect();
      grabX = ((event.clientX - rect.left) / rect.width) * shape.w;
      grabY = ((event.clientY - rect.top) / rect.height) * shape.h;
    }

    event.preventDefault();
    stopAutoScroll();
    pointerPos = { x: event.clientX, y: event.clientY };
    element.classList.add('is-dragging');
    drag = {
      id,
      fromBoard,
      grabX,
      grabY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null,
      element,
      shape
    };

    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    window.addEventListener('pointercancel', onDragUp);
  }

  function onDragMove(event) {
    if (!drag) return;

    pointerPos = { x: event.clientX, y: event.clientY };

    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.moved = true;
      const piece = pieceById.get(drag.id);
      drag.ghost = makeGhost(piece, drag.shape);
    }

    const boardRect = els.board.getBoundingClientRect();
    const cell = boardRect.width / FRAME;
    drag.ghost.style.left = `${event.clientX - drag.grabX * cell}px`;
    drag.ghost.style.top = `${event.clientY - drag.grabY * cell}px`;

    refreshGhostValidity();
    updateAutoScroll(event.clientY);
  }

  function cleanupDrag() {
    if (!drag) return;
    stopAutoScroll();
    if (drag.ghost) drag.ghost.remove();
    if (drag.element) drag.element.classList.remove('is-dragging');
    drag = null;
    pointerPos = null;
  }

  function onDragUp(event) {
    if (!drag) return;
    const current = drag;

    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', onDragUp);

    if (!current.moved) {
      cleanupDrag();
      rotatePiece(current.id);
      return;
    }

    const boardRect = els.board.getBoundingClientRect();
    const trayRect = els.tray.getBoundingClientRect();
    const cell = boardRect.width / FRAME;
    const overBoard = pointInside(event.clientX, event.clientY, boardRect);
    const overTray = pointInside(event.clientX, event.clientY, trayRect);

    if (overBoard) {
      const x = Math.round((event.clientX - current.grabX * cell - boardRect.left) / cell);
      const y = Math.round((event.clientY - current.grabY * cell - boardRect.top) / cell);

      if (canPlace(current.id, x, y)) {
        state.placements[current.id] = { x, y };
        cleanupDrag();
        save();
        renderAll();
        return;
      }
      toast('放不下：超出方框，或会和别的块重叠。');
    } else if (overTray && current.fromBoard) {
      delete state.placements[current.id];
      cleanupDrag();
      save();
      renderAll();
      return;
    }

    cleanupDrag();
  }

  function rotatePiece(id) {
    const piece = pieceById.get(id);
    if (!piece) return;

    const current = state.rotations[id] || 0;
    const next = (current + 1) % 4;
    const placed = state.placements[id];

    if (!placed) {
      state.rotations[id] = next;
      save();
      renderTray();
      return;
    }

    const nowShape = shapeOf(piece, current);
    const nextShape = shapeOf(piece, next);
    const centerX = placed.x + nowShape.w / 2;
    const centerY = placed.y + nowShape.h / 2;
    const baseX = Math.round(centerX - nextShape.w / 2);
    const baseY = Math.round(centerY - nextShape.h / 2);
    const offsets = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, -1], [1, -1], [-1, 1],
      [2, 0], [-2, 0], [0, 2], [0, -2],
      [2, 2], [-2, -2], [2, -2], [-2, 2]
    ];

    state.rotations[id] = next;
    for (const [dx, dy] of offsets) {
      if (canPlace(id, baseX + dx, baseY + dy)) {
        state.placements[id] = { x: baseX + dx, y: baseY + dy };
        save();
        renderAll();
        return;
      }
    }

    state.rotations[id] = current;
    toast('这个位置转不开，先挪个地方再转。');
  }

  /* ========================================================
     一局新题
     ======================================================== */
  function setPuzzle(seed, target, saved) {
    const puzzle = generatePuzzle(seed, target);
    if (!puzzle) return false;

    state.seed = seed;
    state.target = target;
    state.pieces = puzzle.pieces;
    state.placements = {};
    state.rotations = {};
    state.wasSolved = false;

    pieceById = new Map(state.pieces.map(piece => [piece.id, piece]));
    state.pieces.forEach(piece => {
      state.rotations[piece.id] = 0;
    });

    if (saved) restore(saved);
    state.wasSolved = isSolved();
    return true;
  }

  function startNewGame(target) {
    if (!VALID_COUNTS.includes(target)) target = 10;

    let ok = setPuzzle(randomSeed(), target, null);
    if (!ok) ok = setPuzzle(randomSeed(), target, null);
    if (!ok) {
      toast('这一局没生成出来，再点一次。');
      return;
    }

    save();
    renderAll();
    toast(`新的一局：${state.pieces.length} 块`);
  }

  function restore(saved) {
    const rotations = saved.rotations || {};
    Object.keys(rotations).forEach(key => {
      const id = Number(key);
      const rotation = rotations[key];
      if (pieceById.has(id) && Number.isInteger(rotation)) {
        state.rotations[id] = ((rotation % 4) + 4) % 4;
      }
    });

    const placements = saved.placements || {};
    Object.keys(placements).forEach(key => {
      const id = Number(key);
      const position = placements[key];
      if (!pieceById.has(id) || !position) return;
      if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) return;
      if (canPlace(id, position.x, position.y)) {
        state.placements[id] = { x: position.x, y: position.y };
      }
    });
  }

  /* ========================================================
     存取 / toast
     ======================================================== */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        seed: state.seed,
        target: state.target,
        placements: state.placements,
        rotations: state.rotations
      }));
    } catch (err) {
      /* localStorage 不可用时静默降级 */
    }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Number.isInteger(data.seed) || !VALID_COUNTS.includes(data.target)) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function toast(message) {
    let element = document.querySelector('.toast');
    if (!element) {
      element = document.createElement('div');
      element.className = 'toast';
      element.setAttribute('role', 'status');
      element.addEventListener('click', () => element.classList.remove('show'));
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 4500);
  }

  /* ========================================================
     答案区
     ======================================================== */
  function unlockAnswer() {
    state.unlocked = true;
    els.answerForm.hidden = true;
    els.answerBody.hidden = false;
    els.lockBadge.textContent = 'UNLOCKED';
    els.lockBadge.dataset.state = 'unlocked';
    renderSolution();
    toast('密码正确，答案已解锁。');
  }

  /* ========================================================
     事件
     ======================================================== */
  function bindUI() {
    els.board.addEventListener('pointerdown', event => {
      const group = event.target.closest('[data-piece-id]');
      if (!group) return;
      startDrag(event, Number(group.dataset.pieceId), true, group);
    });

    els.board.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const group = event.target.closest('[data-piece-id]');
      if (!group) return;
      event.preventDefault();
      rotatePiece(Number(group.dataset.pieceId));
    });

    els.tray.addEventListener('pointerdown', event => {
      const item = event.target.closest('[data-piece-id]');
      if (!item) return;
      startDrag(event, Number(item.dataset.pieceId), false, item);
    });

    els.tray.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('[data-piece-id]');
      if (!item) return;
      event.preventDefault();
      rotatePiece(Number(item.dataset.pieceId));
    });

    els.regen.addEventListener('click', () => startNewGame(Number(els.pieceCount.value)));
    els.pieceCount.addEventListener('change', () => startNewGame(Number(els.pieceCount.value)));

    els.clear.addEventListener('click', () => {
      state.placements = {};
      save();
      renderAll();
    });

    els.answerForm.addEventListener('submit', event => {
      event.preventDefault();
      if (els.answerKey.value.trim() === ANSWER_PASSWORD) {
        unlockAnswer();
        return;
      }
      els.answerCard.classList.add('shake');
      setTimeout(() => els.answerCard.classList.remove('shake'), 420);
      toast('密码不对。提示：和这个节日有关。');
      els.answerKey.select();
    });
  }

  /* ========================================================
     启动
     ======================================================== */
  function cacheElements() {
    const byId = id => document.getElementById(id);
    els.board = byId('boardSvg');
    els.boardWrap = byId('boardWrap');
    els.tray = byId('tray');
    els.placed = byId('placedCount');
    els.total = byId('totalCount');
    els.progress = byId('progressText');
    els.boardState = byId('boardState');
    els.clear = byId('clearBoard');
    els.pieceCount = byId('pieceCount');
    els.regen = byId('regenBtn');
    els.answerCard = byId('answerCard');
    els.answerForm = byId('answerForm');
    els.answerKey = byId('answerKey');
    els.answerBody = byId('answerBody');
    els.solutionFrame = byId('solutionFrame');
    els.lockBadge = byId('lockBadge');
  }

  function init() {
    cacheElements();
    bindUI();

    const saved = loadSaved();
    const target = saved ? saved.target : 10;
    els.pieceCount.value = String(target);

    let ready = false;
    if (saved) ready = setPuzzle(saved.seed, target, saved);
    if (!ready) ready = setPuzzle(randomSeed(), target, null);
    if (!ready) ready = setPuzzle(randomSeed(), 4, null);

    if (!ready) {
      els.tray.innerHTML = '<p class="tray-empty">生成失败，请刷新页面重试。</p>';
      renderStats();
      return;
    }

    if (state.target !== target) els.pieceCount.value = String(state.target);
    renderAll();
  }

  init();
})();
