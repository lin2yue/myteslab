import { createSSRApp } from "vue";
import * as Pinia from 'pinia';

import App from "./App.vue";
import './tailwind.css';

// import { shareMixin } from './mixins/share'

export function createApp() {
	const app = createSSRApp(App);
	app.use(Pinia.createPinia());
	// app.mixin(shareMixin); // Removed in favor of Composition API usage
	return {
		app,
		Pinia,
	};
}
