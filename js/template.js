// template.js — XPTV JS 扩展通用模板（带日志与多策略解析骨架）
// 用法：复制本文件为 <yoursite>.js，修改 BASE、选择器/正则 即可。
// 日志查看：在浏览器打开 http://设备IP:8110/log

const cheerio = createCheerio();
const CryptoJS = createCryptoJS(); // 如果不用 AES，可留着也无妨

// ====== 1) 基本常量（按站点修改）======
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://example.com'; // TODO: 改成你的站点根域名

const appConfig = {
  ver: 20250825,                  // 建议用日期做版本号
  title: '示例站点',              // TODO: 改显示名
  site: BASE,
  tabs: [
    // TODO: 按站点分类补齐；ext 会传给 getCards
    { name: '电影',  ext: { catId: 1, page: 1 } },
    { name: '剧集',  ext: { catId: 2, page: 1 } },
    { name: '综艺',  ext: { catId: 3, page: 1 } },
    { name: '动漫',  ext: { catId: 4, page: 1 } },
  ],
};

// ====== 2) 小工具 =======
function abs(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  return BASE + '/' + url.replace(/^\.\//, '');
}

function headers(extra = {}) {
  return { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE, ...extra };
}

async function safeGet(url, hdrs) {
  $print(`[net][GET] ${url}`);
  try {
    const r = await $fetch.get(url, { headers: hdrs });
    $print(`[net][GET] done status=${r?.status} len=${(r?.data||'').length}`);
    return r;
  } catch (e) {
    $print(`[net][GET] error: ${e}`);
    return { status: 0, data: '' };
  }
}

async function safePost(url, body, hdrs) {
  $print(`[net][POST] ${url} bodyLen=${(body||'').length}`);
  try {
    const r = await $fetch.post(url, body, { headers: hdrs });
    $print(`[net][POST] done status=${r?.status} len=${(r?.data||'').length}`);
    return r;
  } catch (e) {
    $print(`[net][POST] error: ${e}`);
    return { status: 0, data: '' };
  }
}

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
function sanitizeJSObject(txt) {
  let t = String(txt || '');
  t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, ''); // 注释
  t = t.replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":');              // 未引号 key
  t = t.replace(/:\s*undefined/g, ':null');                              // undefined→null
  t = t.replace(/,\s*([}\]])/g, '$1');                                   // 尾逗号
  t = t.replace(/'/g, '"');                                              // 单引→双引
  return t;
}
function maybeDecode(u) {
  if (!u) return '';
  let s = u;
  try { s = decodeURIComponent(s); } catch {}
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
      const d = $utils.base64Decode(s);
      if (d) s = d;
    }
  } catch {}
  return s;
}
function fixUrl(u, referer = BASE) {
  if (!u) return '';
  let x = u.replace(/\\\//g, '/');
  x = maybeDecode(x);
  if (/^https?:\/\//i.test(x)) return x;
  if (x.startsWith('//')) return 'https:' + x;
  if (x.startsWith('/')) return BASE + x;
  const host = (referer.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
  return host + (x.startsWith('/') ? '' : '/') + x.replace(/^\.\//, '');
}

// ====== 3) 必备入口 =======
async function getConfig() {
  $print(`[getConfig] ver=${appConfig.ver} title=${appConfig.title}`);
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { catId = 1, page = 1 } = ext;

  // TODO: 按你的路由规则修改 URL
  const url = `${BASE}/index.php/vod/type/id/${catId}${page>1?`/page/${page}`:''}.html`;
  $print(`[getCards] catId=${catId} page=${page} url=${url}`);

  const { data, status } = await safeGet(url, headers());
  if (status !== 200) {
    $utils.toastError('列表页请求失败');
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const list = [];

  // TODO: 按站点结构提取卡片：详情链接、标题、封面、备注
  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    // 示例：过滤 detail 链接
    if (!/\/index\.php\/vod\/detail\/id\/\d+\.html$/.test(href)) return;

    const name = ($a.attr('title') || $a.text() || '').trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src')
            || $a.closest('li,div,section,article').find('img').first().attr('src') || '';
    pic = abs(pic);

    const idm = href.match(/\/id\/(\d+)\.html$/);
    const vid = idm ? idm[1] : href;
    const remarks = (name.match(/(第[\d\-]+集.*|完结|豆瓣:\s*\d+(\.\d+)?分)/g) || []).join(' ').trim();

    list.push({
      vod_id: vid,
      vod_name: name || '未命名',
      vod_pic: pic || '',
      vod_remarks: remarks || '',
      ext: { id: vid } // 传给 getTracks
    });
  });

  // 去重
  const seen = new Set();
  const uniq = list.filter(it => !seen.has(it.vod_id) && seen.add(it.vod_id));
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

  // TODO: 修改为你的详情页路由
  const url = `${BASE}/index.php/vod/detail/id/${id}.html`;
  $print(`[getTracks] id=${id} url=${url}`);

  const { data, status } = await safeGet(url, headers());
  if (status !== 200) {
    $utils.toastError('详情页请求失败');
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const groups = [];

  // TODO: 识别每个播放源分组 + 集数链接
  const sourceBlocks = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/index\.php\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html$/.test(href)) {
      const block = $(a).closest('ul,ol,div,section').first();
      if (block.length && !sourceBlocks.includes(block)) sourceBlocks.push(block);
    }
  });
  if (!sourceBlocks.length) sourceBlocks.push($('body'));

  sourceBlocks.forEach((blk, i) => {
    const $blk = cheerio.load($(blk).html() || '');
    let gtitle = $(blk).prevAll(':header').first().text().trim()
               || $(blk).prev().text().trim()
               || `播放源${i+1}`;
    const tracks = [];
    $blk('a').each((_, a) => {
      const $a = $blk(a);
      const href = $a.attr('href') || '';
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

async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { id, sid = 1, nid = 1 } = ext;
  if (!id) {
    $utils.toastError('缺少播放参数');
    $print(`[playinfo] missing id`);
    return jsonify({ urls: [], headers: [headers()] });
  }

  // TODO: 修改为你的播放页路由
  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const baseHeaders = headers();
  $print(`[playinfo] start id=${id} sid=${sid} nid=${nid} url=${playUrl}`);

  const r0 = await safeGet(playUrl, baseHeaders);
  const html0 = r0?.data || '';
  $print(`[playinfo] page0 status=${r0?.status} hasM3U8=${hasM3U8(html0)}`);

  // 1) 直链 m3u8
  if (hasM3U8(html0)) {
    const m3u8 = pickM3U8(html0);
    $print(`[playinfo] m3u8@page0 ${m3u8}`);
    return jsonify({ urls: [m3u8], headers: [baseHeaders] });
  }

  // 2) player JSON（JS 对象）
  let playerBlock = (html0.match(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i) || [])[1]
                 || (html0.match(/player\s*=\s*(\{[\s\S]*?\});/i) || [])[1] || '';
  $print(`[playinfo] hasPlayerBlock=${!!playerBlock}`);
  if (playerBlock) {
    let pobj = null;
    try {
      pobj = JSON.parse(sanitizeJSObject(playerBlock));
      $print(`[playinfo] playerJSON parsed=true`);
    } catch (e) {
      $print(`player json parse error: ${e}`);
    }

    let found = pobj ? (pobj.url || pobj.link || pobj.playurl || '') : '';
    if (!found) {
      // 直接正则抓字段
      const m1 = playerBlock.match(/(?:url|link|playurl)\s*:\s*["']([^"']+)["']/i);
      found = m1 ? m1[1] : '';
      $print(`[playinfo] player.url(extracted)=${found}`);
    }
    if (found) {
      const final = fixUrl(found, playUrl);
      $print(`[playinfo] player.url(final)=${final}`);
      return jsonify({ urls: [final], headers: [baseHeaders] });
    }
  }

  // 3) iframe 二跳
  let iframeSrc = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html0) || '';
  $print(`[playinfo] iframe0=${iframeSrc}`);
  if (iframeSrc) {
    if (!/^https?:\/\//i.test(iframeSrc)) {
      if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
      else if (iframeSrc.startsWith('/')) iframeSrc = BASE + iframeSrc;
      else iframeSrc = BASE + '/' + iframeSrc.replace(/^\.\//, '');
    }
    const host = (iframeSrc.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    const hdr = headers({ Referer: playUrl, Origin: host });

    const r1 = await safeGet(iframeSrc, hdr);
    const html1 = r1?.data || '';
    $print(`[playinfo] page1 status=${r1?.status} hasM3U8=${hasM3U8(html1)}`);

    if (hasM3U8(html1)) {
      const m3u8_1 = pickM3U8(html1);
      $print(`[playinfo] m3u8@page1 ${m3u8_1}`);
      return jsonify({ urls: [m3u8_1], headers: [hdr] });
    }

    // page1 的 player
    let p2 = (html1.match(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i) || [])[1]
          || (html1.match(/player\s*=\s*(\{[\s\S]*?\});/i) || [])[1] || '';
    $print(`[playinfo] hasPlayerBlock@page1=${!!p2}`);
    if (p2) {
      let pobj2 = null;
      try {
        pobj2 = JSON.parse(sanitizeJSObject(p2));
        $print(`[playinfo] playerJSON@page1 parsed=true`);
      } catch (e) {
        $print(`player json parse error@page1: ${e}`);
      }
      let found2 = pobj2 ? (pobj2.url || pobj2.link || pobj2.playurl || '') : '';
      if (!found2) {
        const m = p2.match(/(?:url|link|playurl)\s*:\s*["']([^"']+)["']/i);
        found2 = m ? m[1] : '';
        $print(`[playinfo] player@page1.url(extracted)=${found2}`);
      }
      if (found2) {
        const final2 = fixUrl(found2, iframeSrc);
        $print(`[playinfo] player@page1.url(final)=${final2}`);
        return jsonify({ urls: [final2], headers: [hdr] });
      }
    }

    // iframe 套娃兜底
    const iframe2 = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html1) || '';
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
  const parserUrl = firstMatch(/https?:\/\/[^\s'"<>]+api\.php\?[^"'<>]+/i, html0);
  $print(`[playinfo] parser@page0=${parserUrl}`);
  if (parserUrl) {
    return jsonify({ urls: [parserUrl], headers: [baseHeaders] });
  }

  // 5) 兜底：返回播放页让播放器嗅探
  $utils.toastError('未解析到直链，回退嗅探');
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

  // TODO: 站内搜索路由，如 POST /index.php/vod/search.html
  const url = `${BASE}/index.php/vod/search.html${page > 1 ? `?page=${page}` : ''}`;
  const body = `wd=${encodeURIComponent(wd)}&submit=search`;
  const hdrs = headers({ 'Content-Type': 'application/x-www-form-urlencoded' });

  $print(`[search] wd="${wd}" page=${page} url=${url}`);
  const { data, status } = await safePost(url, body, hdrs);
  if (status !== 200) {
    $utils.toastError('搜索失败');
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const list = [];

  // TODO: 提取 detail 链接 + 标题 + 封面
  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    if (!/\/index\.php\/vod\/detail\/id\/\d+\.html$/.test(href)) return;

    const name = ($a.attr('title') || $a.text() || '').trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src')
            || $a.closest('li,div,section,article').find('img').first().attr('src') || '';
    pic = abs(pic);

    const idm = href.match(/\/id\/(\d+)\.html$/);
    const vid = idm ? idm[1] : href;
    const remarks = ($a.text().match(/(第[\d\-]+集.*|完结|豆瓣:\s*\d+(\.\d+)?分)/g) || []).join(' ').trim();

    list.push({ vod_id: vid, vod_name: name || '未命名', vod_pic: pic || '', vod_remarks: remarks || '', ext: { id: vid } });
  });

  const seen = new Set();
  const uniq = list.filter(it => !seen.has(it.vod_id) && seen.add(it.vod_id));
  $print(`[search] results=${uniq.length}`);
  return jsonify({ list: uniq });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };