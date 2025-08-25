// 强化版：从播放页抽出直链（多策略 + 二跳跟随 + 常见解析器兜底）
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { id, sid = 1, nid = 1 } = ext;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const BASE = 'https://999tv.app';
  const playUrl = `${BASE}/index.php/vod/play/id/${id}/sid/${sid}/nid/${nid}.html`;
  const baseHeaders = { 'User-Agent': UA, 'Referer': BASE, 'Origin': BASE };

  function firstMatch(re, s) {
    const m = s.match(re);
    return m ? m[1] || m[0] : '';
  }
  function hasM3U8(s) {
    return /https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i.test(s);
  }
  function pickM3U8(s) {
    const m = s.match(/https?:\/\/[^\s'"<>]+\.m3u8(?:[^\s'"<>]*)/i);
    return m ? m[0] : '';
  }
  function tryJSONRecover(text) {
    // 容错把单引号/未引号key 转成 JSON
    try {
      let t = text.replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":')
                  .replace(/'/g, '"')
                  .replace(/,\s*}/g, '}')
                  .replace(/,\s*]/g, ']');
      return JSON.parse(t);
    } catch (e) { return null; }
  }
  function b64maybe(s) {
    try {
      // 仅短字符串尝试 base64
      if (s && /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
        const dec = $utils.base64Decode(s);
        return dec || '';
      }
    } catch(e) {}
    return '';
  }

  // STEP 0: 取播放页
  const r0 = await $fetch.get(playUrl, { headers: baseHeaders });
  const html0 = (r0 && r0.data) || '';

  // STEP 1: 直接命中 .m3u8
  if (hasM3U8(html0)) {
    return jsonify({ urls: [pickM3U8(html0)], headers: [baseHeaders] });
  }

  // STEP 2: 抓取 player JSON（AppleCMS/Art/CK/DPlayer 常见）
  // 形如：var player_aaaa = {...}; 或 window.player = {...};
  let pjsonText = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html0)
               || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html0)
               || '';
  if (pjsonText) {
    const pobj = tryJSONRecover(pjsonText);
    if (pobj) {
      let url = pobj.url || pobj.link || '';
      // 有些会把真实地址再 base64 或 urlencode 一层
      if (!/^https?:\/\//i.test(url)) {
        const u1 = decodeURIComponent(url || '');
        const u2 = b64maybe(url) || b64maybe(u1) || '';
        url = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url);
      }
      if (url) {
        // 直链 m3u8 → 直接回；否则若是 api.php?url= 这类解析器，也返回给播放器嗅探
        return jsonify({ urls: [url], headers: [baseHeaders] });
      }
    }
  }

  // STEP 3: 页面里可能内嵌 iframe 播放器，先把 iframe src 抽出来跟随一跳
  let iframeSrc = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html0) || '';
  if (iframeSrc) {
    if (!/^https?:\/\//i.test(iframeSrc)) {
      if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
      else if (iframeSrc.startsWith('/')) iframeSrc = BASE + iframeSrc;
      else iframeSrc = BASE + '/' + iframeSrc.replace(/^\.\//, '');
    }
    // 二跳请求
    const host = (iframeSrc.match(/^https?:\/\/[^/]+/i) || [BASE])[0];
    const hdr = { ...baseHeaders, Referer: playUrl, Origin: host };
    const r1 = await $fetch.get(iframeSrc, { headers: hdr });
    const html1 = (r1 && r1.data) || '';

    // 二跳直出 m3u8
    if (hasM3U8(html1)) {
      return jsonify({ urls: [pickM3U8(html1)], headers: [hdr] });
    }
    // 二跳也可能是 player JSON / api.php?url=
    let p2 = firstMatch(/player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/i, html1)
          || firstMatch(/player\s*=\s*(\{[\s\S]*?\});/i, html1) || '';
    if (p2) {
      const pobj2 = tryJSONRecover(p2);
      if (pobj2 && (pobj2.url || pobj2.link)) {
        let url2 = pobj2.url || pobj2.link;
        if (!/^https?:\/\//i.test(url2)) {
          const u1 = decodeURIComponent(url2 || '');
          const u2 = b64maybe(url2) || b64maybe(u1) || '';
          url2 = /^https?:\/\//i.test(u2) ? u2 : (/^https?:\/\//i.test(u1) ? u1 : url2);
        }
        if (url2) return jsonify({ urls: [url2], headers: [hdr] });
      }
    }
    // 再兜底：二跳页里的 iframe 套娃
    const iframe2 = firstMatch(/<iframe[^>]+src=["']([^"']+)["']/i, html1) || '';
    if (iframe2) {
      let u3 = iframe2;
      if (!/^https?:\/\//i.test(u3)) {
        if (u3.startsWith('//')) u3 = 'https:' + u3;
        else if (u3.startsWith('/')) u3 = host + u3;
        else u3 = host + '/' + u3.replace(/^\.\//, '');
      }
      return jsonify({ urls: [u3], headers: [hdr] });
    }
  }

  // STEP 4: 常见“解析器”直连（给播放器去嗅探）—— 例如 .../api.php?url=xxx
  const parserUrl = firstMatch(/https?:\/\/[^\s'"<>]+api\.php\?[^"'<>]+/i, html0);
  if (parserUrl) {
    return jsonify({ urls: [parserUrl], headers: [baseHeaders] });
  }

  // STEP 5: 实在没有，返回播放页本身，让播放器二次嗅探
  return jsonify({ urls: [playUrl], headers: [baseHeaders] });
}
