require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  Events,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// In-memory task store  { taskId -> task }
const tasks = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTaskEmbed(task) {
  const urgentColor = task.deadlineMinutes <= 30 ? 0xe74c3c : 0x3498db;
  return new EmbedBuilder()
    .setTitle('📢  NEW TASK AVAILABLE')
    .setColor(urgentColor)
    .addFields(
      { name: '📝 Task Type',   value: task.type,                     inline: true },
      { name: '👤 Task Giver',  value: task.giver,                    inline: true },
      { name: '💰 Credits',     value: `${task.credits}`,             inline: true },
      { name: '⏰ Deadline',    value: `${task.deadlineMinutes} Minutes`, inline: true },
      { name: '🔗 Task Link',   value: task.link,                     inline: false },
    )
    .setFooter({ text: 'React with ✅ after completion and submit proof in your ticket.' })
    .setTimestamp();
}

function makeClaimRow(taskId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim_${taskId}`)
      .setLabel('✅  Claim Task')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`skip_${taskId}`)
      .setLabel('⏭  Skip')
      .setStyle(ButtonStyle.Secondary),
  );
}

function makeTicketEmbed(task, user) {
  return new EmbedBuilder()
    .setTitle(`🎫  Your Task Ticket`)
    .setColor(0x2ecc71)
    .setDescription(`Hey ${user}, you claimed a task! Complete it before the deadline and submit your proof below.`)
    .addFields(
      { name: '📝 Task Type',   value: task.type,      inline: true },
      { name: '👤 Task Giver',  value: task.giver,     inline: true },
      { name: '💰 Credits',     value: `${task.credits}`,  inline: true },
      { name: '⏰ Deadline',    value: `${task.deadlineMinutes} Minutes`, inline: true },
      { name: '🔗 Task Link',   value: task.link,      inline: false },
    )
    .addFields({ name: '📋 Instructions', value: '1. Click the task link above\n2. Complete the task\n3. Come back here and click **Submit Proof**\n4. Paste your screenshot/link as proof' })
    .setFooter({ text: `Task ID: ${task.id}` })
    .setTimestamp();
}

function makeProofRow(taskId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`proof_${taskId}`)
      .setLabel('📸  Submit Proof')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`abandon_${taskId}`)
      .setLabel('❌  Abandon Task')
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Bot Ready ───────────────────────────────────────────────────────────────

client.once(Events.ClientReady, () => {
  console.log(`✅  Kite Task Bot is online as ${client.user.tag}`);
});

// ─── Slash Commands ──────────────────────────────────────────────────────────
// Register via deploy-commands.js (see below). Handled here at runtime.

client.on(Events.InteractionCreate, async (interaction) => {

  // ── /posttask slash command ──────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'posttask') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ You need the **Manage Messages** permission to post tasks.', ephemeral: true });
    }

    const taskId   = `task_${Date.now()}`;
    const type     = interaction.options.getString('type');
    const giver    = interaction.options.getString('giver');
    const credits  = interaction.options.getString('credits');
    const deadline = interaction.options.getInteger('deadline');
    const link     = interaction.options.getString('link');

    const task = { id: taskId, type, giver, credits, deadlineMinutes: deadline, link, claimedBy: null, status: 'open' };
    tasks.set(taskId, task);

    const embed = makeTaskEmbed(task);
    const row   = makeClaimRow(taskId);

    await interaction.reply({ embeds: [embed], components: [row] });
    return;
  }

  // ── Button: Claim ────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('claim_')) {
    const taskId = interaction.customId.replace('claim_', '');
    const task   = tasks.get(taskId);

    if (!task) return interaction.reply({ content: '❌ Task not found.', ephemeral: true });
    if (task.status !== 'open') return interaction.reply({ content: '⚠️ This task has already been claimed.', ephemeral: true });

    task.claimedBy = interaction.user.id;
    task.status    = 'claimed';

    // ── Create a private thread (ticket) in the same channel ────────────────
    try {
      const thread = await interaction.channel.threads.create({
        name: `🎫 ${interaction.user.username} – ${task.type}`,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Task claimed by ${interaction.user.tag}`,
      });

      // Add the claimant to the thread
      await thread.members.add(interaction.user.id);

      task.threadId = thread.id;

      const ticketEmbed = makeTicketEmbed(task, `<@${interaction.user.id}>`);
      const proofRow    = makeProofRow(taskId);

      await thread.send({ embeds: [ticketEmbed], components: [proofRow] });

      // Update original announcement embed to show it's claimed
      const claimedEmbed = makeTaskEmbed(task)
        .setTitle('📢  TASK CLAIMED')
        .setColor(0xf39c12)
        .addFields({ name: '👤 Claimed By', value: `<@${interaction.user.id}>` });

      await interaction.update({ embeds: [claimedEmbed], components: [] });
      await interaction.followUp({ content: `✅ Task claimed! Check your private ticket: ${thread}`, ephemeral: true });

    } catch (err) {
      console.error('Thread creation failed:', err);
      // Fallback: DM the user
      try {
        const dm = await interaction.user.createDM();
        const ticketEmbed = makeTicketEmbed(task, interaction.user.username);
        const proofRow    = makeProofRow(taskId);
        await dm.send({ embeds: [ticketEmbed], components: [proofRow] });
        await interaction.update({ embeds: [makeTaskEmbed(task).setTitle('📢  TASK CLAIMED').setColor(0xf39c12).addFields({ name: '👤 Claimed By', value: `<@${interaction.user.id}>` })], components: [] });
        await interaction.followUp({ content: `✅ Task claimed! Check your DMs for your ticket.`, ephemeral: true });
      } catch (dmErr) {
        console.error('DM also failed:', dmErr);
        await interaction.reply({ content: '❌ Could not create your ticket. Make sure your DMs are open.', ephemeral: true });
      }
    }
    return;
  }

  // ── Button: Skip ─────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('skip_')) {
    return interaction.reply({ content: '⏭ You skipped this task. Another one will come soon!', ephemeral: true });
  }

  // ── Button: Submit Proof ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('proof_')) {
    const taskId = interaction.customId.replace('proof_', '');
    const task   = tasks.get(taskId);
    if (!task) return interaction.reply({ content: '❌ Task not found.', ephemeral: true });

    // Show a modal for proof input
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`proofmodal_${taskId}`)
      .setTitle('Submit Your Proof');

    const proofInput = new TextInputBuilder()
      .setCustomId('proof_text')
      .setLabel('Paste your proof (link, description, etc.)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('e.g. Screenshot: https://imgur.com/... | Commented as u/yourname');

    modal.addComponents(new ActionRowBuilder().addComponents(proofInput));
    await interaction.showModal(modal);
    return;
  }

  // ── Modal: Proof Submitted ────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('proofmodal_')) {
    const taskId  = interaction.customId.replace('proofmodal_', '');
    const task    = tasks.get(taskId);
    const proof   = interaction.fields.getTextInputValue('proof_text');

    if (!task) return interaction.reply({ content: '❌ Task not found.', ephemeral: true });

    task.status = 'pending_review';
    task.proof  = proof;

    const doneEmbed = new EmbedBuilder()
      .setTitle('✅  Proof Submitted — Pending Review')
      .setColor(0x2ecc71)
      .addFields(
        { name: '📝 Task',    value: task.type,   inline: true },
        { name: '💰 Credits', value: `${task.credits}`, inline: true },
        { name: '📋 Proof',   value: proof },
      )
      .setFooter({ text: 'An admin will review and award your credits.' })
      .setTimestamp();

    await interaction.reply({ embeds: [doneEmbed] });

    // Notify task giver if they're a Discord user (by their username)
    // You can extend this to DM admins or log to a review channel
    const logChannelId = process.env.PROOF_LOG_CHANNEL_ID;
    if (logChannelId) {
      const logChannel = client.channels.cache.get(logChannelId);
      if (logChannel) {
        const reviewEmbed = new EmbedBuilder()
          .setTitle('📋  Proof Ready for Review')
          .setColor(0x9b59b6)
          .addFields(
            { name: '👤 User',    value: `<@${interaction.user.id}>`, inline: true },
            { name: '📝 Task',    value: task.type,                    inline: true },
            { name: '💰 Credits', value: `${task.credits}`,           inline: true },
            { name: '🔗 Link',    value: task.link,                    inline: false },
            { name: '📋 Proof',   value: proof },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [reviewEmbed] });
      }
    }
    return;
  }

  // ── Button: Abandon ───────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('abandon_')) {
    const taskId = interaction.customId.replace('abandon_', '');
    const task   = tasks.get(taskId);
    if (!task) return interaction.reply({ content: '❌ Task not found.', ephemeral: true });

    task.status    = 'open';
    task.claimedBy = null;

    await interaction.reply({ content: '❌ Task abandoned. It will be re-posted for others to claim.', ephemeral: true });

    // Re-post task in original channel
    if (task.channelId) {
      const ch = client.channels.cache.get(task.channelId);
      if (ch) {
        await ch.send({ embeds: [makeTaskEmbed(task)], components: [makeClaimRow(taskId)] });
      }
    }
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
