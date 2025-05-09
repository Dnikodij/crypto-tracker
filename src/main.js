// main.js
import { createApp } from 'vue'
import App from './App.vue'

// Vuetify imports
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Highcharts-Vue
import HighchartsVue from 'highcharts-vue'
import router from "./router.js";

// Create the Vuetify instance with auto-registered components and directives
const vuetify = createVuetify({
    components,
    directives,
})

createApp(App)
    .use(vuetify)
    .use(HighchartsVue)
    .use(router)
    .mount('#app')
