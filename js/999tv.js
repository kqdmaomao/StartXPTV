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
    return jsonify({ urls: [], headers: [{ 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE }] });
  }

  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const baseHeaders = { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE };
  $print(`[playinfo] start id=${id} sid=${sid} nid=${nid} url=${playUrl}`);

  // 工具：JS对象文本清洗 → 尽量转成 JSON 可解析
  function sanitizeJSObject(txt) {
    let t = String(txt || '');
    // 去多行/单行注释
    t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
    // 未引号 key → 补双引号
    t = t.replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":');
    // undefined → null
    t = t.replace(/:\s*undefined/g, ':null');
    // 尾逗号
    t = t.replace(/,\s*([}\]])/g, '$1');
    // 单引号→双引号
    t = t.replace(/'/g, '"');
    return t;
  }
  function maybeDecode(u) {
    if (!u) return '';
    let s = u;
    try { s = decodeURIComponent(s); } catch {}
    try {
      // base64 试一下（只对“看起来像 base64”的值尝试）
      if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
        const d = $utils.base64Decode(s);
        if (d) s = d;
      }
    } catch {}
    return s;
  }
  function fixUrl(u, referer = BASE) {
    if (!u) return '';
    let x = u.replace(/\\\//g, '/'); // 还原 JSON 里的 \/ 转义
    x = maybeDecode(x);
    if (/^https?:\/\//i.test(x)) return x;
    if (x.startsWith('//')) return 'https:' + x;
    if (x.startsWith('/')) return BASE + x;
    // 其它相对路径：挂到 referer 域名下
    const host = (referer.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    return host + (x.startsWith('/') ? '' : '/') + x.replace(/^\.\//, '');
  }
  function extractUrlFromPlayerBlock(block) {
    // 直接正则抓 url/link 字段
    const m1 = block.match(/(?:url|link|playurl)\s*:\s*["']([^"']+)["']/i);
    if (m1 && m1[1]) return m1[1];
    // 有些写成 "url":"...."（双引号键）
    const m2 = block.match(/"url"\s*:\s*"([^"]+)"/i) || block.match(/"link"\s*:\s*"([^"]+)"/i);
    return (m2 && m2[1]) || '';
  }

  // 拉取播放页
  const r0 = await safeGet(playUrl, baseHeaders);
  const html0 = r0?.data || '';
  $print(`[playinfo] page0 status=${r0?.status}`);

  // 1) 直接搜 m3u8
  if (/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/i.test(html0)) {
    const m3u8 = (html0.match(/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/i) || [])[0];
    $print(`[playinfo] m3u8@page0 ${m3u8}`);
    return jsonify({ urls: [m3u8], headers: [baseHeaders] });
  }

  // 2) player 段落：尽量解析成对象；失败则用正则抓字段
  let playerBlock = (html0.match(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i) || [])[1]
                 || (html0.match(/player\s*=\s*(\{[\s\S]*?\});/i) || [])[1]
                 || '';
  $print(`[playinfo] hasPlayerBlock=${!!playerBlock}`);
  if (playerBlock) {
    let pobj = null, raw = playerBlock;
    // 先尝试清洗后 JSON.parse
    try {
      const clean = sanitizeJSObject(playerBlock);
      pobj = JSON.parse(clean);
      $print(`[playinfo] playerJSON parsed=true`);
    } catch (e) {
      $print(`player json parse error (after sanitize): ${e}`);
    }

    // 取 url 值
    let found = '';
    if (pobj) {
      found = pobj.url || pobj.link || pobj.playurl || '';
      $print(`[playinfo] player.url(raw)=${found}`);
      // MacCMS 常见：encrypt=1/2 对 url 做了编码
      const enc = String(pobj.encrypt ?? pobj.encrypted ?? '');
      if (found && enc) $print(`[playinfo] encrypt=${enc}`);
    }

    // 如果对象解析失败或没取到，就直接在块里用正则抓字段
    if (!found) {
      found = extractUrlFromPlayerBlock(raw);
      $print(`[playinfo] player.url(extracted)=${found}`);
    }

    // decode & 归一化
    if (found) {
      const final = fixUrl(found, playUrl);
      $print(`[playinfo] player.url(final)=${final}`);
      return jsonify({ urls: [final], headers: [baseHeaders] });
    }
  }

  // 3) iframe 二跳
  let iframeSrc = (html0.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
  $print(`[playinfo] iframe0=${iframeSrc}`);
  if (iframeSrc) {
    if (!/^https?:\/\//i.test(iframeSrc)) {
      if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
      else if (iframeSrc.startsWith('/')) iframeSrc = BASE + iframeSrc;
      else iframeSrc = BASE + '/' + iframeSrc.replace(/^\.\//, '');
    }
    const host = (iframeSrc.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    const hdr = { ...baseHeaders, Referer: playUrl, Origin: host };

    const r1 = await safeGet(iframeSrc, hdr);
    const html1 = r1?.data || '';
    $print(`[playinfo] page1 status=${r1?.status}`);

    if (/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/i.test(html1)) {
      const m3u8_1 = (html1.match(/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/i) || [])[0];
      $print(`[playinfo] m3u8@page1 ${m3u8_1}`);
      return jsonify({ urls: [m3u8_1], headers: [hdr] });
    }

    // page1 的 player
    let p2 = (html1.match(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i) || [])[1]
          || (html1.match(/player\s*=\s*(\{[\s\S]*?\});/i) || [])[1] || '';
    $print(`[playinfo] hasPlayerBlock@page1=${!!p2}`);
    if (p2) {
      let pobj2 = null, raw2 = p2;
      try {
        const clean2 = sanitizeJSObject(p2);
        pobj2 = JSON.parse(clean2);
        $print(`[playinfo] playerJSON@page1 parsed=true`);
      } catch (e) {
        $print(`player json parse error@page1 (after sanitize): ${e}`);
      }
      let found2 = pobj2 ? (pobj2.url || pobj2.link || pobj2.playurl || '') : '';
      if (!found2) {
        found2 = extractUrlFromPlayerBlock(raw2);
        $print(`[playinfo] player@page1.url(extracted)=${found2}`);
      }
      if (found2) {
        const final2 = fixUrl(found2, iframeSrc);
        $print(`[playinfo] player@page1.url(final)=${final2}`);
        return jsonify({ urls: [final2], headers: [hdr] });
      }
    }

    // iframe 套娃兜底
    const iframe2 = (html1.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    $print(`[playinfo] iframe1=${iframe2}`);
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

  // 4) 常见解析器
  const parserUrl = (html0.match(/https?:\/\/[^\s'"<>]+api\.php\?[^"'<>]+/i) || [])[0] || '';
  $print(`[playinfo] parser@page0=${parserUrl}`);
  if (parserUrl) {
    return jsonify({ urls: [parserUrl], headers: [baseHeaders] });
  }

  // 5) 兜底
  $utils.toastError('未解析到直链，回退到嗅探');
  $print(`[playinfo] fallback -> playUrl`);
  return jsonify({ urls: [playUrl], headers: [baseHeaders] });
}