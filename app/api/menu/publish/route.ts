import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { menuId, publish } = (await request.json()) as { menuId: string; publish: boolean };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (publish) {
    await supabase.from("menus").update({ is_published: false }).eq("is_published", true);
  }

  const { error } = await supabase.from("menus").update({ is_published: publish }).eq("id", menuId);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar el menú." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
