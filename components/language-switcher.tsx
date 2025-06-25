'use client';

import { useI18n } from './translations-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
            <Button
    variant="outline"
    className="rounded-full text-xs tracking-wider w-[80px] justify-center px-2"
    >
    <span className="block w-full text-center pointer-events-none">
        {locale === 'en' ? '🇬🇧 EN' : '🇩🇪 DE'}
    </span>
    </Button>

      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem onClick={() => setLocale('en')}>🇬🇧 English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('de')}>🇩🇪 Deutsch</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
