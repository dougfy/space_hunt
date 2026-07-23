/** Canonical star name list — shared between client and server. */
export const STAR_NAMES: string[] = [
  'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella',
  'Rigel', 'Procyon', 'Betelgeuse', 'Altair', 'Aldebaran',
  'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Deneb',
  'Regulus', 'Achernar', 'Castor', 'Gacrux', 'Bellatrix',
  'Elnath', 'Miaplacidus', 'Alnilam', 'Alioth', 'Dubhe',
  'Mirfak', 'Wezen', 'Sargas', 'Kaus', 'Avior',
  'Alkaid', 'Menkalinan', 'Atria', 'Alhena', 'Peacock',
  'Mirzam', 'Alphard', 'Hamal', 'Polaris', 'Nunki',
  'Mirach', 'Alpheratz', 'Rasalhague', 'Kochab', 'Saiph',
  'Denebola', 'Algol', 'Tiaki', 'Muhlifain', 'Aspidiske',
  'Suhail', 'Alphecca', 'Mintaka', 'Sadr', 'Eltanin',
  'Diphda', 'Naos', 'Mizar', 'Schedar', 'Aludra',
  'Alderamin', 'Markeb', 'Enif', 'Sabik', 'Phecda',
  'Scheat', 'Algieba', 'Zuben', 'Ankaa', 'Girtab',
  'Kraz', 'Rasalgethi', 'Cebalrai', 'Sheliak', 'Kornephoros',
  'Lesath', 'Izar', 'Dschubba', 'Acrab', 'Unukalhai',
  'Albireo', 'Tarazed', 'Sadalmelik', 'Algenib', 'Markab',
  'Phact', 'Tureis', 'Caph', 'Ruchbah', 'Merak',
  'Alcyone', 'Thuban', 'Hadar', 'Acrux', 'Mimosa',
  'Shaula', 'Alnair', 'Rasalhague', 'Vindemiatrix', 'Zubeneschamali',
];

export function getStarName(index: number): string {
  return STAR_NAMES[index % STAR_NAMES.length];
}
