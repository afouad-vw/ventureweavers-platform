/** A mobile number as wa.me wants it: digits only, Egyptian 01… numbers get the 20 country code. */
export const waNumber = (p: string | null) => (p ? p.replace(/[^\d]/g, "").replace(/^0(?=1)/, "20") : "");
