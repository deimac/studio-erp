import * as React from 'react';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
}

export function Switch({ checked, onCheckedChange, disabled, label, ...props }: SwitchProps) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="relative inline-block w-10 h-6">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onCheckedChange(e.target.checked)}
                    disabled={disabled}
                    className="peer sr-only"
                    {...props}
                />
                <span
                    className={
                        `absolute left-0 top-0 w-10 h-6 rounded-full transition-colors duration-200 ` +
                        (checked ? 'bg-blue-600' : 'bg-gray-300')
                    }
                />
                <span
                    className={
                        `absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ` +
                        (checked ? 'translate-x-4' : '')
                    }
                />
            </span>
            {label && <span className="text-sm">{label}</span>}
        </label>
    );
}
