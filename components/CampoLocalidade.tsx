"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MapPin } from "lucide-react";

type Localidade = { nome: string; concelho: string; distrito: string };

// Campo "Cidade / localidade" da morada: escreve-se e escolhe-se da lista
// das cidades, vilas e aldeias de Portugal (com o concelho e o distrito),
// para a mesma terra ficar sempre escrita da mesma maneira. Quem escolhe
// da lista grava também o concelho e o distrito (campos escondidos); quem
// escreve outra coisa (ex.: morada no estrangeiro) fica só com o texto.
export default function CampoLocalidade({
  cidade,
  concelho,
  distrito,
  className,
  idCodigoPostal = "codigo_postal",
  idPais = "pais",
}: {
  cidade: string | null;
  concelho: string | null;
  distrito: string | null;
  className: string;
  // Campos do mesmo formulário: o código postal ajuda a desempatar terras
  // com o mesmo nome; o país fica "Portugal" ao escolher da lista.
  idCodigoPostal?: string;
  idPais?: string;
}) {
  const [texto, setTexto] = useState(cidade ?? "");
  const [escolhida, setEscolhida] = useState<{
    concelho: string;
    distrito: string;
  } | null>(cidade && concelho && distrito ? { concelho, distrito } : null);
  const [sugestoes, setSugestoes] = useState<Localidade[]>([]);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const pedido = useRef(0);
  const caixa = useRef<HTMLDivElement | null>(null);

  // Procura (com um pequeno atraso) enquanto se escreve.
  useEffect(() => {
    if (!aberta) return;
    const q = texto.trim();
    if (q.length < 2) return;
    const n = ++pedido.current;
    const espera = setTimeout(async () => {
      try {
        const cp =
          (document.getElementById(idCodigoPostal) as HTMLInputElement | null)
            ?.value ?? "";
        const r = await fetch(
          `/api/localidades?q=${encodeURIComponent(q)}&cp=${encodeURIComponent(cp)}`,
        );
        if (!r.ok || n !== pedido.current) return;
        setSugestoes((await r.json()) as Localidade[]);
        setAtiva(0);
      } catch {
        // sem rede: fica o que se escreveu
      }
    }, 180);
    return () => clearTimeout(espera);
  }, [texto, aberta, idCodigoPostal]);

  // Fecha a lista ao tocar fora.
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node))
        setAberta(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  function escolher(l: Localidade) {
    setTexto(l.nome);
    setEscolhida({ concelho: l.concelho, distrito: l.distrito });
    setAberta(false);
    const pais = document.getElementById(idPais) as HTMLInputElement | null;
    if (pais && !pais.value.trim()) pais.value = "Portugal";
  }

  const visiveis = aberta && texto.trim().length >= 2 ? sugestoes : [];

  return (
    <div ref={caixa}>
      {/* A lista abre colada ao campo (não por baixo da nota). */}
      <div className="relative">
        <input
          id="cidade"
          name="cidade"
          value={texto}
          autoComplete="off"
          role="combobox"
          aria-expanded={visiveis.length > 0}
          aria-controls="lista-localidades"
          aria-autocomplete="list"
          placeholder="Começa a escrever e escolhe da lista"
          onChange={(e) => {
            setTexto(e.target.value);
            // Mexeu no texto: deixa de ser a localidade escolhida.
            setEscolhida(null);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onKeyDown={(e) => {
            if (visiveis.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtiva((i) => (i + 1) % visiveis.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtiva((i) => (i - 1 + visiveis.length) % visiveis.length);
            } else if (e.key === "Enter") {
              // Enter escolhe a sugestão (não envia o formulário a meio).
              e.preventDefault();
              escolher(visiveis[ativa]);
            } else if (e.key === "Escape") {
              setAberta(false);
            }
          }}
          className={`${className} w-full`}
        />
        <input
          type="hidden"
          name="concelho"
          value={escolhida?.concelho ?? ""}
        />
        <input
          type="hidden"
          name="distrito"
          value={escolhida?.distrito ?? ""}
        />

        {visiveis.length > 0 && (
          <ul
            id="lista-localidades"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface py-1 shadow-pop"
          >
            {visiveis.map((l, i) => (
              <li
                key={`${l.nome}|${l.concelho}|${l.distrito}`}
                role="option"
                aria-selected={i === ativa}
              >
                <button
                  type="button"
                  // pointerdown: escolhe antes de o campo perder o foco.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    escolher(l);
                  }}
                  onMouseEnter={() => setAtiva(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm pointer-coarse:py-3 ${i === ativa ? "bg-brand/[.12]" : ""}`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">
                      {l.nome}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      Concelho de {l.concelho}
                      {l.distrito !== l.concelho ? ` · ${l.distrito}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {texto.trim() !== "" &&
        visiveis.length === 0 &&
        (escolhida ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Concelho de {escolhida.concelho}
            {escolhida.distrito !== escolhida.concelho
              ? ` · distrito de ${escolhida.distrito}`
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Escolhe da lista para a terra ficar sempre escrita da mesma maneira
            (fora de Portugal, deixa como escreveste).
          </p>
        ))}
    </div>
  );
}
