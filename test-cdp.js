const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    try {
        await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: 100,
            y: 100,
            button: 'none',
            clickCount: 1,
        });
        console.log("Mouse moved with 'none' button successfully.");
    } catch (e) {
        console.error("Error with 'none':", e.message);
    }

    // Test mousePressed with 'none'
    try {
        await cdp.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: 100,
            y: 100,
            button: 'none',
            clickCount: 1,
        });
        console.log("Mouse pressed with 'none' button successfully.");
    } catch (e) {
        console.error("Error with mousePressed 'none':", e.message);
    }

    await browser.close();
})();
