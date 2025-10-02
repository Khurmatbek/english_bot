require("dotenv").config();
const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const SECRET_CHANNEL_ID = process.env.SECRET_CHANNEL_ID;

// === STATE STORAGE ===
const userState = {};
const userContacts = {};

bot.start((ctx) => {
  userState[ctx.from.id] = { step: "phone" };
  ctx.reply(
    "Hello! Please share your phone number 👇",
    Markup.keyboard([
      [Markup.button.contactRequest("📞 Share phone number")]
    ]).resize().oneTime()
  );
});

bot.on("contact", (ctx) => {
  userContacts[ctx.from.id] = ctx.message.contact.phone_number;
  userState[ctx.from.id] = { step: "fullname" };
  ctx.reply("✅ Phone received.\nNow type your full name:");
});

bot.on("text", (ctx) => {
  const state = userState[ctx.from.id];
  if (!state) return;

  if (state.step === "fullname") {
    userState[ctx.from.id] = { step: "topic", fullname: ctx.message.text };
    return ctx.reply("✅ Saved.\nNow type the topic:");
  }

  if (state.step === "topic") {
    userState[ctx.from.id] = {
      step: "media",
      fullname: state.fullname,
      topic: ctx.message.text,
    };
    return ctx.reply("✅ Saved.\nNow send a video, round video (video note) or photo:");
  }
});

async function handleMedia(ctx, fileId, type) {
  try {
    const state = userState[ctx.from.id];
    if (!state || state.step !== "media") {
      return ctx.reply("❌ Please start again with /start.");
    }

    const u = ctx.from;
    const fullname = state.fullname || `${u.first_name || ""} ${u.last_name || ""}`;
    const username = u.username ? `@${u.username}` : "❌ No username";
    const phone = userContacts[u.id] || "❌ No phone number";
    const topic = state.topic || "No topic";

    const caption = `
🎥 New ${type}

👤 Name: ${fullname}
📞 Phone: ${phone}
🔗 Username: ${username}
📝 Topic: ${topic}
    `;

    if (type === "video") {
      await ctx.telegram.sendVideo(SECRET_CHANNEL_ID, fileId, { caption });
    } else if (type === "round video") {
      // Correct way to forward round video
      await ctx.telegram.sendVideoNote(SECRET_CHANNEL_ID, fileId);
      await ctx.telegram.sendMessage(SECRET_CHANNEL_ID, caption);
    } else if (type === "photo") {
      await ctx.telegram.sendPhoto(SECRET_CHANNEL_ID, fileId, { caption });
    }

    await ctx.reply("✅ Media received and sent to the channel.");
    userState[ctx.from.id] = null;

  } catch (err) {
    console.error("❌ Error sending media:", err);
    ctx.reply("⚠️ Failed to send media. Check server logs for details.");
  }
}

// Standard video
bot.on("video", (ctx) => {
  console.log("📹 Received video:", ctx.message.video.file_id);
  handleMedia(ctx, ctx.message.video.file_id, "video");
});

// Photo
bot.on("photo", (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  console.log("🖼️ Received photo:", photo.file_id);
  handleMedia(ctx, photo.file_id, "photo");
});

// Round video (video_note)
bot.on("video_note", (ctx) => {
  console.log("⭕ Received round video:", ctx.message.video_note.file_id);
  handleMedia(ctx, ctx.message.video_note.file_id, "round video");
});

const app = express();
app.use(express.json());
app.use(bot.webhookCallback("/secret-path"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("🚀 Server is running on port:", PORT);

  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/secret-path`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log("✅ Webhook set:", webhookUrl);
});
