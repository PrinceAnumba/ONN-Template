// Administrative names for the synthetic fixtures. They follow the boundary files in boundaries/{ISO3}
// (see boundaries/import.ts), so every area has a shape; update both together.

export interface Geography {
  iso2: string;
  adm1: { name: string; urbanity: number; adm2: string[] }[];
}

export const GEOGRAPHY: Record<string, Geography> = {
  SEN: {
    iso2: "SN",
    adm1: [
      {
        name: "Dakar",
        urbanity: 1.42,
        adm2: ["Dakar", "Guédiawaye", "Pikine", "Rufisque"],
      },
      { name: "Thiès", urbanity: 1.12, adm2: ["Mbour", "Thiès", "Tivaouane"] },
      { name: "Saint-Louis", urbanity: 1.06, adm2: ["Dagana", "Podor", "Saint-Louis"] },
      { name: "Ziguinchor", urbanity: 1.02, adm2: ["Bignona", "Oussouye", "Ziguinchor"] },
      { name: "Diourbel", urbanity: 0.98, adm2: ["Bambey", "Diourbel", "Mbacké"] },
      { name: "Kaolack", urbanity: 0.96, adm2: ["Guinguinéo", "Kaolack", "Nioro du Rip"] },
      { name: "Louga", urbanity: 0.88, adm2: ["Kébémer", "Linguère", "Louga"] },
      { name: "Fatick", urbanity: 0.82, adm2: ["Fatick", "Foundiougne", "Gossas"] },
      { name: "Kolda", urbanity: 0.74, adm2: ["Kolda", "Médina Yoro Foulah", "Vélingara"] },
      { name: "Matam", urbanity: 0.72, adm2: ["Kanel", "Matam", "Ranérou"] },
      { name: "Sédhiou", urbanity: 0.7, adm2: ["Bounkiling", "Goudomp", "Sédhiou"] },
      {
        name: "Tambacounda",
        urbanity: 0.68,
        adm2: ["Bakel", "Goudiry", "Koumpentoum", "Tambacounda"],
      },
      {
        name: "Kaffrine",
        urbanity: 0.66,
        adm2: ["Birkelane", "Kaffrine", "Koungheul", "Malem-Hodar"],
      },
      { name: "Kédougou", urbanity: 0.6, adm2: ["Kédougou", "Salémata", "Saraya"] },
    ],
  },
  TGO: {
    iso2: "TG",
    adm1: [
      {
        name: "Maritime",
        urbanity: 1.38,
        adm2: ["Avé", "Bas-Mono", "Golfe", "Lacs", "Lomé Commune", "Vo", "Yoto", "Zio"],
      },
      {
        name: "Plateaux",
        urbanity: 0.9,
        adm2: [
          "Agou",
          "Akébou",
          "Amou",
          "Anié",
          "Danyi",
          "Est-Mono",
          "Haho",
          "Kloto",
          "Kpélé",
          "Moyen-Mono",
          "Ogou",
          "Wawa",
        ],
      },
      {
        name: "Kara",
        urbanity: 0.86,
        adm2: ["Assoli", "Bassar", "Binah", "Dankpen", "Doufelgou", "Kéran", "Kozah"],
      },
      {
        name: "Centrale",
        urbanity: 0.8,
        adm2: ["Blitta", "Mô", "Sotouboua", "Tchamba", "Tchaoudjo"],
      },
      {
        name: "Savanes",
        urbanity: 0.66,
        adm2: ["Cinkassé", "Kpendjal", "Oti", "Tandjoaré", "Tône"],
      },
    ],
  },
};

export const ECONOMIES: Record<string, { fr: string; en: string; maturity: number }> = {
  BEN: { fr: "Bénin", en: "Benin", maturity: 0.82 },
  BFA: { fr: "Burkina Faso", en: "Burkina Faso", maturity: 0.72 },
  CIV: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire", maturity: 1.08 },
  CPV: { fr: "Cabo Verde", en: "Cabo Verde", maturity: 1.24 },
  GHA: { fr: "Ghana", en: "Ghana", maturity: 1.18 },
  GIN: { fr: "Guinée", en: "Guinea", maturity: 0.74 },
  GMB: { fr: "Gambie", en: "Gambia", maturity: 0.94 },
  GNB: { fr: "Guinée-Bissau", en: "Guinea-Bissau", maturity: 0.58 },
  LBR: { fr: "Libéria", en: "Liberia", maturity: 0.66 },
  MLI: { fr: "Mali", en: "Mali", maturity: 0.76 },
  NER: { fr: "Niger", en: "Niger", maturity: 0.52 },
  NGA: { fr: "Nigéria", en: "Nigeria", maturity: 1.04 },
  SEN: { fr: "Sénégal", en: "Senegal", maturity: 1 },
  SLE: { fr: "Sierra Leone", en: "Sierra Leone", maturity: 0.64 },
  TGO: { fr: "Togo", en: "Togo", maturity: 0.88 },
};
