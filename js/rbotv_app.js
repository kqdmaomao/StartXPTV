// rbotv_app.js —— XPTV csp_xiaohys 全量接入 + 可视化诊断（async + jsonify + argsify + 时间盒）
// 用法重点：在订阅里的 ext 传 {"url":"http://v.rbotv.cn"} 或其它站点根地址，脚本优先按 ext.url 探测
// 当探测失败时，会在列表返回一张“诊断卡片”，把尝试过的接口路径展示到 UI 里，便于无需日志也能定位

const NET_ENABLED   = true;    // 联网开关（保持 true：真接口 + 兜底，不会卡圈）
const NET_TIMEOUT_MS = 1500;   // 每个请求硬超时（ms）

/* ================== 工具 ================== */
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
function __timeout(ms){ return new Promise(r => setTimeout(()=>r({__timeout__:true}), ms)); }

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
      const r = await Promise.race([ fetch(u, { headers: __H() }), __timeout(NET_TIMEOUT_MS) ]);
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
  if (!NET_ENABLED) return { base:'', url:'', json:null, tried: [] };
  const tried = [];
  for (let i=0;i<bases.length;i++){
    for (let k=0;k<rels.length;k++){
      const u = bases[i].replace(/\/+$/,'') + rels[k];
      tried.push(u);
      const j = await __getJSON(u);
      if (j && (Array.isArray(j) || typeof j === 'object')){
        return { base: bases[i], url: u, json: j, tried };
      }
    }
  }
  return { base:'', url:'', json:null, tried };
}

const __pick = a => Array.isArray(a) ? a : [];
function __normVodItem(it){
  return {
    vod_id: String(it.id || it.vod_id || it.vid || it.ids || it.ID || it.video_id || ''),
    vod_name: it.name || it.vod_name || it.title || it.vod_title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || it.img || '',
    vod_remarks: it.note || it.remarks || it.vod_remarks || it.brief || ''
  };
}

/* ================== 1) getConfig：分类（支持 ext.url） ================== */
async function getConfig(){
  // 默认候选（仅当你不传 ext.url 时才会用到）
  let bases = ['http://v.rbotv.cn', 'https://v.rbotv.cn'];

  // 如果调用方通过 ext 传了 url，这里优先使用
  // 由于 getConfig 没有 ext 入参（引擎习惯），我们允许之前 getCards 写入全局 __RBOTV_BASE__，或在订阅就写死 site
  if (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__){
    bases = [String(globalThis.__RBOTV_BASE__)];
  }

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
  let base = bases[0];

  if (NET_ENABLED){
    try{
      const hit = await __probeJSON(bases, navRel);
      if (hit.json){
        base = hit.base || base;
        const group = hit.json['class'] || hit.json['data'] || hit.json['list'] || [];
        for (const c of __pick(group)){
          const id   = c.type_id || c.typeid || c.id || c.tid;
          const name = c.type_name || c.typename || c.name || c.title;
          if (id && name) tabs.push({ name: String(name), ext: { catId: String(id), page: 1 } });
        }
      }
    }catch(e){}
  }

  if (!tabs.length){
    tabs = [
      { name: '电影', ext: { catId: '1', page: 1 } },
      { name: '剧集', ext: { catId: '2', page: 1 } },
      { name: '综艺', ext: { catId: '3', page: 1 } },
      { name: '动漫', ext: { catId: '4', page: 1 } }
    ];
  }

  try{ globalThis.__RBOTV_BASE__ = base; }catch(e){}

  return __jsonify({ ver: 20250905, title: '热播APP', site: base, tabs });
}

/* ================== 2) getCards：列表（支持 ext.url + 可视化诊断） ================== */
async function getCards(ext){
  ext = __argsify(ext);

  // 读取你传进来的 ext.url（强烈建议在订阅里传）
  // 例： "ext": "https://.../rbotv_app.js#@{\"url\":\"http://v.rbotv.cn\"}"
  let BASE = (ext && ext.url) ? String(ext.url) : '';
  if (!BASE){
    // 次选：用上一步 getConfig 写下的全局
    BASE = (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : '';
  }
  if (!BASE) BASE = 'http://v.rbotv.cn';

  try{ globalThis.__RBOTV_BASE__ = BASE; }catch(e){}

  const catId = (ext && ext.catId) ? String(ext.catId) : '1';
  const page  = (ext && ext.page)  ? (ext.page|0) : 1;

  const listRel = [
    // xgapp 常见
    '/xgapp.php/v3/video?tid=' + catId + '&pg=' + page,
    '/xgapp.php/v2/video/type?tid=' + catId + '&pg=' + page,
    // app 常见
    '/api.php/app/video?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?type_id=' + catId + '&page=' + page,
    // provide
    '/api.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page,
    // 其它常见
    '/app/index.php/v1/vod/getLists?tid=' + catId + '&page=' + page,
    '/app/index.php/v1/vod?type=' + catId + '&page=' + page
  ];

  let out = [];
  let triedUrls = [];

  if (NET_ENABLED){
    try{
      const hit = await __probeJSON([BASE], listRel);
      triedUrls = hit.tried || [];
      if (hit.json){
        const arr = hit.json['list'] || hit.json['data'] || hit.json['vod'] || hit.json['items'] || [];
        for (const it of __pick(arr)){
          const o = __normVodItem(it);
          if (o.vod_id && o.vod_name){
            out.push({
              vod_id: o.vod_id,
              vod_name: o.vod_name,
              vod_pic: o.vod_pic,
              vod_remarks: o.vod_remarks,
              ext: { id: o.vod_id, url: BASE }   // 回传 getTracks，同时把 base 带上
            });
          }
        }
      }
    }catch(e){}
  }

  // 可视化诊断：若没有真数据，返演示 + 诊断卡片（把尝试过的接口前三条写进备注）
  if (!out.length){
    const tip = triedUrls.length
      ? ('探测失败(取前三)：' + triedUrls.slice(0,3).map(u=>u.replace(BASE,'')).join(' | '))
      : '未联网或无可用接口';
    out = [
      { vod_id: 'demo_1', vod_name: '演示影片（兜底）', vod_pic: '', vod_remarks: '本地演示', ext: { id: 'demo_1', url: BASE } },
      { vod_id: 'diag',   vod_name: '【诊断提示】',      vod_pic: '', vod_remarks: tip,         ext: { id: 'diag',   url: BASE } }
    ];
  }

  return __jsonify({ list: out });
}

/* ================== 3) getTracks：详情/分集（支持 ext.url + 诊断） ================== */
async function getTracks(ext){
  ext = __argsify(ext);
  const vid  = (ext && (ext.id || ext.vod_id)) ? String(ext.id || ext.vod_id) : '';
  const BASE = (ext && ext.url) ? String(ext.url) :
               ((typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn');

  if (!NET_ENABLED || !vid || vid === 'demo_1' || vid === 'diag'){
    // 离线兜底或诊断卡片不请求网络
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

  const detailRel = [
    '/xgapp.php/v3/detail?ids=' + vid,
    '/xgapp.php/v3/video_detail?id=' + vid,
    '/api.php/app/video_detail?id=' + vid,
    '/api.php/provide/vod/?ac=detail&ids=' + vid,
    '/macapi.php/provide/vod/?ac=detail&ids=' + vid,
    '/app/index.php/v1/vod/detail?id=' + vid
  ];

  let tracksGroups = [];
  let triedUrls = [];

  try{
    const hit = await __probeJSON([BASE], detailRel);
    triedUrls = hit.tried || [];
    const J = hit.json;

    if (J){
      let item = null;
      if (Array.isArray(J.list) && J.list.length > 0) item = J.list[0];
      else if (J.data && Array.isArray(J.data) && J.data.length > 0) item = J.data[0];
      else if (J.data && typeof J.data === 'object') item = J.data;

      if (item){
        // 1) from+url 组合
        let playFrom = (item.vod_play_from || item.from || item.play_from || '').split('$$').filter(Boolean);
        let playUrl  = (item.vod_play_url  || item.url  || item.play_url  || '').split('$$').filter(Boolean);

        if (playUrl.length && playFrom.length && playUrl.length === playFrom.length){
          for (let i=0;i<playFrom.length;i++){
            const tname = playFrom[i] || ('线路' + (i+1));
            const block = playUrl[i] || '';
            const parts = block.split('#').filter(Boolean);
            const one = [];
            for (let j=0;j<parts.length;j++){
              const seg = parts[j];
              const idx = seg.indexOf('$');
              if (idx > -1){
                const n = seg.slice(0, idx).trim() || ('第' + (j+1) + '集');
                const u = seg.slice(idx+1).trim();
                if (u){ one.push({ name: n, pan: '', ext: { raw: u } }); }
              }else{
                const u = seg.trim();
                if (u){ one.push({ name: '第' + (j+1) + '集', pan: '', ext: { raw: u } }); }
              }
            }
            if (one.length){ tracksGroups.push({ title: tname, tracks: one }); }
          }
        }

        // 2) 列表结构
        if (!tracksGroups.length && item.play && Array.isArray(item.play)){
          for (let k=0;k<item.play.length;k++){
            const p = item.play[k];
            const tname = p.name || ('线路' + (k+1));
            const urls  = __pick(p.urls);
            const one = [];
            for (let j=0;j<urls.length;j++){
              const uo = urls[j];
              const n = uo.n || uo.name || ('第' + (j+1) + '集');
              const u = uo.u || uo.url  || '';
              if (u) one.push({ name: n, pan: '', ext: { raw: u } });
            }
            if (one.length){ tracksGroups.push({ title: tname, tracks: one }); }
          }
        }

        if (!tracksGroups.length){
          const maybe = item.playUrl || item.url || item.vod_url || '';
          if (maybe){
            tracksGroups.push({ title: '默认线路', tracks: [{ name: '播放', pan: '', ext: { raw: String(maybe) } }] });
          }
        }
      }
    }
  }catch(e){}

  if (!tracksGroups.length){
    const tip = triedUrls.length
      ? ('详情探测失败(取前三)：' + triedUrls.slice(0,3).map(u=>u.replace(BASE,'')).join(' | '))
      : '未联网或无可用详情接口';
    tracksGroups = [{
      title: '诊断',
      tracks: [{ name: tip, pan: '', ext: { raw: '' } }]
    }];
  }

  return __jsonify({ list: tracksGroups });
}

/* ================== 4) getPlayinfo：直链/嗅探 ================== */
async function getPlayinfo(ext){
  ext = __argsify(ext);
  const u = (ext && ext.raw) ? String(ext.raw) : '';
  const isDirect = /\.(m3u8|mp4|m4a)(\?|$)/i.test(u);
  return __jsonify({
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }],
    // isDirect 可留作你自己判断用；壳一般会自行嗅探
    direct: isDirect ? 1 : 0
  });
}

/* ================== 5) search：多路径探测（支持 ext.url） ================== */
async function search(ext){
  ext = __argsify(ext);
  const wd = (ext && (ext.wd || ext.key || ext.keyword)) ? String(ext.wd || ext.key || ext.keyword) : '';
  const page = (ext && ext.page) ? (ext.page|0) : 1;

  if (!NET_ENABLED || !wd) return __jsonify({ list: [] });

  const BASE = (ext && ext.url) ? String(ext.url) :
               ((typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn');
  const q = encodeURIComponent(wd);

  const searchRel = [
    '/xgapp.php/v3/search?text=' + q + '&pg=' + page,
    '/api.php/app/search?text=' + q + '&pg=' + page,
    '/api.php/provide/vod/?ac=videolist&wd=' + q + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&wd=' + q + '&pg=' + page,
    '/app/index.php/v1/vod/search?wd=' + q + '&page=' + page
  ];

  let out = [];
  try{
    const hit = await __probeJSON([BASE], searchRel);
    if (hit.json){
      const arr = hit.json['list'] || hit.json['data'] || hit.json['vod'] || hit.json['items'] || [];
      for (const it of __pick(arr)){
        const o = __normVodItem(it);
        if (o.vod_id && o.vod_name){
          out.push({
            vod_id: o.vod_id,
            vod_name: o.vod_name,
            vod_pic: o.vod_pic,
            vod_remarks: o.vod_remarks,
            ext: { id: o.vod_id, url: BASE }
          });
        }
      }
    }
  }catch(e){}

  return __jsonify({ list: out });
}

/* ================== 导出 ================== */
module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };
