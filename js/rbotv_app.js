// rbotv_app.js —— 超级兼容 UMD 版（csp_xiaohys 五入口 + 全局函数 + module.exports）
// 目标：无网络、零依赖、最老语法、立即返回字符串，尽量避免内核卡圈

// 兜底 stringify
function __str(o){
  try { return typeof o === 'string' ? o : JSON.stringify(o); }
  catch(e){ return '{}'; }
}

// 1) 配置
function getConfig(){
  var ret = {
    ver: 20250905,
    title: '热播APP(UMD)',
    site: 'about:blank',
    tabs: [{ name: '测试分类', ext: { catId: 'test', page: 1 } }]
  };
  return __str(ret);
}

// 2) 列表卡片
function getCards(ext){
  var ret = {
    list: [{
      vod_id: 'demo_1',
      vod_name: '演示影片（点我看分组/选集）',
      vod_pic: '',
      vod_remarks: '本地数据',
      ext: { id: 'demo_1' }
    }]
  };
  return __str(ret);
}

// 3) 分组/选集
function getTracks(ext){
  var ret = {
    list: [{
      title: '线路1（演示）',
      tracks: [
        { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } },
        { name: '第2集', pan: '', ext: { raw: 'https://example.com/video2.m3u8' } }
      ]
    }]
  };
  return __str(ret);
}

// 4) 播放
function getPlayinfo(ext){
  var u = (ext && ext.raw) ? String(ext.raw) : '';
  var ret = {
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }]
  };
  return __str(ret);
}

// 5) 搜索（空）
function search(ext){
  return __str({ list: [] });
}

// —— 三路导出：module.exports / exports / 全局函数（都给上）
try{ if (typeof module === 'object' && module && module.exports) module.exports = { getConfig:getConfig, getCards:getCards, getTracks:getTracks, getPlayinfo:getPlayinfo, search:search }; }catch(e){}
try{ if (typeof exports === 'object' && exports) { exports.getConfig=getConfig; exports.getCards=getCards; exports.getTracks=getTracks; exports.getPlayinfo=getPlayinfo; exports.search=search; } }catch(e){}
try{
  // 有些内核直接从全局查函数名
  if (typeof globalThis !== 'undefined') {
    globalThis.getConfig = getConfig;
    globalThis.getCards = getCards;
    globalThis.getTracks = getTracks;
    globalThis.getPlayinfo = getPlayinfo;
    globalThis.search = search;
  } else if (typeof window !== 'undefined') {
    window.getConfig = getConfig;
    window.getCards = getCards;
    window.getTracks = getTracks;
    window.getPlayinfo = getPlayinfo;
    window.search = search;
  } else {
    this.getConfig = getConfig;
    this.getCards = getCards;
    this.getTracks = getTracks;
    this.getPlayinfo = getPlayinfo;
    this.search = search;
  }
}catch(e){}