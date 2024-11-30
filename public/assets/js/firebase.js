// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAt5roWduKSCVyWfgif-nVFGjb6ieFEJV8",
  authDomain: "vizmymus.firebaseapp.com",
  projectId: "vizmymus",
  storageBucket: "vizmymus.appspot.com",
  messagingSenderId: "716293288994",
  appId: "1:716293288994:web:a91fb073b81d3665db067b",
  measurementId: "G-YSCLKRRS2Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);