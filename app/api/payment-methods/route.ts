import { requireUser } from "@/lib/auth";
import { body, json, safe, sameOrigin } from "@/lib/http";
import { listPaymentMethods, savePaymentMethod } from "@/lib/payment-methods";

export async function GET() {
  return safe(async () =>
    json(await listPaymentMethods(await requireUser(["ADMIN", "RECEPTION"]))),
  );
}
export async function POST(req: Request) {
  return safe(async () => {
    sameOrigin(req);
    const actor = await requireUser(["ADMIN"]);
    return json(await savePaymentMethod(actor, await body(req)));
  });
}
