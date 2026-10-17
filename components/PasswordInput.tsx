'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  minLength,
}: {
  id: string
  name: string
  label: string
  autoComplete: string
  minLength?: number
}) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visivel ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 pr-11 text-sm outline-none transition-colors focus:border-brand/60"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-foreground"
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
