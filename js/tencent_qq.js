// tencent_qq.js — XPTV 扩展：腾讯视频（导航+搜索+播放页嗅探）
// 兼容 XPTV 运行时：getConfig/getCards/getTracks/getPlayinfo/search
// 日志：在浏览器打开 http://设备IP:8110/log

const cheerio = createCheerio();

const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://v.qq.com';
const MBASE = 'https://m.v.qq.com';

const appConfig = {
  ver: 20250905,
  title: '腾讯视频（嗅探）',
  site: BASE,
  tabs: [
    { name: '电影',  ext: { cat: 'movie', page: 1 } },
    { name: '剧集',  ext: { cat: 'tv',    page: 1 } },
    { name: '综艺',  ext: { cat: 'variety', page: 1 } },
    { name: '动漫',  ext: { cat: 'cartoon', page: 1 } },
    { name: '搜索',  ext: { cat: 'search', page: 1 } },
  ],
};

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

function abs(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  return BASE + '/' + url.replace(/^\.\//, '');
}

async function getConfig() {
  $print(`[getConfig] tencent ver=${appConfig.ver}`);
  return jsonify(appConfig);
}

/**
 * 注意：腾讯频道页是重前端渲染，分类列表难以稳定抓取。
 * 这里 getCards 仅做“导航占位”且提示去用“搜索”。
 */
async function getCards(ext) {
  ext = argsify(ext);
  const { cat = 'movie', page = 1 } = ext;
  $print(`[getCards] cat=${cat} page=${page} (hint: use search)`);

  const tips = {
    movie:   '请输入影片名进行搜索（腾讯频道页为动态渲染，推荐用搜索）',
    tv:      '请输入剧名进行搜索（支持季/集）',
    variety: '请输入综艺名进行搜索',
    cartoon: '请输入动漫名进行搜索',
    search:  '在顶部搜索框输入关键词'
  };

  // 用“卡片 + 说明”的占位条目（点击会进入搜索页提示）
  const list = [{
    vod_id: `hint_${cat}`,
    vod_name: `🔍 ${tips[cat] || tips.search}`,
    vod_pic: '',
    vod_remarks: '建议改用“搜索”Tab',
    ext: { cat }
  }];

  return jsonify({ list });
}

/**
 * 详情与分集：对腾讯视频而言，不同形态（正片/剧集/会员/短剧）结构差异较大。
 * 这里采取“轻量化”策略：把一条搜索结果当作一个“播放源”，tracks 里仅放“正片/播放页”。
 * 如果你后续提供更准确的 ID/选择器，我们可以把分集（第1集/第2集…）做成多 track。
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { id, title, cover, playUrl } = ext || {};
  $print(`[getTracks] id=${id||''} title=${title||''} playUrl=${playUrl||''}`);

  // 兜底：如果 ext 里没有 playUrl，就直接返回空
  if (!playUrl) {
    $print(`[getTracks] missing playUrl in ext`);
    return jsonify({ list: [] });
  }

  const groupTitle = `${title || '腾讯视频'}（1）`;
  const tracks = [{
    name: '正片',
    pan: '',
    ext: { playUrl }
  }];

  return jsonify({ list: [{ title: groupTitle, tracks }] });
}

/**
 * 播放页解析：返回播放页 URL + headers，交给嗅探/解析器。
 * 对于会员/加密内容，无法提供直链；但大多数公开内容可嗅探播放。
 */
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const playUrl = ext?.playUrl;
  $print(`[playinfo] playUrl=${playUrl||''}`);

  if (!playUrl) {
    $utils.toastError('缺少腾讯播放地址');
    return jsonify({ urls: [], headers: [ headers() ] });
  }

  // 有些链接来自移动页 m.v.qq.com，保留 Referer/Origin 为对应域更稳
  const domain = (playUrl.match(/^https?:\/\/([^/]+)/i) || [,'v.qq.com'])[1];
  const useOrigin = `https://${domain}`;
  const hdr = headers({ Referer: useOrigin, Origin: useOrigin });

  // 直接把播放页交给播放器嗅探
  return jsonify({
    urls: [playUrl],
    headers: [hdr]
  });
}

/**
 * 搜索：走 m.v.qq.com 的搜索页（SSR 相对友好）
 * 示例： https://m.v.qq.com/search.html?key=三体
 * 结构可能偶有微调；这里做容错选择器，提取标题/封面/跳转链接。
 */
async function search(ext) {
  ext = argsify(ext);
  let { wd = '', page = 1 } = ext;
  wd = (wd || '').trim();
  if (!wd) {
    $print(`[search] empty keyword`);
    return jsonify({ list: [] });
  }

  const url = `${MBASE}/search.html?key=${encodeURIComponent(wd)}${page>1?`&page=${page}`:''}`;
  $print(`[search] url=${url}`);

  const { data, status } = await safeGet(url, headers({ Referer: MBASE, Origin: MBASE }));
  if (status !== 200) {
    $utils.toastError('腾讯搜索失败');
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const list = [];

  // 兼容多种布局：卡片一般在 <a>，href 指向 m.v.qq.com/x/cover/... 或 x/episode/...
  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    // 保留移动端播放/详情优先
    if (!/^https?:\/\//.test(href) && !href.startsWith('/')) return;
    const absHref = href.startsWith('http') ? href : (href.startsWith('//') ? ('https:' + href) : (MBASE + href));

    // 仅挑选腾讯“视频详情/播放”相关链接
    if (!/m\.v\.qq\.com\/x\//.test(absHref)) return;

    const name = ($a.attr('title') || $a.text() || '').trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src') || $a.closest('li,div,section,article').find('img').first().attr('src') || '';
    if (pic && pic.startsWith('//')) pic = 'https:' + pic;

    // 以链接做临时 ID
    const vid = absHref;

    list.push({
      vod_id: vid,
      vod_name: name || '腾讯视频内容',
      vod_pic: pic || '',
      vod_remarks: '',
      // 将播放页链接塞到 ext，便于 getTracks/getPlayinfo 直接使用
      ext: { id: vid, title: name, cover: pic, playUrl: absHref }
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