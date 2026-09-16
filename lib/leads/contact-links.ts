/** Links de contato montados a partir de dados já confirmados do lead. */

import type { WhatsappStatus } from "@/generated/prisma/enums";
import { whatsappLink } from "@/lib/normalize";

/**
 * Link do WhatsApp. Com número confirmado abre direto; com celular apenas
 * "possível", o link usa o telefone e a interface avisa que pode não ter WhatsApp.
 */
export function leadWhatsappHref(lead: {
  whatsapp: string | null;
  whatsappStatus: WhatsappStatus;
  phone: string | null;
}): { href: string; confirmed: boolean } | null {
  if (lead.whatsappStatus === "CONFIRMED") {
    const href = whatsappLink(lead.whatsapp);
    return href ? { href, confirmed: true } : null;
  }
  if (lead.whatsappStatus === "POSSIBLE") {
    const href = whatsappLink(lead.phone);
    return href ? { href, confirmed: false } : null;
  }
  return null;
}
