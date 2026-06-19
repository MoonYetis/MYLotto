/**
 * Helper para mockear fetch en tests del transport UniSat.
 * Igual patrón que rpc-client pero GET en vez de POST.
 */

export interface MockCall {
  url: string;
  init: RequestInit;
}

export interface MockResponse {
  status?: number;
  body: unknown;
}

export class FetchMock {
  private responses: MockResponse[] = [];
  public calls: MockCall[] = [];

  queue(res: MockResponse): this {
    this.responses.push(res);
    return this;
  }

  fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlString =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    this.calls.push({ url: urlString, init: init ?? {} });

    const next = this.responses.shift();
    if (!next) {
      throw new Error("FetchMock: no hay respuestas encoladas");
    }
    const status = next.status ?? 200;
    return new Response(JSON.stringify(next.body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  reset(): void {
    this.responses = [];
    this.calls = [];
  }
}
