import { ProfileService } from './src/core/services/ProfileService'

async function test() {
  const profileService = new ProfileService()
  console.log("Testing openAccountStartupUrl with lovable account (cmjbddhs6007j9f95w87okjk0)...")
  
  // Expose the private method for testing
  const pSrv = profileService as any
  try {
    // profileId, port, accountId
    await pSrv.openAccountStartupUrl('cmira3jrz0005s83oc6l6j0le', 9222, 'cmjbddhs6007j9f95w87okjk0')
    console.log("Finished executing openAccountStartupUrl")
  } catch (e) {
    console.error("Error in test:", e)
  }
}

test().catch(console.error)
