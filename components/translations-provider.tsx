// components/translations-provider.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import de from '@/messages/de.json';

const messagesMap = {
    en,
    de
};

type Locale = 'en' | 'de';

interface I18nContext {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContext | undefined>(undefined);

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) throw new Error('useI18n must be used within TranslationsProvider');
    return context;
}

export function TranslationsProvider({ children }: { children: ReactNode }) {
    const [locale, setLocale] = useState<Locale>('en');

    return (
        <I18nContext.Provider value={{ locale, setLocale }}>
        <NextIntlClientProvider locale={locale} messages={messagesMap[locale]}>
            {children}
        </NextIntlClientProvider>
        </I18nContext.Provider>
    );
}
