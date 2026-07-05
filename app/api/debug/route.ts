import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const { data, error } = await supabase
    .from("token_images")
    .select("*")
    .eq("token_id", 9429)
    .single();

  return NextResponse.json({ data, error });
}
