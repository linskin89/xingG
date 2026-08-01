/* =====================================================
   星轨 · 养成宠物系统 (pet.js)
   - 9 阶段 SVG 形象
   - 流星经验 / 进化
   - 宠物对话（学习提醒 / 天气 / 休息 / 久未使用）
   ===================================================== */
(function (global) {
  'use strict';

  const STAGES = Store.PET_STAGES;

  /* ---------- 各阶段 SVG（莫兰迪配色，简约可爱） ---------- */
  function svgFor(index) {
    const c = ['#c9a9a6', '#b6a6c9', '#9fb3c6', '#a7b5a0', '#9fc0bb', '#d9c8a4', '#c2ad81', '#9885b3', '#c29a92'];
    const col = c[index] || '#9fb3c6';
    const glow = `filter="drop-shadow(0 4px 10px rgba(120,110,100,.25))"`;
    switch (index) {
      case 0: // 星尘
        return `<svg viewBox="0 0 100 100" ${glow}>
          <g fill="${col}">
            <circle cx="38" cy="46" r="4"/><circle cx="58" cy="38" r="3"/>
            <circle cx="64" cy="60" r="3.5"/><circle cx="44" cy="64" r="2.5"/>
            <circle cx="50" cy="50" r="6" opacity=".9"/>
          </g>
          <g stroke="${col}" stroke-width="1.4" opacity=".6">
            <line x1="50" y1="30" x2="50" y2="40"/><line x1="50" y1="60" x2="50" y2="70"/>
            <line x1="30" y1="50" x2="40" y2="50"/><line x1="60" y1="50" x2="70" y2="50"/>
          </g></svg>`;
      case 1: // 流星
        return `<svg viewBox="0 0 100 100" ${glow}>
          <line x1="22" y1="30" x2="62" y2="62" stroke="${col}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
          <circle cx="66" cy="64" r="11" fill="${col}"/>
          <circle cx="62" cy="60" r="4" fill="#fff" opacity=".5"/></svg>`;
      case 2: // 慧星
        return `<svg viewBox="0 0 100 100" ${glow}>
          <path d="M20 28 L70 66" stroke="${col}" stroke-width="7" stroke-linecap="round" opacity=".4"/>
          <path d="M30 30 L66 60" stroke="${col}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
          <circle cx="72" cy="68" r="13" fill="${col}"/>
          <circle cx="68" cy="64" r="5" fill="#fff" opacity=".5"/></svg>`;
      case 3: // 小行星
        return `<svg viewBox="0 0 100 100" ${glow}>
          <circle cx="50" cy="52" r="22" fill="${col}"/>
          <circle cx="42" cy="46" r="4" fill="#fff" opacity=".35"/>
          <circle cx="58" cy="58" r="5" fill="#7a6f66" opacity=".3"/>
          <circle cx="54" cy="44" r="2.5" fill="#7a6f66" opacity=".3"/></svg>`;
      case 4: // 行星（带光环）
        return `<svg viewBox="0 0 100 100" ${glow}>
          <ellipse cx="50" cy="52" rx="34" ry="11" fill="none" stroke="${col}" stroke-width="4" opacity=".8" transform="rotate(-18 50 52)"/>
          <circle cx="50" cy="52" r="20" fill="${col}"/>
          <circle cx="44" cy="47" r="6" fill="#fff" opacity=".4"/></svg>`;
      case 5: // 恒星（带光芒）
        return `<svg viewBox="0 0 100 100" ${glow}>
          <g stroke="${col}" stroke-width="3" stroke-linecap="round" opacity=".7">
            <line x1="50" y1="14" x2="50" y2="28"/><line x1="50" y1="74" x2="50" y2="88"/>
            <line x1="14" y1="50" x2="28" y2="50"/><line x1="72" y1="50" x2="86" y2="50"/>
            <line x1="26" y1="26" x2="36" y2="36"/><line x1="64" y1="64" x2="74" y2="74"/>
            <line x1="74" y1="26" x2="64" y2="36"/><line x1="36" y1="64" x2="26" y2="74"/>
          </g>
          <circle cx="50" cy="50" r="19" fill="${col}"/>
          <circle cx="44" cy="45" r="6" fill="#fff" opacity=".45"/></svg>`;
      case 6: // 启明星（明亮星）
        return `<svg viewBox="0 0 100 100" ${glow}>
          <path d="M50 18 L56 44 L82 50 L56 56 L50 82 L44 56 L18 50 L44 44 Z" fill="${col}"/>
          <circle cx="50" cy="50" r="9" fill="#fff" opacity=".55"/></svg>`;
      case 7: // 中子星（致密亮核）
        return `<svg viewBox="0 0 100 100" ${glow}>
          <circle cx="50" cy="50" r="30" fill="${col}" opacity=".25"/>
          <circle cx="50" cy="50" r="16" fill="${col}"/>
          <circle cx="50" cy="50" r="8" fill="#fff" opacity=".7"/>
          <g stroke="${col}" stroke-width="2" opacity=".5">
            <line x1="50" y1="8" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="92"/>
            <line x1="8" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="92" y2="50"/>
          </g></svg>`;
      case 8: // 超新星（爆发）
      default:
        return `<svg viewBox="0 0 100 100" ${glow}>
          <g stroke="${col}" stroke-width="3" stroke-linecap="round">
            <line x1="50" y1="10" x2="50" y2="30"/><line x1="50" y1="70" x2="50" y2="90"/>
            <line x1="10" y1="50" x2="30" y2="50"/><line x1="70" y1="50" x2="90" y2="50"/>
            <line x1="22" y1="22" x2="38" y2="38"/><line x1="62" y1="62" x2="78" y2="78"/>
            <line x1="78" y1="22" x2="62" y2="38"/><line x1="38" y1="62" x2="22" y2="78"/>
          </g>
          <circle cx="50" cy="50" r="14" fill="${col}"/>
          <circle cx="50" cy="50" r="7" fill="#fff" opacity=".8"/>
          <circle cx="50" cy="50" r="26" fill="none" stroke="${col}" stroke-width="2" opacity=".4"/></svg>`;
    }
  }

  /* ---------- 经验 / 进化计算 ---------- */
  function stageInfo(meteor) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (meteor >= STAGES[i].need) idx = i; else break;
    }
    const cur = STAGES[idx];
    const next = STAGES[idx + 1];
    const curNeed = cur.need;
    const nextNeed = next ? next.need : null;
    const span = nextNeed != null ? (nextNeed - curNeed) : 1;
    const prog = nextNeed != null ? Math.min(1, (meteor - curNeed) / span) : 1;
    return {
      index: idx, name: cur.name,
      next: next ? next.name : null,
      nextNeed, curNeed,
      toNext: nextNeed != null ? (nextNeed - meteor) : 0,
      prog
    };
  }

  function addMeteor(n) {
    const s = Store.getState();
    s.pet.meteor = (s.pet.meteor || 0) + n;
    const before = s.pet.stageIndex;
    const after = stageInfo(s.pet.meteor).index;
    s.pet.stageIndex = after;
    Store.save();
    return { evolved: after > before, newStage: STAGES[after].name, stageIndex: after };
  }

  /* ---------- 简易天气（演示用，真实可接 API） ---------- */
  const WEATHERS = [
    '今天晴，适合来一套行测模拟题 ☀️',
    '多云转小雨，记得带伞，室内刷题正合适 🌧️',
    '微风，空气清新，学累了可以散步放松 🍃',
    '气温略降，注意保暖，别感冒影响备考 🧣'
  ];
  function randomWeather() { return WEATHERS[Math.floor(Math.random() * WEATHERS.length)]; }

  /* ---------- 宠物对话生成 ---------- */
  function makeSpeech(type) {
    const p = Store.getState().pet;
    switch (type) {
      case 'login':
        return `欢迎回来，${p.name} 陪你一起冲考公！今天也要闪闪发光哦 ✦`;
      case 'weather':
        return randomWeather();
      case 'rest':
        return `你已经学了有一会儿啦，起来拉伸一下、喝口水吧 💧 休息是为了更好地冲刺~`;
      case 'idle':
        return `主人好久没来看我了…${p.name} 想你啦，今天的学习计划完成了吗？`;
      case 'remind':
        return `叮咚！你今天还有学习计划没完成，现在抽 20 分钟刷几道题吧 📚`;
      case 'evolve':
        return `哇！${p.name} 进化成新星啦，谢谢你一直陪我成长 ✦✨`;
      default:
        return `嗨，我是 ${p.name}，我们一起把考公拿下！`;
    }
  }

  function sayFloat(type) {
    const wrap = document.getElementById('petFloat');
    const svg = document.getElementById('petFloatSvg');
    const bub = document.getElementById('petFloatBubble');
    if (!wrap) return;
    svg.innerHTML = svgFor(Store.getState().pet.stageIndex);
    bub.textContent = makeSpeech(type);
    wrap.classList.add('show');
    clearTimeout(wrap._t);
    wrap._t = setTimeout(() => wrap.classList.remove('show'), 6500);
  }

  global.Pet = {
    svgFor, stageInfo, addMeteor, makeSpeech, sayFloat, randomWeather, WEATHERS,
    STAGES
  };
})(window);
