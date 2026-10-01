import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldShell } from "./field-shell";

interface CampoBase {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

/** Input con label, ayuda y error accesibles. Compatible con `register` de react-hook-form. */
export const FormField = React.forwardRef<HTMLInputElement, CampoBase & React.ComponentProps<"input">>(
  ({ name, label, error, hint, id, ...props }, ref) => (
    <FieldShell id={id ?? name} label={label} error={error} hint={hint}>
      {(aria) => <Input ref={ref} name={name} {...aria} {...props} />}
    </FieldShell>
  ),
);
FormField.displayName = "FormField";

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  CampoBase & React.ComponentProps<"textarea">
>(({ name, label, error, hint, id, ...props }, ref) => (
  <FieldShell id={id ?? name} label={label} error={error} hint={hint}>
    {(aria) => <Textarea ref={ref} name={name} {...aria} {...props} />}
  </FieldShell>
));
TextareaField.displayName = "TextareaField";

export const SelectField = React.forwardRef<HTMLSelectElement, CampoBase & React.ComponentProps<"select">>(
  ({ name, label, error, hint, id, children, ...props }, ref) => (
    <FieldShell id={id ?? name} label={label} error={error} hint={hint}>
      {(aria) => (
        <Select ref={ref} name={name} {...aria} {...props}>
          {children}
        </Select>
      )}
    </FieldShell>
  ),
);
SelectField.displayName = "SelectField";
