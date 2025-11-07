// main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

// Vuetify imports
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

// Highcharts-Vue
import HighchartsVue from 'highcharts-vue'
import router from "./router.js";

// Create the Vuetify instance with auto-registered components and directives
const vuetify = createVuetify({
    components,
    directives,
    defaults: {
      VContainer: {
        fluid: true,
      },
    },
    icons: {
      defaultSet: 'mdi',
    },
})

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.use(HighchartsVue)
app.use(router)
app.mount('#app')
