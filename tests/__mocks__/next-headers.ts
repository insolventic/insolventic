// Mock for next/headers (cookies + headers)
const cookieStore = new Map<string, { name: string; value: string }>();

export const mockCookies = {
  get: jest.fn((name: string) => cookieStore.get(name)),
  set: jest.fn((name: string, value: string) => {
    cookieStore.set(name, { name, value });
  }),
  delete: jest.fn((name: string) => {
    cookieStore.delete(name);
  }),
  clear: () => cookieStore.clear(),
  setToken: (name: string, value: string) => {
    cookieStore.set(name, { name, value });
  },
};

export const cookies = jest.fn(() => Promise.resolve(mockCookies));

// Mock for headers()
const headerStore = new Map<string, string>();
headerStore.set('x-forwarded-for', '127.0.0.1');

export const mockHeaders = {
  get: jest.fn((name: string) => headerStore.get(name) || null),
  set: (name: string, value: string) => headerStore.set(name, value),
};

export const headers = jest.fn(() => Promise.resolve(mockHeaders));
