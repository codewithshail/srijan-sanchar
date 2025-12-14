"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { getFontFamily, getTextDirection, type Locale } from "@/lib/i18n";
import { HTMLAttributes } from "react";

interface LocaleContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "span" | "p" | "section" | "article";
  forceLocale?: Locale;
}

/**
 * A wrapper component that applies locale-specific font styling
 * to its children. Use this for content areas that should render
 * in the user's selected language with proper font support.
 */
export function LocaleContent({
  children,
  className,
  as = "div",
  forceLocale,
  ...props
}: LocaleContentProps) {
  const currentLocale = useLocale() as Locale;
  const locale = forceLocale || currentLocale;
  const direction = getTextDirection(locale);

  const sharedProps = {
    className: cn("locale-content indic-text", className),
    dir: direction,
    "data-locale": locale,
    "data-locale-font": "true",
    style: {
      fontFamily: getFontFamily(locale),
      ...props.style,
    },
    ...props,
  };

  switch (as) {
    case "span":
      return <span {...sharedProps}>{children}</span>;
    case "p":
      return <p {...sharedProps}>{children}</p>;
    case "section":
      return <section {...sharedProps}>{children}</section>;
    case "article":
      return <article {...sharedProps}>{children}</article>;
    default:
      return <div {...sharedProps}>{children}</div>;
  }
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
