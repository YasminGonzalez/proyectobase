const { supabaseAdmin } = require('../config/supabase');

/**
 * Sube un buffer a un bucket de Supabase Storage
 */
async function uploadToStorage(fileBuffer, fileName, mimeType) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Storage no está configurado. Por favor, agregue SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY a su archivo .env');
  }
  const bucketName = 'habitaciones';

  // Asegurar que el bucket existe e intentar crearlo si no
  try {
    await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 5242880 // 5MB
    });
  } catch (e) {
    // Si ya existe, continuará sin problemas
  }

  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    throw new Error('Error en Supabase Storage: ' + error.message);
  }

  // Obtener la URL pública del archivo subido
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

module.exports = { uploadToStorage };
