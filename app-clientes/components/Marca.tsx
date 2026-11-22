import Image from 'next/image'

export default function Marca({ pequeno = false }: { pequeno?: boolean }) {
  const largura = pequeno ? 72 : 150
  return (
    <Image
      src="/logo-preto.png"
      alt="RC Private Fitness Studio"
      width={largura}
      height={Math.round((largura * 600) / 800)}
      priority
    />
  )
}
