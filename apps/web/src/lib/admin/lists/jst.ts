/** The end of a Japan day, as the moment the API takes. */
export const endOfJstDay = (day: string) => new Date(`${day}T23:59:59+09:00`).toISOString();
