import { requireUser } from "@/lib/auth";
import { body, json, safe, sameOrigin } from "@/lib/http";
import { receptionAction, receptionData } from "@/lib/reception";
type Context = { params: Promise<{ resource: string }> };
export async function GET(req: Request, ctx: Context) {
  return safe(async () =>
    json(
      await receptionData(
        await requireUser(["RECEPTION"]),
        (await ctx.params).resource,
        new URL(req.url).searchParams,
      ),
    ),
  );
}
export async function POST(req: Request, ctx: Context) {
  return safe(async () => {
    sameOrigin(req);
    const actor = await requireUser(["RECEPTION"]);
    return json(
      await receptionAction(
        actor,
        (await ctx.params).resource,
        await body(req),
      ),
    );
  });
}
