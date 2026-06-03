import { createContext } from "react";
import en from "../locales/en.json";
import th from "../locales/th.json";

export type Language = "en" | "th";
export type TranslationKey = keyof typeof en;

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

export const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, th };
export const LanguageContext = createContext<LanguageContextValue | null>(null);
export const LANGUAGE_STORAGE_KEY = "todo-planner-language";
