# Design Document: Landing Page Redesign

## Overview

This design document outlines the approach to fix layout, spacing, margin, and section alignment issues on the StoryWeave landing page. The redesign focuses on establishing a consistent design system with standardized spacing, proper responsive behavior, and visual harmony across all sections.

The landing page consists of the following components that need to be updated:
- `app/page.tsx` - Main landing page with Hero and CTA sections
- `components/Header.tsx` - Fixed navigation header
- `components/Features.tsx` - Feature cards grid
- `components/HowItWorks.tsx` - Step-by-step process section
- `components/Testimonials.tsx` - Customer testimonials carousel
- `components/Pricing.tsx` - Pricing plans comparison
- `components/FAQ.tsx` - Frequently asked questions accordion
- `components/Footer.tsx` - Site footer with links and newsletter

## Architecture

### Design System Constants

We will establish a consistent spacing system based on Tailwind CSS utilities:

```
Spacing Scale:
- Section vertical padding: py-16 (mobile) → py-20 (tablet) → py-24 (desktop) → py-32 (large desktop)
- Section header margin-bottom: mb-10 (mobile) → mb-12 (tablet) → mb-16 (desktop)
- Container horizontal padding: px-4 (mobile) → px-6 (tablet) → px-8 (desktop)
- Card internal padding: p-6 (mobile) → p-8 (desktop)
- Grid gaps: gap-6 (mobile) → gap-8 (desktop)
- Button heights: h-11 (mobile) → h-12 (tablet) → h-14 (desktop)
```

### Component Hierarchy

```
LandingPage
├── Header (fixed, z-50)
├── Main
│   ├── HeroSection
│   │   ├── TextContent (order-2 lg:order-1)
│   │   └── Hero3DContainer (order-1 lg:order-2)
│   ├── Features
│   │   └── FeatureCard[] (grid 1/2/3 cols)
│   ├── HowItWorks
│   │   └── Step[] (grid 1/3 cols)
│   ├── Testimonials
│   │   └── TestimonialCard[] (carousel)
│   ├── Pricing
│   │   └── PricingCard[] (grid 1/3 cols)
│   ├── FAQ
│   │   └── AccordionItem[]
│   └── CTASection
└── Footer
    ├── NewsletterSection
    ├── LinksGrid
    └── BottomBar
```

## Components and Interfaces

### 1. Section Wrapper Pattern

All sections will follow a consistent wrapper pattern:

```tsx
interface SectionProps {
  id?: string;
  className?: string;
  background?: 'default' | 'accent' | 'primary';
  children: React.ReactNode;
}

// Standard section structure:
<section id={id} className={cn(
  "py-16 md:py-20 lg:py-24 xl:py-32",
  background === 'accent' && "bg-accent/20",
  background === 'primary' && "bg-primary text-primary-foreground",
  className
)}>
  <div className="container mx-auto px-4 sm:px-6 lg:px-8">
    {children}
  </div>
</section>
```

### 2. Section Header Pattern

All section headers will follow a consistent pattern:

```tsx
interface SectionHeaderProps {
  label: string;
  title: string;
  description?: string;
}

// Standard header structure:
<div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
  <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
    {label}
  </span>
  <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
    {title}
  </h2>
  {description && (
    <p className="text-base md:text-lg text-muted-foreground/80">
      {description}
    </p>
  )}
</div>
```

### 3. Header Component Updates

```tsx
// Key fixes:
- Consistent height: h-16 md:h-20
- Navigation gap: gap-6 lg:gap-8
- Smooth scroll transition with backdrop-blur
- Mobile menu with proper animation
```

### 4. Hero Section Updates

```tsx
// Key fixes:
- Top padding accounting for header: pt-20 md:pt-24 lg:pt-28
- Bottom padding: pb-12 md:pb-16 lg:pb-20
- Grid gap: gap-8 lg:gap-12 xl:gap-16
- Button container: flex flex-col sm:flex-row gap-4
- Social proof margin: mt-8 md:mt-10
```

### 5. Features Section Updates

```tsx
// Key fixes:
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Gap: gap-6 lg:gap-8
- Card padding: p-6 lg:p-8
- Icon container: w-12 h-12 lg:w-14 lg:h-14
- Card height: h-full with flex flex-col
```

### 6. How It Works Section Updates

```tsx
// Key fixes:
- Grid: grid-cols-1 md:grid-cols-3
- Gap: gap-8 md:gap-6 lg:gap-8
- Step circle: w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36
- Inner circle: proportionally sized
- Connector line: properly positioned between circles
- Step number badge: absolute -top-2 -right-2
```

### 7. Testimonials Section Updates

```tsx
// Key fixes:
- Card min-height: min-h-[300px] md:min-h-[320px]
- Carousel slide width: flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]
- Navigation dots: mt-8 with proper centering
- Navigation arrows: positioned outside carousel on desktop
- Card padding: p-6 lg:p-8
```

### 8. Pricing Section Updates

```tsx
// Key fixes:
- Grid: grid-cols-1 md:grid-cols-3
- Gap: gap-6 lg:gap-8
- Card structure: flex flex-col h-full
- Popular card: ring-2 ring-primary scale-100 md:scale-105
- Feature list: flex-grow to push CTA to bottom
- CTA button: mt-auto for consistent positioning
```

### 9. FAQ Section Updates

```tsx
// Key fixes:
- Max width: max-w-4xl mx-auto
- Search input: max-w-md mx-auto mb-10 md:mb-12
- Accordion item padding: px-6 py-4
- Accordion spacing: space-y-3 md:space-y-4
```

### 10. CTA Section Updates

```tsx
// Key fixes:
- Padding: py-16 md:py-20 lg:py-24 xl:py-32
- Content max-width: max-w-2xl mx-auto
- Button margin: mt-8 md:mt-10
```

### 11. Footer Updates

```tsx
// Key fixes:
- Newsletter section: border-b with py-12 md:py-16
- Main grid: grid-cols-2 md:grid-cols-4 lg:grid-cols-12
- Gap: gap-8 lg:gap-12
- Social links: gap-3, w-10 h-10
- Bottom bar: py-6 with proper flex alignment
```

## Data Models

No data model changes required. This redesign focuses on presentation layer only.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, most acceptance criteria relate to CSS class consistency and visual layout which are best verified through visual inspection and manual testing rather than property-based testing. The landing page redesign is primarily a UI/styling task where:

1. Correctness is determined by visual appearance matching design specifications
2. Spacing and layout are verified through browser dev tools inspection
3. Responsive behavior requires testing across multiple viewport sizes

Since this is a CSS/styling-focused redesign without complex business logic, data transformations, or algorithmic operations, there are no universally quantified properties suitable for property-based testing. The acceptance criteria are best validated through:

- Visual regression testing (screenshot comparison)
- Manual QA across breakpoints
- Code review for CSS class consistency

**No testable properties identified for this feature.**

## Error Handling

### Build-time Errors
- TypeScript compilation errors will be caught during build
- Tailwind CSS class validation through IDE tooling

### Runtime Errors
- React error boundaries in parent components handle rendering failures
- Graceful degradation for 3D hero component (already implemented with fallback)

### Visual Errors
- CSS class conflicts resolved through proper specificity
- Responsive breakpoint issues caught through manual testing

## Testing Strategy

### Visual Testing Approach

Since this is a UI redesign focused on spacing and layout, the primary testing approach will be:

1. **Manual Visual Inspection**
   - Test each section at mobile (375px), tablet (768px), and desktop (1280px) breakpoints
   - Verify spacing consistency using browser dev tools
   - Check for layout shifts during interactions

2. **Cross-browser Testing**
   - Test in Chrome, Firefox, and Safari
   - Verify backdrop-blur and other CSS effects work correctly

3. **Responsive Testing**
   - Use browser responsive mode to test fluid transitions
   - Verify no horizontal overflow at any viewport width

4. **Component Isolation Testing**
   - Each component can be tested in isolation
   - Verify props are applied correctly

### Code Review Checklist

- [ ] All sections use consistent padding classes
- [ ] Container max-width is applied consistently
- [ ] Grid gaps are standardized
- [ ] Button sizes follow the design system
- [ ] Card padding is consistent
- [ ] Section headers follow the standard pattern
- [ ] Responsive classes are properly ordered (mobile-first)
