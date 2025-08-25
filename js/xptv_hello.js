// xptv_hello.js  —— 零联网自检插件
$print('xptv_hello.js: loaded top-level');

async function getConfig() {
  $print('xptv_hello.js: getConfig called');
  return jsonify({
    ver: 20250825,
    title: '【自检】HELLO',
    site: 'about:blank',
    tabs: [
      { name: '演示', ext: { scene: 'demo', page: 1 } }
    ]
  });
}

async function getCards(ext) {
  $print('xptv_hello.js: getCards called with', ext);
  // 返回两个演示卡片
  return jsonify([
    { id: 'demo-1', title: '演示条目 1', cover: '', remark: 'OK' },
    { id: 'demo-2', title: '演示条目 2', cover: '', remark: 'OK' }
  ]);
}

async function getTracks(ext) {
  $print('xptv_hello.js: getTracks called with', ext);
  return jsonify({
    info: { title: '演示影片', cover: '', intro: '这是自检用的详情' },
    groups: [{ name: '分组', tracks: [{ id: 'https://example.com/demo.m3u8', title: '播放' }] }]
  });
}

async function getPlayinfo(ext) {
  $print('xptv_hello.js: getPlayinfo called with', ext);
  return jsonify({ url: ext.id || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', headers: {} });
}

async function search(ext) {
  $print('xptv_hello.js: search called with', ext);
  return jsonify([]);
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };