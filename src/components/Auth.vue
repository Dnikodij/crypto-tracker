<template>
  <v-container fluid class="d-flex align-center justify-center h-100">
    <v-card class="pa-4 mx-auto" max-width="400">
      <v-card-title>Firebase Auth</v-card-title>
      <v-card-text>
        <v-text-field
            v-model="email"
            label="Email"
            outlined
            dense
        ></v-text-field>
        <v-text-field
            v-model="password"
            label="Password"
            type="password"
            outlined
            dense
        ></v-text-field>
        <v-alert
            v-if="errorMessage"
            type="error"
            dismissible
            class="mt-4"
        >
          {{ errorMessage }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="signUp">Sign Up</v-btn>
        <v-btn color="secondary" @click="signIn">Sign In</v-btn>
      </v-card-actions>
    </v-card>
    <!-- Display current user -->
    <div v-if="user" class="mt-4">
      Logged in as: {{ user.email }}
      <v-btn color="error" @click="signOut">Sign Out</v-btn>
    </div>
  </v-container>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { auth } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

export default {
  name: "Auth",
  setup() {
    const email = ref("");
    const password = ref("");
    const errorMessage = ref("");
    const user = ref(null);
    const router = useRouter();

    const signUp = async () => {
      errorMessage.value = "";
      try {
        const res = await createUserWithEmailAndPassword(
            auth,
            email.value,
            password.value
        );
        user.value = res.user;
        router.push({ name: 'Dashboard' });
      } catch (error) {
        errorMessage.value = error.message;
      }
    };

    const signIn = async () => {
      errorMessage.value = "";
      try {
        const res = await signInWithEmailAndPassword(
            auth,
            email.value,
            password.value
        );
        user.value = res.user;
        router.push({ name: 'Dashboard' });
      } catch (error) {
        errorMessage.value = error.message;
      }
    };

    const signOutUser = async () => {
      try {
        await signOut(auth);
        user.value = null;
      } catch (error) {
        errorMessage.value = error.message;
      }
    };

    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
      });
    });

    return {
      email,
      password,
      errorMessage,
      user,
      signUp,
      signIn,
      signOut: signOutUser,
    };
  },
};
</script>

<style scoped>
/* Add any styling you need */
</style>
