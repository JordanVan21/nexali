import { supabase } from "../supabaseClient";

function safeName(name: string) {
  return name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
  const filePath = `${userId}/${filename}`; // folder per user

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl;
}

export function pathFromPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const prefix = "/storage/v1/object/public/avatars/";
    const i = u.pathname.indexOf(prefix);
    if (i === -1) return null;
    return decodeURIComponent(u.pathname.slice(i + prefix.length));
  } catch {
    return null;
  }
}

export async function deleteAvatarByUrl(publicUrl: string) {
  const path = pathFromPublicUrl(publicUrl);
  if (!path) return;
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) throw error;
}

export async function deleteOnlyAvatar(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const publicUrl = data?.avatar_url ?? null;
  if (publicUrl) {
    await deleteAvatarByUrl(publicUrl);
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: null})
    .eq("id", userId)

  if (updErr) throw updErr;
} 