/**
 * Garante um intervalo mínimo entre chamadas a um serviço público.
 *
 * O Nominatim pede no máximo 1 requisição por segundo; o Overpass também é
 * comunitário. As chamadas são enfileiradas em ordem: nenhuma "fura a fila" e
 * nenhuma sai antes do intervalo, mesmo com várias buscas ao mesmo tempo.
 */

export interface RateLimiterClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const systemClock: RateLimiterClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class MinIntervalRateLimiter {
  private readonly minIntervalMs: number;
  private readonly clock: RateLimiterClock;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private queue: Promise<void> = Promise.resolve();

  constructor(minIntervalMs: number, clock: RateLimiterClock = systemClock) {
    this.minIntervalMs = Math.max(0, minIntervalMs);
    this.clock = clock;
  }

  /** Executa a tarefa respeitando o intervalo desde o início da anterior. */
  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastStartedAt + this.minIntervalMs - this.clock.now();
      if (wait > 0) await this.clock.sleep(wait);
      this.lastStartedAt = this.clock.now();
    });
    // A fila segue mesmo se a tarefa falhar.
    this.queue = run.catch(() => undefined);
    return run.then(task);
  }
}
