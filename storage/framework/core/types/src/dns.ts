export interface ARecord {
  name: string | '@' | '*'
  address: string // IPv4
  ttl?: number | 'auto'
}

export interface CNameRecord {
  name: string
  target: string
  ttl: number | 'auto'
}

export interface MXRecord {
  name: string | '@'
  mailServer: string
  ttl: number | 'auto'
  priority: number // 0-65535
}

export interface TxtRecord {
  name: string | '@'
  ttl: number | 'auto'
  content: string
}

export interface AAAARecord {
  name: string | '@' | '*'
  address: string // IPv6
  ttl: number | 'auto'
}

export type DnsRecord = ARecord | CNameRecord | MXRecord | TxtRecord | AAAARecord

type CountryCode =
  | 'AC'
  | 'AD'
  | 'AE'
  | 'AF'
  | 'AG'
  | 'AI'
  | 'AL'
  | 'AM'
  | 'AN'
  | 'AO'
  | 'AQ'
  | 'AR'
  | 'AS'
  | 'AT'
  | 'AU'
  | 'AW'
  | 'AX'
  | 'AZ'
  | 'BA'
  | 'BB'
  | 'BD'
  | 'BE'
  | 'BF'
  | 'BG'
  | 'BH'
  | 'BI'
  | 'BJ'
  | 'BL'
  | 'BM'
  | 'BN'
  | 'BO'
  | 'BQ'
  | 'BR'
  | 'BS'
  | 'BT'
  | 'BV'
  | 'BW'
  | 'BY'
  | 'BZ'
  | 'CA'
  | 'CC'
  | 'CD'
  | 'CF'
  | 'CG'
  | 'CH'
  | 'CI'
  | 'CK'
  | 'CL'
  | 'CM'
  | 'CN'
  | 'CO'
  | 'CR'
  | 'CU'
  | 'CV'
  | 'CW'
  | 'CX'
  | 'CY'
  | 'CZ'
  | 'DE'
  | 'DJ'
  | 'DK'
  | 'DM'
  | 'DO'
  | 'DZ'
  | 'EC'
  | 'EE'
  | 'EG'
  | 'EH'
  | 'ER'
  | 'ES'
  | 'ET'
  | 'FI'
  | 'FJ'
  | 'FK'
  | 'FM'
  | 'FO'
  | 'FR'
  | 'GA'
  | 'GB'
  | 'GD'
  | 'GE'
  | 'GF'
  | 'GG'
  | 'GH'
  | 'GI'
  | 'GL'
  | 'GM'
  | 'GN'
  | 'GP'
  | 'GQ'
  | 'GR'
  | 'GS'
  | 'GT'
  | 'GU'
  | 'GW'
  | 'GY'
  | 'HK'
  | 'HM'
  | 'HN'
  | 'HR'
  | 'HT'
  | 'HU'
  | 'ID'
  | 'IE'
  | 'IL'
  | 'IM'
  | 'IN'
  | 'IO'
  | 'IQ'
  | 'IR'
  | 'IS'
  | 'IT'
  | 'JE'
  | 'JM'
  | 'JO'
  | 'JP'
  | 'KE'
  | 'KG'
  | 'KH'
  | 'KI'
  | 'KM'
  | 'KN'
  | 'KP'
  | 'KR'
  | 'KW'
  | 'KY'
  | 'KZ'
  | 'LA'
  | 'LB'
  | 'LC'
  | 'LI'
  | 'LK'
  | 'LR'
  | 'LS'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'LY'
  | 'MA'
  | 'MC'
  | 'MD'
  | 'ME'
  | 'MF'
  | 'MG'
  | 'MH'
  | 'MK'
  | 'ML'
  | 'MM'
  | 'MN'
  | 'MO'
  | 'MP'
  | 'MQ'
  | 'MR'
  | 'MS'
  | 'MT'
  | 'MU'
  | 'MV'
  | 'MW'
  | 'MX'
  | 'MY'
  | 'MZ'
  | 'NA'
  | 'NC'
  | 'NE'
  | 'NF'
  | 'NG'
  | 'NI'
  | 'NL'
  | 'NO'
  | 'NP'
  | 'NR'
  | 'NU'
  | 'NZ'
  | 'OM'
  | 'PA'
  | 'PE'
  | 'PF'
  | 'PG'
  | 'PH'
  | 'PK'
  | 'PL'
  | 'PM'
  | 'PN'
  | 'PR'
  | 'PS'
  | 'PT'
  | 'PW'
  | 'PY'
  | 'QA'
  | 'RE'
  | 'RO'
  | 'RS'
  | 'RU'
  | 'RW'
  | 'SA'
  | 'SB'
  | 'SC'
  | 'SD'
  | 'SE'
  | 'SG'
  | 'SH'
  | 'SI'
  | 'SJ'
  | 'SK'
  | 'SL'
  | 'SM'
  | 'SN'
  | 'SO'
  | 'SR'
  | 'SS'
  | 'ST'
  | 'SV'
  | 'SX'
  | 'SY'
  | 'SZ'
  | 'TC'
  | 'TD'
  | 'TF'
  | 'TG'
  | 'TH'
  | 'TJ'
  | 'TK'
  | 'TL'
  | 'TM'
  | 'TN'
  | 'TO'
  | 'TP'
  | 'TR'
  | 'TT'
  | 'TV'
  | 'TW'
  | 'TZ'
  | 'UA'
  | 'UG'
  | 'US'
  | 'UY'
  | 'UZ'
  | 'VA'
  | 'VC'
  | 'VE'
  | 'VG'
  | 'VI'
  | 'VN'
  | 'VU'
  | 'WF'
  | 'WS'
  | 'YE'
  | 'YT'
  | 'ZA'
  | 'ZM'
  | 'ZW'
  | string

export interface ExtraParam {
  /**
   * The name of an additional parameter that is required by a top-level domain.
   * Here are the top-level domains that require additional parameters and the names of the parameters that they require:
   * .com.au and .net.au     AU_ID_NUMBER     AU_ID_TYPE
   * Valid values include the following:    ABN (Australian business number)    ACN (Australian company number)    TM (Trademark number)      .ca     BRAND_NUMBER     CA_BUSINESS_ENTITY_TYPE
   * Valid values include the following:    BANK (Bank)    COMMERCIAL_COMPANY (Commercial company)    COMPANY (Company)    COOPERATION (Cooperation)    COOPERATIVE (Cooperative)    COOPRIX (Cooprix)    CORP (Corporation)    CREDIT_UNION (Credit union)    FOMIA (Federation of mutual insurance associations)    INC (Incorporated)    LTD (Limited)    LTEE (Limitée)    LLC (Limited liability corporation)    LLP (Limited liability partnership)    LTE (Lte.)    MBA (Mutual benefit association)    MIC (Mutual insurance company)    NFP (Not-for-profit corporation)    SA (S.A.)    SAVINGS_COMPANY (Savings company)    SAVINGS_UNION (Savings union)    SARL (Société à responsabilité limitée)    TRUST (Trust)    ULC (Unlimited liability corporation)      CA_LEGAL_TYPE
   * When ContactType is PERSON, valid values include the following:    ABO (Aboriginal Peoples indigenous to Canada)    CCT (Canadian citizen)    LGR (Legal Representative of a Canadian Citizen or Permanent Resident)    RES (Permanent resident of Canada)
   * When ContactType is a value other than PERSON, valid values include the following:    ASS (Canadian unincorporated association)    CCO (Canadian corporation)    EDU (Canadian educational institution)    GOV (Government or government entity in Canada)    HOP (Canadian Hospital)    INB (Indian Band recognized by the Indian Act of Canada)    LAM (Canadian Library, Archive, or Museum)    MAJ (Her/His Majesty the Queen/King)    OMK (Official mark registered in Canada)    PLT (Canadian Political Party)    PRT (Partnership Registered in Canada)    TDM (Trademark registered in Canada)    TRD (Canadian Trade Union)    TRS (Trust established in Canada)      .es     ES_IDENTIFICATION
   * The value of ES_IDENTIFICATION depends on the following values:   The value of ES_LEGAL_FORM    The value of ES_IDENTIFICATION_TYPE
   * If ES_LEGAL_FORM is any value other than INDIVIDUAL:    Specify 1 letter + 8 numbers (CIF [Certificado de Identificación Fiscal])   Example: B12345678
   * If ES_LEGAL_FORM is INDIVIDUAL, the value that you specify for ES_IDENTIFICATION depends on the value of ES_IDENTIFICATION_TYPE:
   * If ES_IDENTIFICATION_TYPE is DNI_AND_NIF (for Spanish contacts):   Specify 8 numbers + 1 letter (DNI [Documento Nacional de Identidad], NIF [Número de Identificación Fiscal])   Example: 12345678M
   * If ES_IDENTIFICATION_TYPE is NIE (for foreigners with legal residence):   Specify 1 letter + 7 numbers + 1 letter ( NIE [Número de Identidad de Extranjero])   Example: Y1234567X
   * If ES_IDENTIFICATION_TYPE is OTHER (for contacts outside of Spain):   Specify a passport number, drivers license number, or national identity card number        ES_IDENTIFICATION_TYPE
   * Valid values include the following:    DNI_AND_NIF (For Spanish contacts)    NIE (For foreigners with legal residence)    OTHER (For contacts outside of Spain)      ES_LEGAL_FORM
   * Valid values include the following:    ASSOCIATION     CENTRAL_GOVERNMENT_BODY     CIVIL_SOCIETY     COMMUNITY_OF_OWNERS     COMMUNITY_PROPERTY     CONSULATE     COOPERATIVE     DESIGNATION_OF_ORIGIN_SUPERVISORY_COUNCIL     ECONOMIC_INTEREST_GROUP     EMBASSY     ENTITY_MANAGING_NATURAL_AREAS     FARM_PARTNERSHIP     FOUNDATION     GENERAL_AND_LIMITED_PARTNERSHIP     GENERAL_PARTNERSHIP     INDIVIDUAL     LIMITED_COMPANY     LOCAL_AUTHORITY     LOCAL_PUBLIC_ENTITY     MUTUAL_INSURANCE_COMPANY     NATIONAL_PUBLIC_ENTITY     ORDER_OR_RELIGIOUS_INSTITUTION
   * OTHERS (Only for contacts outside of Spain)     POLITICAL_PARTY     PROFESSIONAL_ASSOCIATION     PUBLIC_LAW_ASSOCIATION     PUBLIC_LIMITED_COMPANY     REGIONAL_GOVERNMENT_BODY     REGIONAL_PUBLIC_ENTITY     SAVINGS_BANK     SPANISH_OFFICE     SPORTS_ASSOCIATION     SPORTS_FEDERATION     SPORTS_LIMITED_COMPANY     TEMPORARY_ALLIANCE_OF_ENTERPRISES     TRADE_UNION     WORKER_OWNED_COMPANY     WORKER_OWNED_LIMITED_COMPANY       .eu      EU_COUNTRY_OF_CITIZENSHIP     .fi     BIRTH_DATE_IN_YYYY_MM_DD     FI_BUSINESS_NUMBER     FI_ID_NUMBER     FI_NATIONALITY
   * Valid values include the following:    FINNISH     NOT_FINNISH       FI_ORGANIZATION_TYPE  Valid values include the following:    COMPANY     CORPORATION     GOVERNMENT     INSTITUTION     POLITICAL_PARTY     PUBLIC_COMMUNITY     TOWNSHIP       .it     IT_NATIONALITY     IT_PIN     IT_REGISTRANT_ENTITY_TYPE
   * Valid values include the following:    FOREIGNERS     FREELANCE_WORKERS (Freelance workers and professionals)    ITALIAN_COMPANIES (Italian companies and one-person companies)    NON_PROFIT_ORGANIZATIONS     OTHER_SUBJECTS     PUBLIC_ORGANIZATIONS       .ru     BIRTH_DATE_IN_YYYY_MM_DD     RU_PASSPORT_DATA     .se     BIRTH_COUNTRY     SE_ID_NUMBER     .sg     SG_ID_NUMBER     .uk, .co.uk, .me.uk, and .org.uk     UK_CONTACT_TYPE
   * Valid values include the following:    CRC (UK Corporation by Royal Charter)    FCORP (Non-UK Corporation)    FIND (Non-UK Individual, representing self)    FOTHER (Non-UK Entity that does not fit into any other category)    GOV (UK Government Body)    IND (UK Individual (representing self))    IP (UK Industrial/Provident Registered Company)    LLP (UK Limited Liability Partnership)    LTD (UK Limited Company)    OTHER (UK Entity that does not fit into any other category)    PLC (UK Public Limited Company)    PTNR (UK Partnership)    RCHAR (UK Registered Charity)    SCH (UK School)    STAT (UK Statutory Body)    STRA (UK Sole Trader)      UK_COMPANY_NUMBER
   * In addition, many TLDs require a VAT_NUMBER.
   */
  Name: ExtraParamName
  /**
   * The value that corresponds with the name of an extra parameter.
   */
  Value: ExtraParamValue
}
export type ExtraParamList = ExtraParam[]
export type ExtraParamName =
  | 'DUNS_NUMBER'
  | 'BRAND_NUMBER'
  | 'BIRTH_DEPARTMENT'
  | 'BIRTH_DATE_IN_YYYY_MM_DD'
  | 'BIRTH_COUNTRY'
  | 'BIRTH_CITY'
  | 'DOCUMENT_NUMBER'
  | 'AU_ID_NUMBER'
  | 'AU_ID_TYPE'
  | 'CA_LEGAL_TYPE'
  | 'CA_BUSINESS_ENTITY_TYPE'
  | 'CA_LEGAL_REPRESENTATIVE'
  | 'CA_LEGAL_REPRESENTATIVE_CAPACITY'
  | 'ES_IDENTIFICATION'
  | 'ES_IDENTIFICATION_TYPE'
  | 'ES_LEGAL_FORM'
  | 'FI_BUSINESS_NUMBER'
  | 'FI_ID_NUMBER'
  | 'FI_NATIONALITY'
  | 'FI_ORGANIZATION_TYPE'
  | 'IT_NATIONALITY'
  | 'IT_PIN'
  | 'IT_REGISTRANT_ENTITY_TYPE'
  | 'RU_PASSPORT_DATA'
  | 'SE_ID_NUMBER'
  | 'SG_ID_NUMBER'
  | 'VAT_NUMBER'
  | 'UK_CONTACT_TYPE'
  | 'UK_COMPANY_NUMBER'
  | 'EU_COUNTRY_OF_CITIZENSHIP'
  | 'AU_PRIORITY_TOKEN'
  | string
export type ExtraParamValue = string

export interface ContactInfo extends ContactDetail {
  admin?: ContactDetail // defaults to registrant
  tech?: ContactDetail // defaults to registrant
}

/**
 * **DNS Options**
 *
 * This configuration defines all of your DNS options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @see https://stacksjs.org/docs/dns
 */
export interface DnsOptions {
  driver: 'aws'
  a: ARecord[]
  aaaa: AAAARecord[]
  cname: CNameRecord[]
  mx: MXRecord[]
  txt: TxtRecord[]
  nameservers: string[]
  contactInfo: Partial<ContactInfo>
  redirects: string[]
}

export type DnsConfig = Partial<DnsOptions>

export interface ContactDetail {
  /**
   * First name of contact.
   */
  firstName: string
  /**
   * Last name of contact.
   */
  lastName: string
  /**
   * Indicates whether the contact is a person, company, association, or public organization.
   *
   * Note the following:
   * If you specify a value other than PERSON, you must also specify a value for OrganizationName.
   * For some TLDs, the privacy protection available depends on the value that you specify for Contact Type.
   * For the privacy protection settings for your TLD, see Domains that You Can Register with Amazon Route 53 in the Amazon Route 53 Developer Guide
   * For .es domains, the value of ContactType must be PERSON for all three contacts.
   *
   * @default PERSON
   */
  contactType: 'PERSON' | 'COMPANY' | 'ASSOCIATION' | 'PUBLIC_BODY' | 'RESELLER' | string
  /**
   * Name of the organization for contact types other than PERSON.
   */
  organizationName: string
  /**
   * First line of the contact's address.
   */
  addressLine1: string
  /**
   * Second line of contact's address, if any.
   */
  addressLine2: string
  /**
   * The city of the contact's address.
   */
  city: string
  /**
   * The state or province of the contact's city.
   */
  state: string
  /**
   * Code for the country of the contact's address.
   */
  countryCode: CountryCode
  /**
   * The zip or postal code of the contact's address.
   */
  zip: string
  /**
   * The phone number of the contact.
   * Constraints: Phone number must be specified in the format "+[country dialing code].[number including any area code&gt;]".
   * For example, a US phone number might appear as "+1.1234567890".
   * @example +1.1234567890
   */
  phoneNumber: string
  /**
   * Email address of the contact.
   */
  email: string
  /**
   * Fax number of the contact. Constraints: Phone number must be specified in the format "+[country dialing code].[number including any area code]". For example, a US phone number might appear as "+1.1234567890".
   */
  fax: string
  /**
   * A list of name-value pairs for parameters required by certain top-level domains.
   */
  extraParams: string

  /**
   * Enable privacy protection for this domain.
   * @default true
   */
  privacy: boolean
  /**
   * Enable privacy protection for the admin contact.
   * @default true
   */
  privacyAdmin: boolean
  /**
   * Enable privacy protection for the tech contact.
   * @default true
   */
  privacyTech: boolean
  /**
   * Enable privacy protection for the registrant contact.
   * @default true
   */
  privacyRegistrant: boolean
}
