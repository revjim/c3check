/**
 * Test files.
 *
 * **Every file here is synthetic.** This repository is public. The names, dates
 * and places are invented; what is reproduced is the *shape* of a real export
 * and the awkwardness real exporters produce, never a real family's data.
 *
 * They are inline strings rather than files on disk, and that is not a style
 * choice: `.gitignore` blocks `*.ged`, `*.gedcom` and `*.GED` precisely so that
 * a real family tree cannot be committed by accident, so a fixture file would be
 * uncommittable and CI would fail on a missing file the first time it ran.
 */

/** A small, clean 5.5.1 export. Three generations, one line, anchor in Ontario. */
export const simpleGedcom = [
  "0 HEAD",
  "1 SOUR TestExporter",
  "1 GEDC",
  "2 VERS 5.5.1",
  "2 FORM LINEAGE-LINKED",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Alice /Fictional/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 8 AUG 1970",
  "2 PLAC London, England",
  "1 FAMC @F1@",
  "0 @I2@ INDI",
  "1 NAME Mary /Fictional/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 11 FEB 1944",
  "2 PLAC Manchester, England",
  "1 FAMC @F2@",
  "1 FAMS @F1@",
  "0 @I3@ INDI",
  "1 NAME Robert /Fictional/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 2 MAR 1912",
  "2 PLAC Toronto, Ontario, Canada",
  "1 DEAT",
  "2 DATE 14 AUG 1980",
  "1 FAMS @F2@",
  "0 @I4@ INDI",
  "1 NAME Edith /Invented/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE ABT 1915",
  "2 PLAC Liverpool, England",
  "1 FAMS @F2@",
  "0 @F1@ FAM",
  "1 WIFE @I2@",
  "1 CHIL @I1@",
  "0 @F2@ FAM",
  "1 HUSB @I3@",
  "1 WIFE @I4@",
  "1 CHIL @I2@",
  "0 TRLR",
].join("\n");

/**
 * The same three people as a GEDCOM 7.0 export, to prove the two versions parse
 * to the same model. 7.0 moved the surname out of slashes in some exporters and
 * changed the header, and neither should matter here.
 */
export const sevenPointZeroGedcom = [
  "0 HEAD",
  "1 GEDC",
  "2 VERS 7.0",
  "0 @I1@ INDI",
  "1 NAME Alice /Fictional/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 8 AUG 1970",
  "2 PLAC London, England",
  "1 FAMC @F1@",
  "0 @I2@ INDI",
  "1 NAME Mary /Fictional/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 11 FEB 1944",
  "2 PLAC Manchester, England",
  "1 FAMC @F2@",
  "1 FAMS @F1@",
  "0 @I3@ INDI",
  "1 NAME Robert /Fictional/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 2 MAR 1912",
  "2 PLAC Toronto, Ontario, Canada",
  "1 DEAT",
  "2 DATE 14 AUG 1980",
  "1 FAMS @F2@",
  "0 @F1@ FAM",
  "1 WIFE @I2@",
  "1 CHIL @I1@",
  "0 @F2@ FAM",
  "1 HUSB @I3@",
  "1 CHIL @I2@",
  "0 TRLR",
].join("\n");

/**
 * The same file as it arrives from a Windows exporter that indents, with a
 * byte-order mark on the first line and CRLF endings throughout. All three are
 * common and all three are enough to make a naive parser return nothing.
 */
export const awkwardGedcom =
  // A UTF-8 byte-order mark, written as an escape because this repository is
  // ASCII-only and because a literal one is invisible in every diff.
  "\uFEFF" +
  [
    "0 HEAD",
    "  1 GEDC",
    "    2 VERS 5.5.1",
    "0 @I1@ INDI",
    "  1 NAME Alice /Fictional/",
    "  1 BIRT",
    "    2 DATE 8 AUG 1970",
    "    2 PLAC Sudbury, Ontario, Canada",
    "0 TRLR",
  ].join("\r\n");

/**
 * A file carrying everything this parser refuses to keep: notes, sources,
 * objects, an address, a cause of death and a medical fact. The test asserts
 * that none of the text below survives parsing.
 */
export const privateGedcom = [
  "0 HEAD",
  "1 GEDC",
  "2 VERS 5.5.1",
  "0 @I1@ INDI",
  "1 NAME Alice /Fictional/",
  "1 BIRT",
  "2 DATE 8 AUG 1970",
  "2 PLAC Toronto, Ontario, Canada",
  "2 NOTE SECRETNOTE she was adopted in secret",
  "2 SOUR SECRETSOURCE parish register vol 3",
  "1 RESI",
  "2 ADDR SECRETADDRESS 14 Elm Street",
  "1 DEAT",
  "2 DATE 1 JAN 2020",
  "2 CAUS SECRETCAUSE heart failure",
  "1 OBJE",
  "2 FILE SECRETFILE /home/someone/photos/alice.jpg",
  "1 NOTE SECRETNOTE2 estranged from the family",
  "0 @N1@ NOTE SECRETNOTE3 a standalone note record",
  "0 TRLR",
].join("\n");

/** Text that says SECRET and must never survive `parseGedcom`. */
export const PRIVATE_MARKERS = [
  "SECRETNOTE",
  "SECRETSOURCE",
  "SECRETADDRESS",
  "SECRETCAUSE",
  "SECRETFILE",
  "SECRETNOTE2",
  "SECRETNOTE3",
  "Elm Street",
  "heart failure",
  "parish register",
];

/**
 * A malformed file where somebody is recorded as their own grandparent. Rare
 * but real, and without a cycle check the walk up never returns.
 */
export const cyclicGedcom = [
  "0 HEAD",
  "1 GEDC",
  "2 VERS 5.5.1",
  "0 @I1@ INDI",
  "1 NAME Loop /One/",
  "1 FAMC @F1@",
  "1 FAMS @F2@",
  "0 @I2@ INDI",
  "1 NAME Loop /Two/",
  "1 FAMC @F2@",
  "1 FAMS @F1@",
  "0 @F1@ FAM",
  "1 HUSB @I2@",
  "1 CHIL @I1@",
  "0 @F2@ FAM",
  "1 HUSB @I1@",
  "1 CHIL @I2@",
  "0 TRLR",
].join("\n");

/**
 * Two lines from one person: a short one through the mother that goes nowhere,
 * and a longer one through the father that reaches a confirmed Canadian birth.
 * The ranking has to prefer the longer one.
 */
export const twoLinesGedcom = [
  "0 HEAD",
  "1 GEDC",
  "2 VERS 5.5.1",
  "0 @I1@ INDI",
  "1 NAME Child /Fictional/",
  "1 BIRT",
  "2 DATE 1 JAN 1980",
  "2 PLAC Dublin, Ireland",
  "1 FAMC @F1@",
  "0 @I2@ INDI",
  "1 NAME Mother /Fictional/",
  "1 BIRT",
  "2 DATE 1 JAN 1950",
  "2 PLAC Dublin, Ireland",
  "1 FAMS @F1@",
  "0 @I3@ INDI",
  "1 NAME Father /Fictional/",
  "1 BIRT",
  "2 DATE 1 JAN 1948",
  "2 PLAC Dublin, Ireland",
  "1 FAMC @F2@",
  "1 FAMS @F1@",
  "0 @I4@ INDI",
  "1 NAME Grandfather /Fictional/",
  "1 BIRT",
  "2 DATE 3 MAR 1920",
  "2 PLAC Halifax, Nova Scotia, Canada",
  "1 FAMS @F2@",
  "0 @F1@ FAM",
  "1 HUSB @I3@",
  "1 WIFE @I2@",
  "1 CHIL @I1@",
  "0 @F2@ FAM",
  "1 HUSB @I4@",
  "1 CHIL @I3@",
  "0 TRLR",
].join("\n");

/** Only a baptism, which for a pre-1900 line is very often all there is. */
export const baptismOnlyGedcom = [
  "0 HEAD",
  "1 GEDC",
  "2 VERS 5.5.1",
  "0 @I1@ INDI",
  "1 NAME Ancient /Fictional/",
  "1 CHR",
  "2 DATE 12 JUN 1849",
  "2 PLAC Saint John, New Brunswick, Canada",
  "0 TRLR",
].join("\n");
