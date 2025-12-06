"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TRANSLATIONS } from '../data/translations';

type Language = 'es' | 'en';
type TranslationValue = string | object;

interface TranslationContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('es');

    const t = (path: string): string => {
        const keys = path.split('.');
        let current: TranslationValue = TRANSLATIONS[language];

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                 
                current = (current as any)[key];
            } else {
                return path; // Fallback to key if not found
            }
        }

        return typeof current === 'string' ? current : path;
    };

    return (
        <TranslationContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within a TranslationProvider');
    }
    return context;
}
