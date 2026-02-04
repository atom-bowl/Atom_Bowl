  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
  console.log("Firebase module loaded");
  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBNvcpI84hInA_iRWnF9R7k6FCnRkZ_Xtk",
    authDomain: "nsbatombowl.firebaseapp.com",
    projectId: "nsbatombowl",
    storageBucket: "nsbatombowl.firebasestorage.app",
    messagingSenderId: "974348736378",
    appId: "1:974348736378:web:8a9dff15eb3ce057b9a8c3",
    measurementId: "G-07E60ZCBSP"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
