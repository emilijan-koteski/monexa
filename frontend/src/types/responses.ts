import type { User } from './models';

// Generic API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Authentication Response
export interface AuthResponse {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: User;
}
