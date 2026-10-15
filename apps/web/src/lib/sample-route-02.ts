// DRAFT CONTENT for route 2 (甲山から孝子越え), converted from Navivi's export of the video
// (2_stops.csv and 2_legs.csv) by apps/api/src/import/navivi-cli.ts. Do not publish as it is:
//  - the stop names and order come from Navivi and look right, but are not checked against
//    an official source;
//  - the descriptions are the narration Navivi's AI wrote from photos: a draft, not reviewed;
//  - coordinates are NOT here on purpose: they were placed on Navivi's map and must be verified
//    from an official source before they are entered (CLAUDE.md: never guessed). The sketch is
//    straight lines between the stops, not the walked path;
//  - time, elevation, difficulty and English text do not exist yet.
// The distance is the sum of Navivi's leg distances (9.3 km). 慈眼院 is an optional stop-by.
// Shown only with SHOW_SAMPLE_CONTENT=1.

export const route02Draft = {
  nameJa: "甲山から孝子越え",
  prefecture: "wakayama",
  municipality: "和歌山市",
  distanceKm: 9.3,
  sketch: [[0.022,1],[0,0.932],[0.045,0.533],[0.1,0.336],[0.176,0.502],[0.269,0.38],[0.485,0.26],[0.657,0.266],[0.963,0]] as [number, number][],
  spots: [
  {
    "nameJa": "西ノ庄駅",
    "stopBy": false,
    "descriptionJa": "ここが今回の散策コースのスタート地点となります。"
  },
  {
    "nameJa": "西念寺",
    "stopBy": false,
    "descriptionJa": "和歌山の自然に囲まれた西念寺です。\n入り口には立派な瓦屋根の門が構えています。\n石造りの灯籠が左右に立ち、その先には重厚な本堂が見えます。"
  },
  {
    "nameJa": "葛城第二経塚",
    "stopBy": false,
    "descriptionJa": "神福寺跡にある葛城第二経塚です。石造りの小さな祠や供養塔が並んでいます。周囲を木々に囲まれたこの場所には、ベンチや石の台も置かれています。"
  },
  {
    "nameJa": "慈眼院",
    "stopBy": true,
    "descriptionJa": "時間に余裕があれば立ち寄れる地点、慈眼院です。苔むした地面が広がり、木々に囲まれています。歴史を感じさせる佇まいの建物が立っています。"
  },
  {
    "nameJa": "猿坂峠",
    "stopBy": false,
    "descriptionJa": "猿坂峠です。周囲には青々とした木々が茂っています。緩やかなカーブを描く道が、雄大な山々の間を縫うように続いています。"
  },
  {
    "nameJa": "甲山",
    "stopBy": false,
    "descriptionJa": "雄大な山々を見渡せる絶景が広がる甲山です。木製の階段の先には、空と山並みが交わる景色が見えます。目の前には案内板が立っています。"
  },
  {
    "nameJa": "三輪神社",
    "stopBy": false,
    "descriptionJa": "緑に囲まれた三輪神社です。木造の鳥居が入り口に立っています。石段を上がると、古い社殿が見えてきます。"
  },
  {
    "nameJa": "八王子峠",
    "stopBy": false,
    "descriptionJa": "木ノ本岬線沿いに位置する八王子峠です。ベンチが置かれた開けた場所からは、青い空と白い雲が広がります。周囲を豊かな緑に囲まれた、静かな景色が目の前に現れます。"
  },
  {
    "nameJa": "孝子駅",
    "stopBy": false,
    "descriptionJa": "孝子駅が今回のコースの終点となります。西ノ庄駅から9か所を巡ってきました。お疲れさまでした。"
  }
],
} as const;
