// js/rbotv_app.js — 热播APP（按 DRPY 规则；固定 v.rbotv.cn；探测多端点；稳妥不转圈）
var rule = {
  title: '热播APP（XPTV）',
  host: 'https://v.rbotv.cn',    // 固定基域（脚本内部也会按 http/https 探测）
  homeUrl: '/',
  url: '/xgapp.php/v3/video?tid=fyclass&pg=fypage',
  searchUrl: '/xgapp.php/v3/search?text=**&pg=fypage',
  searchable: 1,
  quickSearch: 1,
  filterable: 0,
  // 基础请求头
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*'
  },

  // 【分类】直接给出兜底分类，避免首页空转
  class_name: '电影&剧集&综艺&动漫',
  class_url: '1&2&3&4',

  // 【推荐】用一级规则兜底（不写复杂解析，避免卡住）
  推荐: '*',

  // 【一级】使用 js 动态：自动探测接口；失败则安全返回空
  一级: 'js:try{\
      function J(s){try{return JSON.parse(s)}catch(e){return null}};\
      function G(u){try{log(\"[GET] \"+u);return request(u)}catch(e){return \"\"}};\
      function pick(a){return Array.isArray(a)?a:[]}\
      var bases=[\"https://v.rbotv.cn\",\"http://v.rbotv.cn\"];\
      var rels=[\"/xgapp.php/v3/video?tid=\"+MY_CATE+\"&pg=\"+MY_PAGE,\
                \"/xgapp.php/v2/video/type?tid=\"+MY_CATE+\"&pg=\"+MY_PAGE,\
                \"/api.php/app/video?tid=\"+MY_CATE+\"&pg=\"+MY_PAGE,\
                \"/api.php/app/video?type_id=\"+MY_CATE+\"&page=\"+MY_PAGE,\
                \"/api.php/provide/vod/?ac=videolist&t=\"+MY_CATE+\"&pg=\"+MY_PAGE,\
                \"/macapi.php/provide/vod/?ac=videolist&t=\"+MY_CATE+\"&pg=\"+MY_PAGE];\
      var hit=null,txt=\"\",j=null;\
      for(var i=0;i<bases.length&&!hit;i++){\
        for(var k=0;k<rels.length&&!hit;k++){\
          var u=bases[i]+rels[k];\
          txt=G(u); j=J(txt);\
          if(j && (Array.isArray(j)||typeof j===\"object\")){ hit=u; log(\"[probe ok] \"+u); break;}\
        }\
      }\
      if(!hit){ log(\"[probe fail] all endpoints 404/invalid\"); VODS=[]; return;}\
      var arr=j.list||j.data||j.vod||j.items||[];\
      VODS = pick(arr).map(function(it){\
        var id=(it.id||it.vod_id||it.vid||it.ids||it.ID||it.video_id||\"\")+\"\";\
        var name=it.name||it.vod_name||it.title||it.vod_title||\"未命名\";\
        var pic=it.pic||it.vod_pic||it.cover||it.img||\"\";\
        var note=it.note||it.remarks||it.vod_remarks||it.brief||\"\";\
        return {vod_id:id,vod_name:name,vod_pic:pic,vod_remarks:note};\
      });\
    }catch(e){log(\"[一级异常] \"+e.message); VODS=[];}',

  // 【二级】动态解析详情 + 分组播放列表，失败返回空
  二级: 'js:try{\
      function J(s){try{return JSON.parse(s)}catch(e){return null}};\
      function G(u){try{log(\"[GET] \"+u);return request(u)}catch(e){return \"\"}};\
      var id = orId; if(id.indexOf(\"@@\")>-1){ id = id.split(\"@@\")[0]; }\
      var bases=[\"https://v.rbotv.cn\",\"http://v.rbotv.cn\"];\
      var rels=[\"/xgapp.php/v3/video_detail?id=\"+id,\
                \"/xgapp.php/v2/video/detail?id=\"+id,\
                \"/api.php/app/video_detail?id=\"+id,\
                \"/api.php/app/detail?id=\"+id,\
                \"/api.php/provide/vod/?ac=detail&ids=\"+id,\
                \"/macapi.php/provide/vod/?ac=detail&ids=\"+id];\
      var hit=null,txt=\"\",j=null;\
      for(var i=0;i<bases.length&&!hit;i++){\
        for(var k=0;k<rels.length&&!hit;k++){\
          var u=bases[i]+rels[k];\
          txt=G(u); j=J(txt);\
          if(j && (Array.isArray(j)||typeof j===\"object\")){ hit=u; log(\"[probe ok] \"+u); break;}\
        }\
      }\
      if(!hit){ log(\"[detail] probe fail\"); VOD={vod_id:orId,vod_name:\"详情不可用\",vod_content:\"\"}; return; }\
      var info=(j.data&&(Array.isArray(j.data)?j.data[0]:j.data))||(j.video)||(j.vod)||(j.list&&j.list[0])||{};\
      var name=info.name||info.vod_name||info.title||info.vod_title||\"\";\
      var pic =info.pic||info.vod_pic||info.cover||info.img||\"\";\
      var year=info.year||info.vod_year||\"\";\
      var area=info.area||info.vod_area||\"\";\
      var actor=info.actor||info.vod_actor||\"\";\
      var director=info.director||info.vod_director||\"\";\
      var remarks=info.note||info.vod_remarks||\"\";\
      var content=info.content||info.vod_content||\"\";\
      var playAll=info.playUrl||info.playurl||info.play_url||info.vod_play_url||\"\";\
      var tabs=[],lists=[];\
      if(playAll){\
        var groups=String(playAll).split(\"$$$\").filter(function(x){return x});\
        for(var gi=0;gi<groups.length;gi++){\
          var g=groups[gi]; tabs.push(\"线路\"+(gi+1));\
          var segs=String(g).split(\"#\").filter(function(x){return x});\
          var one=[];\
          for(var si=0;si<segs.length;si++){\
            var s=segs[si];\
            var arr=s.split(\"$\");\
            var nm=arr.length>=2?arr[0]:(\"P\"+(si+1));\
            var u =arr.length>=2?arr.slice(1).join(\"$\"):s;\
            one.push(nm+\"$\"+u);\
          }\
          lists.push(one.join(\"#\"));\
        }\
      }\
      VOD={\
        vod_id: orId,\
        vod_name: name||\"未知片名\",\
        vod_pic: pic,\
        type_name: info.type||info.type_name||\"\",\
        vod_year: year,\
        vod_area: area,\
        vod_remarks: remarks,\
        vod_actor: actor,\
        vod_director: director,\
        vod_content: content,\
        vod_play_from: tabs.join(\"$$$\"),\
        vod_play_url: lists.join(\"$$$\")\
      };\
    }catch(e){log(\"[二级异常] \"+e.message); VOD={vod_id:orId,vod_name:\"解析失败\",vod_content:\"\"};}',

  // 【播放】兜底免嗅：直链(m3u8/mp4)走直播，否则走解析
  play_parse: true,
  lazy: 'js:try{\
      var u=input; if(!u){input={parse:0,jx:0,url:\"\"};return;}\
      var isM3U8=/\\.m3u8(\\?|$)/i.test(u); var isMP4=/\\.mp4(\\?|$)/i.test(u);\
      if(isM3U8||isMP4){ input={parse:0,jx:0,url:u}; }\
      else{ input={parse:1,jx:1,url:u}; }\
    }catch(e){ input={parse:1,jx:1,url:input}; }',

  // 【搜索】走 APP 搜索；探测失败返回空
  搜索: 'js:try{\
      function J(s){try{return JSON.parse(s)}catch(e){return null}};\
      function G(u){try{log(\"[GET] \"+u);return request(u)}catch(e){return \"\"}};\
      var wd=KEY, page=MY_PAGE||1;\
      var bases=[\"https://v.rbotv.cn\",\"http://v.rbotv.cn\"];\
      var rels=[\"/xgapp.php/v3/search?text=\"+encodeURIComponent(wd)+\"&pg=\"+page,\
                \"/xgapp.php/v2/search?text=\"+encodeURIComponent(wd)+\"&pg=\"+page,\
                \"/api.php/app/search?text=\"+encodeURIComponent(wd)+\"&pg=\"+page,\
                \"/api.php/provide/vod/?ac=videolist&wd=\"+encodeURIComponent(wd)+\"&pg=\"+page,\
                \"/macapi.php/provide/vod/?ac=videolist&wd=\"+encodeURIComponent(wd)+\"&pg=\"+page];\
      var hit=null,txt=\"\",j=null;\
      for(var i=0;i<bases.length&&!hit;i++){\
        for(var k=0;k<rels.length&&!hit;k++){\
          var u=bases[i]+rels[k];\
          txt=G(u); j=J(txt);\
          if(j && (Array.isArray(j)||typeof j===\"object\")){ hit=u; log(\"[probe ok] \"+u); break;}\
        }\
      }\
      if(!hit){ log(\"[search] probe fail\"); VODS=[]; return;}\
      function pick(a){return Array.isArray(a)?a:[]}\
      var arr=j.list||j.data||j.vod||j.items||[];\
      VODS = pick(arr).map(function(it){\
        var id=(it.id||it.vod_id||it.vid||it.ids||it.ID||it.video_id||\"\")+\"\";\
        var name=it.name||it.vod_name||it.title||it.vod_title||\"未命名\";\
        var pic=it.pic||it.vod_pic||it.cover||it.img||\"\";\
        var note=it.note||it.remarks||it.vod_remarks||it.brief||\"\";\
        return {vod_id:id,vod_name:name,vod_pic:pic,vod_remarks:note};\
      });\
    }catch(e){log(\"[搜索异常] \"+e.message); VODS=[];}'
};
// 导出（给支持 ES 模块的内核；不支持也无影响）
export default rule;