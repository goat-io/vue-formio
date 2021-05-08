import { Provider } from "./Provider";
import Vue from "vue";

Vue.config.silent = true;
// Provide a plugin by default that will register all components.
export class Plugin {
  // Vue Plugin
  static install(
    Vue: Vue,
    {
      providers,
      store,
      router,
    }: { providers: Provider[]; store: any; router: any }
  ) {

    providers.forEach((provider) => {
      provider.init(Vue);
      provider.registerRoutes(router);
      provider.registerStore(store);
    });
  }
}
