<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-toolbar-title>Crypto Price Tracker</v-toolbar-title>
      <v-btn v-if="user" color="white" variant="tonal" @click="signOut">Sign Out</v-btn>
    </v-app-bar>
    <v-main>
      <v-container class="py-4">
        <div v-if="!user">
          <Auth />
        </div>
        <div v-else>
          <CryptoChart />
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import Auth from './components/Auth.vue'
import CryptoChart from './components/CryptoChart.vue'
import {ref, onMounted} from 'vue'
import {auth} from './firebase'
import {onAuthStateChanged, signOut} from 'firebase/auth'

export default {
  name: "App",
  components: {
    Auth,
    CryptoChart
  },
  setup() {
    const user = ref(null)
    onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser
    })

    const signOutUser = async () => {
      await signOut(auth)
    }

    return {user, signOut: signOutUser}
  }
}
</script>
