// rbotv_app.js —— 离线优先 + 时间盒探测（async + jsonify + argsify；绝不停留转圈）

/* ====== 开关：先离线运行，确认稳定后你再改 true 测真接口 ====== */
const NET_ENABLED = true;        // 改成 true 才会尝试联网探测
const NET_TIMEOUT_MS = 1200;      // 每个探测的硬超时（毫秒）

/* ================== 基础工具 ================== */

const __jsonify = (typeof jsonify === 'function')
  ? jsonify
  : (o => { try { return JSON.stringify(o); } catch(e){ return '{}'; } });

function __argsify(x){
  try{
    if (typeof argsify === 'function') return argsify(x);
    if (!x) return {};
    if (typeof x === 'object') return x;
    if (typeof x === 'string') {
      try { return JSON.parse(x); } catch(e){}
      const hash = x.split('#@').pop();
      if (hash && (hash.trim().startsWith('{') || hash.trim().startsWith('%7B'))){
        try { return JSON.parse(decodeURIComponent(hash)); }catch(e){}
      }
    }
  }catch(e){}
  return {};
}

function __H(extra){
  const base = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json,text/plain,*/*'
  };
  if (extra) for (const k in extra) base[k] = extra[k];
  return base;
}

function __timeout(ms){
  return new Promise(resolve => setTimeout(() => resolve({ __timeout__: true }), ms));
}

async function __get(u){
  if (!NET_ENABLED) return '';
  try{
    if (typeof $fetch !== 'undefined' && $fetch && $fetch.get){
      const r = await Promise.race([
        $fetch.get(u, { headers: __H(), timeout: NET_TIMEOUT_MS }),
        __timeout(NET_TIMEOUT_MS)
      ]);
      if (r && r.__timeout__) return '';
      return (r && (r.data || r.content || r.body)) || '';
    }
    if (typeof fetch === 'function'){
      const r = await Promise.race([
        fetch(u, { headers: __H() }),
        __timeout(NET_TIMEOUT_MS)
      ]);
      if (!r || r.__timeout__) return '';
      return await r.text();
    }
  }catch(e){}
  return '';
}

async function __getJSON(u){
  const txt = await __get(u);
  if (!txt) return null;
  try{ return JSON.parse(txt); }catch(e){}
  return null;
}

async function __probeJSON(bases, rels){
  if (!NET_ENABLED) return { base: '', url: '', json: null, tried: [] };
  const tried = [];
  for (let i=0;i<bases.length;i++){
    for (let k=0;k<rels.length;k++){
      const u = bases[i] + rels[k];
      tried.push(u);
      const j = await __getJSON(u);
      if (j && (Array.isArray(j) || typeof j === 'object')){
        return { base: bases[i], url: u, json: j, tried };
      }
    }
  }
  return { base: '', url: '', json: null, tried };
}

function __pick(a){ return Array.isArray(a) ? a : []; }
function __normVodItem(it){
  return {
    vod_id: String(it.id || it.vod_id || it.vid || it.ids || it.ID || it.video_id || ''),
    vod_name: it.name || it.vod_name || it.title || it.vod_title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || it.img || '',
    vod_remarks: it.note || it.remarks || it.vod_remarks || it.brief || ''
  };
}

/* ================== getConfig（离线优先 + 限时探测） ================== */
async function getConfig(){
  const BASES = ['http://v.rbotv.cn', 'https://v.rbotv.cn'];
  const navRel = [
    '/xgapp.php/v3/nav',
    '/xgapp.php/v2/nav',
    '/api.php/app/nav',
    '/api.php/app/index/nav',
    '/api.php/provide/vod/?ac=class',
    '/macapi.php/provide/vod/?ac=class',
    '/app/index.php/v1/nav'
  ];

  let tabs = [];
  let base = BASES[0];

  // 仅当 NET_ENABLED=true 时尝试联网，且时间盒保护
  if (NET_ENABLED){
    try{
      const hit = await __probeJSON(BASES, navRel);
      if (hit.json){
        base = hit.base || base;
        const group = hit.json['class'] || hit.json['data'] || hit.json['list'] || [];
        const arr = __pick(group);
        for (let i=0;i<arr.length;i++){
          const c = arr[i];
          const id   = c.type_id || c.typeid || c.id || c.tid;
          const name = c.type_name || c.typename || c.name || c.title;
          if (id && name){
            tabs.push({ name: String(name), ext: { catId: String(id), page: 1 } });
          }
        }
      }
    }catch(e){}
  }

  // 离线兜底分类（确保 UI 稳定）
  if (!tabs.length){
    tabs = [
      { name: '电影', ext: { catId: '1', page: 1 } },
      { name: '剧集', ext: { catId: '2', page: 1 } },
      { name: '综艺', ext: { catId: '3', page: 1 } },
      { name: '动漫', ext: { catId: '4', page: 1 } }
    ];
  }

  try{ globalThis.__RBOTV_BASE__ = base; }catch(e){}

  return __jsonify({
    ver: 20250905,
    title: '热播APP（离线优先）',
    site: base,
    tabs
  });
}

/* ================== getCards（离线优先 + 限时探测） ================== */
async function getCards(ext){
  ext = __argsify(ext);
  const catId = (ext && ext.catId) ? String(ext.catId) : '1';
  const page  = (ext && ext.page)  ? (ext.page|0) : 1;

  const BASE = (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn';
  const listRel = [
    '/xgapp.php/v3/video?tid=' + catId + '&pg=' + page,
    '/xgapp.php/v2/video/type?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?type_id=' + catId + '&page=' + page,
    '/api.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page
  ];

  let out = [];

  if (NET_ENABLED){
    try{
      const hit = await __probeJSON([BASE], listRel);
      if (hit.json){
        const arr = hit.json['list'] || hit.json['data'] || hit.json['vod'] || hit.json['items'] || [];
        const a = __pick(arr);
        for (let i=0;i<a.length;i++){
          const o = __normVodItem(a[i]);
          if (o.vod_id && o.vod_name){
            out.push({
              vod_id: o.vod_id,
              vod_name: o.vod_name,
              vod_pic: o.vod_pic,
              vod_remarks: o.vod_remarks,
              ext: { id: o.vod_id }
            });
          }
        }
      }
    }catch(e){}
  }

  // 离线兜底（保证有条目，不转圈）
  if (!out.length){
    out = [
      {
        vod_id: 'demo_1',
        vod_name: '演示影片（无网络也能展示）',
        vod_pic: '',
        vod_remarks: '本地演示',
        ext: { id: 'demo_1' }
      },
      {
        vod_id: 'demo_2',
        vod_name: '演示影片2',
        vod_pic: '',
        vod_remarks: '本地演示',
        ext: { id: 'demo_2' }
      }
    ];
  }

  return __jsonify({ list: out });
}

/* ================== getTracks（先离线演示，确认后再接详情） ================== */
async function getTracks(ext){
  ext = __argsify(ext);
  // 此处先返回演示线路，等你确认“分类/列表稳定显示”后我再接详情接口
  return __jsonify({
    list: [{
      title: '默认线路',
      tracks: [
        { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } },
        { name: '第2集', pan: '', ext: { raw: 'https://example.com/video2.m3u8' } }
      ]
    }]
  });
}

/* ================== getPlayinfo（演示直链） ================== */
async function getPlayinfo(ext){
  ext = __argsify(ext);
  const u = (ext && ext.raw) ? String(ext.raw) : '';
  return __jsonify({
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }]
  });
}

/* ================== search（先返回空） ================== */
async function search(ext){
  ext = __argsify(ext);
  return __jsonify({ list: [] });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };
