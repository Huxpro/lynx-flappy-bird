import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { Game } from './Game.jsx';

root.render(<Game />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
