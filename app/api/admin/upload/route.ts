import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function isAuthorized(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PANEL_SECRET;
}

/**
 * POST /api/admin/upload
 * Accepts a multipart form upload (field name "file"), stores it in the
 * `traits` Supabase Storage bucket, and returns its public URL — which the
 * admin panel then saves into the traits table via /api/admin/traits.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("traits")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from("traits").getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl });
}
