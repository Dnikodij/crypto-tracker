// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCxoDVOXL9COuf7LI_cPM1P1e8d9s-2bp0",
    authDomain: "cryptopricetracker-958f9.firebaseapp.com",
    projectId: "cryptopricetracker-958f9",
    storageBucket: "cryptopricetracker-958f9.firebasestorage.app",
    messagingSenderId: "100893597518",
    appId: "1:100893597518:web:1f5415bd6f1db2dd38881f",
    measurementId: "G-5HDE4G759R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app)

export {db, auth};