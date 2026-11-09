// Curated mainland-China domains that should stay DIRECT even if the
// GeoSite database is unavailable or incomplete. This list intentionally
// contains only suffix matches; GEOSITE,cn / GEOIP,CN remain as the broad
// fallback after these explicit rules.
export const CN_DIRECT_DOMAINS = [...new Set([
  // Portal / search / maps
  'baidu.com', 'bdstatic.com', 'bdimg.com', 'bcebos.com', 'hao123.com',
  'amap.com', 'autonavi.com', 'gaode.com',
  // Tencent / WeChat
  'qq.com', 'tencent.com', 'tencent-cloud.com', 'myqcloud.com', 'qcloud.com',
  'weixin.qq.com', 'wechat.com', 'qpic.cn', 'qlogo.cn', 'gtimg.cn',
  'qidian.com', 'tencentmusic.com', 'kugou.com', 'kuwo.cn',
  // Alibaba
  'alibaba.com', 'alibaba-inc.com', 'aliyun.com', 'aliyuncs.com', 'alicdn.com',
  'alipay.com', 'alipayobjects.com', 'taobao.com', 'taobao.net', 'tmall.com',
  '1688.com', 'alimama.com', 'dingtalk.com', 'wps.cn', 'kingsoft.com',
  // ByteDance
  'bytedance.com', 'douyin.com', 'douyinvod.com', 'byteimg.com', 'pstatp.com',
  'snssdk.com', 'amemv.com', 'toutiao.com', 'ixigua.com', 'feishu.cn',
  'feishu.net', 'larkoffice.com', 'bytednsdoc.com',
  // NetEase
  '163.com', '126.com', '126.net', 'netease.com', 'netease.im',
  'lofter.com', 'youdao.com',
  // E-commerce / local life
  'jd.com', '360buyimg.com', 'jd.hk', 'pinduoduo.com', 'yangkeduo.com',
  'suning.com', 'vip.com', 'mogujie.com', 'kaola.com',
  'meituan.com', 'meituan.net', 'dianping.com', 'ele.me', 'elemecdn.com',
  'xiaohongshu.com', 'xhscdn.com', 'kuaishou.com', 'gifshow.com', 'kwimgs.com',
  // Video / music / live
  'bilibili.com', 'bilivideo.com', 'hdslb.com', 'b23.tv', 'biligame.com',
  'iqiyi.com', 'qiyi.com', 'iqiyipic.com', 'youku.com', 'ykimg.com',
  'mgtv.com', 'hitv.com', 'le.com', 'pptv.com', 'sohu.com',
  'douyu.com', 'huya.com', 'yy.com', 'migu.cn',
  // Social / news / knowledge
  'weibo.com', 'weibo.cn', 'sina.com.cn', 'sina.cn', 'sinaimg.cn',
  'zhihu.com', 'zhimg.com', 'people.com.cn', 'xinhuanet.com', 'news.cn',
  'cctv.com', 'cnr.cn', 'cri.cn', 'thepaper.cn', 'caixin.com', 'yicai.com',
  'chinadaily.com.cn',
  // Travel / transport
  '12306.cn', 'ctrip.com', 'qunar.com', 'ly.com', 'tujia.com', '17u.cn',
  'didiglobal.com', 'xiaojukeji.com', 'diditaxi.com.cn',
  // Hardware / cloud / carriers
  'huawei.com', 'huaweicloud.com', 'hicloud.com', 'vmall.com',
  'xiaomi.com', 'mi.com', 'miui.com', 'xiaomi.net',
  'oppo.com', 'coloros.com', 'vivo.com', 'oneplus.com', 'meizu.com',
  'lenovo.com.cn', 'lenovo.cn',
  '10086.cn', 'chinamobile.com', '10010.com', 'chinaunicom.com',
  '189.cn', 'chinatelecom.com.cn', 'ct10000.com',
  // Finance / government / education
  'icbc.com.cn', 'ccb.com', 'abchina.com', 'boc.cn', 'cmbchina.com',
  'gov.cn', 'edu.cn', 'cnnic.cn', 'people.cn',
  // Games / tools
  'perfectworld.com.cn', '37.com', '4399.com', '7k7k.com',
  'xunlei.com', 'onlinedown.net', 'crsky.com',
])];

export const CN_DIRECT_COUNT = CN_DIRECT_DOMAINS.length;
