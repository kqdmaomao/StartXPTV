```javascript
// 配置分类和筛选条件
async function getConfig() {
  console.log('getConfig 开始执行');
  const config = {
    ver: 1,
    title: "腾讯视频",
    tabs: [
      { name: "精选", ext: { channel: "choice" } },
      { name: "电影", ext: { channel: "movie" } },
      { name: "电视剧", ext: { channel: "tv" } },
      { name: "综艺", ext: { channel: "variety" } },
      { name: "动漫", ext: { channel: "cartoon" } },
      { name: "少儿", ext: { channel: "child" } },
      { name: "纪录片", ext: { channel: "doco" } }
    ],
    filters: {
      choice: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "83" }, { n: "好评", v: "81" }] },
        { key: "iyear", name: "年代", values: [{ n: "全部", v: "-1" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }] }
      ],
      movie: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "83" }, { n: "好评", v: "81" }] },
        { key: "type", name: "类型", values: [{ n: "全部", v: "-1" }, { n: "犯罪", v: "4" }, { n: "励志", v: "2" }, { n: "喜剧", v: "100004" }, { n: "热血", v: "100061" }, { n: "悬疑", v: "100009" }, { n: "爱情", v: "100005" }, { n: "科幻", v: "100012" }, { n: "恐怖", v: "100010" }, { n: "动画", v: "100015" }, { n: "战争", v: "100006" }, { n: "家庭", v: "100017" }, { n: "剧情", v: "100022" }, { n: "奇幻", v: "100016" }, { n: "武侠", v: "100011" }, { n: "历史", v: "100021" }, { n: "老片", v: "100013" }, { n: "西部", v: "3" }, { n: "记录片", v: "100020" }] },
        { key: "year", name: "年代", values: [{ n: "全部", v: "-1" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }] }
      ],
      tv: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "79" }, { n: "好评", v: "16" }] },
        { key: "feature", name: "类型", values: [{ n: "全部", v: "-1" }, { n: "爱情", v: "1" }, { n: "古装", v: "2" }, { n: "悬疑", v: "3" }, { n: "都市", v: "4" }, { n: "家庭", v: "5" }, { n: "喜剧", v: "6" }, { n: "传奇", v: "7" }, { n: "武侠", v: "8" }, { n: "军旅", v: "9" }, { n: "权谋", v: "10" }, { n: "革命", v: "11" }, { n: "现实", v: "13" }, { n: "青春", v: "14" }, { n: "猎奇", v: "15" }, { n: "科幻", v: "16" }, { n: "竞技", v: "17" }, { n: "玄幻", v: "18" }] },
        { key: "iyear", name: "年代", values: [{ n: "全部", v: "-1" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }] }
      ],
      variety: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "23" }] },
        { key: "iyear", name: "年代", values: [{ n: "全部", v: "-1" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }] }
      ],
      cartoon: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "83" }, { n: "好评", v: "81" }] },
        { key: "area", name: "地区", values: [{ n: "全部", v: "-1" }, { n: "内地", v: "1" }, { n: "日本", v: "2" }, { n: "欧美", v: "3" }, { n: "其他", v: "4" }] },
        { key: "type", name: "类型", values: [{ n: "全部", v: "-1" }, { n: "玄幻", v: "9" }, { n: "科幻", v: "4" }, { n: "武侠", v: "13" }, { n: "冒险", v: "3" }, { n: "战斗", v: "5" }, { n: "搞笑", v: "1" }, { n: "恋爱", v: "7" }, { n: "魔幻", v: "6" }, { n: "竞技", v: "20" }, { n: "悬疑", v: "17" }, { n: "日常", v: "15" }, { n: "校园", v: "16" }, { n: "真人", v: "18" }, { n: "推理", v: "14" }, { n: "历史", v: "19" }, { n: "经典", v: "3" }, { n: "其他", v: "12" }] },
        { key: "iyear", name: "年代", values: [{ n: "全部", v: "-1" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }] }
      ],
      child: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "76" }, { n: "好评", v: "20" }] },
        { key: "sex", name: "性别", values: [{ n: "全部", v: "-1" }, { n: "女孩", v: "1" }, { n: "男孩", v: "2" }] },
        { key: "area", name: "地区", values: [{ n: "全部", v: "-1" }, { n: "内地", v: "3" }, { n: "日本", v: "2" }, { n: "其他", v: "1" }] },
        { key: "iyear", name: "年龄段", values: [{ n: "全部", v: "-1" }, { n: "0-3岁", v: "1" }, { n: "4-6岁", v: "2" }, { n: "7-9岁", v: "3" }, { n: "10岁以上", v: "4" }, { n: "全年龄段", v: "7" }] }
      ],
      doco: [
        { key: "sort", name: "排序", values: [{ n: "最热", v: "75" }, { n: "最新", v: "74" }] },
        { key: "itrailer", name: "出品方", values: [{ n: "全部", v: "-1" }, { n: "BBC", v: "1" }, { n: "国家地理", v: "4" }, { n: "HBO", v: "3175" }, { n: "NHK", v: "2" }, { n: "历史频道", v: "7" }, { n: "ITV", v: "3530" }, { n: "探索频道", v: "3174" }, { n: "ZDF", v: "3176" }, { n: "腾讯自制", v: "15" }, { n: "合作机构", v: "6" }, { n: "其他", v: "5" }] },
        { key: "type", name: "类型", values: [{ n: "全部", v: "-1" }, { n: "自然", v: "4" }, { n: "美食", v: "10" }, { n: "社会", v: "3" }, { n: "人文", v: "6" }, { n: "历史", v: "1" }, { n: "军事", v: "2" }, { n: "科技", v: "8" }, { n: "财经", v: "14" }, { n: "探险", v: "15" }, { n: "罪案", v: "7" }, { n: "竞技", v: "12" }, { n: "旅游", v: "11" }] }
      ]
    }
  };
  console.log('getConfig 返回配置：', JSON.stringify(config.tabs.map(tab => tab.name)));
  return jsonify(config);
}

// 获取视频列表
async function getCards(ext) {
  console.log('getCards 开始执行，输入参数：', JSON.stringify(ext));
  const channel = ext.channel || 'cartoon';
  const page = ext.page || 1;
  const filters = ext.filters || {};
  const offset = (page - 1) * 21;
  let url = `https://v.qq.com/x/bu/pagesheet/list?_all=1&append=1&channel=${channel}&listpage=1&offset=${offset}&pagesize=21&iarea=-1`;
  url += `&sort=${filters.sort || '75'}`;
  if (filters.iyear) url += `&iyear=${filters.iyear}`;
  if (filters.year) url += `&year=${filters.year}`;
  if (filters.type) url += `&itype=${filters.type}`;
  if (filters.feature) url += `&ifeature=${filters.feature}`;
  if (filters.area) url += `&iarea=${filters.area}`;
  if (filters.itrailer) url += `&itrailer=${filters.itrailer}`;
  if (filters.sex) url += `&gender=${filters.sex}`;
  console.log('getCards 请求URL：', url);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.139 Safari/537.36',
    'origin': 'https://v.qq.com',
    'referer': 'https://v.qq.com/'
  };

  let html;
  try {
    html = await $fetch.get(url, { headers });
    console.log('getCards 收到响应，长度：', html.length);
  } catch (e) {
    console.log('getCards 请求失败：', e.message);
    return jsonify({ cards: [] });
  }

  const $ = cheerio.load(html);
  const cards = [];
  $('.list_item').each((i, el) => {
    const title = $(el).find('img').attr('alt') || '';
    const img = $(el).find('img').attr('src') || '';
    const desc = $(el).find('a').text() || '';
    const cid = $(el).find('a').attr('data-float') || '';
    if (cid) {
      cards.push({
        id: `https://node.video.qq.com/x/api/float_vinfo2?cid=${cid}`,
        title,
        cover: img,
        desc
      });
    }
  });
  console.log('getCards 解析到视频数量：', cards.length);
  return jsonify({ cards });
}

// 获取视频详情和剧集
async function getTracks(ext) {
  console.log('getTracks 开始执行，输入参数：', JSON.stringify(ext));
  const cid = ext.id.split('cid=')[1];
  const detailUrl = `https://node.video.qq.com/x/api/float_vinfo2?cid=${cid}`;
  console.log('getTracks 请求详情URL：', detailUrl);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.139 Safari/537.36',
    'origin': 'https://v.qq.com',
    'referer': 'https://v.qq.com/'
  };

  let html;
  try {
    html = await $fetch.get(detailUrl, { headers });
    console.log('getTracks 收到详情响应，长度：', html.length);
  } catch (e) {
    console.log('getTracks 请求详情失败：', e.message);
    return jsonify({ tracks: [] });
  }

  let json;
  try {
    json = JSON.parse(html);
    console.log('getTracks 解析JSON成功，标题：', json.c.title);
  } catch (e) {
    console.log('getTracks 解析详情JSON失败：', e.message);
    return jsonify({ tracks: [] });
  }

  const vod = {
    name: json.c.title || '',
    type: json.typ?.join(',') || '',
    actor: json.nam?.join(',') || '',
    year: json.c.year || '',
    content: json.c.description || '',
    remarks: json.rec || '',
    cover: new URL(json.c.pic || '', detailUrl).href
  };
  console.log('getTracks 视频详情：', JSON.stringify(vod));

  const video_lists = json.c.video_ids || [];
  console.log('getTracks 剧集ID数量：', video_lists.length);
  const tracks = [];
  if (video_lists.length === 1) {
    tracks.push({
      name: '在线播放',
      id: `https://v.qq.com/x/cover/${cid}/${video_lists[0]}.html`
    });
  } else if (video_lists.length > 1) {
    const batches = [];
    for (let i = 0; i < video_lists.length; i += 30) {
      batches.push(video_lists.slice(i, i + 30));
    }
    console.log('getTracks 剧集分批数量：', batches.length);
    for (const batch of batches) {
      const o_url = `https://union.video.qq.com/fcgi-bin/data?otype=json&tid=1804&appid=20001238&appkey=6c03bbe9658448a4&union_platform=1&idlist=${batch.join(',')}`;
      console.log('getTracks 请求剧集URL：', o_url);
      let o_html;
      try {
        o_html = await $fetch.get(o_url, { headers });
        console.log('getTracks 收到剧集响应，长度：', o_html.length);
      } catch (e) {
        console.log('getTracks 请求剧集失败：', e.message);
        continue;
      }
      const match = o_html.match(/QZOutputJson\s*=\s*({[\s\S]*?});/);
      if (match) {
        try {
          const QZOutputJson = JSON.parse(match[1]);
          QZOutputJson.results.forEach(it1 => {
            it1 = it1.fields;
            tracks.push({
              name: it1.title || '',
              id: `https://v.qq.com/x/cover/${cid}/${it1.vid}.html`,
              desc: it1.video_checkup_time || ''
            });
          });
          console.log('getTracks 解析到剧集数量：', tracks.length);
        } catch (e) {
          console.log('getTracks 解析剧集JSON失败：', e.message);
        }
      }
    }
  }

  return jsonify({
    vod,
    tracks,
    play_lists: tracks.map(it => `${it.name}\t${it.id}`).join('#'),
    play_from: ['qq']
  });
}

// 获取播放链接
async function getPlayinfo(ext) {
  console.log('getPlayinfo 开始执行，输入参数：', JSON.stringify(ext));
  const url = ext.id.split('?')[0];
  const proxyUrl = `http://127.0.0.1:9978/proxy?do=seachdanmu&go=getuserjx&url=${encodeURIComponent(url)}`;
  console.log('getPlayinfo 请求代理URL：', proxyUrl);
  try {
    const response = await $fetch.get(proxyUrl, {
      headers: { 'User-Agent': 'okhttp/3.14.9' }
    });
    console.log('getPlayinfo 收到代理响应，长度：', response.length);
    const bata = JSON.parse(response);
    console.log('getPlayinfo 代理返回URL：', bata.url);
    return jsonify({
      url: bata.url.includes('http') ? bata.url : url,
      headers: { 'User-Agent': '' },
      danmaku: `http://127.0.0.1:9978/proxy?do=danmu&site=js&url=http://dm.qxq6.com/zy/api.php?url=${encodeURIComponent(url)}`
    });
  } catch (e) {
    console.log('getPlayinfo 获取播放链接失败：', e.message);
    return jsonify({
      url,
      headers: { 'User-Agent': '' },
      danmaku: `http://127.0.0.1:9978/proxy?do=danmu&site=js&url=http://dm.qxq6.com/zy/api.php?url=${encodeURIComponent(url)}`
    });
  }
}

// 搜索视频
async function search(ext) {
  console.log('search 开始执行，输入参数：', JSON.stringify(ext));
  const query = ext.query || '';
  const page = ext.page || 1;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.139 Safari/537.36',
    'origin': 'https://v.qq.com',
    'referer': 'https://v.qq.com/'
  };

  const cards = [];
  // 网页搜索
  const searchUrl = `https://v.qq.com/x/search/?q=${encodeURIComponent(query)}&stag=fypage`;
  console.log('search 网页搜索URL：', searchUrl);
  let searchHtml;
  try {
    searchHtml = await $fetch.get(searchUrl, { headers });
    console.log('search 收到网页搜索响应，长度：', searchHtml.length);
  } catch (e) {
    console.log('search 网页搜索请求失败：', e.message);
  }

  if (searchHtml) {
    const $ = cheerio.load(searchHtml);
    $('.result_item_v').each((i, el) => {
      const title = $(el).find('.result_title a').text() || '';
      const shortText = $(el).find('.type').text() || '';
      const fromTag = $(el).find('.result_source').text() || '';
      const score = $(el).find('.figure_info').text() || '';
      const content = $(el).find('.desc_text').text() || '';
      const cid = $(el).find('div').attr('r-data') || '';
      if (fromTag.includes('腾讯') && cid) {
        const card = {
          id: `https://node.video.qq.com/x/api/float_vinfo2?cid=${cid.match(/.*\/(.*?)\.html/)[1]}`,
          title: title.replace(shortText, ''),
          cover: $(el).find('.figure_pic').attr('src') || '',
          desc: `${shortText} ${score}`,
          content
        };
        cards.push(card);
      }
    });
    console.log('search 网页搜索解析到视频数量：', cards.length);
  }

  // API搜索
  const vod1Url = `https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2`;
  const vod1Body = {
    version: "25042201",
    clientType: 1,
    filterValue: "",
    uuid: "B1E50847-D25F-4C4B-BBA0-36F0093487F6",
    retry: 0,
    query,
    pagenum: page - 1,
    isPrefetch: true,
    pagesize: 30,
    queryFrom: 0,
    searchDatakey: "",
    transInfo: "",
    isneedQc: true,
    preQid: "",
    adClientInfo: "",
    extraInfo: { isNewMarkLabel: "1", multi_terminal_pc: "1", themeType: "1", sugRelatedIds: "{}", appVersion: "" }
  };
  console.log('search API搜索URL：', vod1Url);
  let vod1Html;
  try {
    vod1Html = await $fetch.post(vod1Url, { headers, body: JSON.stringify(vod1Body) });
    console.log('search 收到API搜索响应，长度：', vod1Html.length);
  } catch (e) {
    console.log('search API搜索请求失败：', e.message);
  }

  if (vod1Html) {
    try {
      const json = JSON.parse(vod1Html);
      const list = json.data.normalList?.itemList || [];
      list.forEach(it => {
        if (it.doc.id.length > 11) {
          cards.push({
            id: it.doc.id,
            title: it.videoInfo.title || '',
            cover: it.videoInfo.imgUrl || '',
            desc: ''
          });
        }
      });
      console.log('search API搜索解析到视频数量：', cards.length);
    } catch (e) {
      console.log('search API搜索解析JSON失败：', e.message);
    }
  }

  return jsonify({ cards });
}
```