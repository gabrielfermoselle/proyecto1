import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioCardProps extends Omit<React.ComponentProps<"input">, "type" | "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  type?: "radio" | "checkbox";
}

/**
 * Opción en forma de tarjeta, con un input nativo (accesible por teclado y lector de pantalla).
 * Compatible con `register` de react-hook-form.
 */
export const RadioCard = React.forwardRef<HTMLInputElement, RadioCardProps>(
  ({ title, description, icon, type = "radio", className, disabled, ...props }, ref) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border-2 border-input bg-card p-4 transition-colors",
        "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        disabled && "cursor-not-allowed opacity-60 hover:border-input",
        className,
      )}
    >
      <input ref={ref} type={type} className="sr-only" disabled={disabled} {...props} />
      {icon ? <span className="mt-0.5 shrink-0 text-primary [&_svg]:size-6">{icon}</span> : null}
      <span className="grid gap-1">
        <span className="font-semibold">{title}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  ),
);
RadioCard.displayName = "RadioCard";
