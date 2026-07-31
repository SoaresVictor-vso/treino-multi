export type ParameterEntity = {
    id: string;
    name: string;
};

import { CACHE_PARAMETROS, TTL_PARAMETROS } from "../../../lib/constants";
import { IndexedDbEntity, indexedDbService } from "../../../lib/indexeddb";
import { MetricsService } from "./metrics";

export class ParametersService {
    public async search<T extends IndexedDbEntity>(parametro: string): Promise<T[]> {
        const cachedResults = CACHE_PARAMETROS ? await indexedDbService.buscar(parametro) : null;
        const lastSearchKey = `last_search_${parametro}`;
        const lastSearch = typeof localStorage !== "undefined"
            ? Number(localStorage.getItem(lastSearchKey))
            : NaN;
        const cacheIsValid = Number.isFinite(lastSearch) && Date.now() - lastSearch < TTL_PARAMETROS;

        if (cacheIsValid && cachedResults?.length) return cachedResults as T[];

        const buscado = await this.webSearch<T>(parametro, lastSearchKey);
        await indexedDbService.anexar<T>(parametro, buscado);
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(lastSearchKey, String(Date.now()));
        }

        return buscado as T[];
    }

    private webSearch<T>(parametro: string, lastBusca: string | null = null): Promise<T[]> {
        switch (parametro) {
            case "metrics":
                return new MetricsService().buscar() as Promise<T[]>;
            default:
                console.log(lastBusca, parametro);
                throw new Error(`Parâmetro desconhecido: ${parametro}`);
        }
    }
}

export * from "../../../lib/indexeddb";
export * from "./metrics";
export * from "../../../lib/constants";