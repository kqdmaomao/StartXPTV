function getConfig(){ return JSON.stringify({ ver:20250905, title:"热播APP", site:"http://v.rbotv.cn", tabs:[{ name:"电影", ext:{catId:"1",page:1}}] }); }
function getCards(ext){ return JSON.stringify({ list:[{ vod_id:"demo", vod_name:"演示影片", vod_pic:"", vod_remarks:"测试", ext:{id:"demo"}}] }); }
function getTracks(ext){ return JSON.stringify({ list:[{ title:"演示线路", tracks:[{ name:"第1集", ext:{ raw:"https://example.com/1.m3u8"}}]}] }); }
function getPlayinfo(ext){ var u=(ext&&ext.raw)||""; return JSON.stringify({ urls:[u], headers:[{"User-Agent":"Mozilla/5.0"}] }); }
function search(ext){ return JSON.stringify({ list:[] }); }

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search };