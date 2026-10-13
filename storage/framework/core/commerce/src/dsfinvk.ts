/**
 * The DSFinV-K export (Digitale Schnittstelle der Finanzverwaltung für
 * Kassensysteme, version 2.4 of 15 December 2023): the set of CSV files a
 * German till hands a tax auditor, with the `index.xml` that describes them
 * and the GDPdU DTD it names. Also `@stacksjs/commerce/dsfinvk`.
 *
 * The tables, their file names, columns, order, types, lengths and decimals
 * are those of the official `index.xml` the Bundeszentralamt für Steuern
 * publishes with the specification; which columns must be filled follows
 * Anhang G. The format follows the same `index.xml`: UTF-8, ";" between
 * columns, CRLF between records, `"` around text that needs it, "," as the
 * decimal symbol, no digit grouping, and a header row of column names.
 *
 * `dsfinvkExport` builds every file from the till's closings (Z): each
 * closing's master data, its totals per business case and payment type, and
 * each receipt with its lines, VAT, payments, references and TSE signature.
 * A row that breaks the specification (a missing mandatory value, text too
 * long, a value outside an enumeration) throws a `DsfinvkError` naming the
 * file, row and column, so a broken export is never written.
 *
 * Pure: no database and no file system. Zipping the files is the caller's.
 */
import { DE_VAT_KEYS, type DeVatKey, splitGross, tseTime } from './kassensichv'
import { GDPDU_DTD, GDPDU_DTD_FILE } from './gdpdu-dtd'

export { GDPDU_DTD, GDPDU_DTD_FILE }

export const DSFINVK_VERSION = '2.4'

export interface DsfinvkColumn {
  name: string
  description: string
  type: 'alphanumeric' | 'numeric'
  /** AlphaNumeric: the longest value. */
  maxLength?: number
  /** Numeric: decimal places. */
  accuracy?: number
}

export interface DsfinvkTable {
  file: string
  name: string
  columns: DsfinvkColumn[]
}

const alpha = (name: string, maxLength: number, description: string): DsfinvkColumn => ({ name, description, type: 'alphanumeric', maxLength })
const num = (name: string, accuracy: number, description: string): DsfinvkColumn => ({ name, description, type: 'numeric', accuracy })

/** The twenty tables, in the official index.xml's order. */
export const DSFINVK_TABLES: readonly DsfinvkTable[] = [
  { file: 'cashpointclosing.csv', name: 'Stamm_Abschluss', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('Z_BUCHUNGSTAG', 25, 'Vom Erstellungsdatum abweichender Verbuchungstag'),
    alpha('TAXONOMIE_VERSION', 10, 'Version der DFKA-Taxonomie-Kasse'),
    alpha('Z_START_ID', 40, 'Erste BON_ID im Abschluss'),
    alpha('Z_ENDE_ID', 40, 'Letzte BON_ID im Abschluss'),
    alpha('NAME', 60, 'Name des Unternehmens'),
    alpha('STRASSE', 60, 'Straße'),
    alpha('PLZ', 10, 'Postleitzahl'),
    alpha('ORT', 62, 'Ort'),
    alpha('LAND', 3, 'Land'),
    alpha('STNR', 20, 'Steuernummer des Unternehmens'),
    alpha('USTID', 15, 'USTID'),
    num('Z_SE_ZAHLUNGEN', 2, 'Summe aller Zahlungen'),
    num('Z_SE_BARZAHLUNGEN', 2, 'Summe aller Barzahlungen'),
  ] },
  { file: 'location.csv', name: 'Stamm_Orte', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('LOC_NAME', 60, 'Name des Standortes'),
    alpha('LOC_STRASSE', 60, 'Straße'),
    alpha('LOC_PLZ', 10, 'Postleitzahl'),
    alpha('LOC_ORT', 62, 'Ort'),
    alpha('LOC_LAND', 3, 'Land'),
    alpha('LOC_USTID', 15, 'USTID'),
  ] },
  { file: 'cashregister.csv', name: 'Stamm_Kassen', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('KASSE_BRAND', 50, 'Marke der Kasse'),
    alpha('KASSE_MODELL', 50, 'Modellbezeichnung'),
    alpha('KASSE_SERIENNR', 70, 'Seriennummer der Kasse'),
    alpha('KASSE_SW_BRAND', 50, 'Markenbezeichnung der Software'),
    alpha('KASSE_SW_VERSION', 50, 'Version der Software'),
    alpha('KASSE_BASISWAEH_CODE', 3, 'Basiswährung der Kasse'),
    alpha('KEINE_UST_ZUORDNUNG', 1, 'UmsatzsteuerNichtErmittelbar (bei späterem Zahlungseingang)'),
  ] },
  { file: 'slaves.csv', name: 'Stamm_Terminals', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('TERMINAL_ID', 50, 'ID des Terminals'),
    alpha('TERMINAL_BRAND', 50, 'Marke der Terminals'),
    alpha('TERMINAL_MODELL', 50, 'Modellbezeichnung des Terminals'),
    alpha('TERMINAL_SERIENNR', 70, 'Seriennummer des Terminals'),
    alpha('TERMINAL_SW_BRAND', 50, 'Markenbezeichnung der Software'),
    alpha('TERMINAL_SW_VERSION', 50, 'Version der Software'),
  ] },
  { file: 'pa.csv', name: 'Stamm_Agenturen', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    num('AGENTUR_ID', 0, 'ID der Agentur'),
    alpha('AGENTUR_NAME', 60, 'Name des Auftraggebers'),
    alpha('AGENTUR_STRASSE', 60, 'Straße'),
    alpha('AGENTUR_PLZ', 10, 'Postleitzahl'),
    alpha('AGENTUR_ORT', 62, 'Ort'),
    alpha('AGENTUR_LAND', 3, 'Land'),
    alpha('AGENTUR_STNR', 20, 'Steuernummer des Auftraggebers'),
    alpha('AGENTUR_USTID', 15, 'USTID des Auftraggebers'),
  ] },
  { file: 'tse.csv', name: 'Stamm_TSE', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    num('TSE_ID', 0, 'ID der TSE - wird nur zur Referenzierung innerhalb eines Kassenabschlusses verwendet'),
    alpha('TSE_SERIAL', 68, 'Seriennummer der TSE (Entspricht laut TR-03153 Abschnitt 7.5. dem Hashwert des im Zertifikat enthaltenen Schlüssels in Octet-String-Darstellung)'),
    alpha('TSE_SIG_ALGO', 21, 'Der von der TSE verwendete Signaturalgo-rithmus'),
    alpha('TSE_ZEITFORMAT', 31, "Das von der TSE verwendete Format für die Log-Time - 'unixTime', 'utcTime' = YYMMDDhhmmZ, 'utcTimeWithSeconds' = YYMMDDhhmmssZ, 'generalizedTime' = YYYYMMDDhhmmssZ, 'generalizedTimeWithMilliseconds' = YYYYMMDDhhmmss.fffZ"),
    alpha('TSE_PD_ENCODING', 5, 'Das Text-Encoding der ProcessData (UTF-8 oder ASCII)'),
    alpha('TSE_PUBLIC_KEY', 512, 'Öffentlicher Schlüssel - extrahiert aus dem Zertifikat der TSE - in base64-Codierung'),
    alpha('TSE_ZERTIFIKAT_I', 1000, 'Erste 1000 Zeichen des base64-codierten Zertifikats der TSE (in base64-Codierung)'),
    alpha('TSE_ZERTIFIKAT_II', 1000, 'Ggf. Rest des base64-codierten Zertifikats der TSE (in base64-Codierung)'),
  ] },
  { file: 'vat.csv', name: 'Stamm_USt', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    num('UST_SCHLUESSEL', 0, 'ID des Umsatzsteuersatzes'),
    num('UST_SATZ', 2, 'Prozentsatz'),
    alpha('UST_BESCHR', 55, 'Beschreibung'),
  ] },
  { file: 'businesscases.csv', name: 'Z_GV_Typ', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('GV_TYP', 30, 'Geschäftsvorfall-Art'),
    alpha('GV_NAME', 40, 'Name des Geschäftsvorfalls'),
    num('AGENTUR_ID', 0, 'ID der Agentur'),
    num('UST_SCHLUESSEL', 0, 'ID des USt-Satzes'),
    num('Z_UMS_BRUTTO', 5, 'Bruttoumsatz'),
    num('Z_UMS_NETTO', 5, 'Nettoumsatz'),
    num('Z_UST', 5, 'Umsatzsteuer'),
  ] },
  { file: 'payment.csv', name: 'Z_Zahlart', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('ZAHLART_TYP', 25, 'Typ der Zahlart'),
    alpha('ZAHLART_NAME', 60, 'Name der Zahlart'),
    num('Z_ZAHLART_BETRAG', 2, 'Betrag'),
  ] },
  { file: 'cash_per_currency.csv', name: 'Z_Waehrungen', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('ZAHLART_WAEH', 3, 'Währung'),
    num('ZAHLART_BETRAG_WAEH', 2, 'Betrag'),
  ] },
  { file: 'transactions.csv', name: 'Bonkopf', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    num('BON_NR', 0, 'Bonnummer'),
    alpha('BON_TYP', 30, 'Bontyp'),
    alpha('BON_NAME', 60, 'Zusatz-Beschreibung zum Bontyp'),
    alpha('TERMINAL_ID', 50, 'ID des Erfassungsterminals'),
    alpha('BON_STORNO', 1, 'Storno-Kennzeichen'),
    alpha('BON_START', 30, 'Zeitpunkt des Vorgangsstarts'),
    alpha('BON_ENDE', 30, 'Zeitpunkt der Vorgangsbeendigung'),
    alpha('BEDIENER_ID', 50, 'Bediener-ID'),
    alpha('BEDIENER_NAME', 50, 'Bediener-Name'),
    num('UMS_BRUTTO', 2, 'Brutto-Gesamtumsatz'),
    alpha('KUNDE_NAME', 50, 'Name des Leistungsempfängers'),
    alpha('KUNDE_ID', 50, 'Kundennummer des Leistungsempfängers'),
    alpha('KUNDE_TYP', 50, 'Art des Leistungsempfängers (z. B. Mitarbeiter)'),
    alpha('KUNDE_STRASSE', 60, 'Straße und Hausnummer des Leistungsempfängers'),
    alpha('KUNDE_PLZ', 10, 'PLZ des Leistungsempfängers'),
    alpha('KUNDE_ORT', 62, 'Ort des Leistungsempfängers'),
    alpha('KUNDE_LAND', 3, 'Land des Leistungsempfängers'),
    alpha('KUNDE_USTID', 15, 'UStID des Leistungsempfängers'),
    alpha('BON_NOTIZ', 255, 'Zusätzliche Informationen zum Bonkopf'),
  ] },
  { file: 'datapayment.csv', name: 'Bonkopf_Zahlarten', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('ZAHLART_TYP', 25, 'Typ der Zahlart'),
    alpha('ZAHLART_NAME', 60, 'Name der Zahlart'),
    alpha('ZAHLWAEH_CODE', 3, 'Währungscode'),
    num('ZAHLWAEH_BETRAG', 2, 'Betrag in Fremdwährung'),
    num('BASISWAEH_BETRAG', 2, 'Betrag in Basiswährung (i.d.R. EUR)'),
  ] },
  { file: 'lines.csv', name: 'Bonpos', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('POS_ZEILE', 50, 'Zeilennummer'),
    alpha('GUTSCHEIN_NR', 50, 'Gutschein-Nr.'),
    alpha('ARTIKELTEXT', 255, 'Artikeltext'),
    alpha('POS_TERMINAL_ID', 50, 'ID des POS-Terminals'),
    alpha('GV_TYP', 30, 'Geschäftsvorfall-Art'),
    alpha('GV_NAME', 40, 'Name des Geschäftsvorfalls'),
    alpha('INHAUS', 1, 'Verzehr an Ort und Stelle'),
    alpha('P_STORNO', 1, 'Positionsstorno-Kennzeichnung'),
    num('AGENTUR_ID', 0, 'ID der Agentur'),
    alpha('ART_NR', 50, 'Artikelnummer'),
    alpha('GTIN', 50, 'GTIN'),
    alpha('WARENGR_ID', 40, 'Warengruppen-ID'),
    alpha('WARENGR', 50, 'Bezeichnung Warengruppe'),
    num('MENGE', 3, 'Menge'),
    num('FAKTOR', 3, 'Faktor, z. B. Gebindegrößen'),
    alpha('EINHEIT', 50, 'Maßeinheit, z. B. kg, Liter oder Stück'),
    num('STK_BR', 5, 'Preis pro Einheit inkl. USt'),
  ] },
  { file: 'itemamounts.csv', name: 'Bonpos_Preisfindung', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('POS_ZEILE', 50, 'Zeilennummer'),
    alpha('TYP', 20, 'Basispreis, Rabatt oder Zuschlag'),
    num('UST_SCHLUESSEL', 0, 'ID des USt-Satzes'),
    num('PF_BRUTTO', 5, 'Bruttoumsatz'),
    num('PF_NETTO', 5, 'Nettoumsatz'),
    num('PF_UST', 5, 'Umsatzsteuer'),
  ] },
  { file: 'subitems.csv', name: 'Bonpos_Zusatzinfo', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('POS_ZEILE', 50, 'Zeilennummer'),
    alpha('ZI_ART_NR', 50, 'Artikelnummer'),
    alpha('ZI_GTIN', 50, 'GTIN'),
    alpha('ZI_NAME', 60, 'Artikelbezeichnung'),
    alpha('ZI_WARENGR_ID', 40, 'Warengruppen-ID'),
    alpha('ZI_WARENGR', 50, 'Bezeichnung Warengruppe'),
    num('ZI_MENGE', 3, 'Menge'),
    num('ZI_FAKTOR', 3, 'Faktor, z. B. Gebindegrößen'),
    alpha('ZI_EINHEIT', 50, 'Maßeinheit, z. B. kg, Liter oder Stück'),
    num('ZI_UST_SCHLUESSEL', 0, 'ID USt-Satz des Basispreises'),
    num('ZI_BASISPREIS_BRUTTO', 5, 'Basispreis brutto'),
    num('ZI_BASISPREIS_NETTO', 5, 'Basispreis netto'),
    num('ZI_BASISPREIS_UST', 5, 'Basispreis USt'),
  ] },
  { file: 'transactions_tse.csv', name: 'TSE_Transaktionen', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    num('TSE_ID', 0, 'Die Id der für eine Transaktion verwendeten TSE'),
    num('TSE_TANR', 0, 'Die Transaktionsnummer der TSE-Transaktion'),
    alpha('TSE_TA_START', 30, 'Die Log-Time der StartTransaction-Operation'),
    alpha('TSE_TA_ENDE', 30, 'Die Log-Time der FinishTransaction-Operation'),
    alpha('TSE_TA_VORGANGSART', 30, 'Der processType der FinishTransaction-Operation'),
    num('TSE_TA_SIGZ', 0, 'Der Signaturzähler der FinishTransaction-Operation'),
    alpha('TSE_TA_SIG', 512, 'Die Signatur der FinishTransaction-Operation'),
    alpha('TSE_TA_FEHLER', 200, 'Beschreibung des TSE-Ausfalls oder Fehlers'),
    alpha('TSE_VORGANGSDATEN', 1000, 'An die zertifizierte technische Sicherheitseinrichtung übergebene Daten des Vorgangs (optional)'),
  ] },
  { file: 'transactions_vat.csv', name: 'Bonkopf_USt', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    num('UST_SCHLUESSEL', 0, 'ID des USt-Satzes'),
    num('BON_BRUTTO', 5, 'Bruttoumsatz'),
    num('BON_NETTO', 5, 'Nettoumsatz'),
    num('BON_UST', 5, 'Umsatzsteuer'),
  ] },
  { file: 'lines_vat.csv', name: 'Bonpos_USt', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('POS_ZEILE', 50, 'Zeilennummer'),
    num('UST_SCHLUESSEL', 0, 'ID des USt-Satzes'),
    num('POS_BRUTTO', 5, 'Bruttoumsatz'),
    num('POS_NETTO', 5, 'Nettoumsatz'),
    num('POS_UST', 5, 'Umsatzsteuer'),
  ] },
  { file: 'allocation_groups.csv', name: 'Bonkopf_AbrKreis', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('ABRECHNUNGSKREIS', 50, 'z. B. Tischnummer'),
  ] },
  { file: 'references.csv', name: 'Bon_Referenzen', columns: [
    alpha('Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    alpha('Z_ERSTELLUNG', 30, 'Zeitpunkt des Kassenabschlusses'),
    num('Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('BON_ID', 40, 'Vorgangs-ID'),
    alpha('POS_ZEILE', 50, 'Zeilennummer des referenzierenden Vorgangs (nicht bei Verweis aus einem Bonkopf heraus)'),
    alpha('REF_TYP', 20, 'Art der Referenz'),
    alpha('REF_NAME', 40, 'Beschreibung bei Art “ExterneSonstige”'),
    alpha('REF_DATUM', 30, 'Datum des Kassenabschlusses'),
    alpha('REF_Z_KASSE_ID', 50, 'ID der (Abschluss-) Kasse'),
    num('REF_Z_NR', 0, 'Nr. des Kassenabschlusses'),
    alpha('REF_BON_ID', 40, 'Vorgangs-ID'),
  ] },
]

export type DsfinvkTableName = 'Stamm_Abschluss' | 'Stamm_Orte' | 'Stamm_Kassen' | 'Stamm_Terminals' | 'Stamm_Agenturen' | 'Stamm_TSE' | 'Stamm_USt'
  | 'Z_GV_Typ' | 'Z_Zahlart' | 'Z_Waehrungen'
  | 'Bonkopf' | 'Bonkopf_Zahlarten' | 'Bonpos' | 'Bonpos_Preisfindung' | 'Bonpos_Zusatzinfo' | 'TSE_Transaktionen' | 'Bonkopf_USt' | 'Bonpos_USt' | 'Bonkopf_AbrKreis' | 'Bon_Referenzen'

export function dsfinvkTable(name: DsfinvkTableName): DsfinvkTable {
  const table = DSFINVK_TABLES.find(entry => entry.name === name)
  if (!table) throw new Error(`Unknown DSFinV-K table ${name}`)
  return table
}

/**
 * The columns that must be filled (Anhang G's "Mussfelder"), beyond the
 * closing's key (Z_KASSE_ID, Z_ERSTELLUNG, Z_NR) every table has. A TSE row
 * that records a failure (TSE_TA_FEHLER) has no signature to fill in.
 */
export const DSFINVK_MANDATORY: Readonly<Record<DsfinvkTableName, readonly string[]>> = {
  Stamm_Abschluss: ['TAXONOMIE_VERSION', 'Z_START_ID', 'Z_ENDE_ID', 'NAME', 'STRASSE', 'PLZ', 'ORT', 'LAND', 'Z_SE_ZAHLUNGEN', 'Z_SE_BARZAHLUNGEN'],
  Stamm_Orte: ['LOC_NAME', 'LOC_STRASSE', 'LOC_PLZ', 'LOC_ORT', 'LOC_LAND'],
  Stamm_Kassen: ['KASSE_SERIENNR', 'KASSE_BASISWAEH_CODE'],
  Stamm_Terminals: ['TERMINAL_ID', 'TERMINAL_SERIENNR'],
  Stamm_Agenturen: ['AGENTUR_ID', 'AGENTUR_NAME', 'AGENTUR_STRASSE', 'AGENTUR_PLZ', 'AGENTUR_ORT', 'AGENTUR_LAND'],
  Stamm_TSE: ['TSE_ID', 'TSE_SERIAL', 'TSE_SIG_ALGO', 'TSE_ZEITFORMAT', 'TSE_PD_ENCODING', 'TSE_PUBLIC_KEY', 'TSE_ZERTIFIKAT_I'],
  Stamm_USt: ['UST_SCHLUESSEL', 'UST_SATZ', 'UST_BESCHR'],
  Z_GV_Typ: ['GV_TYP', 'UST_SCHLUESSEL', 'Z_UMS_BRUTTO', 'Z_UMS_NETTO', 'Z_UST'],
  Z_Zahlart: ['ZAHLART_TYP', 'Z_ZAHLART_BETRAG'],
  Z_Waehrungen: ['ZAHLART_WAEH', 'ZAHLART_BETRAG_WAEH'],
  Bonkopf: ['BON_ID', 'BON_NR', 'BON_TYP', 'BON_STORNO', 'BON_START', 'BON_ENDE', 'BEDIENER_ID', 'UMS_BRUTTO'],
  Bonkopf_Zahlarten: ['BON_ID', 'ZAHLART_TYP', 'ZAHLWAEH_CODE', 'BASISWAEH_BETRAG'],
  Bonpos: ['BON_ID', 'POS_ZEILE', 'ARTIKELTEXT', 'GV_TYP'],
  Bonpos_Preisfindung: ['BON_ID', 'POS_ZEILE', 'UST_SCHLUESSEL'],
  Bonpos_Zusatzinfo: ['BON_ID', 'POS_ZEILE', 'ZI_ART_NR', 'ZI_MENGE', 'ZI_UST_SCHLUESSEL'],
  TSE_Transaktionen: ['BON_ID', 'TSE_ID', 'TSE_TANR', 'TSE_TA_START', 'TSE_TA_ENDE', 'TSE_TA_VORGANGSART', 'TSE_TA_SIGZ', 'TSE_TA_SIG'],
  Bonkopf_USt: ['BON_ID', 'UST_SCHLUESSEL', 'BON_BRUTTO', 'BON_NETTO', 'BON_UST'],
  Bonpos_USt: ['BON_ID', 'POS_ZEILE', 'UST_SCHLUESSEL'],
  Bonkopf_AbrKreis: ['BON_ID'],
  Bon_Referenzen: ['BON_ID', 'REF_TYP', 'REF_BON_ID'],
}

/** The values DSFinV-K allows in its closed lists. */
export const DSFINVK_ENUMS = {
  BON_TYP: ['Beleg', 'AVTransfer', 'AVBestellung', 'AVTraining', 'AVBelegstorno', 'AVBelegabbruch', 'AVSachbezug', 'AVRechnung', 'AVSonstige'],
  GV_TYP: [
    'Umsatz', 'Pfand', 'PfandRueckzahlung', 'Rabatt', 'Aufschlag', 'ZuschussEcht', 'ZuschussUnecht', 'TrinkgeldAG', 'TrinkgeldAN',
    'EinzweckgutscheinKauf', 'EinzweckgutscheinEinloesung', 'MehrzweckgutscheinKauf', 'MehrzweckgutscheinEinloesung',
    'Forderungsentstehung', 'Forderungsaufloesung', 'Anzahlungseinstellung', 'Anzahlungsaufloesung',
    'Anfangsbestand', 'Privatentnahme', 'Privateinlage', 'Geldtransit', 'Lohnzahlung', 'Einzahlung', 'Auszahlung', 'DifferenzSollIst',
  ],
  ZAHLART_TYP: ['Bar', 'Unbar', 'Keine', 'ECKarte', 'Kreditkarte', 'ElZahlungsdienstleister', 'Guthabenkarte'],
  REF_TYP: ['ExterneRechnung', 'ExternerLieferschein', 'Transaktion', 'ExterneSonstige'],
  TSE_TA_VORGANGSART: ['Kassenbeleg-V1', 'Bestellung-V1', 'SonstigerVorgang'],
  TSE_ZEITFORMAT: ['unixTime', 'utcTime', 'utcTimeWithSeconds', 'generalizedTime', 'generalizedTimeWithMilliseconds'],
  TSE_PD_ENCODING: ['UTF-8', 'ASCII'],
  FLAG: ['0', '1'],
} as const

export type DsfinvkZahlartTyp = typeof DSFINVK_ENUMS.ZAHLART_TYP[number]
export type DsfinvkGvTyp = typeof DSFINVK_ENUMS.GV_TYP[number]
export type DsfinvkBonTyp = typeof DSFINVK_ENUMS.BON_TYP[number]

const ENUM_COLUMNS: Record<string, readonly string[]> = {
  BON_TYP: DSFINVK_ENUMS.BON_TYP,
  GV_TYP: DSFINVK_ENUMS.GV_TYP,
  ZAHLART_TYP: DSFINVK_ENUMS.ZAHLART_TYP,
  REF_TYP: DSFINVK_ENUMS.REF_TYP,
  TSE_TA_VORGANGSART: DSFINVK_ENUMS.TSE_TA_VORGANGSART,
  TSE_ZEITFORMAT: DSFINVK_ENUMS.TSE_ZEITFORMAT,
  TSE_PD_ENCODING: DSFINVK_ENUMS.TSE_PD_ENCODING,
  BON_STORNO: DSFINVK_ENUMS.FLAG,
  P_STORNO: DSFINVK_ENUMS.FLAG,
  INHAUS: DSFINVK_ENUMS.FLAG,
  KEINE_UST_ZUORDNUNG: DSFINVK_ENUMS.FLAG,
}

/** ISO 8601 with seconds, as Z_ERSTELLUNG, BON_START and the like are written. */
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/
const TSE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export class DsfinvkError extends Error {
  constructor(readonly table: string, readonly row: number, readonly column: string, problem: string) {
    super(`${table} row ${row}, ${column}: ${problem}`)
    this.name = 'DsfinvkError'
  }
}

export type DsfinvkValue = string | number | null | undefined
export type DsfinvkRow = Record<string, DsfinvkValue>

/** A numeric value with its column's decimals and "," as the decimal symbol. */
export function dsfinvkNumber(value: number, accuracy: number): string {
  if (!Number.isFinite(value)) throw new Error('Not a number')
  return value.toFixed(accuracy).replace('.', ',')
}

/** A cent amount as a DSFinV-K money value ("12,34", "-5,00"), at `accuracy` decimals (2 or 5). */
export function dsfinvkMoney(cents: number, accuracy = 2): string {
  if (!Number.isSafeInteger(cents)) throw new Error('An amount must be whole cents')
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const decimals = String(abs % 100).padStart(2, '0') + '0'.repeat(Math.max(0, accuracy - 2))
  return `${sign}${Math.floor(abs / 100)}${accuracy > 0 ? `,${decimals}` : ''}`
}

/** Text as the CSV writes it: in quotes (with quotes doubled) when it holds ";", a quote or a line break. */
export function dsfinvkText(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Every problem with one row of a table, as messages naming the column (empty when it is valid). */
export function dsfinvkRowProblems(table: DsfinvkTable, row: DsfinvkRow): Array<{ column: string, problem: string }> {
  const problems: Array<{ column: string, problem: string }> = []
  const known = new Set(table.columns.map(column => column.name))
  for (const key of Object.keys(row)) if (!known.has(key)) problems.push({ column: key, problem: 'is not a column of this table' })
  const filled = (name: string) => row[name] !== undefined && row[name] !== null && row[name] !== ''
  const failedTse = table.name === 'TSE_Transaktionen' && filled('TSE_TA_FEHLER')
  const mandatory = ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', ...(DSFINVK_MANDATORY[table.name as DsfinvkTableName] ?? [])]
  for (const name of mandatory) {
    if (failedTse && ['TSE_TANR', 'TSE_TA_START', 'TSE_TA_ENDE', 'TSE_TA_SIGZ', 'TSE_TA_SIG'].includes(name)) continue
    if (!filled(name)) problems.push({ column: name, problem: 'must be filled' })
  }
  if (table.name === 'Stamm_Abschluss' && !filled('STNR') && !filled('USTID'))
    problems.push({ column: 'STNR', problem: 'a tax number (STNR) or VAT id (USTID) is needed' })
  for (const column of table.columns) {
    const value = row[column.name]
    if (value === undefined || value === null || value === '') continue
    if (column.type === 'numeric') {
      const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
      if (!Number.isFinite(number)) problems.push({ column: column.name, problem: `is not a number (${String(value)})` })
      else if ((column.accuracy ?? 0) === 0 && !Number.isInteger(number)) problems.push({ column: column.name, problem: 'must be a whole number' })
      continue
    }
    const text = String(value)
    if (column.maxLength && [...text].length > column.maxLength) problems.push({ column: column.name, problem: `is longer than ${column.maxLength} characters` })
    const allowed = ENUM_COLUMNS[column.name]
    if (allowed && !allowed.includes(text)) problems.push({ column: column.name, problem: `"${text}" is not one of ${allowed.join(', ')}` })
    if (column.name === 'KASSE_SERIENNR' && /[/_]/.test(text)) problems.push({ column: column.name, problem: 'may contain neither "/" nor "_"' })
    if (['Z_ERSTELLUNG', 'BON_START', 'BON_ENDE', 'REF_DATUM'].includes(column.name) && !DATETIME.test(text)) problems.push({ column: column.name, problem: `is not an ISO 8601 time (${text})` })
    if (['TSE_TA_START', 'TSE_TA_ENDE'].includes(column.name) && !TSE_DATETIME.test(text)) problems.push({ column: column.name, problem: `is not YYYY-MM-DDThh:mm:ss.fffZ (${text})` })
    if (column.name === 'Z_BUCHUNGSTAG' && !DATE.test(text)) problems.push({ column: column.name, problem: `is not a date (${text})` })
    if (column.name === 'TSE_VORGANGSDATEN' && text !== text.trim()) problems.push({ column: column.name, problem: 'may not start or end with a space' })
  }
  return problems
}

/** One table as its CSV file: a header row and one record per row, CRLF-separated. Throws on the first invalid row. */
export function dsfinvkCsv(table: DsfinvkTable, rows: readonly DsfinvkRow[]): string {
  const lines = [table.columns.map(column => column.name).join(';')]
  rows.forEach((row, index) => {
    const problem = dsfinvkRowProblems(table, row)[0]
    if (problem) throw new DsfinvkError(table.name, index + 1, problem.column, problem.problem)
    lines.push(table.columns.map((column) => {
      const value = row[column.name]
      if (value === undefined || value === null || value === '') return ''
      if (column.type === 'numeric') return typeof value === 'number' ? dsfinvkNumber(value, column.accuracy ?? 0) : String(value)
      return dsfinvkText(String(value))
    }).join(';'))
  })
  return `${lines.join('\r\n')}\r\n`
}

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The index.xml describing the tables (all twenty unless given), in the shape of the official one. */
export function dsfinvkIndexXml(tables: readonly DsfinvkTable[] = DSFINVK_TABLES, supplier: { name?: string, location?: string } = {}): string {
  const out: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!DOCTYPE DataSet SYSTEM "${GDPDU_DTD_FILE}">`,
    '<DataSet>',
    '  <Version>1.0</Version>',
    '  <DataSupplier>',
    supplier.name ? `    <Name>${xmlText(supplier.name)}</Name>` : '    <Name />',
    supplier.location ? `    <Location>${xmlText(supplier.location)}</Location>` : '    <Location />',
    '    <Comment>Datentraegerueberlassung nach GDPdU vom 12.11.2010</Comment>',
    '  </DataSupplier>',
    '  <Media>',
    '    <Name>CD Nummer 1</Name>',
  ]
  for (const table of tables) {
    out.push(
      '    <Table>',
      `      <URL>${table.file}</URL>`,
      `      <Name>${table.name}</Name>`,
      `      <Description>${table.file}</Description>`,
      '      <UTF8 />',
      '      <DecimalSymbol>,</DecimalSymbol>',
      '      <DigitGroupingSymbol>.</DigitGroupingSymbol>',
      '      <Range>',
      '        <From>2</From>',
      '      </Range>',
      '      <VariableLength>',
      '        <ColumnDelimiter>;</ColumnDelimiter>',
      '        <RecordDelimiter>&#xD;&#xA;</RecordDelimiter>',
      '        <TextEncapsulator>"</TextEncapsulator>',
    )
    for (const column of table.columns) {
      out.push('        <VariableColumn>', `          <Name>${column.name}</Name>`, `          <Description>${xmlText(column.description)}</Description>`)
      if (column.type === 'alphanumeric') {
        out.push('          <AlphaNumeric />')
        if (column.maxLength) out.push(`          <MaxLength>${column.maxLength}</MaxLength>`)
      }
      else if (column.accuracy) {
        out.push('          <Numeric>', `            <Accuracy>${column.accuracy}</Accuracy>`, '          </Numeric>')
      }
      else {
        out.push('          <Numeric />')
      }
      out.push('        </VariableColumn>')
    }
    out.push('      </VariableLength>', '    </Table>')
  }
  out.push('  </Media>', '</DataSet>')
  return `${out.join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------------
// From a till's closings to the files
// ---------------------------------------------------------------------------

export interface DsfinvkCompany {
  name: string
  street: string
  postalCode: string
  city: string
  /** ISO 3166 alpha-3, e.g. DEU. */
  country: string
  taxNumber?: string | null
  vatId?: string | null
}

export interface DsfinvkRegister {
  /** Z_KASSE_ID: the till's id in the export. */
  id: string
  serialNumber: string
  brand?: string
  model?: string
  softwareBrand?: string
  softwareVersion?: string
  /** ISO 4217, e.g. EUR. */
  currency: string
}

export interface DsfinvkTse {
  /** Its number within the closing (TSE_ID). */
  id: number
  /** The TSE's serial number (hex). */
  serial: string
  signatureAlgorithm: string
  timeFormat: string
  encoding?: 'UTF-8' | 'ASCII'
  /** Base64. */
  publicKey: string
  /** Base64; split into 1000-character parts. */
  certificate: string
}

export interface DsfinvkLine {
  /** POS_ZEILE: unique and consecutive within the receipt. */
  lineNumber: number
  text: string
  businessCase?: DsfinvkGvTyp
  /** ART_NR: the article number (a SKU or product id). */
  articleNumber?: string | null
  gtin?: string | null
  groupId?: string | null
  group?: string | null
  /** MENGE. */
  quantity: number
  /** STK_BR: the gross unit price, in cents. */
  unitGrossCents: number
  /** The line's gross amount (quantity times the unit price, after any discount), in cents. */
  grossCents: number
  vatKey: DeVatKey
  voided?: boolean
}

export interface DsfinvkPayment {
  type: DsfinvkZahlartTyp
  /** ZAHLART_NAME, e.g. a card brand. */
  name?: string | null
  /** In the till's currency, in cents. */
  cents: number
  /** When paid in another currency: its code and the amount in it. */
  currency?: string
  foreignCents?: number | null
}

export interface DsfinvkReference {
  type: 'Transaktion' | 'ExterneRechnung' | 'ExternerLieferschein' | 'ExterneSonstige'
  name?: string | null
  /** For a reference to an earlier transaction of a till: when it was, its till, its closing and its BON_ID. */
  date?: string | null
  registerId?: string | null
  zNumber?: number | null
  bonId: string
  lineNumber?: number | null
}

export interface DsfinvkTseTransaction {
  tseId: number
  /** Null when the TSE failed and the transaction is unsigned. */
  transactionNumber: number | null
  start: string | number | Date | null
  end: string | number | Date | null
  processType: 'Kassenbeleg-V1' | 'Bestellung-V1' | 'SonstigerVorgang'
  signatureCounter: number | null
  signature: string | null
  /** What went wrong with the TSE, for an unsigned transaction. */
  error?: string | null
  processData?: string | null
}

export interface DsfinvkTransaction {
  /** BON_ID: unique within the till. */
  id: string
  /** BON_NR: the receipt's number. */
  number: number
  type?: DsfinvkBonTyp
  name?: string | null
  terminalId?: string | null
  /** BON_STORNO: the receipt reverses an earlier one. */
  voided?: boolean
  /** The till's own times (ISO 8601). */
  start: string
  end: string
  operatorId: string
  operatorName?: string | null
  customer?: { name?: string | null, id?: string | null, type?: string | null } | null
  note?: string | null
  lines: DsfinvkLine[]
  payments: DsfinvkPayment[]
  references?: DsfinvkReference[]
  tse?: DsfinvkTseTransaction | null
  allocationGroup?: string | null
}

export interface DsfinvkClosing {
  register: DsfinvkRegister
  /** Z_NR: the closing's running number for this till. */
  number: number
  /** Z_ERSTELLUNG: when the closing was made (ISO 8601). */
  createdAt: string
  /** Z_BUCHUNGSTAG, when it books on another day than it was made. */
  businessDate?: string | null
  company: DsfinvkCompany
  location: { name: string, street: string, postalCode: string, city: string, country: string, vatId?: string | null }
  terminals?: Array<{ id: string, serialNumber: string, brand?: string, model?: string, softwareBrand?: string, softwareVersion?: string }>
  tses: DsfinvkTse[]
  transactions: DsfinvkTransaction[]
}

/** The DFKA taxonomy version the closing data follows (TAXONOMIE_VERSION). */
export const DFKA_TAXONOMY_VERSION = '2.4'

export interface DsfinvkFile { name: string, content: string }

/** Every file of an export of these closings: twenty CSVs, index.xml and the DTD. Throws DsfinvkError on invalid data. */
export function dsfinvkExport(closings: readonly DsfinvkClosing[], options: { supplier?: { name?: string, location?: string } } = {}): DsfinvkFile[] {
  const rows = new Map<DsfinvkTableName, DsfinvkRow[]>(DSFINVK_TABLES.map(table => [table.name as DsfinvkTableName, []]))
  const add = (table: DsfinvkTableName, row: DsfinvkRow) => rows.get(table)!.push(row)
  let certificateParts = 2

  for (const closing of closings) {
    const key = { Z_KASSE_ID: closing.register.id, Z_ERSTELLUNG: closing.createdAt, Z_NR: closing.number }
    let allPayments = 0
    let cashPayments = 0
    const businessCases = new Map<string, { type: string, vatKey: DeVatKey, gross: number }>()
    const paymentTotals = new Map<string, { type: string, name: string | null, cents: number }>()
    const cashByCurrency = new Map<string, number>()
    const vatKeys = new Set<DeVatKey>()

    for (const transaction of closing.transactions) {
      const lineNumbers = new Set<number>()
      const vatGross = new Map<DeVatKey, number>()
      for (const line of transaction.lines) {
        if (lineNumbers.has(line.lineNumber)) throw new DsfinvkError('Bonpos', 0, 'POS_ZEILE', `${line.lineNumber} appears twice in receipt ${transaction.id}`)
        lineNumbers.add(line.lineNumber)
        if (!(line.vatKey in DE_VAT_KEYS)) throw new DsfinvkError('Bonpos_USt', 0, 'UST_SCHLUESSEL', `${line.vatKey} is not a VAT key this export knows`)
        vatKeys.add(line.vatKey)
        vatGross.set(line.vatKey, (vatGross.get(line.vatKey) ?? 0) + line.grossCents)
        const split = splitGross(line.grossCents, DE_VAT_KEYS[line.vatKey].rate)
        add('Bonpos', {
          ...key,
          BON_ID: transaction.id,
          POS_ZEILE: String(line.lineNumber),
          ARTIKELTEXT: line.text,
          GV_TYP: line.businessCase ?? 'Umsatz',
          INHAUS: '0',
          P_STORNO: line.voided ? '1' : '0',
          AGENTUR_ID: 0,
          ART_NR: line.articleNumber ?? '',
          GTIN: line.gtin ?? '',
          WARENGR_ID: line.groupId ?? '',
          WARENGR: line.group ?? '',
          MENGE: line.quantity,
          FAKTOR: 1,
          STK_BR: line.unitGrossCents / 100,
        })
        add('Bonpos_USt', { ...key, BON_ID: transaction.id, POS_ZEILE: String(line.lineNumber), UST_SCHLUESSEL: line.vatKey, POS_BRUTTO: dsfinvkMoney(line.grossCents, 5), POS_NETTO: dsfinvkMoney(split.net, 5), POS_UST: dsfinvkMoney(split.vat, 5) })
        if ((transaction.type ?? 'Beleg') === 'Beleg') {
          const caseKey = `${line.businessCase ?? 'Umsatz'}:${line.vatKey}`
          const entry = businessCases.get(caseKey) ?? { type: line.businessCase ?? 'Umsatz', vatKey: line.vatKey, gross: 0 }
          entry.gross += line.grossCents
          businessCases.set(caseKey, entry)
        }
      }
      const gross = [...vatGross.values()].reduce((sum, cents) => sum + cents, 0)
      add('Bonkopf', {
        ...key,
        BON_ID: transaction.id,
        BON_NR: transaction.number,
        BON_TYP: transaction.type ?? 'Beleg',
        BON_NAME: transaction.name ?? '',
        TERMINAL_ID: transaction.terminalId ?? '',
        BON_STORNO: transaction.voided ? '1' : '0',
        BON_START: transaction.start,
        BON_ENDE: transaction.end,
        BEDIENER_ID: transaction.operatorId,
        BEDIENER_NAME: transaction.operatorName ?? '',
        UMS_BRUTTO: dsfinvkMoney(gross),
        KUNDE_NAME: transaction.customer?.name ?? '',
        KUNDE_ID: transaction.customer?.id ?? '',
        KUNDE_TYP: transaction.customer?.type ?? '',
        BON_NOTIZ: transaction.note ?? '',
      })
      // The receipt's own VAT per key (what it printed), not a sum of the lines' rounded VAT.
      for (const [vatKey, cents] of [...vatGross.entries()].sort(([a], [b]) => a - b)) {
        const split = splitGross(cents, DE_VAT_KEYS[vatKey].rate)
        add('Bonkopf_USt', { ...key, BON_ID: transaction.id, UST_SCHLUESSEL: vatKey, BON_BRUTTO: dsfinvkMoney(cents, 5), BON_NETTO: dsfinvkMoney(split.net, 5), BON_UST: dsfinvkMoney(split.vat, 5) })
      }
      if (transaction.allocationGroup) add('Bonkopf_AbrKreis', { ...key, BON_ID: transaction.id, ABRECHNUNGSKREIS: transaction.allocationGroup })
      const paid = transaction.payments.reduce((sum, payment) => sum + payment.cents, 0)
      if ((transaction.type ?? 'Beleg') === 'Beleg' && paid !== gross)
        throw new DsfinvkError('Bonkopf_Zahlarten', 0, 'BASISWAEH_BETRAG', `receipt ${transaction.id} was paid ${paid} cents for ${gross} cents of goods`)
      for (const payment of transaction.payments) {
        const currency = (payment.currency || closing.register.currency).toUpperCase()
        add('Bonkopf_Zahlarten', {
          ...key,
          BON_ID: transaction.id,
          ZAHLART_TYP: payment.type,
          ZAHLART_NAME: payment.name ?? '',
          ZAHLWAEH_CODE: currency,
          ZAHLWAEH_BETRAG: payment.foreignCents == null ? '' : dsfinvkMoney(payment.foreignCents),
          BASISWAEH_BETRAG: dsfinvkMoney(payment.cents),
        })
        if ((transaction.type ?? 'Beleg') !== 'Beleg') continue
        allPayments += payment.cents
        const totalKey = `${payment.type}:${payment.name ?? ''}`
        const total = paymentTotals.get(totalKey) ?? { type: payment.type, name: payment.name ?? null, cents: 0 }
        total.cents += payment.cents
        paymentTotals.set(totalKey, total)
        if (payment.type === 'Bar') {
          cashPayments += payment.cents
          cashByCurrency.set(currency, (cashByCurrency.get(currency) ?? 0) + (payment.foreignCents ?? payment.cents))
        }
      }
      for (const reference of transaction.references ?? []) {
        add('Bon_Referenzen', {
          ...key,
          BON_ID: transaction.id,
          POS_ZEILE: reference.lineNumber == null ? '' : String(reference.lineNumber),
          REF_TYP: reference.type,
          REF_NAME: reference.name ?? '',
          REF_DATUM: reference.type === 'Transaktion' ? (reference.date ?? '') : '',
          REF_Z_KASSE_ID: reference.type === 'Transaktion' ? (reference.registerId ?? '') : '',
          REF_Z_NR: reference.type === 'Transaktion' ? (reference.zNumber ?? '') : '',
          REF_BON_ID: reference.bonId,
        })
      }
      if (transaction.tse) {
        const tse = transaction.tse
        add('TSE_Transaktionen', {
          ...key,
          BON_ID: transaction.id,
          TSE_ID: tse.tseId,
          TSE_TANR: tse.transactionNumber ?? '',
          TSE_TA_START: tse.start == null ? '' : tseTime(tse.start),
          TSE_TA_ENDE: tse.end == null ? '' : tseTime(tse.end),
          TSE_TA_VORGANGSART: tse.processType,
          TSE_TA_SIGZ: tse.signatureCounter ?? '',
          TSE_TA_SIG: tse.signature ?? '',
          TSE_TA_FEHLER: tse.error ?? '',
          TSE_VORGANGSDATEN: tse.processData ?? '',
        })
      }
    }

    const sorted = [...closing.transactions].sort((a, b) => a.number - b.number)
    add('Stamm_Abschluss', {
      ...key,
      Z_BUCHUNGSTAG: closing.businessDate ?? '',
      TAXONOMIE_VERSION: DFKA_TAXONOMY_VERSION,
      Z_START_ID: sorted[0]?.id ?? '',
      Z_ENDE_ID: sorted[sorted.length - 1]?.id ?? '',
      NAME: closing.company.name,
      STRASSE: closing.company.street,
      PLZ: closing.company.postalCode,
      ORT: closing.company.city,
      LAND: closing.company.country,
      STNR: closing.company.taxNumber ?? '',
      USTID: closing.company.vatId ?? '',
      Z_SE_ZAHLUNGEN: dsfinvkMoney(allPayments),
      Z_SE_BARZAHLUNGEN: dsfinvkMoney(cashPayments),
    })
    add('Stamm_Orte', { ...key, LOC_NAME: closing.location.name, LOC_STRASSE: closing.location.street, LOC_PLZ: closing.location.postalCode, LOC_ORT: closing.location.city, LOC_LAND: closing.location.country, LOC_USTID: closing.location.vatId ?? '' })
    add('Stamm_Kassen', {
      ...key,
      KASSE_BRAND: closing.register.brand ?? '',
      KASSE_MODELL: closing.register.model ?? '',
      KASSE_SERIENNR: closing.register.serialNumber,
      KASSE_SW_BRAND: closing.register.softwareBrand ?? '',
      KASSE_SW_VERSION: closing.register.softwareVersion ?? '',
      KASSE_BASISWAEH_CODE: closing.register.currency.toUpperCase(),
      KEINE_UST_ZUORDNUNG: vatKeys.has(7) ? '1' : '',
    })
    for (const terminal of closing.terminals ?? []) {
      add('Stamm_Terminals', { ...key, TERMINAL_ID: terminal.id, TERMINAL_BRAND: terminal.brand ?? '', TERMINAL_MODELL: terminal.model ?? '', TERMINAL_SERIENNR: terminal.serialNumber, TERMINAL_SW_BRAND: terminal.softwareBrand ?? '', TERMINAL_SW_VERSION: terminal.softwareVersion ?? '' })
    }
    for (const tse of closing.tses) {
      const parts = tse.certificate.match(/.{1,1000}/gs) ?? ['']
      certificateParts = Math.max(certificateParts, parts.length)
      const row: DsfinvkRow = {
        ...key,
        TSE_ID: tse.id,
        TSE_SERIAL: tse.serial,
        TSE_SIG_ALGO: tse.signatureAlgorithm,
        TSE_ZEITFORMAT: tse.timeFormat,
        TSE_PD_ENCODING: tse.encoding ?? 'UTF-8',
        TSE_PUBLIC_KEY: tse.publicKey,
      }
      parts.forEach((part, index) => { row[certificateColumn(index)] = part })
      add('Stamm_TSE', row)
    }
    for (const vatKey of [...vatKeys].sort((a, b) => a - b)) {
      const info = DE_VAT_KEYS[vatKey]
      add('Stamm_USt', { ...key, UST_SCHLUESSEL: vatKey, UST_SATZ: info.rate, UST_BESCHR: info.description })
    }
    for (const entry of [...businessCases.values()].sort((a, b) => a.type.localeCompare(b.type) || a.vatKey - b.vatKey)) {
      const split = splitGross(entry.gross, DE_VAT_KEYS[entry.vatKey].rate)
      add('Z_GV_Typ', { ...key, GV_TYP: entry.type, GV_NAME: '', AGENTUR_ID: 0, UST_SCHLUESSEL: entry.vatKey, Z_UMS_BRUTTO: dsfinvkMoney(entry.gross, 5), Z_UMS_NETTO: dsfinvkMoney(split.net, 5), Z_UST: dsfinvkMoney(split.vat, 5) })
    }
    for (const total of paymentTotals.values()) add('Z_Zahlart', { ...key, ZAHLART_TYP: total.type, ZAHLART_NAME: total.name ?? '', Z_ZAHLART_BETRAG: dsfinvkMoney(total.cents) })
    for (const [currency, cents] of [...cashByCurrency.entries()].sort(([a], [b]) => a.localeCompare(b))) add('Z_Waehrungen', { ...key, ZAHLART_WAEH: currency, ZAHLART_BETRAG_WAEH: dsfinvkMoney(cents) })
  }

  const tables = DSFINVK_TABLES.map(table => table.name === 'Stamm_TSE' ? withCertificateParts(table, certificateParts) : table)
  const files: DsfinvkFile[] = tables.map(table => ({ name: table.file, content: dsfinvkCsv(table, rows.get(table.name as DsfinvkTableName)!) }))
  files.push({ name: 'index.xml', content: dsfinvkIndexXml(tables, options.supplier) })
  files.push({ name: GDPDU_DTD_FILE, content: GDPDU_DTD.replace(/\r?\n/g, '\r\n') })
  return files
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function certificateColumn(index: number): string {
  if (index >= ROMAN.length) throw new Error('A TSE certificate longer than 10000 characters')
  return `TSE_ZERTIFIKAT_${ROMAN[index]}`
}

/** Stamm_TSE with TSE_ZERTIFIKAT_III and on when a certificate is longer than 2000 characters (Anhang E). */
export function withCertificateParts(table: DsfinvkTable, parts: number): DsfinvkTable {
  if (parts <= 2) return table
  const extra: DsfinvkColumn[] = []
  for (let index = 2; index < parts; index++) extra.push(alpha(certificateColumn(index), 1000, 'Ggf. Rest des base64-codierten Zertifikats der TSE (in base64-Codierung)'))
  return { ...table, columns: [...table.columns, ...extra] }
}

/** The VAT key's rate and DSFinV-K description. */
export function vatKeyInfo(key: DeVatKey): { rate: number, description: string } {
  return { rate: DE_VAT_KEYS[key].rate, description: DE_VAT_KEYS[key].description }
}
