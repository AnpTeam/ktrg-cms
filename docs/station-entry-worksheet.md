# Station positions worksheet (T5)

For each course, the stations and bus stops people use to reach it need a position, so the navigation can offer
「ここから行く」 (our walking route, Google Maps, Yahoo). **Coordinates are never guessed**: a person looks each one up in a
named source, checks it on the map, and only then ticks 位置を確認した. Until then visitors never see the position.

## Where to enter
管理 > ルート > (the course) > アクセス・交通 tab (`AccessPointsEditor`). The entries (name, note, type) usually exist
already; for each one fill:

| Field | What to put |
| --- | --- |
| 緯度 / 経度 | Decimal degrees, 5 decimals (about 1 m). Latitude first (about 34.x), longitude second (about 135.x). |
| どちら側の入口か | スタート側 / ゴール側 / どちらでも: which end of the course the station serves (the card lists nearer ends first). |
| 位置の出どころ | The name of where you looked it up (see below), for example 「国土地理院 地理院地図」 or the operator's page. |
| 位置を確認した | Tick only after 「地図で位置を見る」 shows the pin on the right station or stop. |

## How to look a position up
1. Open 地理院地図 (maps.gsi.go.jp), search the station name, zoom to the station building or the bus stop pole.
2. Right-click (long-press on a phone) on it; the 「この地点の情報」 panel shows 緯度経度 in decimal degrees. Copy both.
3. Paste into the admin, press 「地図で位置を見る」, confirm the pin is on the station / stop, set the side, write the source, tick 位置を確認した, save the route.
4. A bus stop needs the stop itself (the pole on the correct side of the road), not the nearest street corner. If the operator's own stop page gives a position, use that and name it as the source.
5. If unsure, leave 位置を確認した unticked. An unchecked entry still shows its name; it just has no map buttons.

## Course by course (about 40 entries in all)
Tick a row when all of its entries are entered **and** checked. Add the stations the course's アクセス tab already lists.

| # | Course | Entries on the アクセス tab | Entered | Sides set | Sources named | Checked on map | Saved | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 友ヶ島と加太周辺 | | | | | | | |
| 2 | 甲山から孝子越え | | | | | | | |
| 3 | 飯盛山から札立山 | | | | | | | |
| 4 | 大福山から雲山峰 | | | | | | | |
| 5 | 山中渓から雄ノ山峠越え | | | | | | | |
| 6 | 神通から根来寺 | | | | | | | |
| 7 | 志野峠から中津川・粉河寺へ | | | | | | | |
| 8 | 犬鳴山 | | | | | | | |
| 9 | 和泉葛城山 | | | | | | | |
| 10 | 七越峠から桧原越え | | | | | | | |
| 11 | 四郷、堀越から光滝寺へ | | | | | | | |
| 12 | 南葛城山 | | | | | | | |
| 13 | 流谷から岩湧寺・天見不動 | | | | | | | |
| 14 | 岩瀬経塚山から神福山 | | | | | | | |
| 15 | 金剛山 | | | | | | | |
| 16 | 葛城の道 | | | | | | | |
| 17 | 岩橋山 | | | | | | | |
| 18 | 二上山 | | | | | | | |
| 19 | 明神山から亀の瀬 | | | | | | | |

Also set 「遠いとみなす距離」 for a course when 5 km is not right (the far card shows only beyond that distance).

When a batch is done, T4 follows: open a few of them on a real phone with Google Maps and Yahoo installed and not installed.
