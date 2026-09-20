'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton({
  children,
  pendingText = 'A processar…',
  className,
  disabled = false,
  ...rest
}: {
  children: React.ReactNode
  pendingText?: string
  className: string
  disabled?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'disabled'>) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      {...rest}
    >
      {pending && (
        <svg
          className="mr-2 inline-block h-3.5 w-3.5 animate-spin align-[-2px]"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {pending ? pendingText : children}
    </button>
  )
}
