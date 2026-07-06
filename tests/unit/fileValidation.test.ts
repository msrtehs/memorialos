import { describe, it, expect } from 'vitest';
import { validateFile, ALLOWED_IMAGE_TYPES } from '@/lib/fileValidation';

const fakeFile = (type: string, sizeMb: number) =>
  ({ type, size: sizeMb * 1024 * 1024, name: `f.${type.split('/')[1]}` } as File);

describe('validateFile', () => {
  it('aceita PDF de 9MB', () => expect(validateFile(fakeFile('application/pdf', 9))).toBeNull());
  it('rejeita PNG de 11MB com mensagem de tamanho', () =>
    expect(validateFile(fakeFile('image/png', 11))).toMatch(/muito grande/i));
  it('rejeita exe com mensagem de tipo', () =>
    expect(validateFile(fakeFile('application/x-msdownload', 1))).toMatch(/não permitido/i));
  it('rejeita PDF como imagem', () =>
    expect(validateFile(fakeFile('application/pdf', 1), ALLOWED_IMAGE_TYPES)).toMatch(/não permitido/i));
});
