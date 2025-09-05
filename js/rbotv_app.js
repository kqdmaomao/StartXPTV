// rbotv_app.js —— XPTV csp_xiaohys 全量接入（async + jsonify + argsify + 时间盒 + 兜底）
// 接口域：v.rbotv.cn（自动探测 http/https 与多条常见路径）
// 设计目标：联网成功→用真数据；联网失败/超时→兜底数据，页面不转圈

/* ====== 联网开关与超时（建议保持 true；如需离线演示可改为 false） ====== */
const NET_ENABLED = true;         // 允许联网探测真实接口
const NET_TIMEOUT_MS = 1500;      // 每个请求硬超时（毫秒）

/* ================== 通用工具 ================== */

// jsonify 兜底：优先用内置 jsonify；缺失时用 JSON.stringify
const __jsonify = (typeof jsonify === 'function')
  ? jsonify
  : (o => { try { return JSON.stringify(o); } catch(e){ return '{}'; } });

// 把 ext 安全解析为对象：优先用 argsify；否则自行解析
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

// 请求头
function __H(extra){
  const base = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json,text/plain,*/*'
  };
  if (extra) for (const k in extra) base[k] = extra[k];
  return base;
}

// 超时器
function __timeout(ms){
  return new Promise(resolve => setTimeout(() => resolve({ __timeout__: true }), ms));
}

// GET 文本（$fetch 优先；否则尝试 fetch）
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

// GET JSON
async function __getJSON(u){
  const txt = await __get(u);
  if (!txt) return null;
  try{ return JSON.parse(txt); }catch(e){}
  return null;
}

// 多路径探测（第一个返回对象/数组就算命中）
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

/* ================== 1) getConfig：分类 ================== */
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
    title: '热播APP',
    site: base,
    tabs
  });
}

/* ================== 2) getCards：列表 ================== */
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

  if (!out.length){
    out = [
      {
        vod_id: 'demo_1',
        vod_name: '演示影片（兜底）',
        vod_pic: '',
        vod_remarks: '本地演示',
        ext: { id: 'demo_1' }
      }
    ];
  }

  return __jsonify({ list: out });
}

/* ================== 3) getTracks：详情/分集 ================== */
async function getTracks(ext){
  ext = __argsify(ext);
  const vid = (ext && (ext.id || ext.vod_id)) ? String(ext.id || ext.vod_id) : '';

  // 离线兜底（当 id 不存在时）
  if (!NET_ENABLED || !vid){
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

  const BASE = (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn';
  const detailRel = [
    '/xgapp.php/v3/detail?ids=' + vid,
    '/xgapp.php/v3/video_detail?id=' + vid,
    '/api.php/app/video_detail?id=' + vid,
    '/api.php/provide/vod/?ac=detail&ids=' + vid,
    '/macapi.php/provide/vod/?ac=detail&ids=' + vid
  ];

  let tracksGroups = [];

  try{
    const hit = await __probeJSON([BASE], detailRel);
    const J = hit.json;

    if (J){
      // 兼容不同返回结构
      // 常见：{ list: [ { vod_play_url: "线路1$u1#线路1-2$u2$$线路2$u3#..." , vod_play_from:"线路1$$线路2" } ] }
      // 也可能：{ data: { play: [ { name:"线路1", urls:[{n:"第1集",u:"..."}]} ] } }
      let item = null;
      if (Array.isArray(J.list) && J.list.length > 0) item = J.list[0];
      else if (J.data && Array.isArray(J.data) && J.data.length > 0) item = J.data[0];
      else if (J.data && typeof J.data === 'object') item = J.data;

      if (item){
        // 1) vod_play_from + vod_play_url 形式
        let playFrom = (item.vod_play_from || item.from || item.play_from || '').split('$$').filter(Boolean);
        let playUrl  = (item.vod_play_url  || item.url  || item.play_url  || '').split('$$').filter(Boolean);

        if (playUrl.length && playFrom.length && playUrl.length === playFrom.length){
          for (let i=0;i<playFrom.length;i++){
            const tname = playFrom[i] || ('线路' + (i+1));
            const block = playUrl[i] || '';
            // 形如：  第1集$xxx.m3u8#第2集$yyy.m3u8
            const parts = block.split('#').filter(Boolean);
            const one = [];
            for (let j=0;j<parts.length;j++){
              const seg = parts[j];
              const idx = seg.indexOf('$');
              if (idx > -1){
                const n = seg.slice(0, idx).trim() || ('第' + (j+1) + '集');
                const u = seg.slice(idx+1).trim();
                if (u){
                  one.push({ name: n, pan: '', ext: { raw: u } });
                }
              }else{
                // 没有 $，当作 URL
                const u = seg.trim();
                if (u){
                  one.push({ name: '第' + (j+1) + '集', pan: '', ext: { raw: u } });
                }
              }
            }
            if (one.length){
              tracksGroups.push({ title: tname, tracks: one });
            }
          }
        }

        // 2) play 列表结构
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
            if (one.length){
              tracksGroups.push({ title: tname, tracks: one });
            }
          }
        }

        // 3) 兜底：若发现直接有 m3u8/url
        if (!tracksGroups.length){
          const maybe = item.playUrl || item.url || item.vod_url || '';
          if (maybe){
            tracksGroups.push({
              title: '默认线路',
              tracks: [{ name: '播放', pan: '', ext: { raw: String(maybe) } }]
            });
          }
        }
      }
    }
  }catch(e){}

  if (!tracksGroups.length){
    // 兜底不让页面空
    tracksGroups = [{
      title: '默认线路',
      tracks: [
        { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } }
      ]
    }];
  }

  return __jsonify({ list: tracksGroups });
}

/* ================== 4) getPlayinfo：返回可播直链/或交给壳嗅探 ================== */
async function getPlayinfo(ext){
  ext = __argsify(ext);
  const u = (ext && ext.raw) ? String(ext.raw) : '';

  // 简单判断直链（m3u8/mp4）；其他交给壳的解析器
  const isDirect = /\.(m3u8|mp4|m4a)(\?|$)/i.test(u);
  if (isDirect){
    return __jsonify({
      urls: [u],
      headers: [{ 'User-Agent': 'Mozilla/5.0' }]
    });
  }else{
    // 让壳自行嗅探/解析
    return __jsonify({
      urls: [u],
      headers: [{ 'User-Agent': 'Mozilla/5.0' }]
    });
  }
}

/* ================== 5) search：多路径探测（失败则空列表） ================== */
async function search(ext){
  ext = __argsify(ext);
  const wd = (ext && (ext.wd || ext.key || ext.keyword)) ? String(ext.wd || ext.key || ext.keyword) : '';
  const page = (ext && ext.page) ? (ext.page|0) : 1;

  if (!NET_ENABLED || !wd){
    return __jsonify({ list: [] });
  }

  const BASE = (typeof globalThis !== 'undefined' && globalThis.__RBOTV_BASE__) ? globalThis.__RBOTV_BASE__ : 'http://v.rbotv.cn';
  const q = encodeURIComponent(wd);

  const searchRel = [
    '/xgapp.php/v3/search?text=' + q + '&pg=' + page,
    '/api.php/app/search?text=' + q + '&pg=' + page,
    '/api.php/provide/vod/?ac=videolist&wd=' + q + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&wd=' + q + '&pg=' + page
  ];

  let out = [];
  try{
    const hit = await __probeJSON([BASE], searchRel);
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

  return __jsonify({ list: out });
}

/* ================== 导出 ================== */
module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };