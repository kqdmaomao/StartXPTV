// rbotv_app.js —— 本地断点版（适配 csp_xiaohys；五入口；不访问外网；消除转圈）
// 目标：无论发生什么，都立即返回合法 JSON 字符串 + Toast 断点提示

function S(o){ try{ return typeof o === 'string' ? o : JSON.stringify(o); }catch(e){ return '{}'; } }
function t(msg){ try{ if($utils && $utils.toast){ $utils.toast(String(msg)); } }catch(e){} }
function p(msg){ try{ if($print){ $print('[rbotv-local] ' + String(msg)); } }catch(e){} }

// 1) 配置：给出一个“测试分类”
function getConfig(){
  try{
    p('getConfig in');
    t('getConfig');
    return S({
      ver: 20250905,
      title: '热播APP(本地)',
      site: 'about:blank',
      tabs: [
        { name: '测试分类', ext: { catId: 'test', page: 1 } }
      ]
    });
  }catch(e){
    p('getConfig err: ' + e);
    t('getConfig 失败');
    return S({ ver: 20250905, title: '热播APP(本地-ERR)', site: 'about:blank', tabs: [] });
  }
}

// 2) 列表：固定返回 1 张卡片，确保能进详情
function getCards(ext){
  try{
    p('getCards ext=' + S(ext||{}));
    t('getCards');
    return S({
      list: [
        {
          vod_id: 'demo_1',
          vod_name: '演示影片（点我看分组/选集）',
          vod_pic: '',
          vod_remarks: '本地数据，无需外网',
          ext: { id: 'demo_1' }
        }
      ]
    });
  }catch(e){
    p('getCards err: ' + e);
    t('getCards 失败');
    return S({ list: [] });
  }
}

// 3) 分组/选集：固定 1 条线路、2 个分集
function getTracks(ext){
  try{
    p('getTracks ext=' + S(ext||{}));
    t('getTracks');
    return S({
      list: [
        {
          title: '线路1（演示）',
          tracks: [
            { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } },
            { name: '第2集', pan: '', ext: { raw: 'https://example.com/video2.m3u8' } }
          ]
        }
      ]
    });
  }catch(e){
    p('getTracks err: ' + e);
    t('getTracks 失败');
    return S({ list: [] });
  }
}

// 4) 播放：原样返回 raw（演示直链）
function getPlayinfo(ext){
  try{
    p('getPlayinfo ext=' + S(ext||{}));
    t('getPlayinfo');
    var u = (ext && ext.raw) ? String(ext.raw) : '';
    return S({
      urls: u ? [u] : [],
      headers: [{ 'User-Agent': 'Mozilla/5.0' }]
    });
  }catch(e){
    p('getPlayinfo err: ' + e);
    t('getPlayinfo 失败');
    return S({ urls: [], headers: [{ 'User-Agent': 'Mozilla/5.0' }] });
  }
}

// 5) 搜索：返回空即可（用不到也不能卡）
function search(ext){
  try{
    p('search ext=' + S(ext||{}));
    t('search');
    return S({ list: [] });
  }catch(e){
    p('search err: ' + e);
    t('search 失败');
    return S({ list: [] });
  }
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };