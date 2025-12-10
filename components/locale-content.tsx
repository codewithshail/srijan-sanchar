"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { getFontFamily, getTextDirection, type Locale } from "@/lib/i18n";
import { ElementType, ComponentPropsWithoutRef } from "react";

type LocaleContentProps<T extends ElementType = "div"> = {
  children: React.ReactNode;
  className?: string;
  as?: T;
  forceLocale?: Locale;
} & Omit<ComponentPropsWithoutRef<T>, "children" | "className" | "as">;

/**
 * A wrapper component that applies locale-specific font styling
 * to its children. Use this for content areas that should render
 * in the user's selected language with proper font support.
 */
export function LocaleContent<T extends ElementType = "div">({
  children,
  className,
  as,
  forceLocale,
  ...props
}: LocaleContentProps<T>) {
  const currentLocale = useLocale() as Locale;
  const locale = forceLocale || currentLocale;
  const direction = getTextDirection(locale);
  const Component = as || "div";

  return (
    <Component
      className={cn("locale-content indic-text", className)}
      dir={direction}
      data-locale={locale}
      data-locale-font="true"
      style={{
        fontFamily: getFontFamily(locale),
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * A span variant for inline locale-specific text
 */
export function LocaleText({
  children,
  className,
  locale,
}: {
  children: React.ReactNode;
  className?: string;
  locale?: Locale;
}) {
  return (
    <LocaleContent as="span" className={className} forceLocale={locale}>
      {children}
    </LocaleContent>
  );
}

/**
 * A paragraph variant for locale-specific paragraphs
 */
export function LocaleParagraph({
  children,
  className,
  locale,
}: {
  children: React.ReactNode;
  className?: string;
  locale?: Locale;
}) {
  return (
    <LocaleContent as="p" className={className} forceLocale={locale}>
      {children}
    </LocaleContent>
  );
}
