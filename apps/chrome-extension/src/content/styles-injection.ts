export function injectStyles(shadowRoot: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 2px solid #60a5fa;
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .copilot-scroll-area {
        scroll-behavior: auto !important;
      }
    }

    @keyframes copilot-blink {
      0%, 50% { opacity: 1; }
      50.01%, 100% { opacity: 0; }
    }

    @keyframes copilot-fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes copilot-fadeOut {
      from { opacity: 0.6; }
      to { opacity: 0; }
    }
  `;
  shadowRoot.appendChild(style);
}
