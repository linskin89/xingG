/* =====================================================
   星轨 · 考公工作台  —  主程序 (app.js)
   ===================================================== */
(function () {
  'use strict';

  const S = Store;
  const P = Pet;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const App = {
    route: 'overview',
    quiz: null,
    timer: { running: false, secs: 0, iv: null },
    motiveIv: null,
  };

  /* ============ 初始化 ============ */
  function init() {
    S.ensureSeed();
    refreshDaily();
    bindGlobal();
    renderPet();
    setRoute('overview');
    scheduleReminders();
    maybeIdleNudge();
    // 学习提醒 / 天气气泡
    setTimeout(() => P.sayFloat('login'), 800);
    setTimeout(() => P.sayFloat('weather'), 9000);
  }

  /* 每日重置（06:00 刷新） */
  function refreshDaily() {
    const st = S.getState();
    const today = S.todayStr();
    if (st.daily.date !== today) {
      S.snapshotHistory();   // 把旧的一天写入历史
      st.daily = { date: today, done: {}, claimed: {}, studySeconds: 0, quizCount: 0, quizCorrect: 0 };
      // 登录任务：条件当日即满足，但仍需手动领取奖励
      st.daily.done.login = true;
      st.lastActiveDate = today;
      S.save();
    }
    // 久未使用检测（>2 天）
    st.lastActiveDate = st.lastActiveDate || today;
    S.syncTodayHistory();
    S.save();
    generateTodos();
  }

  function maybeIdleNudge() {
    const st = S.getState();
    const diff = S.dayDiff(st.lastActiveDate, S.todayStr());
    if (diff >= 2) {
      setTimeout(() => P.sayFloat('idle'), 4000);
    }
  }

  /* ============ 每日任务 ============ */
  // 任务达成条件（done）与领奖（claimed）分离：必须先完成才能领取
  function markDone(id) {
    const st = S.getState();
    if (st.daily.done[id]) return;
    st.daily.done[id] = true;
    const def = S.DAILY_TASKS.find(t => t.id === id);
    S.save();
    toast(`任务「${def ? def.title : ''}」已完成，可领取奖励 ✦`, 'ok');
  }
  function claimTask(id) {
    const st = S.getState();
    if (st.daily.claimed[id]) return false;
    if (!st.daily.done[id]) { toast('任务未完成，暂不能领取', 'warn'); return false; }
    const def = S.DAILY_TASKS.find(t => t.id === id);
    if (!def) return false;
    st.daily.claimed[id] = true;
    const r = P.addMeteor(def.reward);
    S.save();
    toast(`领取奖励「${def.title}」 +${def.reward} ✦`, 'ok');
    if (r.evolved) { toast(`🎉 ${st.pet.name} 进化成「${r.newStage}」！`, 'ok'); P.sayFloat('evolve'); }
    renderPet(); updateMiniPet();
    return true;
  }
  function claimedSum() {
    const st = S.getState();
    return S.DAILY_TASKS.reduce((a, t) => a + (st.daily.claimed[t.id] ? t.reward : 0), 0);
  }

  function renderTaskModal() {
    const st = S.getState();
    const box = $('#taskList');
    box.innerHTML = S.DAILY_TASKS.map(t => {
      const done = !!st.daily.done[t.id];
      const claimed = !!st.daily.claimed[t.id];
      const label = claimed ? '已领 ✓' : (done ? '领取' : '进行中');
      const cls = claimed ? '' : (done ? 'primary' : '');
      const dis = (claimed || !done) ? 'disabled' : '';
      return `<div class="task-item">
        <div class="ti-ic">${t.icon}</div>
        <div class="ti-meta"><div class="tt">${esc(t.title)}</div><div class="ts">${esc(t.desc)}</div></div>
        <div class="ti-reward">+${t.reward} ✦</div>
        <button class="btn sm ${cls}" data-task="${t.id}" ${dis}>${label}</button>
      </div>`;
    }).join('');
    $('#todayMeteor').textContent = claimedSum();
    $$('#taskList [data-task]').forEach(b => b.onclick = () => {
      claimTask(b.dataset.task); renderTaskModal();
    });
  }

  /* ============ 宠物渲染 ============ */
  function renderPet() {
    const st = S.getState();
    const info = P.stageInfo(st.pet.meteor);
    $('#petSvg').innerHTML = P.svgFor(st.pet.stageIndex);
    $('#petName').textContent = st.pet.name;
    $('#petStageName').textContent = info.name + (info.next ? ` → ${info.next}` : ' · 已满级');
    const need = info.nextNeed != null ? info.nextNeed : st.pet.meteor;
    $('#xpFill').style.width = (info.prog * 100) + '%';
    $('#xpText').textContent = info.nextNeed != null
      ? `✦ ${st.pet.meteor} / ${info.nextNeed}（还需 ${info.toNext}）`
      : `✦ ${st.pet.meteor}（满级）`;
  }
  function updateMiniPet() {
    const st = S.getState();
    $('#miniPetStage').textContent = P.stageInfo(st.pet.meteor).name;
    $('#miniPetMeteor').textContent = '✦ ' + st.pet.meteor;
  }

  /* ============ 侧边栏 / 路由 ============ */
  function bindGlobal() {
    $('#menuToggle').onclick = openSide;
    $('#closeSide').onclick = closeSide;
    $('#sidebarScrim').onclick = closeSide;
    $$('#nav .nav-item').forEach(b => b.onclick = () => setRoute(b.dataset.route));
    $('#openTasks').onclick = () => { $('#taskModal').classList.add('show'); renderTaskModal(); };
    $('#closeTaskModal').onclick = () => $('#taskModal').classList.remove('show');
    $('#taskModal').onclick = (e) => { if (e.target.id === 'taskModal') $('#taskModal').classList.remove('show'); };
    $('#closeGeneric').onclick = () => $('#genericModal').classList.remove('show');
    $('#genericModal').onclick = (e) => { if (e.target.id === 'genericModal') $('#genericModal').classList.remove('show'); };
    $('#renamePet').onclick = renamePet;
    $('#petTalk').onclick = () => P.sayFloat(['weather', 'rest', 'remind'][Math.floor(Math.random() * 3)]);
    $('#miniPet').onclick = () => { openSide(); };
    $('#factoryReset').onclick = factoryReset;
  }
  function openSide() { $('#sidebar').classList.add('open'); $('#sidebarScrim').classList.add('show'); $('#content').classList.add('sidebar-open'); }
  function closeSide() { $('#sidebar').classList.remove('open'); $('#sidebarScrim').classList.remove('show'); $('#content').classList.remove('sidebar-open'); }

  const ROUTE_META = {
    overview: ['今日总览', '星轨 · 考公备考工作台'],
    plans: ['学习计划', '自定义计划，自动生成今日待办'],
    resources: ['资料库', '联网检索 + 自主导入，分类标签管理'],
    xingce: ['行测试题', ''],
    shenlun: ['申论试题', '申论归纳 / 对策 / 公文写作练习'],
    wrong: ['错题集', '重练答错的题目，答对一次即消除'],
    analytics: ['分析', '每日学习时长与刷题数据可视化'],
    import: ['导入资料', '导入题库与各类学习资料']
  };

  function setRoute(r) {
    App.route = r;
    $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === r));
    const meta = ROUTE_META[r] || ['', ''];
    $('#sectionTitle').textContent = meta[0];
    $('#sectionSub').textContent = meta[1];
    $('#sectionSub').style.display = meta[1] ? '' : 'none';
    closeSide();
    const c = $('#content');
    if (r === 'overview') renderOverview(c);
    else if (r === 'plans') renderPlans(c);
    else if (r === 'resources') renderResources(c);
    else if (r === 'xingce') renderQuizLanding(c, '行测');
    else if (r === 'shenlun') renderQuizLanding(c, '申论');
    else if (r === 'wrong') renderWrong(c);
    else if (r === 'analytics') renderAnalytics(c);
    else if (r === 'import') renderImport(c);
    c.scrollTop = 0;
  }

  /* ============ 通用组件 ============ */
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    $('#toastWrap').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
  }
  function openGeneric(title, html, onMount) {
    $('#genericTitle').textContent = title;
    $('#genericBody').innerHTML = html;
    $('#genericModal').classList.add('show');
    if (onMount) onMount($('#genericBody'));
  }
  /* 应用内确认框（避免 window.confirm 在移动端 webview 被禁用） */
  function confirmModal(message, onYes) {
    openGeneric('请确认', `
      <div style="padding:6px 2px;font-size:14px;color:var(--text)">${esc(message)}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="btn ghost" id="cfNo">取消</button>
        <button class="btn rose" id="cfYes">删除</button>
      </div>`, (b) => {
      b.querySelector('#cfNo').onclick = () => $('#genericModal').classList.remove('show');
      b.querySelector('#cfYes').onclick = () => {
        $('#genericModal').classList.remove('show');
        if (onYes) onYes();
      };
    });
  }

  /* ============ 今日待办生成 ============ */
  function generateTodos() {
    const st = S.getState();
    const wd = new Date().getDay();
    const today = S.todayStr();
    const todos = [];
    st.plans.forEach(p => {
      if (!p.active) return;
      if (!p.repeat.includes(wd)) return;
      const n = Math.max(1, p.count || 1);
      for (let i = 0; i < n; i++) {
        todos.push({
          id: `td_${p.id}_${i}`, planId: p.id, name: p.name,
          time: p.time, done: false, date: today
        });
      }
    });
    // 合并已完成的（保留完成态）
    const prev = st.todos.filter(t => t.date === today);
    todos.forEach(t => {
      const old = prev.find(o => o.id === t.id);
      if (old && old.done) t.done = true;
    });
    st.todos = todos;
    S.save();
  }

  /* ============================================================
     今日总览
     ============================================================ */
  function renderOverview(c) {
    const st = S.getState();
    const todos = st.todos;
    const done = todos.filter(t => t.done).length;
    const total = todos.length;
    const avgMaster = bankMasteryAvg();
    const wrong = st.wrong.length;
    const res = st.resources.length;
    const cds = st.countdowns || [];
    const nearest = cds
      .filter(d => d.target && S.dayDiff(S.todayStr(), d.target) >= 0)
      .sort((a, b) => S.dayDiff(S.todayStr(), a.target) - S.dayDiff(S.todayStr(), b.target))[0];
    const info = P.stageInfo(st.pet.meteor);

    c.innerHTML = `
      <div class="grid grid-3" style="margin-bottom:16px">
        <div class="card glass stat">
          <div class="num ${total === done && total ? 'green' : 'blue'}">${done}<span style="font-size:16px;color:var(--text-soft)"> / ${total}</span></div>
          <div class="lbl">今日待办完成</div>
        </div>
        <div class="card glass stat">
          <div class="num green">${avgMaster}%</div>
          <div class="lbl">题库平均掌握度</div>
        </div>
        <div class="card glass stat" data-go="wrong" style="cursor:pointer">
          <div class="num rose">${wrong}</div>
          <div class="lbl">待巩固错题</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px">
        <div class="card glass">
          <h3>⏳ 备考倒计时</h3>
          <div id="cdList">
            ${cds.length ? cds.map(cdRow).join('') : '<div class="empty small">还没有考试项目，点击下方「新增考试」添加一个吧</div>'}
          </div>
          <button class="btn sm primary" id="addCd" style="margin-top:10px">＋ 新增考试</button>
          <div class="motivate-box" id="motivateBox">
            <span class="motivate-ic">💡</span>
            <span class="motivate-txt" id="motivateTxt"></span>
          </div>
        </div>

        <div class="card glass">
          <h3>🧠 专注计时</h3>
          <div class="timer-box">
            <div class="timer-num" id="timerNum">00:00</div>
            <div class="pbar" style="width:100%"><span id="timerBar" style="width:0%"></span></div>
            <div style="display:flex;gap:8px">
              <button class="btn green" id="timerToggle">开始专注</button>
              <button class="btn" id="timerEnd">结束专注</button>
              <button class="btn ghost" id="timerReset">重置</button>
            </div>
            <div class="muted small">今日已专注 ${fmtSec(st.daily.studySeconds)} · 累计满 45 分钟完成每日任务</div>
          </div>
        </div>
      </div>

      <div class="card glass" style="margin-bottom:16px">
        <h3>📌 今日学习计划</h3>
        <div class="list" id="ovTodos">
          ${todos.length ? todos.map(todoRow).join('') : '<div class="empty"><div class="big">🗒️</div>还没有今日计划，去「学习计划」创建吧</div>'}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card glass">
          <h3>🐾 我的星星 · ${esc(st.pet.name)}</h3>
          <div class="ring-wrap">
            <div class="pet-svg" style="width:80px;height:80px">${P.svgFor(st.pet.stageIndex)}</div>
            <div>
              <div style="font-weight:700">${info.name}${info.next ? ' → ' + info.next : '（满级）'}</div>
              <div class="muted small">✦ ${st.pet.meteor}${info.nextNeed != null ? ' / ' + info.nextNeed : ''}</div>
              <div class="pbar" style="width:140px;margin-top:6px"><span style="width:${(info.prog * 100)}%"></span></div>
              <div class="muted small" style="margin-top:4px">${info.nextNeed != null ? '还需 ' + info.toNext + ' ✦ 进化' : '已达最终形态'}</div>
            </div>
          </div>
        </div>
        <div class="card glass">
          <h3>🚀 快捷入口</h3>
          <div class="toolbar">
            <button class="btn primary" data-go="xingce">去刷题（行测）</button>
            <button class="btn primary" data-go="shenlun">去刷题（申论）</button>
            <button class="btn" data-go="resources">资料库</button>
            <button class="btn" data-go="plans">管理计划</button>
            <button class="btn rose" id="ovTask">今日任务</button>
          </div>
          <div class="muted small">今日已收集流星 <b>${claimedSum()}</b> ✦</div>
        </div>
      </div>
    `;

    // 绑定
    $('#addCd').onclick = () => openCountdownModal(null);
    $$('#cdList .cd-edit').forEach(b => b.onclick = () => openCountdownModal(b.dataset.id));
    $$('#cdList .cd-del').forEach(b => b.onclick = () => delCountdown(b.dataset.id));
    $('#ovTask').onclick = () => { $('#taskModal').classList.add('show'); renderTaskModal(); };
    $$('#ovTodos .check').forEach(ch => ch.onclick = () => toggleTodo(ch.dataset.id));
    $$('[data-go]').forEach(b => b.onclick = () => setRoute(b.dataset.go));
    bindTimer();
    updateTimerUI();
    startMotivation();
  }

  function cdRow(d) {
    const days = d.target ? S.dayDiff(S.todayStr(), d.target) : null;
    const ringD = days == null ? '—' : (days >= 0 ? days : '已过');
    const tag = days == null ? '未设日期' : (days < 0 ? '已结束' : (days === 0 ? '就是今天' : '剩 ' + days + ' 天'));
    return `<div class="cd-item">
      <div class="cd-ring">${ringSVG(d.prep || 0, ringD)}</div>
      <div class="cd-info">
        <div class="cd-name">${esc(d.name || '未命名')}</div>
        <div class="muted small">${d.target ? '目标 ' + esc(d.target) + ' · ' : ''}进度 ${d.prep || 0}% · ${tag}</div>
      </div>
      <div class="cd-ops">
        <button class="icon-btn sm cd-edit" data-id="${d.id}" title="编辑">✎</button>
        <button class="icon-btn sm cd-del" data-id="${d.id}" title="删除">🗑</button>
      </div>
    </div>`;
  }

  function todoRow(t) {
    return `<div class="item">
      <div class="check ${t.done ? 'done' : ''}" data-id="${t.id}">${t.done ? '✓' : ''}</div>
      <div class="meta"><div class="t ${t.done ? 'done-text' : ''}">${esc(t.name)}</div>
        <div class="s">${esc(t.time || '全天')}</div></div>
    </div>`;
  }
  function toggleTodo(id) {
    const st = S.getState();
    const t = st.todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done; S.save();
    setRoute('overview');
  }

  function ringSVG(pct, center) {
    const r = 38, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, pct) / 100);
    return `<svg class="ring" viewBox="0 0 100 100">
      <circle class="bg" cx="50" cy="50" r="${r}"/>
      <circle class="fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
      <text x="50" y="46" text-anchor="middle" font-size="15" font-weight="700" fill="#4b4742">${center}</text>
      <text x="50" y="62" text-anchor="middle" font-size="10" fill="#8c867d">${pct}%</text>
    </svg>`;
  }

  function bankMasteryAvg() {
    const st = S.getState();
    if (!st.banks.length) return 0;
    const sum = st.banks.reduce((a, b) => a + (b.mastered ? 1 : 0), 0);
    return Math.round(sum / st.banks.length * 100);
  }

  /* 条形图（水平）：rows = [{label, value, display, color}] */
  function hBars(rows) {
    if (!rows.length) return '<div class="empty small">暂无数据，去刷题后这里会显示</div>';
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="hbar-list">` + rows.map(r => {
      const pct = Math.max(2, Math.round(r.value / max * 100));
      return `<div class="hbar-row">
        <div class="hbar-label" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${r.color || 'var(--m-blue-d)'}"></div></div>
        <div class="hbar-val">${esc(r.display)}</div>
      </div>`;
    }).join('') + `</div>`;
  }

  /* 柱状图（垂直，每日学习时长）：days = [{label, value}]，value 单位秒 */
  function vBars(days) {
    if (!days.length) return '<div class="empty small">暂无学习记录</div>';
    const max = Math.max(1, ...days.map(d => d.value));
    return `<div class="vbars">` + days.map(d => {
      const isEmpty = (d.value || 0) <= 0;
      const h = isEmpty ? 6 : Math.round(d.value / max * 100);
      const mm = Math.round((d.value || 0) / 60);
      return `<div class="vbar-col" title="${esc(d.label)}：${isEmpty ? '未学习（空状态）' : mm + ' 分钟'}">
        <div class="vbar-wrap"><div class="vbar${isEmpty ? ' empty' : ''}" style="height:${h}%;${isEmpty ? '' : 'background:var(--m-green-d)'}"></div></div>
        <div class="vbar-x">${esc(d.label)}</div>
      </div>`;
    }).join('') + `</div>`;
  }


  /* 专注计时 */
  function bindTimer() {
    $('#timerToggle').onclick = () => {
      App.timer.running = !App.timer.running;
      if (App.timer.running) {
        $('#timerToggle').textContent = '暂停';
        App.timer.iv = setInterval(() => {
          App.timer.secs++;
          const st = S.getState();
          S.addStudy(1);
          if (st.daily.studySeconds >= 2700) markDone('study45');
          S.syncTodayHistory(); S.save(); updateTimerUI();
        }, 1000);
      } else {
        $('#timerToggle').textContent = '继续';
        clearInterval(App.timer.iv);
      }
    };
    $('#timerEnd').onclick = () => {
      clearInterval(App.timer.iv); App.timer.running = false; App.timer.secs = 0;
      $('#timerToggle').textContent = '开始专注';
      updateTimerUI();
      const total = S.getState().daily.studySeconds || 0;
      toast('已结束专注，今日累计专注 ' + fmtSec(total), 'ok');
    };
    $('#timerReset').onclick = () => {
      clearInterval(App.timer.iv); App.timer.running = false; App.timer.secs = 0;
      $('#timerToggle').textContent = '开始专注'; updateTimerUI();
    };
  }
  function updateTimerUI() {
    const st = S.getState();
    const total = (App.timer.secs || 0) + (st.daily.studySeconds || 0);
    $('#timerNum') && ($('#timerNum').textContent = fmtSec(total));
    const done = Math.min(1, total / 2700);
    $('#timerBar') && ($('#timerBar').style.width = (done * 100) + '%');
  }
  function fmtSec(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), ss = s % 60; return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }

  /* 倒计时设置（支持多项目：新增 / 编辑） */
  function openCountdownModal(editId) {
    const st = S.getState();
    const editing = editId ? (st.countdowns || []).find(d => d.id === editId) : null;
    openGeneric(editing ? '✎ 编辑考试项目' : '⏳ 新增考试项目', `
      <div class="field"><label>考试项目名称</label><input class="input" id="cdName" placeholder="如：福建省考 / 国考 / 事业单位" value="${editing ? esc(editing.name) : ''}"></div>
      <div class="field"><label>目标日期</label><input class="input" type="date" id="cdTarget" value="${editing ? esc(editing.target || '') : ''}"></div>
      <div class="field"><label>备考百分比进度（0-100）</label><input class="input" type="number" min="0" max="100" id="cdPrep" value="${editing ? (editing.prep || 0) : 0}"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="cdCancel">取消</button>
        <button class="btn primary" id="cdSave">${editing ? '保存' : '添加'}</button>
      </div>`, (b) => {
      b.querySelector('#cdCancel').onclick = () => $('#genericModal').classList.remove('show');
      b.querySelector('#cdSave').onclick = () => {
        const name = b.querySelector('#cdName').value.trim();
        if (!name) return toast('请填写考试项目名称', 'warn');
        const target = b.querySelector('#cdTarget').value;
        const prep = Math.max(0, Math.min(100, +b.querySelector('#cdPrep').value || 0));
        const cds = S.getState().countdowns || (S.getState().countdowns = []);
        if (editing) {
          Object.assign(editing, { name, target, prep });
        } else {
          cds.push({ id: 'cd' + Date.now().toString(36), name, target, prep });
        }
        S.save();
        $('#genericModal').classList.remove('show');
        toast(editing ? '已保存' : '已新增考试项目', 'ok');
        setRoute('overview'); updateMiniCountdown();
      };
    });
  }
  function delCountdown(id) {
    confirmModal('确定删除该考试项目？', () => {
      const st = S.getState();
      st.countdowns = (st.countdowns || []).filter(d => d.id !== id);
      S.save(); toast('已删除', 'ok'); setRoute('overview'); updateMiniCountdown();
    });
  }
  function updateMiniCountdown() {
    const cds = S.getState().countdowns || [];
    const up = cds
      .filter(d => d.target && S.dayDiff(S.todayStr(), d.target) >= 0)
      .sort((a, b) => S.dayDiff(S.todayStr(), a.target) - S.dayDiff(S.todayStr(), b.target))[0];
    $('#miniCdValue').textContent = up ? S.dayDiff(S.todayStr(), up.target) : '--';
  }

  /* ============================================================
     激励语（内置题库 + 模板生成，自动轮播变换）
     ============================================================ */
  const MOTIVES = [
    '今天的翻书声，是明天考场上的底气。',
    '你流过的每一滴汗，都会变成录取通知书上的墨。',
    '与其担心考不上，不如多背一道题。',
    '慢一点没关系，只要一直在往前走。',
    '上岸不是运气，是每天多坚持的那一点点。',
    '把“我考不上”换成“我正在靠近”。',
    '你现在的努力，是给未来的自己撑伞。',
    '行测练的是速度，申论练的是格局，你都在变强。',
    '错题不是打击，是考试在提前告诉你该补哪。',
    '今天多学一小时，考场上就少慌一秒。',
    '别人在刷手机，你在刷题库，差距就是这样来的。',
    '星光不问赶路人，时光不负有心人。',
    '别被进度吓到，拆成每天的小目标就够了。',
    '坚持的意义，是让运气追得上你的实力。',
    '把大目标切成小块，今天搞定这一块就好。',
    '你不需要比所有人强，只要比昨天的自己强。',
    '资料分析算不对？那是还没练够，再来一组。',
    '申论不会写？先逼自己写满三行，思路就来了。',
    '倒计时在走，但你的努力也在走，而且更快。',
    '每一个早起的清晨，都在为录取名单上的名字投票。'
  ];
  function genMotive() {
    const st = S.getState();
    const up = (st.countdowns || [])
      .filter(d => d.target && S.dayDiff(S.todayStr(), d.target) >= 0)
      .sort((a, b) => S.dayDiff(S.todayStr(), a.target) - S.dayDiff(S.todayStr(), b.target))[0];
    const days = up ? S.dayDiff(S.todayStr(), up.target) : null;
    const tmpl = [
      () => `距离「${up ? up.name : '考试'}」还有 ${days} 天，稳住节奏，一天天啃下来。`,
      () => `「${up ? up.name : '考试'}」倒计时 ${days} 天，今天的小目标完成了吗？`,
      () => days != null ? `还有 ${days} 天就要上场了，把焦虑换成刷题的动力。` : '把今天过好，就是离上岸更近一步。'
    ];
    if (up && Math.random() < 0.45) return tmpl[Math.floor(Math.random() * tmpl.length)]();
    return MOTIVES[Math.floor(Math.random() * MOTIVES.length)];
  }
  function startMotivation() {
    const box = $('#motivateTxt');
    if (!box) return;
    const tick = () => { box.textContent = genMotive(); };
    tick();
    clearInterval(App.motiveIv);
    App.motiveIv = setInterval(tick, 6000); // 每 6 秒变换一次
  }

  /* ============================================================
     学习计划
     ============================================================ */
  function renderPlans(c) {
    const st = S.getState();
    const wdNames = ['日', '一', '二', '三', '四', '五', '六'];
    c.innerHTML = `
      <div class="card glass" style="margin-bottom:16px">
        <h3>➕ 新建学习计划</h3>
        <div class="field"><label>项目名称</label><input class="input" id="pName" placeholder="如：行测言语理解专项"></div>
        <div class="row">
          <div class="field" style="flex:1"><label>时间段</label><input class="input" type="time" id="pTime" value="09:00"></div>
          <div class="field" style="flex:1"><label>每日次数</label><input class="input" type="number" min="1" max="10" id="pCount" value="1"></div>
        </div>
        <div class="field"><label>重复时间（星期）</label>
          <div class="row" id="pRepeat">
            ${wdNames.map((n, i) => `<span class="chip blue on" data-wd="${i}">周${n}</span>`).join('')}
          </div>
        </div>
        <button class="btn primary" id="pAdd">创建计划</button>
      </div>

      <div class="card glass">
        <h3>📋 我的计划（${st.plans.length}）</h3>
        <div class="list" id="planList">
          ${st.plans.length ? st.plans.map(p => `
            <div class="item">
              <div class="ic">📚</div>
              <div class="meta"><div class="t">${esc(p.name)}</div>
                <div class="s">${esc(p.time)} · 每天 ${p.count} 次 · 周${p.repeat.map(i => wdNames[i]).join('、')} · ${p.active ? '启用' : '停用'}</div></div>
              <div class="act">
                <button class="btn sm" data-toggle="${p.id}">${p.active ? '停用' : '启用'}</button>
                <button class="btn sm rose" data-del="${p.id}">删除</button>
              </div>
            </div>`).join('') : '<div class="empty"><div class="big">📭</div>暂无计划</div>'}
        </div>
      </div>
    `;
    // 重复选择
    $$('#pRepeat .chip').forEach(ch => ch.onclick = () => ch.classList.toggle('on'));
    $('#pAdd').onclick = () => {
      const name = $('#pName').value.trim();
      if (!name) return toast('请填写项目名称', 'warn');
      const repeat = $$('#pRepeat .chip.on').map(ch => +ch.dataset.wd);
      if (!repeat.length) return toast('请至少选择一个重复日', 'warn');
      const p = {
        id: 'pl_' + Date.now(), name,
        time: $('#pTime').value || '09:00',
        count: Math.max(1, +$('#pCount').value || 1),
        repeat, active: true
      };
      S.getState().plans.push(p); S.save(); generateTodos();
      toast('计划已创建，已生成今日待办', 'ok'); setRoute('plans');
    };
    $$('[data-toggle]').forEach(b => b.onclick = () => {
      const p = S.getState().plans.find(x => x.id === b.dataset.toggle);
      p.active = !p.active; S.save(); generateTodos(); setRoute('plans');
    });
    $$('[data-del]').forEach(b => b.onclick = () => {
      S.getState().plans = S.getState().plans.filter(x => x.id !== b.dataset.del);
      S.save(); generateTodos(); setRoute('plans');
    });
  }

  /* ============================================================
     资料库
     ============================================================ */
  function renderResources(c) {
    const st = S.getState();
    const typeIcon = { word: '📝', pdf: '📄', ppt: '📊', image: '🖼️', video: '🎬', audio: '🎵', other: '📦' };
    const catFilter = (c._cat || '全部');
    let list = st.resources;
    if (catFilter !== '全部') list = list.filter(r => r.type === catFilter);
    const cats = ['全部', 'word', 'pdf', 'ppt', 'image', 'video', 'audio', 'other'];

    c.innerHTML = `
      <div class="toolbar">
        ${cats.map(ca => `<span class="chip ${ca === catFilter ? 'on' : ''}" data-cat="${ca}">${ca === '全部' ? '全部' : (typeIcon[ca] || '') + ' ' + ca}</span>`).join('')}
        <span style="flex:1"></span>
        <button class="btn primary" data-go="import">⤓ 导入资料</button>
        <button class="btn" id="resSearch">🌐 联网检索行测/申论</button>
      </div>
      <div class="res-grid" id="resGrid">
        ${list.length ? list.map(r => `
          <div class="res-card glass">
            <div class="res-thumb">${typeIcon[r.type] || '📦'}</div>
            <div class="t">${esc(r.name)}</div>
            <div class="s">${esc(r.category || r.type)} · ${esc(r.date)}</div>
            <div class="res-tags">${(r.tags || []).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}</div>
            <div class="act" style="display:flex;gap:6px;margin-top:4px">
              <button class="btn sm" data-open="${r.id}">打开</button>
              <button class="btn sm rose" data-rdel="${r.id}">删除</button>
            </div>
          </div>`).join('') : '<div class="empty" style="grid-column:1/-1"><div class="big">📚</div>资料库为空，去「导入资料」添加吧</div>'}
      </div>
    `;
    $$('[data-cat]').forEach(ch => ch.onclick = () => { c._cat = ch.dataset.cat; renderResources(c); });
    $$('[data-go]').forEach(b => b.onclick = () => setRoute(b.dataset.go));
    $('#resSearch').onclick = openResourceSearch;
    $$('[data-open]').forEach(b => b.onclick = () => openResource(b.dataset.open));
    $$('[data-rdel]').forEach(b => b.onclick = () => {
      const id = b.dataset.rdel;
      S.getState().resources = S.getState().resources.filter(x => x.id !== id);
      S.delFile(id); S.save(); renderResources(c); toast('已删除', 'ok');
    });
  }

  async function openResource(id) {
    const r = S.getState().resources.find(x => x.id === id);
    if (!r) return;
    const blob = await S.getFile(id);
    if (!blob) return toast('文件数据缺失', 'warn');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function openResourceSearch() {
    openGeneric('🌐 联网检索资料', `
      <p class="muted small">离线环境暂不支持实时联网抓取，以下为内置精选资料入口（演示）。联网能力可在部署后端后接入真实检索。</p>
      <div class="list" style="margin-top:10px">
        <div class="item"><div class="ic">📘</div><div class="meta"><div class="t">行测高分技巧合集</div><div class="s">言语 / 判断 / 资料分析 方法论</div></div><button class="btn sm" data-add="行测高分技巧合集|行测|方法">收录</button></div>
        <div class="item"><div class="ic">📗</div><div class="meta"><div class="t">申论范文 100 篇</div><div class="s">归纳概括 / 对策 / 公文写作</div></div><button class="btn sm" data-add="申论范文100篇|申论|范文">收录</button></div>
        <div class="item"><div class="ic">📙</div><div class="meta"><div class="t">福建省考历年真题解析</div><div class="s">近 5 年真题 + 答案解析</div></div><button class="btn sm" data-add="福建省考历年真题解析|真题|福建">收录</button></div>
      </div>
      <p class="muted small" style="margin-top:10px">也可在「导入资料」中上传本地 Word/PDF/PPT/图片/音视频。</p>
    `, (b) => {
      $$('[data-add]', b).forEach(btn => btn.onclick = () => {
        const [name, category, tag] = btn.dataset.add.split('|');
        S.getState().resources.push({
          id: 'res_' + Date.now() + Math.random().toString(36).slice(2, 6),
          name, type: 'other', category, tags: [tag], date: S.todayStr(),
          note: '联网检索收录（演示）'
        });
        S.save(); toast('已收录到资料库', 'ok'); $('#genericModal').classList.remove('show');
        if (App.route === 'resources') setRoute('resources');
      });
    });
  }

  /* ============================================================
     题库 / 刷题
     ============================================================ */
  function renderQuizLanding(c, category) {
    const st = S.getState();
    const banks = st.banks.filter(b => b.category === category);
    const tags = [...new Set(banks.map(b => b.bank))];
    // 按 tag 聚合掌握度
    const groups = tags.map(tag => {
      const qs = banks.filter(b => b.bank === tag);
      const m = qs.filter(q => q.mastered).length;
      return { tag, total: qs.length, m, pct: qs.length ? Math.round(m / qs.length * 100) : 0 };
    });
    const wrongCount = st.wrong.filter(w => w.category === category).length;

    c.innerHTML = `
      <div class="card glass" style="margin-bottom:16px">
        <h3>🎯 选择题库开始练习（${category}）</h3>
        <div class="toolbar">
          <button class="btn primary" data-start="all">全部 ${category}（${banks.length}）</button>
          ${groups.map(g => `<button class="btn" data-start="tag:${esc(g.tag)}">${esc(g.tag)}（${g.total}）</button>`).join('')}
          ${wrongCount ? `<button class="btn rose" data-start="wrong">🔁 错题重练（${wrongCount}）</button>` : ''}
        </div>
        <p class="hint">选择题每次选项随机乱序；简答题自动生成「会 / 不会」；错题将进入错题集，重练答对一次即消除。</p>
      </div>

      <div class="card glass">
        <h3>📊 各标签掌握度</h3>
        <div class="list">
          ${groups.map(g => `<div class="item">
            <div class="ic">📈</div>
            <div class="meta" style="flex:1"><div class="t">${esc(g.tag)}</div>
              <div class="pbar" style="margin-top:6px"><span style="width:${g.pct}%"></span></div></div>
            <div class="s" style="min-width:54px;text-align:right">${g.m}/${g.total}<br>${g.pct}%</div>
          </div>`).join('')}
          ${!groups.length ? '<div class="empty"><div class="big">📭</div>暂无题库，去「导入资料」导入真题</div>' : ''}
        </div>
      </div>
    `;
    $$('[data-start]').forEach(b => b.onclick = () => startQuiz(c, category, b.dataset.start));
  }

  function startQuiz(c, category, mode) {
    const st = S.getState();
    let queue = [];
    if (mode === 'all') queue = st.banks.filter(b => b.category === category);
    else if (mode === 'wrong') queue = st.wrong.filter(w => (category ? w.category === category : true));
    else if (mode === 'wrong-all') queue = st.wrong.slice();
    else if (mode.startsWith('tag:')) {
      const tag = mode.slice(4);
      queue = st.banks.filter(b => b.category === category && b.bank === tag);
    }
    if (!queue.length) return toast('该题库暂无题目', 'warn');
    // 乱序题目
    queue = shuffle(queue.slice());
    App.quiz = { category: category || '错题', mode, queue, idx: 0, correct: 0, total: queue.length, sessionCorrect: 0, timings: [] };
    renderQuizQuestion(c);
  }

  function renderQuizQuestion(c) {
    const q = App.quiz.queue[App.quiz.idx];
    const num = App.quiz.idx + 1, total = App.quiz.total;
    let optsHtml = '';
    if (q.type === 'choice') {
      const order = shuffle(q.options.map((_, i) => i));
      optsHtml = order.map((oi, k) => `
        <div class="opt" data-oi="${oi}" data-k="${k}">
          <span class="tag">${'ABCD'[k]}</span><span>${esc(q.options[oi])}</span>
        </div>`).join('');
    } else {
      optsHtml = `
        <div class="opt big" data-short="会">✅ 会</div>
        <div class="opt big" data-short="不会">❌ 不会</div>`;
    }
    c.innerHTML = `
      <div class="quiz-card glass">
        <div class="quiz-progress">第 ${num} / ${total} 题 · ${esc(q.bank || q.category)} · 本次正确 ${App.quiz.sessionCorrect}</div>
        <div class="quiz-timer">⏱ 本题用时 <b id="qTimer">00:00</b></div>
        <div class="quiz-q">${num}. ${esc(q.q)}</div>
        <div class="quiz-opts" id="quizOpts">${optsHtml}</div>
        <div class="explain" id="explain">
          <b>解析：</b>${esc(q.explain || '（暂无解析）')}
        </div>
        <div class="quiz-foot">
          <button class="btn ghost sm" id="qQuit">退出</button>
          <button class="btn primary" id="qNext" disabled>${num === total ? '完成' : '下一题'}</button>
        </div>
      </div>
    `;
    $('#qQuit').onclick = () => finishQuiz(c);
    // 本题实时计时
    if (App.quiz.timerIv) clearInterval(App.quiz.timerIv);
    App.quiz.qStart = Date.now();
    const tEl = $('#qTimer');
    App.quiz.timerIv = setInterval(() => { if (tEl) tEl.textContent = fmtSec((Date.now() - App.quiz.qStart) / 1000); }, 500);
    const opts = $$('#quizOpts .opt');
    opts.forEach(o => o.onclick = () => {
      if ($('#qNext').dataset.locked) return;
      if (App.quiz.timerIv) clearInterval(App.quiz.timerIv); // 冻结本题计时
      let correct;
      if (q.type === 'choice') {
        const oi = +o.dataset.oi;
        correct = (oi === q.answer);
        opts.forEach(x => {
          const xo = +x.dataset.oi;
          if (xo === q.answer) x.classList.add('correct');
          if (x === o && !correct) x.classList.add('wrong');
        });
      } else {
        const pick = o.dataset.short;
        correct = (pick === (q.answer || '会'));
        opts.forEach(x => {
          if (x.dataset.short === '会') x.classList.add('correct');
          if (x === o && !correct) x.classList.add('wrong');
        });
      }
      onAnswer(correct, q);
      $('#explain').classList.add('show');
      $('#qNext').dataset.locked = '1';
      $('#qNext').disabled = false;
    });
    $('#qNext').onclick = () => {
      if (App.quiz.idx + 1 >= App.quiz.total) return finishQuiz(c);
      App.quiz.idx++; renderQuizQuestion(c);
    };
  }

  function onAnswer(correct, q) {
    const st = S.getState();
    const elapsed = (Date.now() - App.quiz.qStart) / 1000;
    const tag = q.bank || q.category;
    // 记录刷题统计（各标签用时 / 正确率 / 学习时长）
    S.recordQuizAnswer(q.category, tag, elapsed, correct);
    App.quiz.sessionCorrect += correct ? 1 : 0;
    if (S.getState().daily.quizCount >= 20) markDone('quiz20');
    if (S.getState().daily.studySeconds >= 2700) markDone('study45');
    // 掌握度
    if (correct) {
      const src = st.banks.find(b => b.id === q.id);
      if (src && !src.mastered) { src.mastered = 1; }
      // 错题集消除
      if (isWrongMode()) {
        st.wrong = st.wrong.filter(w => !(w.q === q.q && w.category === q.category));
        toast('错题已巩固，从错题集消除 ✦', 'ok');
      }
    } else {
      // 加入错题集（去重）
      const exist = st.wrong.find(w => w.q === q.q && w.category === q.category);
      if (!exist) st.wrong.push(Object.assign({}, q));
    }
    // 记录本题用时（用于退出时汇总各标签平均用时）
    App.quiz.timings.push({ tag, category: q.category, sec: elapsed });
    S.save();
  }

  function finishQuiz(c) {
    const qz = App.quiz;
    if (qz.timerIv) clearInterval(qz.timerIv);
    const acc = qz.total ? Math.round(qz.sessionCorrect / qz.total * 100) : 0;
    const totalSec = qz.timings.reduce((a, t) => a + t.sec, 0);
    const avgSec = qz.timings.length ? totalSec / qz.timings.length : 0;
    // 各标签每题平均用时
    const byTag = {};
    qz.timings.forEach(t => {
      (byTag[t.tag] = byTag[t.tag] || { n: 0, sum: 0 });
      byTag[t.tag].n++; byTag[t.tag].sum += t.sec;
    });
    const tagRows = Object.keys(byTag).map(tag => {
      const avg = byTag[tag].sum / byTag[tag].n;
      return `<div class="tag-time-row"><span>🏷️ ${esc(tag)}</span><span>${byTag[tag].n} 题 · 平均 <b>${avg.toFixed(1)}</b> 秒</span></div>`;
    }).join('') || '<div class="muted small">本次没有完成题目</div>';

    c.innerHTML = `
      <div class="quiz-card glass" style="text-align:center">
        <div class="big" style="font-size:44px">🎉</div>
        <h3>本次练习完成</h3>
        <div class="stat" style="align-items:center;margin:14px 0">
          <div class="num green">${acc}%</div><div class="lbl">正确率（${qz.sessionCorrect}/${qz.total}）</div>
        </div>
        <div class="muted small" style="margin-bottom:10px">总用时 ${fmtSec(totalSec)} · 平均每题 ${avgSec.toFixed(1)} 秒</div>
        <div class="card glass" style="text-align:left;margin:6px 0 4px">
          <div class="ttl">📊 各标签每题平均用时</div>
          ${tagRows}
        </div>
        <p class="muted small">错题已进入「错题集」，记得回头重练。坚持每日刷题收集流星 🌟</p>
        <div class="toolbar" style="justify-content:center;margin-top:14px">
          <button class="btn primary" id="again">再来一组</button>
          <button class="btn" id="back">返回题库</button>
        </div>
      </div>`;
    $('#again').onclick = () => startQuiz(c, qz.category, qz.mode);
    $('#back').onclick = () => setRoute(isWrongMode() ? 'wrong' : (qz.category === '行测' ? 'xingce' : 'shenlun'));
  }

  /* 是否处于错题重练模式（含全量错题与单类错题） */
  function isWrongMode() {
    return App.quiz && (App.quiz.mode === 'wrong' || App.quiz.mode === 'wrong-all');
  }

  /* ============================================================
     错题集
     ============================================================ */
  function renderWrong(c) {
    const st = S.getState();
    const wrong = st.wrong.slice();
    const cats = ['行测', '申论'];
    const byCat = cats.map(cat => ({
      cat,
      items: wrong.filter(w => w.category === cat)
    })).filter(g => g.items.length);

    c.innerHTML = `
      <div class="card glass" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0">📕 错题集</h3>
            <p class="muted small" style="margin:4px 0 0">共 <b>${wrong.length}</b> 道待巩固 · 重练答对一次即自动消除</p>
          </div>
          ${wrong.length ? `<button class="btn rose" id="wrongAll">🔁 全部重练（${wrong.length}）</button>` : ''}
        </div>
      </div>

      ${byCat.map(g => `
        <div class="card glass" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <h3 style="margin:0">${g.cat === '行测' ? '✦' : '✺'} ${g.cat}（${g.items.length}）</h3>
            <button class="btn sm" data-cat="${esc(g.cat)}">🔁 重练本类</button>
          </div>
          <div class="list">
            ${g.items.map((w, i) => `
              <div class="item">
                <div class="ic">${w.type === 'choice' ? '🔤' : '✍️'}</div>
                <div class="meta" style="flex:1;min-width:0">
                  <div class="t" style="white-space:normal">${esc(w.q)}</div>
                  <div class="s small" style="color:var(--text-faint)">${esc(w.bank || '')}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}

      ${!wrong.length ? `<div class="card glass"><div class="empty"><div class="big">🎉</div>太棒了，当前没有错题！去「行测试题 / 申论试题」练一组吧。</div></div>` : ''}
    `;

    if (wrong.length) {
      $('#wrongAll').onclick = () => startQuiz(c, null, 'wrong-all');
      $$('[data-cat]').forEach(b => b.onclick = () => startQuiz(c, b.dataset.cat, 'wrong'));
    }
  }

  /* ============================================================
     分析（学习时长 / 刷题数据可视化）
     ============================================================ */
  function renderAnalytics(c) {
    const st = S.getState();
    const hist = S.getHistory().slice().sort((a, b) => a.date < b.date ? -1 : 1);
    // 近 14 天：固定 14 根柱子，无记录的日子记为 0（空状态）
    const last14 = [];
    const hByDate = {};
    hist.forEach(h => { hByDate[h.date] = h; });
    for (let i = 13; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const ds = S.todayStr(dt);
      const rec = hByDate[ds];
      const val = rec ? (rec.studySeconds || 0) : 0;
      last14.push({ label: ds.slice(5), value: val, empty: val <= 0 });
    }
    // 学习总时长（后台按月归档）：聚合全部月份累计
    const monthly = S.getMonthly();
    const thisMonth = monthly[S.todayStr().slice(0, 7)] || 0;
    const totalMonthStudy = Object.values(monthly).reduce((a, v) => a + v, 0);
    const todayStudy = st.daily.studySeconds || 0;
    const totalStudy = hist.reduce((a, h) => a + (h.studySeconds || 0), 0);
    const studyDays = hist.filter(h => (h.studySeconds || 0) > 0).length;
    const totalQuiz = hist.reduce((a, h) => a + (h.quizCount || 0), 0);
    const totalCorrect = hist.reduce((a, h) => a + (h.quizCorrect || 0), 0);
    const overallAcc = totalQuiz ? Math.round(totalCorrect / totalQuiz * 100) : 0;

    // 各标签：刷题用时 / 正确率 / 掌握度
    const stats = S.getQuizStats();
    const bankTags = {};
    st.banks.forEach(b => {
      const k = b.category + '|' + b.bank;
      (bankTags[k] = bankTags[k] || { total: 0, m: 0 });
      bankTags[k].total++; if (b.mastered) bankTags[k].m++;
    });
    const keys = new Set([...Object.keys(stats), ...Object.keys(bankTags)]);
    const tagData = [];
    keys.forEach(k => {
      const idx = k.indexOf('|');
      const cat = k.slice(0, idx), tag = k.slice(idx + 1);
      const s = stats[k] || { count: 0, totalTime: 0, correct: 0, wrong: 0 };
      const bt = bankTags[k] || { total: 0, m: 0 };
      tagData.push({
        cat, tag,
        avgTime: s.count ? s.totalTime / s.count : 0,
        acc: (s.correct + s.wrong) ? s.correct / (s.correct + s.wrong) * 100 : 0,
        mastery: bt.total ? bt.m / bt.total * 100 : 0,
        hasQuiz: !!s.count
      });
    });
    const lbl = d => `${d.cat}·${d.tag}`;
    const timeRows = tagData.slice().sort((a, b) => b.avgTime - a.avgTime)
      .map(d => ({ label: lbl(d), value: d.avgTime, display: d.avgTime.toFixed(1) + ' 秒', color: 'var(--m-blue-d)' }));
    const accRows = tagData.filter(d => d.hasQuiz).slice().sort((a, b) => b.acc - a.acc)
      .map(d => ({ label: lbl(d), value: d.acc, display: d.acc.toFixed(0) + '%', color: 'var(--m-green-d)' }));
    const masteryRows = tagData.slice().sort((a, b) => b.mastery - a.mastery)
      .map(d => ({ label: lbl(d), value: d.mastery, display: d.mastery.toFixed(0) + '%', color: 'var(--m-purple-d)' }));

    c.innerHTML = `
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="card glass stat"><div class="num blue">${fmtSec(todayStudy)}</div><div class="lbl">今日学习时长</div></div>
        <div class="card glass stat"><div class="num green">${studyDays}<span style="font-size:16px;color:var(--text-soft)"> 天</span></div><div class="lbl">累计学习天数</div></div>
        <div class="card glass stat"><div class="num sand">${totalQuiz}</div><div class="lbl">累计刷题</div></div>
        <div class="card glass stat"><div class="num rose">${overallAcc}%</div><div class="lbl">总正确率</div></div>
      </div>

      <div class="card glass" style="margin-bottom:16px">
        <h3>📅 每日学习时长（近 14 天）</h3>
        ${vBars(last14)}
      </div>

      <div class="card glass" style="margin-bottom:16px;padding:16px 18px">
        <h3>⏳ 学习总时长</h3>
        <div style="font-size:28px;font-weight:700;color:var(--m-green-d);margin:8px 0 4px">${fmtSec(totalMonthStudy)}</div>
        <div class="muted small">本月已累计 ${fmtSec(thisMonth)}（学习时长自动按月归档，数据仅保存在本机）</div>
      </div>

      <div class="grid grid-2">
        <div class="card glass">
          <h3>⏱ 各标签每题平均用时</h3>
          ${hBars(timeRows)}
        </div>
        <div class="card glass">
          <h3>✅ 各标签正确率</h3>
          ${hBars(accRows)}
        </div>
      </div>

      <div class="card glass" style="margin-bottom:16px;margin-top:16px">
        <h3>📈 各标签掌握度</h3>
        ${hBars(masteryRows)}
      </div>

      ${!totalQuiz ? `<div class="card glass"><div class="empty"><div class="big">📊</div>还没有刷题数据，去「行测试题 / 申论试题」练一组，这里就会生成分析图表。</div></div>` : ''}
    `;
  }

  /* ============================================================
     导入资料
     ============================================================ */
  function renderImport(c) {
    c.innerHTML = `
      <div class="grid grid-2">
        <div class="card glass">
          <h3>📝 导入题库（自动归类标签）</h3>
          <div class="dropzone" id="qDrop">
            <div class="dz-ic">⤓</div>
            <div>点击或拖拽上传 <b>.json / .txt</b> 题库文件</div>
            <div class="hint">支持 JSON 数组，或每行一道题的文本格式</div>
          </div>
          <input type="file" id="qFile" accept=".json,.txt" style="display:none" multiple>
          <div class="field" style="margin-top:14px"><label>归类类别</label>
            <div class="row">
              <span class="chip blue on" data-cat="行测">行测</span>
              <span class="chip blue" data-cat="申论">申论</span>
            </div>
          </div>
          <div class="field"><label>选择 / 新建标签（可多选）</label>
            <div class="row" id="tagChips"></div>
            <input class="input" id="newTag" placeholder="输入新标签后回车" style="margin-top:8px">
          </div>
          <button class="btn primary" id="doImport">确认导入</button>
          <button class="btn" id="showFmt" style="margin-left:8px">格式说明</button>
        </div>

        <div class="card glass">
          <h3>📂 导入学习资料</h3>
          <div class="dropzone" id="rDrop">
            <div class="dz-ic">📚</div>
            <div>点击或拖拽上传 Word / PDF / PPT / 图片 / 视频 / 音频</div>
            <div class="hint">自动识别类型，可自定义分类与标签</div>
          </div>
          <input type="file" id="rFile" multiple style="display:none">
          <div class="field" style="margin-top:14px"><label>自定义标签</label>
            <input class="input" id="rTag" placeholder="如：重点笔记 / 真题卷"></div>
          <button class="btn primary" id="doResImport">确认导入资料</button>
          <p class="hint" style="margin-top:10px">资料将以文件形式保存在本地（IndexedDB），可随时打开查看。</p>
        </div>
      </div>
    `;
    bindImport(c);
  }

  function bindImport(c) {
    // 类别选择
    $$('[data-cat]', c).forEach(ch => ch.onclick = () => {
      $$('[data-cat]', c).forEach(x => x.classList.remove('on')); ch.classList.add('on');
    });
    // 标签 chips（从现有题库标签初始化）
    const allTags = [...new Set(S.getState().banks.map(b => b.bank))];
    const selTags = new Set();
    const tagBox = $('#tagChips', c);
    function paintTags() {
      tagBox.innerHTML = allTags.map(t => `<span class="chip ${selTags.has(t) ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</span>`).join('')
        + [...selTags].filter(t => !allTags.includes(t)).map(t => `<span class="chip on" data-t="${esc(t)}">${esc(t)}＋</span>`).join('');
      $$('#tagChips [data-t]', c).forEach(ch => ch.onclick = () => {
        const t = ch.dataset.t;
        if (selTags.has(t)) selTags.delete(t); else selTags.add(t);
        paintTags();
      });
    }
    paintTags();
    $('#newTag', c).addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.value.trim()) { selTags.add(e.target.value.trim()); paintTags(); e.target.value = ''; }
    });

    // 题库文件
    const qDrop = $('#qDrop', c), qFile = $('#qFile', c);
    qDrop.onclick = () => qFile.click();
    qFile.onchange = () => handleQFiles(qFile.files, c, selTags);
    qDrop.ondragover = e => { e.preventDefault(); qDrop.classList.add('drag'); };
    qDrop.ondragleave = () => qDrop.classList.remove('drag');
    qDrop.ondrop = e => { e.preventDefault(); qDrop.classList.remove('drag'); handleQFiles(e.dataTransfer.files, c, selTags); };

    $('#doImport', c).onclick = () => {
      if (!qFile.files.length) return toast('请先选择题库文件', 'warn');
      handleQFiles(qFile.files, c, selTags, true);
    };
    $('#showFmt', c).onclick = () => openGeneric('题库格式说明', `
      <p class="small"><b>JSON 格式</b>（推荐）：</p>
      <pre class="hint" style="white-space:pre-wrap;background:var(--glass-soft);padding:10px;border-radius:10px">[
  { "type":"choice", "q":"题目?", "options":["A","B","C","D"], "answer":0, "explain":"解析", "tag":"常识判断" },
  { "type":"short", "q":"简答题自测?", "answer":"会", "explain":"要点" }
]</pre>
      <p class="small" style="margin-top:8px"><b>TXT 格式</b>：</p>
      <pre class="hint" style="white-space:pre-wrap;background:var(--glass-soft);padding:10px;border-radius:10px">题目文本
A. 选项一
B. 选项二
答案: A
解析: 说明文字</pre>
      <p class="small muted">选择题 answer 为正确项下标（0 起）；简答题 answer 填“会”。导入时可批量指定类别与标签，自动归类到对应题库。</p>`);

    // 资料文件
    const rDrop = $('#rDrop', c), rFile = $('#rFile', c);
    rDrop.onclick = () => rFile.click();
    rFile.onchange = () => handleResourceFiles(rFile.files, c);
    rDrop.ondragover = e => { e.preventDefault(); rDrop.classList.add('drag'); };
    rDrop.ondragleave = () => rDrop.classList.remove('drag');
    rDrop.ondrop = e => { e.preventDefault(); rDrop.classList.remove('drag'); handleResourceFiles(e.dataTransfer.files, c); };
    $('#doResImport', c).onclick = () => {
      if (!rFile.files.length) return toast('请先选择资料文件', 'warn');
      handleResourceFiles(rFile.files, c);
    };
  }

  function detectType(name) {
    const e = name.split('.').pop().toLowerCase();
    if (['doc', 'docx'].includes(e)) return 'word';
    if (e === 'pdf') return 'pdf';
    if (['ppt', 'pptx'].includes(e)) return 'ppt';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(e)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi'].includes(e)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(e)) return 'audio';
    return 'other';
  }

  async function handleResourceFiles(files, c) {
    const tag = ($('#rTag', c).value || '').trim();
    let n = 0;
    for (const f of files) {
      const id = 'res_' + Date.now() + Math.random().toString(36).slice(2, 7);
      await S.putFile(id, f);
      S.getState().resources.push({
        id, name: f.name, type: detectType(f.name),
        category: detectType(f.name), tags: tag ? [tag] : [], date: S.todayStr(), size: f.size
      });
      n++;
    }
    S.save();
    toast(`已导入 ${n} 个资料`, 'ok');
    setRoute('resources');
  }

  async function handleQFiles(files, c, selTags, fromBtn) {
    const category = ($('[data-cat].on', c) || {}).dataset?.cat || '行测';
    const tags = [...selTags];
    if (!files.length) return;
    let added = 0;
    for (const f of files) {
      const text = await f.text();
      let parsed = [];
      if (f.name.endsWith('.json')) {
        try { parsed = JSON.parse(text); if (!Array.isArray(parsed)) parsed = [parsed]; }
        catch (e) { toast('JSON 解析失败：' + f.name, 'warn'); continue; }
      } else {
        parsed = parseTxt(text);
      }
      parsed.forEach(item => {
        const t = item.tag || (tags[0] || '未分类');
        const cat = item.category || category;
        const tagList = item.tag ? [item.tag, ...tags] : tags;
        // 去重标签
        const uniq = [...new Set(tagList)];
        uniq.forEach(tg => {
          S.getState().banks.push({
            id: 'imp_' + Date.now() + Math.random().toString(36).slice(2, 7),
            category: cat, bank: tg, type: item.type || 'choice',
            q: item.q, options: item.options || null, answer: item.answer,
            explain: item.explain || '', mastered: 0
          });
          added++;
        });
      });
    }
    S.save();
    toast(`成功导入 ${added} 道题到 ${tags.join('/') || '题库'}`, 'ok');
    setRoute(category === '行测' ? 'xingce' : 'shenlun');
  }

  function parseTxt(text) {
    // 按空行分块；支持 A. B. C. D. 与 答案 / 解析
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const out = [];
    blocks.forEach(b => {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const q = lines[0];
      const opts = [];
      let answer = null, explain = '';
      lines.slice(1).forEach(l => {
        const m = l.match(/^([A-Da-d])[.、]\s*(.*)$/);
        if (m) { opts.push(m[2]); return; }
        if (/^答案/i.test(l)) { const a = l.split(/[:：]/)[1]?.trim(); if (a) answer = 'ABCD'.indexOf(a.toUpperCase()); return; }
        if (/^解析/i.test(l)) { explain = l.split(/[:：]/)[1]?.trim() || ''; return; }
      });
      if (opts.length >= 2 && answer != null) out.push({ type: 'choice', q, options: opts, answer, explain });
      else out.push({ type: 'short', q, answer: '会', explain: explain || '（简答题自测）' });
    });
    return out;
  }

  /* ============================================================
     提醒功能（本地通知 + 弹窗）
     ============================================================ */
  function scheduleReminders() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
    const st = S.getState();
    if (!st.remind.enabled) return;
    const now = new Date();
    st.todos.forEach(t => {
      if (t.done || !t.time) return;
      const [h, m] = t.time.split(':').map(Number);
      const target = new Date(); target.setHours(h, m, 0, 0);
      let ms = target - now;
      if (ms < 0) ms += 86400000; // 已过则顺延明天提示
      setTimeout(() => fireReminder(t), ms);
    });
    // 休息提醒（每 50 分钟）
    setInterval(() => {
      if (document.hidden) return;
      P.sayFloat('rest');
      if (Notification.permission === 'granted') new Notification('星轨 · 休息一下', { body: '学了一阵啦，起来拉伸喝水吧 💧' });
    }, 50 * 60 * 1000);
  }
  function fireReminder(todo) {
    P.sayFloat('remind');
    const msg = `计划提醒：「${todo.name}」该开始啦（${todo.time}）`;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('星轨 · 学习计划', { body: msg });
    }
    toast(msg);
  }

  /* 工具：数组乱序 */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* 宠物改名 */
  function renamePet() {
    const cur = S.getState().pet.name;
    openGeneric('🐾 给星星起名', `
      <div class="field"><input class="input" id="petNewName" value="${esc(cur)}" maxlength="12"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="pnCancel">取消</button>
        <button class="btn primary" id="pnSave">保存</button>
      </div>`, (b) => {
      b.querySelector('#pnCancel').onclick = () => $('#genericModal').classList.remove('show');
      b.querySelector('#pnSave').onclick = () => {
        const n = b.querySelector('#petNewName').value.trim() || '小星';
        S.getState().pet.name = n; S.save();
        $('#genericModal').classList.remove('show'); renderPet();
        toast('已改名为「' + n + '」', 'ok');
      };
    });
  }

  /* ============ 重置工作台 ============ */
  function factoryReset() {
    openGeneric('↺ 重置工作台', `
      <div class="warn-box">
        <b>⚠️ 此操作不可恢复！</b>
        <p>将清空所有：学习计划、今日待办、题库与错题集、资料库文件、倒计时、养成宠物进度与每日任务，并恢复到初始状态。</p>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="rsCancel">取消</button>
        <button class="btn danger" id="rsConfirm">确认重置</button>
      </div>`, (b) => {
      b.querySelector('#rsCancel').onclick = () => $('#genericModal').classList.remove('show');
      b.querySelector('#rsConfirm').onclick = async () => {
        b.querySelector('#rsConfirm').disabled = true;
        b.querySelector('#rsConfirm').textContent = '重置中…';
        await S.reset();
        toast('已重置，正在重新载入…', 'ok');
        setTimeout(() => location.reload(), 400);
      };
    });
  }

  /* ============ 启动 ============ */
  window.addEventListener('DOMContentLoaded', () => {
    init();
    updateMiniPet();
    updateMiniCountdown();
  });
})();
