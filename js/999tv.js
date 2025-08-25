<<<<<<< HEAD
// 999tv.js — XPTV JS 扩展：999TV 连续剧（type=21） with verbose logging
// 站点：分类页 https://999tv.app/index.php/vod/type/id/21.html
// 详情：/index.php/vod/detail/id/{id}.html
// 播放：/index.php/vod/play/id/{id}/sid/{sid}/nid/{nid}.html
//
// 约定：所有入口 return jsonify(...)
// 日志：浏览器打开 http://设备IP:8110/log 查看 $print 输出

const cheerio = createCheerio();
const CryptoJS = createCryptoJS(); // 目前未用到，预留

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://999tv.app';

const appConfig = {
  ver: 20250825,
  title: '999TV·连续剧',
  site: BASE,
  tabs: [
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

// ---- 网络请求打点封装 ----
async function safeGet(url, headers) {
  $print(`[net][GET] ${url}`);
  try {
    const res = await $fetch.get(url, { headers });
    const len = (res?.data || '').length;
    $print(`[net][GET] done status=${res?.status} len=${len}`);
    return res;
  } catch (e) {
    $print(`[net][GET] error: ${e}`);
    return { status: 0, data: '' };
  }
}
async function safePost(url, body, headers) {
  $print(`[net][POST] ${url} bodyLen=${(body||'').length}`);
  try {
    const res = await $fetch.post(url, body, { headers });
    const len = (res?.data || '').length;
    $print(`[net][POST] done status=${res?.status} len=${len}`);
    return res;
  } catch (e) {
    $print(`[net][POST] error: ${e}`);
    return { status: 0, data: '' };
  }
}

// ---- 工具函数 ----
function firstMatch(re, s) {
  const m = s.match(re);
  return m ? (m[1] || m[0]) : '';
}
function hasM3U8(s) {
  return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(s);
}
function pickM3U8(s) {
  const m = s.match(/https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i);
  return m ? m[0] : '';
}
function tryJSONRecover(text) {
  try {
    let t = text
      .replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(t);
  } catch (e) { return null; }
}
function maybeDecodeUrl(u) {
  try { return decodeURIComponent(u); } catch { return u; }
}
function b64maybe(s) {
  try {
    if (s && /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
      const dec = $utils.base64Decode(s);
      return dec || '';
    }
  } catch (e) {}
  return '';
}
function withHeaders(extra = {}) {
  return {
    'User-Agent': UA,
    'Referer': BASE,
    'Origin': BASE,
    ...extra
  };
}

// ---- 入口实现 ----
async function getConfig() {
  $print(`[getConfig] return appConfig ver=${appConfig.ver} title=${appConfig.title}`);
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { catId = 21, page = 1 } = ext;
  const url = `${BASE}/index.php/vod/type/id/${catId}${page > 1 ? `/page/${page}` : ''}.html`;
  $print(`[getCards] catId=${catId} page=${page} url=${url}`);

  const { data, status } = await safeGet(url, withHeaders());
  if (status !== 200) {
    $utils.toastError('列表页请求失败');
    $print(`[getCards] FAIL status=${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const list = [];

  // 抓取详情卡片
  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    if (!/\/index\.php\/vod\/detail\/id\/\d+\.html$/.test(href)) return;

    const vod_name_raw = $a.text().trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src')
            || $a.closest('li,div,section,article').find('img').first().attr('src')
            || '';
    pic = abs(pic);

    const remarks = (vod_name_raw.match(/(第[\d\-]+集.*|完结|豆瓣:\s*\d+(\.\d+)?分)/g) || []).join(' ').trim();
    const idm = href.match(/\/id\/(\d+)\.html$/);
    const vid = idm ? idm[1] : href;

    list.push({
      vod_id: vid,
      vod_name: vod_name_raw.replace(/^(第.*?分)\s*/,'') || '未命名',
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

  $print(`[getCards] found=${uniq.length}`);
  return jsonify({ list: uniq });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { id } = ext;
  if (!id) {
    $utils.toastError('缺少详情ID');
    $print(`[getTracks] missing id`);
    return jsonify({ list: [] });
  }

  const url = `${BASE}/index.php/vod/detail/id/${id}.html`;
  $print(`[getTracks] id=${id} url=${url}`);

  const { data, status } = await safeGet(url, withHeaders());
  if (status !== 200) {
    $utils.toastError('详情页请求失败');
    $print(`[getTracks] FAIL status=${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const groups = [];

  // 识别包含选集链接的容器作为“源”
  const sourceBlocks = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/index\.php\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html$/.test(href)) {
      const block = $(a).closest('ul,ol,div,section').first();
      if (block.length && !sourceBlocks.includes(block)) sourceBlocks.push(block);
    }
  });
  if (!sourceBlocks.length) sourceBlocks.push($('body'));

  sourceBlocks.forEach((blk, gi) => {
    const $blk = cheerio.load($(blk).html() || '');
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
      tracks.push({ name, pan: '', ext: { id: vid, sid: Number(sid), nid: Number(nid) } });
    });
    if (tracks.length) {
      if (!/（\d+）$/.test(gtitle)) gtitle += `（${tracks.length}）`;
      groups.push({ title: gtitle, tracks });
    }
  });

  $print(`[getTracks] groups=${groups.length} totalTracks=${groups.reduce((n,g)=>n+g.tracks.length,0)}`);
  return jsonify({ list: groups });
}

// 强化版：从播放页抽出直链（多策略 + 二跳跟随 + 常见解析器兜底 + 日志）
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { id, sid = 1, nid = 1 } = ext;
  if (!id) {
    $utils.toastError('缺少播放参数');
    $print(`[playinfo] missing id`);
    return jsonify({ urls: [], headers: [withHeaders()] });
  }

  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const baseHeaders = withHeaders();
  $print(`[playinfo] start id=${id} sid=${sid} nid=${nid} url=${playUrl}`);

  // STEP 0: 拉播放页
  const r0 = await safeGet(playUrl, baseHeaders);
  const html0 = r0?.data || '';
  $print(`[playinfo] page0 status=${r0?.status} hasM3U8=${hasM3U8(html0)}`);

  // STEP 1: 直接命中 m3u8
  if (hasM3U8(html0)) {
    const m3u8 = pickM3U8(html0);
    $print(`[playinfo] m3u8@page0 ${m3u8}`);
    return jsonify({ urls: [m3u8], headers: [baseHeaders] });
  }

  // STEP 2: player JSON
  let pjsonText = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html0)
               || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html0)
               || '';
  $print(`[playinfo] hasPlayerJSON=${!!pjsonText}`);
  if (pjsonText) {
    const pobj = tryJSONRecover(pjsonText);
    $print(`[playinfo] playerJSON parsed=${!!pobj}`);
    if (pobj) {
      let url = pobj.url || pobj.link || pobj.playurl || '';
      $print(`[playinfo] player.url(raw)=${url}`);
      if (!/^https?:\/\//i.test(url)) {
        const u1 = maybeDecodeUrl(url || '');
        const u2 = b64maybe(url) || b64maybe(u1) || '';
        url = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url);
        $print(`[playinfo] player.url(decoded)=${url}`);
      }
      if (url) {
=======
// 强化版：从播放页抽出直链（多策略 + 二跳跟随 + 常见解析器兜底）
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { id, sid = 1, nid = 1 } = ext;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const BASE = 'https://999tv.app';
  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const baseHeaders = { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE };

  function firstMatch(re, s) {
    const m = s.match(re);
    return m ? m[1] || m[0] : '';
  }
  function hasM3U8(s) {
    return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(s);
  }
  function pickM3U8(s) {
    const m = s.match(/https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i);
    return m ? m[0] : '';
  }
  function tryJSONRecover(text) {
    // 容错把单引号/未引号key 转成 JSON
    try {
      let t = text.replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":')
                  .replace(/'/g, '"')
                  .replace(/,\s*}/g, '}')
                  .replace(/,\s*]/g, ']');
      return JSON.parse(t);
    } catch (e) { return null; }
  }
  function b64maybe(s) {
    try {
      // 仅短字符串尝试 base64
      if (s && /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
        const dec = $utils.base64Decode(s);
        return dec || '';
      }
    } catch(e) {}
    return '';
  }

  // STEP 0: 取播放页
  const r0 = await $fetch.get(playUrl, { headers: baseHeaders });
  const html0 = (r0 && r0.data) || '';

  // STEP 1: 直接命中 .m3u8
  if (hasM3U8(html0)) {
    return jsonify({ urls: [pickM3U8(html0)], headers: [baseHeaders] });
  }

  // STEP 2: 抓取 player JSON（AppleCMS/Art/CK/DPlayer 常见）
  // 形如：var player_aaaa = {...}; 或 window.player = {...};
  let pjsonText = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html0)
               || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html0)
               || '';
  if (pjsonText) {
    const pobj = tryJSONRecover(pjsonText);
    if (pobj) {
      let url = pobj.url || pobj.link || '';
      // 有些会把真实地址再 base64 或 urlencode 一层
      if (!/^https?:\/\//i.test(url)) {
        const u1 = decodeURIComponent(url || '');
        const u2 = b64maybe(url) || b64maybe(u1) || '';
        url = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url);
      }
      if (url) {
        // 直链 m3u8 → 直接回；否则若是 api.php?url= 这类解析器，也返回给播放器嗅探
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
        return jsonify({ urls: [url], headers: [baseHeaders] });
      }
    }
  }

<<<<<<< HEAD
  // STEP 3: iframe 二跳
  let iframeSrc = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html0) || '';
  $print(`[playinfo] iframe0=${iframeSrc}`);
=======
  // STEP 3: 页面里可能内嵌 iframe 播放器，先把 iframe src 抽出来跟随一跳
  let iframeSrc = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html0) || '';
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
  if (iframeSrc) {
    if (!/^https?:\/\//i.test(iframeSrc)) {
      if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
      else if (iframeSrc.startsWith('/')) iframeSrc = BASE + iframeSrc;
      else iframeSrc = BASE + '/' + iframeSrc.replace(/^\.\//, '');
    }
<<<<<<< HEAD
    const host = (iframeSrc.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    const hdr = withHeaders({ Referer: playUrl, Origin: host });
    const r1 = await safeGet(iframeSrc, hdr);
    const html1 = r1?.data || '';
    $print(`[playinfo] page1 status=${r1?.status} hasM3U8=${hasM3U8(html1)}`);

    if (hasM3U8(html1)) {
      const m3u8_1 = pickM3U8(html1);
      $print(`[playinfo] m3u8@page1 ${m3u8_1}`);
      return jsonify({ urls: [m3u8_1], headers: [hdr] });
    }

    // player JSON at page1
    let p2 = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html1)
          || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html1) || '';
    $print(`[playinfo] hasPlayerJSON@page1=${!!p2}`);
    if (p2) {
      const pobj2 = tryJSONRecover(p2);
      $print(`[playinfo] playerJSON@page1 parsed=${!!pobj2}`);
      if (pobj2 && (pobj2.url || pobj2.link || pobj2.playurl)) {
        let url2 = pobj2.url || pobj2.link || pobj2.playurl;
        $print(`[playinfo] player@page1.url(raw)=${url2}`);
        if (!/^https?:\/\//i.test(url2)) {
          const u1 = maybeDecodeUrl(url2 || '');
          const u2 = b64maybe(url2) || b64maybe(u1) || '';
          url2 = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url2);
          $print(`[playinfo] player@page1.url(decoded)=${url2}`);
=======
    // 二跳请求
    const host = (iframeSrc.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    const hdr = { ...baseHeaders, Referer: playUrl, Origin: host };
    const r1 = await $fetch.get(iframeSrc, { headers: hdr });
    const html1 = (r1 && r1.data) || '';

    // 二跳直出 m3u8
    if (hasM3U8(html1)) {
      return jsonify({ urls: [pickM3U8(html1)], headers: [hdr] });
    }
    // 二跳也可能是 player JSON / api.php?url=
    let p2 = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html1)
          || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html1) || '';
    if (p2) {
      const pobj2 = tryJSONRecover(p2);
      if (pobj2 && (pobj2.url || pobj2.link)) {
        let url2 = pobj2.url || pobj2.link;
        if (!/^https?:\/\//i.test(url2)) {
          const u1 = decodeURIComponent(url2 || '');
          const u2 = b64maybe(url2) || b64maybe(u1) || '';
          url2 = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url2);
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
        }
        if (url2) return jsonify({ urls: [url2], headers: [hdr] });
      }
    }
<<<<<<< HEAD

    // iframe 套娃
    const iframe2 = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html1) || '';
    $print(`[playinfo] iframe1=${iframe2}`);
=======
    // 再兜底：二跳页里的 iframe 套娃
    const iframe2 = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html1) || '';
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
    if (iframe2) {
      let u3 = iframe2;
      if (!/^https?:\/\//i.test(u3)) {
        if (u3.startsWith('//')) u3 = 'https:' + u3;
        else if (u3.startsWith('/')) u3 = host + u3;
        else u3 = host + '/' + u3.replace(/^\.\//, '');
      }
      return jsonify({ urls: [u3], headers: [hdr] });
    }
  }

<<<<<<< HEAD
  // STEP 4: 常见解析器 api.php?url=
  const parserUrl = firstMatch(/https?:\/\/[^\s'"<>]+api\.php\?[^"'<>]+/i, html0);
  $print(`[playinfo] parser@page0=${parserUrl}`);
=======
  // STEP 4: 常见“解析器”直连（给播放器去嗅探）—— 例如 .../api.php?url=xxx
  const parserUrl = firstMatch(/https?:\/\/[^\s'"<>]+api\.php\?[^"'<>]+/i, html0);
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
  if (parserUrl) {
    return jsonify({ urls: [parserUrl], headers: [baseHeaders] });
  }

<<<<<<< HEAD
  // STEP 5: 兜底返回播放页（交给播放器嗅探）
  $utils.toastError('未解析到直链，回退到嗅探');
  $print(`[playinfo] fallback -> playUrl`);
  return jsonify({ urls: [playUrl], headers: [baseHeaders] });
}

async function search(ext) {
  ext = argsify(ext);
  let { wd = '', page = 1 } = ext;
  wd = (wd || '').trim();
  if (!wd) {
    $print(`[search] empty keyword`);
    return jsonify({ list: [] });
  }

  const url = `${BASE}/index.php/vod/search.html${page > 1 ? `?page=${page}` : ''}`;
  const headers = withHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
  const body = `wd=${encodeURIComponent(wd)}&submit=search`;

  $print(`[search] wd="${wd}" page=${page} url=${url}`);
  const { data, status } = await safePost(url, body, headers);
  if (status !== 200) {
    $utils.toastError('搜索失败');
    $print(`[search] FAIL status=${status}`);
    return jsonify({ list: [] });
  }

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

  $print(`[search] results=${uniq.length}`);
  return jsonify({ list: uniq });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };
=======
  // STEP 5: 实在没有，返回播放页本身，让播放器二次嗅探
  return jsonify({ urls: [playUrl], headers: [baseHeaders] });
}
>>>>>>> 79509bc1e6708834ad71c90257707287d650c74a
