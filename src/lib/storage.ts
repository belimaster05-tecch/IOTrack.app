import { supabase } from '@/lib/supabase/client';

export async function uploadResourceImage(file: File, organizationId: string, resourceId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${organizationId}/resources/${resourceId}/${fileName}`;

  const { error: uploadError, data } = await supabase.storage
    .from('inventory-assets')
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('inventory-assets')
    .getPublicUrl(filePath);

  return publicUrl;
}
