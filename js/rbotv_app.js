// rbotv_app.js —— XPTV csp_xiaohys 规范最兼容模板（异步+jsonify+argsify；零网络；不转圈）

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
      // 兼容 #@{...} 之类拼接
      const hash = x.split('#@').pop();
      if (hash && (hash.trim().startsWith('{') || hash.trim().startsWith('%7B'))){
        try { return JSON.parse(decodeURIComponent(hash)); }catch(e){}
      }
    }
  }catch(e){}
  return {};
}

// 1) 配置：返回一个“测试分类”
async function getConfig(){
  const appConfig = {
    ver: 20250905,
    title: '热播APP（异步规范）',
    site: 'about:blank',
    tabs: [
      { name: '测试分类', ext: { catId: 'test', page: 1 } }
    ]
  };
  return __jsonify(appConfig);
}

// 2) 列表：固定 1 张卡片，确保能进二级
async function getCards(ext){
  ext = __argsify(ext);
  return __jsonify({
    list: [{
      vod_id: 'demo_1',
      vod_name: '演示影片（点我看分组/选集）',
      vod_pic: '',
      vod_remarks: '本地演示，无需外网',
      ext: { id: 'demo_1' }   // 会回传给 getTracks
    }]
  });
}

// 3) 分组/选集：1 条线路、2 个分集（演示）
async function getTracks(ext){
  ext = __argsify(ext);
  return __jsonify({
    list: [{
      title: '默认线路',
      tracks: [
        { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } }, // 回传给 getPlayinfo
        { name: '第2集', pan: '', ext: { raw: 'https://example.com/video2.m3u8' } }
      ]
    }]
  });
}

// 4) 播放：把 raw 原样当直链返回（演示）
async function getPlayinfo(ext){
  ext = __argsify(ext);
  const u = (ext && ext.raw) ? String(ext.raw) : '';
  return __jsonify({
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }]
  });
}

// 5) 搜索：返回空列表（不阻塞 UI）
async function search(ext){
  ext = __argsify(ext);
  return __jsonify({ list: [] });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };