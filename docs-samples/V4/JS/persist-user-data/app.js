/*
 * Botbuilder v4 SDK - Persist user data.
 * 
 * This bot demonstrates how to persist user input to a file as storage source. 
 * This bot will ask user for 'reserve table' information and persist the input to file.
 * The persisted file will be saved to 'c:/temp' directory.
 * The file name starts with "conversation!". This bot save data to the conversation data bag.
 * 
 * To run this bot:
 * 1) install these npm packages:
 * npm install --save restify
 * npm install --save botbuilder@preview
 * npm install --save botbuilder-dialogs@preview
 * 
 * 2) From VSCode, open the package.json file and
 * Update the property "main" to the name of the sample bot you want to run. 
 *    For example: "main": "persist-user-data/app.js" to run the this sample bot.
 * 3) run the bot in debug mode. 
 * 4) Load the emulator and point it to: http://localhost:3978/api/messages
 * 5) Send the message "hi" or "reserve table" to engage with the bot.
 *
 */ 

// Required packages for this bot
const { BotFrameworkAdapter, MemoryStorage, ConversationState, UserState, BotStateSet } = require('botbuilder');
const restify = require('restify');
const { DialogSet, WaterfallDialog, TextPrompt, DateTimePrompt, NumberPrompt } = require('botbuilder-dialogs');

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

// Create adapter
const adapter = new BotFrameworkAdapter({ 
    appId: process.env.MICROSOFT_APP_ID, 
    appPassword: process.env.MICROSOFT_APP_PASSWORD 
});

// Storage
const storage = new MemoryStorage(); // Volatile memory
const conversationState = new ConversationState(storage);
const userState  = new UserState(storage);
adapter.use(new BotStateSet(conversationState, userState));

const dialogs = new DialogSet(conversationState.createProperty('dialogState'));

// Listen for incoming activity 
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        const isMessage = (context.activity.type === 'message');
        // State will store all of your information 
        const convoState = conversationState.get(context);
        const dc = await dialogs.createContext(context);

        if (isMessage) {
            // Check for valid intents
            if(context.activity.text.match(/hello/ig)){
                return await dc.begin('greetings');
            }
            else if(context.activity.text.match(/reserve table/ig)){
                return await dc.begin('reserveTable');
            }
        }

        if(!context.responded){
            // Continue executing the "current" dialog, if any.
            var myVal = await dc.continue();

            if(!context.responded && isMessage){
                // Default message
                await context.sendActivity("Hi! I'm a simple bot. Please say 'Hello' or 'reserve table'.");
            }
        }
    });
});


// Greet user:
// Ask for the user name and then greet them by name.
// step:
// - values
// - result
// - options
// - next
dialogs.add(new WaterfallDialog('greetings', [
    async function (dc, step){
        step.values.userName = undefined;
        return await dc.prompt('textPrompt', 'Hi! What is your name?');
    },
    async function(dc, step){
        step.values.userName = step.result;
        await dc.context.sendActivity(`Hi ${step.values.userName}!`);
        return await dc.end(userName);
    }
]));

// Reserve a table:
// Help the user to reserve a table

dialogs.add(new WaterfallDialog('reserveTable', [
    async function(dc, step){
        await dc.context.sendActivity("Welcome to the reservation service.");

        step.values.reservationInfo = {}; // Clears any previous data
        return await dc.prompt('dateTimePrompt', "Please provide a reservation date and time.");
    },
    async function(dc, step){
        step.values.reservationInfo.dateTime = step.result[0].value;

        // Ask for next info
        return await dc.prompt('partySizePrompt', "How many people are in your party?");
    },
    async function(dc, step){
        step.values.reservationInfo.partySize = step.result;

        // Ask for next info
        return await dc.prompt('textPrompt', "Who's name will this be under?");
    },
    async function(dc, step){
        step.values.reservationInfo.reserveName = step.result;
        
        // Persist data
        var convo = conversationState.get(dc.context);
        convo.reservationInfo = step.values.reservationInfo;

        // Confirm reservation
        var msg = `Reservation confirmed. Reservation details: 
            <br/>Date/Time: ${step.values.reservationInfo.dateTime} 
            <br/>Party size: ${step.values.reservationInfo.partySize} 
            <br/>Reservation name: ${step.values.reservationInfo.reserveName}`;
            
        await dc.context.sendActivity(msg);
        return await dc.end();
    }
]));

// Define prompts
// Generic prompts
dialogs.add(new TextPrompt('textPrompt'));
dialogs.add(new DateTimePrompt('dateTimePrompt'));
dialogs.add(new NumberPrompt('partySizePrompt'));