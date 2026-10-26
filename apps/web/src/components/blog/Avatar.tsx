import Image from "next/image";

/** A round photo of a person, or their first letter on a coloured disc when there is no photo. */
export function Avatar({ src, name, size = 40 }: { src: string | null; name: string | null; size?: number }) {
  const box = { width: size, height: size };
  if (src) return <Image src={src} alt="" width={size} height={size} style={box} className="shrink-0 rounded-full object-cover" unoptimized />;
  return (
    <span aria-hidden="true" style={{ ...box, fontSize: size * 0.45 }} className="grid shrink-0 place-items-center rounded-full bg-brand font-bold text-on-brand">
      {[...(name ?? "?")][0]}
    </span>
  );
}
