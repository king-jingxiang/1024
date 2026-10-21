(() => {
  'use strict';

  /* ========================================================
     数据区：想加题、换答案，只改这里
     ======================================================== */
  const STORE_KEY = 'ai1024-failbench-v2';

  const COLORS = {
    red: { name: '红', hex: '#df3a1f' },
    green: { name: '绿', hex: '#1f9d55' },
    blue: { name: '蓝', hex: '#2f4bff' },
    yellow: { name: '黄', hex: '#c99700' }
  };
  const COLOR_KEYS = Object.keys(COLORS);

  /* ========================================================
     伪随机与题目生成器
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

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  // 把 total 拆成 parts 份，每份落在 [min, max] 之间
  function randomParts(random, total, parts, min, max) {
    const values = Array(parts).fill(min);
    let rest = total - parts * min;

    while (rest > 0) {
      const open = [];
      values.forEach((value, index) => {
        if (value < max) open.push(index);
      });
      if (!open.length) break;
      values[open[Math.floor(random() * open.length)]] += 1;
      rest -= 1;
    }

    return values;
  }

  // 006：用算法把方框切成 10 块矩形，天然保证存在一个铺满且不重叠的解
  function makePackPuzzle(seed) {
    const frame = 13;
    const random = mulberry32(seed);
    const rowCounts = shuffle([3, 3, 4], random);
    const rowHeights = shuffle(randomParts(random, frame, 3, 3, 6), random);
    const cuts = [];

    rowHeights.forEach((height, row) => {
      randomParts(random, frame, rowCounts[row], 2, 7).forEach(width => {
        cuts.push({ w: width, h: height });
      });
    });

    // 窄的块配窄的数字，让“数字有尺寸”这件事一眼看得见
    cuts.sort((a, b) => a.w - b.w || a.h - b.h);
    const labels = ['1', '4', '7', '3', '5', '2', '6', '9', '0', '8'];

    return {
      frame,
      pieces: cuts.map((cut, index) => ({ d: labels[index], w: cut.w, h: cut.h }))
    };
  }

  const PACK_PUZZLE = makePackPuzzle(1024);

  const QUESTIONS = [
    {
      id: 1,
      tags: ['视觉', '空间匹配'],
      title: '给 A–E 找回它们的头',
      desc: '图中每只仙鹤的身体都标了字母，旁边散落着带编号的仙鹤头。把每只身体对应的头部编号填进去。',
      type: 'match',
      letters: ['A', 'B', 'C', 'D', 'E'],
      media: {
        type: 'image',
        src: 'imgs/001.jpg',
        alt: '第一题配图：标有 A–E 的仙鹤身体与带编号的仙鹤头'
      },
      analysis: {
        verdict: '它能认出一整只仙鹤，却对不上十只仙鹤的头。',
        weak: '细粒度局部匹配与多目标身份绑定。整图描述没问题，一旦要在 A–E 和一堆编号之间建立一一对应，就会错配、重号，甚至编出图上根本不存在的编号。',
        why: '视觉编码器把图像压成低分辨率的 patch 向量，颈部这种细窄、低对比的连接处最先被丢掉；同时模型没有“逐一比对、排除候选”的工作记忆，多个相似目标同时在场时会串号。这是组合匹配问题，不是识别问题。',
        ability: '细节辨别 + 身份绑定 + 系统性排除，也就是人类靠工作记忆完成的那部分。',
        fix: '别让它“再看一眼”，把任务拆成可验证的子步骤：先定位每只身体的颈部朝向，再逐个裁出头部候选，用断口形状与朝向的一致性打分，最后做一次全局一一校验。裁剪、放大、标注这类工具，比换一个更大的模型更管用。',
        human: '人类只要抓住“颈部断口必须吻合”这一条物理约束，几秒到几十秒就能配完，准确率接近满分。这类细粒度匹配是人类视觉的出厂设置，和智力关系不大。'
      }
    },
    {
      id: 2,
      tags: ['视觉搜索', '注意力'],
      title: '在草丛里找到那株四叶草',
      desc: '满屏三叶草里混进了一株四叶草。在图上点击你找到的位置，只能标 1 处；点已有标记可以删除重来。',
      type: 'mark',
      maxMarks: 1,
      media: {
        type: 'image',
        src: 'imgs/002.png',
        alt: '第二题配图：一片密集的三叶草地'
      },
      analysis: {
        verdict: '人类靠扫视，模型靠想象。',
        weak: '稀疏目标的全程视觉搜索。满屏三叶草里只有一株四叶草，模型要么只看了局部就下结论，要么直接“编”一个坐标；要求它标出位置时，命中率基本靠运气。',
        why: '注意力是全局加权，不是逐区域扫描；高分辨率图又会被下采样，四叶草多出来的那一叶可能只剩几个像素。更关键的是模型没有“我还没看完”的元认知，不会主动要求放大或分块。',
        ability: '视觉搜索与持续注意。目标与干扰项高度相似、只多一片叶，没法靠单一特征“弹”出来，必须一处一处排除。',
        fix: '工程解法是滑动窗口：把图切成重叠的小块逐块判定，先按“四叶、对称”做候选筛选，再对候选区域放大复核；也可以先用检测模型出框，让模型只做确认。一次性整图问答是最差的方案。',
        human: '人类用特征引导的搜索策略，每秒约 3–4 个注视点，通常几十秒内完成；找不到时还会主动换扫描路径。这个能力稳定到可以当游戏玩，在模型那里却仍是硬伤。'
      }
    },
    {
      id: 3,
      tags: ['视频', '视觉搜索'],
      title: '找出亮红灯的碰碰车',
      desc: '碰碰车会亮起红灯，全片一共两处。视频播放结束后会自动暂停，点「重放」可以再看一遍；在停住的画面上点击标记，一共标 2 处，点已有标记可以删除重来。',
      type: 'mark',
      maxMarks: 2,
      media: {
        type: 'video',
        src: 'imgs/003.mp4',
        alt: '第三题视频：一群碰碰车在场地里移动，个别车辆亮起红灯'
      },
      analysis: {
        verdict: '红灯亮了几帧，模型可能一帧都没抽到。',
        weak: '瞬时事件的时序定位。红灯只亮很短一段时间，模型按固定间隔抽帧，大概率整段错过；即便看到了，也很难说清是哪辆车、在第几秒。',
        why: '主流视频理解按 1fps 左右均匀采样，短于采样间隔的事件在输入里根本不存在；时间维被压缩成全局表示后，只剩“发生了什么”，丢了“何时发生”。这是采样率与时间分辨率的问题，不是理解力的问题。',
        ability: '时序事件检测 + 跨帧目标跟踪 + 对短暂状态变化的记忆。',
        fix: '提高采样率，或先用低层视觉线索（红色高亮区域）触发关键帧，再做跟踪与确认；也可以先跟踪每辆车，再逐帧判断灯色。把“找红灯”降级成颜色检测加跟踪，比让模型硬看完整段视频可靠得多。',
        human: '人类有连续视觉流，红灯一亮外周视觉就会捕捉到，甚至不需要主动盯着，再回放确认即可。人类在这类任务上接近满分，唯一的天敌是不注意盲视——这也是题目允许重放的原因。'
      }
    },
    {
      id: 4,
      tags: ['视觉', '找不同'],
      title: '上下两栋姜饼屋，差在哪几处？',
      desc: '同一张图上下两版，细节被悄悄动过手脚。在图上点击标出不同之处，最多 12 处；点已有标记可以删掉重标。',
      type: 'diff',
      maxMarks: 12,
      media: {
        type: 'image',
        src: 'imgs/004.jpg',
        alt: '上下两幅姜饼屋插画，细节存在差异'
      },
      analysis: {
        verdict: '它擅长“看图说话”，不擅长“找茬”。',
        weak: '两图之间的逐区域比对。模型倾向于分别描述上下两张图，再总结“差异”，真正的细节改动在描述阶段就被抹平；同时容易把压缩噪声当成不同，反而漏掉语义级改动。',
        why: '自然语言描述本身是有损压缩，输出的字数远少于图像信息；两幅图之间也没有显式的对齐操作，差异只能靠内部隐式比较，而隐式比较对局部小改动极不敏感。',
        ability: '变化检测 + 空间对齐 + 细节记忆，本质是同一场景的 A/B 比对。',
        fix: '先配准再求差：对齐两图后做图像差分、SSIM 或光流，把差异区域圈出来，再让模型只负责语义确认。这是成熟的 CV 流水线，纯 VLM 问答恰好是在最不擅长的环节硬扛。',
        human: '人类用“扫视—比较—记忆”的循环，找十处差异一般一到几分钟；对语义改动（方向、数量、颜色）极敏感，对像素噪声反而不敏感，正好和模型相反。'
      }
    },
    {
      id: 5,
      tags: ['逻辑', '线性代数'],
      title: '把这面灯，全部关掉',
      desc: '5×5 的灯阵，每按一盏，它自己和上下左右四盏会一起翻转。目标是全部熄灭。硬试很难收尾！',
      type: 'lights',
      size: 5,
      seed: 1024,
      analysis: {
        verdict: '25 盏灯、2^25 种状态，模型没有第二层棋盘可以推演。',
        weak: '多步规划与状态空间搜索。贪心或“看起来快灭了”的启发式会走进死胡同；模型也无法在脑内稳定维护 25 个布尔变量，并按步回溯。',
        why: '自回归生成是单向写 token，没有真正的搜索与回溯机制；上下文里的状态会随步数衰减。就算它知道该用线性代数，也常在异或和下标上算错——这题考的不是知识，是可执行的多步推理。',
        ability: '组合搜索 + 抽象建模 + 长程状态管理：能不能把“按灯”翻译成 GF(2) 上的线性方程组。',
        fix: '这是典型的“该用工具”的题：把“按 / 不按”记成 0 / 1，每盏灯的最终状态是它自己和相邻四格被按次数的异或和，写出 25×25 的增广矩阵，在 GF(2) 上高斯消元，再按解向量点灯。模型该做的是把问题形式化并调用代码，而不是凭直觉乱按——按的顺序不影响结果，同一盏按两次等于没按。',
        human: '多数人不会解方程，但可以用“追灯法”逐行消元，几分钟能解完，也可以手试加记录。人类强在能把过程写在纸上当外部记忆，模型弱在必须一次算对。'
      }
    },
    {
      id: 6,
      tags: ['横向思维', '空间'],
      title: '把 0–9 全部塞进方框',
      desc: '方框被切成了 10 块，每块尺寸都不一样，现在全部打散了。把十个数字拖回方框，不能重叠、不能超出。摆不平的时候，试试让数字横过来。',
      type: 'pack',
      frame: PACK_PUZZLE.frame,
      pieces: PACK_PUZZLE.pieces,
      analysis: {
        verdict: '它会算面积，但不会“转一下试试”。',
        weak: '二维几何布局与旋转。模型很难在“尺寸各异的矩形必须无缝铺满 13×13”这种约束下给出合法坐标，常见结果是重叠、越界或块数对不上；“把数字转 90°”这类非语义操作更是盲区。',
        why: '位置和尺寸是连续几何量，语言模型输出的是离散 token，没有精确的坐标系；它也没有“试放—检查—撤回”的物理模拟过程。视觉 token 的分辨率同样不足以支撑精确到格子的布局。',
        ability: '空间推理 + 约束满足（精确覆盖 / 多边形铺砌）+ 试错与修正。',
        fix: '转成精确覆盖问题，用回溯加剪枝（如 Dancing Links）求解；也可以按面积、边长排序，先贴边放大块，把旋转当作搜索空间里的一个显式分支。关键是把“转一下”写进规则，而不是指望模型自己想到。数字不一定要站着：高的块横躺，窄的块竖着补缝，剩下的缝隙自己会露出来。',
        human: '人类靠手：先放大块、贴角、留缝，几分钟内能拼完，还能边拼边改。八到十二岁的孩子就能做，成人的主要瓶颈是耐心而不是能力——手就是人类的外部搜索器。'
      }
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
    const solo = q.type === 'stroop' || q.type === 'lights' || q.type === 'pack';
    const board = q.type === 'lights' || q.type === 'pack' ? ' q-play--board' : '';
    const body = solo
      ? `<div class="q-body q-body--solo">
           <div class="q-play${board}">${playHTML(q)}</div>
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
        <button class="btn btn-ghost" data-reveal type="button" hidden>看 AI 短板解析</button>
        <button class="mini-link" data-retry type="button" hidden>重答本题</button>
        <span class="q-tip">提交后可重答，成绩只保存在本机</span>
      </div>
      <div class="q-reveal" data-reveal-panel hidden></div>
    </article>`;
  }

  function mediaHTML(q) {
    if (q.type === 'mark' || q.type === 'diff') {
      const help = q.type === 'diff'
        ? `点击图片标出不同 · 最多 ${q.maxMarks} 处 · 点标记可删除`
        : `点击画面标记 · 最多 ${q.maxMarks} 处 · 点标记可删除`;
      const isVideo = q.media && q.media.type === 'video';
      const media = isVideo
        ? `<video src="${q.media.src}" autoplay muted playsinline preload="auto" aria-label="${q.media.alt}"></video>`
        : `<img src="${q.media.src}" alt="${q.media.alt}" draggable="false">`;
      const toggle = isVideo
        ? `<button class="mini-btn media-toggle" data-media-toggle type="button">重放</button>`
        : '';
      return `<figure class="q-media mark-wrap${isVideo ? ' mark-wrap--video' : ''}" data-mark>
        ${media}
        <div class="mark-layer" data-mark-layer></div>
        ${toggle}
        <div class="mark-help">${help}</div>
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
          <label class="sr-only" for="q${q.id}-${letter}">${letter} 仙鹤对应的头部编号</label>
          <input id="q${q.id}-${letter}" data-letter="${letter}" type="text" inputmode="numeric" maxlength="3" placeholder="头部编号" autocomplete="off">
        </div>`).join('')}
        <p class="play-note">编号直接填数字。不确定就凭第一眼，别来回改。</p>`;
    }

    if (q.type === 'mark') {
      return `<span class="play-title">你的标记</span>
        <div class="mark-readout"><b data-mark-count>0</b><span>/ ${q.maxMarks} 处</span></div>
        <p class="play-note">点击左侧画面放置标记，最多 ${q.maxMarks} 处。已放置的标记可以直接点掉。</p>
        <button class="mini-btn" data-clear-marks type="button" disabled>清除全部标记</button>`;
    }

    if (q.type === 'diff') {
      return `<span class="play-title">你找到的不同</span>
        <div class="mark-readout"><b data-mark-count>0</b><span>/ ${q.maxMarks} 处</span></div>
        <p class="play-note">在图上点击标出不同，已放置的标记可以直接点掉。上下两版是同一张图，慢慢比对。</p>
        <button class="mini-btn" data-clear-marks type="button" disabled>清除全部标记</button>`;
    }

    if (q.type === 'lights') {
      return `<div class="lights-head">
          <span class="play-title">灯阵 ${q.size}×${q.size}</span>
          <span class="lights-stat">亮着 <b data-lights-lit>0</b></span>
        </div>
        <div class="lights-board" data-lights-board></div>
        <div class="lights-foot">
          <span class="lights-stat">按键 <b data-lights-moves>0</b></span>
          <button class="mini-btn" data-lights-reset type="button">重开灯阵</button>
        </div>
        <p class="play-note">每按一盏，它和上下左右四盏一起翻转。全部熄灭后才可以锁定答案。</p>`;
    }

    if (q.type === 'pack') {
      return `<div class="pack-head">
          <span class="play-title">方框 ${q.frame}×${q.frame}</span>
          <span class="pack-stat">已放入 <b data-pack-count>0</b> / ${q.pieces.length}</span>
        </div>
        <div class="pack-board">
          <div class="pack-stage" data-pack-stage></div>
        </div>
        <div class="pack-tray-head">待放入的数字 <span>拖动进框 · 点击旋转 90° · 框内的块可拖回这里</span></div>
        <div class="pack-tray" data-pack-tray></div>
        <button class="mini-btn" data-pack-clear type="button">全部取出</button>
        <p class="play-note">数字块尺寸各不相同，不能重叠，也不能超出方框。摆不平的时候，试试让它们横过来。</p>`;
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
    if (q.type === 'mark' || q.type === 'diff') bindMark(q, card);
    if (q.type === 'lights') bindLights(q, card);
    if (q.type === 'pack') bindPack(q, card);
    if (q.type === 'text') bindText(q, card);
    if (q.type === 'number') bindNumber(q, card);
    if (q.type === 'choice') bindChoice(q, card);
    if (q.type === 'stroop') bindStroop(q, card);

    if (q.media && q.media.type === 'sequence') {
      setPlayWaiting(q, card, true);
      mountSequence(q, card);
      if (state.locked[q.id]) applyLocked(q, card);
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

    const video = wrap.querySelector('video');
    const toggleBtn = card.querySelector('[data-media-toggle]');
    if (video && toggleBtn) {
      toggleBtn.addEventListener('click', event => {
        event.stopPropagation();
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      });
    }

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
      if (event.target.closest('.pin, [data-media-toggle]')) return;

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

  /* ---------- 005 灯阵 ---------- */
  function toggleLamp(board, size, index) {
    const x = index % size;
    const y = Math.floor(index / size);
    [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
      const at = ny * size + nx;
      board[at] = !board[at];
    });
  }

  // 先随机按几盏灯，再把这个局面交给玩家 —— 所以一定有解
  function makeLights(q) {
    const size = q.size;
    const random = mulberry32(q.seed);
    const board = Array(size * size).fill(false);
    const presses = 7 + Math.floor(random() * 3);
    const picked = new Set();

    while (picked.size < presses) {
      picked.add(Math.floor(random() * size * size));
    }
    picked.forEach(index => toggleLamp(board, size, index));

    if (!board.some(Boolean)) {
      toggleLamp(board, size, Math.floor(size * size / 2));
    }
    return board;
  }

  function bindLights(q, card) {
    const size = q.size;
    const total = size * size;
    const answer = getAnswer(q);
    const initial = makeLights(q);
    const saved = Array.isArray(answer.lights) && answer.lights.length === total;

    answer.lights = saved ? answer.lights.map(Boolean) : initial.slice();
    if (!saved || typeof answer.moves !== 'number') answer.moves = 0;

    const boardEl = card.querySelector('[data-lights-board]');
    const litEl = card.querySelector('[data-lights-lit]');
    const movesEl = card.querySelector('[data-lights-moves]');
    const resetBtn = card.querySelector('[data-lights-reset]');

    boardEl.style.setProperty('--n', String(size));
    boardEl.innerHTML = '';

    const lamps = answer.lights.map((_, index) => {
      const lamp = document.createElement('button');
      lamp.type = 'button';
      lamp.className = 'lamp';
      lamp.setAttribute('aria-label', `第 ${Math.floor(index / size) + 1} 行第 ${index % size + 1} 列的灯`);
      lamp.addEventListener('click', () => {
        if (state.locked[q.id]) return;
        toggleLamp(answer.lights, size, index);
        answer.moves += 1;
        saveState();
        paint();
        setStatus(q, card);
        updateProgress();
        if (answer.lights.every(value => !value)) {
          toast('全灭了。现在可以锁定答案。');
        }
      });
      boardEl.appendChild(lamp);
      return lamp;
    });

    function paint() {
      const lit = answer.lights.filter(Boolean).length;

      answer.lights.forEach((value, index) => {
        lamps[index].dataset.lit = String(value);
        lamps[index].setAttribute('aria-pressed', String(value));
        lamps[index].disabled = !!state.locked[q.id];
      });

      litEl.textContent = String(lit);
      movesEl.textContent = String(answer.moves || 0);
      boardEl.classList.toggle('is-solved', lit === 0);
      resetBtn.disabled = !!state.locked[q.id];
    }

    resetBtn.addEventListener('click', () => {
      if (state.locked[q.id]) return;
      answer.lights = initial.slice();
      answer.moves = 0;
      saveState();
      paint();
      setStatus(q, card);
    });

    paint();
  }

  /* ---------- 006 数字装箱 ---------- */
  function bindPack(q, card) {
    const answer = getAnswer(q);
    const answerRot = answer.rot || (answer.rot = {});
    const answerPos = answer.pos || (answer.pos = {});

    q.pieces.forEach(piece => {
      if (!Number.isInteger(answerRot[piece.d])) answerRot[piece.d] = 0;
      const pos = answerPos[piece.d];
      if (pos && (!Number.isInteger(pos.x) || !Number.isInteger(pos.y))) {
        delete answerPos[piece.d];
      }
    });

    const stage = card.querySelector('[data-pack-stage]');
    const tray = card.querySelector('[data-pack-tray]');
    const countEl = card.querySelector('[data-pack-count]');
    const clearBtn = card.querySelector('[data-pack-clear]');
    const TRAY_CELL = 20;

    stage.style.setProperty('--n', String(q.frame));

    function dimsOf(piece) {
      const turned = answerRot[piece.d] % 2;
      return turned ? { w: piece.h, h: piece.w } : { w: piece.w, h: piece.h };
    }

    function placedCount() {
      return q.pieces.filter(piece => answerPos[piece.d]).length;
    }

    function occupied(except) {
      const cells = new Set();
      q.pieces.forEach(piece => {
        if (piece.d === except) return;
        const pos = answerPos[piece.d];
        if (!pos) return;
        const dims = dimsOf(piece);
        for (let y = pos.y; y < pos.y + dims.h; y++) {
          for (let x = pos.x; x < pos.x + dims.w; x++) {
            cells.add(y * 100 + x);
          }
        }
      });
      return cells;
    }

    function fits(piece, x, y) {
      const dims = dimsOf(piece);
      if (x < 0 || y < 0 || x + dims.w > q.frame || y + dims.h > q.frame) return false;

      const cells = occupied(piece.d);
      for (let yy = y; yy < y + dims.h; yy++) {
        for (let xx = x; xx < x + dims.w; xx++) {
          if (cells.has(yy * 100 + xx)) return false;
        }
      }
      return true;
    }

    function rotate(piece, onBoard) {
      if (state.locked[q.id]) return;

      const before = answerRot[piece.d] % 4;
      answerRot[piece.d] = (before + 1) % 4;

      if (onBoard) {
        const pos = answerPos[piece.d];
        if (!fits(piece, pos.x, pos.y)) {
          answerRot[piece.d] = before;
          toast('这个位置转不开，先挪个地方再转。');
          return;
        }
      }

      saveState();
      paint();
      setStatus(q, card);
    }

    function attachDrag(el, piece, onBoard) {
      el.addEventListener('pointerdown', event => {
        if (state.locked[q.id] || event.button > 0) return;
        event.preventDefault();

        const rect = el.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const cell = stageRect.width / q.frame;
        const dims = dimsOf(piece);
        const grabX = (event.clientX - rect.left) * (dims.w * cell / rect.width);
        const grabY = (event.clientY - rect.top) * (dims.h * cell / rect.height);
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        let ghost = null;

        function onMove(moveEvent) {
          if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 6) {
            moved = true;
            el.classList.add('is-dragging');

            ghost = document.createElement('div');
            ghost.className = 'pack-ghost';
            ghost.style.width = `${dims.w * cell}px`;
            ghost.style.height = `${dims.h * cell}px`;

            const glyph = document.createElement('span');
            glyph.textContent = piece.d;
            glyph.style.transform = `rotate(${(answerRot[piece.d] % 4) * 90}deg)`;
            ghost.appendChild(glyph);
            document.body.appendChild(ghost);
          }

          if (moved) {
            ghost.style.left = `${moveEvent.clientX - grabX}px`;
            ghost.style.top = `${moveEvent.clientY - grabY}px`;
          }
        }

        function onUp(upEvent) {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          el.classList.remove('is-dragging');
          if (ghost) ghost.remove();

          if (!moved) {
            rotate(piece, onBoard);
            return;
          }

          const stageNow = stage.getBoundingClientRect();
          const trayNow = tray.getBoundingClientRect();
          const overTray = upEvent.clientX >= trayNow.left && upEvent.clientX <= trayNow.right
            && upEvent.clientY >= trayNow.top && upEvent.clientY <= trayNow.bottom;

          if (overTray) {
            if (answerPos[piece.d]) {
              delete answerPos[piece.d];
              saveState();
              toast('已放回下方待放入区域。');
            }
          } else {
            const nowCell = stageNow.width / q.frame;
            const x = Math.round((upEvent.clientX - grabX - stageNow.left) / nowCell);
            const y = Math.round((upEvent.clientY - grabY - stageNow.top) / nowCell);

            if (fits(piece, x, y)) {
              answerPos[piece.d] = { x, y };
              saveState();
            } else if (onBoard) {
              toast('放不下：超出方框，或会和别的数字重叠。拖回下方托盘可以取出。');
            } else {
              toast('放不下：超出方框，或会和别的数字重叠。');
            }
          }

          paint();
          setStatus(q, card);
          updateProgress();

          if (placedCount() === q.pieces.length) {
            toast('十个数字全部进框，正好铺满。可以锁定了。');
          }
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });

      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          rotate(piece, onBoard);
        }
      });
    }

    function paint() {
      stage.innerHTML = '';
      tray.innerHTML = '';

      q.pieces.forEach(piece => {
        const dims = dimsOf(piece);
        const pos = answerPos[piece.d];
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'pack-piece';
        el.dataset.digit = piece.d;
        el.setAttribute('aria-label', pos
          ? `数字 ${piece.d}，点击旋转 90°，也可以拖动`
          : `数字 ${piece.d}，拖进方框，点击旋转`);

        const glyph = document.createElement('span');
        glyph.textContent = piece.d;
        glyph.style.transform = `rotate(${(answerRot[piece.d] % 4) * 90}deg)`;
        el.appendChild(glyph);

        if (pos) {
          el.style.left = `${(pos.x / q.frame) * 100}%`;
          el.style.top = `${(pos.y / q.frame) * 100}%`;
          el.style.width = `${(dims.w / q.frame) * 100}%`;
          el.style.height = `${(dims.h / q.frame) * 100}%`;
          el.classList.add('is-placed');
          stage.appendChild(el);
        } else {
          el.style.width = `${dims.w * TRAY_CELL}px`;
          el.style.height = `${dims.h * TRAY_CELL}px`;
          tray.appendChild(el);
        }

        attachDrag(el, piece, Boolean(pos));
      });

      countEl.textContent = String(placedCount());
      clearBtn.disabled = placedCount() === 0 || !!state.locked[q.id];
      stage.classList.toggle('is-full', placedCount() === q.pieces.length);
    }

    clearBtn.addEventListener('click', () => {
      if (state.locked[q.id]) return;
      q.pieces.forEach(piece => delete answerPos[piece.d]);
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
    revealBtn.textContent = '看 AI 短板解析';

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

    if (q.analysis) {
      const blocks = [
        ['01 / 短板在哪', q.analysis.weak],
        ['02 / 为什么模型不擅长', q.analysis.why],
        ['03 / 主要考验什么能力', q.analysis.ability],
        ['04 / 这个问题怎么解', q.analysis.fix]
      ];
      return `<div class="reveal-head">
          <span class="reveal-label">AI 短板解析</span>
          <p class="reveal-verdict">${q.analysis.verdict}</p>
        </div>
        <div class="reveal-grid">
          ${blocks.map(([label, text]) => `<div class="reveal-block">
            <span class="reveal-tag">${label}</span>
            <p>${text}</p>
          </div>`).join('')}
          <div class="reveal-block reveal-block--human">
            <span class="reveal-tag">05 / 人类现在什么水平</span>
            <p>${q.analysis.human}</p>
          </div>
        </div>`;
    }

    return `<div class="reveal-label">解析</div>
      <p class="reveal-quiet">${q.quiet || '标准答案先留个悬念。把图放大，人类不需要标准答案。'}</p>`;
  }

  function toggleReveal(card) {
    const panel = card.querySelector('[data-reveal-panel]');
    const button = card.querySelector('[data-reveal]');
    panel.hidden = !panel.hidden;
    button.textContent = panel.hidden ? '看 AI 短板解析' : '收起解析';
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
      case 'diff':
        return Array.isArray(answer.marks) && answer.marks.length > 0;
      case 'lights':
        return Array.isArray(answer.lights) && answer.lights.length > 0
          && answer.lights.every(value => !value);
      case 'pack':
        return q.pieces.every(piece => answer.pos && answer.pos[piece.d]);
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
      case 'diff': return '先在图上标出至少一处不同。';
      case 'lights': return '还有灯亮着，全部关掉才能锁定。';
      case 'pack': return '还有数字没放进方框。';
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
      case 'diff':
        return Array.isArray(answer.marks) && answer.marks.length > 0;
      case 'lights':
        return Array.isArray(answer.lights) && (answer.moves || 0) > 0;
      case 'pack':
        return Boolean(answer.pos) && Object.keys(answer.pos).length > 0;
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
  async function shareResults(event) {
    const total = QUESTIONS.length;
    const done = QUESTIONS.filter(q => state.locked[q.id]).length;
    const text = done === 0
      ? '《别问 AI 了，它真不会》：6 道人类一眼看穿、大模型集体沉默的小题。我还没敢开始，你先来？'
      : `我在《别问 AI 了，它真不会》里解锁了 ${done}/${total} 题。6 道人类一眼看穿、大模型集体沉默的小题，你敢来试试吗？`;
    const url = location.href;
    const anchor = event && event.currentTarget;

    // 桌面端浏览器调用 navigator.share 会弹系统分享面板，常常一闪就关；
    // 只在触屏设备上使用系统分享，桌面端统一走复制。
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: '别问 AI 了，它真不会', text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    const payload = `${text}\n${url}`;
    if (await copyText(payload)) {
      showShareFeedback(anchor, '已复制战绩和链接，去粘贴给同事。');
    } else {
      window.prompt('复制下面这段分享：', payload);
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        /* 权限被拒时退回 execCommand */
      }
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  // 按钮旁的常驻回执，不会像 toast 一样自动消失
  function showShareFeedback(anchor, message) {
    const host = anchor && anchor.closest('.hero-actions, .score-actions');
    if (host) {
      let note = host.querySelector('.share-feedback');
      if (!note) {
        note = document.createElement('p');
        note.className = 'share-feedback';
        note.setAttribute('role', 'status');
        host.appendChild(note);
      }
      note.textContent = message;
    }
    toast(message);
  }

  const IDEA_TEMPLATE = [
    '【题目】一句话说清要答什么',
    '【素材】图片 / 视频 / 动图（可附链接）',
    '【坑点】人类一眼看出、模型容易错在哪',
    '【答案】正确答案 + 一句解释',
    '【署名】想挂的名字',
    '【提交】https://github.com/king-jingxiang/1024/issues/new'
  ].join('\n');

  async function copyIdeaTemplate(button) {
    if (await copyText(IDEA_TEMPLATE)) {
      showShareFeedback(button, '投稿模板已复制，去 GitHub 开个 Issue 贴上就行。');
    } else {
      window.prompt('复制下面的投稿模板：', IDEA_TEMPLATE);
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
      element.addEventListener('click', () => element.classList.remove('show'));
      document.body.appendChild(element);
    }

    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 4500);
  }

  /* ========================================================
     首屏控制台动画
     ======================================================== */
  const CONSOLE_LINES = [
    ['$ ai-benchmark --suite=1024', ''],
    ['[ok] 载入 6 道人类小题', ''],
    ['[ok] 模型置信度 99.9%', ''],
    ['[run] 匹配仙鹤头与身体……', ''],
    ['[warn] 找到 5 只身体，0 个正确答案', 'warn'],
    ['[run] 在草丛里找四叶草……', ''],
    ['[fail] 已放弃寻找，开始冥想', 'fail'],
    ['[run] 关掉 5×5 灯阵……', ''],
    ['[fail] 25 个方程，解得满头是汗', 'fail'],
    ['[run] 把 0–9 塞进方框……', ''],
    ['[fail] 数字太大，装不下', 'fail'],
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

    const ideaCopy = document.querySelector('[data-idea-copy]');
    if (ideaCopy) ideaCopy.addEventListener('click', () => copyIdeaTemplate(ideaCopy));
  }

  init();
})();
