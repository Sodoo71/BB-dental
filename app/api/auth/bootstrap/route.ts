import { NextResponse } from "next/server";
// Initial administrator provisioning is a local operator action, never a public HTTP reset.
export async function POST() {
  return NextResponse.json({ error: "Use the local bootstrap administrator command." }, { status: 410 });
}
