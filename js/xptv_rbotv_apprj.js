// XPTV 插件：热播｜APP（csp_AppRJ 迁移）
// 原 TVBox 条目（简化）:
// { key:"热播影视", name:"热播｜APP", type:3, api:"csp_AppRJ", ext:{ "url": "http://v.rbotv.cn" } }

const BASE = 'http://v.rbotv.cn'.replace(/\/+$/, '');
const UA = 'Mozilla/5.0 (Linux; Android 12; XPTV) AppleWebKit/537.36 (KHTML, like Gecko) Mobile';
function headers() { return { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE }; }

/**
 * 不同 AppRJ 站的常见路径差异：
 * - A: /xgapp.php/v1/index/video?tid={catId}&pg={page}
 *      /xgapp.php/v1/vod/detail?ids={id}
 *      /xgapp.php/v1/vod/search?text={kw}&pg={page}
 * - B: /xgapp.php/v1/videolist?tid={catId}&page={page}
 *      /xgapp.php/v1/videoinfo?ids={id}
 *      /xgapp.php/v1/search?text={kw}&pg={page}
 * - C: /api.php/app/index_video?tid={catId}&pg={page}  // 少数旧站
 */
const PATHS = [
  {
    name: 'styleA',
    list:   (catId, page) => `${BASE}/xgapp.php/v1/index/video?tid=${catId}&pg=${page}`,
    detail: (id)          => `${BASE}/xgapp.php/v1/vod/detail?ids=${id}`,
    search: (kw, page)    => `${BASE}/xgapp.php/v1/vod/search?text=${encodeURIComponent(kw)}&pg=${page}`
  },
  {
    name: 'styleB',
    list:   (catId, page) => `${BASE}/xgapp.php/v1/videolist?tid=${catId}&page=${page}`,
    detail: (id)          => `${BASE}/xgapp.php/v1/videoinfo?ids=${id}`,
    search: (kw, page)    => `${BASE}/xgapp.php/v1/search?text=${encodeURIComponent(kw)}&pg=${page}`
  },
  {
    name: 'styleC_old',
    list:   (catId, page) => `${BASE}/api.php/app/index_video?tid=${catId}&pg=${page}`,
    detail: (id)          => `${BASE}/api.php/app/video_detail?ids=${id}`,
    search: (kw, page)    => `${BASE}/api.php/app/search?text=${encodeURIComponent(kw)}&pg=${page}`
  }
];

let active = null; // 选中的风格

async function probeOnce(p) {
  // 用 catId=1, page=1 试探“列表接口”是否返回正常 JSON 且含 list 数组
  try {
    const url = p.list(1, 1);
    const j = await request(url, { headers: headers() }).json();
    if (!j) return false;
    // 兼容多种返回格式：{code:200,list:[...]}, {flag:'ok',data:{list:[]}} 等
    const list = Array.isArray(j.list) ? j.list
               : Array.isArray(j.data?.list) ? j.data.list
               : (Array.isArray(j.data) ? j.data : null);
    if (list && list.length >= 0) return true;
  } catch (e) {}
  return false;
}

async function ensureActive() {
  if (active) return active;
  for (const p of PATHS) {
    if (await probeOnce(p)) { active = p; break; }
  }
  // 如果都失败，兜底使用 styleA（方便你手动调整）
  if (!active) active = PATHS[0];
  return active;
}

function mapListItems(raw) {
  // 兼容多种字段：id/name/title/pic/cover/note/remarks/year 等
  const id    = raw.vod_id || raw.id || raw.ids || raw.vid || raw.mid || raw.ID || raw.IDS;
  const title = raw.vod_name || raw.name || raw.title || raw.videoname || '';
  const cover = raw.vod_pic  || raw.pic  || raw.cover || raw.img || raw.image || '';
  const remark= raw.vod_remarks || raw.note || raw.remark || raw.msg || raw.score || '';
  return { id, title, cover, remark };
}

function splitPlayFromUrl(vod) {
  // 常见 AppRJ 剧集字段：
  // - vod.play / vod.play_url / vod.url / vod.playlist 等
  // - 组与组之间用 $$$ 分隔，每组内用 # 分集，分集用 "名称$链接"
  const carriers = [
    vod.play, vod.play_url, vod.url, vod.playlist, vod.video_url, vod.vod_url
  ].filter(Boolean);

  const groups = [];
  for (const carrier of carriers) {
    const byGroup = String(carrier).split('$$$');
    byGroup.forEach((grp, gi) => {
      const tracks = [];
      String(grp).split('#').forEach(seg => {
        const [t, u] = seg.split('$');
        const title = (t || '').trim();
        const link  = (u || '').trim();
        if (link) tracks.push({ id: link, title: title || `第${tracks.length + 1}集`, raw: link });
      });
      if (tracks.length) groups.push({ name: `源${groups.length + 1}`, tracks });
    });
    if (groups.length) break; // 取到就够了
  }
  return groups;
}

/* ---------------- 必要的 5 个接口 ---------------- */

async function getConfig() {
  await ensureActive();
  return jsonify({
    ver: 20250825,
    title: '热播｜APP',
    site: BASE,
    tabs: [
      { name: '电影', ext: { catId: 1, page: 1 } },
      { name: '电视剧', ext: { catId: 2, page: 1 } },
      { name: '综艺', ext: { catId: 3, page: 1 } },
      { name: '动漫', ext: { catId: 4, page: 1 } }
    ]
  });
}

async function getCards(ext) {
  const api = await ensureActive();
  const url = api.list(ext?.catId || 1, ext?.page || 1);
  const j = await request(url, { headers: headers() }).json();
  const arr = Array.isArray(j.list) ? j.list
            : Array.isArray(j.data?.list) ? j.data.list
            : (Array.isArray(j.data) ? j.data : []);
  const cards = arr.map(mapListItems);
  return jsonify(cards);
}

async function getTracks(ext) {
  const api = await ensureActive();
  const url = api.detail(ext.id);
  const j = await request(url, { headers: headers() }).json();
  // 详情返回可能在 list[0] 或 data 中
  const vod = (Array.isArray(j.list) && j.list[0]) || j.data || j.result || j;
  const info = mapListItems(vod);
  // 补充简介
  info.intro = vod.vod_content || vod.content || vod.desc || vod.description || '';
  const groups = splitPlayFromUrl(vod);
  return jsonify({ info: { title: info.title, cover: info.cover, intro: info.intro }, groups });
}

async function getPlayinfo(ext) {
  // AppRJ 通常分集 id/原始就是直链（m3u8/mp4）；直接返回
  const url = ext.id || ext.raw || '';
  return jsonify({ url, headers: headers() });
}

async function search(ext) {
  const api = await ensureActive();
  const kw = (ext?.keyword || '').trim();
  if (!kw) return jsonify([]);
  const url = api.search(kw, 1);
  const j = await request(url, { headers: headers() }).json();
  const arr = Array.isArray(j.list) ? j.list
            : Array.isArray(j.data?.list) ? j.data.list
            : (Array.isArray(j.data) ? j.data : []);
  const cards = arr.map(mapListItems);
  return jsonify(cards);
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };