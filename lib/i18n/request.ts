import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isValidLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  
  // Then try Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  
  let locale: Locale = defaultLocale;
  
  // Check cookie first
  if (localeCookie && isValidLocale(localeCookie)) {
    locale = localeCookie;
  } 
  // Then check Accept-Language header
  else if (acceptLanguage) {
    const preferredLocale = acceptLanguage.split(',')[0].split('-')[0];
    if (isValidLocale(preferredLocale)) {
      locale = preferredLocale;
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
