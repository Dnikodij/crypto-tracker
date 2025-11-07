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

const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const removeListener = auth.onAuthStateChanged(
      user => {
        removeListener();
        resolve(user);
      },
      reject
    )
  })
}

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const currentUser = await getCurrentUser();

    if (requiresAuth && !currentUser) {
        next({ name: 'Login' })
    } else if (!requiresAuth && currentUser) {
        next({ name: 'Dashboard' })
    }
    else {
        next()
    }
})

export default router
