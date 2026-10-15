/**
 * Starting content for a fresh database (WBS 1.2.3). Skeletons only: everything else
 * (distance, video, descriptions, coordinates) is filled in through the CMS.
 */

/**
 * The 19 routes, in order. Names are from the project workbook, which takes them from
 * the official site (katsuragisyugen-nihonisan.com).
 */
export const SEED_ROUTES: readonly { nameJa: string; nameEn: string }[] = [
  { nameJa: "友ヶ島と加太周辺", nameEn: "Tomogashima and Kada Surroundings" },
  { nameJa: "甲山から孝子越え", nameEn: "From Mt. Kabuto across Kyōshi-tōge" },
  { nameJa: "飯盛山から札立山", nameEn: "From Mt. Iimori to Mt. Fudatate" },
  { nameJa: "大福山から雲山峰", nameEn: "From Mt. Daifuku to the peak of Mt. Unzan" },
  { nameJa: "山中渓から雄ノ山峠越え", nameEn: "From Yamanakadani and over Onoyama-tōge Pass" },
  { nameJa: "神通から根来寺", nameEn: "From Jintsuu to Negoro-ji Temple" },
  { nameJa: "志野峠から中津川・粉河寺へ", nameEn: "From Shino-tōge Pass to Nakatsugawa and Kokawa-dera Temple" },
  { nameJa: "犬鳴山", nameEn: "Inunakisan" },
  { nameJa: "和泉葛城山", nameEn: "Mount Izumi-Katsuragi" },
  { nameJa: "七越峠から桧原越え", nameEn: "From Nanakoshi-tōge Pass and over Hibara" },
  { nameJa: "四郷、堀越から光滝寺へ", nameEn: "From Shigo and Horikoshi to Kotaki-ji Temple" },
  { nameJa: "南葛城山", nameEn: "Mount Minami-Katsuragi" },
  { nameJa: "流谷から岩湧寺・天見不動", nameEn: "From Nagaredani to Iwawaki-ji Temple and Amami-fudo" },
  { nameJa: "岩瀬経塚山から神福山", nameEn: "From Mount Kyōzuka in Iwase to Mount Jinpuku" },
  { nameJa: "金剛山", nameEn: "Mount Kongō" },
  { nameJa: "葛城の道", nameEn: "Katsuragi no Michi Route" },
  { nameJa: "岩橋山", nameEn: "Mount Iwahashi" },
  { nameJa: "二上山", nameEn: "Mount Nijō" },
  { nameJa: "明神山から亀の瀬", nameEn: "From Mount Myōjin to Kamenose" },
];

export const SEED_SPOT_COUNT = 28;

/**
 * 28 placeholder spots (the sutra mounds). Real names, routes and coordinates are not known
 * yet and are never guessed: they are drafts with no coordinates, which the database will not
 * let anyone publish. They all start on the first route; move them to the right route in the CMS.
 */
export function seedSpots(): { nameJa: string; nameEn: string; sortOrder: number }[] {
  return Array.from({ length: SEED_SPOT_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { nameJa: `スポット${n}（仮）`, nameEn: `Spot ${n} (placeholder)`, sortOrder: i + 1 };
  });
}
