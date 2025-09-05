// rbotv_app.js —— 严格兼容版（csp_xiaohys 五入口 / 零外网 / 无日志依赖 / 立即返回）

// 兼容：有内置 jsonify 就用；没有就用 JSON.stringify 兜底，保证返回字符串
var _jsonify = (typeof jsonify === 'function')
  ? jsonify
  : function (o) { try { return JSON.stringify(o); } catch (e) { return '{}'; } };

/** 1) 站点配置：给出一个“测试分类” */
function getConfig() {
  return _jsonify({
    ver: 20250905,
    title: '热播APP(兼容)',
    site: 'about:blank',
    tabs: [{ name: '测试分类', ext: { catId: 'test', page: 1 } }]
  });
}

/** 2) 列表卡片：固定 1 张卡，确保能进二级 */
function getCards(ext) {
  return _jsonify({
    list: [{
      vod_id: 'demo_1',
      vod_name: '演示影片（点我看分组/选集）',
      vod_pic: '',
      vod_remarks: '',
      ext: { id: 'demo_1' }
    }]
  });
}

/** 3) 分组/选集：固定 1 条线路、2 个分集 */
function getTracks(ext) {
  return _jsonify({
    list: [{
      title: '线路1（演示）',
      tracks: [
        { name: '第1集', pan: '', ext: { raw: 'https://example.com/video1.m3u8' } },
        { name: '第2集', pan: '', ext: { raw: 'https://example.com/video2.m3u8' } }
      ]
    }]
  });
}

/** 4) 播放信息：把 raw 原样作为直链返回 */
function getPlayinfo(ext) {
  var u = (ext && ext.raw) ? String(ext.raw) : '';
  return _jsonify({
    urls: u ? [u] : [],
    headers: [{ 'User-Agent': 'Mozilla/5.0' }]
  });
}

/** 5) 搜索：返回空列表（不阻塞 UI） */
function search(ext) {
  return _jsonify({ list: [] });
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };