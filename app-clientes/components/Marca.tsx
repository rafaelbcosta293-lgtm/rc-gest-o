import Image from 'next/image'

// Logótipo (626×245 no ficheiro, sem margens).
export default function Marca({ largura = 150, claro = false }: { largura?: number; claro?: boolean }) {
  return (
    <Image
      src={claro ? '/logo-dourado.png' : '/logo-preto.png'}
      alt="RC Private Fitness Studio"
      width={largura}
      height={Math.round((largura * 245) / 626)}
      priority
    />
  )
}
