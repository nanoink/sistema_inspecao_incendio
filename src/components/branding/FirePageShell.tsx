import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import fire360OfficialLogo from "@/assets/fire360-logo-oficial.png";
import { cn } from "@/lib/utils";

interface FirePageShellProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

interface FirePageHeaderStat {
  label: string;
  value: string;
}

interface FirePageHeaderProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  stats?: FirePageHeaderStat[];
  className?: string;
}

export const FirePageShell = ({
  children,
  className,
  containerClassName,
}: FirePageShellProps) => (
  <div className={cn("fire-app-shell", className)}>
    <div className={cn("fire-app-container", containerClassName)}>{children}</div>
  </div>
);

export const FirePageHeader = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
}: FirePageHeaderProps) => (
  <section
    className={cn(
      "fire-app-hero mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end",
      className,
    )}
  >
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {eyebrow ? <div className="fire-app-hero__eyebrow">{eyebrow}</div> : null}
        <div className="rounded-2xl border border-white/30 bg-white px-3 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <img
            src={fire360OfficialLogo}
            alt="Fire 360"
            className="h-8 w-auto md:h-10"
          />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-4">
        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-3 text-[hsl(var(--fire-cyan))] shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
          <Icon className="h-7 w-7 md:h-8 md:w-8" />
        </div>
        <div>
          <h1 className="fire-display fire-app-hero__title">{title}</h1>
          {description ? (
            <p className="fire-app-hero__description">{description}</p>
          ) : null}
        </div>
      </div>
    </div>

    <div className="space-y-4">
      {actions ? <div className="fire-app-toolbar justify-start lg:justify-end">{actions}</div> : null}
      {stats?.length ? (
        <div
          className={cn(
            "fire-app-stats",
            stats.length > 2 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2",
          )}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="fire-app-stat">
              <div className="fire-app-stat__value">{stat.value}</div>
              <div className="fire-app-stat__label">{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </section>
);
