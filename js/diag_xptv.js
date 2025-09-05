// 极简自检脚本：加载即打印；getConfig 弹 toast 并返回一张测试卡
(function boot(){ try{ $print('[diag] script loaded'); }catch(e){} })();

async function getConfig(){
  try{ $print('[diag] getConfig'); $utils.toast('diag: getConfig in'); }catch(e){}
  return jsonify({
    ver: 20250905,
    title: '自检脚本',
    site: 'about:blank',
    tabs: [{ name: '测试', ext: { cat: 'test', page: 1 } }]
  });
}

async function getCards(ext){
  $print('[diag] getCards ' + JSON.stringify(ext||{}));
  return jsonify({ list: [{
    vod_id: 'diag_1',
    vod_name: '这是一个测试卡片',
    vod_pic: '',
    vod_remarks: '如果能看到这张卡片，脚本已运行',
    ext: {}
  }]});
}

async function getTracks(ext){
  $print('[diag] getTracks ' + JSON.stringify(ext||{}));
  return jsonify({ list: [{
    title: '测试线路（1）',
    tracks: [{ name: 'P1', pan: '', ext: { url: 'https://example.com/test.m3u8' } }]
  }]});
}

async function getPlayinfo(ext){
  $print('[diag] getPlayinfo ' + JSON.stringify(ext||{}));
  return jsonify({ urls: ['https://example.com/test.m3u8'], headers: [{ 'User-Agent': 'Mozilla/5.0' }] });
}

async function search(ext){
  $print('[diag] search ' + JSON.stringify(ext||{}));
  return jsonify({ list: [] });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };