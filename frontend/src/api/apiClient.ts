let isLoggingOut = false;

export const apiClient = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, init);

  if (response.status === 401 && !isLoggingOut) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (!url.includes('/login') && !url.includes('/register')) {
      isLoggingOut = true;

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      window.location.href = '/login';
    }
  }

  return response;
};
