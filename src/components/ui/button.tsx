import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[transform,background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_18px_40px_hsl(var(--primary)/0.26)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_22px_46px_hsl(var(--primary)/0.3)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_18px_40px_hsl(var(--destructive)/0.22)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-white/80 text-foreground shadow-[0_14px_28px_rgba(7,22,47,0.04)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_12px_26px_rgba(7,22,47,0.05)] hover:-translate-y-0.5 hover:bg-secondary/86",
        ghost:
          "text-foreground hover:bg-white/75 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
