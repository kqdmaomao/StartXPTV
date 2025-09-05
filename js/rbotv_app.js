// rbotv_app.js — XPTV 通用 App 源适配器（支持 xgapp.php / api.php/app / provide/vod 等常见协议）
// 用法：ext 传入 { url: "http://v.rbotv.cn" }

const cheerio = createCheerio();

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
    $print(`[GET] done status=${r?.status} len=${(r?.data||'').length}`);
    return r?.data || '';
  } catch(e){ $print(`[GET] err: ${e}`); return ''; }
}

function jparse(t){ try{ return JSON.parse(t); }catch{ return null; } }
function pick(arr){ return Array.isArray(arr) ? arr : []; }
function abshost(u){ const m=u.match(/^https?:\/\/[^/]+/i); return m?m[0]:''; }
function hasM3U8(s){ return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(s||''); }
function hasMP4(s){ return /https?:\/\/[^\s'"<>]+\.mp4(?:[^\s'"<>]*)/i.test(s||''); }
function splitLines(s){ return String(s||'').split(/[\r\n]+/).filter(Boolean); }
function splitPlayList(raw){
  // 支持 1) “第1集$http://xx.m3u8#第2集$...”  2) “http://xx.m3u8#http://yy.m3u8”
  const out=[]; const lines = String(raw||'').split('#').filter(Boolean);
  for(const seg of lines){
    const m = seg.split('$');
    if(m.length>=2){ out.push({name: m[0].trim(), url: m.slice(1).join('$').trim()}); }
    else { out.push({name: '', url: seg.trim()}); }
  }
  return out.filter(it=>it.url);
}

function normVodItem(it){
  return {
    vod_id: (it.id || it.vid || it.vod_id || it.ids || it.ID || it.video_id || it.url || '').toString(),
    vod_name: it.name || it.vod_name || it.title || it.vod_title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || it.img || '',
    vod_remarks: it.note || it.remarks || it.vod_remarks || it.brief || ''
  };
}

function find(arr, keys){ for(const k of keys){ if(k in arr) return arr[k]; } return undefined; }
function findStr(obj, keys){ for(const k of keys){ if(typeof obj[k]==='string' && obj[k]) return obj[k]; } return ''; }

function ensureBase(ext){
  let base = (ext && (ext.base || ext.url || ext.site)) || '';
  if(base.endsWith('/')) base = base.slice(0,-1);
  return base;
}

async function probeJSON(urls){
  for(const u of urls){
    const txt = await GET(u);
    const j = jparse(txt);
    if(j && (Array.isArray(j) || typeof j === 'object')) {
      $print(`[probe] ok -> ${u}`);
      return { url: u, json: j };
    }
  }
  $print(`[probe] all failed`);
  return { url:'', json:null };
}

async function getConfig(ext){
  ext = argsify(ext);
  const BASE = ensureBase(ext);
  if(!BASE){ $utils.toastError('缺少 ext.url'); return jsonify({}); }
  $print(`[getConfig] base=${BASE}`);

  // 常见导航接口探测
  const navCandidates = [
    `${BASE}/xgapp.php/v3/nav`,
    `${BASE}/xgapp.php/v2/nav`,
    `${BASE}/api.php/app/nav`,
    `${BASE}/api.php/provide/vod/?ac=class`,
    `${BASE}/api.php/app/index/nav`,
  ];
  const {url:navUrl, json:navJson} = await probeJSON(navCandidates);

  let tabs = [];
  // 解析分类
  if(navJson){
    let classes = [];
    // 兼容： {class: [{type_id, type_name}...]} / data / list
    const group = find(navJson, ['class','data','list','type','types']) || [];
    pick(group).forEach(c=>{
      const id = c.type_id || c.typeid || c.tid || c.id || c.cid;
      const name = c.type_name || c.type || c.typename || c.name || c.title;
      if(id && name) classes.push({id, name});
    });
    // 如果没有拿到，尝试另一种：数组直接是分类
    if(!classes.length && Array.isArray(navJson)){
      navJson.forEach(c=>{
        const id = c.type_id || c.tid || c.id;
        const name = c.type_name || c.name || c.title;
        if(id && name) classes.push({id, name});
      });
    }
    if(!classes.length){
      // 兜底给出常用分类
      classes = [{id:1,name:'电影'},{id:2,name:'剧集'},{id:3,name:'综艺'},{id:4,name:'动漫'}];
    }
    tabs = classes.map(c => ({ name: c.name, ext: { catId: String(c.id), page: 1 } }));
  } else {
    // 完全兜底
    tabs = [
      { name:'电影', ext:{catId:'1', page:1} },
      { name:'剧集', ext:{catId:'2', page:1} },
      { name:'综艺', ext:{catId:'3', page:1} },
      { name:'动漫', ext:{catId:'4', page:1} },
      { name:'搜索', ext:{catId:'search', page:1} },
    ];
  }

  return jsonify({
    ver: 20250905,
    title: '热播APP（适配）',
    site: BASE,
    tabs
  });
}

async function getCards(ext){
  ext = argsify(ext);
  const BASE = ensureBase(ext);
  const { catId = '1', page = 1 } = ext;
  $print(`[getCards] base=${BASE} catId=${catId} page=${page}`);

  // 常见列表接口
  const listCandidates = [
    `${BASE}/xgapp.php/v3/video?tid=${catId}&pg=${page}`,
    `${BASE}/xgapp.php/v2/video/type?tid=${catId}&pg=${page}`,
    `${BASE}/api.php/app/video?tid=${catId}&pg=${page}`,
    `${BASE}/api.php/app/video?type_id=${catId}&page=${page}`,
    `${BASE}/api.php/provide/vod/?ac=videolist&t=${catId}&pg=${page}`,
  ];

  const { json } = await probeJSON(listCandidates);
  const out = [];

  if(json){
    // 兼容 data/list/videos/vod
    const arr = find(json, ['list','data','videos','vod','items']) || json;
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if(o.vod_id && o.vod_name){
        // 详情兼容字段（给 getTracks 用）
        const brief = item.content || item.vod_content || '';
        out.push({
          ...o,
          vod_content: brief,
          ext: { id: o.vod_id }
        });
      }
    });
  }

  $print(`[getCards] found=${out.length}`);
  return jsonify({ list: out });
}

async function getTracks(ext){
  ext = argsify(ext);
  const BASE = ensureBase(ext);
  const { id } = ext;
  if(!id){ $utils.toastError('缺少ID'); return jsonify({list:[]}); }
  $print(`[getTracks] base=${BASE} id=${id}`);

  const detailCandidates = [
    `${BASE}/xgapp.php/v3/video_detail?id=${id}`,
    `${BASE}/xgapp.php/v2/video/detail?id=${id}`,
    `${BASE}/api.php/app/video_detail?id=${id}`,
    `${BASE}/api.php/app/detail?id=${id}`,
    `${BASE}/api.php/provide/vod/?ac=detail&ids=${id}`,
  ];
  const { json } = await probeJSON(detailCandidates);
  if(!json){ return jsonify({ list: [] }); }

  // 兼容 detail 返回：可能是 {data:{...}} / {list:[{...}]} / {video:{...}}
  let info = find(json, ['data','video','vod']) || null;
  if(Array.isArray(info)) info = info[0];
  if(!info && Array.isArray(json.list)) info = json.list[0];

  const title = findStr(info||{}, ['name','vod_name','title']);
  // 可能多线路：playUrl/playurl/vod_play_url，且是“线路分割$$$，集用#”
  const playAll = findStr(info||{}, ['playUrl','playurl','play_url','vod_play_url','playurl1','playurl2','playurl3']);
  if(!playAll){
    $print(`[getTracks] no play urls in detail`);
    return jsonify({ list: [] });
  }

  const groupsRaw = String(playAll).split('$$$').filter(Boolean);
  const groups = [];
  groupsRaw.forEach((g, idx)=>{
    const tracks = splitPlayList(g).map((t,i)=>({
      name: t.name || `P${i+1}`,
      pan: '',
      ext: { id, raw: t.url }
    }));
    if(tracks.length){
      groups.push({ title: `线路${idx+1}（${tracks.length}）`, tracks });
    }
  });

  $print(`[getTracks] groups=${groups.length}`);
  return jsonify({ list: groups });
}

async function getPlayinfo(ext){
  ext = argsify(ext);
  const BASE = ensureBase(ext);
  const raw = ext?.raw || ext?.url || '';
  $print(`[playinfo] base=${BASE} raw=${raw}`);

  if(!raw){ return jsonify({ urls: [], headers: [H()] }); }

  // 直链优先
  if(hasM3U8(raw) || hasMP4(raw)){
    return jsonify({ urls: [raw], headers: [H({Referer: BASE, Origin: abshost(BASE)})] });
  }

  // 有些源是二次解析器（api.php?url=...）
  if(/api\.php\?/.test(raw) || /parse|jiexi|jx=/.test(raw)){
    return jsonify({ urls: [raw], headers: [H({Referer: BASE, Origin: abshost(BASE)})] });
  }

  // 兜底：交给嗅探
  $print(`[playinfo] fallback sniff`);
  return jsonify({ urls: [raw], headers: [H({Referer: BASE, Origin: abshost(BASE)})] });
}

async function search(ext){
  ext = argsify(ext);
  const BASE = ensureBase(ext);
  let { wd = '', page = 1 } = ext;
  wd = (wd||'').trim();
  if(!wd){ return jsonify({ list: [] }); }
  $print(`[search] base=${BASE} wd=${wd} page=${page}`);

  const searchCandidates = [
    `${BASE}/xgapp.php/v3/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `${BASE}/xgapp.php/v2/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `${BASE}/api.php/app/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `${BASE}/api.php/provide/vod/?ac=videolist&wd=${encodeURIComponent(wd)}&pg=${page}`,
  ];
  const { json } = await probeJSON(searchCandidates);

  const out=[];
  if(json){
    const arr = find(json, ['list','data','videos','vod','items']) || json;
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if(o.vod_id && o.vod_name){
        out.push({ ...o, ext:{ id: o.vod_id } });
      }
    });
  }
  $print(`[search] results=${out.length}`);
  return jsonify({ list: out });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };