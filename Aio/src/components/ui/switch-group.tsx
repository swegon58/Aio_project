"use client";

import React, { createContext, useContext, useEffect } from "react";
import clsx from "clsx";

const SwitchContext = createContext<{
  value: string | null;
  setValue: (v: string) => void;
} | null>(null);

interface SwitchGroupProps {
  children: React.ReactNode;
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// Styled via .switch-group / .switch-control rules in mockup.css (uses
// Aio's --bg-input/--text-*/--accent-primary vars, not Tailwind Geist tokens).
// Always used controlled (value + onValueChange) by every caller — no internal
// state mirror needed.
export const SwitchGroup = ({ children, name = "default", value, onValueChange, className }: SwitchGroupProps) => {
  const setValue = (next: string) => {
    onValueChange?.(next);
  };

  return (
    <SwitchContext.Provider value={{ value: value ?? null, setValue }}>
      <div className={clsx("switch-group", className)}>
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<SwitchControlProps>, { name })
            : child
        )}
      </div>
    </SwitchContext.Provider>
  );
};

interface SwitchControlProps {
  label?: string;
  value: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
}

const SwitchControl = ({ label, value, defaultChecked, disabled = false, name }: SwitchControlProps) => {
  const context = useContext(SwitchContext);
  const checked = value === context?.value;

  useEffect(() => {
    if (defaultChecked && value) context?.setValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className={clsx("switch-control", checked && "active", disabled && "disabled")}>
      <input
        type="radio"
        name={name}
        value={value}
        disabled={disabled}
        checked={checked}
        readOnly
        className="hidden"
        onClick={() => !disabled && context?.setValue(value)}
      />
      <span>{label}</span>
    </label>
  );
};

SwitchGroup.Control = SwitchControl;
