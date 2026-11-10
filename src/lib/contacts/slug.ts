/** A contact's page address: the list key with "-" for ":" (m-<member id>, c-<contact id>, w-<waitlist id>). */
export const slugOf = (key: string) => key.replace(":", "-");
