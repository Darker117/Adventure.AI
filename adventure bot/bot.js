require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ]
});

const userAdventures = new Map();

const registerCommands = async () => {
  try {
    const commands = [
      { 
        name: 'start-adventure', 
        description: 'Start a text-based adventure game' 
      },
      { 
        name: 'say', 
        description: 'Say something in your adventure',
        options: [{ name: 'message', type: 3, description: 'What you want to say', required: true }] 
      },
      { 
        name: 'do', 
        description: 'Perform an action in your adventure',
        options: [{ name: 'action', type: 3, description: 'The action you want to perform', required: true }] 
      },
      { 
        name: 'story', 
        description: 'Add narrative to your adventure',
        options: [{ name: 'narrative', type: 3, description: 'The narrative you want to add', required: true }] 
      },
      { 
        name: 'continue', 
        description: 'Continue your saved adventure' 
      }
    ];

    await client.application?.commands.set(commands);
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
};

const getAdventureResponse = async (userId, message) => {
  const previousMessages = userAdventures.get(userId) || [];
  previousMessages.push({ role: 'user', content: message });

  const response = await axios.post(
    'https://api.openai.com/v1/engines/davinci-codex/completions',
    {
      prompt: previousMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
      max_tokens: 100
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    }
  );

  const nextMessage = response.data.choices[0].text.trim();
  previousMessages.push({ role: 'assistant', content: nextMessage });
  userAdventures.set(userId, previousMessages);
  return nextMessage;
};

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const userId = interaction.user.id;

  try {
    await interaction.deferReply();
  } catch (error) {
    console.error('Failed to defer reply:', error);
    return;
  }

  try {
    const commandName = interaction.commandName;

    if (commandName === 'start-adventure') {
      const startMessage = 'You wake up in the heart of a quaint little town, surrounded by chatter and the aroma of fresh-baked bread. Nearby, a town crier announces something about a mysterious quest. You cant shake the feeling that destiny is calling. What will you do?';
      userAdventures.set(userId, [{ role: 'system', content: 'You are embarking on a text-based adventure game.' }, { role: 'assistant', content: startMessage }]);
      await interaction.followUp(startMessage);
    }

    if (commandName === 'continue') {
      const previousMessages = userAdventures.get(userId);
      if (previousMessages && previousMessages.length > 0) {
        const lastMessage = previousMessages[previousMessages.length - 1];
        await interaction.followUp(`Continuing your adventure: ${lastMessage.content}`);
      } else {
        await interaction.followUp("You don't have a saved adventure to continue.");
      }
    }

    if (commandName === 'say') {
      const userMessage = interaction.options.getString('message');
      const nextMessage = await getAdventureResponse(userId, userMessage);
      await interaction.followUp(nextMessage);
    }

    if (commandName === 'do') {
      const userAction = interaction.options.getString('action');
      const nextMessage = await getAdventureResponse(userId, `/do ${userAction}`);
      await interaction.followUp(nextMessage);
    }

    if (commandName === 'story') {
      const userNarrative = interaction.options.getString('narrative');
      const nextMessage = await getAdventureResponse(userId, `/story ${userNarrative}`);
      await interaction.followUp(nextMessage);
    }
  } catch (error) {
    console.error('An error occurred:', error);
    await interaction.followUp('An error occurred. Please try again later.');
  }
});

client.login(BOT_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
});
