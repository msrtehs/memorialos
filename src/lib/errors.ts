import toast from 'react-hot-toast';

/** Mapeia códigos do Firebase para mensagens PT-BR amigáveis. */
export function getFirestoreErrorMessage(error: any, fallback = 'Erro ao salvar. Tente novamente.'): string {
  const code: string = error?.code || '';
  switch (code) {
    case 'permission-denied':
      return 'Sem permissão para esta operação.';
    case 'unavailable':
      return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
    case 'resource-exhausted':
      return 'Limite de uso atingido. Tente novamente mais tarde.';
    case 'not-found':
      return 'Registro não encontrado. Ele pode ter sido excluído.';
    case 'failed-precondition':
      return 'Operação indisponível no momento (índice ou pré-condição ausente).';
    default:
      return error?.message || fallback;
  }
}

/**
 * Uso em catch de MUTAÇÃO: loga com escopo + toast com mensagem mapeada.
 *   catch (error) { reportError('SecurityPage.createEvent', error); }
 */
export function reportError(scope: string, error: unknown, fallback?: string): void {
  console.error(`[${scope}]`, error);
  toast.error(getFirestoreErrorMessage(error, fallback));
}

/**
 * Uso em catch de LOAD: idem, com fallback próprio de carregamento.
 *   catch (error) { reportLoadError('DeceasedList', error); }
 */
export function reportLoadError(scope: string, error: unknown): void {
  reportError(scope, error, 'Erro ao carregar os dados. Recarregue a página.');
}
