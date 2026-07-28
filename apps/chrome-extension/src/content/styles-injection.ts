export function injectStyles(shadowRoot: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 2px solid #818cf8;
      outline-offset: 2px;
    }

    /* Scrollbars customizadas e discretas */
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.4);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(99, 102, 241, 0.7);
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    @keyframes copilot-blink {
      0%, 50% { opacity: 1; }
      50.01%, 100% { opacity: 0; }
    }

    @keyframes copilot-pulse-glow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.1); }
    }

    .copilot-cursor {
      display: inline-block;
      margin-left: 2px;
      color: #818cf8;
      animation: copilot-blink 1s infinite;
    }

    .copilot-pulse {
      animation: copilot-pulse-glow 2s ease-in-out infinite;
    }
  `;
  shadowRoot.appendChild(style);
}
