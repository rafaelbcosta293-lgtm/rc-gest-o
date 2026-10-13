import { Logotipo } from "@/components/logotipo"

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent to-background px-4 py-10">
      <div className="mb-8">
        <Logotipo className="scale-125" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
