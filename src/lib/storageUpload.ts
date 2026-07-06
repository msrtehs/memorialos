import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';

/**
 * Sobe uma lista de arquivos EM PARALELO (W5-3) e retorna nome+URL de cada um.
 * O índice `_${i}_` no caminho evita colisão de `Date.now()` em uploads simultâneos.
 * O tenantId, quando informado, vai no customMetadata (W2-2) para o controle de acesso.
 */
export async function uploadFilesParallel(
  files: File[],
  pathPrefix: 'documents' | 'photos' | 'sci-documents',
  tenantId?: string
): Promise<{ name: string; url: string }[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return Promise.all(
    files.map(async (file, i) => {
      const storageRef = ref(storage, `${pathPrefix}/${uid}/${Date.now()}_${i}_${file.name}`);
      await uploadBytes(storageRef, file, tenantId ? { customMetadata: { tenantId } } : undefined);
      return { name: file.name, url: await getDownloadURL(storageRef) };
    })
  );
}
