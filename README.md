### Auto-Screener

Powered with Headless Chrome (via puppeteer), Node.js, and Firebase cloud functions, Auto-Screener automatically fills out and submits Berkeley's symptom screener, a form students are made to complete daily. Since CalNet involves a 2FA authentication, Auto-Screener stores the user's auth token to bypass the process. The script uploaded here can be run locally with Firebase Admin SDK and includes two functions to auto-submit the form and upload a new authentication cookie for Duomobile.