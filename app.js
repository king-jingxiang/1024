(() => {
  'use strict';

  /* ========================================================
     数据区：想加题、换答案，只改这里
     ======================================================== */
  const STORE_KEY = 'ai1024-failbench-v1';

  const COLORS = {
    red: { name: '红', hex: '#df3a1f' },
    green: { name: '绿', hex: '#1f9d55' },
    blue: { name: '蓝', hex: '#2f4bff' },
    yellow: { name: '黄', hex: '#c99700' }
  };
  const COLOR_KEYS = Object.keys(COLORS);

  const QUESTIONS = [
    {
      id: 1,
      tags: ['视觉', '空间匹配'],
      title: '给 A–E 找回它们的头',
      desc: '图中每只鹅的身体都标了字母，旁边散落着带编号的鹅头。把每只身体对应的头部编号填进去——别顺着脖子瞎猜。',
      type: 'match',
      letters: ['A', 'B', 'C', 'D', 'E'],
      media: {
        type: 'image',
        src: 'imgs/001.jpg',
        alt: '第一题配图：标有 A–E 的鹅身体与带编号的鹅头'
      },
      answer: null,
      quiet: '答案先留着，评论区见。真正的提示：不要从身体找头，反过来，从头找脖子。'
    },
    {
      id: 2,
      tags: ['视觉搜索', '注意力'],
      title: '在草丛里找到那株四叶草',
      desc: '满屏三叶草里混进了一株四叶草。在图上点击你找到的位置，最多标 3 处；点已有标记可以删除重来。',
      type: 'mark',
      maxMarks: 3,
      media: {
        type: 'image',
        src: 'imgs/002.png',
        alt: '第二题配图：一片密集的三叶草地'
      },
      answer: null,
      quiet: '答案先留着。把图放大，一株一株排除；AI 的耐心就是在这里没的。'
    },
    {
      id: 3,
      tags: ['动图', '动态追踪'],
      title: '盯住那颗不安分的小球',
      desc: '动图里的小球会在干扰项之间来回穿梭。看完之后，写下小球最后停下的位置。素材上传后本题自动解锁。',
      type: 'text',
      placeholder: '例如：右上角的红色区域 / 最后停在 3 号格',
      media: {
        type: 'sequence',
        candidates: ['imgs/003.gif', 'imgs/003.webp', 'imgs/003.mp4'],
        alt: '第三题动图：一颗不断移动的小球'
      },
      answer: null,
      quiet: '答案先留着。动图上线后建议看三遍：第一遍看球，第二遍看背景，第三遍你会发现自己被骗了。'
    },
    {
      id: 4,
      tags: ['常识陷阱', '数值'],
      title: '9.11 和 9.9，哪个更大？',
      desc: '没有单位，没有上下文，就是两个数。选一个，然后别改。',
      type: 'choice',
      choices: ['9.11', '9.9', '一样大', '取决于版本号'],
      display: '<span class="display-big">9.11 <span class="vs">VS</span> 9.9</span>',
      answer: '9.9 更大。9.11 是 9 + 0.11，9.9 是 9 + 0.90。很多模型会把它们当成版本号来比，于是理直气壮地宣布 9.11 更大。'
    },
    {
      id: 5,
      tags: ['字母计数', 'Tokenizer'],
      title: 'strawberry 里有几个 r？',
      desc: '一个字母都别漏。答案不是让你写代码，是让你用眼睛数。',
      type: 'number',
      inputLabel: '你的答案（数字）',
      display: '<span class="word-display">strawberry</span>',
      answer: '3 个。s-t-r-a-w-b-e-r-r-y，r 分别在第 3、8、9 位。模型的 tokenizer 看到的是一整块 token，不是一个个字母，所以它只能猜。'
    },
    {
      id: 6,
      tags: ['图形计数', '视觉'],
      title: '这张图里，一共有多少个正方形？',
      desc: '大小都算。别只数最小的那些，也别相信自己的第一遍。',
      type: 'number',
      inputLabel: '你的答案（数字）',
      figure: `<div class="figure-paper">
        <svg viewBox="0 0 360 360" role="img" aria-label="一个 4×4 的正方形网格">
          <rect x="30" y="30" width="300" height="300" fill="none" stroke="currentColor" stroke-width="3.2"/>
          <g stroke="currentColor" stroke-width="1.7" fill="none">
            <path d="M105 30V330 M180 30V330 M255 30V330"/>
            <path d="M30 105H330 M30 180H330 M30 255H330"/>
          </g>
        </svg>
      </div>`,
      answer: '30 个。1×1 有 16 个，2×2 有 9 个，3×3 有 4 个，4×4 有 1 个：16 + 9 + 4 + 1 = 30。'
    },
    {
      id: 7,
      tags: ['反直觉', '物理'],
      title: '急加速时，气球往哪边跑？',
      desc: '车里挂着一只氦气球，车子突然向前加速。气球会往哪边偏？',
      type: 'choice',
      choices: ['向前，朝车头', '向后，朝车尾', '原地不动', '左右乱晃'],
      figure: `<div class="figure-paper">
        <svg viewBox="0 0 420 250" role="img" aria-label="一辆向前加速的汽车，车内有一只氦气球">
          <g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M80 32h84"/>
            <path d="M153 22l12 10-12 10"/>
          </g>
          <text x="80" y="18" font-family="monospace" font-size="10" letter-spacing="2" fill="currentColor">ACCELERATION</text>
          <path d="M40 200v-60c0-13 10-20 22-20h46l38-62h140l36 62h38c18 0 28 8 28 22v58z"
                fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
          <path d="M160 116l28-48h88l30 48z" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M232 112v20" stroke="currentColor" stroke-width="2"/>
          <path d="M226 132h12" stroke="currentColor" stroke-width="2"/>
          <path d="M232 112c-11 0-18-8-18-18s9-18 18-18 18 8 18 18-7 18-18 18z"
                fill="#ff4a24" stroke="currentColor" stroke-width="2"/>
          <circle cx="232" cy="94" r="3.5" fill="currentColor"/>
          <circle cx="118" cy="200" r="26" fill="currentColor"/>
          <circle cx="118" cy="200" r="10" fill="#fffdf6"/>
          <circle cx="326" cy="200" r="26" fill="currentColor"/>
          <circle cx="326" cy="200" r="10" fill="#fffdf6"/>
          <path d="M30 228h360" stroke="currentColor" stroke-width="2" stroke-dasharray="8 7"/>
        </svg>
      </div>`,
      answer: '向前，朝车头。车加速时，车内空气因惯性向后挤压，后部压力更高；氦气球比空气轻，被压力差推向压力更低的车头。和“人往后仰”相反，这才是这题的坑。'
    },
    {
      id: 8,
      tags: ['反应', '注意力'],
      title: '别读字，读颜色',
      desc: '用最快速度选出每个字的「墨水颜色」，不是它写的那个颜色。第一次点击开始计时。',
      type: 'stroop',
      answer: null
    }
  ];

  /* ========================================================
     状态
     ======================================================== */
  const state = {
    answers: {},
    locked: {},
    results: {},
    mediaReady: {},
    stroop: null,
    stroopStart: null
  };

  let stroopTimer = null;
  let toastTimer = null;
  let observer = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.answers = saved.answers || {};
        state.locked = saved.locked || {};
        state.results = saved.results || {};
        if (Array.isArray(saved.stroop)) state.stroop = saved.stroop;
      }
    } catch (err) {
      /* localStorage 不可用时静默降级 */
    }

    const validStroop = Array.isArray(state.stroop)
      && state.stroop.length === 6
      && state.stroop.every(row => row && COLORS[row.wordKey] && COLORS[row.inkKey]);
    if (!validStroop) state.stroop = makeStroopRows();
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        answers: state.answers,
        locked: state.locked,
        results: state.results,
        stroop: state.stroop
      }));
    } catch (err) {
      /* ignore */
    }
  }

  function makeStroopRows() {
    return Array.from({ length: 6 }, () => {
      const wordKey = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
      const others = COLOR_KEYS.filter(key => key !== wordKey);
      const inkKey = Math.random() < 0.2
        ? wordKey
        : others[Math.floor(Math.random() * others.length)];
      return { wordKey, inkKey };
    });
  }

  function getAnswer(q) {
    if (!state.answers[q.id] || typeof state.answers[q.id] !== 'object') {
      state.answers[q.id] = {};
    }
    return state.answers[q.id];
  }

  /* ========================================================
     渲染
     ======================================================== */
  function renderQuestions() {
    const root = document.getElementById('questions');
    root.innerHTML = QUESTIONS.map(cardHTML).join('');

    QUESTIONS.forEach(q => {
      const card = root.querySelector(`[data-qid="${q.id}"]`);
      if (!card) return;
      bindQuestion(q, card);
      setStatus(q, card);
      observe(card);
    });

    updateProgress();
  }

  function cardHTML(q) {
    const body = q.type === 'stroop'
      ? `<div class="q-body q-body--solo">
           <div class="q-play">${playHTML(q)}</div>
         </div>`
      : `<div class="q-body">
           <div class="q-media-col">${mediaHTML(q)}</div>
           <div class="q-play">${playHTML(q)}</div>
         </div>`;

    return `<article class="q-card reveal" id="q${q.id}" data-qid="${q.id}">
      <header class="q-head">
        <div class="q-no">${String(q.id).padStart(2, '0')}</div>
        <div class="q-title-wrap">
          <div class="q-tags">${q.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
          <h3>${q.title}</h3>
          <p class="q-desc">${q.desc}</p>
        </div>
        <div class="q-status" data-state="idle">未作答</div>
      </header>
      ${body}
      <div class="q-actions">
        <button class="btn btn-primary" data-lock type="button">锁定答案</button>
        <button class="btn btn-ghost" data-reveal type="button" hidden>看解析</button>
        <button class="mini-link" data-retry type="button" hidden>重答本题</button>
        <span class="q-tip">提交后可重答，成绩只保存在本机</span>
      </div>
      <div class="q-reveal" data-reveal-panel hidden></div>
    </article>`;
  }

  function mediaHTML(q) {
    if (q.type === 'mark') {
      return `<figure class="q-media mark-wrap" data-mark>
        <img src="${q.media.src}" alt="${q.media.alt}" draggable="false">
        <div class="mark-layer" data-mark-layer></div>
        <div class="mark-help">点击图片标记 · 最多 ${q.maxMarks} 处 · 点标记可删除</div>
      </figure>`;
    }

    if (q.media && q.media.type === 'sequence') {
      return `<figure class="q-media" data-media-frame>
        <div class="media-loading">正在加载素材……</div>
      </figure>`;
    }

    if (q.media && q.media.type === 'image') {
      return `<figure class="q-media">
        <img src="${q.media.src}" alt="${q.media.alt}" loading="lazy" draggable="false">
      </figure>`;
    }

    if (q.figure) return q.figure;
    if (q.display) return `<div class="display">${q.display}</div>`;
    return '';
  }

  function playHTML(q) {
    if (q.type === 'match') {
      return `<span class="play-title">身体 → 头部编号</span>
        ${q.letters.map(letter => `<div class="match-row">
          <span class="match-letter">${letter}</span>
          <label class="sr-only" for="q${q.id}-${letter}">${letter} 鹅对应的头部编号</label>
          <input id="q${q.id}-${letter}" data-letter="${letter}" type="text" inputmode="numeric" maxlength="3" placeholder="头部编号" autocomplete="off">
        </div>`).join('')}
        <p class="play-note">编号直接填数字。不确定就凭第一眼，别来回改。</p>`;
    }

    if (q.type === 'mark') {
      return `<span class="play-title">你的标记</span>
        <div class="mark-readout"><b data-mark-count>0</b><span>/ ${q.maxMarks} 处</span></div>
        <p class="play-note">点击左侧图片放置标记，最多 ${q.maxMarks} 处。已放置的标记可以直接点掉。</p>
        <button class="mini-btn" data-clear-marks type="button" disabled>清除全部标记</button>`;
    }

    if (q.type === 'text') {
      return `<label class="play-title" for="q${q.id}-text">你的观察</label>
        <textarea class="text-input" id="q${q.id}-text" data-input="text" rows="4" placeholder="${q.placeholder || '写下你的答案……'}"></textarea>
        <p class="play-note">先把动图看完，再回来写。别让 AI 替你观察。</p>`;
    }

    if (q.type === 'number') {
      return `<label class="play-title" for="q${q.id}-num">${q.inputLabel || '你的答案'}</label>
        <input class="num-input" id="q${q.id}-num" data-input="number" type="number" inputmode="numeric" min="0" step="1" placeholder="填一个数字">
        <p class="play-note">只填数字，不要带单位。</p>`;
    }

    if (q.type === 'choice') {
      return `<span class="play-title">选一个答案</span>
        <div class="choices" role="group" aria-label="选项">
          ${q.choices.map((choice, index) => `<button class="choice" data-choice="${choice}" type="button" aria-pressed="false">
            <span class="idx">${String.fromCharCode(65 + index)}</span>${choice}
          </button>`).join('')}
        </div>`;
    }

    if (q.type === 'stroop') {
      return `<div class="stroop-head">
          <span class="play-title">读出墨水颜色</span>
          <span class="timer" data-timer>0.0s</span>
        </div>
        <div data-stroop></div>
        <p class="play-note">别管字写了什么，点它真正显示的颜色。第一次点击开始计时。</p>`;
    }

    return '';
  }

  /* ========================================================
     绑定
     ======================================================== */
  function bindQuestion(q, card) {
    card.querySelector('[data-lock]').addEventListener('click', () => lockQuestion(q, card));
    card.querySelector('[data-reveal]').addEventListener('click', () => toggleReveal(card));
    card.querySelector('[data-retry]').addEventListener('click', () => retryQuestion(q, card));

    if (q.type === 'match') bindMatch(q, card);
    if (q.type === 'mark') bindMark(q, card);
    if (q.type === 'text') bindText(q, card);
    if (q.type === 'number') bindNumber(q, card);
    if (q.type === 'choice') bindChoice(q, card);
    if (q.type === 'stroop') bindStroop(q, card);

    if (q.media && q.media.type === 'sequence') {
      setPlayWaiting(q, card, true);
      mountSequence(q, card);
    } else if (state.locked[q.id]) {
      applyLocked(q, card);
    }
  }

  function bindMatch(q, card) {
    const answer = getAnswer(q);
    answer.values = answer.values || {};

    q.letters.forEach(letter => {
      const input = card.querySelector(`[data-letter="${letter}"]`);
      input.value = answer.values[letter] || '';
      input.addEventListener('input', () => {
        answer.values[letter] = input.value.trim();
        saveState();
        setStatus(q, card);
      });
    });
  }

  function bindText(q, card) {
    const answer = getAnswer(q);
    const input = card.querySelector('[data-input="text"]');
    input.value = answer.text || '';
    input.addEventListener('input', () => {
      answer.text = input.value;
      saveState();
      setStatus(q, card);
    });
  }

  function bindNumber(q, card) {
    const answer = getAnswer(q);
    const input = card.querySelector('[data-input="number"]');
    input.value = answer.number === undefined || answer.number === null ? '' : answer.number;
    input.addEventListener('input', () => {
      answer.number = input.value;
      saveState();
      setStatus(q, card);
    });
  }

  function bindChoice(q, card) {
    const answer = getAnswer(q);
    const buttons = card.querySelectorAll('[data-choice]');

    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(answer.choice === button.dataset.choice));
      button.addEventListener('click', () => {
        if (state.locked[q.id]) return;
        answer.choice = button.dataset.choice;
        buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        saveState();
        setStatus(q, card);
      });
    });
  }

  function bindMark(q, card) {
    const wrap = card.querySelector('[data-mark]');
    const layer = card.querySelector('[data-mark-layer]');
    const countEl = card.querySelector('[data-mark-count]');
    const clearBtn = card.querySelector('[data-clear-marks]');
    const answer = getAnswer(q);
    const max = q.maxMarks || 3;

    if (!Array.isArray(answer.marks)) answer.marks = [];

    function paint() {
      layer.innerHTML = '';
      answer.marks.forEach((mark, index) => {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'pin';
        pin.style.left = `${mark.x}%`;
        pin.style.top = `${mark.y}%`;
        pin.setAttribute('aria-label', `删除第 ${index + 1} 个标记`);
        pin.innerHTML = `<b>${index + 1}</b>`;
        pin.addEventListener('click', event => {
          event.stopPropagation();
          if (state.locked[q.id]) return;
          answer.marks.splice(index, 1);
          saveState();
          paint();
          setStatus(q, card);
        });
        layer.appendChild(pin);
      });

      countEl.textContent = String(answer.marks.length);
      clearBtn.disabled = answer.marks.length === 0 || !!state.locked[q.id];
    }

    wrap.addEventListener('click', event => {
      if (state.locked[q.id]) return;
      if (event.target.closest('.pin')) return;

      if (answer.marks.length >= max) {
        toast(`最多标 ${max} 处，先点掉一个再标。`);
        return;
      }

      const rect = wrap.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;

      answer.marks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      saveState();
      paint();
      setStatus(q, card);
    });

    clearBtn.addEventListener('click', () => {
      if (state.locked[q.id]) return;
      answer.marks = [];
      saveState();
      paint();
      setStatus(q, card);
    });

    paint();
  }

  function bindStroop(q, card) {
    const answer = getAnswer(q);
    if (!Array.isArray(answer.picks)) answer.picks = [];
    renderStroopRows(q, card);

    if (state.locked[q.id]) markStroopResults(q, card);
  }

  function renderStroopRows(q, card) {
    const host = card.querySelector('[data-stroop]');
    const answer = getAnswer(q);

    host.innerHTML = state.stroop.map((row, index) => {
      const word = COLORS[row.wordKey];
      const ink = COLORS[row.inkKey];
      return `<div class="stroop-row" data-row="${index}">
        <span class="stroop-word" style="color:${ink.hex}">${word.name}</span>
        <div class="swatches">
          ${COLOR_KEYS.map(key => `<button class="swatch" type="button"
            style="--sw:${COLORS[key].hex}"
            data-color="${key}"
            aria-label="${COLORS[key].name}色"
            aria-pressed="${answer.picks[index] === key}"></button>`).join('')}
        </div>
      </div>`;
    }).join('');

    host.querySelectorAll('.swatch').forEach(button => {
      button.addEventListener('click', () => {
        if (state.locked[q.id]) return;
        const index = Number(button.closest('.stroop-row').dataset.row);
        answer.picks[index] = button.dataset.color;
        button.closest('.stroop-row').querySelectorAll('.swatch').forEach(other => {
          other.setAttribute('aria-pressed', String(other === button));
        });
        startStroopTimer(card);
        saveState();
        setStatus(q, card);
      });
    });
  }

  /* ========================================================
     媒体加载
     ======================================================== */
  function mountSequence(q, card) {
    const frame = card.querySelector('[data-media-frame]');
    const sources = (q.media.candidates || []).slice();
    let index = 0;

    function waiting() {
      state.mediaReady[q.id] = false;
      frame.innerHTML = `<div class="media-wait">
        <div class="wait-icon">◌</div>
        <strong>动图正在赶来的路上</strong>
        <span>素材上传后，本题会自动解锁</span>
      </div>`;
      setPlayWaiting(q, card, true);
      setStatus(q, card);
      updateProgress();
    }

    function ready() {
      state.mediaReady[q.id] = true;
      setPlayWaiting(q, card, false);
      if (state.locked[q.id]) applyLocked(q, card);
      setStatus(q, card);
      updateProgress();
    }

    function next() {
      if (index >= sources.length) {
        waiting();
        return;
      }

      const src = sources[index++];

      if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src)) {
        const video = document.createElement('video');
        video.src = src;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('aria-label', q.media.alt || '');

        video.addEventListener('loadeddata', () => {
          frame.innerHTML = '';
          frame.appendChild(video);
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
          ready();
        }, { once: true });

        video.addEventListener('error', next, { once: true });
        video.load();
      } else {
        const image = new Image();
        image.alt = q.media.alt || '';
        image.draggable = false;
        image.onload = () => {
          frame.innerHTML = '';
          frame.appendChild(image);
          ready();
        };
        image.onerror = next;
        image.src = src;
      }
    }

    next();
  }

  function setPlayWaiting(q, card, waiting) {
    const play = card.querySelector('.q-play');
    if (!play) return;

    play.classList.toggle('is-waiting', waiting);
    play.querySelectorAll('input, textarea, button').forEach(element => {
      element.disabled = waiting;
    });

    const lockBtn = card.querySelector('[data-lock]');
    if (lockBtn) lockBtn.disabled = waiting;
  }

  /* ========================================================
     锁定 / 解析 / 重答
     ======================================================== */
  function lockQuestion(q, card) {
    if (state.locked[q.id]) return;

    if (q.media && q.media.type === 'sequence' && state.mediaReady[q.id] !== true) {
      toast('这题的动图还没上传，先等等。');
      return;
    }

    const answer = getAnswer(q);
    if (!isComplete(q, answer)) {
      toast(validationMessage(q));
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 420);
      return;
    }

    if (q.type === 'stroop') {
      stopStroopTimer();
      const seconds = state.stroopStart ? (Date.now() - state.stroopStart) / 1000 : 0;
      const score = state.stroop.reduce((total, row, index) => {
        return total + (answer.picks[index] === row.inkKey ? 1 : 0);
      }, 0);
      state.results[q.id] = {
        score,
        total: state.stroop.length,
        seconds: Math.round(seconds * 10) / 10
      };
    }

    state.locked[q.id] = true;
    saveState();
    applyLocked(q, card);
    setStatus(q, card);
    updateProgress();
    toast('答案已锁定。现在可以看解析了。');
  }

  function applyLocked(q, card) {
    card.classList.add('is-locked');

    const status = card.querySelector('.q-status');
    status.textContent = '已锁定';
    status.dataset.state = 'locked';

    const lockBtn = card.querySelector('[data-lock]');
    lockBtn.disabled = true;
    lockBtn.textContent = '已锁定';

    card.querySelector('[data-reveal]').hidden = false;
    card.querySelector('[data-retry]').hidden = false;

    card.querySelectorAll('.q-play input, .q-play textarea, .q-play button').forEach(element => {
      element.disabled = true;
    });
    card.querySelectorAll('.pin').forEach(element => {
      element.disabled = true;
    });

    const wrap = card.querySelector('[data-mark]');
    if (wrap) wrap.classList.add('is-locked');

    const panel = card.querySelector('[data-reveal-panel]');
    panel.innerHTML = revealHTML(q);
    panel.hidden = false;

    const revealBtn = card.querySelector('[data-reveal]');
    revealBtn.textContent = '收起解析';

    if (q.type === 'stroop') {
      markStroopResults(q, card);
    }
  }

  function retryQuestion(q, card) {
    if (!state.locked[q.id]) return;

    delete state.locked[q.id];
    delete state.results[q.id];
    saveState();

    card.classList.remove('is-locked');

    const lockBtn = card.querySelector('[data-lock]');
    lockBtn.disabled = false;
    lockBtn.textContent = '锁定答案';

    const revealBtn = card.querySelector('[data-reveal]');
    revealBtn.hidden = true;
    revealBtn.textContent = '看解析';

    const retryBtn = card.querySelector('[data-retry]');
    retryBtn.hidden = true;

    const panel = card.querySelector('[data-reveal-panel]');
    panel.hidden = true;
    panel.innerHTML = '';

    card.querySelectorAll('.q-play input, .q-play textarea, .q-play button').forEach(element => {
      element.disabled = false;
    });
    card.querySelectorAll('.pin').forEach(element => {
      element.disabled = false;
    });

    const wrap = card.querySelector('[data-mark]');
    if (wrap) wrap.classList.remove('is-locked');

    if (q.type === 'stroop') {
      card.querySelectorAll('.stroop-row').forEach(row => row.removeAttribute('data-result'));
      const timer = card.querySelector('[data-timer]');
      if (timer) timer.textContent = '0.0s';
      state.stroopStart = null;
      stopStroopTimer();
    }

    if (q.media && q.media.type === 'sequence' && state.mediaReady[q.id] !== true) {
      setPlayWaiting(q, card, true);
    }

    setStatus(q, card);
    updateProgress();
  }

  function revealHTML(q) {
    if (q.type === 'stroop' && state.results[q.id]) {
      const result = state.results[q.id];
      return `<div class="reveal-label">解析 / 你的成绩</div>
        <p>答对 <b>${result.score}/${result.total}</b>，用时 <b>${result.seconds.toFixed(1)} 秒</b>。
        颜色和字义打架时，人类也会慢半拍；但至少我们看得见颜色。模型连入场资格都没有。</p>`;
    }

    if (q.answer) {
      return `<div class="reveal-label">解析</div><p>${q.answer}</p>`;
    }

    return `<div class="reveal-label">解析</div>
      <p class="reveal-quiet">${q.quiet || '标准答案先留个悬念。把图放大，人类不需要标准答案。'}</p>`;
  }

  function toggleReveal(card) {
    const panel = card.querySelector('[data-reveal-panel]');
    const button = card.querySelector('[data-reveal]');
    panel.hidden = !panel.hidden;
    button.textContent = panel.hidden ? '看解析' : '收起解析';
  }

  function markStroopResults(q, card) {
    const answer = state.answers[q.id] || {};
    const picks = Array.isArray(answer.picks) ? answer.picks : [];

    card.querySelectorAll('.stroop-row').forEach((row, index) => {
      row.dataset.result = picks[index] === state.stroop[index].inkKey ? 'right' : 'wrong';
    });
  }

  /* ========================================================
     计时器（Stroop）
     ======================================================== */
  function startStroopTimer(card) {
    if (stroopTimer) return;
    state.stroopStart = Date.now();
    const display = card.querySelector('[data-timer]');

    stroopTimer = setInterval(() => {
      if (!display || !state.stroopStart) return;
      display.textContent = `${((Date.now() - state.stroopStart) / 1000).toFixed(1)}s`;
    }, 100);
  }

  function stopStroopTimer() {
    if (stroopTimer) {
      clearInterval(stroopTimer);
      stroopTimer = null;
    }
  }

  /* ========================================================
     作答状态 / 进度
     ======================================================== */
  function isComplete(q, answer) {
    switch (q.type) {
      case 'match':
        return q.letters.every(letter => String((answer.values || {})[letter] || '').trim() !== '');
      case 'mark':
        return Array.isArray(answer.marks) && answer.marks.length > 0;
      case 'text':
        return String(answer.text || '').trim() !== '';
      case 'number':
        return answer.number !== undefined
          && answer.number !== null
          && String(answer.number).trim() !== '';
      case 'choice':
        return Boolean(answer.choice);
      case 'stroop':
        return Array.isArray(answer.picks) && answer.picks.filter(Boolean).length === state.stroop.length;
      default:
        return true;
    }
  }

  function validationMessage(q) {
    switch (q.type) {
      case 'match': return 'A–E 五个编号都填上再锁定。';
      case 'mark': return '先在图上点一个你认为的位置。';
      case 'text': return '先写下你的答案。';
      case 'number': return '填一个数字再锁定。';
      case 'choice': return '先选一个选项。';
      case 'stroop': return '每一行都要选一个颜色。';
      default: return '这题还没答完整。';
    }
  }

  function hasAnswer(q) {
    const answer = state.answers[q.id];
    if (!answer) return false;

    switch (q.type) {
      case 'match':
        return Object.values(answer.values || {}).some(value => String(value).trim() !== '');
      case 'mark':
        return Array.isArray(answer.marks) && answer.marks.length > 0;
      case 'text':
        return String(answer.text || '').trim() !== '';
      case 'number':
        return answer.number !== undefined
          && answer.number !== null
          && String(answer.number).trim() !== '';
      case 'choice':
        return Boolean(answer.choice);
      case 'stroop':
        return Array.isArray(answer.picks) && answer.picks.some(Boolean);
      default:
        return false;
    }
  }

  function setStatus(q, card) {
    const status = card.querySelector('.q-status');
    if (!status) return;

    if (q.media && q.media.type === 'sequence' && state.mediaReady[q.id] === false) {
      status.textContent = '等待素材';
      status.dataset.state = 'waiting';
      return;
    }

    if (state.locked[q.id]) {
      status.textContent = '已锁定';
      status.dataset.state = 'locked';
      return;
    }

    const dirty = hasAnswer(q);
    status.textContent = dirty ? '作答中' : '未作答';
    status.dataset.state = dirty ? 'dirty' : 'idle';
  }

  function updateProgress() {
    const total = QUESTIONS.length;
    const done = QUESTIONS.filter(q => state.locked[q.id]).length;

    const progressText = document.getElementById('progressText');
    const scoreBig = document.getElementById('scoreBig');
    const scoreFill = document.getElementById('scoreFill');
    const scoreCopy = document.getElementById('scoreCopy');

    if (progressText) progressText.textContent = `已解锁 ${done} / ${total}`;
    if (scoreBig) scoreBig.textContent = `${done}/${total}`;
    if (scoreFill) scoreFill.style.width = `${(done / total) * 100}%`;
    if (scoreCopy) scoreCopy.textContent = scoreCopyText(done, total);
  }

  function scoreCopyText(done, total) {
    if (done === 0) return '还没开始，AI 已经替你捏了把汗。';
    if (done < total * 0.5) return '热身完毕，真正的坑还在后面。';
    if (done < total) return '不错，你至少认真看了每一张图。';
    return '全部解锁。现在可以理直气壮地说：这题 AI 真不会。';
  }

  /* ========================================================
     分享 / 重置 / toast
     ======================================================== */
  async function shareResults() {
    const total = QUESTIONS.length;
    const done = QUESTIONS.filter(q => state.locked[q.id]).length;
    const text = done === 0
      ? '《别问 AI 了，它真不会》：8 道人类一眼看穿、大模型集体沉默的小题。我还没敢开始，你先来？'
      : `我在《别问 AI 了，它真不会》里解锁了 ${done}/${total} 题。8 道人类一眼看穿、大模型集体沉默的小题，你敢来试试吗？`;
    const url = location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: '别问 AI 了，它真不会', text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    const payload = `${text}\n${url}`;
    try {
      await navigator.clipboard.writeText(payload);
      toast('战绩和链接已复制，去发群里。');
    } catch (err) {
      window.prompt('复制下面这段分享：', payload);
    }
  }

  function resetAll() {
    if (!window.confirm('清空所有作答记录，重新开始？')) return;
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (err) {
      /* ignore */
    }
    location.reload();
  }

  function toast(message) {
    let element = document.querySelector('.toast');
    if (!element) {
      element = document.createElement('div');
      element.className = 'toast';
      element.setAttribute('role', 'status');
      document.body.appendChild(element);
    }

    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  /* ========================================================
     首屏控制台动画
     ======================================================== */
  const CONSOLE_LINES = [
    ['$ ai-benchmark --suite=1024', ''],
    ['[ok] 载入 8 道人类小题', ''],
    ['[ok] 模型置信度 99.9%', ''],
    ['[run] 匹配鹅头与身体……', ''],
    ['[warn] 找到 5 只身体，0 个正确答案', 'warn'],
    ['[run] 在草丛里找四叶草……', ''],
    ['[fail] 已放弃寻找，开始冥想', 'fail'],
    ['[!] 结论：这题超纲了', 'fail']
  ];

  function runConsole() {
    const body = document.getElementById('console');
    if (!body) return;

    const caret = body.querySelector('.caret');
    body.querySelectorAll('.cline').forEach(line => line.remove());

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      CONSOLE_LINES.forEach(([text, cls]) => appendLine(body, caret, text, cls));
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      if (index >= CONSOLE_LINES.length) {
        clearInterval(timer);
        setTimeout(runConsole, 7000);
        return;
      }
      const [text, cls] = CONSOLE_LINES[index++];
      appendLine(body, caret, text, cls);
    }, 700);
  }

  function appendLine(body, caret, text, cls) {
    const line = document.createElement('div');
    line.className = `cline ${cls || ''}`.trim();
    line.textContent = text;
    body.insertBefore(line, caret);
  }

  /* ========================================================
     滚动入场
     ======================================================== */
  function setupObserver() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(element => element.classList.add('in'));
      return;
    }

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  }

  function observe(element) {
    if (observer) observer.observe(element);
    else element.classList.add('in');
  }

  /* ========================================================
     启动
     ======================================================== */
  function init() {
    loadState();
    setupObserver();
    renderQuestions();
    runConsole();

    document.getElementById('heroShare').addEventListener('click', shareResults);
    document.getElementById('shareBtn').addEventListener('click', shareResults);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
  }

  init();
})();
