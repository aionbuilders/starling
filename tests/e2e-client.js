import { Starling, ConnectionClosedError } from "../src/index.js";

const client = new Starling({ url: "ws://localhost:3000" });

console.log("\n=== Starling E2E Test Client ===\n");

// Log tous les events pour debug
client.events.on("**", ({event}) => {
    if (!event.topic.startsWith("response:") && !event.topic.startsWith("error:")) {
        console.log(`[Client Event] ${event.topic}`);
    }
});

// Test 5: Method pour répondre aux requests du serveur
client.method("client.info", () => {
    console.log("[Client] Server requested client info");
    return {
        name: "Test Client",
        version: "1.0.0",
        userAgent: "Bun E2E Test"
    };
});

// Test 4: Subscribe to chat messages
client.on("chat:message", (data) => {
    console.log(`[Client] Received chat: ${data.user}: ${data.message}`);
});

async function runTests() {
    try {
        // Connect to server
        console.log("🔌 Connecting to server...");
        await client.connect();
        console.log("✅ Connected!\n");

        // Wait a bit for server-to-client request to complete
        await new Promise(r => setTimeout(r, 200));

        // Test 1: Ping/Pong
        console.log("\n--- Test 1: Ping/Pong ---");
        const pong = await client.request("ping", {});
        console.log(`✅ Ping response: "${pong.data}"`);
        console.assert(pong.data === "pong", "Ping should return pong");

        // Test 2: Echo
        console.log("\n--- Test 2: Echo ---");
        const testData = { hello: "world", number: 123 };
        const echo = await client.request("echo", testData);
        console.log(`✅ Echo response:`, echo.data);
        console.assert(JSON.stringify(echo.data) === JSON.stringify(testData), "Echo should return same data");

        // Test 3: Timeout
        console.log("\n--- Test 3: Request Timeout ---");
        try {
            await client.request("slow", {}, { timeout: 1000 });
            console.log("❌ Should have timed out");
        } catch (e) {
            console.log(`✅ Timeout caught: "${e.message}"`);
            console.assert(e.message.includes("timed out"), "Should timeout");
        }

        // Test 4: Pub/sub (won't receive our own message in this simple setup)
        console.log("\n--- Test 4: Pub/Sub ---");
        console.log("[Client] Publishing chat message...");
        // Note: We won't receive this back because we'd need another client
        // But server will log the broadcast

        // Test 6: Disconnect during request
        console.log("\n--- Test 6: Disconnect During Request ---");

        // Start a slow request but don't await it yet
        const slowRequest = client.request("slow", {}, { timeout: 5000 });

        // Disconnect after 100ms
        setTimeout(() => {
            console.log("[Client] Disconnecting...");
            client.websocket.close();
        }, 100);

        // Try to await the request - should fail with ConnectionClosedError
        try {
            await slowRequest;
            console.log("❌ Should have failed with ConnectionClosedError");
        } catch (e) {
            if (e instanceof ConnectionClosedError) {
                console.log(`✅ ConnectionClosedError caught: "${e.message}"`);
            } else {
                console.log(`⚠️  Different error: "${e.message}"`);
            }
        }

        console.log("\n=== All Tests Completed ===\n");

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runTests();
