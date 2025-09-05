// rbotv_app.xiaohys.js — XPTV 热播APP 适配（csp_xiaohys 规范；五入口；写死域名并自动探测）
// 约定环境：提供 $fetch / $print / $utils.toast / jsonify

/** ============ 工具 ============ */
function H(extra) {
  var base = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*'
  };
  if (extra) for (var k in extra) base[k] = extra[k];
  return base;
}
function jparse(t) { try { return JSON.parse(t); } catch(e){ return null; } }
function pick(a) { return Array.isArray(a) ? a : []; }
function hasM3U8(s){ return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(String(s||'')); }
function hasMP4 (s){ return /https?:\/\/[^\s'"<>]+\.mp4(?:[^\s'"<>]*)/i.test(String(s||'')); }
function abshost(u){ var m=String(u||'').match(/^https?:\/\/[^/]+/i); return m?m[0]:''; }

function GET(u) {
  $print('[GET] ' + u);
  try {
    var r = $fetch.get(u, { headers: H(), timeout: 10000 });
    // 引擎里 $fetch.get 通常是同步返回；若是异步 Promise，则需要 await（此脚本假设同步/阻塞环境，和小紅影视同款）
    var data = r && (r.data||r.content||r.body||'');
    $print('[GET] done status=' + (r && r.status) + ' len=' + (data ? data.length : 0));
    return data || '';
  } catch (e) {
    $print('[GET] err: ' + e);
    return '';
  }
}

function ensureBases(){
  var host = 'v.rbotv.cn';
  return ['https://' + host, 'http://' + host];
}

function probeJSONMulti(bases, rels){
  var tried = [];
  for (var i=0;i<bases.length;i++){
    for (var k=0;k<rels.length;k++){
      var u = bases[i] + rels[k];
      tried.push(u);
      var txt = GET(u);
      var j = jparse(txt);
      if (j && (Array.isArray(j) || typeof j === 'object')) {
        $print('[probe] ok -> ' + u);
        return { base: bases[i], url: u, json: j };
      }
    }
  }
  $print('[probe] all failed:\n' + tried.join('\n'));
  return { base: '', url: '', json: null };
}

function splitPlayList(raw){
  var out = [];
  var lines = String(raw||'').split('#');
  for (var i=0;i<lines.length;i++){
    var seg = lines[i];
    if (!seg) continue;
    var m = seg.split('$');
    if (m.length >= 2) out.push({ name: (m[0]||'').trim(), url: m.slice(1).join('$').trim() });
    else out.push({ name: '', url: seg.trim() });
  }
  return out.filter(function(it){ return it.url; });
}

function normVodItem(it){
  return {
    vod_id: String(it.id || it.vod_id || it.vid || it.ids || it.ID || it.video_id || ''),
    vod_name: it.name || it.vod_name || it.title || it.vod_title || '未命名',
    vod_pic: it.pic || it.vod_pic || it.cover || it.img || '',
    vod_remarks: it.note || it.remarks || it.vod_remarks || it.brief || ''
  };
}

/** ============ 入口：getConfig ============ */
function getConfig(){
  var BASES = ensureBases();
  $print('[getConfig] bases=' + BASES.join(', '));

  var navRel = [
    '/xgapp.php/v3/nav',
    '/xgapp.php/v2/nav',
    '/api.php/app/nav',
    '/api.php/app/index/nav',
    '/api.php/provide/vod/?ac=class',
    '/macapi.php/provide/vod/?ac=class',
    '/app/index.php/v1/nav'
  ];

  var hit = probeJSONMulti(BASES, navRel);
  var tabs = [];
  if (hit.json){
    var group = hit.json['class'] || hit.json['data'] || hit.json['list'] || [];
    var arr = pick(group);
    for (var i=0;i<arr.length;i++){
      var c = arr[i];
      var id   = c.type_id || c.typeid || c.id || c.tid;
      var name = c.type_name || c.typename || c.name || c.title;
      if (id && name) tabs.push({ name: name, ext: { catId: String(id), page: 1 } });
    }
  }
  if (!tabs.length){
    tabs = [
      { name: '电影', ext: { catId: '1', page: 1 } },
      { name: '剧集', ext: { catId: '2', page: 1 } },
      { name: '综艺', ext: { catId: '3', page: 1 } },
      { name: '动漫', ext: { catId: '4', page: 1 } }
    ];
  }

  // 记住 base
  globalThis.__RBOTV_BASE__ = hit.base || BASES[0];

  try { $utils.toast('热播APP：配置已加载'); } catch(e){}
  return jsonify({
    ver: 20250905,
    title: '热播APP',
    site: globalThis.__RBOTV_BASE__,
    tabs: tabs
  });
}

/** ============ 入口：getCards ============ */
function getCards(ext){
  var BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  var catId = (ext && ext.catId) ? String(ext.catId) : '1';
  var page  = (ext && ext.page)  ? (ext.page|0) : 1;
  $print('[getCards] base=' + BASE + ' catId=' + catId + ' page=' + page);

  var listRel = [
    '/xgapp.php/v3/video?tid=' + catId + '&pg=' + page,
    '/xgapp.php/v2/video/type?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?tid=' + catId + '&pg=' + page,
    '/api.php/app/video?type_id=' + catId + '&page=' + page,
    '/api.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&t=' + catId + '&pg=' + page
  ];
  var hit = probeJSONMulti([BASE], listRel);

  var out = [];
  if (hit.json){
    var arr = hit.json['list'] || hit.json['data'] || hit.json['vod'] || hit.json['items'] || [];
    var a = pick(arr);
    for (var i=0;i<a.length;i++){
      var o = normVodItem(a[i]);
      if (o.vod_id && o.vod_name){
        out.push({ vod_id: o.vod_id, vod_name: o.vod_name, vod_pic: o.vod_pic, vod_remarks: o.vod_remarks, ext: { id: o.vod_id } });
      }
    }
  }
  $print('[getCards] found=' + out.length);
  return jsonify({ list: out });
}

/** ============ 入口：getTracks ============ */
function getTracks(ext){
  var BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  var id = ext && ext.id ? String(ext.id) : '';
  if (!id) return jsonify({ list: [] });
  $print('[getTracks] base=' + BASE + ' id=' + id);

  var detailRel = [
    '/xgapp.php/v3/video_detail?id=' + id,
    '/xgapp.php/v2/video/detail?id=' + id,
    '/api.php/app/video_detail?id=' + id,
    '/api.php/app/detail?id=' + id,
    '/api.php/provide/vod/?ac=detail&ids=' + id,
    '/macapi.php/provide/vod/?ac=detail&ids=' + id
  ];
  var hit = probeJSONMulti([BASE], detailRel);
  if (!hit.json) return jsonify({ list: [] });

  var info = (hit.json.data && (Array.isArray(hit.json.data) ? hit.json.data[0] : hit.json.data))
          || hit.json.video
          || hit.json.vod
          || (hit.json.list && hit.json.list[0])
          || {};
  var playAll = info.playUrl || info.playurl || info.play_url || info.vod_play_url || '';
  if (!playAll) return jsonify({ list: [] });

  var groups = [];
  var garr = String(playAll).split('$$$');
  for (var gi=0; gi<garr.length; gi++){
    var g = garr[gi];
    if (!g) continue;
    var tracks = [];
    var tarr = splitPlayList(g);
    for (var ti=0; ti<tarr.length; ti++){
      var t = tarr[ti];
      tracks.push({ name: t.name || ('P' + (ti+1)), pan: '', ext: { id: id, raw: t.url } });
    }
    groups.push({ title: '线路' + (gi+1) + '（' + tracks.length + '）', tracks: tracks });
  }

  $print('[getTracks] groups=' + groups.length);
  return jsonify({ list: groups });
}

/** ============ 入口：getPlayinfo ============ */
function getPlayinfo(ext){
  var BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  var raw = (ext && ext.raw) ? String(ext.raw).trim() : '';
  $print('[getPlayinfo] base=' + BASE + ' raw=' + raw);
  if (!raw) return jsonify({ urls: [], headers: [H()] });

  if (hasM3U8(raw) || hasMP4(raw)) {
    return jsonify({ urls: [raw], headers: [H({ Referer: BASE, Origin: abshost(BASE) })] });
  }
  // 兜底：交给内置解析 / 嗅探
  return jsonify({ urls: [raw], headers: [H({ Referer: BASE, Origin: abshost(BASE) })] });
}

/** ============ 入口：search ============ */
function search(ext){
  var BASE = globalThis.__RBOTV_BASE__ || ensureBases()[0];
  var wd = (ext && ext.wd) ? String(ext.wd).trim() : '';
  var page = (ext && ext.page) ? (ext.page|0) : 1;
  if (!wd) return jsonify({ list: [] });
  $print('[search] base=' + BASE + ' wd=' + wd + ' page=' + page);

  var searchRel = [
    '/xgapp.php/v3/search?text=' + encodeURIComponent(wd) + '&pg=' + page,
    '/xgapp.php/v2/search?text=' + encodeURIComponent(wd) + '&pg=' + page,
    '/api.php/app/search?text=' + encodeURIComponent(wd) + '&pg=' + page,
    '/api.php/provide/vod/?ac=videolist&wd=' + encodeURIComponent(wd) + '&pg=' + page,
    '/macapi.php/provide/vod/?ac=videolist&wd=' + encodeURIComponent(wd) + '&pg=' + page
  ];
  var hit = probeJSONMulti([BASE], searchRel);

  var out = [];
  if (hit.json){
    var arr = hit.json['list'] || hit.json['data'] || hit.json['vod'] || hit.json['items'] || [];
    var a = pick(arr);
    for (var i=0;i<a.length;i++){
      var o = normVodItem(a[i]);
      if (o.vod_id && o.vod_name){
        out.push({ vod_id: o.vod_id, vod_name: o.vod_name, vod_pic: o.vod_pic, vod_remarks: o.vod_remarks, ext: { id: o.vod_id } });
      }
    }
  }
  $print('[search] results=' + out.length);
  return jsonify({ list: out });
}

/** ============ 导出（csp_xiaohys 规范） ============ */
module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };