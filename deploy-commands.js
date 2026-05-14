require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('posttask')
    .setDescription('Post a new Kite task to this channel')
    .addStringOption(o => o.setName('type').setDescription('Task type (e.g. Reddit Comment)').setRequired(true))
    .addStringOption(o => o.setName('giver').setDescription('Task giver username').setRequired(true))
    .addStringOption(o => o.setName('credits').setDescription('Credit reward (e.g. 0.15)').setRequired(true))
    .addIntegerOption(o => o.setName('deadline').setDescription('Deadline in minutes').setRequired(true))
    .addStringOption(o => o.setName('link').setDescription('Task link URL').setRequired(true))
    .setDefaultMemberPermissions(0x0000000000002000n), // ManageMessages
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error(err);
  }
})();
