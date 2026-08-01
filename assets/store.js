/* =====================================================
   星轨 · 考公工作台  —  数据层 (store.js)
   负责：localStorage 状态、IndexedDB 文件存储、种子数据、工具函数
   ===================================================== */
(function (global) {
  'use strict';

  const LS_KEY = 'xinggui_state_v1';

  /* ---------- 养成阶段定义 ----------
     9 个阶段；从小行星起每阶段所需流星递增 600。
     前三阶为初始形态，给予较低起步阈值，主进阶严格遵循 100/700/1300…
  */
  const PET_STAGES = [
    { name: '星尘',   need: 0 },
    { name: '流星',   need: 25 },
    { name: '慧星',   need: 60 },
    { name: '小行星', need: 100 },
    { name: '行星',   need: 700 },
    { name: '恒星',   need: 1300 },
    { name: '启明星', need: 1900 },
    { name: '中子星', need: 2500 },
    { name: '超新星', need: 3100 }
  ];

  /* ---------- 每日任务定义 ---------- */
  const DAILY_TASKS = [
    { id: 'login',   title: '登录工作台',     desc: '每日首次进入即可领取', reward: 22, icon: '👋' },
    { id: 'study45', title: '学习 45 分钟',   desc: '累计专注学习满 45 分钟', reward: 23, icon: '⏳' },
    { id: 'quiz20',  title: '刷题 20 题',     desc: '当日题库练习累计 20 题', reward: 22, icon: '📝' }
  ];

  /* ---------- 默认状态 ---------- */
  function defaultState() {
    return {
      pet: { name: '小星', stageIndex: 0, meteor: 0 },
      lastActiveDate: null,        // 上次使用日期（用于 >2 天未使用提醒）
      daily: { date: null, done: {}, claimed: {}, studySeconds: 0, quizCount: 0 },
      plans: [],                   // 学习计划
      todos: [],                   // 生成的今日待办
      banks: [],                   // 题库（按标签）
      wrong: [],                   // 错题集（存 question 副本 + 来源）
      resources: [],               // 资料库元数据
      countdown: { name: '福建省考', target: null, prep: 0 }, // 倒计时
      remind: { enabled: true, advanceMin: 10 }               // 提醒设置
    };
  }

  /* ---------- 读写 ---------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return Object.assign(defaultState(), s);
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('保存失败', e); }
  }

  function getState() { return state; }
  function setState(patch) { Object.assign(state, patch); save(); }

  /* ---------- 日期工具 ---------- */
  function todayStr(d) {
    d = d || new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function dayDiff(a, b) { // b - a 天数
    const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  /* =====================================================
     IndexedDB 文件存储（资料库大文件持久化）
     ===================================================== */
  const DB_NAME = 'xinggui_files', DB_VER = 1, STORE = 'blobs';
  let _db = null;
  function openDB() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }
  async function putFile(id, blob) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  async function getFile(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function delFile(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }

  /* =====================================================
     种子数据：近 5 年福建省考行测 / 申论 样题
     （说明：离线环境无法实时联网抓取，此处内置代表性样题；
       用户可通过「导入资料 / 联网搜索」补充真题）
     ===================================================== */
  function seedBanks() {
    const xingce = [
      {
        type: 'choice', category: '行测', tag: '常识判断',
        q: '下列关于福建省的表述，正确的是：',
        options: ['福建省简称“闽”，省会为厦门', '福建省简称“闽”，省会为福州', '福建省简称“赣”，省会为南昌', '福建省简称“粤”，省会为广州'],
        answer: 1,
        explain: '福建省简称“闽”，省会是福州市；厦门为经济特区、副省级城市。'
      },
      {
        type: 'choice', category: '行测', tag: '常识判断',
        q: '下列关于福建地理的说法，正确的是：',
        options: ['武夷山位于福建与江西交界处，是“双世遗”', '闽江是福建第二大河流', '福建海岸线长度居全国第二', '戴云山脉是福建最高峰'],
        answer: 0,
        explain: '武夷山地处闽赣交界，为世界文化与自然双重遗产；闽江是福建最大河流，海岸线长度居全国首位。'
      },
      {
        type: 'choice', category: '行测', tag: '常识判断',
        q: '2024 年是中华人民共和国成立多少周年？',
        options: ['73 周年', '74 周年', '75 周年', '76 周年'],
        answer: 2,
        explain: '1949 年建国，2024 - 1949 = 75 周年。'
      },
      {
        type: 'choice', category: '行测', tag: '言语理解',
        q: '填入横线处最恰当的一项是：面对复杂多变的舆论场，主流媒体应当______，守住价值底线，传递理性声音。',
        options: ['随波逐流', '激浊扬清', '推波助澜', '明哲保身'],
        answer: 1,
        explain: '“激浊扬清”比喻清除坏的、发扬好的，符合主流媒体正本清源的职责语境。'
      },
      {
        type: 'choice', category: '行测', tag: '言语理解',
        q: '下列句子中，成语使用恰当的是：',
        options: ['这件小事不足为训，不必大惊小怪', '他的演讲抛砖引玉，赢得了满堂喝彩', '同学们莘莘学子，朝气蓬勃', '节日的大街万人空巷，十分冷清'],
        answer: 0,
        explain: '“不足为训”意为不值得作为效法的准则，使用恰当；B“抛砖引玉”是谦辞不能用于他人；C“莘莘”已是复数，不与“们”重复；D“万人空巷”指人都出门、街巷空了，形容热闹，非冷清。'
      },
      {
        type: 'choice', category: '行测', tag: '判断推理',
        q: '类比推理：苹果∶水果 相当于 （ ）∶（ ）',
        options: ['萝卜∶蔬菜', '钢笔∶文具店', '树木∶森林', '汽车∶公路'],
        answer: 0,
        explain: '种属关系：苹果是水果的一种，萝卜是蔬菜的一种。'
      },
      {
        type: 'choice', category: '行测', tag: '判断推理',
        q: '下列选项与“不入虎穴，焉得虎子”蕴含哲理相同的是：',
        options: ['千里之行，始于足下', '实践出真知', '唇亡齿寒', '刻舟求剑'],
        answer: 1,
        explain: '二者都强调实践（直接经验）是认识的来源，体现实践是认识的基础。'
      },
      {
        type: 'choice', category: '行测', tag: '数量关系',
        q: '某单位招录，笔试、面试按 6:4 计入总成绩。甲笔试 80 分、面试 90 分，则其总成绩为：',
        options: ['84 分', '85 分', '86 分', '83 分'],
        answer: 0,
        explain: '80×0.6 + 90×0.4 = 48 + 36 = 84 分。'
      },
      {
        type: 'choice', category: '行测', tag: '数量关系',
        q: '一项工程，甲单独做需 10 天，乙单独做需 15 天，两人合作需几天完成？',
        options: ['5 天', '6 天', '7 天', '8 天'],
        answer: 1,
        explain: '合作效率 = 1/10 + 1/15 = 1/6，故需 6 天。'
      },
      {
        type: 'choice', category: '行测', tag: '资料分析',
        q: '某省 2023 年 GDP 为 5000 亿元，同比增长 8%，则增量约为：',
        options: ['370 亿元', '400 亿元', '440 亿元', '500 亿元'],
        answer: 0,
        explain: '增量 = 5000 - 5000/1.08 ≈ 5000 - 4629.6 = 370.4 亿元。'
      },
      {
        type: 'choice', category: '行测', tag: '资料分析',
        q: '若某商品原价 200 元，先提价 10% 再降价 10%，最终价格约为：',
        options: ['198 元', '200 元', '202 元', '190 元'],
        answer: 0,
        explain: '200×1.1 = 220，220×0.9 = 198 元。'
      },
      {
        // 简答题：无选项 -> 自动生成 会 / 不会
        type: 'short', category: '行测', tag: '常识速记',
        q: '你是否掌握“党的二十大报告提出的‘三个务必’”的具体内容？',
        answer: '会',
        explain: '三个务必：务必不忘初心、牢记使命；务必谦虚谨慎、艰苦奋斗；务必敢于斗争、善于斗争。'
      },
      {
        type: 'short', category: '行测', tag: '常识速记',
        q: '你是否掌握“社会主义核心价值观”的 24 字基本内容？（国家、社会、公民三个层面）',
        answer: '会',
        explain: '富强、民主、文明、和谐（国家）；自由、平等、公正、法治（社会）；爱国、敬业、诚信、友善（公民）。'
      }
    ];
    const shenlun = [
      {
        type: 'short', category: '申论', tag: '归纳概括',
        q: '给定资料反映了基层治理中的“最后一公里”难题，请概括其主要表现。（简答自测：你是否已掌握作答框架？）',
        answer: '会',
        explain: '作答框架：1.政策落地难；2.服务供给不均衡；3.群众参与度低；4.信息不对称。建议采用“总—分”结构，分条列点。'
      },
      {
        type: 'short', category: '申论', tag: '对策建议',
        q: '针对“老旧小区改造推进缓慢”问题，你能否提出 3 条以上可行对策？（简答自测）',
        answer: '会',
        explain: '对策方向：1.建立“居民议事会”协商机制；2.引入社会资本多元筹资；3.推行“菜单式”改造清单；4.强化全周期监督。'
      },
      {
        type: 'short', category: '申论', tag: '综合分析',
        q: '“枫桥经验”的核心内涵是什么？请简述其新时代意义。（简答自测）',
        answer: '会',
        explain: '核心：依靠群众、就地化解矛盾，做到“小事不出村、大事不出镇、矛盾不上交”。新时代意义在于源头治理、共建共治共享。'
      },
      {
        type: 'choice', category: '申论', tag: '公文写作',
        q: '下列公文文种中，适用于“向国内外宣布重要事项或法定事项”的是：',
        options: ['通知', '通报', '公告', '报告'],
        answer: 2,
        explain: '《党政机关公文处理工作条例》规定，“公告”适用于向国内外宣布重要事项或者法定事项。'
      },
      {
        type: 'choice', category: '申论', tag: '公文写作',
        q: '向上级机关汇报工作、反映情况、答复上级询问，应使用的文种是：',
        options: ['请示', '报告', '函', '批复'],
        answer: 1,
        explain: '“报告”适用于向上级机关汇报工作、反映情况、答复上级机关的询问；“请示”用于请求指示批准。'
      }
    ];
    /* ---- 从《四海·2025上半年资料分析理论》PDF 提取并人工核算的真题（表格式、可计算） ---- */
    const ziliao = [
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2021年下半年，我国固定互联网宽带接入用户中，光纤用户数增量超过500万户的月份有几个？',
        options: ['2个', '3个', '4个', '5个'], answer: 0,
        explain: '光纤用户数：7月48416、8月48921(+505)、9月49643(+722)、10月50077(+434)、11月50466(+389)、12月50551(+85)。仅8月、9月增量超500万户，共2个。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2012～2020年间，全国城市生活垃圾无害化处理量同比增长超过1200万吨的年份有几个？',
        options: ['4个', '5个', '6个', '7个'], answer: 2,
        explain: '无害化处理量同比增量：2012年+1400、2015年+1619、2016年+1661、2017年+1360、2018年+1531、2019年+1448（万吨），均超1200；其余年份低于1200。共6个年份。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2021年全国城市供水管道长度105.99万公里，同比增长5.26%。2021年比2020年增长约：',
        options: ['5万公里', '5.3万公里', '5.6万公里', '6万公里'], answer: 1,
        explain: '增量 = 105.99 - 105.99/1.0526 ≈ 105.99×0.04997 ≈ 5.30万公里。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2021年全国城市供水总量673.34亿立方米，同比增长6.96%。2020年供水总量约为：',
        options: ['600亿立方米', '620亿立方米', '630亿立方米', '724亿立方米'], answer: 2,
        explain: '基期 = 673.34/1.0696 ≈ 629.5亿立方米，最接近630亿立方米。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2022年1～7月全社会用电量累计49303亿千瓦时，同比+3.4%；7月份8324亿千瓦时，同比+6.3%。2021年1～6月累计约多少亿千瓦时？',
        options: ['38258', '39851', '40472', '41279'], answer: 1,
        explain: '2021年1～7月 = 49303/1.034 ≈ 47682；2021年7月 = 8324/1.063 ≈ 7831；1～6月 ≈ 47682-7831 = 39851。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2009年4月乘用车总销量83.1万辆（轿车71%、MPV2%、SUV6%、交叉型21%）。轿车环比+8.3%、MPV环比-3.54%、SUV环比+19.27%、交叉型环比+3.62%。关于2009年3月各车型占总销量比重，正确的是：',
        options: ['MPV超过2%', '交叉型乘用车低于21%', 'SUV超过6%', '轿车超过71%'], answer: 0,
        explain: '3月各车型销量=4月/(1+环比)。3月总销量≈77.24万辆；MPV3月≈1.72万，占比≈2.23%>2%；交叉型≈21.8%>21%；SUV≈5.4%<6%；轿车≈70.6%<71%。仅A正确。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2014年某地区生态移民人均可支配收入5084元，其中县内移民4933元、县外移民5253元。县内与县外移民人数之比最接近：',
        options: ['8:5', '10:9', '5:8', '9:10'], answer: 1,
        explain: '十字交叉：人数比 县内:县外 = (5253-5084):(5084-4933) = 169:151 ≈ 1.12，最接近10:9。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '根据2015～2021年人口数据，2019～2021年我国人口男女性别比（男/女）按降序排列正确的是：',
        options: ['2019>2020>2021', '2021>2020>2019', '2020>2019>2021', '2020>2021>2019'], answer: 3,
        explain: '性别比：2019=72039/68969≈1.0445；2020=72357/68855≈1.0508；2021=72311/68949≈1.0488。降序：2020>2021>2019。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '按2016～2021年产量，将①甘肃、②广东、③上海、④浙江的集成电路产量年均增速从高到低排列：',
        options: ['④①②③', '④①③②', '①④②③', '①④③②'], answer: 3,
        explain: '年均增速高低由2021/2016决定：甘肃643/197≈3.26、浙江230/74≈3.11、广东539/219≈2.46、上海365/238≈1.53。降序：甘肃>浙江>广东>上海，即①④③②。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2018年木地板出口额3.85亿美元(+9%)、胶合板55.56亿美元(+9%)、纤维板38.35亿美元(+6.2%)。三种产品出口金额增长值从大到小排序：',
        options: ['木地板、胶合板、纤维板', '胶合板、纤维板、木地板', '木地板、纤维板、胶合板', '胶合板、木地板、纤维板'], answer: 1,
        explain: '增量≈现期×r/(1+r)：胶合板≈4.59、纤维板≈2.24、木地板≈0.32（亿美元）。排序：胶合板>纤维板>木地板。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2020年前三季度G省智能机器人：工业机器人76.88亿(+57.4%)、特殊作业2.77亿(+163%)、无人机201.07亿(+31.7%)、服务消费26.18亿(-22.8%)。四大行业总产值同比增量排序：',
        options: ['①>③>②>④', '④>②>①>③', '③>④>②>①', '③>①>②>④'], answer: 3,
        explain: '增量：无人机≈48.4、工业≈28.0、特殊≈1.7、服务消费为负。排序：③>①>②>④。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2018年货物运输量：铁路40.3亿吨(+9.2%)、公路395.9亿吨(+7.4%)、水运69.9亿吨(+4.7%)、民航738.5万吨(+4.6%)。同比增量从高到低排序：',
        options: ['民航、公路、水运、铁路', '公路、铁路、水运、民航', '公路、水运、铁路、民航', '民航、公路、铁路、水运'], answer: 3,
        explain: '增量≈现期×r/(1+r)：民航≈32.5、公路≈27.3、铁路≈3.40、水运≈3.14。排序：民航>公路>铁路>水运。' },
      { type: 'choice', category: '行测', tag: '资料分析',
        q: '2021年纺织品服装出口：美国563.5亿(+4.0%)、东盟491.2亿(+24.9%)、欧盟469.9亿(-11.1%)、日本200.3亿(-7.2%)。按同比增量从高到低排列：',
        options: ['①②③④', '①②④③', '②①③④', '②①④③'], answer: 3,
        explain: '增量：东盟≈97.9、美国≈21.7为正；欧盟≈-58.7、日本≈-15.5为负。排序：东盟>美国>日本>欧盟，即②①④③。' }
    ];
    /* ---- 速算技巧练习：取自该理论 PDF 第一章「实用速算技巧」例题（小分互换/拆分/尾数法/整数基准值法） ---- */
    const susu = [
      { type: 'choice', category: '行测', tag: '速算技巧', q: '784×25% = ?', options: ['196', '186', '206', '176'], answer: 0, explain: '25%=1/4，784÷4=196。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '632×12.5% = ?', options: ['79', '69', '89', '59'], answer: 0, explain: '12.5%=1/8，632÷8=79。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '20%×455 = ?', options: ['91', '81', '101', '71'], answer: 0, explain: '20%=1/5，455÷5=91。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '50%×472 = ?', options: ['236', '226', '246', '216'], answer: 0, explain: '50%=1/2，472÷2=236。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '981×33.3% ≈ ?', options: ['327', '317', '337', '307'], answer: 0, explain: '33.3%≈1/3，981÷3=327。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '727×16.7% ≈ ?', options: ['121', '111', '131', '101'], answer: 0, explain: '16.7%≈1/6，727÷6≈121.2。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '382×55% = ?', options: ['210.1', '200.1', '220.1', '190.1'], answer: 0, explain: '55%=0.55，382×0.55=210.1。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '936×45% = ?', options: ['421.2', '411.2', '431.2', '401.2'], answer: 0, explain: '45%=0.45，936×0.45=421.2。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '1228×95% = ?', options: ['1166.6', '1156.6', '1176.6', '1146.6'], answer: 0, explain: '95%=0.95，1228×0.95=1166.6。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '592×97% = ?', options: ['574.24', '564.24', '584.24', '554.24'], answer: 0, explain: '97%=0.97，592×0.97=574.24。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '632 - 589 = ?（整数基准值法）', options: ['43', '33', '53', '63'], answer: 0, explain: '632-589=(632-600)+(600-589)=32+11=43。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '512 - 481 = ?（整数基准值法）', options: ['31', '41', '21', '51'], answer: 0, explain: '512-481=(512-500)+(500-481)=12+19=31。' },
      { type: 'choice', category: '行测', tag: '速算技巧', q: '822 - 484 = ?（整数基准值法）', options: ['338', '328', '348', '318'], answer: 0, explain: '822-484=(822-500)+(500-484)=322+16=338。' }
    ];
    const banks = [];
    function mk(category, arr) {
      arr.forEach((it, i) => banks.push(Object.assign({
        id: `seed_${category}_${i}`, bank: it.tag, category, mastered: 0
      }, it)));
    }
    function mkPdf(arr, prefix) {
      arr.forEach((it, i) => banks.push(Object.assign({
        id: `${prefix}_${i}`, bank: it.tag, category: it.category, mastered: 0
      }, it)));
    }
    mk('行测', xingce);
    mk('申论', shenlun);
    mkPdf(ziliao, 'pdf_zl');
    mkPdf(susu, 'pdf_ss');
    return banks;
  }

  /* ---------- 初始化（首次 / 题库增量合并） ---------- */
  function ensureSeed() {
    const seeds = seedBanks();
    if (!state.banks || state.banks.length === 0) {
      state.banks = seeds;
      save();
    } else {
      // 已存在题库：把缺失的种子题补进题库（按 id 判定），不影响用户原有进度
      const have = new Set(state.banks.map(b => b.id));
      let added = false;
      seeds.forEach(s => { if (!have.has(s.id)) { state.banks.push(s); added = true; } });
      if (added) save();
    }
  }

  /* ---------- 重置（清空所有数据并恢复出厂） ---------- */
  function reset() {
    // 清空 localStorage 状态
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    state = defaultState();
    ensureSeed();           // 恢复默认 + 种子题库
    // 清空 IndexedDB 资料库文件
    if (_db) { try { _db.close(); } catch (e) {} _db = null; }
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }

  /* ---------- 公开 API ---------- */
  global.Store = {
    LS_KEY, PET_STAGES, DAILY_TASKS,
    getState, setState, save, load,
    todayStr, dayDiff,
    putFile, getFile, delFile,
    ensureSeed, reset,
    // 便捷访问
    get plans() { return state.plans; },
    get todos() { return state.todos; },
    get banks() { return state.banks; },
    get wrong() { return state.wrong; },
    get resources() { return state.resources; }
  };
})(window);
