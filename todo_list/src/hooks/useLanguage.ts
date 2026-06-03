import { useContext } from "react";
import { LanguageContext } from "../contexts/language-core";

export function useLanguage() {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return value;
}
