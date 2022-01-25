const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const admin = require("firebase-admin");
const serviceAccount = require("./keys.json")
const loginInfo = require("./.env/login.json")
//const prompt = require('prompt-sync')();

admin.initializeApp({
    projectId: "auth-screener",
    credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore();

async function runAutoScreener(production, writeNewCookie) {
    const formLink = "https://calberkeley.ca1.qualtrics.com/jfe/form/SV_3xTgcs162K19qRv";
    let browser;
    if (production) {
        browser = await puppeteer.launch({ slowMo: 10 });
    } else {
        browser = await puppeteer.launch({ headless: false, devtools: true, slowMo: 100 });
    }
    const page = await browser.newPage();
    let userAuth = {};
    await db.collection("users")
            .doc("personal")
            .get()
            .then((doc) => {
                const dbUserAuth = doc.data()
                userAuth["username"] = dbUserAuth["username"]
                userAuth["password"] = dbUserAuth["password"]
                userAuth["authCookie"] = dbUserAuth["authCookie"]
                userAuth["authTokenExpires"] = dbUserAuth["authTokenExpires"]
            })
    
    try {

        await page.goto(formLink);
        await page.screenshot({ path: './logs/example.png', fullPage: true });
        
        if (!writeNewCookie) {
            //const cookiesString = await fs.readFile('./.env/cookies/cookies_v4.json');
            const cookiesString = userAuth["authCookie"]
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies)
            console.log("Cookies set!")
            showDaysToExpiry(userAuth["authTokenExpires"])
        }

        const q1ID = "#QID10-5-label"
        const nextButtonID = "#NextButton"
        await page.waitForSelector(q1ID)
        await page.click(q1ID)
        await page.click(nextButtonID)

        // credentials
        console.log("Authentication beginning (check Duomobile if not progressing)...")
        const usernameID = "#username"
        const passwordID = "#password"
        const submitBtnID = "#submit"
        await page.waitForSelector(usernameID)
        await page.waitForSelector(passwordID)
        await page.type(usernameID, userAuth["username"])
        await page.type(passwordID, userAuth["password"])
        await page.click(submitBtnID)

        const q2ID = "#QID3-3-label"
        await page.waitForSelector(q2ID)
        console.log("Authentication completed")
        await page.click(q2ID)
        await page.click(nextButtonID)

        // all questions completed
        const finishedID = "#EndOfSurvey"
        await page.waitForSelector(finishedID)

        await page.screenshot({ path: 'logs/success.png', fullPage: true });

        if (writeNewCookie) {
            const createdCookies = await page.cookies("https://api-6b447a0c.duosecurity.com");
            //console.log(JSON.stringify(createdCookies1))
            await writeToDB(createdCookies)
        }

        await browser.close()
        
        console.log("Task succeeded")

    } catch (e) {
        console.log(`Task Failed: ${e}`)
        await page.screenshot({ path: './logs/error.png', fullPage: true });

    }
}

async function writeToDB(cookies) {
    // cookies: JSON object

    let authToken = findAuthToken(cookies)
    if (!authToken) {
        throw new Error("Authentication token not found, cookies not saved! Please make sure you're hitting 'remember my cookies' on the Duomobile authentication page.")
    } else {
        showDaysToExpiry(authToken.expires)

        await db.collection("users")
                .doc("personal")
                .update({
                    authCookie: JSON.stringify(cookies),
                    authTokenExpires: authToken.expires
                })
                .then(() => {
                    console.log("Cookie successfully written")
                })
                .catch((e) => {
                    console.log(`Cookie failed to be written with error: ${e}`)
                })

    }
}

function showDaysToExpiry(expiryTimestamp) {
    // expiryTimestamp: Unix timestamp in seconds
    if (expiryTimestamp > 0) {
        let expireDate = new Date(expiryTimestamp * 1000);
        let today = new Date()
        let difInDays = (expireDate - today) / (1000 * 3600 * 24)
        console.log(`Auth Token expires ${expireDate.toString()} (${Math.round(difInDays * 100) / 100} days from now)`)
    }
}

function findAuthToken(cookiesJSON) {
    // cookiesJSON: cookies as JSON object
    let authToken;
    for (let cookie of cookiesJSON) {
        if (cookie["name"] == "fdc|DI2E6FDN4O8CMBAS3N1N|DU9VDMJB4QFC7Z567WJC") {
            authToken = cookie
            break
        }
    }

    return authToken
}

runAutoScreener(true, false)
    .then(() => {console.log("Promise resolved"); process.exit()})
    .catch((e) => {console.log(`Task failed with runtime error: ${e}`); process.exit()});
