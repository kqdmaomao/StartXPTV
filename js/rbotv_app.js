// rbotv_app.js — XPTV 热播APP适配器（接口地址已写死 http://v.rbotv.cn）

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
function hasM3U8(s){ return /https?:\/\/[^\s'"<>]+\.m3u8/i.test(s||''); }
function hasMP4(s){ return /https?:\/\/[^\s'"<>]+\.mp4/i.test(s||''); }

function splitPlayList(raw){
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
    vod_id: (it.id || it.vod_id || it.vid || '').toString(),
    vod_name: it.name || it.vod_name || it.title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || '',
    vod_remarks: it.note || it.remarks || ''
  };
}

// 🔴 写死接口基地址
function ensureBase(){ return "http://v.rbotv.cn"; }

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

async function getConfig(){
  const BASE = ensureBase();
  $print(`[getConfig] base=${BASE}`);

  const navCandidates = [
    `${BASE}/xgapp.php/v3/nav`,
    `${BASE}/api.php/provide/vod/?ac=class`,
  ];
  const {json:navJson} = await probeJSON(navCandidates);

  let tabs = [];
  if(navJson){
    const group = navJson.class || navJson.data || [];
    pick(group).forEach(c=>{
      const id = c.type_id || c.id;
      const name = c.type_name || c.name;
      if(id && name) tabs.push({ name, ext:{catId:String(id), page:1} });
    });
  }
  if(!tabs.length){
    tabs = [
      { name:'电影', ext:{catId:'1',page:1} },
      { name:'剧集', ext:{catId:'2',page:1} },
      { name:'综艺', ext:{catId:'3',page:1} },
      { name:'动漫', ext:{catId:'4',page:1} }
    ];
  }

  return jsonify({ ver:20250905, title:'热播APP（写死）', site:BASE, tabs });
}

async function getCards(ext){
  const BASE = ensureBase();
  const { catId='1', page=1 } = argsify(ext);
  const listCandidates = [
    `${BASE}/xgapp.php/v3/video?tid=${catId}&pg=${page}`,
    `${BASE}/api.php/provide/vod/?ac=videolist&t=${catId}&pg=${page}`
  ];
  const {json} = await probeJSON(listCandidates);
  const out=[];
  if(json){
    const arr = json.list || json.data || [];
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if(o.vod_id) out.push({...o, ext:{id:o.vod_id}});
    });
  }
  return jsonify({ list: out });
}

async function getTracks(ext){
  const BASE = ensureBase();
  const { id } = argsify(ext);
  if(!id) return jsonify({list:[]});

  const detailCandidates = [
    `${BASE}/xgapp.php/v3/video_detail?id=${id}`,
    `${BASE}/api.php/provide/vod/?ac=detail&ids=${id}`
  ];
  const {json} = await probeJSON(detailCandidates);
  if(!json) return jsonify({list:[]});

  let info = (json.data && json.data[0]) || (json.list && json.list[0]) || {};
  const playAll = info.playUrl || info.vod_play_url || '';
  if(!playAll) return jsonify({list:[]});

  const groupsRaw = String(playAll).split('$$$').filter(Boolean);
  const groups = groupsRaw.map((g, idx)=>{
    const tracks = splitPlayList(g).map((t,i)=>({
      name: t.name || `P${i+1}`,
      pan: '',
      ext: { id, raw:t.url }
    }));
    return { title:`线路${idx+1}`, tracks };
  });
  return jsonify({ list: groups });
}

async function getPlayinfo(ext){
  const BASE = ensureBase();
  const raw = argsify(ext).raw || '';
  if(!raw) return jsonify({urls:[],headers:[H()]});
  if(hasM3U8(raw)||hasMP4(raw)){
    return jsonify({ urls:[raw], headers:[H({Referer:BASE,Origin:abshost(BASE)})] });
  }
  return jsonify({ urls:[raw], headers:[H({Referer:BASE,Origin:abshost(BASE)})] });
}

async function search(ext){
  const BASE = ensureBase();
  let { wd='', page=1 } = argsify(ext);
  if(!wd) return jsonify({list:[]});
  const searchCandidates = [
    `${BASE}/xgapp.php/v3/search?text=${encodeURIComponent(wd)}&pg=${page}`,
    `${BASE}/api.php/provide/vod/?ac=videolist&wd=${encodeURIComponent(wd)}&pg=${page}`
  ];
  const {json} = await probeJSON(searchCandidates);
  const out=[];
  if(json){
    const arr = json.list || json.data || [];
    pick(arr).forEach(item=>{
      const o = normVodItem(item);
      if(o.vod_id) out.push({...o, ext:{id:o.vod_id}});
    });
  }
  return jsonify({ list: out });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };