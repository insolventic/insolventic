declare module 'html-to-docx' {
  interface DocxOptions {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    header?: boolean;
    pageNumber?: boolean;
    orientation?: 'portrait' | 'landscape';
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
  }

  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string | null,
    options?: DocxOptions,
  ): Promise<ArrayBuffer>;
}
