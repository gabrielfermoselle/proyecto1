import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends React.ComponentProps<"input"> {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

/** Campo accesible: label asociado, error anunciado y vinculado por aria-describedby. */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ name, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? name;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className="grid gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {hint ? (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = "FormField";
