import { esModule } from "./es/report";
import type { Country, CountryModule } from "./types";

// One key today. A second country is purely additive: implement its module and add it here — no
// shared code ever branches on country (contract hard rule).
const MODULES: Record<Country, CountryModule> = {
	es: esModule,
};

/** The tax module for a supported country. */
export function getCountryModule(code: Country): CountryModule {
	return MODULES[code];
}
