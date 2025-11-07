<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-toolbar-title>Crypto Price Tracker</v-toolbar-title>
      <v-btn v-if="user" color="white" variant="tonal" @click="signOutAndRedirect">Sign Out</v-btn>
    </v-app-bar>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

export default {
  name: "App",
  setup() {
    const user = ref(null)
    const router = useRouter()

    onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser
    })

    const signOutAndRedirect = async () => {
      await signOut(auth)
      router.push({ name: 'Login' })
    }

    return { user, signOutAndRedirect }
  }
}
</script>
