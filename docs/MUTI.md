Ok, mình chia nhỏ thành **4 phần** rõ ràng, mỗi phần là **một prompt độc lập** để bạn quăng vào Cursor.
Bạn chỉ cần copy từng block `### Prompt cho Cursor` theo thứ tự.

---

## 🧩 Phần 1 – Cập nhật schema Account để hỗ trợ login bằng Google & liên kết tài khoản

### Mục tiêu

* Thêm:

  * `LoginMethod` enum
  * `loginMethod` field cho `Account`
  * `authViaAccountId` + quan hệ self-relation để link “tài khoản con” (Coingecko, X, CMC,…) với “tài khoản gốc” (Gmail).
* (Optional) Thêm `lastCandyClaim`, `lastCandyAmount` nếu chưa có.

---

### ✅ Prompt cho Cursor – Phần 1

````md
You are a senior TypeScript + Prisma engineer working inside my existing project.

⚠️ IMPORTANT:
- Do NOT break existing core architecture.
- Do NOT rename or remove existing fields unless absolutely necessary.
- Only EXTEND the current models to support Google-based login sharing.

Goal of this task:
Add support for:
- `loginMethod` (PASSWORD vs GOOGLE_OAUTH) on Account
- Linking "child" accounts (like CoinGecko/X/CMC) to a "parent" Gmail account via `authViaAccountId`.
- (Optional) fields to track Candy claim status.

### 1. Update Prisma schema

1. Open `prisma/schema.prisma`.
2. Locate the existing `Account` model.
3. Add this enum:

```prisma
enum LoginMethod {
  PASSWORD
  GOOGLE_OAUTH
}
````

4. Update the `Account` model to include:

```prisma
model Account {
  id          String   @id @default(cuid())
  // ... existing fields (keep them)

  // NEW FIELDS:
  loginMethod      LoginMethod @default(PASSWORD)

  /// If this account authenticates via another account (e.g., Google OAuth via a Gmail account)
  authViaAccountId String?
  authViaAccount   Account?    @relation("AccountAuthVia", fields: [authViaAccountId], references: [id])
  authChildren     Account[]   @relation("AccountAuthVia")

  // OPTIONAL fields for Candy tracking (only if not already exist)
  lastCandyClaim   DateTime?
  lastCandyAmount  Int?

  // keep createdAt, updatedAt, etc.
}
```

Keep all existing fields (identifier, accountType, status, passwordEncrypted, gpmloginProfileId, proxyId, lastCheck, lastLogin, lastCare, etc).

5. Generate a migration:

* Do NOT actually run the migration in code, just ensure schema is syntactically valid and consistent.

### 2. Backward-compatibility notes

* Existing accounts should default to:

  * `loginMethod = PASSWORD`
  * `authViaAccountId = null`
* Do NOT change any existing queries or behavior yet in this step.

### 3. Output

At the end, show me the updated `Account` model and `LoginMethod` enum from `schema.prisma` so I can review.

````

---

## 🧩 Phần 2 – Cập nhật ProfileService để share GPM profile giữa Gmail & các service con

### Mục tiêu

- Nếu account có `gpmloginProfileId` → dùng profile đó.
- Nếu **không**, nhưng có `authViaAccountId` → mượn profile của account cha (thường là Gmail), và ghi lại cho lần sau.
- Nếu vẫn không có → dùng logic cũ (tạo/mapping profile từ GPM).

---

### ✅ Prompt cho Cursor – Phần 2

```md
You are a senior backend engineer working on the core services of my app.

⚠️ IMPORTANT:
- Do NOT change the external contract of ProfileService beyond what is described here.
- Preserve existing behavior for accounts that already have `gpmloginProfileId`.
- We are only extending logic to support linked accounts via `authViaAccountId`.

Goal:
Update `ProfileService.ensureProfileForAccount(account)` so that:
- If an account has no profile, but has `authViaAccountId`, it can re-use the parent account's profile.

### 1. Locate ProfileService

Open `src/core/services/ProfileService.ts` (or the equivalent path in my project).

It should already have a method similar to:

```ts
async ensureProfileForAccount(account: Account): Promise<Profile> {
  // old logic here (mapping / creating profile)
}
````

### 2. Implement the new logic

Update `ensureProfileForAccount(account: Account)` with the following behavior:

1. If `account.gpmloginProfileId` is set:

   * Try to load that profile from the DB.
   * If it exists → return it.

2. If `account.gpmloginProfileId` is NOT set, but `account.authViaAccountId` is set:

   * Load the parent account:

     ```ts
     const parent = await prisma.account.findUnique({ where: { id: account.authViaAccountId } });
     ```
   * If `parent?.gpmloginProfileId` exists:

     * Try to load that profile.
     * If it exists:

       * Update the child account to remember this profile:

         ```ts
         await prisma.account.update({
           where: { id: account.id },
           data: { gpmloginProfileId: parent.gpmloginProfileId },
         });
         ```
       * Return the profile.

3. If after steps (1) and (2) we still don't have a profile:

   * Fallback to the existing behavior (whatever you had before):

     * Create or map a GPM profile for this account.
     * Save `gpmloginProfileId` on the account.
     * Return that profile.

### 3. Implementation style

* Use the existing `prisma` client already injected into `ProfileService`.
* Do NOT change `ProfileService` constructor signature.
* Do NOT remove any existing method. Only extend `ensureProfileForAccount`.

### 4. Output

At the end, show me the updated implementation of:

```ts
async ensureProfileForAccount(account: Account): Promise<Profile>
```

including the new logic to:

* reuse parent profile via `authViaAccountId` when available,
* and fallback to the old logic when not.

````

---

## 🧩 Phần 3 – Helper lấy “login account” (Gmail gốc) từ bất kỳ account nào

### Mục tiêu

- Tạo 1 helper dùng lại ở nhiều service (Gmail, CoinGecko, X,…):
  - Cho một `accountId` (service account), trả về:
    - `account` (bản thân nó)
    - `loginAccount` (chính nó hoặc account cha nếu có `authViaAccountId`)
- Giúp service biết nên dùng password/profile của ai.

---

### ✅ Prompt cho Cursor – Phần 3

```md
You are a senior backend engineer working on the account domain.

Goal:
Create a reusable helper to determine which account is actually used to login (the "login account"), given any account id.

### 1. Location

Add this helper as a method in `AccountService`, or in a small dedicated helper file (e.g. `src/core/services/AccountLoginHelper.ts`), depending on which is more consistent with the existing structure.

Prefer to implement it as a method on `AccountService` if it already exists and is used widely.

### 2. Method spec

We want a method with this signature:

```ts
async getAccountWithLoginAccount(accountId: string): Promise<{
  account: Account;
  loginAccount: Account;
}>;
````

Behavior:

1. Load `account` by id:

   * If not found → throw `"Account not found"`.

2. If `account.authViaAccountId` is set:

   * Load the `loginAccount` as the parent account:

     ```ts
     const loginAccount = await prisma.account.findUnique({
       where: { id: account.authViaAccountId },
     });
     ```
   * If parent is not found, fallback to `account` itself as `loginAccount`.

3. If `account.authViaAccountId` is NOT set:

   * `loginAccount = account`.

4. Return:

   ```ts
   return { account, loginAccount };
   ```

### 3. Requirements

* Use the existing Prisma client already available in the service.
* Do NOT change any existing external API of AccountService, only add this helper method.
* This helper will later be used by GmailService, CoinGeckoCandyService, and others.

### 4. Output

Show me:

* The new helper method implementation.
* And where you added it (which file and class).

````

---

## 🧩 Phần 4 – Update CoinGeckoCandyService (và module coingecko_candy) để dùng loginAccount + shared profile

### Mục tiêu

- CoinGeckoCandyService:
  - Dùng helper `getAccountWithLoginAccount` (Phần 3).
  - Dùng profile từ `ProfileService.ensureProfileForAccount(account)` (đã share với Gmail nhờ Phần 2).
  - Phân nhánh theo `loginMethod`:
    - PASSWORD → login Coingecko kiểu username/password.
    - GOOGLE_OAUTH → login bằng Google (qua loginAccount là Gmail).
- CoinGeckoCandyPlugin & BrowserController giữ cấu trúc cũ, chỉ điều chỉnh nhẹ nơi cần.

---

### ✅ Prompt cho Cursor – Phần 4

```md
You are a senior automation + backend engineer.

We already updated:
- `Account` model to have `loginMethod` and `authViaAccountId`.
- `ProfileService.ensureProfileForAccount(account)` to reuse parent GPM profile.
- Introduced `AccountService.getAccountWithLoginAccount(accountId)`.

Now we want to update the **CoinGecko Candy module** to support:
- Multiple services (CoinGecko) using the same Gmail login (Google OAuth).
- Reuse shared GPM profile.

### 1. Locate CoinGeckoCandyService

Open `src/plugins/coingecko/CoinGeckoCandyService.ts` (or the equivalent file you created earlier for the CoinGecko Candy logic).

It should have a method similar to:

```ts
async claimCandyForAccount(accountId: string): Promise<void> {
  // previous logic
}
````

### 2. Inject AccountService (if not yet)

If `CoinGeckoCandyService` is NOT yet injected with `AccountService`, update its constructor to include:

```ts
import { AccountService } from "../../core/services/AccountService";

export class CoinGeckoCandyService {
  constructor(
    private prisma: PrismaClient,
    private profileService: ProfileService,
    private browserController: BrowserController,
    private logService: LogService,
    private moduleService: ModuleService,
    private accountService: AccountService   // <-- NEW
  ) {}
}
```

Adjust all places where this service is instantiated (e.g. in the CoinGecko plugin factory) to pass `accountService` correctly.

### 3. Update `claimCandyForAccount(accountId)` logic

Update the top of `claimCandyForAccount` to:

1. Use the new helper:

```ts
const { account, loginAccount } =
  await this.accountService.getAccountWithLoginAccount(accountId);
```

2. Ensure this service only runs for `account.accountType === 'coingecko'`:

   ```ts
   if (account.accountType !== "coingecko") {
     throw new Error("CoinGeckoCandyService only applies to accountType = 'coingecko'");
   }
   ```

3. Use `account` when:

   * Checking `lastCandyClaim`
   * Updating `lastCandyClaim`, `lastCandyAmount`, `lastCheck`
   * Logging “which CoinGecko account” you are claiming for

4. Use `loginAccount` when:

   * Deciding how to log in:

     * Read `loginAccount.loginMethod`
     * Use `loginAccount.identifier` and `loginAccount.passwordEncrypted` if required
   * Ensuring GPM profile via `ProfileService`:

     * Call:

       ```ts
       const profile = await this.profileService.ensureProfileForAccount(loginAccount);
       const { host, port } = await this.profileService.ensureProfileRunning(profile.id);
       ```

5. Branch on `loginAccount.loginMethod`:

```ts
if (loginAccount.loginMethod === "PASSWORD") {
  // Old style: direct email/password login into CoinGecko
  // Use loginAccount.identifier + loginAccount.passwordEncrypted (after decrypt if needed)
  await candyPage.performLoginWithEmailPassword(loginAccount.identifier, password);
} else if (loginAccount.loginMethod === "GOOGLE_OAUTH") {
  // New style: login via "Continue with Google"
  // You should use a method on CoinGeckoCandyPageController like: performLoginWithGoogle()
  await candyPage.performLoginWithGoogle(loginAccount.identifier);
}
```

You may need to extend `CoinGeckoCandyPageController` accordingly:

```ts
export interface CoinGeckoCandyPageController {
  goToCandyPage(): Promise<void>;
  checkLoginStatus(): Promise<"logged_in" | "logged_out" | "unknown">;

  // For direct email/password login
  performLogin(email: string, password: string): Promise<void>;

  // For Google OAuth login
  performLoginWithGoogle(googleEmail: string): Promise<void>;

  claimDailyCandy(): Promise<{
    status: "claimed" | "already_claimed" | "error";
    candyAmount?: number;
  }>;

  tryCompleteMissions(): Promise<void>;
}
```

If you already named these methods differently, keep your existing naming but ensure the logic is split between:

* email/password login, and
* Google OAuth login (using `loginAccount.identifier` to pick the right Google account).

### 4. Use shared profile

IMPORTANT:

* When calling `ProfileService.ensureProfileForAccount`, you must pass `loginAccount`, not the `account` (CoinGecko child).
* This allows the child service account to reuse the Gmail/GPM profile from the parent.

Example:

```ts
const profile = await this.profileService.ensureProfileForAccount(loginAccount);
const { host, port } = await this.profileService.ensureProfileRunning(profile.id);

const session = await this.browserController.connectByRemoteDebugging(host, port);
const candyPage = await this.browserController.openCoinGeckoCandyPage(session);
```

### 5. Keep config logic intact

If you already have a `CoinGeckoCandyConfig` (min intervals, schedule windows, etc.), keep that logic in place:

* Use `account.lastCandyClaim` and the config to decide whether to skip.
* Use `config.minClaimIntervalMinutes`, `config.claimScheduleMode`, etc. as before.

### 6. Output

At the end, show me:

1. The updated constructor of `CoinGeckoCandyService`.
2. The updated `claimCandyForAccount(accountId: string)` method.
3. Any changes you made to:

   * `CoinGeckoCandyPageController` interface
   * The plugin factory where `CoinGeckoCandyService` is instantiated.

```

---

Nếu bạn muốn sau 4 phần này, mình có thể viết thêm **Phần 5** cho GmailService (để Gmail cũng dùng `loginMethod` và `authViaAccountId` trong tương lai, nếu bạn dùng nhiều lớp Gmail lồng nhau), hoặc prompt riêng để cập nhật **UI tạo account** cho phép chọn “Login bằng Gmail account nào?”.
```
