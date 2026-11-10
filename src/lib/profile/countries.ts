/** Countries with dialling codes: Egypt first, then MENA, then the rest A–Z. */
export type Country = { name: string; code: string; dial: string };

const MENA: Country[] = [
  { name: "Egypt", code: "EG", dial: "+20" },
  { name: "Saudi Arabia", code: "SA", dial: "+966" },
  { name: "United Arab Emirates", code: "AE", dial: "+971" },
  { name: "Qatar", code: "QA", dial: "+974" },
  { name: "Kuwait", code: "KW", dial: "+965" },
  { name: "Bahrain", code: "BH", dial: "+973" },
  { name: "Oman", code: "OM", dial: "+968" },
  { name: "Jordan", code: "JO", dial: "+962" },
  { name: "Lebanon", code: "LB", dial: "+961" },
  { name: "Palestine", code: "PS", dial: "+970" },
  { name: "Iraq", code: "IQ", dial: "+964" },
  { name: "Syria", code: "SY", dial: "+963" },
  { name: "Yemen", code: "YE", dial: "+967" },
  { name: "Morocco", code: "MA", dial: "+212" },
  { name: "Algeria", code: "DZ", dial: "+213" },
  { name: "Tunisia", code: "TN", dial: "+216" },
  { name: "Libya", code: "LY", dial: "+218" },
  { name: "Sudan", code: "SD", dial: "+249" },
  { name: "Mauritania", code: "MR", dial: "+222" },
  { name: "Türkiye", code: "TR", dial: "+90" },
];

const REST: Country[] = [
  ["Afghanistan", "AF", "+93"], ["Albania", "AL", "+355"], ["Andorra", "AD", "+376"], ["Angola", "AO", "+244"], ["Argentina", "AR", "+54"],
  ["Armenia", "AM", "+374"], ["Australia", "AU", "+61"], ["Austria", "AT", "+43"], ["Azerbaijan", "AZ", "+994"], ["Bangladesh", "BD", "+880"],
  ["Belarus", "BY", "+375"], ["Belgium", "BE", "+32"], ["Benin", "BJ", "+229"], ["Bolivia", "BO", "+591"], ["Bosnia and Herzegovina", "BA", "+387"],
  ["Botswana", "BW", "+267"], ["Brazil", "BR", "+55"], ["Brunei", "BN", "+673"], ["Bulgaria", "BG", "+359"], ["Burkina Faso", "BF", "+226"],
  ["Cambodia", "KH", "+855"], ["Cameroon", "CM", "+237"], ["Canada", "CA", "+1"], ["Chad", "TD", "+235"], ["Chile", "CL", "+56"],
  ["China", "CN", "+86"], ["Colombia", "CO", "+57"], ["Costa Rica", "CR", "+506"], ["Côte d'Ivoire", "CI", "+225"], ["Croatia", "HR", "+385"],
  ["Cyprus", "CY", "+357"], ["Czechia", "CZ", "+420"], ["Denmark", "DK", "+45"], ["Djibouti", "DJ", "+253"], ["Dominican Republic", "DO", "+1"],
  ["Ecuador", "EC", "+593"], ["Eritrea", "ER", "+291"], ["Estonia", "EE", "+372"], ["Ethiopia", "ET", "+251"], ["Finland", "FI", "+358"],
  ["France", "FR", "+33"], ["Georgia", "GE", "+995"], ["Germany", "DE", "+49"], ["Ghana", "GH", "+233"], ["Greece", "GR", "+30"],
  ["Guatemala", "GT", "+502"], ["Hong Kong", "HK", "+852"], ["Hungary", "HU", "+36"], ["Iceland", "IS", "+354"], ["India", "IN", "+91"],
  ["Indonesia", "ID", "+62"], ["Iran", "IR", "+98"], ["Ireland", "IE", "+353"], ["Italy", "IT", "+39"], ["Japan", "JP", "+81"],
  ["Kazakhstan", "KZ", "+7"], ["Kenya", "KE", "+254"], ["Kyrgyzstan", "KG", "+996"], ["Latvia", "LV", "+371"], ["Lithuania", "LT", "+370"],
  ["Luxembourg", "LU", "+352"], ["Malaysia", "MY", "+60"], ["Maldives", "MV", "+960"], ["Mali", "ML", "+223"], ["Malta", "MT", "+356"],
  ["Mexico", "MX", "+52"], ["Moldova", "MD", "+373"], ["Monaco", "MC", "+377"], ["Mongolia", "MN", "+976"], ["Montenegro", "ME", "+382"],
  ["Mozambique", "MZ", "+258"], ["Myanmar", "MM", "+95"], ["Namibia", "NA", "+264"], ["Nepal", "NP", "+977"], ["Netherlands", "NL", "+31"],
  ["New Zealand", "NZ", "+64"], ["Niger", "NE", "+227"], ["Nigeria", "NG", "+234"], ["North Macedonia", "MK", "+389"], ["Norway", "NO", "+47"],
  ["Pakistan", "PK", "+92"], ["Panama", "PA", "+507"], ["Paraguay", "PY", "+595"], ["Peru", "PE", "+51"], ["Philippines", "PH", "+63"],
  ["Poland", "PL", "+48"], ["Portugal", "PT", "+351"], ["Romania", "RO", "+40"], ["Russia", "RU", "+7"], ["Rwanda", "RW", "+250"],
  ["Senegal", "SN", "+221"], ["Serbia", "RS", "+381"], ["Singapore", "SG", "+65"], ["Slovakia", "SK", "+421"], ["Slovenia", "SI", "+386"],
  ["Somalia", "SO", "+252"], ["South Africa", "ZA", "+27"], ["South Korea", "KR", "+82"], ["Spain", "ES", "+34"], ["Sri Lanka", "LK", "+94"],
  ["Sweden", "SE", "+46"], ["Switzerland", "CH", "+41"], ["Taiwan", "TW", "+886"], ["Tajikistan", "TJ", "+992"], ["Tanzania", "TZ", "+255"],
  ["Thailand", "TH", "+66"], ["Uganda", "UG", "+256"], ["Ukraine", "UA", "+380"], ["United Kingdom", "GB", "+44"], ["United States", "US", "+1"],
  ["Uruguay", "UY", "+598"], ["Uzbekistan", "UZ", "+998"], ["Venezuela", "VE", "+58"], ["Vietnam", "VN", "+84"], ["Zambia", "ZM", "+260"],
  ["Zimbabwe", "ZW", "+263"],
].map(([name, code, dial]) => ({ name, code, dial }));

export const COUNTRIES: Country[] = [...MENA, ...REST];
export const MENA_COUNT = MENA.length;
export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code);
export const countryByName = (name: string | null | undefined) => COUNTRIES.find((c) => c.name === name);
