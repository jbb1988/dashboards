'use client';

import { useState } from 'react';
import HelpButton from './HelpButton';
import HelpDrawer from './HelpDrawer';

export default function HelpProvider() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <HelpButton onClick={() => setIsHelpOpen(true)} />
      <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
