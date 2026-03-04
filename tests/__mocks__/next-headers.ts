// Mock for next/headers (cookies)
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
