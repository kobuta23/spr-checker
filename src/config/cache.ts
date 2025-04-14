import ExpiryMap from "expiry-map";

const HALF_DAY_IN_MS = 43200000;

export const halfDayCache = new ExpiryMap(HALF_DAY_IN_MS);