/**
 * Gmail Selectors - Centralized selectors for Gmail automation
 * 
 * Gmail UI thường xuyên thay đổi, tập trung selectors vào một file
 * giúp dễ dàng cập nhật khi cần.
 * 
 * Last updated: 2026-01-04
 */

export const GMAIL_SELECTORS = {
    // ========= Login Page =========
    login: {
        // Email input (Google Sign-in page)
        emailInput: [
            'input[type="email"]',
            'input[name="identifier"]',
            '#identifierId',
        ],

        // Password input
        passwordInput: [
            'input[type="password"]',
            'input[name="password"]',
            'input[name="Passwd"]',
        ],

        // Next button (after email)
        nextButton: [
            '#identifierNext',
            'button:has-text("Next")',
            'button:has-text("Tiếp theo")', // Vietnamese
            'button[jsname="LgbsSe"]',
            'div[role="button"]:has-text("Next")',
        ],

        // Password next button
        passwordNextButton: [
            '#passwordNext',
            'button:has-text("Next")',
            'button:has-text("Tiếp theo")',
            'button[jsname="LgbsSe"]',
            'div[role="button"]:has-text("Next")',
        ],

        // Sign in button
        signInButton: [
            'button:has-text("Sign in")',
            'button:has-text("Đăng nhập")',
            'a:has-text("Sign in")',
        ],

        // 2FA indicators
        twoFactorIndicators: [
            '[data-challengetype]',
            'input[name="totpPin"]',
            '#totpPin',
            'text="2-Step Verification"',
            'text="Xác minh 2 bước"',
        ],

        // Error messages
        errorMessages: [
            '[aria-live="polite"][role="alert"]',
            '.o6cuMc',
            '.dEOOab',
        ],
    },

    // ========= Inbox Detection =========
    inbox: {
        // Logged in indicators
        loggedInIndicators: [
            // Gmail inbox URL patterns
            'a[href*="#inbox"]',
            '[aria-label*="Inbox"]',
            '[aria-label*="Hộp thư đến"]', // Vietnamese
            '[data-tooltip="Inbox"]',
            '[data-tooltip="Hộp thư đến"]',

            // Compose button
            '[gh="cm"]',
            '.T-I.T-I-KE.L3',
            'div[role="button"]:has-text("Compose")',
            'div[role="button"]:has-text("Soạn thư")',

            // Navigation rail
            '[role="navigation"]',

            // Gmail main area
            'div[role="main"]',
        ],

        // Google Account menu (indicates logged in)
        accountMenu: [
            'a[aria-label*="Google Account"]',
            'a[aria-label*="Tài khoản Google"]',
            'img[data-iml]',
            '.gb_d',
        ],

        // Logged out indicators
        loggedOutIndicators: [
            'input[type="email"]',
            'input[type="password"]',
            '#identifierId',
            'button:has-text("Sign in")',
            'a:has-text("Sign in")',
        ],
    },

    // ========= Email List =========
    emailList: {
        // Email rows in inbox
        emailRows: [
            'tr.zA',
            'div[role="row"]',
            'div[role="listitem"]',
        ],

        // Unread emails
        unreadEmails: [
            'tr.zA.yO:not(.zE)',
            'tr.zA[class*="zE"]', // Sometimes Gmail uses zE for unread
            'div[role="row"][class*="unread"]',
        ],

        // Email subject
        emailSubject: [
            '.bog span',
            '.bqe span',
            'span[data-thread-id]',
        ],

        // Email sender
        emailSender: [
            '.yX span[email]',
            '.bA4 span[email]',
        ],

        // Star button
        starButton: [
            '[aria-label*="Star"]',
            '[aria-label*="Gắn dấu sao"]',
            '[title*="Star"]',
            '.T-KT',
        ],

        // Archive button
        archiveButton: [
            '[aria-label*="Archive"]',
            '[aria-label*="Lưu trữ"]',
            '[title*="Archive"]',
        ],

        // Delete button
        deleteButton: [
            '[aria-label*="Delete"]',
            '[aria-label*="Xóa"]',
            '[title*="Delete"]',
        ],

        // Checkbox
        checkboxes: [
            '[role="checkbox"]',
            '.oZ-jc',
        ],
    },

    // ========= Compose =========
    compose: {
        // Compose button
        composeButton: [
            '[gh="cm"]',
            '.T-I.T-I-KE.L3',
            'div[role="button"]:has-text("Compose")',
            'div[role="button"]:has-text("Soạn thư")',
            '.z0',
        ],

        // To field
        toField: [
            'input[name="to"]',
            'textarea[name="to"]',
            '[aria-label*="To"]',
            '[aria-label*="Đến"]',
        ],

        // Subject field
        subjectField: [
            'input[name="subjectbox"]',
            '[aria-label*="Subject"]',
            '[aria-label*="Chủ đề"]',
        ],

        // Body field
        bodyField: [
            '[aria-label="Message Body"]',
            '[aria-label="Nội dung thư"]',
            '.Am',
            '[role="textbox"]',
            'div[contenteditable="true"]',
        ],

        // Send button
        sendButton: [
            '[aria-label*="Send"]',
            '[aria-label*="Gửi"]',
            'div[role="button"]:has-text("Send")',
            'div[role="button"]:has-text("Gửi")',
            '.T-I.T-I-atl',
        ],

        // Close compose button
        closeButton: [
            '[aria-label*="Close"]',
            '[aria-label*="Đóng"]',
            '.Ha',
        ],

        // Discard draft button
        discardButton: [
            '[aria-label*="Discard"]',
            '[aria-label*="Hủy"]',
        ],
    },

    // ========= Navigation / Labels =========
    navigation: {
        // Inbox link
        inboxLink: [
            'a[href*="#inbox"]',
            '[aria-label*="Inbox"]',
            '[data-tooltip="Inbox"]',
        ],

        // Sent link
        sentLink: [
            'a[href*="#sent"]',
            '[aria-label*="Sent"]',
            '[aria-label*="Đã gửi"]',
            '[data-tooltip="Sent"]',
        ],

        // Drafts link
        draftsLink: [
            'a[href*="#drafts"]',
            '[aria-label*="Drafts"]',
            '[aria-label*="Nháp"]',
            '[data-tooltip="Drafts"]',
        ],

        // Starred link
        starredLink: [
            'a[href*="#starred"]',
            '[aria-label*="Starred"]',
            '[aria-label*="Có dấu sao"]',
            '[data-tooltip="Starred"]',
        ],

        // Important link
        importantLink: [
            'a[href*="#imp"]',
            '[aria-label*="Important"]',
            '[aria-label*="Quan trọng"]',
            '[data-tooltip="Important"]',
        ],

        // Spam link
        spamLink: [
            'a[href*="#spam"]',
            '[aria-label*="Spam"]',
            '[data-tooltip="Spam"]',
        ],

        // Trash link
        trashLink: [
            'a[href*="#trash"]',
            '[aria-label*="Trash"]',
            '[aria-label*="Thùng rác"]',
            '[data-tooltip="Trash"]',
        ],
    },

    // ========= Search =========
    search: {
        // Search box
        searchBox: [
            '[name="q"]',
            'input[aria-label*="Search"]',
            'input[aria-label*="Tìm kiếm"]',
            '.gb_gf',
            '#gs_lc0 input',
        ],

        // Search button
        searchButton: [
            'button[aria-label*="Search"]',
            'button[aria-label*="Tìm kiếm"]',
            '.gb_cf',
        ],

        // Clear search
        clearSearch: [
            'button[aria-label*="Clear search"]',
            'button[aria-label*="Xóa tìm kiếm"]',
        ],
    },

    // ========= Settings =========
    settings: {
        // Settings gear icon
        settingsButton: [
            'button[aria-label*="Settings"]',
            'button[aria-label*="Cài đặt"]',
            '[data-tooltip="Settings"]',
        ],

        // Quick settings panel
        quickSettings: [
            '[aria-label*="Quick settings"]',
            '[aria-label*="Cài đặt nhanh"]',
        ],

        // See all settings link
        seeAllSettings: [
            'button:has-text("See all settings")',
            'button:has-text("Xem tất cả cài đặt")',
        ],
    },

    // ========= Email Detail View =========
    emailDetail: {
        // Back button
        backButton: [
            '[aria-label*="Back"]',
            '[aria-label*="Quay lại"]',
            '[data-tooltip="Back to"]',
        ],

        // Reply button
        replyButton: [
            '[aria-label*="Reply"]',
            '[aria-label*="Trả lời"]',
            '.T-I.ams',
        ],

        // Forward button
        forwardButton: [
            '[aria-label*="Forward"]',
            '[aria-label*="Chuyển tiếp"]',
        ],

        // Email body
        emailBody: [
            '.a3s',
            '.ii.gt',
            '[data-message-id]',
        ],

        // Attachments
        attachments: [
            '.aQH',
            '[aria-label*="Attachment"]',
        ],
    },
};

/**
 * Helper function to try multiple selectors and return first match
 */
export async function trySelectors(
    page: any,
    selectors: string[],
    options: { timeout?: number; waitFor?: boolean } = {}
): Promise<any | null> {
    const { timeout = 5000, waitFor = false } = options;

    for (const selector of selectors) {
        try {
            if (waitFor) {
                const element = await page.waitForSelector(selector, { timeout });
                if (element) return element;
            } else {
                const element = await page.$(selector);
                if (element) return element;
            }
        } catch {
            // Continue to next selector
        }
    }

    return null;
}

/**
 * Helper function to try clicking with multiple selectors
 */
export async function tryClick(
    page: any,
    selectors: string[],
    options: { timeout?: number; force?: boolean } = {}
): Promise<boolean> {
    const element = await trySelectors(page, selectors);
    if (element) {
        try {
            await element.click({ timeout: options.timeout || 5000, force: options.force });
            return true;
        } catch {
            // Try force click
            try {
                await element.click({ force: true });
                return true;
            } catch {
                return false;
            }
        }
    }
    return false;
}

/**
 * Helper function to check if any selector matches
 */
export async function hasAnySelector(page: any, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) return true;
        } catch {
            // Continue
        }
    }
    return false;
}
