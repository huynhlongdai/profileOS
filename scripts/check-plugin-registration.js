/**
 * Script to check if Gmail plugin is registered
 */

// Set DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

async function checkPluginRegistration() {
  console.log('🔍 Checking Plugin Registration...\n')

  try {
    // Import and initialize plugins
    const { initPlugins } = require('../src/lib/init-plugins')
    const { PluginManager } = require('../src/core/plugins/PluginManager')

    console.log('1. Initializing plugins...')
    initPlugins()
    console.log('   ✅ Plugins initialized\n')

    const pluginManager = PluginManager.getInstance()

    console.log('2. Checking registered plugins:')
    const loadedPlugins = pluginManager.getLoadedPlugins()
    console.log(`   Found ${loadedPlugins.length} plugin(s):`)
    loadedPlugins.forEach((plugin) => {
      console.log(`      - ${plugin.name}: ${plugin.supportedTypes.join(', ')}`)
    })

    console.log('\n3. Checking plugin for account type "gmail":')
    const pluginSync = pluginManager.getPluginForAccountTypeSync('gmail')
    if (pluginSync) {
      console.log(`   ✅ Plugin found (sync): ${pluginSync.name}`)
    } else {
      console.log('   ❌ No plugin found (sync)')
    }

    const pluginAsync = await pluginManager.getPluginForAccountType('gmail')
    if (pluginAsync) {
      console.log(`   ✅ Plugin found (async): ${pluginAsync.name}`)
    } else {
      console.log('   ❌ No plugin found (async)')
      console.log('   This means either:')
      console.log('     1. Plugin not registered')
      console.log('     2. Module is disabled')
    }

    console.log('\n4. Checking module enabled state:')
    const isEnabled = await pluginManager.isModuleEnabled('gmail')
    console.log(`   Module "gmail" enabled: ${isEnabled ? '✅ YES' : '❌ NO'}`)

    console.log('\n📊 Summary:')
    console.log(`   - Plugins loaded: ${loadedPlugins.length}`)
    console.log(`   - Plugin for "gmail" (sync): ${pluginSync ? '✅' : '❌'}`)
    console.log(`   - Plugin for "gmail" (async): ${pluginAsync ? '✅' : '❌'}`)
    console.log(`   - Module enabled: ${isEnabled ? '✅' : '❌'}`)

    if (!pluginAsync) {
      console.log('\n⚠️  ISSUE FOUND: Plugin not available for async operations!')
      if (!pluginSync) {
        console.log('   - Plugin is not registered')
      } else if (!isEnabled) {
        console.log('   - Module is disabled')
      }
    }
  } catch (error) {
    console.error('❌ Error checking plugin registration:', error)
    console.error(error.stack)
  }
}

checkPluginRegistration()

