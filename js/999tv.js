// 999tv.js — XPTV JS 扩展：999TV 连续剧（type=21）
// 站点参考：分类页 https://999tv.app/index.php/vod/type/id/21.html
// 详情页/选集：/index.php/vod/detail/id/{id}.html
// 播放页：/index.php/vod/play/id/{id}/sid/{sid}/nid/{nid}.html
// 注：实现遵循 XPTV TL;DR 约定：返回统一用 jsonify(...)

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
         + '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://999tv.app';

const appConfig = {
  ver: 20250825,
  title: '999TV·连续剧',
  site: BASE,
  tabs: [
    // 固定到“连续剧”（id=21）。如需更多分类，可再加 tabs 并传不同 id。
    { name: '连续剧', ext: { catId: 21, page: 1 } }
  ],
};

function abs(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  return BASE + '/' + url.replace(/^\.\//, '');
}

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { catId = 21, page = 1 } = ext;

  const url = `${BASE}/index.php/vod/type/id/${catId}${page > 1 ? `/page/${page}` : ''}.html`;
  const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Referer': BASE } });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const list = [];

  // 列表块：页面“新片/最近更新/排行榜”等区域都包含若干 a 卡片（标题里带集数/豆瓣分）
  // 采用通用选择器抓取主内容里的卡片链接 + 封面 + 副标题（如“第xx集完结 豆瓣:xx分”）
  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    if (!/\/index\.php\/vod\/detail\/id\/\d+\.html$/.test(href)) return;

    const vod_name = $a.text().trim().replace(/\s+/g, ' ');
    // 封面通常在同区域的 img 上，向上找一下
    let pic = $a.find('img').attr('src')
            || $a.closest('li,div,section,article').find('img').first().attr('src')
            || '';
    pic = abs(pic);

    // 副标题：抽取“第xx集/完结/豆瓣:x.x分”等字样
    const txt = vod_name;
    const remarks = (txt.match(/(第[\d\-]+集.*|完结|豆瓣:\s*\d+(\.\d+)?分)/g) || []).join(' ').trim();

    // 详情 id
    const idm = href.match(/\/id\/(\d+)\.html$/);
    const vid = idm ? idm[1] : href;

    list.push({
      vod_id: vid,
      vod_name: vod_name.replace(/^(第.*?分)\s*/,'') || '未命名',
      vod_pic: pic || '',
      vod_remarks: remarks || '',
      ext: { id: vid } // 传给 getTracks
    });
  });

  // 去重（按 id）
  const seen = new Set();
  const uniq = list.filter(it => {
    if (seen.has(it.vod_id)) return false;
    seen.add(it.vod_id);
    return true;
  });

  return jsonify({ list: uniq });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { id } = ext;
  if (!id) return jsonify({ list: [] });

  const url = `${BASE}/index.php/vod/detail/id/${id}.html`;
  const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Referer': BASE } });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const groups = [];

  // “选择播放源”分组标题示例：页面上类似 “999TV 32”
  // 选集区域链接形如 /index.php/vod/play/id/{id}/sid/{sid}/nid/{nid}.html
  // 我们将每个“源”当成一组 group，内部 tracks 为各“集”
  // 先找到“选集播放”区域附近，再按 DOM 分块容错抽取
  const section = $('body:contains("选集播放")').first();
  const container = section.length ? section.closest('body') : $('body');

  // 简化策略：按每个“源块”分组 —— 查找包含大量集数链接的父容器
  const sourceBlocks = [];
  container.find('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/index\.php\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html$/.test(href)) {
      const block = $(a).closest('ul,ol,div,section').first();
      if (block.length && !sourceBlocks.includes(block)) sourceBlocks.push(block);
    }
  });

  if (sourceBlocks.length === 0) {
    // 兜底：全页面搜集
    sourceBlocks.push(container);
  }

  sourceBlocks.forEach((blk, gi) => {
    const $blk = cheerio.load(blk.html() || '');
    // 源名称：尝试从“选择播放源”附近的文字、或上层标题里提取
    let gtitle = $(blk).prevAll(':header').first().text().trim()
               || $(blk).prev().text().trim()
               || `播放源${gi + 1}`;

    const tracks = [];
    $blk('a').each((_, a) => {
      const $a = $blk(a);
      const href = $a.attr('href') || '';
      if (!/\/index\.php\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html$/.test(href)) return;

      const m = href.match(/\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html$/);
      if (!m) return;
      const [, vid, sid, nid] = m;
      const name = ($a.text() || '').trim().replace(/\s+/g, ' ') || `P${nid}`;

      tracks.push({
        name,
        pan: '',
        ext: { id: vid, sid: Number(sid), nid: Number(nid) } // 传给 getPlayinfo
      });
    });

    if (tracks.length) {
      gtitle = gtitle || `播放源（${tracks.length}）`;
      if (!/（\d+）$/.test(gtitle)) gtitle += `（${tracks.length}）`;
      groups.push({ title: gtitle, tracks });
    }
  });

  return jsonify({ list: groups });
}

// 从播放页抽取直链：策略阶梯
// 1) 直接搜 .m3u8 字样（含 query），命中即用；
// 2) 搜索 window/player 变量 JSON（常见苹果CMS/Artplayer写法），取 url；
// 3) 再不行就返回播放页 URL（极端兜底，仍带上 headers，部分内置播放器可二次解析）。
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { id, sid = 1, nid = 1 } = ext;
  if (!id) return jsonify({ urls: [], headers: [{ 'User-Agent': UA, 'Referer': BASE }] });

  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const { data, status } = await $fetch.get(playUrl, { headers: { 'User-Agent': UA, 'Referer': BASE } });
  if (status !== 200) return jsonify({ urls: [], headers: [{ 'User-Agent': UA, 'Referer': BASE }] });

  // Step 1: 直接正则搜 m3u8
  const m3u8 = (data.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/i) || [])[0];
  if (m3u8) {
    return jsonify({
      urls: [m3u8],
      headers: [{ 'User-Agent': UA, 'Referer': BASE }]
    });
  }

  // Step 2: 抓 player JSON（常见写法：var player_xxx = {...} 或 player = {...}）
  const pj = (data.match(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});?<\/script>/)
           || data.match(/player\s*=\s*(\{[\s\S]*?\});?<\/script>/));
  if (pj && pj[1]) {
    try {
      // 将单引号 JSON 粗暴转双引号并清理末尾逗号，尽量容错
      let jsonText = pj[1]
        .replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const playerObj = JSON.parse(jsonText);
      const url = playerObj.url || playerObj.link || '';
      if (/^https?:\/\//i.test(url)) {
        return jsonify({
          urls: [url],
          headers: [{ 'User-Agent': UA, 'Referer': BASE }]
        });
      }
    } catch (e) {
      $print('player json parse error: ' + e);
    }
  }

  // Step 3: 兜底：返回播放页（交给内置解析器/嗅探）
  return jsonify({
    urls: [playUrl],
    headers: [{ 'User-Agent': UA, 'Referer': BASE }]
  });
}

// 站内搜索（关键词 → 卡片列表）
async function search(ext) {
  ext = argsify(ext);
  let { wd = '', page = 1 } = ext;
  wd = (wd || '').trim();
  if (!wd) return jsonify({ list: [] });

  // 站内搜索存在多种路由，这里用 /index.php/vod/search.html + POST wd
  const url = `${BASE}/index.php/vod/search.html${page > 1 ? `?page=${page}` : ''}`;
  const headers = { 'User-Agent': UA, 'Referer': BASE, 'Content-Type': 'application/x-www-form-urlencoded' };
  const body = `wd=${encodeURIComponent(wd)}&submit=search`;

  const { data, status } = await $fetch.post(url, body, { headers });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const list = [];

  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    if (!/\/index\.php\/vod\/detail\/id\/\d+\.html$/.test(href)) return;

    const name = ($a.attr('title') || $a.text() || '').trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src')
            || $a.closest('li,div,section,article').find('img').first().attr('src')
            || '';
    pic = abs(pic);

    const idm = href.match(/\/id\/(\d+)\.html$/);
    const vid = idm ? idm[1] : href;
    const remarks = ($a.text().match(/(第[\d\-]+集.*|完结|豆瓣:\s*\d+(\.\d+)?分)/g) || []).join(' ').trim();

    list.push({
      vod_id: vid,
      vod_name: name || '未命名',
      vod_pic: pic || '',
      vod_remarks: remarks || '',
      ext: { id: vid }
    });
  });

  // 去重
  const seen = new Set();
  const uniq = list.filter(it => {
    if (seen.has(it.vod_id)) return false;
    seen.add(it.vod_id);
    return true;
  });

  return jsonify({ list: uniq });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };