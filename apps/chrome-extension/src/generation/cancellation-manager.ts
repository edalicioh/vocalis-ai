// ============================================================
// Gerenciador de Cancelamento de Gerações (Chrome Extension)
// ============================================================

export class CancellationManager {
  private activeControllers: Map<string, AbortController> = new Map();

  public createController(id: string): AbortSignal {
    this.cancel(id, 'Nova solicitação iniciada');

    const controller = new AbortController();
    this.activeControllers.set(id, controller);
    return controller.signal;
  }

  public cancel(id: string, _reason?: string): void {
    const controller = this.activeControllers.get(id);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(id);
    }
  }

  public cancelAll(_reason?: string): void {
    for (const [id, controller] of this.activeControllers.entries()) {
      controller.abort();
      this.activeControllers.delete(id);
    }
  }
}
