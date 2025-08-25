$print('>>> rbotv plugin loaded top-level');

// XPTV 插件：热播APP（csp_AppRJ 迁移）
// 原 TVBox：{ key:"热播影视", name:"热播｜APP", type:3, api:"csp_AppRJ", ext:{ "url": "http://v.rbotv.cn" } }

const BASE = 'http://v.rbotv.cn'.replace(/\/+$/, '');
const UA   = 'Mozilla/5.0 (Linux; Android 12; XPTV) AppleWebKit/537.36 (KHTML, like Gecko) Mobile';
function headers() { return { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE }; }

// 常见 AppRJ 风格（先 B，后 A，再 C）
const PATHS = [
  {
    name: 'styleB',
    list:   (catId, page) => `${BASE}/xgapp.php/v1/videolist?tid=${catId}&page=${page}`,
    detail: (id)          => `${BASE}/xgapp.php/v1/videoinfo?ids=${id}`,
    search: (kw, page)    => `${BASE}/xgapp.php/v1/search?text=${encodeURIComponent(kw)}&pg=${page}`
  },
  {
    name: 'styleA',
    list:   (catId, page) => `${BASE}/xgapp.php/v1/index/video?tid=${catId}&pg=${page}`,
    detail: (id)          => `${BASE}/xgapp.php/v1/vod/detail?ids=${id}`,
    search: (kw, page)    => `${BASE}/xgapp.php/v1/vod/search?text=${encodeURIComponent(kw)}&pg=${page}`
  },
  {
    name: 'styleC_old',
    list:   (catId, page) => `${BASE}/api.php/app/index_video?tid=${catId}&pg=${page}`,
    detail: (id)          => `${BASE}/api.php/app/video_detail?ids=${id}`,
    search: (kw, page)    => `${BASE}/api.php/app/search?text=${encodeURIComponent(kw)}&pg=${page}`
  }
];

let active = null;

/* ---------------- getConfig：不联网，条目一定出现 ---------------- */
async function getConfig() {
  $print('rbotv:getConfig');
  return jsonify({
    ver: 20250825,
    title: '热播APP',
    site: 'http://v.rbotv.cn',
    tabs: [
      { name: '电影',   ext: { catId: 1, page: 1 } },
      { name: '电视剧', ext: { catId: 2, page: 1 } },
      { name: '综艺',   ext: { catId: 3, page: 1 } },
      { name: '动漫',   ext: { catId: 4, page: 1 } }
    ]
  });
}

/* ---------------- 探测路由：仅在拉数据时做一次 ---------------- */
async function probeOnce(p) {
  try {
    const url = p.list(1, 1);
    $print('rbotv:probe', p.name, url);
    const j = await request(url, { headers: headers() }).json();
    const list = Array.isArray(j?.list) ? j.list
               : Array.isArray(j?.data?.list) ? j.data.list
               : (Array.isArray(j?.data) ? j.data : null);
    return list !== null;
  } catch (e) {
    $print('rbotv:probe_error', p.name, String(e));
    return false;
  }
}

async function ensureActive() {
  if (active) return active;
  for (const p of PATHS) {
    if (await probeOnce(p)) { active = p; $print('rbotv:use', p.name); break; }
  }
  if (!active) { active = PATHS[0]; $print('rbotv:use_fallback', active.name); }
  return active;
}

/* ---------------- 字段映射 & 分组拆分 ---------------- */
function mapListItem(it) {
  return {
    id:     it?.vod_id || it?.id || it?.ids || it?.vid || it?.mid || it?.ID || it?.IDS || '',
    title:  it?.vod_name || it?.name || it?.title || it?.videoname || '',
    cover:  it?.vod_pic  || it?.pic  || it?.cover || it?.img || it?.image || '',
    remark: it?.vod_remarks || it?.note || it?.remark || it?.msg || it?.score || ''
  };
}

function buildGroupsFromVod(vod) {
  const carriers = [
    vod?.play, vod?.play_url, vod?.url, vod?.playlist, vod?.video_url, vod?.vod_url, vod?.vod_play_url
  ].filter(Boolean);

  const groups = [];
  for (const carrier of carriers) {
    const byGroup = String(carrier).split('$$$');
    byGroup.forEach(grp => {
      const tracks = [];
      String(grp).split('#').forEach(seg => {
        const [t, u] = seg.split('$');
        const title = (t || '').trim();
        const link  = (u || '').trim();
        if (link) tracks.push({ id: link, title: title || `第${tracks.length + 1}集`, raw: link });
      });
      if (tracks.length) groups.push({ name: `源${groups.length + 1}`, tracks });
    });
    if (groups.length) break;
  }
  return groups;
}

/* ---------------- 五个接口 ---------------- */

// 列表
async function getCards(ext) {
  const cat  = ext?.catId || 1;
  const page = ext?.page || 1;
  try {
    const api = await ensureActive();
    const url = api.list(cat, page);
    $print('rbotv:getCards', url);
    const j = await request(url, { headers: headers() }).json();
    const arr = Array.isArray(j?.list) ? j.list
              : Array.isArray(j?.data?.list) ? j.data.list
              : (Array.isArray(j?.data) ? j.data : []);
    return jsonify(arr.map(mapListItem));
  } catch (e) {
    $print('rbotv:getCards_error', String(e));
    return jsonify([]); // 出错也返回空数组，避免 UI 崩
  }
}

// 详情
async function getTracks(ext) {
  try {
    const api = await ensureActive();
    const url = api.detail(ext.id);
    $print('rbotv:getTracks', url);
    const j = await request(url, { headers: headers() }).json();
    const vod = (Array.isArray(j?.list) && j.list[0]) || j?.data || j?.result || j || {};
    const info = mapListItem(vod);
    info.intro = vod?.vod_content || vod?.content || vod?.desc || vod?.description || '';
    const groups = buildGroupsFromVod(vod);
    return jsonify({ info: { title: info.title, cover: info.cover, intro: info.intro }, groups });
  } catch (e) {
    $print('rbotv:getTracks_error', String(e));
    return jsonify({ info: { title: '', cover: '', intro: '' }, groups: [] });
  }
}

// 播放
async function getPlayinfo(ext) {
  try {
    const url = ext?.id || ext?.raw || '';
    $print('rbotv:getPlayinfo', url);
    return jsonify({ url, headers: headers() });
  } catch (e) {
    $print('rbotv:getPlayinfo_error', String(e));
    return jsonify({ url: '', headers: headers() });
  }
}

// 搜索
async function search(ext) {
  const kw = (ext?.keyword || '').trim();
  if (!kw) return jsonify([]);
  try {
    const api = await ensureActive();
    const url = api.search(kw, 1);
    $print('rbotv:search', url);
    const j = await request(url, { headers: headers() }).json();
    const arr = Array.isArray(j?.list) ? j.list
              : Array.isArray(j?.data?.list) ? j.data.list
              : (Array.isArray(j?.data) ? j.data : []);
    return jsonify(arr.map(mapListItem));
  } catch (e) {
    $print('rbotv:search_error', String(e));
    return jsonify([]);
  }
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };