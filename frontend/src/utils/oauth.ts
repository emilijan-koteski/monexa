import { OAuthClientKind } from '../enums/OAuthClientKind';
import { OAuthScope } from '../enums/OAuthScope';

export const VERIFIED_CLIENT_HOSTS = ['claude.ai', 'chatgpt.com'];

const MAX_DISPLAY_NAME_LENGTH = 60;
const ELLIPSIS = '…';
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const SAFE_REDIRECT_PROTOCOLS = ['https:', 'http:'];

const SCOPE_LABEL_KEYS: Record<string, string> = {
  [OAuthScope.READ]: 'OAUTH_SCOPE_READ',
  [OAuthScope.WRITE]: 'OAUTH_SCOPE_WRITE',
  [OAuthScope.OFFLINE_ACCESS]: 'OAUTH_SCOPE_OFFLINE_ACCESS',
};

export interface OAuthClientDescriptor {
  clientId: string;
  clientName: string;
  clientKind: OAuthClientKind;
}

export interface OAuthClientIdentity {
  name: string;
  isVerified: boolean;
  isUnverified: boolean;
}

export const stripHiddenCharacters = (value: string): string => value.replace(HIDDEN_CHARACTERS, '');

export const sanitizeDisplayName = (name: string): string => {
  const characters = Array.from(stripHiddenCharacters(name).trim());
  if (characters.length <= MAX_DISPLAY_NAME_LENGTH) {
    return characters.join('');
  }
  return characters.slice(0, MAX_DISPLAY_NAME_LENGTH).join('') + ELLIPSIS;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getHttpsHost = (value: string): string | null => {
  const url = parseUrl(value);
  return url?.protocol === 'https:' ? url.host : null;
};

export const getClientIdentity = ({ clientId, clientName, clientKind }: OAuthClientDescriptor): OAuthClientIdentity => {
  const host = clientKind === OAuthClientKind.CIMD ? getHttpsHost(clientId) : null;

  if (host === null) {
    return { name: sanitizeDisplayName(clientName), isVerified: false, isUnverified: true };
  }
  if (VERIFIED_CLIENT_HOSTS.includes(host)) {
    return { name: sanitizeDisplayName(clientName) || host, isVerified: true, isUnverified: false };
  }
  return { name: host, isVerified: false, isUnverified: false };
};

export const getClientLogoUri = (clientKind: OAuthClientKind, logoUri: string | null): string | null => {
  if (clientKind !== OAuthClientKind.CIMD || logoUri === null) {
    return null;
  }
  return parseUrl(logoUri)?.protocol === 'https:' ? logoUri : null;
};

export const isSafeRedirectUrl = (redirectUrl: string): boolean => {
  const url = parseUrl(redirectUrl);
  return url !== null && SAFE_REDIRECT_PROTOCOLS.includes(url.protocol);
};

export const getScopeLabelKey = (scope: string): string | null =>
  Object.hasOwn(SCOPE_LABEL_KEYS, scope) ? SCOPE_LABEL_KEYS[scope] : null;
