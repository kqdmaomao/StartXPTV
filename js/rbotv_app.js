// rbotv_app.js — XPTV 热播APP适配器（自动探测 + 写死域名 v.rbotv.cn）
// 适配 XPTV 五入口：getConfig / getCards / getTracks / getPlayinfo / search
// 日志查看：浏览器访问 http://设备IP:8110/log

/** ======================= 工具函数 ======================= */
function H(extra = {}) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    ...extra
  };
}
async function GET(u, hd = {}) {
  $print(`[GET] ${u}`);
  try {
    const r = await $fetch.get(u, { headers: H(hd), timeout: 10000 });
    $print(`[GET] done status=${r?.status} len=${(r?.data || '').length}`);
    return r?.data || '';
  } catch (e) {
    $print(`[GET] err: ${e}`);
    return '';
  }
}
function jparse(t) { try { return JSON.parse(t); } catch { return null; } }
function pick(arr) { return Array.isArray(arr) ? arr : []; }
function abshost(u) { const m = String(u||'').match(/^https?:\/\/[^/]+/i); return m ? m[0] : ''; }
function hasM3U8(s){ return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(s||''); }
function hasMP4 (s){ return /https?:\/\/[^\s'"<>]+\.mp4(?:[^\s'"<>]*)/i.test(s||''); }
function splitPlayList(raw){
  const out = []; const lines = String(raw||'').split('#').filter(Boolean);
  for (const seg of lines) {
    const m = seg.split('$');
    if (m.length >= 2) out.push({ name: m[0].trim(), url: m.slice(1).join('$').trim() });
    else out.push({ name: '', url: seg.trim() });
  }
  return out.filter(it => it.url);
}
function normVodItem(it){
  return {
    vod_id: (it.id || it.vod_id || it.vid || it.ids || it.ID || it.video_id || '').toString(),
    vod_name: it.name || it.vod_name || it.title || it.vod_title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || it.img || '',
    vod_remarks: it.note || it.remarks || it.vod_remarks || it.brief || ''
  };
}

/** ======================= 基地址 & 探测 ======================= */
// 🔴 写死域名，并同时尝试 http/https
function ensureBases(){
  const host = 'v.rbotv.cn';
  return [`http://${host}`, `https://${host}`];
}

// 通用探测器：给一批“相对路径”，按 base × relPaths 全量轮询
async function probeJSONMulti(bases, relPaths){
  const tried = [];
  for (const base of bases){
    for (const rel of relPaths){
      const u = `${base}${rel}`;
      tried.push(u);
      const txt = await GET(u);
      const j = jparse(txt);
      if (j && (Array.isArray(j) || typeof j === 'object')){
        $print(`[probe] ok -> ${u}`);
        return { url: u, base, json: j };
      }
    }
  }
  $print(`[probe] all failed, tried:\n${tried.join('\n')}`);
  return { url: '', base: '', json: null };
}

/** ======================= 入口实现 ======================= */
async function getConfig(){
  const BASES = ensureBases();
  $print(`[getConfig] bases=${BASES.join(', ')}`);

  // 常见“导航/分类”接口（相对路径列表）
  const navRel = [
    '/xgapp.php/v3/nav',
    '/xgapp.php/v2/nav',
    '/api.php/app/nav',
    '/api.php/app/index/nav',
    '/api.php/provide/vod/?ac=class',
    '/macapi.php/provide/vod/?ac=class',
    '/app/index.php/v1/nav'
  ];

  const { base, json } = await probeJSONMulti(BASES, navRel);

  let tabs = [];
  if (json){
    const group = json.class || json.data || json.list || [];
    pick(group).forEach(c=>{
      const id   = c.type_id || c.typeid || c.id || c.tid;
      const name = c.type_name || c.typename || c.name || c.title;
      if (id && name) tabs.push({ name, ext: { catId: String(id), page: 1 } });
    });
  }
  if (!tabs.length){
    tabs = [
      { name: '电影', ext: { catId: '1', page: 1 } },
      { name: '剧集', ext: { catId: '2', page: 1 } },
      { name: '综艺', ext: { catId: '3', page: 1 } },
      { name: '动漫', ext: { catId: '4', page: 1 } }
    ];
  }

  // 记住命中的 base，后续列表/详情优先走同一个
  globalThis.__RBOTV_BASE__ = base || BASES[0];

  return jsonify({
    ver: 20250905,
    title: '热播APP（自动探测）',
    site: globalThis.__RBOTV_BASE__,
    tabs
  });
}

async function getCards(ext){
  const BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  const { catId='1', page=1 } = argsify(ext);
  $print(`[getCards] base=${BASE} catId=${catId} page=${page}`);

  const listRel = [
    `/xgapp.php/v3/video?tid=${catId}&pg=${page}`,
    `/xgapp.php/v2/video/type?tid=${catId}&pg=${page}`,
    `/api.php/app/video?tid=${catId}&pg=${page}`,
    `/api.php/app/video?type_id=${catId}&page=${page}`,
    `/api.php/provide/vod/?ac=videolist&t=${catId}&pg=${page}`,
    `/macapi.php/provide/vod/?ac=videolist&t=${catId}&pg=${page}`
  ];
  const { json } = await probeJSONMulti([BASE], listRel);

  const out = [];
  if (json){
    const arr = json.list || json.data || json.vod || json.items || [];
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if (o.vod_id && o.vod_name){
        out.push({ ...o, ext: { id: o.vod_id } });
      }
    });
  }
  $print(`[getCards] found=${out.length}`);
  return jsonify({ list: out });
}

async function getTracks(ext){
  const BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  const { id } = argsify(ext);
  if (!id) { $utils.toastError('缺少ID'); return jsonify({ list: [] }); }
  $print(`[getTracks] base=${BASE} id=${id}`);

  const detailRel = [
    `/xgapp.php/v3/video_detail?id=${id}`,
    `/xgapp.php/v2/video/detail?id=${id}`,
    `/api.php/app/video_detail?id=${id}`,
    `/api.php/app/detail?id=${id}`,
    `/api.php/provide/vod/?ac=detail&ids=${id}`,
    `/macapi.php/provide/vod/?ac=detail&ids=${id}`
  ];
  const { json } = await probeJSONMulti([BASE], detailRel);
  if (!json) return jsonify({ list: [] });

  // 兼容多种返回包装
  let info = (json.data && (Array.isArray(json.data) ? json.data[0] : json.data))
          || (json.video)
          || (json.vod)
          || (json.list && json.list[0])
          || {};
  const playAll = info.playUrl || info.playurl || info.play_url || info.vod_play_url || '';
  if (!playAll) {
    $print('[getTracks] no play list in detail');
    return jsonify({ list: [] });
  }

  const groups = String(playAll).split('$$$').filter(Boolean).map((g, idx) => {
    const tracks = splitPlayList(g).map((t, i) => ({
      name: t.name || `P${i+1}`,
      pan: '',
      ext: { id, raw: t.url }
    }));
    return { title: `线路${idx+1}（${tracks.length}）`, tracks };
  });

  $print(`[getTracks] groups=${groups.length}`);
  return jsonify({ list: groups });
}

async function getPlayinfo(ext){
  const BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  const raw = (argsify(ext).raw || '').trim();
  $print(`[getPlayinfo] base=${BASE} raw=${raw}`);
  if (!raw) return jsonify({ urls: [], headers: [H()] });

  // 直链优先
  if (hasM3U8(raw) || hasMP4(raw)) {
    return jsonify({ urls: [raw], headers: [H({ Referer: BASE, Origin: abshost(BASE) })] });
  }
  // 一些解析器 / 二级跳转
  if (/api\.php\?/.test(raw) || /parse|jiexi|jx=/.test(raw)) {
    return jsonify({ urls: [raw], headers: [H({ Referer: BASE, Origin: abshost(BASE) })] });
  }
  // 兜底嗅探
  $print('[getPlayinfo] fallback sniff');
  return jsonify({ urls: [raw], headers: [H({ Referer: BASE, Origin: abshost(BASE) })] });
}

async function search(ext){
  const BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  let { wd = '', page = 1 } = argsify(ext);
  wd = (wd || '').trim();
  if (!wd) return jsonify({ list: [] });
  $print(`[search] base=${BASE} wd=${wd} page=${page}`);

  const searchRel = [
    `/xgapp.php/v3/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `/xgapp.php/v2/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `/api.php/app/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `/api.php/provide/vod/?ac=videolist&wd=${encodeURIComponent(wd)}&pg=${page}`,
    `/macapi.php/provide/vod/?ac=videolist&wd=${encodeURIComponent(wd)}&pg=${page}`
  ];
  const { json } = await probeJSONMulti([BASE], searchRel);

  const out = [];
  if (json){
    const arr = json.list || json.data || json.vod || json.items || [];
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if (o.vod_id && o.vod_name){
        out.push({ ...o, ext: { id: o.vod_id } });
      }
    });
  }
  $print(`[search] results=${out.length}`);
  return jsonify({ list: out });
}

/** ======================= 导出 ======================= */
module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };