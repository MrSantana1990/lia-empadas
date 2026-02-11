import { cn } from "@/lib/utils";

type BrandLogoSize = "sm" | "md";

const SIZE_STYLES: Record<
  BrandLogoSize,
  { badgeInner: string; img: string; title: string; subtitle: string }
> = {
  sm: {
    badgeInner: "p-1.5",
    img: "h-8 w-8",
    title: "text-base",
    subtitle: "text-[11px]",
  },
  md: {
    badgeInner: "p-2",
    img: "h-10 w-10",
    title: "text-xl",
    subtitle: "text-xs",
  },
};

export default function BrandLogo({
  size = "md",
  withText = true,
  subtitle = "Feitas com amor",
  className,
}: {
  size?: BrandLogoSize;
  withText?: boolean;
  subtitle?: string;
  className?: string;
}) {
  const styles = SIZE_STYLES[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="rounded-xl bg-gradient-to-br from-gold/45 via-gold/15 to-transparent p-[1px] shadow-sm">
        <div
          className={cn(
            "rounded-[11px] bg-white/95 ring-1 ring-black/5",
            styles.badgeInner
          )}
        >
          <img
            src="/images/logo-empadas-lia.png"
            alt="Empadas da Lia"
            className={cn("logo-img object-contain", styles.img)}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {withText && (
        <div>
          <div className={cn("font-bold text-charcoal leading-none", styles.title)}>
            Empadas da Lia
          </div>
          <div className={cn("text-gray-medium font-cta", styles.subtitle)}>
            {subtitle}
          </div>
        </div>
      )}
    </div>
  );
}

