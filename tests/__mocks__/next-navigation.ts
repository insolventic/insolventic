// Mock for next/navigation
export const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
export const useRouter = jest.fn();
export const usePathname = jest.fn();
