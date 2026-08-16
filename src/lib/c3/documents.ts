/**
 * What to go and find.
 *
 * Every fact in the catalogue names a document set. When the engine reports a
 * person as `undetermined`, it names the fact *and* these documents; "we cannot
 * answer this" is only half an answer, and the useful half is the other one.
 *
 * These are suggestions for a self-represented applicant, not a checklist IRCC
 * publishes. Nothing here is legal advice.
 */

export type DocumentKey =
  | "loss-of-british-subject-status"
  | "residence-on-pivot-date"
  | "canadian-naturalisation"
  | "canadian-domicile"
  | "declaration-of-alienage"
  | "canadian-citizenship-record"
  | "renunciation"
  | "loss-and-restoration"
  | "adoption"
  | "registration-of-birth-abroad"
  | "crown-service"
  | "physical-presence"
  | "citizenship-certificate"
  | "diplomatic-status"
  | "date-of-death";

export const DOCUMENTS: Record<DocumentKey, string[]> = {
  "loss-of-british-subject-status": [
    "Foreign naturalisation certificate or petition, with its date",
    "A negative search letter from the national archive and the county or district court where they lived, if they did not naturalise",
    "Marriage certificate, for a woman who married before 1947, with evidence of the husband's nationality at the date of the marriage",
    "Census returns and passenger lists showing declared nationality over time",
  ],
  "residence-on-pivot-date": [
    "Census returns for 1941 or 1951 showing the household in Canada",
    "Voters' lists, city directories, tax or school records for the year in question",
    "Landing record (Form 1000 / IMM 1000) or border-entry record",
  ],
  "canadian-naturalisation": [
    "Canadian naturalisation certificate or the naturalisation index entry (Library and Archives Canada)",
    "A negative search result from Library and Archives Canada, if they did not naturalise",
  ],
  "canadian-domicile": [
    "Landing record showing the date of admission for permanent residence",
    "Evidence of five continuous years of residence after landing: directories, tax records, employment records",
  ],
  "declaration-of-alienage": [
    "A search of the Canadian citizenship and naturalisation records for a declaration of alienage",
    "Family papers, declarations were uncommon and are usually remembered",
  ],
  "canadian-citizenship-record": [
    "Search of Citizenship Records (form CIT 0058) from IRCC",
    "Any Canadian citizenship certificate, card or naturalisation record held by the family",
  ],
  renunciation: [
    "Search of Citizenship Records (CIT 0058), a renunciation is recorded against the file",
    "The renunciation certificate itself, if the family holds it",
  ],
  "loss-and-restoration": [
    "Search of Citizenship Records (CIT 0058), which shows any loss under the former section 8 retention rule and any later resumption",
    "Any correspondence from the citizenship registrar about retention before the 28th birthday",
  ],
  adoption: [
    "Adoption order or final decree",
    "The pre-adoption birth registration, where it can be released",
  ],
  "registration-of-birth-abroad": [
    "Certificate of Registration of Birth Abroad, if one was issued",
    "Search of Citizenship Records (CIT 0058), which will show a registration under the 1946 or 1952 Act",
  ],
  "crown-service": [
    "Service record or letter of employment showing the posting was outside Canada with the Canadian Armed Forces, the federal public administration or a provincial public service",
    "Evidence the person was not locally engaged; the exception does not reach locally engaged staff",
  ],
  "physical-presence": [
    "Form CIT 0555, the parental physical presence declaration",
    "Passport stamps, entry and exit records, school and employment records covering every period in Canada before the birth",
  ],
  "citizenship-certificate": [
    "The citizenship certificate itself, or a Search of Citizenship Records (CIT 0058) confirming whether one was ever issued",
  ],
  "diplomatic-status": [
    "Evidence of the parents' status in Canada at the birth: accreditation records, or a permanent resident landing record showing they were not accredited",
  ],
  "date-of-death": [
    "Death certificate, or a burial or probate record",
    "A census or directory entry after the date in question, if the point is only that they were still alive",
  ],
};
