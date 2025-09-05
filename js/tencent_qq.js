// tencent_qq.js — XPTV 扩展：腾讯视频（导航+搜索+播放页嗅探）
// 适配 XPTV：getConfig / getCards / getTracks / getPlayinfo / search
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

// 频道页多为前端渲染，不稳定；这里放“提示卡片”，引导使用搜索
async function getCards(ext) {
  ext = argsify(ext);
  const { cat = 'movie', page = 1 } = ext;
  $print(`[getCards] cat=${cat} page=${page} (tip: use search)`);

  const tips = {
    movie:   '请输入影片名进行搜索（腾讯频道页为动态渲染，推荐用搜索）',
    tv:      '请输入剧名进行搜索（支持季/集）',
    variety: '请输入综艺名进行搜索',
    cartoon: '请输入动漫名进行搜索',
    search:  '在顶部搜索框输入关键词'
  };

  return jsonify({
    list: [{
      vod_id: `hint_${cat}`,
      vod_name: `🔍 ${tips[cat] || tips.search}`,
      vod_pic: '',
      vod_remarks: '建议使用“搜索”Tab',
      ext: { cat }
    }]
  });
}

// 以“搜索结果”为入口，简化为 1 条“正片”track；后续可扩成分集
async function getTracks(ext) {
  ext = argsify(ext);
  const { id, title, cover, playUrl } = ext || {};
  $print(`[getTracks] id=${id||''} title=${title||''} playUrl=${playUrl||''}`);

  if (!playUrl) {
    $print(`[getTracks] missing playUrl`);
    return jsonify({ list: [] });
  }
  return jsonify({
    list: [{
      title: `${title || '腾讯视频'}（1）`,
      tracks: [{
        name: '正片',
        pan: '',
        ext: { playUrl }
      }]
    }]
  });
}

// 返回播放页 URL + 合适的 Referer/Origin，交给播放器嗅探
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const playUrl = ext?.playUrl;
  $print(`[playinfo] playUrl=${playUrl||''}`);

  if (!playUrl) {
    $utils.toastError('缺少腾讯播放地址');
    return jsonify({ urls: [], headers: [ headers() ] });
  }

  const domain = (playUrl.match(/^https?:\/\/([^/]+)/i) || [,'v.qq.com'])[1];
  const useOrigin = `https://${domain}`;
  const hdr = headers({ Referer: useOrigin, Origin: useOrigin });

  return jsonify({ urls: [playUrl], headers: [hdr] });
}

// 用 m.v.qq.com 的搜索页（更偏 SSR），提取标题/封面/播放链接
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

  $('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    if (!href) return;
    const absHref = href.startsWith('http') ? href
                  : (href.startsWith('//') ? ('https:' + href)
                  : (MBASE + href));

    if (!/m\.v\.qq\.com\/x\//.test(absHref)) return; // 仅保留播放/详情相关

    const name = ($a.attr('title') || $a.text() || '').trim().replace(/\s+/g, ' ');
    let pic = $a.find('img').attr('src') || $a.closest('li,div,section,article').find('img').first().attr('src') || '';
    if (pic && pic.startsWith('//')) pic = 'https:' + pic;

    const vid = absHref; // 用链接当ID
    list.push({
      vod_id: vid,
      vod_name: name || '腾讯视频内容',
      vod_pic: pic || '',
      vod_remarks: '',
      ext: { id: vid, title: name, cover: pic, playUrl: absHref }
    });
  });

  // 去重
  const seen = new Set();
  const uniq = list.filter(it => !seen.has(it.vod_id) && seen.add(it.vod_id));

  $print(`[search] results=${uniq.length}`);
  return jsonify({ list: uniq });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };