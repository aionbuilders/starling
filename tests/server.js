import { Starling } from "../src/";

const starling = new Starling({
    url: "ws://localhost:3000",
});

starling.events.on("**", ({event}) => {
    console.log(`[Event: ${event.topic}]`);
})

starling.connect().then(() => {
    console.log("Connected to server");
    starling.request("ping", {}).then((response) => {
        console.log("Response from ping:", response.data);
    })
})