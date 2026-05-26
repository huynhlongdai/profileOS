/**
 * Simple test script to verify automation recording and execution
 * 
 * Usage: node test-automation.mjs
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3211/api';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAutomation() {
    console.log('🧪 Testing Automation System\n');

    try {
        // 1. Get running profiles
        console.log('1️⃣  Fetching running profiles...');
        const profilesRes = await fetch(`${API_BASE}/profiles`);
        const profilesData = await profilesRes.json();

        if (!profilesData.success) {
            throw new Error('Failed to fetch profiles');
        }

        const runningProfiles = profilesData.profiles.filter(p => p.status === 'running');

        if (runningProfiles.length === 0) {
            console.log('❌ No running profiles found. Please start a profile first.');
            console.log('\nSteps:');
            console.log('  1. Go to http://localhost:3211/profiles');
            console.log('  2. Click "Start" on a profile');
            console.log('  3. Run this test again');
            return;
        }

        const profile = runningProfiles[0];
        console.log(`✅ Found running profile: ${profile.name} (${profile.id})`);
        console.log(`   Remote debugging port: ${profile.remoteDebuggingPort || 'N/A'}\n`);

        // 2. Start recording
        console.log('2️⃣  Starting recording...');
        const startRecRes = await fetch(`${API_BASE}/automation/recordings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId: profile.id,
                name: `Test Recording ${new Date().toISOString()}`,
                description: 'Automated test recording',
            }),
        });

        const startRecData = await startRecRes.json();

        if (!startRecData.success) {
            console.log(`❌ Failed to start recording: ${startRecData.error}`);
            console.log('\nPossible issues:');
            console.log('  - Profile may not have remote debugging port');
            console.log('  - Browser may not be responsive');
            console.log('  - RecorderInjector may have failed');
            return;
        }

        const recordingId = startRecData.recording.id;
        console.log(`✅ Recording started: ${recordingId}`);
        console.log(`   Recording name: ${startRecData.recording.name}\n`);

        // 3. Wait for user to perform actions
        console.log('3️⃣  Recording is active! Perform actions in the browser for 30 seconds...');
        console.log('   Suggested actions:');
        console.log('   - Click on links');
        console.log('   - Type in input fields');
        console.log('   - Navigate to different pages');
        console.log('');

        for (let i = 30; i > 0; i--) {
            process.stdout.write(`   Time remaining: ${i}s \r`);
            await sleep(1000);
        }
        console.log('\n');

        // 4. Stop recording
        console.log('4️⃣  Stopping recording...');
        const stopRecRes = await fetch(
            `${API_BASE}/automation/recordings/${recordingId}/stop`,
            { method: 'POST' }
        );

        const stopRecData = await stopRecRes.json();

        if (!stopRecData.success) {
            console.log(`❌ Failed to stop recording: ${stopRecData.error}`);
            return;
        }

        console.log(`✅ Recording stopped`);
        console.log(`   Status: ${stopRecData.recording.status}`);
        console.log(`   Actions recorded: ${stopRecData.recording.actionCount}\n`);

        // 5. Get recording details
        console.log('5️⃣  Fetching recording details...');
        const getRecRes = await fetch(`${API_BASE}/automation/recordings/${recordingId}`);
        const getRecData = await getRecRes.json();

        if (!getRecData.success) {
            console.log(`❌ Failed to get recording: ${getRecData.error}`);
            return;
        }

        const actions = JSON.parse(getRecData.recording.actionsJson);
        console.log(`✅ Recording retrieved`);
        console.log(`   Total actions: ${actions.length}`);

        if (actions.length > 0) {
            console.log(`\n   First 5 actions:`);
            actions.slice(0, 5).forEach((action, idx) => {
                console.log(`     ${idx + 1}. ${action.type} - ${action.selector || action.url || 'N/A'}`);
            });
        } else {
            console.log(`   ⚠️  No actions were recorded. Try again with manual actions.`);
        }

        console.log('\n✅ Test completed successfully!');
        console.log(`\n📝 View recording at: http://localhost:3211/automation`);
        console.log(`   Recording ID: ${recordingId}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\nStack trace:', error.stack);
    }
}

// Run test
testAutomation().catch(console.error);
