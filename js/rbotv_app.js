// rbotv_app.js —— XPTV csp_xiaohys 规范（异步 + jsonify + argsify）
// 已接：getConfig / getCards -> v.rbotv.cn 多路径探测
// 待接：getTracks / getPlayinfo / search（保持演示，不转圈）

/* ================== 基础工具 ================== */

// jsonify 兜底：有内置 jsonify 就用；没有就 JSON.stringify
const __jsonify = (typeof jsonify === 'function')
  ? jsonify
  : (o => { try { return JSON.stringify(o); } catch(e){ return '{}'; } });

// 安全把 ext 解析成对象：有 argsify 就用；没有就尽力转
function __argsify(x){
  try{
    if (typeof argsify === 'function') return argsify(x);
    if (!x) return {};
    if (typeof x === 'object') return x;
    if (typeof x === 'string') {
      try { return JSON.parse(x); } catch(e){}
      // 兼容 #@{...}
      const hash = x.split('#@').pop();
      if (hash && (hash.trim().startsWith('{') || hash.trim().startsWith('%7B'))){
        try { return JSON.parse(decodeURIComponent(hash)); }catch(e){}
      }
    }
  }catch(e){}
  return {};
}

// 统一 headers
function __H(extra){
  const base = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json,text/plain,*/*'
  };
  if (extra) for (const k in extra) base[k] = extra[k];
  return base;
}

// 取文本
async function __get(u){
  try{
    // 大多数 xiaohys 内核都提供 $fetch.get/$.get 之类，这里优先 $fetch
    if (typeof $fetch !== 'undefined' && $fetch && $fetch.get){
      const r = await $fetch.get(u, { headers: __H(), timeout: 10000 });
      return (r && (r.data || r.content || r.body)) || '';
    }
    // 兜底：如果环境有 fetch（少数环境）
    if (typeof fetch === 'function'){
      const r = await fetch(u, { headers: __H() });
      return await r.text();
    }
  }catch(e){}
  return '';
}

// 取 JSON
async function __getJSON(u){
  const txt = await __get(u);
  if (!txt) return null;
  try{ return JSON.parse(txt); }catch(e){}
  return null;
}

// 多路径探测（第一个能返回 JSON 的为准）
async function __probeJSON(bases, rels){
  const tried = [];
  for (let i=0;i<bases.length;i++){
    for (let k=0;k<rels.length;k++){
      const u = bases[i] + rels[k];
      tried.push(u);
      const j = await __getJSON(u);
      if (j && (Array.isArray(j) || typeof j === 'object')){
        return { base: bases[i], url: u, json: j };
      }
    }
  }
  return { base: '', url: '', json: null, tried };
}

// 标准化分类/列表字段
function __asArray(v){
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  return [];
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

/* ================== 入口：getConfig（已接） ================== */
async function getConfig(){
  // 允许 http/https 两种
  const BASES = ['http://v.rbotv.cn', 'https://v.rbotv.cn'];

  // 常见 APP 分类接口路径（不同面板/程序改名较多，逐个试）
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

  try{
    const hit = await __probeJSON(BASES, navRel);
    if (hit.json){
      base = hit.base || base;

      // 兼容多种字段结构
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
  }catch(e){
    // 忽略异常，走兜底
  }

  // 兜底给几个常用分类，确保 UI 不空
  if (!tabs.length){
    tabs = [
      { name: '电影', ext: { catId: '1', page: 1 } },
      { name: '剧集', ext: { catId: '2', page: 1 } },
      { name: '综艺', ext: { catId: '3', page: 1 } },
      { name: '动漫', ext: { catId: '4', page: 1 } }
    ];
  }

  // 把探测到的 base 保存到全局，后面 getCards 用
  try{ globalThis.__RBOTV_BASE__ = base; }catch(e){}

  return __jsonify({
    ver: 20250905,
    title: '热播APP',
    site: base,
    tabs
  });
}

/* ================== 入口：getCards（已接） ================== */
async function getCards(ext){
  ext = __argsify(ext);
  const catId = (ext && ext.catId) ? String(ext.catId) : '1';
  const page  = (ext && ext.page)  ? (ext.page|0) : 1;

  const BASE = (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn';

  // 常见 APP 列表接口路径
  const listRel = [
    '/xgapp.php/v3/video?tid=' + catId + '&pg=' + page,
    '/xgapp.php/v2/video/type?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?type_id=' + catId + '&page=' + page,
    '/api.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page
  ];

  let out = [];
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
            ext: { id: o.vod_id } // 回传给 getTracks
          });
        }
      }
    }
  }catch(e){
    // 忽略异常；无数据则返回空列表
  }

  return __jsonify({ list: out });
}

/* ================== 入口：getTracks（演示版，待你确认后再接详情） ================== */
async function getTracks(ext){
  ext = __argsify(ext);
  // 先演示固定两集，验证流程没问题后再接详情接口
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

/* ================== 入口：getPlayinfo（演示直链返回） ================== */
async function getPlayinfo(ext){
  ext = __argsify(ext);
  const u = (ext && ext.raw) ? String(ext.raw) : '';
  return __jsonify({
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }]
  });
}

/* ================== 入口：search（先返回空） ================== */
async function search(ext){
  ext = __argsify(ext);
  return __jsonify({ list: [] });
}

/* ================== 导出 ================== */
module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };