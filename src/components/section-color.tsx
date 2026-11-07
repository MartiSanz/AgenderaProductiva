import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Button as BaseButton } from "@/components/ui/button";
import { Checkbox as BaseCheckbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type SectionColor = "day-1" | "day-2" | "day-3" | "day-4" | "day-5" | "day-6";

const SectionColorContext = React.createContext<SectionColor | null>(null);

export function SectionColorProvider({
  color,
  children,
}: {
  color: SectionColor;
  children: React.ReactNode;
}) {
  return <SectionColorContext.Provider value={color}>{children}</SectionColorContext.Provider>;
}

export function useSectionColor() {
  return React.useContext(SectionColorContext);
}

const sectionButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const colorStyles: Record<
  SectionColor,
  Record<"default" | "destructive" | "outline" | "secondary" | "ghost" | "link", string>
> = {
  "day-1": {
    default: "bg-day-1 text-white shadow hover:bg-day-1/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-1 bg-background text-day-1 shadow-sm hover:bg-day-1/10",
    secondary: "bg-day-1/15 text-day-1 shadow-sm hover:bg-day-1/25",
    ghost: "text-day-1 hover:bg-day-1/10",
    link: "text-day-1 underline-offset-4 hover:underline",
  },
  "day-2": {
    default: "bg-day-2 text-white shadow hover:bg-day-2/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-2 bg-background text-day-2 shadow-sm hover:bg-day-2/10",
    secondary: "bg-day-2/15 text-day-2 shadow-sm hover:bg-day-2/25",
    ghost: "text-day-2 hover:bg-day-2/10",
    link: "text-day-2 underline-offset-4 hover:underline",
  },
  "day-3": {
    default: "bg-day-3 text-white shadow hover:bg-day-3/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-3 bg-background text-day-3-deep shadow-sm hover:bg-day-3/10",
    secondary: "bg-day-3/15 text-day-3-deep shadow-sm hover:bg-day-3/25",
    ghost: "text-day-3-deep hover:bg-day-3/10",
    link: "text-day-3-deep underline-offset-4 hover:underline",
  },
  "day-4": {
    default: "bg-day-4 text-white shadow hover:bg-day-4/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-4 bg-background text-day-4 shadow-sm hover:bg-day-4/10",
    secondary: "bg-day-4/15 text-day-4 shadow-sm hover:bg-day-4/25",
    ghost: "text-day-4 hover:bg-day-4/10",
    link: "text-day-4 underline-offset-4 hover:underline",
  },
  "day-5": {
    default: "bg-day-5 text-white shadow hover:bg-day-5/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-5 bg-background text-day-5 shadow-sm hover:bg-day-5/10",
    secondary: "bg-day-5/15 text-day-5 shadow-sm hover:bg-day-5/25",
    ghost: "text-day-5 hover:bg-day-5/10",
    link: "text-day-5 underline-offset-4 hover:underline",
  },
  "day-6": {
    default: "bg-day-6 text-white shadow hover:bg-day-6/90",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-day-6 bg-background text-day-6 shadow-sm hover:bg-day-6/10",
    secondary: "bg-day-6/15 text-day-6 shadow-sm hover:bg-day-6/25",
    ghost: "text-day-6 hover:bg-day-6/10",
    link: "text-day-6 underline-offset-4 hover:underline",
  },
};

export interface SectionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sectionButtonVariants> {
  asChild?: boolean;
}

const SectionButton = React.forwardRef<HTMLButtonElement, SectionButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const color = useSectionColor();
    const activeColor = color ?? "day-1";
    const Comp = asChild ? Slot : "button";
    const variantKey = (variant as keyof (typeof colorStyles)["day-1"]) ?? "default";
    const colorClass = colorStyles[activeColor][variantKey] || colorStyles[activeColor].default;
    return (
      <Comp
        className={cn(sectionButtonVariants({ variant, size }), colorClass, className)}
        ref={ref}
        {...props}
      />
    );
  },
);
SectionButton.displayName = "SectionButton";

export { SectionButton, sectionButtonVariants };

export function SectionCheckbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseCheckbox>) {
  const color = useSectionColor();
  const activeColor = color ?? "day-1";
  const colorClass = {
    "day-1": "border-day-1 data-[state=checked]:bg-day-1 data-[state=checked]:text-white",
    "day-2": "border-day-2 data-[state=checked]:bg-day-2 data-[state=checked]:text-white",
    "day-3": "border-day-3 data-[state=checked]:bg-day-3 data-[state=checked]:text-white",
    "day-4": "border-day-4 data-[state=checked]:bg-day-4 data-[state=checked]:text-white",
    "day-5": "border-day-5 data-[state=checked]:bg-day-5 data-[state=checked]:text-white",
    "day-6": "border-day-6 data-[state=checked]:bg-day-6 data-[state=checked]:text-white",
  }[activeColor];

  return <BaseCheckbox className={cn(colorClass, className)} {...props} />;
}
