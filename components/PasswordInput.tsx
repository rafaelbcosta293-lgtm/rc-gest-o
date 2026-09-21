'use client'

import { useState } from 'react'

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
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
          className="w-full rounded-md border border-black/10 px-3 py-2 pr-16 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  )
}
