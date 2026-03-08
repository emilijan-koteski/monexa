import { Language } from '../enums/Language';
import type { LegalDocument } from '../types/models';

export function getLocalizedTitle(doc: LegalDocument, language: string): string {
  return language === Language.MK && doc.titleMk ? doc.titleMk : doc.title;
}

export function getLocalizedContent(doc: LegalDocument, language: string): string {
  return language === Language.MK && doc.contentMk ? doc.contentMk : doc.content;
}
