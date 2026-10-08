import { getRequestConfig } from "next-intl/server";

// English-only for now; the structure is ready for additional locales.
export default getRequestConfig(async () => ({
  locale: "en",
  messages: (await import("./en.json")).default,
}));
