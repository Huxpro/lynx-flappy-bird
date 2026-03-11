/// <reference types="@rsbuild/core/types" />

declare namespace JSX {
  interface IntrinsicElements {
    'lynx-view': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        url?: string;
      },
      HTMLElement
    >;
  }
}

declare module 'qr-creator' {
  interface QrCreatorOptions {
    text: string;
    radius?: number;
    ecLevel?: 'L' | 'M' | 'Q' | 'H';
    fill?: string;
    background?: string;
    size?: number;
  }

  const QrCreator: {
    render(options: QrCreatorOptions, container: HTMLElement): void;
  };

  export default QrCreator;
}
