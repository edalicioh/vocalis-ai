import { describe, it, expect } from 'vitest';
import { t, ptBR, en } from '../index';

describe('i18n Internationalization Engine', () => {
  it('deve retornar traduções corretas em Português (pt-BR)', () => {
    expect(t('appName', 'pt-BR')).toBe('Vocalis AI');
    expect(t('hud.vadActive', 'pt-BR')).toBe('Fala Ativa');
    expect(t('panel.copy', 'pt-BR')).toBe('Copiar');
    expect(t('panel.shorten', 'pt-BR')).toBe('Encurtar');
  });

  it('deve retornar traduções corretas em Inglês (en)', () => {
    expect(t('appName', 'en')).toBe('Vocalis AI');
    expect(t('hud.vadActive', 'en')).toBe('Active Speech');
    expect(t('panel.copy', 'en')).toBe('Copy');
    expect(t('panel.shorten', 'en')).toBe('Shorten');
  });

  it('deve ter paridade completa de chaves entre os dicionários pt-BR e en', () => {
    const ptKeys = Object.keys(ptBR).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(ptKeys);
  });

  it('deve utilizar pt-BR como fallback para idiomas não suportados ou chaves nulas', () => {
    // @ts-ignore
    expect(t('hud.vadActive', 'fr')).toBe('Fala Ativa');
  });
});
