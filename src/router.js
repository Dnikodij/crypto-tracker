// src/router.js
import { createRouter, createWebHistory } from 'vue-router'
import Auth from './components/Auth.vue'
import CryptoChart from './components/CryptoChart.vue'
import { auth } from './firebase'

const routes = [
    {
        path: '/',
        name: 'Login',
        component: Auth
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: CryptoChart,
        meta: { requiresAuth: true }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Route guard to check for authentication
router.beforeEach((to, from, next) => {
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const currentUser = auth.currentUser
    if (requiresAuth && !currentUser) {
        next({ name: 'Login' })
    } else {
        next()
    }
})

export default router
