"use client";

import { useLingui } from "@lingui/react/macro";

// A finished rally as a picture to keep or share. Drawn in the browser with the phone's own fonts, so nothing is uploaded.
function draw(canvas: HTMLCanvasElement, lines: { heading: string; title: string; done: string; date: string }) {
  const [w, h] = [1200, 800];
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fbf6ea";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#b3322a";
  g.lineWidth = 12;
  g.strokeRect(40, 40, w - 80, h - 80);
  g.lineWidth = 3;
  g.strokeRect(64, 64, w - 128, h - 128);
  g.textAlign = "center";
  g.fillStyle = "#b3322a";
  const serif = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  g.font = `bold 64px ${serif}`;
  g.fillText(lines.heading, w / 2, 190);
  g.fillStyle = "#2b2118";
  g.font = `bold 56px ${serif}`;
  // A long name is shrunk to fit rather than cut.
  let size = 56;
  while (g.measureText(lines.title).width > w - 220 && size > 24) g.font = `bold ${(size -= 2)}px ${serif}`;
  g.fillText(lines.title, w / 2, 380);
  g.font = `40px ${serif}`;
  g.fillText(lines.done, w / 2, 500);
  g.fillStyle = "#6b5b4a";
  g.font = `32px ${serif}`;
  g.fillText(lines.date, w / 2, 680);
}

export function CertificateButton({ title, total, locale }: { title: string; total: number; locale: string }) {
  const { t } = useLingui();
  const make = async () => {
    const canvas = document.createElement("canvas");
    draw(canvas, {
      heading: t`コンプリート証`,
      title,
      done: t`全${total}か所のスタンプをそろえました`,
      date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date()),
    });
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) return;
    const file = new File([blob], "certificate.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title });
    } catch {
      return; // The person closed the share sheet.
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <button type="button" onClick={make} className="tap-target mt-4 rounded-full bg-shu px-5 py-2 text-lg font-bold text-on-shu">
      {t`コンプリート証を保存・共有`}
    </button>
  );
}
