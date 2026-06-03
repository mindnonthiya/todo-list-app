import { type ReactNode, useMemo, useState } from "react";
import { dictionaries, LanguageContext, LANGUAGE_STORAGE_KEY, type Language, type LanguageContextValue } from "./language-core";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return storedLanguage === "th" ? "th" : "en";
  });

  const setLanguage = (nextLanguage: Language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => dictionaries[language][key] ?? dictionaries.en[key] ?? key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
