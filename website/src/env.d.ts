/// <reference types="@rsbuild/core/types" />

export interface LynxViewElement extends HTMLElement {
  sendGlobalEvent(event: string, params: unknown[]): void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lynx-view': React.DetailedHTMLProps<
        React.HTMLAttributes<LynxViewElement> & {
          url?: string;
        },
        LynxViewElement
      >;
    }
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
